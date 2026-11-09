import { useEffect, useRef, useState } from 'react'
import { localDate, outcomeLabel, paused, shiftDate, versionAt, type Criteria, type Habit, type Outcome, type Schedule } from './model'
import { InfoTip } from '../InfoTip'

const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const cap = (text: string) => text[0].toUpperCase() + text.slice(1)

export function CriteriaList({ criteria }: { criteria?: Criteria }) {
  if (!criteria || !(criteria.done || criteria.partial || criteria.missed)) return null
  return <dl className="habit-criteria-list" aria-label="Outcome criteria">{(['done', 'partial', 'missed'] as const).map(key => criteria[key] && <div key={key}><dt>{cap(key)}</dt><dd>{criteria[key]}</dd></div>)}</dl>
}

export type HabitDraft = { habitId: string; date: string; outcome: Outcome | null; note: string; originalOutcome: Outcome | null; originalNote: string }
export function EntryEditor({ habit, draft, onChange, onNoteBlur, onOutcome }: { habit: Habit; draft: HabitDraft; onChange: (draft: HabitDraft) => void; onNoteBlur: (note: string) => void; onOutcome: (outcome: Outcome | null) => void }) {
  const options: Outcome[] = ['done', 'partial', 'missed', 'skipped']
  return <div className="habit-details habit-entry-editor">
    {habit.description && <p>{habit.description}</p>}
    <p className="habit-detail-label">{draft.originalOutcome ? 'Change outcome' : 'How did it go?'} <InfoTip label="About habit outcomes">Done and Partial contribute to progress. Missed is a recorded outcome; an unlogged day is not automatically missed. Skipped is neutral for fixed performance, and a skipped flexible week is not judged against its target.</InfoTip></p>
    <div className="habit-outcomes habit-outcome-choices">{options.map(outcome => {
      return <button key={outcome} aria-pressed={draft.outcome === outcome} className={draft.outcome === outcome ? `selected outcome-${outcome}` : ''} onClick={() => onOutcome(outcome)}><span className="habit-choice-title">{outcomeLabel(habit, draft.date, outcome)}</span></button>
    })}</div>
    {draft.outcome && <label>Note<textarea value={draft.note} onChange={event => onChange({ ...draft, note: event.target.value })} onBlur={event => onNoteBlur(event.target.value)}/></label>}
    {draft.originalOutcome && <div className="habit-entry-actions"><button className="text-button" onClick={() => { if (window.confirm('Clear this outcome and its note?')) onOutcome(null) }}>Clear outcome and note</button></div>}
  </div>
}

export function PauseControls({ habit, onChange }: { habit: Habit; onChange: (habit: Habit) => void }) {
  const [until, setUntil] = useState('')
  const today = localDate()
  if (habit.start > today || (habit.end && habit.end < today)) return null
  if (paused(habit, today)) return <button className="text-button" onClick={() => onChange({ ...habit, pauses: habit.pauses.flatMap(p => p.start <= today && (!p.end || p.end >= today) ? p.start === today ? [] : [{ ...p, end: shiftDate(today, -1) }] : [p]) })}>Resume today</button>
  return <div className="habit-pause"><label>Pause through <input type="date" min={today} value={until} onChange={event => setUntil(event.target.value)}/></label><button onClick={() => { if (until && until < today) return; onChange({ ...habit, pauses: [...habit.pauses, { start: today, end: until || null }] }); setUntil('') }}>Pause {until ? 'through date' : 'indefinitely'}</button></div>
}

