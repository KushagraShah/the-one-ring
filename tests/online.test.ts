import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { OnlineWorkoutStore, memoryStorage, seedStorage } from '../src/workout/online'
import type { Backup } from '../src/workout/backup'

const exercise = { id: '10000000-0000-4000-8000-000000000001', name: 'Press', equipment: 'Machine', sets: '' }
const days = [{ name: 'Push', subtitle: '', exercises: [exercise] }]
const backup: Backup = { version: 1, data: { completed: [], workouts: [], session: null }, warmupItems: [], days, library: [exercise], routines: { active: 'initial', routines: [{ id: 'initial', name: 'Main', days, completed: [] }] } }
const wait = () => new Promise(resolve => setTimeout(resolve, 0))

test('memory workspaces are isolated and can be seeded without browser storage', () => {
  const first = memoryStorage(); const second = memoryStorage()
  seedStorage(first, 'a', backup)
  assert.equal(first.length, 5)
  assert.equal(second.length, 0)
  assert.deepEqual(JSON.parse(first.getItem('one-ring-user-a')!), backup.data)
})

test('network failure retains the exact operation for retry and conflict stops saves', async () => {
  const requests: Record<string, unknown>[] = []
  let mode = 'failure'
  const client = { rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === 'tor_online_workout_read') return { data: { revision: 0, documents: [] }, error: null }
    requests.push(args)
    if (mode === 'failure') return { data: null, error: new Error('offline') }
    if (mode === 'conflict') return { data: { status: 'conflict' }, error: null }
    return { data: { status: 'ok', revision: Number(args.p_revision) + 1 }, error: null }
  } } as unknown as SupabaseClient
  const store = new OnlineWorkoutStore(client, 'owner')
  const statuses: string[] = []; store.onStatus = status => statuses.push(status)
  assert.equal(await store.load(), null)
  store.update(backup); await wait()
  assert.equal(statuses.at(-1), 'error')
  mode = 'ok'; store.retry(); await wait()
  assert.equal(statuses.at(-1), 'saved')
  assert.deepEqual(requests[0], requests[1])
  mode = 'conflict'
  store.update({ ...backup, warmupItems: ['Changed'] }); await wait()
  assert.equal(statuses.at(-1), 'conflict')
  store.update({ ...backup, warmupItems: ['Changed again'] }); await wait()
  assert.equal(requests.length, 3)
})
