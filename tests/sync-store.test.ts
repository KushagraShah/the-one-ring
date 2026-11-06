import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SyncStore } from '../src/sync/store'
import { syncOnce, type SyncTransport } from '../src/sync/engine'

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
const record = (name: string) => ({ kind: 'exercise' as const, id: 'exercise-1', body: { name }, deleted: false })

test('writes persist across restart and pending retries keep their operation ID', async () => {
  const dbName = `test-${crypto.randomUUID()}`
  const first = await SyncStore.open(dbName)
  await first.put('user-a', [record('Press')])
  const pending = await first.prepare('user-a')
  first.close()
  const reopened = await SyncStore.open(dbName)
  assert.deepEqual(await reopened.prepare('user-a'), pending)
  assert.equal(Object.keys((await reopened.read('user-b')).records).length, 0)
  reopened.close()
})

test('edits while syncing stay dirty after the older request is acknowledged', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  await store.put('user-a', [record('Before')])
  const batch = (await store.prepare('user-a'))!
  await store.put('user-a', [record('After')])
  await store.acknowledge('user-a', batch.operationId, [{ kind: 'exercise', id: 'exercise-1', revision: 1 }])
  const saved = (await store.read('user-a')).records['exercise/exercise-1']
  assert.equal(saved.body?.name, 'After')
  assert.equal(saved.revision, 1)
  assert.equal(saved.dirty, true)
  assert.equal((await store.prepare('user-a'))?.changes[0].base_revision, 1)
  store.close()
})

test('a conflict preserves both pending request and local changes', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  await store.put('user-a', [record('Local')])
  const pending = (await store.prepare('user-a'))!
  await store.markConflict('user-a', pending.operationId, [{ kind: 'exercise', id: 'exercise-1', expected: 0, actual: 1 }])
  const state = await store.read('user-a')
  assert.equal(state.records['exercise/exercise-1'].body?.name, 'Local')
  assert.equal(state.pending?.conflicts?.[0].actual, 1)
  store.close()
})

test('a lost response retries the same request and eventually clears the queue', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  await store.put('user-a', [record('Offline workout')])
  let sent = ''
  let attempts = 0
  const transport: SyncTransport = {
    async pull() { return [] },
    async push(batch) {
      attempts++
      if (!sent) { sent = batch.operationId; throw new Error('Connection lost after server commit') }
      assert.equal(batch.operationId, sent)
      return { status: 'ok', records: [{ kind: 'exercise', id: 'exercise-1', revision: 1 }] }
    },
  }
  await assert.rejects(syncOnce(store, 'user-a', transport))
  assert.equal((await store.read('user-a')).pending?.operationId, sent)
  assert.equal(await syncOnce(store, 'user-a', transport), 'synced')
  assert.equal(attempts, 2)
  assert.equal((await store.read('user-a')).records['exercise/exercise-1'].dirty, false)
  store.close()
})

test('pull does not overwrite dirty edits and conflict resolution is explicit', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  await store.put('user-a', [record('Local')])
  const remote = [{ ...record('Server'), revision: 1 }]
  const transport: SyncTransport = { async pull() { return remote }, async push() { return { status: 'conflict', conflicts: [{ kind: 'exercise', id: 'exercise-1', expected: 0, actual: 1 }] } } }
  assert.equal(await syncOnce(store, 'user-a', transport), 'conflict')
  assert.equal((await store.read('user-a')).records['exercise/exercise-1'].body?.name, 'Local')
  await store.resolve('user-a', 'local', remote)
  assert.equal((await store.prepare('user-a'))?.changes[0].base_revision, 1)
  store.close()
})

test('replacing a projection creates a tombstone instead of losing deletion history', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  await store.put('user-a', [record('Press')])
  const batch = (await store.prepare('user-a'))!
  await store.acknowledge('user-a', batch.operationId, [{ kind: 'exercise', id: 'exercise-1', revision: 1 }])
  await store.replace('user-a', [])
  const next = (await store.prepare('user-a'))!
  assert.deepEqual(next.changes[0], { kind: 'exercise', id: 'exercise-1', body: null, deleted: true, base_revision: 1 })
  store.close()
})

test('object key order returned by Postgres does not create spurious edits', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  const local = { kind: 'exercise' as const, id: 'exercise-1', body: { a: 1, b: 2 }, deleted: false }
  await store.mergeRemote('user-a', [{ ...local, body: { b: 2, a: 1 }, revision: 1 }])
  await store.replace('user-a', [local])
  assert.equal((await store.read('user-a')).records['exercise/exercise-1'].dirty, false)
  store.close()
})
