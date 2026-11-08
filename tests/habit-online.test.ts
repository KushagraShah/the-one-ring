import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { OnlineHabitStore } from '../src/habits/online'
import { emptyHabits } from '../src/habits/model'

test('habit save retries the same operation and blocks stale overwrites', async () => {
  const requests: Record<string, unknown>[] = []
  let mode = 'failure'
  const client = { rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === 'tor_online_habit_read') return { data: { revision: 0, data: null }, error: null }
    requests.push(args)
    if (mode === 'failure') return { data: null, error: new Error('offline') }
    if (mode === 'conflict') return { data: { status: 'conflict' }, error: null }
    return { data: { status: 'ok', revision: Number(args.p_revision) + 1 }, error: null }
  } } as unknown as SupabaseClient
  const store = new OnlineHabitStore(client, 'owner')
  const statuses: string[] = []; store.onStatus = status => statuses.push(status)
  const data = await store.load()
  assert.deepEqual(data, emptyHabits())
  const habit = { id: '00000000-0000-4000-8000-000000000001', title: 'Read', description: '', start: '2026-11-02', end: null, archived: false, schedules: [{ effective: '2026-11-02', kind: 'fixed' as const, weekdays: [0], target: 1 }], criteria: [{ effective: '2026-11-02', done: '', partial: '', missed: '' }], pauses: [] }
  store.update({ ...data, habits: [habit] }); await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(statuses.at(-1), 'error')
  mode = 'ok'; store.retry(); await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(statuses.at(-1), 'saved'); assert.deepEqual(requests[0], requests[1])
  mode = 'conflict'; store.update({ ...data, habits: [{ ...habit, title: 'Changed' }] }); await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(statuses.at(-1), 'conflict')
  store.update({ ...data, habits: [{ ...habit, title: 'Changed again' }] }); await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(requests.length, 3)
})

test('habit edits during a pending request are saved after its revision', async () => {
  const requests: Record<string, unknown>[] = []
  let resolveFirst!: (value: unknown) => void
  const client = { rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === 'tor_online_habit_read') return { data: { revision: 0, data: null }, error: null }
    requests.push(args)
    if (requests.length === 1) return new Promise(resolve => { resolveFirst = resolve })
    return { data: { status: 'ok', revision: Number(args.p_revision) + 1 }, error: null }
  } } as unknown as SupabaseClient
  const store = new OnlineHabitStore(client, 'owner')
  const initial = await store.load()
  const first = { ...initial, entries: [{ habitId: 'a', date: '2026-11-01', outcome: 'done' as const, note: '' }] }
  const latest = { ...first, entries: [{ ...first.entries[0], note: 'newer' }] }
  store.update(first)
  store.update(latest)
  assert.equal(requests.length, 1)
  resolveFirst({ data: { status: 'ok', revision: 1 }, error: null })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(requests.length, 2)
  assert.equal(requests[1].p_revision, 1)
  assert.deepEqual(requests[1].p_data, latest)
  assert.notEqual(requests[0].p_operation, requests[1].p_operation)
})
