import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advanceRotations, planExercises, plannedRotation, rotationDays, type Rotation } from '../src/workout/rotations'
import { addSessionExercise, replaceSessionExercise } from '../src/workout/sessionLogic'

const a = { id: 'a', name: 'A', equipment: '', sets: '' }
const b = { id: 'b', name: 'B', equipment: '', sets: '' }
const c = { id: 'c', name: 'C', equipment: '', sets: '' }
const group: Rotation = { id: 'arms', name: 'Arms', primaryDay: 'Push', complementDay: 'Accessories', options: ['a', 'b', 'c'], days: ['Push', 'Accessories'] }

test('same cycle advances across multiple days and keeps out-of-order variants accounted for', () => {
  const onPush = planExercises('Push', [a], [a, b, c], [group])[0]
  assert.equal(onPush.id, 'a')
  const afterA = advanceRotations([group], [onPush], ['A'])[0]
  assert.equal(plannedRotation(afterA), 'b')
  const onOther = planExercises('Accessories', [b], [a, b, c], [afterA])[0]
  assert.equal(onOther.id, 'b')
  const override = { ...c, rotationGroupId: group.id, rotationMode: 'primary' as const }
  const afterC = advanceRotations([afterA], [override], ['C'])[0]
  assert.equal(plannedRotation(afterC), 'b')
  const afterB = advanceRotations([afterC], [onOther], ['B'])[0]
  assert.equal(plannedRotation(afterB), 'a')
})

test('single-day and legacy cycles use their saved state; skips and unrelated variants do not advance', () => {
  const one = { ...group, days: ['Push'], lastPrimaryId: 'a' }
  assert.equal(plannedRotation(one), 'b')
  assert.equal(planExercises('Accessories', [b], [a, b, c], [one])[0].id, 'b')
  const planned = planExercises('Push', [a], [a, b, c], [one])[0]
  assert.deepEqual(advanceRotations([one], [planned], []), [one])
  assert.deepEqual(advanceRotations([one], [{ ...planned, id: 'x' }], ['B']), [one])
})

test('repeating an accounted member leaves the pending suggestion and cycle independent', () => {
  const afterA = advanceRotations([group], [{ ...a, rotationGroupId: group.id }], ['A'])[0]
  assert.deepEqual(advanceRotations([afterA], [{ ...a, rotationGroupId: group.id }], ['A']), [afterA])
  assert.equal(plannedRotation(afterA), 'b')
  assert.deepEqual(rotationDays({ ...group, days: ['Push'] }), ['Push'])
  const legacy = { ...group, days: undefined, lastPrimaryId: 'b' }
  assert.deepEqual(rotationDays(legacy), ['Push', 'Accessories'])
  assert.equal(plannedRotation(legacy), 'c')
})

test('explicit cycle selection advances while ordinary replacement and extra do not', () => {
  const cycle = { ...group, lastPrimaryId: 'a' }
  const planned = planExercises('Push', [a], [a, b, c], [cycle])[0]
  const session = { day: 'Push', exercises: [planned], entries: {}, skipped: [], warmups: [] }
  const cardio = { duration: '', speed: '', incline: '', done: false }
  const chosen = replaceSessionExercise(session, planned, c, [], cardio, cycle)
  assert.equal(chosen.exercises[0].plannedId, 'b')
  assert.equal(chosen.exercises[0].rotationGroupId, cycle.id)
  const afterC = advanceRotations([cycle], chosen.exercises, ['C'])[0]
  assert.equal(plannedRotation(afterC), 'b')
  assert.deepEqual(advanceRotations([cycle], chosen.exercises, []), [cycle])
  const replaced = replaceSessionExercise(session, planned, c, [], cardio)
  assert.equal(replaced.exercises[0].rotationGroupId, undefined)
  assert.deepEqual(advanceRotations([cycle], replaced.exercises, ['C']), [cycle])
  const extra = addSessionExercise(session, { ...c, rotationGroupId: cycle.id }, [], cardio)
  assert.equal(extra.exercises[1].rotationGroupId, undefined)
  assert.deepEqual(advanceRotations([cycle], extra.exercises, ['C']), [cycle])
  assert.throws(() => replaceSessionExercise(session, planned, { ...c, id: 'not-in-cycle' }, [], cardio, cycle))
})
