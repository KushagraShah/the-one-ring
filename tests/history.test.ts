import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previousFor, startingSets, type Workout } from '../src/workout/WorkoutSession'
import { addSessionExercise, adjacentExercise, recentPerformances, replaceSessionExercise, sessionAccountedFor, toggleSessionSkip } from '../src/workout/sessionLogic'

const workouts: Workout[] = [{ day: 'Push', date: '2026-01-01', exercises: [{ name: 'Old name', exerciseId: 'machine-one', skipped: false, sets: [12, 10, 8].map(reps => ({ weight: '20', reps: String(reps), done: true })) }] }]

test('history follows an exercise ID across a rename', () => {
  const renamed = { id: 'machine-one', name: 'New name', equipment: '', sets: '' }
  assert.equal(previousFor(workouts, renamed)?.name, 'Old name')
  assert.deepEqual(startingSets(renamed, workouts).map(set => [set.weight, set.reps, set.done]), [['20', '12', false], ['20', '10', false], ['20', '8', false]])
})

test('different equipment does not share history merely because names match', () => {
  assert.equal(previousFor(workouts, { id: 'machine-two', name: 'Old name', equipment: '', sets: '' }), undefined)
})

test('legacy records without IDs can still be found by their old name', () => {
  const legacy = [{ ...workouts[0], exercises: workouts[0].exercises.map(({ exerciseId: _id, ...item }) => item) }]
  assert.ok(previousFor(legacy, { id: 'machine-one', name: 'Old name', equipment: '', sets: '' }))
})

test('a session is accounted for only when each exercise is completed or skipped', () => {
  const exercise = { id: 'machine-one', name: 'Press', equipment: '', sets: '' }
  const other = { name: 'Run', equipment: '', sets: '', kind: 'cardio' as const }
  const session = { day: 'Push', exercises: [exercise, other], entries: { Press: [12, 10, 8].map(reps => ({ weight: '20', reps: String(reps), done: true })) }, skipped: [] as string[], warmups: [] as string[] }
  assert.equal(sessionAccountedFor(session), false)
  assert.equal(sessionAccountedFor({ ...session, skipped: ['Run'] }), true)
  assert.equal(sessionAccountedFor({ ...session, cardio: { Run: { duration: '10', speed: '', incline: '', done: true } } }), true)
  assert.equal(sessionAccountedFor({ ...session, exercises: [] }), false)
  assert.equal(sessionAccountedFor({ ...session, entries: { Press: session.entries.Press.slice(0, 2) }, skipped: ['Run'] }), false)
})

test('recent performance keeps exact variant history and notes', () => {
  const target = { id: 'machine-one', name: 'Renamed', equipment: '', sets: '' }
  const older = { ...workouts[0], date: '2025-12-01', exercises: workouts[0].exercises.map(exercise => ({ ...exercise, note: 'Increase next time' })) }
  const results = recentPerformances([...workouts, older], target)
  assert.equal(results.length, 2)
  assert.equal(results[1].exercise.note, 'Increase next time')
  assert.equal(recentPerformances(workouts, { ...target, id: 'other-machine' }).length, 0)
})

test('replacements and extras belong to the current session and navigation only', () => {
  const original = { id: 'one', name: 'Press', equipment: '', sets: '' }
  const second = { id: 'two', name: 'Row', equipment: '', sets: '' }
  const replacement = { id: 'three', name: 'Other press', equipment: '', sets: '' }
  const extra = { id: 'four', name: 'Curls', equipment: '', sets: '' }
  const routine = [original, second]
  const session = { day: 'Push', exercises: [...routine], entries: {}, skipped: [], warmups: [] }
  const cardio = { duration: '', speed: '', incline: '', done: false }
  const swapped = replaceSessionExercise(session, original, replacement, [], cardio)
  const updated = addSessionExercise(swapped, extra, [], cardio)
  assert.deepEqual(updated.exercises.map(item => item.name), ['Other press', 'Row', 'Curls'])
  assert.equal(updated.exercises[0].plannedName, 'Press')
  assert.equal(updated.exercises[0].plannedId, 'one')
  assert.equal(adjacentExercise(updated, 'Other press', 1), 'Row')
  assert.equal(adjacentExercise(updated, 'Row', 1), 'Curls')
  assert.equal(adjacentExercise(updated, 'Curls', 1), 'Other press')
  assert.equal(adjacentExercise(updated, 'Other press', -1), 'Curls')
  assert.deepEqual(routine.map(item => item.name), ['Press', 'Row'])
  assert.deepEqual(session.exercises.map(item => item.name), ['Press', 'Row'])
})

test('skipping advances in the session and undo stays on the current exercise', () => {
  const first = { name: 'Press', equipment: '', sets: '' }
  const second = { name: 'Row', equipment: '', sets: '' }
  const session = { day: 'Push', exercises: [first, second], entries: {}, skipped: [], warmups: [] }
  const cardio = { duration: '', speed: '', incline: '', done: false }
  const skipped = toggleSessionSkip(session, first, [], cardio)
  assert.deepEqual(skipped.session.skipped, ['Press'])
  assert.equal(skipped.next, 'Row')
  const undo = toggleSessionSkip(skipped.session, first, [], cardio)
  assert.deepEqual(undo.session.skipped, [])
  assert.equal(undo.next, null)
  const last = toggleSessionSkip(session, second, [], cardio)
  assert.equal(last.next, 'Press')
  assert.equal(sessionAccountedFor(toggleSessionSkip(skipped.session, second, [], cardio).session), true)
})
