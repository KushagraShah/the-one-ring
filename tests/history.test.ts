import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previousFor, startingSets, type Workout } from '../src/WorkoutSession'

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
