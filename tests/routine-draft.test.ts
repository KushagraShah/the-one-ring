import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeCycleDay, mapCycleDays, moveItem } from '../src/workout/routineDraft'

test('renaming and removing days preserves the remaining cycle progress', () => {
  const names = { Push: 'Upper', Pull: 'Pull', Legs: null }
  assert.deepEqual(mapCycleDays(['Push', 'Legs', 'Pull'], names), ['Upper', 'Pull'])
  assert.deepEqual(mapCycleDays(['Push'], names), ['Upper'])
  assert.deepEqual(mapCycleDays(['Legacy'], names), ['Legacy'])
})

test('cycle day explanations distinguish reuse, additions and removals', () => {
  assert.equal(describeCycleDay(true, false, 'Curls'), 'Will use existing Curls slot')
  assert.equal(describeCycleDay(true, false), 'Will add a new cycle slot')
  assert.equal(describeCycleDay(true, true), 'Already uses this cycle')
  assert.equal(describeCycleDay(false, true), 'Will remove this cycle slot')
  assert.equal(describeCycleDay(false, false), 'Not included')
})

test('reordering keeps slot identities without mutating the saved order', () => {
  const saved = [{ name: 'Press' }, { name: 'Cycle', rotationGroupId: 'cycle' }, { name: 'Row' }]
  const moved = moveItem(saved, 1, -1)
  assert.deepEqual(moved.map(item => item.name), ['Cycle', 'Press', 'Row'])
  assert.equal(moved[0].rotationGroupId, 'cycle')
  assert.deepEqual(saved.map(item => item.name), ['Press', 'Cycle', 'Row'])
  assert.equal(moveItem(saved, 0, -1), saved)
  assert.equal(moveItem(saved, 2, 1), saved)
})
