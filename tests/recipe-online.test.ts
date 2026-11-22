import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { PGlite } from '@electric-sql/pglite'
import { OnlineRecipeStore, type SaveStatus } from '../src/recipes/online'
import { contentMarkdown, emptyContent, emptyNutrition, emptyRecipes, type RecipeData } from '../src/recipes/model'

// Exercise the actual Supabase client and store against the migration SQL.
// The HTTP adapter models PostgREST; this is not a live Supabase test.
test('Supabase recipe RPCs retain full workspaces, recover lost replies and preserve stale edits', { timeout: 30_000 }, async () => {
  const db = new PGlite()
  const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002'
  let loseReply = false
  const writes: { owner: string; args: Record<string, unknown> }[] = []
  const client = (owner: string) => createClient('https://recipe-test.invalid', 'sb_publishable_test', {
    accessToken: async () => owner,
    global: { fetch: async (input, init) => {
      assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${owner}`)
      const name = new URL(String(input)).pathname.split('/').at(-1)
      const args = JSON.parse(String(init?.body))
      const isWrite = name === 'tor_online_recipe_write'
      assert.ok(isWrite || name === 'tor_online_recipe_read')
      if (isWrite) writes.push({ owner, args })
      try {
        const value = await db.transaction(async tx => {
          await tx.exec('set local role authenticated')
          await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [owner])
          const sql = isWrite ? 'select public.tor_online_recipe_write($1,$2,$3,$4::jsonb) as value' : 'select public.tor_online_recipe_read($1) as value'
          const params = isWrite ? [args.p_owner, args.p_revision, args.p_operation, JSON.stringify(args.p_data)] : [args.p_owner]
          return (await tx.query<{ value: unknown }>(sql, params)).rows[0].value
        })
        if (isWrite && loseReply) { loseReply = false; return Response.json({ message: 'Reply lost after commit' }, { status: 503 }) }
        return Response.json(value)
      } catch (error) {
        return Response.json({ code: '42501', message: error instanceof Error ? error.message : 'RPC rejected' }, { status: 403 })
      }
    } },
  })
  const settle = (store: OnlineRecipeStore, action: () => void) => new Promise<SaveStatus>(resolve => {
    store.onStatus = status => { if (status !== 'saving') resolve(status) }
    action()
  })
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    for (const file of ['202611120007_online_recipes.sql', '202611220008_recipe_format_guard.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    await db.query('insert into auth.users(id) values ($1), ($2)', [a, b])
    const accountA = client(a), accountB = client(b)
    const first = new OnlineRecipeStore(accountA, a)
    assert.deepEqual(await first.load(), emptyRecipes())
    const content = { ...emptyContent(), title: 'SQL test curry', portions: '4', steps: ['Cook.', 'Serve.'] }
    const recipe = { id: a, content, markdown: contentMarkdown(content), source: 'Original import' }
    const side = { id: 'rice', name: 'Rice', portion: '100 g', shopping: '200 g rice', nutrition: emptyNutrition() }
    const snapshot: RecipeData = {
      ...emptyRecipes(), recipes: [recipe], sides: [side], plan: [{ id: 'meal', recipe, side }],
      meta: { [a]: { archived: false, idea: false, rotation: true, lastPrepared: '2026-11-01' } },
      shopping: { sources: [recipe], planned: ['meal'], items: [{ id: 'item', text: '200 g rice', recipe: content.title, pantry: false, state: 'bought' }] },
      cooking: { recipe, side, step: 1 },
    }
    loseReply = true
    assert.equal(await settle(first, () => first.update(snapshot)), 'error')
    // The server committed, but the store has not received confirmation yet.
    assert.deepEqual(await new OnlineRecipeStore(accountA, a).load(), snapshot)
    const latest = { ...snapshot, plan: [] }
    first.update(latest)
    assert.equal(await settle(first, () => first.retry()), 'saved')
    assert.deepEqual(writes[0], writes[1], 'Retry must preserve the operation and exact request')
    assert.notEqual(writes[1].args.p_operation, writes[2].args.p_operation)
    assert.deepEqual(await new OnlineRecipeStore(accountA, a).load(), latest)
    const stale = new OnlineRecipeStore(accountA, a)
    await stale.load()
    const winning = { ...latest, cooking: null }
    assert.equal(await settle(first, () => first.update(winning)), 'saved')
    assert.equal(await settle(stale, () => stale.update({ ...latest, sides: [] })), 'conflict')
    const requestCount = writes.length
    stale.retry()
    assert.equal(writes.length, requestCount, 'Conflict recovery must not overwrite the winning workspace')
    assert.deepEqual(await new OnlineRecipeStore(accountA, a).load(), winning)
    assert.deepEqual(await new OnlineRecipeStore(accountB, b).load(), emptyRecipes())
    await assert.rejects(new OnlineRecipeStore(accountB, a).load())
    const denied = await accountB.rpc('tor_online_recipe_write', { p_owner: a, p_revision: 3, p_operation: crypto.randomUUID(), p_data: emptyRecipes() })
    assert.ok(denied.error)
    assert.deepEqual(await new OnlineRecipeStore(accountA, a).load(), winning)
    const ownB = new OnlineRecipeStore(accountB, b)
    await ownB.load()
    assert.equal(await settle(ownB, () => ownB.update({ ...emptyRecipes(), recipes: [recipe] })), 'saved')
    assert.deepEqual(await new OnlineRecipeStore(accountA, a).load(), winning)
  } finally { await db.close() }
})
