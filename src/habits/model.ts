import { WORKSPACE_LIMIT, utf8Bytes } from '../backupLimits'

export type Outcome = 'done' | 'partial' | 'missed' | 'skipped'
export type Schedule = { effective: string; kind: 'fixed' | 'flexible'; weekdays: number[]; target: number }
export type Criteria = { effective: string; done: string; partial: string; missed: string }
export type Pause = { start: string; end: string | null }
export type Habit = { id: string; title: string; icon?: string; description: string; start: string; end: string | null; archived: boolean; schedules: Schedule[]; criteria: Criteria[]; pauses: Pause[] }
export type Entry = { habitId: string; date: string; outcome: Outcome; note: string }
export type HabitData = { version: 1; habits: Habit[]; entries: Entry[]; unloggedNotes?: { habitId: string; date: string; note: string }[] }
export const emptyHabits = (): HabitData => ({ version: 1, habits: [], entries: [] })
export const MIN_HABIT_DATE = '0001-01-01'

export function localDate(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(2000, 0, 1, 12)
  date.setFullYear(year, month - 1, day)
  return date
}
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const result = calendarDate(year, month, day + days)
  return result.getFullYear() < 1 ? MIN_HABIT_DATE : localDate(result)
}
export const validHabitDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= MIN_HABIT_DATE && shiftDate(value, 0) === value
export function weekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return (calendarDate(year, month, day).getDay() + 6) % 7
}
export function weekStart(date: string): string { return shiftDate(date, -weekday(date)) }
export function versionAt<T extends { effective: string }>(items: T[], date: string): T | undefined {
  let latest: T | undefined
  for (const item of items) if (item.effective <= date && (!latest || item.effective > latest.effective)) latest = item
  return latest
}

/** Personal labels are effective-dated; the stored outcome and scoring stay unchanged. */
export function outcomeLabel(habit: Habit, date: string, outcome: Outcome): string {
  const fallback = { done: 'Done', partial: 'Partial', missed: 'Missed', skipped: 'Skipped' }
  return outcome === 'skipped' ? fallback.skipped : versionAt(habit.criteria, date)?.[outcome]?.trim() || fallback[outcome]
}

/** Derived in-memory indexes; persisted data and its ordering stay unchanged. */
export function indexEntries(entries: Entry[]) {
  const byHabit = new Map<string, Entry[]>()
  const byDate = new Map<string, Entry[]>()
  const byHabitDate = new Map<string, Map<string, Entry>>()
  for (const entry of entries) {
    const habit = byHabit.get(entry.habitId) || []
    habit.push(entry); byHabit.set(entry.habitId, habit)
    const date = byDate.get(entry.date) || []
    date.push(entry); byDate.set(entry.date, date)
    const dates = byHabitDate.get(entry.habitId) || new Map<string, Entry>()
    dates.set(entry.date, entry); byHabitDate.set(entry.habitId, dates)
  }
  return { byHabit, byDate, byHabitDate }
}
export function paused(habit: Habit, date: string): boolean { return habit.pauses.some(pause => pause.start <= date && (!pause.end || pause.end >= date)) }
export function eligible(habit: Habit, date: string): boolean {
  const schedule = versionAt(habit.schedules, date)
  return date >= habit.start && (!habit.end || date <= habit.end) && !paused(habit, date) && Boolean(schedule?.weekdays.includes(weekday(date)))
}
export type WeeklyExclusion = 'partial-active' | 'schedule-changed' | 'not-flexible' | 'paused'
export type FlexibleWeekEvaluation = {
  monday: string
  sunday: string
  through: string | null
  phase: 'future' | 'in-progress' | 'completed'
  points: number
  target: number | null
  eligibleDaysThrough: number
  skippedDaysThrough: number
  primaryExclusion: WeeklyExclusion | null
  judgment: 'pending' | 'met' | 'not-met' | 'not-judged'
  streakDisposition: 'count' | 'pass-over' | 'stop'
}

