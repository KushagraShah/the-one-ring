import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarDayActivity, createCalendarActivityIndex, fixedScore, flexibleWeek, habitPeriodSummary, habitStreak, monthBounds } from '../src/habits/insights'
import { indexEntries, type Entry, type Habit, type HabitData } from '../src/habits/model'

const id = '00000000-0000-4000-8000-000000000001'
const fixed: Habit = { id, title: 'Read', description: '', start: '2026-11-02', end: null, archived: false, schedules: [{ effective: '2026-11-02', kind: 'fixed', weekdays: [0, 1, 2, 3, 4, 5, 6], target: 1 }], criteria: [{ effective: '2026-11-02', done: '', partial: '', missed: '' }], pauses: [] }
const e = (date: string, outcome: Entry['outcome']): Entry => ({ habitId: id, date, outcome, note: '' })
const data = (entries: Entry[], habit = fixed): HabitData => ({ version: 1, habits: [habit], entries })

test('fixed performance and coverage distinguish missed, skip and unlogged', () => {
  assert.deepEqual(fixedScore(data([e('2026-11-02', 'done'), e('2026-11-03', 'partial'), e('2026-11-04', 'missed'), e('2026-11-05', 'skipped')]), '2026-11-02', '2026-11-06'), { done: 1, partial: 1, missed: 1, skipped: 1, due: 4, performance: 0.5, coverage: 0.75 })
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
test('fixed streak treats skip as a pause and partial as engagement', () => {
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done'), e('2026-11-03', 'partial'), e('2026-11-04', 'skipped'), e('2026-11-05', 'done')], '2026-11-05'), { success: 1, engagement: 3, unit: 'days' })
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done'), e('2026-11-03', 'skipped'), e('2026-11-04', 'done')], '2026-11-04'), { success: 2, engagement: 2, unit: 'days' })
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done')], '2026-11-03'), { success: 1, engagement: 1, unit: 'days' })
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done')], '2026-11-04'), { success: 0, engagement: 0, unit: 'days' })
  assert.deepEqual(habitStreak(fixed, [e('2026-11-02', 'done'), e('2026-11-03', 'missed')], '2026-11-03'), { success: 0, engagement: 0, unit: 'days' })
})
test('streak traversal stops at the first supported week and day', () => {
  const ancient = { ...fixed, start: '0001-01-01', schedules: [{ effective: '0001-01-01', kind: 'fixed' as const, weekdays: [0, 1, 2, 3, 4, 5, 6], target: 1 }], criteria: [{ effective: '0001-01-01', done: '', partial: '', missed: '' }] }
  assert.deepEqual(habitStreak(ancient, [e('0001-01-01', 'done')], '0001-01-01'), { success: 1, engagement: 1, unit: 'days' })
  const flexible = { ...ancient, schedules: [{ ...ancient.schedules[0], kind: 'flexible' as const }] }
  assert.deepEqual(habitStreak(flexible, [], '0001-01-01'), { success: 0, engagement: 0, unit: 'weeks' })
  assert.deepEqual(habitStreak(flexible, [], '0001-01-08'), { success: 0, engagement: 0, unit: 'weeks' })
})
test('flexible compatibility summaries distinguish Skip from pauses and retain reference goals', () => {
  const flex: Habit = { ...fixed, schedules: [{ ...fixed.schedules[0], kind: 'flexible', target: 2 }] }
  assert.deepEqual(flexibleWeek(flex, [e('2026-11-02', 'done'), e('2026-11-03', 'partial')], '2026-11-02', '2026-11-09'), { points: 1.5, target: 2, reason: null })
  assert.deepEqual(flexibleWeek(flex, [e('2026-11-02', 'skipped')], '2026-11-02', '2026-11-09'), { points: 0, target: 2, reason: null })
  assert.deepEqual(flexibleWeek({ ...flex, pauses: [{ start: '2026-11-05', end: '2026-11-05' }] }, [], '2026-11-02', '2026-11-09'), { points: 0, target: 2, reason: 'Paused' })
  assert.equal(flexibleWeek({ ...flex, start: '2026-11-03' }, [], '2026-11-02', '2026-11-09').reason, 'Partial active week')
  assert.equal(flexibleWeek(flex, [], '2026-11-02', '2026-11-04').reason, 'Week in progress')
  assert.equal(flexibleWeek(flex, [], '2026-11-02', '2026-11-08').reason, 'Week in progress')
  assert.equal(flexibleWeek({ ...flex, schedules: [...flex.schedules, { ...flex.schedules[0], effective: '2026-11-04', target: 3 }] }, [], '2026-11-02', '2026-11-09').reason, 'Schedule changed')
})
test('a skip-only week breaks engagement after the latest positive completed week', () => {
  const flex: Habit = { ...fixed, schedules: [{ ...fixed.schedules[0], kind: 'flexible', target: 2 }] }
  const entries = [e('2026-11-02', 'done'), e('2026-11-03', 'done'), e('2026-11-09', 'skipped'), e('2026-11-16', 'partial'), e('2026-11-17', 'done')]
  assert.deepEqual(habitStreak(flex, entries, '2026-11-23'), { success: 0, engagement: 1, unit: 'weeks' })
})
test('month bounds respect leap years and today', () => {
  assert.deepEqual(monthBounds('2024-02', '2024-03-02'), { from: '2024-02-01', to: '2024-02-29' })
  assert.deepEqual(monthBounds('2026-11', '2026-11-08'), { from: '2026-11-01', to: '2026-11-08' })
  assert.deepEqual(monthBounds('0001-01', '2026-11-08'), { from: '0001-01-01', to: '0001-01-31' })
  assert.deepEqual(monthBounds('0099-12', '2026-11-08'), { from: '0099-12-01', to: '0099-12-31' })
  assert.deepEqual(monthBounds('0100-02', '2026-11-08'), { from: '0100-02-01', to: '0100-02-28' })
  assert.deepEqual(monthBounds('0400-02', '2026-11-08'), { from: '0400-02-01', to: '0400-02-29' })
  assert.deepEqual(monthBounds('0999-12', '2026-11-08'), { from: '0999-12-01', to: '0999-12-31' })
})

const flex: Habit = { ...fixed, schedules: [{ ...fixed.schedules[0], kind: 'flexible', target: 2 }] }

test('flexible streak counts met weeks with Skip and positive below-target engagement separately', () => {
  const records = [e('2026-11-02', 'done'), e('2026-11-03', 'done'), e('2026-11-04', 'skipped'), e('2026-11-09', 'done'), e('2026-11-10', 'done'), e('2026-11-11', 'skipped')]
  assert.deepEqual(habitStreak(flex, records, '2026-11-16'), { success: 2, engagement: 2, unit: 'weeks' })
  const below = [...records, e('2026-11-16', 'partial')]
  assert.deepEqual(habitStreak(flex, below, '2026-11-23'), { success: 0, engagement: 3, unit: 'weeks' })
  assert.deepEqual(habitStreak(flex, [...records, e('2026-11-16', 'done'), e('2026-11-17', 'done')], '2026-11-18'), { success: 2, engagement: 2, unit: 'weeks' }, 'current target reached never adds an open week')
  assert.deepEqual(habitStreak(flex, records, '2026-11-23'), { success: 0, engagement: 0, unit: 'weeks' }, 'an empty latest week breaks both')
})

test('flexible streak passes over paused and partial weeks before considering schedule boundaries', () => {
  const older = { ...flex, start: '2026-10-19', schedules: [{ ...flex.schedules[0], effective: '2026-10-19' }] }
  const records = [e('2026-10-26', 'done'), e('2026-10-27', 'done'), e('2026-11-02', 'done'), e('2026-11-03', 'done')]
  const paused = { ...older, pauses: [{ start: '2026-11-10', end: '2026-11-10' }] }
  assert.deepEqual(habitStreak(paused, records, '2026-11-16'), { success: 2, engagement: 2, unit: 'weeks' })
  const ended = { ...older, end: '2026-11-11' }
  assert.deepEqual(habitStreak(ended, records, '2026-11-23'), { success: 2, engagement: 2, unit: 'weeks' }, 'partial and entirely post-end weeks pass over')
  const partialBeforeChanged = { ...ended, schedules: [...older.schedules, { ...older.schedules[0], effective: '2026-11-10' }] }
  assert.deepEqual(habitStreak(partialBeforeChanged, records, '2026-11-16'), { success: 2, engagement: 2, unit: 'weeks' }, 'partial active primary reason takes precedence over change')
  const changedBeforePause = { ...paused, schedules: [...older.schedules, { ...older.schedules[0], effective: '2026-11-10' }] }
  assert.deepEqual(habitStreak(changedBeforePause, records, '2026-11-16'), { success: 0, engagement: 0, unit: 'weeks' }, 'schedule boundary takes precedence over pause')
})

test('flexible streak stops at fixed history and fixed streak retains inclusive active-end behavior', () => {
  const changed: Habit = { ...flex, start: '2026-10-26', schedules: [{ ...fixed.schedules[0], effective: '2026-10-26' }, { ...flex.schedules[0], effective: '2026-11-09' }] }
  const records = [e('2026-11-02', 'done'), e('2026-11-03', 'done'), e('2026-11-09', 'done'), e('2026-11-10', 'done')]
  assert.deepEqual(habitStreak(changed, records, '2026-11-16'), { success: 1, engagement: 1, unit: 'weeks' })
  assert.deepEqual(habitStreak({ ...fixed, end: '2026-11-03' }, [e('2026-11-02', 'done'), e('2026-11-03', 'done'), e('2026-11-04', 'missed')], '2026-11-05'), { success: 2, engagement: 2, unit: 'days' })
})

test('calendar independently exposes fixed scoring, flexible activity, and deduplicated notes', () => {
  const other = { ...flex, id: 'flexible' }
  const noteOnly = { ...fixed, id: 'note-only' }
  const records = [e('2026-11-04', 'done'), { ...e('2026-11-04', 'partial'), habitId: other.id, note: 'Outcome note' }]
  const workspace: HabitData = { version: 1, habits: [fixed, other, noteOnly], entries: records, unloggedNotes: [{ habitId: other.id, date: '2026-11-04', note: 'Retained duplicate' }, { habitId: noteOnly.id, date: '2026-11-04', note: 'Note only' }] }
  const index = createCalendarActivityIndex(workspace)
  const result = calendarDayActivity(workspace, '2026-11-04', index)
  assert.deepEqual(result, { fixedScore: { done: 1, partial: 0, missed: 0, skipped: 0, due: 2, performance: 1, coverage: 0.5 }, recordedOutcomes: 2, flexibleOutcomes: 1, otherRecordedOutcomes: 1, noteCount: 2, noteOnlyCount: 1 })
  assert.equal(index.notesByDate.get('2026-11-04')?.get(other.id), 'Outcome note')
  assert.deepEqual(calendarDayActivity(workspace, '2026-11-04'), result, 'reusable indices retain default selector semantics')
  assert.equal(workspace.entries.length, 2, 'note-only does not infer an outcome')
})

test('calendar retains fixed Skip, archived and now-ineligible records as other recorded activity', () => {
  const archived = { ...fixed, id: 'archived', archived: true }
  const offSchedule = { ...fixed, id: 'off', schedules: [{ ...fixed.schedules[0], weekdays: [0] }] }
  const paused = { ...fixed, id: 'paused', pauses: [{ start: '2026-11-04', end: null }] }
  const ended = { ...fixed, id: 'ended', end: '2026-11-03' }
  const records = [e('2026-11-04', 'skipped'), ...[archived, offSchedule, paused, ended].map(habit => ({ ...e('2026-11-04', 'done'), habitId: habit.id, note: 'Retained history' }))]
  const workspace: HabitData = { version: 1, habits: [fixed, archived, offSchedule, paused, ended], entries: records }
  const result = calendarDayActivity(workspace, '2026-11-04')
  assert.equal(result.fixedScore.due, 0)
  assert.equal(result.fixedScore.skipped, 1)
  assert.equal(result.recordedOutcomes, 5)
  assert.equal(result.otherRecordedOutcomes, 5)
  assert.equal(result.flexibleOutcomes, 0)
  assert.equal(result.noteCount, 4)
})

test('calendar distinguishes note-only and empty dates and preserves orphan retained notes', () => {
  const workspace: HabitData = { version: 1, habits: [flex], entries: [], unloggedNotes: [{ habitId: flex.id, date: '2026-11-04', note: 'Only a note' }, { habitId: 'orphan', date: '2026-11-05', note: 'Preserved without a habit route' }] }
  const index = createCalendarActivityIndex(workspace)
  for (const date of ['2026-11-04', '2026-11-05']) {
    const result = calendarDayActivity(workspace, date, index)
    assert.equal(result.noteCount, 1)
    assert.equal(result.noteOnlyCount, 1)
    assert.equal(result.recordedOutcomes, 0)
    assert.equal(result.otherRecordedOutcomes, 0)
  }
  assert.equal(index.habits.has('orphan'), false)
  assert.deepEqual(calendarDayActivity(workspace, '2026-11-06', index), { fixedScore: { done: 0, partial: 0, missed: 0, skipped: 0, due: 0, performance: null, coverage: null }, recordedOutcomes: 0, flexibleOutcomes: 0, otherRecordedOutcomes: 0, noteCount: 0, noteOnlyCount: 0 })
})

test('calendar uses historical fixed metrics when a habit is currently flexible', () => {
  const changed = { ...fixed, schedules: [...fixed.schedules, { ...flex.schedules[0], effective: '2026-11-09' }] }
  const workspace = data([e('2026-11-04', 'missed'), e('2026-11-10', 'done')], changed)
  const index = createCalendarActivityIndex(workspace)
  assert.equal(calendarDayActivity(workspace, '2026-11-04', index).fixedScore.missed, 1)
  assert.equal(calendarDayActivity(workspace, '2026-11-04', index).otherRecordedOutcomes, 0)
  assert.equal(calendarDayActivity(workspace, '2026-11-10', index).flexibleOutcomes, 1)
})

test('period summaries classify fixed, flexible, mixed, inactive and archived independently', () => {
  const bounds = { from: '2026-11-01', to: '2026-11-30' }
  const records = [e('2026-11-02', 'done'), e('2026-11-03', 'partial'), e('2026-11-04', 'missed')]
  const index = indexEntries(records)
  const fixedSummary = habitPeriodSummary(fixed, index, bounds, '2026-12-01')
  assert.equal(fixedSummary.kind, 'fixed')
  assert.equal(fixedSummary.fixedOutcomes, 3)
  assert.equal(fixedSummary.rankable, true)
  assert.equal(fixedSummary.fixedScore?.performance, 0.5)
  const two = habitPeriodSummary(fixed, indexEntries(records.slice(0, 2)), bounds, '2026-12-01')
  assert.equal(two.label, '2 fixed outcomes recorded')
  assert.equal(two.rankable, false)
  assert.equal(habitPeriodSummary(fixed, indexEntries([]), bounds, '2026-12-01').label, 'No fixed outcomes recorded')
  const weekly = habitPeriodSummary(flex, index, bounds, '2026-12-01')
  assert.equal(weekly.kind, 'flexible')
  assert.equal(weekly.label, 'Weekly goal')
  assert.equal(weekly.flexibleOutcomes, 3)
  assert.equal(weekly.rankable, false)
  assert.equal(weekly.fixedOutcomes, 0)
  const changed = { ...fixed, schedules: [...fixed.schedules, { ...flex.schedules[0], effective: '2026-11-09' }] }
  const mixed = habitPeriodSummary(changed, index, bounds, '2026-12-01')
  assert.equal(mixed.kind, 'mixed')
  assert.equal(mixed.label, 'Schedule changed in this period')
  assert.equal(mixed.fixedOutcomes, 3)
  assert.equal(mixed.rankable, false)
  const inactive = habitPeriodSummary({ ...fixed, start: '2026-12-01' }, index, bounds, '2026-12-01')
  assert.equal(inactive.kind, 'inactive')
  assert.equal(inactive.label, 'Not active in 2026-11')
  assert.equal(inactive.fixedScore, null)
  assert.equal(inactive.recordedOutcomes, 3, 'inactive raw retained history remains discoverable')
  const archived = habitPeriodSummary({ ...fixed, archived: true }, index, bounds, '2026-12-01')
  assert.equal(archived.kind, 'archived')
  assert.equal(archived.label, 'Archived')
  assert.equal(archived.fixedScore, null)
  assert.equal(archived.recordedOutcomes, 3)
  assert.deepEqual(archived.weeks, [])
})

test('period classification follows selected dates, version identity and active overlap', () => {
  const changed = { ...fixed, schedules: [...fixed.schedules, { ...flex.schedules[0], effective: '2026-12-01' }] }
  const index = indexEntries([])
  assert.equal(habitPeriodSummary(changed, index, { from: '2026-11-01', to: '2026-11-30' }, '2026-12-15').kind, 'fixed', 'today flexible does not redefine November')
  assert.equal(habitPeriodSummary(changed, index, { from: '2026-12-01', to: '2026-12-31' }, '2026-12-15').kind, 'flexible')
  const inside = { ...fixed, schedules: [...fixed.schedules, { ...fixed.schedules[0], effective: '2026-11-20' }] }
  assert.equal(habitPeriodSummary(inside, index, { from: '2026-11-01', to: '2026-11-30' }, '2026-11-19').kind, 'fixed')
  assert.equal(habitPeriodSummary(inside, index, { from: '2026-11-01', to: '2026-11-30' }, '2026-11-20').kind, 'mixed', 'an identical new schedule still changes the period')
  assert.equal(habitPeriodSummary({ ...inside, start: '2026-11-21' }, index, { from: '2026-11-01', to: '2026-11-30' }, '2026-12-01').kind, 'fixed', 'pre-active versions do not classify the period')
  assert.equal(habitPeriodSummary(fixed, index, { from: '2027-01-01', to: '2026-12-01' }, '2026-12-01').kind, 'inactive')
})

test('period weeks retain whole cross-month targets and results through the real asOf date', () => {
  const weekly = { ...flex, start: '2026-10-26', schedules: [{ ...flex.schedules[0], effective: '2026-10-26' }] }
  const index = indexEntries([e('2026-10-27', 'done'), e('2026-11-01', 'done'), e('2026-11-30', 'done'), e('2026-12-01', 'done')])
  const summary = habitPeriodSummary(weekly, index, { from: '2026-11-01', to: '2026-11-30' }, '2026-12-07')
  assert.equal(summary.recordedOutcomes, 2, 'period activity includes November only')
  assert.equal(summary.weeks.length, 6)
  assert.deepEqual([summary.weeks[0].monday, summary.weeks[0].sunday, summary.weeks[0].target, summary.weeks[0].points, summary.weeks[0].judgment], ['2026-10-26', '2026-11-01', 2, 2, 'met'])
  const last = summary.weeks.at(-1)!
  assert.deepEqual([last.monday, last.sunday, last.target, last.points, last.judgment], ['2026-11-30', '2026-12-06', 2, 2, 'met'])
})
