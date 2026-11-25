import { eligible, evaluateFlexibleWeek, hasFlexibleWeek, indexEntries, shiftDate, versionAt, weeklyExclusionText, weekStart, type Entry, type FlexibleWeekEvaluation, type Habit, type HabitData, type Schedule } from './model'

export type Score = { done: number; partial: number; missed: number; skipped: number; due: number; performance: number | null; coverage: number | null }

/** Fixed opportunities only: unrecorded is not a missed score. */
export function fixedScore(data: HabitData, from: string, to: string, index = indexEntries(data.entries)): Score {
  const counts = { done: 0, partial: 0, missed: 0, skipped: 0, due: 0 }
  for (let day = from; day <= to; day = shiftDate(day, 1)) {
    for (const habit of data.habits) {
      if (habit.archived || !eligible(habit, day) || versionAt(habit.schedules, day)?.kind !== 'fixed') continue
      const entry = index.byHabitDate.get(habit.id)?.get(day)
      if (entry?.outcome === 'skipped') { counts.skipped++; continue }
      counts.due++
      if (entry) counts[entry.outcome]++
    }
  }
  const scored = counts.done + counts.partial + counts.missed
  return { ...counts, performance: scored ? (counts.done + 0.5 * counts.partial) / scored : null, coverage: counts.due ? scored / counts.due : null }
}

export type FlexibleWeek = { points: number; target: number | null; reason: string | null }
export function flexibleWeek(habit: Habit, entries: Entry[], monday: string, today: string): FlexibleWeek {
  const result = evaluateFlexibleWeek(habit, indexEntries(entries).byHabitDate.get(habit.id) || new Map(), monday, today)
  const reason = result.primaryExclusion ? weeklyExclusionText[result.primaryExclusion] : result.phase === 'future' ? 'Future week' : result.phase === 'in-progress' ? 'Week in progress' : null
  return { points: result.points, target: result.target, reason }
}

/** Current streaks only; do not infer across changes of schedule type. */
export function habitStreak(habit: Habit, entries: Entry[], today: string): { success: number; engagement: number; unit: 'days' | 'weeks' } {
  const schedule = versionAt(habit.schedules, today)
  const habitEntries = entries.filter(entry => entry.habitId === habit.id)
  const records = new Map(habitEntries.map(entry => [entry.date, entry]))
  let success = 0; let engagement = 0; let successOpen = true; let engagementOpen = true
  if (schedule?.kind === 'flexible') {
    for (let monday = shiftDate(weekStart(today), -7), limit = 0; shiftDate(monday, 6) >= habit.start && limit < 5200; monday = shiftDate(monday, -7), limit++) {
      const result = evaluateFlexibleWeek(habit, records, monday, today)
      if (result.streakDisposition === 'pass-over') continue
      if (result.streakDisposition === 'stop') break
      if (successOpen && result.judgment === 'met') success++; else successOpen = false
      if (engagementOpen && result.points > 0) engagement++; else engagementOpen = false
      if (!successOpen && !engagementOpen) break
    }
    return { success, engagement, unit: 'weeks' }
  }
  for (let day = today, limit = 0; day >= habit.start && limit < 36600; day = shiftDate(day, -1), limit++) {
    if (habit.end && day > habit.end) continue
    if (versionAt(habit.schedules, day)?.kind !== 'fixed') break
    if (!eligible(habit, day)) continue
    const outcome = records.get(day)?.outcome
    if (outcome === 'skipped') continue // An intentional skip is a one-day pause.
    if (day === today && !outcome) continue // Today is still in progress, not a missed opportunity.
    if (successOpen && outcome === 'done') success++; else successOpen = false
    if (engagementOpen && (outcome === 'done' || outcome === 'partial')) engagement++; else engagementOpen = false
    if (!successOpen && !engagementOpen) break
  }
  return { success, engagement, unit: 'days' }
}

type EntryIndex = ReturnType<typeof indexEntries>
export type CalendarActivityIndex = {
  entries: EntryIndex
  habits: ReadonlyMap<string, Habit>
  notesByDate: ReadonlyMap<string, ReadonlyMap<string, string>>
}
export type CalendarDayActivity = {
  fixedScore: Score
  recordedOutcomes: number
  flexibleOutcomes: number
  otherRecordedOutcomes: number
  noteCount: number
  noteOnlyCount: number
}

/** Build once per data change; retained notes never create outcome records. */
export function createCalendarActivityIndex(data: HabitData, entries = indexEntries(data.entries)): CalendarActivityIndex {
  const notesByDate = new Map<string, Map<string, string>>()
  // Entry notes take precedence when an older client retained a second note copy.
  for (const record of [...data.entries, ...(data.unloggedNotes || [])]) {
    if (!record.note.trim()) continue
    const notes = notesByDate.get(record.date) || new Map<string, string>()
    if (!notes.has(record.habitId)) notes.set(record.habitId, record.note)
    notesByDate.set(record.date, notes)
  }
  return { entries, habits: new Map(data.habits.map(habit => [habit.id, habit])), notesByDate }
}

