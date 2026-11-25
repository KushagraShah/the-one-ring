import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catchUpDays, eligible, indexEntries, outcomeLabel, parseHabits, shiftDate, versionAt, weekProgress, type Habit, type HabitData } from '../src/habits/model'

const habit: Habit = { id: '00000000-0000-4000-8000-000000000001', title: 'Read', description: '', start: '2026-11-02', end: null, archived: false, schedules: [{ effective: '2026-11-02', kind: 'flexible', weekdays: [0, 1, 2, 3, 4], target: 4 }, { effective: '2026-11-09', kind: 'fixed', weekdays: [1, 3], target: 1 }], criteria: [{ effective: '2026-11-02', done: 'Long', partial: 'Short', missed: '' }, { effective: '2026-11-09', done: 'New', partial: '', missed: '' }], pauses: [{ start: '2026-11-05', end: '2026-11-06' }] }
test('unlogged notes survive backup validation and duplicate notes are rejected', () => {
  const data: HabitData = { version: 1, habits: [habit], entries: [], unloggedNotes: [{ habitId: habit.id, date: '2026-11-04', note: 'Kept note' }] }
  assert.deepEqual(parseHabits(JSON.stringify(data)), data)
  assert.throws(() => parseHabits(JSON.stringify({ ...data, unloggedNotes: [...data.unloggedNotes!, data.unloggedNotes![0]] })))
  // An older app may add an outcome without knowing about the retained note.
  assert.doesNotThrow(() => parseHabits(JSON.stringify({ ...data, entries: [{ habitId: habit.id, date: '2026-11-04', outcome: 'done', note: '' }] })))
})
test('dates and historical schedules use local calendar days and effective versions', () => {
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
  assert.equal(eligible(habit, '2026-11-04'), true)
  assert.equal(eligible(habit, '2026-11-05'), false)
  assert.equal(eligible(habit, '2026-11-09'), false)
  assert.equal(eligible(habit, '2026-11-10'), true)
  assert.equal(versionAt(habit.criteria, '2026-11-08')?.done, 'Long')
  assert.equal(versionAt(habit.criteria, '2026-11-09')?.done, 'New')
})
test('effective versions may be unsorted and retain their original object identity', () => {
  const versions = [...habit.criteria].reverse()
  assert.equal(versionAt(versions, '2026-11-01'), undefined)
  assert.equal(versionAt(versions, '2026-11-08'), habit.criteria[0])
  assert.equal(versionAt(versions, '2026-11-10'), habit.criteria[1])
})
test('outcome labels use the selected date and fall back only when not customized', () => {
  assert.equal(outcomeLabel(habit, '2026-11-08', 'done'), 'Long')
  assert.equal(outcomeLabel(habit, '2026-11-10', 'done'), 'New')
  assert.equal(outcomeLabel(habit, '2026-11-10', 'partial'), 'Partial')
  assert.equal(outcomeLabel(habit, '2026-11-08', 'skipped'), 'Skipped')
})
test('entry indexes preserve original records and order across a large history', () => {
  const entries = Array.from({ length: 4000 }, (_, i) => ({ habitId: `habit-${i % 4}`, date: shiftDate('2020-01-01', i), outcome: 'done' as const, note: '' }))
  const index = indexEntries(entries)
  assert.deepEqual(index.byHabit.get('habit-1'), entries.filter(entry => entry.habitId === 'habit-1'))
  for (const entry of entries) {
    assert.equal(index.byHabitDate.get(entry.habitId)?.get(entry.date), entry)
    assert.deepEqual(index.byDate.get(entry.date), [entry])
  }
})
test('flexible target so far is bounded; pause and skip exclude target judgment', () => {
  const entries = [{ habitId: habit.id, date: '2026-11-02', outcome: 'partial' as const, note: '' }]
  assert.deepEqual(weekProgress({ ...habit, pauses: [] }, entries, '2026-11-02'), { points: 0.5, target: 4, targetSoFar: 1, affected: false })
  assert.equal(weekProgress(habit, entries, '2026-11-03').affected, true)
  assert.equal(weekProgress({ ...habit, pauses: [] }, [...entries, { habitId: habit.id, date: '2026-11-03', outcome: 'skipped' as const, note: '' }], '2026-11-03').affected, true)
})
test('flexible progress is through the selected date and excludes ineligible or fixed records', () => {
  const flex = { ...habit, pauses: [] }
  const entries = [{ habitId: habit.id, date: '2026-11-02', outcome: 'partial' as const, note: '' }, { habitId: habit.id, date: '2026-11-05', outcome: 'done' as const, note: '' }]
  assert.equal(weekProgress(flex, entries, '2026-11-02').points, 0.5)
  assert.equal(weekProgress(flex, entries, '2026-11-05').points, 1.5)
  assert.equal(weekProgress({ ...flex, pauses: [{ start: '2026-11-05', end: '2026-11-05' }] }, entries, '2026-11-05').points, 0.5)
})
test('catch up excludes archived and flexible habits and respects recorded outcomes', () => {
  const fixed = { ...habit, pauses: [], schedules: [{ effective: habit.start, kind: 'fixed' as const, weekdays: [0, 1, 2, 3, 4, 5, 6], target: 1 }] }
  const archived = { ...fixed, id: 'archived', archived: true }
  const data = { version: 1 as const, habits: [fixed, archived, { ...habit, id: 'flex' }], entries: [{ habitId: fixed.id, date: '2026-11-04', outcome: 'skipped' as const, note: '' }] }
  assert.deepEqual(catchUpDays(data, '2026-11-06', 3), [{ date: '2026-11-05', count: 1 }, { date: '2026-11-03', count: 1 }])
  assert.deepEqual(catchUpDays({ ...data, habits: [archived, data.habits[2]] }, '2026-11-06', 3), [])
})
test('habit backups validate and reject duplicate outcomes', () => {
  const data: HabitData = { version: 1, habits: [habit], entries: [{ habitId: habit.id, date: '2026-11-02', outcome: 'done', note: '' }] }
  assert.deepEqual(parseHabits(JSON.stringify(data)), data)
  assert.throws(() => parseHabits(JSON.stringify({ ...data, entries: [...data.entries, ...data.entries] })))
  assert.throws(() => parseHabits(JSON.stringify({ ...data, habits: [{ ...habit, schedules: [{ ...habit.schedules[0], target: 6 }] }] })))
})

test('optional habit icons round-trip without changing legacy backups', () => {
  const data: HabitData = { version: 1, habits: [{ ...habit, icon: '🏃‍♀️' }], entries: [] }
  assert.deepEqual(parseHabits(JSON.stringify(data)), data)
  assert.equal(parseHabits(JSON.stringify({ ...data, habits: [habit] })).habits[0].icon, undefined)
  assert.throws(() => parseHabits(JSON.stringify({ ...data, habits: [{ ...habit, icon: 42 }] })))
  assert.throws(() => parseHabits(JSON.stringify({ ...data, habits: [{ ...habit, icon: 'x'.repeat(33) }] })))
})
