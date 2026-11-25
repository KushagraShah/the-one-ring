import { eligible, outcomeLabel, shiftDate, versionAt, type Entry, type Habit } from './model'

const icons = { done: '✓', partial: '½', missed: '×', skipped: '–' } as const
export function RecentHabitDays({ habit, date, entries, notes }: { habit: Habit; date: string; entries: ReadonlyMap<string, Entry> | undefined; notes?: ReadonlyMap<string, string> }) {
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(date, index - 6))
  const canonical = { done: 'Done', partial: 'Partial', missed: 'Missed', skipped: 'Skipped' }
  const description = days.map(day => {
    const entry = entries?.get(day)
    if (entry) {
      const label = outcomeLabel(habit, day, entry.outcome)
      return `${day}: ${label}${label !== canonical[entry.outcome] ? ` (${canonical[entry.outcome]})` : ''}${entry.note || notes?.has(day) ? '; note saved' : ''}`
    }
    const state = notes?.has(day) ? 'Unlogged; note saved' : eligible(habit, day) && !habit.archived ? versionAt(habit.schedules, day)?.kind === 'flexible' ? 'available, no entry' : 'not logged' : 'not scheduled'
    return `${day}: ${state}`
  }).join('; ')
  const endpoint = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return <div className="habit-recent" role="img" aria-label={`Last 7 days for ${habit.title}: ${description}`}>
    <small className="habit-recent-caption" aria-hidden="true">Last 7 days · {endpoint(days[0])}–{endpoint(date)}</small>
    <div className="habit-recent-days" aria-hidden="true">{days.map(day => {
      const entry = entries?.get(day)
      const state = entry?.outcome || (notes?.has(day) ? 'note' : eligible(habit, day) && !habit.archived ? versionAt(habit.schedules, day)?.kind === 'flexible' ? 'available' : 'unlogged' : 'unscheduled')
      return <span key={day} className={`habit-marker is-${state} ${day === date ? 'is-selected' : ''}`}>{entry ? icons[entry.outcome] : state === 'note' ? '✎' : state === 'unlogged' ? '·' : state === 'available' ? '○' : '—'}</span>
    })}</div>
  </div>
}