/** Calendar records raw history independently of eligible metric denominators. */
export function calendarDayActivity(data: HabitData, date: string, index = createCalendarActivityIndex(data)): CalendarDayActivity {
  const records = index.entries.byDate.get(date) || []
  let flexibleOutcomes = 0
  let fixedScoredOutcomes = 0
  for (const entry of records) {
    const habit = index.habits.get(entry.habitId)
    if (!habit || habit.archived || !eligible(habit, date)) continue
    const kind = versionAt(habit.schedules, date)?.kind
    if (kind === 'flexible') flexibleOutcomes++
    if (kind === 'fixed' && entry.outcome !== 'skipped') fixedScoredOutcomes++
  }
  const notes = index.notesByDate.get(date)
  const noteOnlyCount = notes ? [...notes.keys()].filter(habitId => !index.entries.byHabitDate.get(habitId)?.has(date)).length : 0
  return { fixedScore: fixedScore(data, date, date, index.entries), recordedOutcomes: records.length, flexibleOutcomes, otherRecordedOutcomes: records.length - fixedScoredOutcomes, noteCount: notes?.size || 0, noteOnlyCount }
}

export type HabitPeriodSummary = {
  kind: 'fixed' | 'flexible' | 'mixed' | 'inactive' | 'archived'
  label: string
  fixedScore: Score | null
  fixedOutcomes: number
  rankable: boolean
  recordedOutcomes: number
  flexibleOutcomes: number
  /** Whole dated weeks touching the period, evaluated through asOf, never prorated. */
  weeks: FlexibleWeekEvaluation[]
}

/** Classify historical schedules in the active overlap, independent of today's type. */
export function habitPeriodSummary(habit: Habit, index: EntryIndex, bounds: { from: string; to: string }, asOf: string): HabitPeriodSummary {
  const to = bounds.to < asOf ? bounds.to : asOf
  const records = (index.byHabit.get(habit.id) || []).filter(entry => entry.date >= bounds.from && entry.date <= to)
  const summary: HabitPeriodSummary = { kind: 'inactive', label: `Not active in ${bounds.from.slice(0, 7)}`, fixedScore: null, fixedOutcomes: 0, rankable: false, recordedOutcomes: records.length, flexibleOutcomes: 0, weeks: [] }
  if (habit.archived) return { ...summary, kind: 'archived', label: 'Archived' }
  const from = bounds.from > habit.start ? bounds.from : habit.start
  const activeTo = habit.end && habit.end < to ? habit.end : to
  if (from > activeTo) return summary

  const schedules = new Set<Schedule | undefined>()
  for (let day = from; day <= activeTo; day = shiftDate(day, 1)) schedules.add(versionAt(habit.schedules, day))
  const schedule = schedules.size === 1 ? [...schedules][0] : undefined
  summary.kind = schedule ? schedule.kind : 'mixed'
  summary.fixedScore = fixedScore({ version: 1, habits: [habit], entries: [] }, bounds.from, to, index)
  summary.fixedOutcomes = summary.fixedScore.done + summary.fixedScore.partial + summary.fixedScore.missed
  summary.rankable = summary.kind === 'fixed' && summary.fixedOutcomes >= 3
  summary.flexibleOutcomes = records.filter(entry => eligible(habit, entry.date) && versionAt(habit.schedules, entry.date)?.kind === 'flexible').length
  summary.label = summary.kind === 'mixed' ? 'Schedule changed in this period'
    : summary.kind === 'flexible' ? 'Weekly goal'
      : summary.fixedOutcomes ? `${summary.fixedOutcomes} fixed outcome${summary.fixedOutcomes === 1 ? '' : 's'} recorded` : 'No fixed outcomes recorded'
  const entries = index.byHabitDate.get(habit.id) || new Map<string, Entry>()
  for (let monday = weekStart(from); monday <= activeTo; monday = shiftDate(monday, 7)) {
    if (hasFlexibleWeek(habit, monday, to)) summary.weeks.push(evaluateFlexibleWeek(habit, entries, monday, asOf))
  }
  return summary
}

export function monthBounds(month: string, today: string): { from: string; to: string } {
  const from = `${month}-01`
  const [year, m] = month.split('-').map(Number)
  const next = `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
  return { from, to: [shiftDate(next, -1), today].sort()[0] }
}

export function percent(value: number | null): string { return value === null ? '—' : `${Math.round(value * 100)}%` }
