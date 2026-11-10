import { eligible, outcomeLabel, shiftDate, versionAt, type Entry, type Habit } from './model'

const icons = { done: '✓', partial: '½', missed: '×', skipped: '–' } as const
export function RecentHabitDays({ habit, date, entries }: { habit: Habit; date: string; entries: Map<string, Entry> | undefined }) {
  return <div className="habit-recent" role="img" aria-label={`Recent days for ${habit.title}: ${Array.from({ length: 7 }, (_, index) => {
    const day = shiftDate(date, index - 6); const entry = entries?.get(day)
    const state = eligible(habit, day) && !habit.archived ? versionAt(habit.schedules, day)?.kind === 'flexible' ? 'optional, no entry' : 'not logged' : 'not scheduled'
    return `${day}: ${entry ? outcomeLabel(habit, day, entry.outcome) : state}`
  }).join('; ')}`}><div className="habit-recent-days" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => shiftDate(date, index - 6)).map(day => {
    const entry = entries?.get(day)
    const state = entry?.outcome || (eligible(habit, day) && !habit.archived ? versionAt(habit.schedules, day)?.kind === 'flexible' ? 'available' : 'unlogged' : 'unscheduled')
    return <span key={day} className={`habit-marker is-${state} ${day === date ? 'is-selected' : ''}`}>{entry ? icons[entry.outcome] : state === 'unlogged' ? '·' : state === 'available' ? '○' : '—'}</span>
  })}</div></div>
}
