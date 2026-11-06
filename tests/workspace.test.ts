import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Backup } from '../src/backup'
import { workspaceDocuments, workspaceFromRecords } from '../src/sync/workspace'
import type { StoredDocument } from '../src/sync/store'

const exerciseId = '10000000-0000-4000-8000-000000000001'
const workoutId = '20000000-0000-4000-8000-000000000001'
const exercise = { id: exerciseId, name: 'Press', equipment: 'Machine', sets: '' }
const days = [{ name: 'Push', subtitle: '', exercises: [exercise] }]
const snapshot: Backup = { version: 1, data: { completed: [], workouts: [{ id: workoutId, day: 'Push', date: '2026-01-01', exercises: [] }], session: null }, warmupItems: ['Warm up'], days, library: [exercise], routines: { active: 'initial', routines: [{ id: 'initial', name: 'Main', days, completed: [] }] } }

test('workspaces are split into individual records and round-trip safely', () => {
  const documents = workspaceDocuments(snapshot)
  assert.deepEqual(documents.map(item => item.kind).sort(), ['exercise', 'routine', 'settings', 'workout'])
  const records: Record<string, StoredDocument> = Object.fromEntries(documents.map(document => [`${document.kind}/${document.id}`, { ...document, revision: 1, generation: 0, dirty: false }]))
  assert.deepEqual(workspaceFromRecords(records), { ...snapshot, data: { ...snapshot.data, skippedDays: [] } })
})

test('invalid workspace or missing IDs cannot be uploaded', () => {
  assert.throws(() => workspaceDocuments({ ...snapshot, data: { ...snapshot.data, workouts: [{ day: 'Push', date: '2026-01-01', exercises: [] }] } }))
  assert.throws(() => workspaceFromRecords({}))
})
