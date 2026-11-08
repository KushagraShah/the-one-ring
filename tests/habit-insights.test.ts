import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixedScore, flexibleWeek, habitStreak, monthBounds } from '../src/habits/insights'
import { indexEntries, type Entry, type Habit, type HabitData } from '../src/habits/model'

const id = '00000000-0000-4000-8000-000000000001'
const fixed: Habit = { id, title: 'Read', description: '', start: '2026-11-02', end: null, archived: false, schedules: [{ effective: '2026-11-02', kind: 'fixed', weekdays: [0, 1, 2, 3, 4, 5, 6], target: 1 }], criteria: [{ effective: '2026-11-02', done: '', partial: '', missed: '' }], pauses: [] }
const e = (date: string, outcome: Entry['outcome']): Entry => ({ habitId: id, date, outcome, note: '' })
const data = (entries: Entry[], habit = fixed): HabitData => ({ version: 1, habits: [habit], entries })

test('fixed performance and coverage distinguish missed, skip and unlogged', () => {
  assert.deepEqual(fixedScore(data([e('2026-11-02', 'done'), e('2026-11-03', 'partial'), e('2026-11-04', 'missed'), e('2026-11-05', 'skipped')]), '2026-11-02', '2026-11-06'), { done: 1, partial: 1, missed: 1, skipped: 1, due: 5, performance: 0.5, coverage: 0.8 })
  assert.equal(fixedScore(data([e('2026-11-02', 'missed')]), '2026-11-02', '2026-11-02').coverage, 1)
  assert.equal(fixedScore(data([e('2026-11-02', 'skipped')]), '2026-11-02', '2026-11-02').performance, null)
  assert.equal(fixedScore(data([], { ...fixed, archived: true }), '2026-11-02', '2026-11-02').coverage, null)
})
test('reused entry indexes produce the same fixed scores for different ranges and habits', () => {
  const other = { ...fixed, id: 'other', pauses: [{ start: '2026-11-04', end: '2026-11-05' }] }
  const records = [e('2026-11-02', 'done'), e('2026-11-03', 'skipped'), { ...e('2026-11-06', 'partial'), habitId: other.id }]
  const all: HabitData = { version: 1, habits: [fixed, other], entries: records }
  const index = indexEntries(records)
  for (const from of ['2026-11-02', '2026-11-04']) {
    assert.deepEqual(fixedScore(all, from, '2026-11-08', index), fixedScore(all, from, '2026-11-08'))
    const single = { ...all, habits: [other], entries: records.filter(entry => entry.habitId === other.id) }
    assert.deepEqual(fixedScore(single, from, '2026-11-08', index), fixedScore(single, from, '2026-11-08'))
  }
})
test('fixed streak treats partial and skip as engagement but breaks success', () => {
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done'), e('2026-11-03', 'partial'), e('2026-11-04', 'skipped'), e('2026-11-05', 'done')], '2026-11-05'), { success: 1, engagement: 4, unit: 'days' })
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done')], '2026-11-03'), { success: 1, engagement: 1, unit: 'days' })
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done')], '2026-11-04'), { success: 0, engagement: 0, unit: 'days' })
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done'), e('2026-11-03', 'missed')], '2026-11-03'), { success: 0, engagement: 0, unit: 'days' })
})
test('flexible weeks exclude pauses, skips, schedule changes, partial and future weeks', () => {
  const flex: Habit = { ...fixed, schedules: [{ ...fixed.schedules[0], kind: 'flexible', target: 2 }] }
  assert.deepEqual(flexibleWeek(flex, [e('2026-11-02', 'done'), e('2026-11-03', 'partial')], '2026-11-02', '2026-11-08'), { points: 1.5, target: 2, reason: null })
  assert.equal(flexibleWeek(flex, [e('2026-11-02', 'skipped')], '2026-11-02', '2026-11-08').reason, 'Paused or skipped')
  assert.equal(flexibleWeek({ ...flex, pauses: [{ start: '2026-11-05', end: '2026-11-05' }] }, [], '2026-11-02', '2026-11-08').reason, 'Paused or skipped')
  assert.equal(flexibleWeek({ ...flex, start: '2026-11-03' }, [], '2026-11-02', '2026-11-08').reason, 'Partial active week')
  assert.equal(flexibleWeek(flex, [], '2026-11-02', '2026-11-04').reason, 'Week in progress')
  assert.equal(flexibleWeek({ ...flex, schedules: [...flex.schedules, { ...flex.schedules[0], effective: '2026-11-04', target: 3 }] }, [], '2026-11-02', '2026-11-08').reason, 'Schedule changed')
})
test('flexible streak counts only comparable completed weeks', () => {
  const flex: Habit = { ...fixed, schedules: [{ ...fixed.schedules[0], kind: 'flexible', target: 2 }] }
  const entries = [e('2026-11-02', 'done'), e('2026-11-03', 'done'), e('2026-11-09', 'skipped'), e('2026-11-16', 'partial'), e('2026-11-17', 'done')]
  assert.deepEqual(habitStreak(flex, entries, '2026-11-23'), { success: 0, engagement: 2, unit: 'weeks' })
})
test('month bounds respect leap years and today', () => {
  assert.deepEqual(monthBounds('2024-02', '2024-03-02'), { from: '2024-02-01', to: '2024-02-29' })
  assert.deepEqual(monthBounds('2026-11', '2026-11-08'), { from: '2026-11-01', to: '2026-11-08' })
})