/** Observed flexible schedule presence; pauses and weekdays do not hide a goal. */
export function hasFlexibleWeek(habit: Habit, monday: string, asOf: string): boolean {
  monday = weekStart(monday)
  for (let day = monday; day <= shiftDate(monday, 6) && day <= asOf; day = shiftDate(day, 1)) {
    if (day >= habit.start && (!habit.end || day <= habit.end) && versionAt(habit.schedules, day)?.kind === 'flexible') return true
  }
  return false
}

/** Pure local-calendar weekly facts. Skip affects one opportunity, never comparability. */
export function evaluateFlexibleWeek(habit: Habit, entriesByDate: ReadonlyMap<string, Entry>, monday: string, asOf: string): FlexibleWeekEvaluation {
  monday = weekStart(monday)
  const sunday = shiftDate(monday, 6)
  const phase = asOf < monday ? 'future' : asOf > sunday ? 'completed' : 'in-progress'
  const through = phase === 'future' ? null : asOf < sunday ? asOf : sunday
  const result: FlexibleWeekEvaluation = { monday, sunday, through, phase, points: 0, target: null, eligibleDaysThrough: 0, skippedDaysThrough: 0, primaryExclusion: null, judgment: 'pending', streakDisposition: 'stop' }
  if (through === null) return result

  const schedules = new Set<Schedule | undefined>()
  let observedPause = false
  for (let day = monday; day <= through; day = shiftDate(day, 1)) {
    if (day < habit.start || (habit.end && day > habit.end)) continue
    const schedule = versionAt(habit.schedules, day)
    schedules.add(schedule)
    if (paused(habit, day)) observedPause = true
    if (schedule?.kind !== 'flexible' || !eligible(habit, day)) continue
    result.eligibleDaysThrough++
    const entry = entriesByDate.get(day)
    if (!entry || entry.habitId !== habit.id || entry.date !== day) continue
    result.points += entry.outcome === 'done' ? 1 : entry.outcome === 'partial' ? 0.5 : 0
    if (entry.outcome === 'skipped') result.skippedDaysThrough++
  }
  const schedule = schedules.size === 1 ? [...schedules][0] : undefined
  if (schedule?.kind === 'flexible') result.target = schedule.target

  // Preserve historical streak precedence: active range, schedule boundary, then pause.
  if (habit.start > monday || (habit.end !== null && habit.end < through)) result.primaryExclusion = 'partial-active'
  else if (schedules.size > 1) result.primaryExclusion = 'schedule-changed'
  else if (schedule?.kind !== 'flexible') result.primaryExclusion = 'not-flexible'
  else if (observedPause) result.primaryExclusion = 'paused'

  if (result.primaryExclusion) {
    result.judgment = 'not-judged'
    result.streakDisposition = result.primaryExclusion === 'partial-active' || result.primaryExclusion === 'paused' ? 'pass-over' : 'stop'
  } else if (phase === 'completed' && result.target !== null) {
    result.judgment = result.points >= result.target ? 'met' : 'not-met'
    result.streakDisposition = result.points > 0 ? 'count' : 'stop'
  }
  return result
}

export const weeklyExclusionText: Readonly<Record<WeeklyExclusion, string>> = {
  'partial-active': 'Partial active week',
  'schedule-changed': 'Schedule changed',
  'not-flexible': 'Not a flexible week',
  paused: 'Paused',
}

/** Shared visible policy for Daily, Week and Insights. */
export function flexibleWeekText(result: FlexibleWeekEvaluation): string {
  const activity = result.target === null ? `${result.points} points` : `${result.points} / ${result.target}`
  const status = result.phase === 'future' ? 'Future week'
    : result.primaryExclusion ? `Not judged · ${weeklyExclusionText[result.primaryExclusion]}`
      : result.judgment === 'met' ? 'Met'
        : result.judgment === 'not-met' ? 'Not met'
          : result.target !== null && result.points >= result.target ? 'Target reached so far' : 'In progress'
  return `${activity} · ${status}`
}

/** Compatibility metadata only; targetSoFar is never a reduced weekly judgment target. */
export function weekProgress(habit: Habit, entries: Entry[], date: string) {
  const result = evaluateFlexibleWeek(habit, indexEntries(entries).byHabitDate.get(habit.id) || new Map(), weekStart(date), date)
  return { points: result.points, target: result.target ?? 0, targetSoFar: Math.min(result.target ?? 0, result.eligibleDaysThrough), affected: result.primaryExclusion !== null }
}