export function HabitForm({ initial, onSave, onCancel }: { initial: Habit | null; onSave: (habit: Habit) => void; onCancel: () => void }) {
  const today = localDate()
  const [title, setTitle] = useState(initial?.title || '')
  const [icon, setIcon] = useState(initial?.icon || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [start, setStart] = useState(initial?.start || today)
  const [end, setEnd] = useState(initial?.end || '')
  const [effective, setEffective] = useState(initial ? (today < initial.start ? initial.start : today) : today)
  const existing = initial ? versionAt(initial.schedules, effective) || initial.schedules[0] : undefined
  const oldCriteria = initial ? versionAt(initial.criteria, effective) || initial.criteria[0] : undefined
  const [kind, setKind] = useState<Schedule['kind']>(existing?.kind || 'fixed')
  const [days, setDays] = useState<number[]>(existing?.weekdays || [0, 1, 2, 3, 4, 5, 6])
  const [target, setTarget] = useState(existing?.target || 1)
  const [done, setDone] = useState(oldCriteria?.done || '')
  const [partial, setPartial] = useState(oldCriteria?.partial || '')
  const [missed, setMissed] = useState(oldCriteria?.missed || '')
  const [error, setError] = useState('')
  const previousEffective = useRef(effective)
  useEffect(() => {
    if (!initial || !effective || effective === previousEffective.current) return
    const previousSchedule = versionAt(initial.schedules, previousEffective.current)
    const previousCriteria = versionAt(initial.criteria, previousEffective.current)
    const changed = previousSchedule && (previousSchedule.kind !== kind || JSON.stringify([...previousSchedule.weekdays].sort()) !== JSON.stringify([...days].sort()) || (kind === 'flexible' && previousSchedule.target !== target)) || previousCriteria && (previousCriteria.done !== done || previousCriteria.partial !== partial || previousCriteria.missed !== missed)
    if (changed && !window.confirm('Changing the effective date reloads its saved schedule and criteria. Discard your unsaved schedule and criteria edits?')) { setEffective(previousEffective.current); return }
    const schedule = versionAt(initial.schedules, effective)
    const criteria = versionAt(initial.criteria, effective)
    if (schedule) { setKind(schedule.kind); setDays(schedule.weekdays); setTarget(schedule.target) }
    if (criteria) { setDone(criteria.done); setPartial(criteria.partial); setMissed(criteria.missed) }
    previousEffective.current = effective
  }, [effective])
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const from = initial ? effective : start
    if (!title.trim() || !days.length || !start || (end && end < start) || from < start || (end && from > end) || (kind === 'flexible' && (target < 1 || target > days.length))) { setError('Check the title, dates, weekdays and weekly target. The target cannot exceed selected weekdays.'); return }
    const schedule: Schedule = { effective: from, kind, weekdays: [...days].sort(), target: kind === 'fixed' ? 1 : target }
    const criteria: Criteria = { effective: from, done, partial, missed }
    const beforeSchedule = initial && versionAt(initial.schedules, from)
    const beforeCriteria = initial && versionAt(initial.criteria, from)
    const sameSchedule = beforeSchedule && beforeSchedule.kind === schedule.kind && beforeSchedule.target === schedule.target && JSON.stringify([...beforeSchedule.weekdays].sort()) === JSON.stringify(schedule.weekdays)
    const sameCriteria = beforeCriteria && beforeCriteria.done === done && beforeCriteria.partial === partial && beforeCriteria.missed === missed
    if (initial && (start !== initial.start || (end || null) !== initial.end) && !window.confirm('Changing active dates changes which days are expected. Existing records and criteria are kept. If the start is earlier, the earliest schedule and criteria are used for the added dates. Continue?')) return
    let schedules = initial ? sameSchedule ? [...initial.schedules] : [...initial.schedules.filter(item => item.effective !== from), schedule] : [schedule]
    let allCriteria = initial ? sameCriteria ? [...initial.criteria] : [...initial.criteria.filter(item => item.effective !== from), criteria] : [criteria]
    if (initial && !versionAt(schedules, start)) schedules = [...schedules, { ...[...schedules].sort((a, b) => a.effective.localeCompare(b.effective))[0], effective: start }]
    if (initial && !versionAt(allCriteria, start)) allCriteria = [...allCriteria, { ...[...allCriteria].sort((a, b) => a.effective.localeCompare(b.effective))[0], effective: start }]
    const habit: Habit = { id: initial?.id || crypto.randomUUID(), title: title.trim(), icon: icon.trim(), description, start, end: end || null, archived: initial?.archived || false, pauses: initial?.pauses || [], schedules, criteria: allCriteria }
    onSave(habit)
  }
  return <form className="habit-form settings-card" onSubmit={submit}><h2>{initial ? 'Edit habit' : 'Create habit'}</h2><label>Icon (optional emoji)<input value={icon} maxLength={32} placeholder="✨" onChange={event => setIcon(event.target.value)}/></label><label>Title<input value={title} required onChange={event => setTitle(event.target.value)}/></label><label>Description<textarea value={description} onChange={event => setDescription(event.target.value)}/></label><label>Start date<input type="date" required value={start} onChange={event => setStart(event.target.value)}/></label><label>End date (optional)<input type="date" min={start} value={end} onChange={event => setEnd(event.target.value)}/></label>{initial && <p className="habit-form-help">Schedule and criteria changes apply from the date below. Earlier dates keep their previous settings.</p>}{initial && <label>Schedule and criteria effective from<input type="date" required min={start} max={end || undefined} value={effective} onChange={event => setEffective(event.target.value)}/></label>}<p className="habit-form-help">Choose when this habit is available. Flexible habits have a weekly target rather than being due every selected day.</p><label>Schedule<select value={kind} onChange={event => setKind(event.target.value as Schedule['kind'])}><option value="fixed">Fixed weekdays</option><option value="flexible">Flexible weekly target</option></select></label><fieldset><legend>{kind === 'fixed' ? 'Due weekdays' : 'Eligible weekdays'}</legend><div className="habit-weekdays">{labels.map((label, day) => <label key={label}><input type="checkbox" checked={days.includes(day)} onChange={event => setDays(event.target.checked ? [...days, day] : days.filter(item => item !== day))}/>{label}</label>)}</div></fieldset>{kind === 'flexible' && <label>Times per week<input type="number" min="1" max={days.length} value={target} onChange={event => setTarget(Number(event.target.value))}/></label>}<details><summary>Outcome criteria (optional)</summary><label>Done<textarea value={done} onChange={event => setDone(event.target.value)}/></label><label>Partial<textarea value={partial} onChange={event => setPartial(event.target.value)}/></label><label>Missed<textarea value={missed} onChange={event => setMissed(event.target.value)}/></label></details>{error && <p role="alert">{error}</p>}<div className="habit-actions"><button className="primary">Save habit</button><button type="button" className="outline-button" onClick={onCancel}>Cancel</button></div></form>
}
