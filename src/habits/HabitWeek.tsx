import { useEffect, useRef, useState } from 'react'
import { eligible, evaluateFlexibleWeek, flexibleWeekText, hasFlexibleWeek, localDate, MIN_HABIT_DATE, outcomeLabel, shiftDate, versionAt, weekStart, type Entry, type Habit } from './model'

const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const symbols = { done: '✓', partial: '½', missed: '×', skipped: '–' } as const
const outcomes = { done: 'Done', partial: 'Partial', missed: 'Missed', skipped: 'Skipped' } as const

export function HabitWeek({ date, habits, entries, notes, selected, onDate, onSelect }: {
  date: string
  habits: Habit[]
  entries: Map<string, Map<string, Entry>>
  notes: { habitId: string; date: string; note: string }[]
  selected: { habitId: string; date: string } | null
  onDate: (date: string) => void
  onSelect: (habitId: string, date: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const today = localDate()
  const monday = weekStart(date)
  const days = labels.map((_, i) => shiftDate(monday, i))
  const observedThrough = today < days[6] ? today : days[6]
  const noteKeys = new Set(notes.filter(note => note.note.trim()).map(note => `${note.habitId}/${note.date}`))
  const visible = habits.filter(habit => days.some(day => (!habit.archived && eligible(habit, day)) || entries.get(habit.id)?.has(day) || noteKeys.has(`${habit.id}/${day}`)))

  useEffect(() => {
    const scroll = scrollRef.current
    const canvas = canvasRef.current
    if (!scroll || !canvas) return
    const measure = () => setOverflows(scroll.scrollWidth > scroll.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroll)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  return <section className="habit-week-section">
    <div className="habit-week-heading"><div><h2>Week of {monday}</h2><small>Tap a day to record or correct</small></div><div className="habit-week-nav"><button type="button" className="outline-button" aria-label="Previous week" disabled={monday === MIN_HABIT_DATE} onClick={() => onDate(shiftDate(date, -7))}>←</button><button type="button" className="outline-button" aria-label="Next week" disabled={monday >= weekStart(today)} onClick={() => onDate([shiftDate(date, 7), today].sort()[0])}>→</button></div></div>
    <div className="habit-week-legend" aria-label="Week legend"><span>✓ Done</span><span>½ Partial</span><span>× Missed</span><span>– Skipped</span><span>· Unlogged</span><span>○ Available</span><span>✎ Note only</span><span>— Future / not scheduled</span></div>
    <p>Done adds 1 point; Partial adds ½. Skip applies to one day. Weekly results use this rule for past weeks too.</p>
    {overflows && <p className="habit-week-scroll-cue">Swipe for more days →</p>}
    {visible.length === 0 && <p>No scheduled or recorded habits this week.</p>}
    <div ref={scrollRef} className={`habit-week-scroll${overflows ? ' has-overflow' : ''}`} role="region" aria-label="Week dates and habit outcomes" tabIndex={0}>
      <div ref={canvasRef} className="habit-week-canvas">
        <div className="habit-week-grid-head" aria-hidden="true">{days.map((day, i) => <time key={day} dateTime={day} title={day} className={day === date ? 'is-selected' : undefined}>{labels[i]}<br/>{Number(day.slice(8))}</time>)}</div>
        {visible.map(habit => {
          const records = entries.get(habit.id)
          const progress = hasFlexibleWeek(habit, monday, observedThrough)
            ? evaluateFlexibleWeek(habit, records || new Map<string, Entry>(), monday, date)
            : null
          return <div className="habit-week-card" key={habit.id}>
            <div className="habit-week-title"><strong><span aria-hidden="true">{habit.icon || '◈'}</span> {habit.title}{habit.archived ? ' · Archived' : ''}</strong>{progress && <small>{flexibleWeekText(progress)} · through {date === today ? 'today' : date}</small>}</div>
            <div className="habit-week">{days.map(day => {
              const record = records?.get(day)
              const hasNote = Boolean(record?.note.trim()) || noteKeys.has(`${habit.id}/${day}`)
              const opportunity = !habit.archived && eligible(habit, day)
              const canEdit = Boolean(record) || hasNote || opportunity
              const future = day > today
              const optional = opportunity && versionAt(habit.schedules, day)?.kind === 'flexible'
              const state = future ? 'future' : record ? record.outcome : hasNote ? 'note-only' : !canEdit ? 'unscheduled' : optional ? 'available' : 'unlogged'
              const personalLabel = record ? outcomeLabel(habit, day, record.outcome) : ''
              const resultLabel = record && personalLabel !== outcomes[record.outcome] ? `${personalLabel} (${outcomes[record.outcome]})` : personalLabel
              const status = record ? `${resultLabel}${hasNote ? '; note saved' : ''}` : hasNote ? 'Unlogged; note saved' : !canEdit ? 'Not scheduled' : optional ? 'Available, no entry' : 'Not logged'
              const description = future ? `Future; logging unavailable${record || hasNote ? `; ${status}` : ''}` : status
              const label = `${habit.title}, ${day}, ${description}`
              return <button type="button" key={day} className={`is-${state}${hasNote ? ' has-note' : ''}`} aria-pressed={selected?.habitId === habit.id && selected.date === day} disabled={future || !canEdit} aria-label={label} title={label} onClick={() => onSelect(habit.id, day)}><strong aria-hidden="true">{future ? '—' : record ? symbols[record.outcome] : hasNote ? '✎' : !canEdit ? '—' : optional ? '○' : '·'}</strong></button>
            })}</div>
          </div>
        })}
      </div>
    </div>
  </section>
}
