import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBackup } from '../src/workout/backup'

const valid = { version: 1, data: { completed: [], workouts: [], session: null }, warmupItems: [], days: [{ name: 'Push', subtitle: '', exercises: [] }], library: [] }

test('valid older backup is accepted', () => { assert.deepEqual(parseBackup(JSON.stringify(valid)), valid) })
test('invalid nested workout data is rejected', () => { assert.throws(() => parseBackup(JSON.stringify({ ...valid, data: { ...valid.data, workouts: [{ day: 'Push', date: 'bad', exercises: [] }] } }))) })
test('invalid exercise links are rejected', () => { assert.throws(() => parseBackup(JSON.stringify({ ...valid, library: [{ name: 'Press', equipment: '', sets: '', video: 'javascript:alert(1)' }] }))) })
test('library tags and archived state survive backup and validate their types', () => {
  const backup = { ...valid, library: [{ name: 'Press', equipment: 'Machine', sets: '', tags: ['Chest', 'Machine'], archived: true }] }
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup)
  assert.throws(() => parseBackup(JSON.stringify({ ...valid, library: [{ name: 'Press', equipment: '', sets: '', tags: [3] }] })))
  assert.throws(() => parseBackup(JSON.stringify({ ...valid, library: [{ name: 'Press', equipment: '', sets: '', archived: 'yes' }] })))
})
test('malformed JSON is rejected', () => { assert.throws(() => parseBackup('{')) })
test('backups accept a multi-option rotation while rejecting duplicate variants', () => {
  const group = { id: 'r', name: 'Curls', primaryDay: 'Pull', complementDay: 'Accessories', options: ['a', 'b', 'c'] }
  const backup = { ...valid, routines: { active: 'routine', routines: [{ id: 'routine', name: 'Routine', days: valid.days, completed: [], rotations: [group] }] } }
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup)
  assert.throws(() => parseBackup(JSON.stringify({ ...backup, routines: { ...backup.routines, routines: [{ ...backup.routines.routines[0], rotations: [{ ...group, options: ['a', 'a'] }] }] } })))
})

test('shared cycle progress round trips and rejects invalid remaining variants', () => {
  const group = { id: 'r', name: 'Curls', primaryDay: 'Pull', complementDay: '', days: ['Pull'], options: ['a', 'b', 'c'], remainingIds: ['b'] }
  const backup = { ...valid, routines: { active: 'routine', routines: [{ id: 'routine', name: 'Routine', days: valid.days, completed: [], rotations: [group] }] } }
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup)
  assert.throws(() => parseBackup(JSON.stringify({ ...backup, routines: { ...backup.routines, routines: [{ ...backup.routines.routines[0], rotations: [{ ...group, remainingIds: ['missing'] }] }] } })))
})
