import type { ReactNode } from 'react'
import { eligible, localDate, outcomeLabel, shiftDate, versionAt, weekProgress, weekStart, type Entry, type Habit } from './model'

const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const symbols = { done: '✓', partial: '½', missed: '×', skipped: '–' } as const

export function HabitWeek({ date, habits, entries, selected, onDate, onSelect, editor }: {
  date: string
  habits: Habit[]
  entries: Map<string, Map<string, Entry>>
  selected: { habitId: string; date: string } | null
  onDate: (date: string) => void
  onSelect: (habitId: string, date: string) => void
  editor: (habit: Habit) => ReactNode
}) {
  const today = localDate()
  const monday = weekStart(date)
  const days = labels.map((_, i) => shiftDate(monday, i))
  const visible = habits.filter(habit => days.some(day => (!habit.archived && eligible(habit, day)) || entries.get(habit.id)?.has(day)))
  return <section className="habit-week-section">
    <div className="habit-week-heading"><div><h2>Week of {monday}</h2><small>Tap a day to record or correct</small></div><div className="habit-week-nav"><button className="outline-button" aria-label="Previous week" onClick={() => onDate(shiftDate(date, -7))}>←</button><button className="outline-button" aria-label="Next week" disabled={monday >= weekStart(today)} onClick={() => onDate([shiftDate(date, 7), today].sort()[0])}>→</button></div></div>
    <div className="habit-week-legend" aria-label="Week legend"><span>✓ Done</span><span>½ Partial</span><span>× Missed</span><span>– Skipped</span><span>· Unlogged</span><span>○ Available</span></div>
    {visible.length === 0 && <p>No scheduled or recorded habits this week.</p>}
    {visible.map(habit => {
      const records = entries.get(habit.id)
      const progress = weekProgress(habit, [...(records?.values() || [])], date)
      const schedule = versionAt(habit.schedules, date)
      return <div className="habit-card habit-week-card" key={habit.id}>
        <div className="habit-week-title"><strong><span aria-hidden="true">{habit.icon || '◈'}</span> {habit.title}</strong>{schedule?.kind === 'flexible' && <small>{progress.points} / {progress.target} through {date === today ? 'today' : date}{progress.affected ? ' · not judged' : ''}</small>}</div>
        <div className="habit-week">{days.map((day, i) => {
          const record = records?.get(day)
          const canEdit = Boolean(record) || (!habit.archived && eligible(habit, day))
          const future = day > today
          const optional = !record && canEdit && versionAt(habit.schedules, day)?.kind === 'flexible'
          const state = record ? record.outcome : !canEdit ? 'unscheduled' : future ? 'future' : optional ? 'available' : 'unlogged'
          const description = record ? outcomeLabel(habit, day, record.outcome) : !canEdit ? 'not scheduled' : future ? 'future' : optional ? 'available, no entry' : 'not logged'
          return <button key={day} className={`is-${state}`} aria-pressed={selected?.habitId === habit.id && selected.date === day} disabled={future || !canEdit} aria-label={`${habit.title}, ${day}, ${description}`} onClick={() => onSelect(habit.id, day)}><span>{labels[i]}</span><strong aria-hidden="true">{record ? symbols[record.outcome] : !canEdit || future ? '—' : optional ? '○' : '·'}</strong></button>
        })}</div>
        {editor(habit)}
      </div>
    })}
  </section>
}
