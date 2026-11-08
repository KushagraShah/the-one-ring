import { eligible, localDate, shiftDate, versionAt, type Entry, type Habit } from './model'

const icons = { done: '✓', partial: '½', missed: '×', skipped: '–' } as const
export function RecentHabitDays({ habit, date, entries, onSelect }: { habit: Habit; date: string; entries: Map<string, Entry> | undefined; onSelect: (day: string) => void }) {
  const today = localDate()
  return <div className="habit-recent" aria-label={`Recent days for ${habit.title}`}><span className="habit-recent-label">RECENT</span><div className="habit-recent-days">{Array.from({ length: 7 }, (_, index) => shiftDate(date, index - 6)).map(day => {
    const entry = entries?.get(day)
    const editable = day <= today && (Boolean(entry) || (!habit.archived && eligible(habit, day)))
    const state = entry?.outcome || (eligible(habit, day) && !habit.archived ? versionAt(habit.schedules, day)?.kind === 'flexible' ? 'available' : 'unlogged' : 'unscheduled')
    const dayLabel = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    return <button type="button" key={day} disabled={!editable} className={`habit-recent-day is-${state} ${day === date ? 'is-selected' : ''}`} aria-label={`${habit.title}, ${dayLabel}, ${state === 'unlogged' ? 'not logged' : state === 'available' ? 'available, no entry' : state === 'unscheduled' ? 'not scheduled' : state}`} aria-current={day === date ? 'date' : undefined} onClick={() => onSelect(day)}><span aria-hidden="true">{entry ? icons[entry.outcome] : state === 'unlogged' ? '·' : state === 'available' ? '○' : '—'}</span></button>
  })}</div></div>
}
