import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catchUpDays, eligible, evaluateFlexibleWeek, flexibleWeekText, hasFlexibleWeek, indexEntries, outcomeLabel, parseHabits, shiftDate, versionAt, weekProgress, type Entry, type Habit, type HabitData, type WeeklyExclusion } from '../src/habits/model'

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
test('compatibility progress retains the weekly target and only observed exclusions affect it', () => {
  const entries = [{ habitId: habit.id, date: '2026-11-02', outcome: 'partial' as const, note: '' }]
  assert.deepEqual(weekProgress({ ...habit, pauses: [] }, entries, '2026-11-02'), { points: 0.5, target: 4, targetSoFar: 1, affected: false })
  assert.equal(weekProgress(habit, entries, '2026-11-03').affected, false)
  assert.equal(weekProgress(habit, entries, '2026-11-05').affected, true)
  assert.equal(weekProgress({ ...habit, pauses: [] }, [...entries, { habitId: habit.id, date: '2026-11-03', outcome: 'skipped' as const, note: '' }], '2026-11-03').affected, false)
})
test('flexible progress is through the selected date and excludes ineligible or fixed records', () => {
  const flex = { ...habit, pauses: [] }
  const entries = [{ habitId: habit.id, date: '2026-11-02', outcome: 'partial' as const, note: '' }, { habitId: habit.id, date: '2026-11-05', outcome: 'done' as const, note: '' }]
  assert.equal(weekProgress(flex, entries, '2026-11-02').points, 0.5)
  assert.equal(weekProgress(flex, [...entries, { habitId: flex.id, date: '2026-11-05', outcome: 'skipped' as const, note: '' }], '2026-11-02').affected, false)
  assert.equal(weekProgress(flex, entries, '2026-11-05').points, 1.5)
  const pausedLater = { ...flex, pauses: [{ start: '2026-11-05', end: '2026-11-05' }] }
  assert.equal(weekProgress(pausedLater, entries, '2026-11-02').affected, false)
  assert.equal(weekProgress(pausedLater, entries, '2026-11-05').affected, true)
  assert.equal(weekProgress(pausedLater, entries, '2026-11-05').points, 0.5)
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

const allDays = [0, 1, 2, 3, 4, 5, 6]
const flexible = (overrides: Partial<Habit> = {}): Habit => ({ ...habit, pauses: [], schedules: [{ effective: habit.start, kind: 'flexible', weekdays: allDays, target: 1 }], ...overrides })
const record = (date: string, outcome: Entry['outcome']): Entry => ({ habitId: habit.id, date, outcome, note: '' })
const evaluate = (h: Habit, entries: Entry[] = [], asOf = '2026-11-09', monday = '2026-11-02') => evaluateFlexibleWeek(h, indexEntries(entries).byHabitDate.get(h.id) || new Map(), monday, asOf)

test('completed flexible goals use exact points and Skip never excludes or reduces the target', () => {
  const cases: { name: string; outcomes: Entry['outcome'][]; target: number; points: number; met: boolean }[] = [
    { name: 'empty', outcomes: [], target: 1, points: 0, met: false },
    { name: 'done', outcomes: ['done'], target: 1, points: 1, met: true },
    { name: 'two partial', outcomes: ['partial', 'partial'], target: 1, points: 1, met: true },
    { name: 'one partial', outcomes: ['partial'], target: 1, points: 0.5, met: false },
    { name: 'missed', outcomes: ['missed'], target: 1, points: 0, met: false },
    { name: 'skip only', outcomes: ['skipped'], target: 1, points: 0, met: false },
    { name: 'below target two', outcomes: ['done', 'partial'], target: 2, points: 1.5, met: false },
    { name: 'at target two', outcomes: ['done', 'done'], target: 2, points: 2, met: true },
    { name: 'uncapped activity', outcomes: ['done', 'done', 'partial'], target: 2, points: 2.5, met: true },
    { name: 'met with skip', outcomes: ['skipped', 'done'], target: 1, points: 1, met: true },
  ]
  for (const scenario of cases) {
    const h = flexible({ schedules: [{ ...flexible().schedules[0], target: scenario.target }] })
    const entries = scenario.outcomes.map((outcome, i) => record(shiftDate(h.start, i), outcome))
    const result = evaluate(h, entries)
    assert.equal(result.phase, 'completed', scenario.name)
    assert.equal(result.points, scenario.points, scenario.name)
    assert.equal(result.target, scenario.target, scenario.name)
    assert.equal(result.judgment, scenario.met ? 'met' : 'not-met', scenario.name)
    assert.equal(result.primaryExclusion, null, scenario.name)
    assert.equal(result.skippedDaysThrough, scenario.outcomes.filter(outcome => outcome === 'skipped').length, scenario.name)
    assert.equal(result.streakDisposition, scenario.points ? 'count' : 'stop', scenario.name)
  }
})

test('weekend Skip leaves a full goal whether the other opportunity is done, empty or skipped', () => {
  const h = flexible({ schedules: [{ ...flexible().schedules[0], weekdays: [5, 6] }] })
  for (const outcome of ['done', 'skipped', null] as const) {
    const entries = [record('2026-11-07', 'skipped'), ...(outcome ? [record('2026-11-08', outcome)] : [])]
    const result = evaluate(h, entries)
    assert.equal(result.target, 1)
    assert.equal(result.eligibleDaysThrough, 2)
    assert.equal(result.primaryExclusion, null)
    assert.equal(result.judgment, outcome === 'done' ? 'met' : 'not-met')
  }
})

test('weekly phase is pending through Sunday and never reads a future record', () => {
  const h = flexible()
  const entries = [record('2026-11-02', 'partial'), record('2026-11-04', 'partial'), record('2026-11-08', 'done')]
  for (const [asOf, through, points, phase, judgment] of [
    ['2026-11-01', null, 0, 'future', 'pending'],
    ['2026-11-02', '2026-11-02', 0.5, 'in-progress', 'pending'],
    ['2026-11-04', '2026-11-04', 1, 'in-progress', 'pending'],
    ['2026-11-08', '2026-11-08', 2, 'in-progress', 'pending'],
    ['2026-11-09', '2026-11-08', 2, 'completed', 'met'],
  ] as const) {
    const result = evaluate(h, entries, asOf)
    assert.deepEqual([result.through, result.points, result.phase, result.judgment], [through, points, phase, judgment])
    if (phase === 'future') assert.deepEqual([result.target, result.eligibleDaysThrough, result.skippedDaysThrough], [null, 0, 0])
  }
  assert.equal(flexibleWeekText(evaluate(h, entries, '2026-11-02')), '0.5 / 1 · In progress')
  assert.equal(flexibleWeekText(evaluate(h, entries, '2026-11-04')), '1 / 1 · Target reached so far')
  assert.equal(flexibleWeekText(evaluate(h, [], '2026-11-09')), '0 / 1 · Not met')
  assert.equal(flexibleWeekText(evaluate(h, entries)), '2 / 1 · Met')
  assert.equal(flexibleWeekText(evaluate(h, entries, '2026-11-01')), '0 points · Future week')
})

test('selected-date evaluation observes pauses, schedule and active end only as the cutoff passes them', () => {
  const base = flexible()
  const changed = { ...base, schedules: [...base.schedules, { ...base.schedules[0], effective: '2026-11-06', target: 2 }] }
  const pausedLater = { ...base, pauses: [{ start: '2026-11-06', end: '2026-11-06' }] }
  const endedLater = { ...base, end: '2026-11-06' }
  for (const h of [changed, pausedLater, endedLater]) {
    const result = evaluate(h, [], '2026-11-04')
    assert.equal(result.target, 1)
    assert.equal(result.primaryExclusion, null)
    assert.equal(result.judgment, 'pending')
  }
  assert.equal(evaluate(changed, [], '2026-11-06').primaryExclusion, 'schedule-changed')
  assert.equal(evaluate(changed, [], '2026-11-06').target, null)
  assert.equal(evaluate(pausedLater, [], '2026-11-06').primaryExclusion, 'paused')
  assert.equal(evaluate(pausedLater, [], '2026-11-06').target, 1)
  assert.equal(evaluate(endedLater, [], '2026-11-06').primaryExclusion, null)
  assert.equal(evaluate(endedLater, [], '2026-11-07').primaryExclusion, 'partial-active')
})

test('active ranges, schedule identity and pauses preserve the explicit exclusion precedence', () => {
  const base = flexible()
  const change = { ...base.schedules[0], effective: '2026-11-04' }
  const cases: { name: string; habit: Habit; exclusion: WeeklyExclusion | null; target: number | null; disposition: string }[] = [
    { name: 'full active', habit: base, exclusion: null, target: 1, disposition: 'stop' },
    { name: 'Tuesday start and missing pre-start schedule', habit: flexible({ start: '2026-11-03', schedules: [{ ...base.schedules[0], effective: '2026-11-03' }] }), exclusion: 'partial-active', target: 1, disposition: 'pass-over' },
    { name: 'Sunday inclusive end', habit: { ...base, end: '2026-11-08' }, exclusion: null, target: 1, disposition: 'stop' },
    { name: 'Saturday end', habit: { ...base, end: '2026-11-07' }, exclusion: 'partial-active', target: 1, disposition: 'pass-over' },
    { name: 'already ended', habit: { ...base, end: '2026-11-01' }, exclusion: 'partial-active', target: null, disposition: 'pass-over' },
    { name: 'identical new version', habit: { ...base, schedules: [change, ...base.schedules] }, exclusion: 'schedule-changed', target: null, disposition: 'stop' },
    { name: 'pause', habit: { ...base, pauses: [{ start: '2026-11-04', end: '2026-11-04' }] }, exclusion: 'paused', target: 1, disposition: 'pass-over' },
    { name: 'partial before changed', habit: { ...base, start: '2026-11-03', schedules: [...base.schedules, change] }, exclusion: 'partial-active', target: null, disposition: 'pass-over' },
    { name: 'changed before paused', habit: { ...base, schedules: [...base.schedules, change], pauses: [{ start: '2026-11-02', end: null }] }, exclusion: 'schedule-changed', target: null, disposition: 'stop' },
    { name: 'wholly fixed', habit: { ...base, schedules: [{ ...base.schedules[0], kind: 'fixed' }] }, exclusion: 'not-flexible', target: null, disposition: 'stop' },
  ]
  for (const scenario of cases) {
    const result = evaluate(scenario.habit)
    assert.equal(result.primaryExclusion, scenario.exclusion, scenario.name)
    assert.equal(result.target, scenario.target, scenario.name)
    assert.equal(result.streakDisposition, scenario.disposition, scenario.name)
    assert.equal(result.judgment, scenario.exclusion ? 'not-judged' : 'not-met', scenario.name)
  }
  const weekend = { ...base, schedules: [{ ...base.schedules[0], weekdays: [5, 6] }], pauses: [{ start: '2026-11-04', end: '2026-11-04' }] }
  assert.equal(evaluate(weekend).primaryExclusion, 'paused', 'a pause on a non-opportunity still excludes judgment')
  assert.equal(flexibleWeekText(evaluate(weekend)), '0 / 1 · Not judged · Paused')
  const mondayChange = { ...base, start: '2026-10-26', schedules: [{ ...base.schedules[0], effective: '2026-10-26' }, base.schedules[0]] }
  assert.equal(evaluate(mondayChange).primaryExclusion, null, 'a new Monday version can govern a full week')
})

test('flexible and fixed transitions retain flexible activity and become visible only when observed', () => {
  const base = flexible()
  for (const [before, after] of [['fixed', 'flexible'], ['flexible', 'fixed']] as const) {
    const h = { ...base, schedules: [{ ...base.schedules[0], kind: before }, { ...base.schedules[0], effective: '2026-11-04', kind: after }] }
    const entries = [record('2026-11-02', 'done'), record('2026-11-04', 'partial')]
    const result = evaluate(h, entries)
    assert.equal(result.primaryExclusion, 'schedule-changed')
    assert.equal(result.target, null)
    assert.equal(result.points, before === 'flexible' ? 1 : 0.5)
    assert.equal(hasFlexibleWeek(h, '2026-11-02', '2026-11-03'), before === 'flexible')
    assert.equal(hasFlexibleWeek(h, '2026-11-02', '2026-11-04'), true)
  }
  const lateStart = flexible({ start: '2026-11-05', pauses: [{ start: '2026-11-05', end: null }] })
  assert.equal(hasFlexibleWeek(lateStart, '2026-11-02', '2026-11-04'), false)
  assert.equal(hasFlexibleWeek(lateStart, '2026-11-02', '2026-11-05'), true, 'pause does not hide an active flexible schedule')
  assert.equal(hasFlexibleWeek(flexible({ end: '2026-11-01' }), '2026-11-02', '2026-11-09'), false)
})

test('weekly facts reject foreign, off-schedule, paused, inactive and later records without rewriting history', () => {
  const h = flexible({ start: '2026-11-03', end: '2026-11-06', schedules: [{ ...flexible().schedules[0], weekdays: [1, 2, 3, 4] }], pauses: [{ start: '2026-11-04', end: '2026-11-04' }] })
  const entries = [record('2026-11-02', 'done'), record('2026-11-03', 'partial'), record('2026-11-04', 'done'), record('2026-11-05', 'done'), record('2026-11-06', 'done'), record('2026-11-07', 'done')]
  const data: HabitData = { version: 1, habits: [h], entries, unloggedNotes: [{ habitId: h.id, date: '2026-11-03', note: 'Duplicate note only' }, { habitId: h.id, date: '2026-11-06', note: 'No extra points' }] }
  const before = JSON.stringify(data)
  assert.equal(evaluate(h, entries, '2026-11-05').points, 1.5)
  const accidentallySharedIndex = new Map(entries.map(entry => [entry.date, entry]))
  accidentallySharedIndex.set('2026-11-03', { ...record('2026-11-03', 'done'), habitId: 'other-habit' })
  assert.equal(evaluateFlexibleWeek(h, accidentallySharedIndex, '2026-11-02', '2026-11-05').points, 1)
  assert.equal(JSON.stringify(data), before)
  assert.deepEqual(parseHabits(before), data)
  assert.equal(evaluate(flexible(), []).points, 0, 'a note-only date never supplies an outcome')
})

test('weekly ranges normalize locally across years and leap days', () => {
  for (const [monday, sunday, cutoff] of [
    ['2026-12-28', '2027-01-03', '2027-01-04'],
    ['2024-02-26', '2024-03-03', '2024-03-04'],
  ]) {
    const h = flexible({ start: monday, schedules: [{ ...flexible().schedules[0], effective: monday }] })
    const result = evaluate(h, [], cutoff, shiftDate(monday, 2))
    assert.equal(result.monday, monday)
    assert.equal(result.sunday, sunday)
    assert.equal(result.eligibleDaysThrough, 7)
    assert.equal(result.phase, 'completed')
  }
})

test('off-schedule and fixed records never add flexible points while observed weekday changes exclude judgment', () => {
  const base = flexible()
  const weekends = { ...base, schedules: [{ ...base.schedules[0], weekdays: [5, 6] }] }
  const records = [record('2026-11-02', 'done'), record('2026-11-07', 'partial'), record('2026-11-08', 'done'), record('2026-11-09', 'done')]
  assert.equal(evaluate(weekends, records).points, 1.5, 'off-schedule Monday and next week never add points')
  const changed = { ...weekends, schedules: [...weekends.schedules, { ...weekends.schedules[0], effective: '2026-11-05', weekdays: [4, 5, 6] }] }
  assert.equal(evaluate(changed, records).primaryExclusion, 'schedule-changed')
  assert.equal(evaluate(changed, records).target, null)
  const fixed = { ...base, schedules: [{ ...base.schedules[0], kind: 'fixed' as const }] }
  assert.equal(evaluate(fixed, records).points, 0)
})

test('catch up keeps exactly the preceding seven fixed opportunities with note-only gaps and historical rules', () => {
  const fixed: Habit = { ...flexible(), schedules: [{ ...flexible().schedules[0], kind: 'fixed' }] }
  const workspace: HabitData = { version: 1, habits: [fixed], entries: [record('2026-11-10', 'skipped')], unloggedNotes: [{ habitId: fixed.id, date: '2026-11-11', note: 'Still unlogged' }] }
  assert.deepEqual(catchUpDays(workspace, '2026-11-16'), ['2026-11-15', '2026-11-14', '2026-11-13', '2026-11-12', '2026-11-11', '2026-11-09'].map(date => ({ date, count: 1 })))
  const historical: Habit = { ...fixed, end: '2026-11-14', pauses: [{ start: '2026-11-12', end: '2026-11-13' }], schedules: [...fixed.schedules, { ...flexible().schedules[0], effective: '2026-11-14' }] }
  assert.deepEqual(catchUpDays({ ...workspace, habits: [historical] }, '2026-11-16'), [{ date: '2026-11-11', count: 1 }, { date: '2026-11-09', count: 1 }])
  assert.deepEqual(catchUpDays({ ...workspace, habits: [{ ...historical, archived: true }] }, '2026-11-16'), [])
})