/** Recent unlogged fixed opportunities only; flexible eligible days are not obligations. */
export function catchUpDays(data: HabitData, today: string, days = 7) {
  const index = indexEntries(data.entries)
  return [...new Set(Array.from({ length: days }, (_, i) => shiftDate(today, -i - 1)))].filter(date => date < today).map(date => ({ date, count: data.habits.filter(habit => !habit.archived && eligible(habit, date) && versionAt(habit.schedules, date)?.kind === 'fixed' && !index.byHabitDate.get(habit.id)?.has(date)).length })).filter(day => day.count > 0)
}

const dateValid = validHabitDate
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const optionalDate = (value: unknown) => value === null || dateValid(value)
export function parseHabits(input: string): HabitData {
  if (utf8Bytes(input) > WORKSPACE_LIMIT) throw new Error('Habit backup is too large.')
  const data: unknown = JSON.parse(input)
  if (!object(data) || data.version !== 1 || !Array.isArray(data.habits) || !Array.isArray(data.entries)) throw new Error('Invalid habit data.')
  const ids = new Set<string>()
  for (const h of data.habits) {
    if (!object(h) || !isText(h.id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(h.id) || ids.has(h.id) || !isText(h.title) || !h.title.trim() || !isText(h.description) || !dateValid(h.start) || !optionalDate(h.end) || (h.end !== null && (h.end as string) < h.start) || typeof h.archived !== 'boolean' || !Array.isArray(h.schedules) || !h.schedules.length || !Array.isArray(h.criteria) || !h.criteria.length || !Array.isArray(h.pauses)) throw new Error('Invalid habit.')
    ids.add(h.id)
    if (h.icon !== undefined && (!isText(h.icon) || h.icon.length > 32)) throw new Error('Invalid habit icon.')
    const startDate = h.start
    const dates = new Set<string>()
    for (const s of h.schedules) {
      if (!object(s) || !dateValid(s.effective) || dates.has(s.effective) || !['fixed', 'flexible'].includes(String(s.kind)) || !Array.isArray(s.weekdays) || !s.weekdays.length || s.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(s.weekdays).size !== s.weekdays.length || !Number.isInteger(s.target) || (s.target as number) < 1 || (s.target as number) > s.weekdays.length) throw new Error('Invalid habit schedule.')
      dates.add(s.effective)
    }
    if (![...dates].some(date => date <= startDate)) throw new Error('Missing initial schedule.')
    dates.clear()
    for (const c of h.criteria) {
      if (!object(c) || !dateValid(c.effective) || dates.has(c.effective) || !isText(c.done) || !isText(c.partial) || !isText(c.missed)) throw new Error('Invalid criteria.')
      dates.add(c.effective)
    }
    if (![...dates].some(date => date <= startDate)) throw new Error('Missing initial criteria.')
    for (const p of h.pauses) if (!object(p) || !dateValid(p.start) || !optionalDate(p.end) || (p.end !== null && (p.end as string) < p.start)) throw new Error('Invalid pause.')
  }
  const keys = new Set<string>()
  for (const e of data.entries) {
    if (!object(e) || !isText(e.habitId) || !ids.has(e.habitId) || !dateValid(e.date) || !['done', 'partial', 'missed', 'skipped'].includes(String(e.outcome)) || !isText(e.note) || keys.has(`${e.habitId}/${e.date}`)) throw new Error('Invalid habit outcome.')
    keys.add(`${e.habitId}/${e.date}`)
  }
  if (data.unloggedNotes !== undefined) {
    if (!Array.isArray(data.unloggedNotes)) throw new Error('Invalid unlogged notes.')
    const noteKeys = new Set<string>()
    for (const n of data.unloggedNotes) {
      if (!object(n) || !isText(n.habitId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(n.habitId) || !dateValid(n.date) || !isText(n.note) || !n.note || noteKeys.has(`${n.habitId}/${n.date}`)) throw new Error('Invalid unlogged note.')
      noteKeys.add(`${n.habitId}/${n.date}`)
    }
  }
  return data as HabitData
}
