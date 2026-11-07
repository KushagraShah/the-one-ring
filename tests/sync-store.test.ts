import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SyncStore, matchingRevisions } from '../src/sync/store'
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

test('a local projection does not overwrite an unseen remote change without a conflict', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  const initial = record('Initial')
  await store.mergeRemote('user-a', [{ ...initial, revision: 1 }])
  await store.mergeRemote('user-a', [{ ...record('Remote'), revision: 2 }])
  await store.project('user-a', [initial], [record('Local')], { 'exercise/exercise-1': 1 })
  const batch = (await store.prepare('user-a'))!
  assert.equal(batch.changes[0].base_revision, 1)
  assert.equal(batch.changes[0].body?.name, 'Local')
  store.close()
})

test('an unrelated local edit does not turn unseen remote records into edits or tombstones', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  const initial = record('Initial')
  const remoteExtra = { ...record('Remote extra'), id: 'exercise-2' }
  await store.mergeRemote('user-a', [{ ...initial, revision: 1 }, { ...remoteExtra, revision: 1 }])
  await store.project('user-a', [initial], [record('Local')], { 'exercise/exercise-1': 1 })
  const state = await store.read('user-a')
  assert.equal(state.records['exercise/exercise-2'].dirty, false)
  assert.equal(state.records['exercise/exercise-2'].deleted, false)
  store.close()
})

test('conflict resolution refuses to discard edits made since confirmation', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  await store.put('user-a', [record('Local')])
  const pending = (await store.prepare('user-a'))!
  await store.markConflict('user-a', pending.operationId, [{ kind: 'exercise', id: 'exercise-1', expected: 0, actual: 1 }])
  const before = await store.read('user-a')
  await store.put('user-a', [record('New local edit')])
  await assert.rejects(store.resolve('user-a', 'remote', [{ ...record('Remote'), revision: 1 }], { 'exercise/exercise-1': before.records['exercise/exercise-1'].generation }), /Local data changed/)
  assert.equal((await store.read('user-a')).records['exercise/exercise-1'].body?.name, 'New local edit')
  store.close()
})

test('acknowledged revisions advance only when the UI displays their contents', () => {
  const displayed = record('Local')
  const key = 'exercise/exercise-1'
  const base = { [key]: 1 }
  assert.equal(matchingRevisions({ [key]: { ...displayed, revision: 2, generation: 1, dirty: false } }, [displayed], base)[key], 2)
  assert.equal(matchingRevisions({ [key]: { ...record('Unseen remote'), revision: 3, generation: 1, dirty: false } }, [displayed], base)[key], 1)
  assert.equal(matchingRevisions({ [key]: { ...displayed, revision: 2, generation: 1, dirty: true } }, [displayed], base)[key], 1)
})

test('an edit can use an acknowledged revision when its starting value still matches', async () => {
  const store = await SyncStore.open(`test-${crypto.randomUUID()}`)
  const displayed = record('Before')
  await store.mergeRemote('user-a', [{ ...displayed, revision: 2 }])
  await store.project('user-a', [displayed], [record('After')], { 'exercise/exercise-1': 1 })
  assert.equal((await store.prepare('user-a'))!.changes[0].base_revision, 2)
  store.close()
})
