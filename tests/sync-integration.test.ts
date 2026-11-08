import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { SyncStore, type Kind } from '../src/workout/legacy-sync/store'
import { syncOnce, type SyncResult, type SyncTransport } from '../src/workout/legacy-sync/engine'

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
const owner = '00000000-0000-4000-8000-000000000001'
const id = '10000000-0000-4000-8000-000000000001'

test('two devices synchronize independent edits and preserve conflicting edits', async () => {
  const db = new PGlite()
  const first = await SyncStore.open(`device-a-${crypto.randomUUID()}`)
  const second = await SyncStore.open(`device-b-${crypto.randomUUID()}`)
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    await db.exec(await readFile('supabase/migrations/202611060002_sync_protocol.sql', 'utf8'))
    await db.query('insert into auth.users(id) values ($1)', [owner])
    await db.exec('set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner])
    const transport: SyncTransport = {
      async pull() { const result = await db.query<{ kind: Kind; entity_id: string; revision: number; deleted: boolean; body: Record<string, unknown> | null }>('select kind, entity_id, revision, deleted, body from public.tor_sync_records'); return result.rows.map(row => ({ kind: row.kind, id: row.entity_id, revision: Number(row.revision), deleted: row.deleted, body: row.body })) },
      async push(batch) { const result = await db.query<{ result: SyncResult }>('select public.tor_apply_sync_batch($1,$2::jsonb) as result', [batch.operationId, JSON.stringify(batch.changes)]); return result.rows[0].result },
    }
    const record = (name: string) => ({ kind: 'exercise' as const, id, body: { name }, deleted: false })
    await first.put(owner, [record('Initial')])
    assert.equal(await syncOnce(first, owner, transport), 'synced')
    assert.equal(await syncOnce(second, owner, transport), 'synced')
    assert.equal((await second.read(owner)).records[`exercise/${id}`].body?.name, 'Initial')
    await first.put(owner, [record('Device A')])
    await second.put(owner, [record('Device B')])
    assert.equal(await syncOnce(first, owner, transport), 'synced')
    assert.equal(await syncOnce(second, owner, transport), 'conflict')
    assert.equal((await second.read(owner)).records[`exercise/${id}`].body?.name, 'Device B')
    await second.resolve(owner, 'local', await transport.pull())
    assert.equal(await syncOnce(second, owner, transport), 'synced')
    assert.equal((await transport.pull())[0].body?.name, 'Device B')
  } finally { first.close(); second.close(); await db.close() }
})
