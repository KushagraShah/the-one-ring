import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/202611070004_online_workouts.sql', import.meta.url), 'utf8')
const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const op = '10000000-0000-4000-8000-000000000001'
const op2 = '10000000-0000-4000-8000-000000000002'
const documents = [{ kind: 'settings', id: op, body: { active: 'initial' } }, { kind: 'routine', id: op2, body: { name: 'Test' } }]

test('online writes are atomic, owner-scoped, revision-checked and retryable', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`)
    await db.exec(migration)
    await db.query('insert into auth.users(id) values ($1), ($2)', [a, b])
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a])
    const write = async (owner, revision, operation, docs) => (await db.query('select public.tor_online_workout_write($1,$2,$3,$4::jsonb) as value', [owner, revision, operation, JSON.stringify(docs)])).rows[0].value
    const read = async owner => (await db.query('select public.tor_online_workout_read($1) as value', [owner])).rows[0].value
    assert.deepEqual(await read(a), { revision: 0, documents: [] })
    assert.deepEqual(await write(a, 0, op, documents), { status: 'ok', revision: 1 })
    assert.deepEqual(await write(a, 0, op, documents), { status: 'ok', revision: 1 })
    await assert.rejects(write(a, 1, op, documents))
    await assert.rejects(write(a, 0, op, []))
    assert.deepEqual(await write(a, 0, op2, []), { status: 'conflict' })
    await assert.rejects(write(a, 1, op2, [documents[0], documents[0]]))
    assert.equal((await read(a)).documents.length, 2)
    await assert.rejects(read(b))
    await assert.rejects(db.query('select * from public.tor_online_workout_records'))
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [b])
    assert.deepEqual(await read(b), { revision: 0, documents: [] })
    await assert.rejects(write(a, 1, op2, []))
    await db.exec('reset role; set role anon')
    await assert.rejects(read(a))
  } finally { await db.close() }
})
