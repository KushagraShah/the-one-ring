import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

test('RxDB workspace schema isolates owners and rejects identity changes', async () => {
  const db = new PGlite()
  const a = '10000000-0000-4000-8000-000000000001'
  const b = '20000000-0000-4000-8000-000000000002'
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    await db.exec(await readFile('supabase/migrations/202611070003_rxdb_workout_workspace.sql', 'utf8'))
    await db.query('insert into auth.users(id) values ($1),($2)', [a, b])
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a])
    await db.query('insert into public.tor_rx_workout_workspaces (id,user_id,payload) values ($1,$2,$3)', [`${a}-workout`, a, '{}'])
    await assert.rejects(db.query('insert into public.tor_rx_workout_workspaces (id,user_id,payload) values ($1,$2,$3)', [`${b}-workout`, b, '{}']))
    await assert.rejects(db.query('update public.tor_rx_workout_workspaces set id=$1,user_id=$2', [`${b}-workout`, b]))
    await assert.rejects(db.query('delete from public.tor_rx_workout_workspaces'))
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [b])
    assert.equal((await db.query('select id from public.tor_rx_workout_workspaces')).rows.length, 0)
  } finally { await db.close() }
})
