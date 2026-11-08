import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../auth'
import { eligible, localDate, parseHabits, paused, shiftDate, versionAt, weekProgress, weekStart, type Criteria, type Entry, type Habit, type HabitData, type Outcome, type Schedule } from './model'
import { demoHabitData } from './demo'
import { OnlineHabitStore, type SaveStatus } from './online'
import { Insights } from './Insights'
import { fixedScore } from './insights'
import './habits.css'

type Identity = { id: string; demo: boolean }
type Props = { identity: Identity; view: string; exportWorkout: () => void }
export type HabitHandle = { canSignOut: () => boolean; leave: (done: () => void) => void; snapshot: () => HabitData | null; exportData: () => void; replace: (data: HabitData) => void }
const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const outcomes: Outcome[] = ['done', 'partial', 'missed', 'skipped']
const cap = (text: string) => text[0].toUpperCase() + text.slice(1)
function download(data: unknown, scope: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `one-ring-${scope}-${stamp}.json`; link.click(); URL.revokeObjectURL(url)
}

export const HabitApp = forwardRef<HabitHandle, Props>(function HabitApp({ identity, view, exportWorkout }, ref) {
  const [data, setData] = useState<HabitData | null>(() => identity.demo ? demoHabitData() : null)
  const [store, setStore] = useState<OnlineHabitStore | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [date, setDate] = useState(localDate)
  const [tab, setTab] = useState<'today' | 'manage' | 'week' | 'insights'>('today')
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [undo, setUndo] = useState<HabitData | null>(null)
  const noteBeforeEdit = useRef<HabitData | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [message, setMessage] = useState('')
  const switchTab = (next: typeof tab) => { if (editing && !window.confirm('Discard unsaved habit changes?')) return; setTab(next); setEditing(null) }

  useEffect(() => {
    if (identity.demo) return
    if (!supabase) { setLoadError(true); return }
    let active = true
    const next = new OnlineHabitStore(supabase, identity.id)
    setLoadError(false)
    next.load().then(result => { if (active) { setData(result); setStore(next) } }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [identity.id, identity.demo, attempt])
  useLayoutEffect(() => { if (!store) return; store.onStatus = setStatus; return () => { store.onStatus = () => {} } }, [store])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (status !== 'saved') event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [status])
  const update = (next: HabitData, canUndo = true) => {
    const validated = parseHabits(JSON.stringify(next))
    if (canUndo) setUndo(data)
    setData(validated); store?.update(validated)
  }
  useImperativeHandle(ref, () => ({ canSignOut: () => status === 'saved' && !editing, leave: done => { if (editing && !window.confirm('Discard unsaved habit changes?')) return; setEditing(null); done() }, snapshot: () => data, exportData, replace: next => update(next, false) }))
  const exportData = () => { if (data) download({ scope: 'habits', format: 1, exportedAt: new Date().toISOString(), data }, 'habits') }
  const restore = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 10_000_000) throw new Error('Too large')
      const value = JSON.parse(await file.text())
      if (value.scope !== 'habits' || value.format !== 1) throw new Error('Wrong scope')
      const next = parseHabits(JSON.stringify(value.data))
      if (window.confirm('Replace all habit data with this backup? Workout data will not change. Export current habits first.')) { update(next); setMessage('Habit backup loaded. Wait for saving to finish.') }
    } catch { window.alert('Unable to restore this habit backup. No habit data was replaced.') }
  }
  const entry = (habitId: string, day: string) => data?.entries.find(item => item.habitId === habitId && item.date === day)
  const setOutcome = (habitId: string, day: string, outcome: Outcome | null) => {
    if (!data || day > localDate() || (outcome && !entry(habitId, day) && !eligible(data.habits.find(h => h.id === habitId)!, day))) return
    const previous = entry(habitId, day)
    const entries = data.entries.filter(item => item.habitId !== habitId || item.date !== day)
    if (outcome) entries.push({ habitId, date: day, outcome, note: previous?.note || '' })
    update({ ...data, entries })
  }
  const changeNote = (old: Entry, note: string) => { if (data) { if (noteBeforeEdit.current) { setUndo(noteBeforeEdit.current); noteBeforeEdit.current = null } update({ ...data, entries: data.entries.map(item => item === old ? { ...item, note } : item) }, false) } }
  const saveHabit = (habit: Habit) => {
    if (!data) return
    const exists = data.habits.some(item => item.id === habit.id)
    update({ ...data, habits: exists ? data.habits.map(item => item.id === habit.id ? habit : item) : [...data.habits, habit] })
    setEditing(null)
  }
  const changeHabit = (habit: Habit) => { if (data) update({ ...data, habits: data.habits.map(item => item.id === habit.id ? habit : item) }) }
  const move = (index: number, direction: number) => {
    if (!data || index + direction < 0 || index + direction >= data.habits.length) return
    const habits = [...data.habits]; [habits[index], habits[index + direction]] = [habits[index + direction], habits[index]]; update({ ...data, habits })
  }
  const loading = loadError ? <div className="settings-card"><h2>Could not load habits</h2><p>Check your connection and that the habit database migration is installed. No local account data was loaded.</p><button className="outline-button" onClick={() => setAttempt(n => n + 1)}>Retry</button></div> : <p>Loading habits…</p>
  return <>
    {(status === 'error' || status === 'conflict') && <div role="alert" className="habit-save-error"><div className="auth-card"><h2>{status === 'conflict' ? 'Habits changed elsewhere' : 'Could not save habits'}</h2><p>Your edits are not confirmed. Keep this page open and export them before reloading. A reload can also discard unsaved workout changes.</p>{status === 'error' && <button className="primary" onClick={() => store?.retry()}>Retry habit save</button>} <button className="outline-button" onClick={exportData}>Export unsaved habits</button> <button className="outline-button" onClick={exportWorkout}>Export workouts</button> <button className="outline-button" onClick={() => { if (window.confirm('Discard ALL unsaved habit and workout changes and reload? Export both first.')) window.location.reload() }}>Discard and reload</button></div></div>}
    {status === 'saving' && <div role="status" className="habit-saving">Saving habits…</div>}
    <div hidden={view !== 'habits'} className="habit-app">
      {identity.demo && <p className="demo-example-note">Demo mode · Fictional sample habits. Changes reset when you refresh.</p>}
      {!data ? loading : <>
        <div className="page-heading habit-heading"><div><span className="habit-eyebrow">YOUR ROUTINES</span><h1>Habit Tracker<span className="accent">.</span></h1><p>A little progress, on your terms.</p></div></div>
        <nav className="workout-subnav habit-nav" aria-label="Habit Tracker"><button className={tab === 'today' ? 'active' : ''} onClick={() => switchTab('today')}>Daily</button><button className={tab === 'week' ? 'active' : ''} onClick={() => switchTab('week')}>Week</button><button className={tab === 'insights' ? 'active' : ''} onClick={() => switchTab('insights')}>Insights</button><button className={tab === 'manage' ? 'active' : ''} onClick={() => switchTab('manage')}>Habits</button></nav>
        {message && <p role="status">{message}</p>}
        {undo && <div className="habit-undo"><span>Change made</span><button className="text-button" onClick={() => { update(undo, false); setUndo(null) }}>Undo last update</button><button className="text-button" aria-label="Dismiss undo" onClick={() => setUndo(null)}>×</button></div>}
        {editing ? <HabitForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onSave={saveHabit} onCancel={() => setEditing(null)}/> : <>
          {(tab === 'today' || tab === 'week') && <div className="habit-date"><button className="outline-button" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">←</button><label>Date <input type="date" value={date} max={localDate()} onChange={event => { if (event.target.value && event.target.value <= localDate()) setDate(event.target.value) }}/></label><button className="outline-button" disabled={date >= localDate()} onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">→</button>{date !== localDate() && <button className="text-button" onClick={() => setDate(localDate())}>Today</button>}</div>}
          {tab === 'today' && <>
            <section className="habit-daily-summary" aria-label="Fixed habit daily summary"><div><span className="habit-eyebrow">DAILY CHECK-IN</span><h2>{date === localDate() ? 'Today' : date}</h2><p>{(() => { const score = fixedScore(data, date, date); return score.due ? `${score.done + score.partial + score.missed + score.skipped} of ${score.due} fixed habits logged` : 'No fixed habits due' })()}</p></div><span>Flexible habits<br/>track weekly progress</span></section>
            {(() => { const pending = Array.from({ length: 7 }, (_, i) => shiftDate(localDate(), -i - 1)).filter(day => data.habits.some(habit => eligible(habit, day) && versionAt(habit.schedules, day)?.kind === 'fixed' && !entry(habit.id, day))); return pending.length > 0 && <button className="outline-button" onClick={() => setDate(pending[0])}>Catch up: {pending.length} earlier {pending.length === 1 ? 'day' : 'days'} with unlogged habits</button> })()}
            {data.habits.filter(habit => (!habit.archived && eligible(habit, date)) || entry(habit.id, date)).map(habit => {
              const record = entry(habit.id, date); const schedule = versionAt(habit.schedules, date); const criteria = versionAt(habit.criteria, date); const progress = weekProgress(habit, data.entries, date)
              return <article className={`habit-card habit-daily-card ${record ? `is-${record.outcome}` : ''}`} key={habit.id}><button className="habit-row" aria-expanded={expanded === habit.id} onClick={() => setExpanded(expanded === habit.id ? null : habit.id)}><span className="habit-row-main"><strong>{habit.title}</strong><small>{!eligible(habit, date) ? 'Not scheduled · recorded' : schedule?.kind === 'flexible' ? `Flexible · ${progress.points} / ${progress.target} this week${progress.affected ? ' · target not judged' : ''}` : 'Fixed · scheduled'}</small></span><span className={`habit-status ${record ? `status-${record.outcome}` : ''}`}>{record ? cap(record.outcome) : 'Not logged'} <span aria-hidden="true">{expanded === habit.id ? '−' : '+'}</span></span></button>{expanded === habit.id && <div className="habit-details">{habit.description && <p>{habit.description}</p>}{schedule?.kind === 'flexible' && <p className="habit-detail-hint">{progress.targetSoFar} expected by this day{progress.affected ? ' · This week is not judged because of a pause or skip.' : '.'}</p>}<p className="habit-detail-label">{record ? 'Change outcome' : 'How did it go?'}</p><div className="habit-outcomes">{outcomes.map(outcome => <button key={outcome} aria-pressed={record?.outcome === outcome} className={record?.outcome === outcome ? `selected outcome-${outcome}` : ''} onClick={() => setOutcome(habit.id, date, outcome)}>{cap(outcome)}</button>)}</div>{criteria && (criteria.done || criteria.partial || criteria.missed) && <details className="habit-criteria" open><summary>Outcome criteria</summary><dl>{(['done', 'partial', 'missed'] as const).map(key => criteria[key] && <div key={key}><dt>{cap(key)}</dt><dd>{criteria[key]}</dd></div>)}</dl></details>}{record && <><label>Note<textarea value={record.note} onFocus={() => { noteBeforeEdit.current = data }} onBlur={() => { noteBeforeEdit.current = null }} onChange={event => changeNote(record, event.target.value)}/></label><button className="text-button" onClick={() => setOutcome(habit.id, date, null)}>Clear outcome</button></>}</div>}</article>
            })}
            {!data.habits.some(habit => (!habit.archived && eligible(habit, date)) || entry(habit.id, date)) && <div className="habit-empty"><p>No habits scheduled for this date.</p>{data.habits.length === 0 && <button className="primary" onClick={() => { setTab('manage'); setEditing('new') }}>Create your first habit</button>}</div>}
            {data.habits.some(h => !h.archived && eligible(h, date) && !entry(h.id, date)) && <button className="outline-button habit-bulk" onClick={() => { if (!window.confirm('Mark all remaining eligible fixed and flexible habits on this date Done?')) return; const entries = [...data.entries]; for (const habit of data.habits) if (!habit.archived && eligible(habit, date) && !entry(habit.id, date)) entries.push({ habitId: habit.id, date, outcome: 'done', note: '' }); update({ ...data, entries }) }}>Mark remaining eligible habits Done</button>}
          </>}
          {tab === 'week' && <section className="habit-week-section"><div className="habit-week-heading"><div><span className="habit-eyebrow">WEEKLY CHECK-IN</span><h2>Week of {weekStart(date)}</h2></div><div className="habit-week-nav"><button className="outline-button" aria-label="Previous week" onClick={() => setDate(shiftDate(date, -7))}>←</button><button className="outline-button" aria-label="Next week" disabled={weekStart(date) >= weekStart(localDate())} onClick={() => setDate([shiftDate(date, 7), localDate()].sort()[0])}>→</button></div></div><p>Select a scheduled or recorded day to edit its outcome.</p>{data.habits.filter(habit => Array.from({ length: 7 }, (_, i) => shiftDate(weekStart(date), i)).some(day => (!habit.archived && eligible(habit, day)) || entry(habit.id, day))).map(habit => <div className="habit-card" key={habit.id}><strong>{habit.title}</strong><div className="habit-week">{labels.map((label, i) => { const day = shiftDate(weekStart(date), i); const record = entry(habit.id, day); const canEdit = Boolean(record) || (!habit.archived && eligible(habit, day)); return <button key={day} disabled={day > localDate() || !canEdit} aria-label={`${habit.title}, ${day}, ${record ? cap(record.outcome) : canEdit ? 'not logged' : 'not scheduled'}`} onClick={() => { setDate(day); setTab('today'); setExpanded(habit.id) }}>{label}<small>{record ? cap(record.outcome) : canEdit ? '—' : 'N/A'}</small></button> })}</div></div>)}</section>}
          {tab === 'insights' && <Insights data={data} onDate={(day, habitId) => { setDate(day); setTab('today'); setExpanded(habitId || null) }}/>}
          {tab === 'manage' && <><button className="primary" onClick={() => setEditing('new')}>Create habit</button> <button className="text-button" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Hide archived' : 'Show archived'}</button>{data.habits.map((habit, index) => (!habit.archived || showArchived) && <article className="habit-card" key={habit.id}><div className="habit-row"><span><strong>{habit.title}</strong><small>{habit.archived ? 'Archived' : paused(habit, localDate()) ? 'Paused' : habit.end && habit.end < localDate() ? 'Ended' : 'Active'}</small></span></div><div className="habit-actions"><button onClick={() => setEditing(habit)}>Edit</button><button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${habit.title} up`}>↑</button><button onClick={() => move(index, 1)} disabled={index === data.habits.length - 1} aria-label={`Move ${habit.title} down`}>↓</button></div><details className="habit-manage-more"><summary>More options</summary><div className="habit-actions"><button onClick={() => changeHabit({ ...habit, archived: !habit.archived })}>{habit.archived ? 'Unarchive' : 'Archive'}</button><button onClick={() => { if (window.confirm(`Permanently delete ${habit.title} and all its records?`)) update({ ...data, habits: data.habits.filter(item => item.id !== habit.id), entries: data.entries.filter(item => item.habitId !== habit.id) }) }}>Delete</button></div><PauseControls habit={habit} onChange={changeHabit}/></details></article>)}</>}
        </>}
      </>}
    </div>
    <div hidden={view !== 'settings'}>{data && <div className="settings-card"><h3>Habit backup</h3><p>Export or restore habits only. Workout data is not replaced.</p><div className="settings-actions"><button className="outline-button" onClick={exportData}>Export habits</button><label className="outline-button file-button">Restore habits<input type="file" accept="application/json,.json" onChange={event => { void restore(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}</div>
  </>
})

function PauseControls({ habit, onChange }: { habit: Habit; onChange: (habit: Habit) => void }) {
  const [until, setUntil] = useState('')
  const today = localDate()
  if (habit.start > today || (habit.end && habit.end < today)) return null
  if (paused(habit, today)) return <button className="text-button" onClick={() => onChange({ ...habit, pauses: habit.pauses.flatMap(p => p.start <= today && (!p.end || p.end >= today) ? p.start === today ? [] : [{ ...p, end: shiftDate(today, -1) }] : [p]) })}>Resume today</button>
  return <div className="habit-pause"><label>Pause through <input type="date" min={today} value={until} onChange={event => setUntil(event.target.value)}/></label><button onClick={() => { if (until && until < today) return; onChange({ ...habit, pauses: [...habit.pauses, { start: today, end: until || null }] }); setUntil('') }}>Pause {until ? 'through date' : 'indefinitely'}</button></div>
}

function HabitForm({ initial, onSave, onCancel }: { initial: Habit | null; onSave: (habit: Habit) => void; onCancel: () => void }) {
  const today = localDate()
  const [title, setTitle] = useState(initial?.title || '')
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
    const habit: Habit = { id: initial?.id || crypto.randomUUID(), title: title.trim(), description, start, end: end || null, archived: initial?.archived || false, pauses: initial?.pauses || [], schedules, criteria: allCriteria }
    onSave(habit)
  }
  return <form className="habit-form settings-card" onSubmit={submit}><h2>{initial ? 'Edit habit' : 'Create habit'}</h2><label>Title<input value={title} required onChange={event => setTitle(event.target.value)}/></label><label>Description<textarea value={description} onChange={event => setDescription(event.target.value)}/></label><label>Start date<input type="date" required value={start} onChange={event => setStart(event.target.value)}/></label><label>End date (optional)<input type="date" min={start} value={end} onChange={event => setEnd(event.target.value)}/></label>{initial && <p className="habit-form-help">Schedule and criteria changes apply from the date below. Earlier dates keep their previous settings.</p>}{initial && <label>Schedule and criteria effective from<input type="date" required min={start} max={end || undefined} value={effective} onChange={event => setEffective(event.target.value)}/></label>}<p className="habit-form-help">Choose when this habit is available. Flexible habits have a weekly target rather than being due every selected day.</p><label>Schedule<select value={kind} onChange={event => setKind(event.target.value as Schedule['kind'])}><option value="fixed">Fixed weekdays</option><option value="flexible">Flexible weekly target</option></select></label><fieldset><legend>{kind === 'fixed' ? 'Due weekdays' : 'Eligible weekdays'}</legend><div className="habit-weekdays">{labels.map((label, day) => <label key={label}><input type="checkbox" checked={days.includes(day)} onChange={event => setDays(event.target.checked ? [...days, day] : days.filter(item => item !== day))}/>{label}</label>)}</div></fieldset>{kind === 'flexible' && <label>Times per week<input type="number" min="1" max={days.length} value={target} onChange={event => setTarget(Number(event.target.value))}/></label>}<details><summary>Outcome criteria (optional)</summary><label>Done<textarea value={done} onChange={event => setDone(event.target.value)}/></label><label>Partial<textarea value={partial} onChange={event => setPartial(event.target.value)}/></label><label>Missed<textarea value={missed} onChange={event => setMissed(event.target.value)}/></label></details>{error && <p role="alert">{error}</p>}<div className="habit-actions"><button className="primary">Save habit</button><button type="button" className="outline-button" onClick={onCancel}>Cancel</button></div></form>
}
