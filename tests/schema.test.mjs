import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/202611060001_workout_schema.sql', import.meta.url), 'utf8')
const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const exercise = '10000000-0000-4000-8000-000000000001'
const exerciseB = '10000000-0000-4000-8000-000000000002'
const routine = '20000000-0000-4000-8000-000000000001'
const day = '30000000-0000-4000-8000-000000000001'
const slot = '40000000-0000-4000-8000-000000000001'

test('schema applies and restricts reads, writes, and cross-owner references', async () => {
  const db = new PGlite()
  try {
    // Supabase supplies these roles and auth objects. This local fixture is not
    // a substitute for running the same tests against a real Supabase project.
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;`)
    await db.exec(migration)
    await db.query('insert into auth.users (id) values ($1),($2)', [a, b])
    await db.query('insert into public.tor_exercises (id,user_id,name,tracking_type) values ($1,$2,$3,$4),($5,$6,$7,$8)', [exercise, a, 'Press', 'strength', exerciseB, b, 'Private exercise', 'strength'])
    await db.query('insert into public.tor_routines (id,user_id,name) values ($1,$2,$3)', [routine, a, 'Routine'])
    await db.query('insert into public.tor_routine_days (id,user_id,routine_id,name,position) values ($1,$2,$3,$4,0)', [day, a, routine, 'Push'])
    await assert.rejects(db.query("insert into public.tor_routine_slots (id,user_id,routine_id,day_id,position,selection_mode,default_exercise_id) values ($1,$2,$3,$4,0,'fixed',$5)", [slot, a, routine, day, exerciseB]))
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a])
    const result = await db.query('select id from public.tor_exercises')
    assert.deepEqual(result.rows.map(row => row.id), [exercise])
    await assert.rejects(db.query("insert into public.tor_exercises (id,user_id,name,tracking_type) values ($1,$2,'Forged','strength')", [slot, b]))
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [b])
    const other = await db.query('select id from public.tor_exercises')
    assert.deepEqual(other.rows.map(row => row.id), [exerciseB])
  } finally { await db.close() }
})
