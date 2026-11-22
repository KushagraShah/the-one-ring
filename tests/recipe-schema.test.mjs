import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/202611120007_online_recipes.sql', import.meta.url), 'utf8')
const formatGuard = await readFile(new URL('../supabase/migrations/202611220008_recipe_format_guard.sql', import.meta.url), 'utf8')
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002'
const op = '10000000-0000-4000-8000-000000000001', op2 = '10000000-0000-4000-8000-000000000002'
test('recipe writes isolate accounts, reject stale edits and retry idempotently', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;`)
    await db.exec(migration)
    await db.exec(formatGuard)
    await db.query('insert into auth.users(id) values ($1),($2)', [a, b])
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a])
    const read = async owner => (await db.query('select public.tor_online_recipe_read($1) as value', [owner])).rows[0].value
    const write = async (owner, revision, operation, data) => (await db.query('select public.tor_online_recipe_write($1,$2,$3,$4::jsonb) as value', [owner, revision, operation, JSON.stringify(data)])).rows[0].value
    const data = { version: 1, recipes: [], shopping: null, cooking: null }
    assert.deepEqual(await read(a), { revision: 0, data: null })
    assert.deepEqual(await write(a, 0, op, data), { status: 'ok', revision: 1 })
    assert.deepEqual(await write(a, 0, op, data), { status: 'ok', revision: 1 })
    await assert.rejects(write(a, 1, op, data))
    await assert.rejects(write(a, 0, op, { ...data, entries: ['different request'] }))
    assert.deepEqual(await write(a, 0, op2, data), { status: 'conflict' })
    await assert.rejects(read(b))
    await assert.rejects(db.query('select * from public.tor_online_recipe_workspaces'))
    await assert.rejects(db.query('delete from public.tor_online_recipe_workspaces'))
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [b])
    assert.deepEqual(await read(b), { revision: 0, data: null })
    await assert.rejects(write(a, 1, op2, data))
    const other = { ...data, marker: 'other account' }
    assert.deepEqual(await write(b, 0, op2, other), { status: 'ok', revision: 1 })
    assert.deepEqual(await read(b), { revision: 1, data: other })
    await assert.rejects(write(b, -1, op, data))
    await assert.rejects(write(b, 1, op, []))
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a])
    assert.deepEqual(await read(a), { revision: 1, data })
    const organized = { ...data, version: 2, meta: {} }
    assert.deepEqual(await write(a, 1, op2, organized), { status: 'ok', revision: 2 })
    await assert.rejects(write(a, 2, op, data), /App update required/)
    const expanded = { ...organized, version: 3, plan: [], sides: [] }
    assert.deepEqual(await write(a, 2, op, expanded), { status: 'ok', revision: 3 })
    await assert.rejects(write(a, 3, op2, organized), /App update required/)
    for (const invalid of [
      { ...expanded, version: '3' }, { ...expanded, version: 4 },
      { ...expanded, recipes: {} }, { ...expanded, shopping: [] },
      { ...expanded, cooking: false }, { ...expanded, meta: [] },
      { ...expanded, plan: {} }, { ...expanded, sides: null },
    ]) await assert.rejects(write(a, 3, op2, invalid), /Unsupported|Invalid/)
    await assert.rejects(write(a, 3, op2, { ...expanded, padding: 'x'.repeat(10_000_001) }), /Invalid recipe request/)
    assert.deepEqual(await read(a), { revision: 3, data: expanded })
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    await assert.rejects(read(a))
    await assert.rejects(write(a, 1, op2, data))
    await db.exec('reset role; set role anon')
    await assert.rejects(read(a))
    await assert.rejects(write(a, 1, op2, data))
  } finally { await db.close() }
})

test('recipe preflight and verification SQL detect absent, partial and unsafe installations', async () => {
  const preflight = await readFile(new URL('../supabase/checks/recipe-book-preflight.sql', import.meta.url), 'utf8')
  const verification = await readFile(new URL('../supabase/checks/recipe-book-verify.sql', import.meta.url), 'utf8')
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`)
    for (const file of ['202611070004_online_workouts.sql', '202611070005_history_client_guard.sql', '202611080006_online_habits.sql']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    }
    const checks = async sql => Object.fromEntries((await db.query(sql)).rows.map(row => [row.check_name, row.ok]))
    assert.ok(Object.values(await checks(preflight)).every(Boolean))
    assert.ok(Object.values(await checks(verification)).every(value => value === false))
    await db.exec(migration)
    const partial = await checks(verification)
    assert.equal(partial['format guard installed and enabled'], false)
    assert.equal((await checks(preflight))['recipe table absent'], false)
    await db.exec(formatGuard)
    assert.ok(Object.values(await checks(verification)).every(Boolean))
    await db.exec('grant execute on function public.tor_online_recipe_write(uuid,bigint,uuid,jsonb) to public')
    assert.equal((await checks(verification))['RPC grants authenticated only'], false)
    await db.exec('revoke execute on function public.tor_online_recipe_write(uuid,bigint,uuid,jsonb) from public; grant select on public.tor_online_recipe_workspaces to authenticated')
    assert.equal((await checks(verification))['direct client table access denied'], false)
    await db.exec('revoke select on public.tor_online_recipe_workspaces from authenticated; alter table public.tor_online_recipe_workspaces disable trigger tor_recipe_format_guard')
    assert.equal((await checks(verification))['format guard installed and enabled'], false)
  } finally { await db.close() }
})
