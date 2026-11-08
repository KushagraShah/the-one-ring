import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/202611080006_online_habits.sql', import.meta.url), 'utf8')
const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002'
const op = '10000000-0000-4000-8000-000000000001', op2 = '10000000-0000-4000-8000-000000000002'
test('habit writes isolate accounts, reject stale edits and retry idempotently', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;`)
    await db.exec(migration)
    await db.query('insert into auth.users(id) values ($1),($2)', [a, b])
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a])
    const read = async owner => (await db.query('select public.tor_online_habit_read($1) as value', [owner])).rows[0].value
    const write = async (owner, revision, operation, data) => (await db.query('select public.tor_online_habit_write($1,$2,$3,$4::jsonb) as value', [owner, revision, operation, JSON.stringify(data)])).rows[0].value
    const data = { version: 1, habits: [], entries: [] }
    assert.deepEqual(await read(a), { revision: 0, data: null })
    assert.deepEqual(await write(a, 0, op, data), { status: 'ok', revision: 1 })
    assert.deepEqual(await write(a, 0, op, data), { status: 'ok', revision: 1 })
    await assert.rejects(write(a, 1, op, data))
    await assert.rejects(write(a, 0, op, { ...data, entries: ['different request'] }))
    assert.deepEqual(await write(a, 0, op2, data), { status: 'conflict' })
    await assert.rejects(read(b))
    await assert.rejects(db.query('select * from public.tor_online_habit_workspaces'))
    await assert.rejects(db.query('delete from public.tor_online_habit_workspaces'))
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [b])
    assert.deepEqual(await read(b), { revision: 0, data: null })
    await assert.rejects(write(a, 1, op2, data))
    const other = { version: 1, habits: [], entries: [], marker: 'other account' }
    assert.deepEqual(await write(b, 0, op2, other), { status: 'ok', revision: 1 })
    assert.deepEqual(await read(b), { revision: 1, data: other })
    await assert.rejects(write(b, -1, op, data))
    await assert.rejects(write(b, 1, op, []))
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a])
    assert.deepEqual(await read(a), { revision: 1, data })
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    await assert.rejects(read(a))
    await assert.rejects(write(a, 1, op2, data))
    await db.exec('reset role; set role anon')
    await assert.rejects(read(a))
    await assert.rejects(write(a, 1, op2, data))
  } finally { await db.close() }
})

test('documented habit migration checks match before and after states', async () => {
  const docs = await readFile(new URL('../docs/supabase-migrations.md', import.meta.url), 'utf8')
  const queries = [...docs.matchAll(/```sql\n([\s\S]*?)\n\s*```/g)].map(match => match[1])
  const preflight = queries.find(query => query.includes('history_guard_marker_present'))
  const verification = queries.find(query => query.includes('habit_functions_security_definer'))
  assert.ok(preflight && verification, 'Migration checks are present in the runbook')
  const workout = await readFile(new URL('../supabase/migrations/202611070004_online_workouts.sql', import.meta.url), 'utf8')
  const guard = await readFile(new URL('../supabase/migrations/202611070005_history_client_guard.sql', import.meta.url), 'utf8')
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`)
    await db.exec(workout)
    await db.exec(guard)
    const before = (await db.query(preflight)).rows[0]
    assert.equal(before.workout_heads_exist, true)
    assert.equal(before.workout_records_exist, true)
    assert.equal(before.workout_read_exists, true)
    assert.equal(before.workout_write_exists, true)
    assert.equal(before.history_guard_marker_present, true)
    assert.equal(before.habit_table_exists, false)
    assert.equal(Number(before.habit_function_count), 0)
    await db.exec(migration)
    const after = (await db.query(verification)).rows[0]
    assert.deepEqual(Object.values(after), [true, true, true, true, true])
    const repeat = (await db.query(preflight)).rows[0]
    assert.equal(repeat.habit_table_exists, true)
    assert.equal(Number(repeat.habit_function_count), 2)
  } finally { await db.close() }
})
