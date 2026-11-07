import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { replicateRxCollection } from 'rxdb/plugins/replication'
import { Subject } from 'rxjs'
import { conflictAlternatives, openWorkoutWorkspace, readWorkoutWorkspace, writeWorkoutWorkspace } from '../src/sync/rxdbWorkspace'
import type { Backup } from '../src/workout/backup'

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
const snapshot: Backup = { version: 1, data: { completed: [], workouts: [], session: null }, warmupItems: [], days: [{ name: 'Push', subtitle: '', exercises: [] }], library: [], routines: { active: 'initial', routines: [{ id: 'initial', name: 'Routine', days: [{ name: 'Push', subtitle: '', exercises: [] }], completed: [] }] } }

test('RxDB workspace survives closing and keeps owners separate', async () => {
  const owner = crypto.randomUUID()
  const db = await openWorkoutWorkspace(owner)
  await writeWorkoutWorkspace(db, owner, snapshot)
  await db.close()
  const reopened = await openWorkoutWorkspace(owner)
  const other = await openWorkoutWorkspace(crypto.randomUUID())
  assert.deepEqual(await readWorkoutWorkspace(reopened, owner), snapshot)
  assert.equal(await readWorkoutWorkspace(other, owner), null)
  await reopened.close()
  await other.close()
})

test('conflicts retain distinct local versions alongside the server version', () => {
  const server = { id: 'workout', user_id: 'owner', payload: 'server', alternatives: '["earlier"]' }
  const local = { id: 'workout', user_id: 'owner', payload: 'local', alternatives: '["earlier","other"]' }
  assert.deepEqual(conflictAlternatives(server, local), { id: 'workout', user_id: 'owner', payload: 'server', alternatives: '["earlier","local","other"]' })
})

test('edits cannot silently overwrite unresolved alternatives', async () => {
  const owner = crypto.randomUUID()
  const db = await openWorkoutWorkspace(owner)
  await db.workspaces.insert({ id: `${owner}-workout`, user_id: owner, payload: JSON.stringify(snapshot), alternatives: '["other version"]' })
  await assert.rejects(writeWorkoutWorkspace(db, owner, snapshot), /Resolve the workspace conflict/)
  assert.equal((await db.workspaces.findOne(`${owner}-workout`).exec())!.alternatives, '["other version"]')
  await db.close()
})

test('RxDB replication preserves conflicting offline workspace versions', { timeout: 15000 }, async () => {
  const owner = crypto.randomUUID()
  const a = await openWorkoutWorkspace(owner, `rx-test-a-${crypto.randomUUID()}`)
  const b = await openWorkoutWorkspace(owner, `rx-test-b-${crypto.randomUUID()}`)
  let master: any = null
  let revision = 0
  const streams = [new Subject<any>(), new Subject<any>()]
  const start = (db: typeof a, stream: Subject<any>) => replicateRxCollection({
    collection: db.workspaces,
    replicationIdentifier: 'test-server',
    waitForLeadership: false,
    live: true,
    retryTime: 50,
    pull: {
      stream$: stream,
      async handler(checkpoint: { revision: number } | undefined) {
        return { documents: master && revision > (checkpoint?.revision || 0) ? [structuredClone(master)] : [], checkpoint: { revision } }
      },
    },
    push: {
      async handler(rows) {
        const conflicts = []
        for (const row of rows) {
          if (master && JSON.stringify(row.assumedMasterState) !== JSON.stringify(master)) conflicts.push(structuredClone(master))
          else { master = structuredClone(row.newDocumentState); revision++ }
        }
        return conflicts
      },
    },
  })
  const ra = start(a, streams[0])
  const rb = start(b, streams[1])
  try {
    await Promise.all([ra.awaitInitialReplication(), rb.awaitInitialReplication()])
    await writeWorkoutWorkspace(a, owner, snapshot)
    await ra.awaitInSync()
    rb.reSync()
    await rb.awaitInSync()
    await Promise.all([ra.pause(), rb.pause()])
    await writeWorkoutWorkspace(a, owner, { ...snapshot, warmupItems: ['from a'] })
    await writeWorkoutWorkspace(b, owner, { ...snapshot, warmupItems: ['from b'] })
    await ra.start()
    await ra.awaitInSync()
    await rb.start()
    await rb.awaitInSync()
    const saved = await b.workspaces.findOne(`${owner}-workout`).exec(true)
    assert.equal(JSON.parse(saved.payload).warmupItems[0], 'from a')
    assert.equal(JSON.parse(JSON.parse(saved.alternatives)[0]).warmupItems[0], 'from b')
  } finally {
    await Promise.all([ra.cancel(), rb.cancel()])
    await Promise.all([a.close(), b.close()])
  }
})
