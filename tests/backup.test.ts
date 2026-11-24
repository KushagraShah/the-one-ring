import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBackup } from '../src/workout/backup'
import { prepareRestore } from '../src/workout/restore'
import { parseHabits } from '../src/habits/model'
import { emptyRecipes, parseRecipeData } from '../src/recipes/model'
import { WORKSPACE_LIMIT, utf8Bytes } from '../src/backupLimits'

const valid = { version: 1, data: { completed: [], workouts: [], session: null }, warmupItems: [], days: [{ name: 'Push', subtitle: '', exercises: [] }], library: [] }

test('all workspace parsers enforce the same UTF-8 byte boundary', () => {
  for (const [data, parse] of [[valid, parseBackup], [{ version: 1, habits: [], entries: [] }, parseHabits], [emptyRecipes(), parseRecipeData]] as const) {
    const base = JSON.stringify(data)
    const atLimit = base + ' '.repeat(WORKSPACE_LIMIT - utf8Bytes(base))
    assert.doesNotThrow(() => parse(atLimit))
    assert.throws(() => parse(atLimit + ' '), /too large/i)
  }
  assert.equal(utf8Bytes('é'), 2)
  const compact = JSON.stringify({ version: 1, habits: [], entries: [], note: 'é'.repeat(5_000_000) })
  const wrapped = JSON.stringify({ scope: 'habits', format: 1, data: JSON.parse(compact) }, null, 2)
  assert.ok(utf8Bytes(wrapped) > 10_000_000)
  assert.equal(parseHabits(JSON.stringify(JSON.parse(wrapped).data)).version, 1)
})

test('valid Unicode workspace contents round-trip through individual and full backup envelopes at the byte limit', () => {
  const habit = { id: '00000000-0000-4000-8000-000000000001', title: 'Read', description: '', start: '2026-01-01', end: null, archived: false, schedules: [{ effective: '2026-01-01', kind: 'fixed', weekdays: [0], target: 1 }], criteria: [{ effective: '2026-01-01', done: '', partial: '', missed: '' }], pauses: [] }
  const fixtures = [
    { scope: 'workouts', make: (text: string) => ({ ...valid, warmupItems: [text] }), parse: parseBackup },
    { scope: 'habits', make: (text: string) => ({ version: 1, habits: [{ ...habit, description: text }], entries: [] }), parse: parseHabits },
    { scope: 'recipes', make: (text: string) => ({ ...emptyRecipes(), recipes: [{ id: '00000000-0000-4000-8000-000000000002', markdown: `# Food\n\n${text}` }] }), parse: parseRecipeData },
  ]
  for (const fixture of fixtures) {
    const overhead = utf8Bytes(JSON.stringify(fixture.make('')))
    const remaining = WORKSPACE_LIMIT - overhead
    const text = 'é'.repeat(Math.floor(remaining / 2)) + 'x'.repeat(remaining % 2)
    const serialized = JSON.stringify(fixture.make(text))
    assert.equal(utf8Bytes(serialized), WORKSPACE_LIMIT)
    const data = JSON.parse(serialized)
    const individual = fixture.scope === 'workouts' ? { ...data, scope: 'workouts', exportedAt: '2026-01-01T00:00:00.000Z' } : { scope: fixture.scope, format: 1, data }
    const individualRead = JSON.parse(JSON.stringify(individual))
    if (fixture.scope === 'workouts') { delete individualRead.scope; delete individualRead.exportedAt }
    assert.doesNotThrow(() => fixture.parse(JSON.stringify(fixture.scope === 'workouts' ? individualRead : individualRead.data)))
    const fullRead = JSON.parse(JSON.stringify({ scope: 'full', format: 2, [fixture.scope]: data }))
    assert.doesNotThrow(() => fixture.parse(JSON.stringify(fullRead[fixture.scope])))
    assert.throws(() => fixture.parse(JSON.stringify(fixture.make(text + 'é'))), /too large/i)
  }
})

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
test('history snapshots survive validation and malformed plans are rejected', () => {
  const workout = { day: 'Push', date: '2026-01-01', startedAt: '2026-01-01T10:00:00Z', routineName: 'Main', plan: [{ slotId: 'slot', name: 'Press', equipment: 'Machine' }], exercises: [{ name: 'Other', source: 'substitution', sessionSlotId: 'slot', equipmentSnapshot: 'Cable', skipped: false, sets: [] }] }
  const data = { ...valid, data: { ...valid.data, workouts: [workout] } }
  assert.deepEqual(parseBackup(JSON.stringify(data)), data)
  assert.throws(() => parseBackup(JSON.stringify({ ...data, data: { ...data.data, workouts: [{ ...workout, plan: [{ name: 'bad' }] }] } })))
})
test('identity corrections round trip and invalid original identity is rejected', () => {
  const workout = { day: 'Push', date: '2026-01-01', exercises: [{ name: 'Press B', exerciseId: 'b', equipmentSnapshot: 'Machine B', correctedFrom: { name: 'Press A', exerciseId: 'a', equipment: 'Machine A' }, skipped: false, sets: [] }] }
  const backup = { ...valid, data: { ...valid.data, workouts: [workout] } }
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup)
  assert.throws(() => parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, workouts: [{ ...workout, exercises: [{ ...workout.exercises[0], correctedFrom: { name: 4 } }] }] } })))
})
test('restore prepares legacy records and rejects duplicate or invalid online IDs', () => {
  const legacy = { ...valid, library: [{ name: 'Press', equipment: '', sets: '' }] }
  const prepared = prepareRestore(parseBackup(JSON.stringify(legacy)), valid.days)
  assert.match(prepared.library![0].id!, /^[0-9a-f-]{36}$/)
  assert.equal(prepared.routines!.active, 'initial')
  const invalid = { ...legacy, library: [{ ...legacy.library[0], id: 'invalid' }] }
  assert.throws(() => prepareRestore(parseBackup(JSON.stringify(invalid)), valid.days))
  const duplicate = { ...legacy, library: [prepared.library![0], prepared.library![0]] }
  assert.throws(() => prepareRestore(parseBackup(JSON.stringify(duplicate)), valid.days))
})
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
