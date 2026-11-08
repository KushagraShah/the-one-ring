import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useState } from 'react'
import { supabase } from '../auth'
import { eligible, indexEntries, localDate, parseHabits, paused, shiftDate, versionAt, weekProgress, weekStart, type Habit, type HabitData, type Outcome } from './model'
import { demoHabitData } from './demo'
import { OnlineHabitStore, type SaveStatus } from './online'
import { Insights } from './Insights'
import { CriteriaList, HabitForm, PauseControls } from './HabitComponents'
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
  const [draft, setDraft] = useState<{ habitId: string; date: string; outcome: Outcome | null; note: string; originalOutcome: Outcome | null; originalNote: string } | null>(null)
  const draftDirty = Boolean(draft && (draft.outcome !== draft.originalOutcome || draft.note !== draft.originalNote))
  const [showArchived, setShowArchived] = useState(false)
  const [message, setMessage] = useState('')
  const entryIndex = useMemo(() => indexEntries(data?.entries || []), [data?.entries])
  const discardDraft = () => { if (draftDirty && !window.confirm('Discard unsaved outcome changes?')) return false; setDraft(null); setExpanded(null); return true }
  const changeDate = (next: string) => { if (next !== date && discardDraft()) setDate(next) }
  const switchTab = (next: typeof tab) => { if (next === tab) return; if (editing && !window.confirm('Discard unsaved habit changes?')) return; if (!discardDraft()) return; setTab(next); setEditing(null) }

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
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (status !== 'saved' || draftDirty || editing) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [status, draftDirty, editing])
  const update = (next: HabitData) => {
    const validated = parseHabits(JSON.stringify(next))
    setData(validated); store?.update(validated)
  }
  useImperativeHandle(ref, () => ({ canSignOut: () => status === 'saved' && !editing && !draftDirty, leave: done => { if (editing && !window.confirm('Discard unsaved habit changes?')) return; if (!discardDraft()) return; setEditing(null); done() }, snapshot: () => data, exportData, replace: next => update(next) }))
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
  const entry = (habitId: string, day: string) => entryIndex.byHabitDate.get(habitId)?.get(day)
  const openEntry = (habitId: string, day: string) => {
    if (!discardDraft()) return
    const record = entry(habitId, day)
    setDate(day); setExpanded(habitId)
    setDraft({ habitId, date: day, outcome: record?.outcome || null, note: record?.note || '', originalOutcome: record?.outcome || null, originalNote: record?.note || '' })
  }
  const saveEntry = () => {
    if (!data || !draft || draft.date > localDate()) return
    const habit = data.habits.find(item => item.id === draft.habitId)
    if (!habit || (draft.outcome && !entry(draft.habitId, draft.date) && !eligible(habit, draft.date))) return
    const entries = data.entries.filter(item => item.habitId !== draft.habitId || item.date !== draft.date)
    if (draft.outcome) entries.push({ habitId: draft.habitId, date: draft.date, outcome: draft.outcome, note: draft.note })
    update({ ...data, entries }); setDraft(null); setExpanded(null)
  }
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
        {editing ? <HabitForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onSave={saveHabit} onCancel={() => setEditing(null)}/> : <>
          {(tab === 'today' || tab === 'week') && <div className="habit-date"><button className="outline-button" onClick={() => changeDate(shiftDate(date, -1))} aria-label="Previous day">←</button><label>Date <input type="date" value={date} max={localDate()} onChange={event => { if (event.target.value && event.target.value <= localDate()) changeDate(event.target.value) }}/></label><button className="outline-button" disabled={date >= localDate()} onClick={() => changeDate(shiftDate(date, 1))} aria-label="Next day">→</button>{date !== localDate() && <button className="text-button" onClick={() => changeDate(localDate())}>Today</button>}</div>}
          {tab === 'today' && <>
            <section className="habit-daily-summary" aria-label="Fixed habit daily summary"><div><span className="habit-eyebrow">DAILY CHECK-IN</span><h2>{date === localDate() ? 'Today' : date}</h2><p>{(() => { const score = fixedScore(data, date, date, entryIndex); return score.due ? `${score.done + score.partial + score.missed + score.skipped} of ${score.due} fixed habits logged` : 'No fixed habits due' })()}</p></div><span>Flexible habits<br/>track weekly progress</span></section>
            {(() => { const pending = Array.from({ length: 7 }, (_, i) => shiftDate(localDate(), -i - 1)).filter(day => data.habits.some(habit => eligible(habit, day) && versionAt(habit.schedules, day)?.kind === 'fixed' && !entry(habit.id, day))); return pending.length > 0 && <button className="outline-button" onClick={() => changeDate(pending[0])}>Catch up: {pending.length} earlier {pending.length === 1 ? 'day' : 'days'} with unlogged habits</button> })()}
            {data.habits.filter(habit => (!habit.archived && eligible(habit, date)) || entry(habit.id, date)).map(habit => {
              const record = entry(habit.id, date); const schedule = versionAt(habit.schedules, date); const criteria = versionAt(habit.criteria, date); const progress = weekProgress(habit, entryIndex.byHabit.get(habit.id) || [], date)
              return <article className={`habit-card habit-daily-card ${record ? `is-${record.outcome}` : ''}`} key={habit.id}>
                <button className="habit-row" aria-expanded={expanded === habit.id} onClick={() => expanded === habit.id ? discardDraft() : openEntry(habit.id, date)}><span className="habit-row-main"><strong>{habit.title}</strong><small>{!eligible(habit, date) ? 'Not scheduled · recorded' : schedule?.kind === 'flexible' ? `Flexible · ${progress.points} / ${progress.target} this week${progress.affected ? ' · target not judged' : ''}` : 'Fixed · scheduled'}</small></span><span className={`habit-status ${record ? `status-${record.outcome}` : ''}`}>{record ? cap(record.outcome) : 'Not logged'} <span aria-hidden="true">{expanded === habit.id ? '−' : '+'}</span></span></button>
                {expanded === habit.id && draft?.habitId === habit.id && <div className="habit-details">{habit.description && <p>{habit.description}</p>}{schedule?.kind === 'flexible' && <p className="habit-detail-hint">{progress.targetSoFar} expected by this day{progress.affected ? ' · This week is not judged because of a pause or skip.' : '.'}</p>}<p className="habit-detail-label">{record ? 'Change outcome' : 'How did it go?'}</p><div className="habit-outcomes">{outcomes.map(outcome => <button key={outcome} aria-pressed={draft.outcome === outcome} className={draft.outcome === outcome ? `selected outcome-${outcome}` : ''} onClick={() => setDraft({ ...draft, outcome })}>{cap(outcome)}</button>)}</div><CriteriaList criteria={criteria}/>{draft.outcome && <label>Note<textarea value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })}/></label>}<div className="habit-entry-actions"><button className="primary" disabled={!draftDirty} onClick={saveEntry}>Save changes</button><button className="outline-button" onClick={() => { setDraft(null); setExpanded(null) }}>Cancel</button>{record && <button className="text-button" onClick={() => setDraft({ ...draft, outcome: null, note: '' })}>Clear outcome and note</button>}</div>{record && !draft.outcome && <p className="habit-detail-hint">Save changes to clear this outcome and its note.</p>}</div>}
              </article>
            })}
            {!data.habits.some(habit => (!habit.archived && eligible(habit, date)) || entry(habit.id, date)) && <div className="habit-empty"><p>No habits scheduled for this date.</p>{data.habits.length === 0 && <button className="primary" onClick={() => { setTab('manage'); setEditing('new') }}>Create your first habit</button>}</div>}
            {data.habits.some(h => !h.archived && eligible(h, date) && !entry(h.id, date)) && <button className="outline-button habit-bulk" onClick={() => { if (!discardDraft()) return; if (!window.confirm('Mark all remaining eligible fixed and flexible habits on this date Done?')) return; const entries = [...data.entries]; for (const habit of data.habits) if (!habit.archived && eligible(habit, date) && !entry(habit.id, date)) entries.push({ habitId: habit.id, date, outcome: 'done', note: '' }); update({ ...data, entries }) }}>Mark remaining eligible habits Done</button>}
          </>}
          {tab === 'week' && <section className="habit-week-section"><div className="habit-week-heading"><div><span className="habit-eyebrow">WEEKLY CHECK-IN</span><h2>Week of {weekStart(date)}</h2></div><div className="habit-week-nav"><button className="outline-button" aria-label="Previous week" onClick={() => changeDate(shiftDate(date, -7))}>←</button><button className="outline-button" aria-label="Next week" disabled={weekStart(date) >= weekStart(localDate())} onClick={() => changeDate([shiftDate(date, 7), localDate()].sort()[0])}>→</button></div></div><p>Select a scheduled or recorded day to edit its outcome.</p>{data.habits.filter(habit => Array.from({ length: 7 }, (_, i) => shiftDate(weekStart(date), i)).some(day => (!habit.archived && eligible(habit, day)) || entry(habit.id, day))).map(habit => <div className="habit-card" key={habit.id}><strong>{habit.title}</strong><div className="habit-week">{labels.map((label, i) => { const day = shiftDate(weekStart(date), i); const record = entry(habit.id, day); const canEdit = Boolean(record) || (!habit.archived && eligible(habit, day)); return <button key={day} disabled={day > localDate() || !canEdit} aria-label={`${habit.title}, ${day}, ${record ? cap(record.outcome) : canEdit ? 'not logged' : 'not scheduled'}`} onClick={() => { openEntry(habit.id, day); setTab('today') }}>{label}<small>{record ? cap(record.outcome) : canEdit ? '—' : 'N/A'}</small></button> })}</div></div>)}</section>}
          {tab === 'insights' && <Insights data={data} onDate={(day, habitId) => { if (habitId) openEntry(habitId, day); else changeDate(day); setTab('today') }}/>}
          {tab === 'manage' && <><button className="primary" onClick={() => setEditing('new')}>Create habit</button> <button className="text-button" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Hide archived' : 'Show archived'}</button>{data.habits.map((habit, index) => (!habit.archived || showArchived) && <article className="habit-card" key={habit.id}><div className="habit-manage-heading"><span><strong>{habit.title}</strong><small>{habit.archived ? 'Archived' : paused(habit, localDate()) ? 'Paused' : habit.end && habit.end < localDate() ? 'Ended' : 'Active'}</small></span></div><CriteriaList criteria={versionAt(habit.criteria, localDate())}/><div className="habit-actions"><button onClick={() => setEditing(habit)}>Edit</button><button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${habit.title} up`}>↑</button><button onClick={() => move(index, 1)} disabled={index === data.habits.length - 1} aria-label={`Move ${habit.title} down`}>↓</button></div><details className="habit-manage-more"><summary>More options</summary><div className="habit-actions"><button onClick={() => changeHabit({ ...habit, archived: !habit.archived })}>{habit.archived ? 'Unarchive' : 'Archive'}</button><button onClick={() => { if (window.confirm(`Permanently delete ${habit.title} and all its records?`)) update({ ...data, habits: data.habits.filter(item => item.id !== habit.id), entries: data.entries.filter(item => item.habitId !== habit.id) }) }}>Delete</button></div><PauseControls habit={habit} onChange={changeHabit}/></details></article>)}</>}
        </>}
      </>}
    </div>
    <div hidden={view !== 'settings'}>{data && <div className="settings-card"><h3>Habit backup</h3><p>Export or restore habits only. Workout data is not replaced.</p><div className="settings-actions"><button className="outline-button" onClick={exportData}>Export habits</button><label className="outline-button file-button">Restore habits<input type="file" accept="application/json,.json" onChange={event => { void restore(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}</div>
  </>
})
