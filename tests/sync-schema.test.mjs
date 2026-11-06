import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/202611060002_sync_protocol.sql', import.meta.url), 'utf8')
const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const id = '10000000-0000-4000-8000-000000000001'
const op = '20000000-0000-4000-8000-000000000001'
const op2 = '20000000-0000-4000-8000-000000000002'
const op3 = '20000000-0000-4000-8000-000000000003'
const change = (revision, body = { name: 'Press' }, deleted = false) => [{ id, kind: 'exercise', base_revision: revision, deleted, body }]

test('sync batches are owner-scoped, atomic, revision checked and idempotent', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;`)
    await db.exec(migration)
    await db.query('insert into auth.users(id) values ($1),($2)', [a, b])
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a])
    const invoke = async (operation, changes) => (await db.query('select public.tor_apply_sync_batch($1,$2::jsonb) as result', [operation, JSON.stringify(changes)])).rows[0].result
    const first = await invoke(op, change(0))
    assert.equal(first.status, 'ok')
    assert.deepEqual(await invoke(op, change(0)), first)
    await assert.rejects(invoke(op, change(0, { name: 'Different' })))
    assert.equal((await invoke(op2, change(0, { name: 'Stale' }))).status, 'conflict')
    assert.equal((await db.query('select body from public.tor_sync_records')).rows[0].body.name, 'Press')
    await assert.rejects(db.query("update public.tor_sync_records set body = '{}'"))
    assert.equal((await invoke(op3, change(1, null, true))).status, 'ok')
    assert.equal((await db.query('select deleted from public.tor_sync_records')).rows[0].deleted, true)
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [b])
    assert.equal((await db.query('select * from public.tor_sync_records')).rows.length, 0)
    assert.equal((await invoke(op, change(0, { name: 'Other user' }))).status, 'ok')
    assert.equal((await db.query('select body from public.tor_sync_records')).rows[0].body.name, 'Other user')
  } finally { await db.close() }
})
