export type Outcome = 'done' | 'partial' | 'missed' | 'skipped'
export type Schedule = { effective: string; kind: 'fixed' | 'flexible'; weekdays: number[]; target: number }
export type Criteria = { effective: string; done: string; partial: string; missed: string }
export type Pause = { start: string; end: string | null }
export type Habit = { id: string; title: string; description: string; start: string; end: string | null; archived: boolean; schedules: Schedule[]; criteria: Criteria[]; pauses: Pause[] }
export type Entry = { habitId: string; date: string; outcome: Outcome; note: string }
export type HabitData = { version: 1; habits: Habit[]; entries: Entry[] }
export const emptyHabits = (): HabitData => ({ version: 1, habits: [], entries: [] })

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return localDate(new Date(year, month - 1, day + days, 12))
}
export function weekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return (new Date(year, month - 1, day, 12).getDay() + 6) % 7
}
export function weekStart(date: string): string { return shiftDate(date, -weekday(date)) }
export function versionAt<T extends { effective: string }>(items: T[], date: string): T | undefined {
  let latest: T | undefined
  for (const item of items) if (item.effective <= date && (!latest || item.effective > latest.effective)) latest = item
  return latest
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
export function weekProgress(habit: Habit, entries: Entry[], date: string) {
  const monday = weekStart(date)
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i))
  const schedule = versionAt(habit.schedules, date)
  const records = entries.filter(entry => entry.habitId === habit.id && days.includes(entry.date))
  const points = records.reduce((sum, entry) => sum + (entry.outcome === 'done' ? 1 : entry.outcome === 'partial' ? 0.5 : 0), 0)
  const affected = days.some(day => day >= habit.start && (!habit.end || day <= habit.end) && paused(habit, day)) || records.some(entry => entry.outcome === 'skipped')
  const availableSoFar = days.filter(day => day <= date && eligible(habit, day)).length
  return { points, target: schedule?.target || 0, targetSoFar: Math.min(schedule?.target || 0, availableSoFar), affected }
}

const dateValid = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && shiftDate(value, 0) === value
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const optionalDate = (value: unknown) => value === null || dateValid(value)
export function parseHabits(input: string): HabitData {
  if (new TextEncoder().encode(input).length > 10_000_000) throw new Error('Habit backup is too large.')
  const data: unknown = JSON.parse(input)
  if (!object(data) || data.version !== 1 || !Array.isArray(data.habits) || !Array.isArray(data.entries)) throw new Error('Invalid habit data.')
  const ids = new Set<string>()
  for (const h of data.habits) {
    if (!object(h) || !isText(h.id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(h.id) || ids.has(h.id) || !isText(h.title) || !h.title.trim() || !isText(h.description) || !dateValid(h.start) || !optionalDate(h.end) || (h.end !== null && (h.end as string) < h.start) || typeof h.archived !== 'boolean' || !Array.isArray(h.schedules) || !h.schedules.length || !Array.isArray(h.criteria) || !h.criteria.length || !Array.isArray(h.pauses)) throw new Error('Invalid habit.')
    ids.add(h.id)
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
  return data as HabitData
}
