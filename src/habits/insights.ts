import { eligible, indexEntries, shiftDate, versionAt, weekProgress, weekStart, type Entry, type Habit, type HabitData } from './model'

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
/** Include any active flexible portion through the as-of date, including paused days. */
export function hasFlexibleWeek(habit: Habit, monday: string, today: string): boolean {
  if (habit.archived) return false
  const end = [shiftDate(monday, 6), today, habit.end || today].sort()[0]
  for (let day = monday; day <= end; day = shiftDate(day, 1)) {
    if (day >= habit.start && versionAt(habit.schedules, day)?.kind === 'flexible') return true
  }
  return false
}

export function flexibleWeek(habit: Habit, entries: Entry[], monday: string, today: string): FlexibleWeek {
  const sunday = shiftDate(monday, 6)
  const cutoff = today < sunday ? today : sunday
  const progress = weekProgress(habit, entries, cutoff)
  if (progress.affected || progress.reason === 'Schedule changed') return { points: progress.points, target: null, reason: progress.reason }
  if (today <= sunday) return { points: progress.points, target: null, reason: 'Week in progress' }
  return { points: progress.points, target: progress.target, reason: null }
}

/** Current streaks only; do not infer across changes of schedule type. */
export function habitStreak(habit: Habit, entries: Entry[], today: string): { success: number; engagement: number; unit: 'days' | 'weeks' } {
  const schedule = versionAt(habit.schedules, today)
  const habitEntries = entries.filter(entry => entry.habitId === habit.id)
  const records = new Map(habitEntries.map(entry => [entry.date, entry]))
  let success = 0; let engagement = 0; let successOpen = true; let engagementOpen = true
  if (schedule?.kind === 'flexible') {
    // A type transition is a streak boundary, even in an otherwise excluded week.
    const containsFixed = (monday: string, through: string) => {
      for (let day = monday; day <= through; day = shiftDate(day, 1)) {
        if (day >= habit.start && (!habit.end || day <= habit.end) && versionAt(habit.schedules, day)?.kind === 'fixed') return true
      }
      return false
    }
    if (containsFixed(weekStart(today), today)) return { success, engagement, unit: 'weeks' }
    for (let monday = shiftDate(weekStart(today), -7), limit = 0; shiftDate(monday, 6) >= habit.start && limit < 5200; monday = shiftDate(monday, -7), limit++) {
      if (containsFixed(monday, shiftDate(monday, 6))) break
      const result = flexibleWeek(habit, habitEntries, monday, today)
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
    if (outcome === 'skipped') continue // An intentional skip is a one-day pause.
    if (day === today && !outcome) continue // Today is still in progress, not a missed opportunity.
    if (successOpen && outcome === 'done') success++; else successOpen = false
    if (engagementOpen && (outcome === 'done' || outcome === 'partial')) engagement++; else engagementOpen = false
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
