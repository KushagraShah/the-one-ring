import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advanceRotations, planExercises, plannedRotation, type Rotation } from '../src/rotations'

const a = { id: 'a', name: 'Pushdown', equipment: 'Cable', sets: '' }
const b = { id: 'b', name: 'Extension', equipment: 'Cable', sets: '' }
const c = { id: 'c', name: 'Other', equipment: '', sets: '' }
const group: Rotation = { id: 'triceps', name: 'Triceps', primaryDay: 'Push', complementDay: 'Accessories', options: ['a', 'b'] }

test('primary and complement select opposite variants', () => {
  assert.equal(plannedRotation(group, 'primary'), 'a')
  assert.equal(plannedRotation(group, 'complement'), 'b')
  const after = { ...group, lastPrimaryId: 'a' }
  assert.equal(plannedRotation(after, 'primary'), 'b')
  assert.equal(plannedRotation(after, 'complement'), 'b')
})

test('actual substituted primary variant advances rotation; skipped does not', () => {
  const primary = planExercises('Push', [a], [a, b, c], [group])[0]
  const performed = { ...b, rotationGroupId: primary.rotationGroupId, rotationMode: primary.rotationMode }
  assert.equal(advanceRotations([group], [performed], [performed.name])[0].lastPrimaryId, 'b')
  assert.equal(advanceRotations([group], [performed], [])[0].lastPrimaryId, undefined)
  const unrelated = { ...c, rotationGroupId: group.id, rotationMode: 'primary' as const }
  assert.equal(advanceRotations([group], [unrelated], [unrelated.name])[0].lastPrimaryId, undefined)
})

test('complement workout does not advance primary rotation', () => {
  const exercise = planExercises('Accessories', [b], [a, b], [group])[0]
  assert.equal(advanceRotations([group], [exercise], [exercise.name])[0].lastPrimaryId, undefined)
})
