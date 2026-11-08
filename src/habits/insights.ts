import { eligible, indexEntries, paused, shiftDate, versionAt, weekStart, type Entry, type Habit, type HabitData, type Outcome } from './model'

export type Score = { done: number; partial: number; missed: number; skipped: number; due: number; performance: number | null; coverage: number | null }
const points: Record<Outcome, number> = { done: 1, partial: 0.5, missed: 0, skipped: 0 }

/** Fixed opportunities only: unrecorded is not a missed score. */
export function fixedScore(data: HabitData, from: string, to: string, index = indexEntries(data.entries)): Score {
  const counts = { done: 0, partial: 0, missed: 0, skipped: 0, due: 0 }
  for (let day = from; day <= to; day = shiftDate(day, 1)) {
    for (const habit of data.habits) {
      if (habit.archived || !eligible(habit, day) || versionAt(habit.schedules, day)?.kind !== 'fixed') continue
      counts.due++
      const entry = index.byHabitDate.get(habit.id)?.get(day)
      if (entry) counts[entry.outcome]++
    }
  }
  const scored = counts.done + counts.partial + counts.missed
  return { ...counts, performance: scored ? (counts.done + 0.5 * counts.partial) / scored : null, coverage: counts.due ? (scored + counts.skipped) / counts.due : null }
}

export type FlexibleWeek = { points: number; target: number | null; reason: string | null }
export function flexibleWeek(habit: Habit, entries: Entry[], monday: string, today: string): FlexibleWeek {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(monday, index))
  const sunday = days[6]
  const relevant = entries.filter(entry => entry.habitId === habit.id && entry.date >= monday && entry.date <= sunday && entry.date <= today && eligible(habit, entry.date) && versionAt(habit.schedules, entry.date)?.kind === 'flexible')
  const total = relevant.reduce((sum, entry) => sum + points[entry.outcome], 0)
  const schedule = versionAt(habit.schedules, monday)
  if (sunday > today) return { points: total, target: null, reason: 'Week in progress' }
  if (habit.start > monday || (habit.end && habit.end < sunday)) return { points: total, target: null, reason: 'Partial active week' }
  if (!schedule || schedule.kind !== 'flexible' || days.some(day => versionAt(habit.schedules, day) !== schedule)) return { points: total, target: null, reason: 'Schedule changed' }
  if (days.some(day => paused(habit, day)) || relevant.some(entry => entry.outcome === 'skipped')) return { points: total, target: null, reason: 'Paused or skipped' }
  return { points: total, target: schedule.target, reason: null }
}

/** Current streaks only; do not infer across changes of schedule type. */
export function habitStreak(habit: Habit, entries: Entry[], today: string): { success: number; engagement: number; unit: 'days' | 'weeks' } {
  const schedule = versionAt(habit.schedules, today)
  const habitEntries = entries.filter(entry => entry.habitId === habit.id)
  const records = new Map(habitEntries.map(entry => [entry.date, entry]))
  let success = 0; let engagement = 0; let successOpen = true; let engagementOpen = true
  if (schedule?.kind === 'flexible') {
    for (let monday = shiftDate(weekStart(today), -7), limit = 0; shiftDate(monday, 6) >= habit.start && limit < 5200; monday = shiftDate(monday, -7), limit++) {
      const result = flexibleWeek(habit, habitEntries, monday, today)
      if (result.reason === 'Schedule changed') break
      if (result.target === null) continue
      if (successOpen && result.points >= result.target) success++; else successOpen = false
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
    if (day === today && !outcome) continue // Today is still in progress, not a missed opportunity.
    if (successOpen && outcome === 'done') success++; else successOpen = false
    if (engagementOpen && (outcome === 'done' || outcome === 'partial' || outcome === 'skipped')) engagement++; else engagementOpen = false
    if (!successOpen && !engagementOpen) break
  }
  return { success, engagement, unit: 'days' }
}

export function monthBounds(month: string, today: string): { from: string; to: string } {
  const from = `${month}-01`
  const [year, m] = month.split('-').map(Number)
  const next = `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
  return { from, to: [shiftDate(next, -1), today].sort()[0] }
}

export function percent(value: number | null): string { return value === null ? '—' : `${Math.round(value * 100)}%` }
