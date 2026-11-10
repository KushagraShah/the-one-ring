import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, NotebookPen, RotateCcw } from 'lucide-react'
import { supabase } from '../auth'
import { catchUpDays, eligible, indexEntries, localDate, outcomeLabel, parseHabits, paused, shiftDate, versionAt, weekProgress, weekStart, type Habit, type HabitData, type Outcome } from './model'
import { demoHabitData } from './demo'
import { OnlineHabitStore, type SaveStatus } from './online'
import { Insights } from './Insights'
import { CriteriaList, EntryEditor, HabitForm, PauseControls, type HabitDraft } from './HabitComponents'
import { RecentHabitDays } from './RecentHabitDays'
import { HabitWeek } from './HabitWeek'
import { InfoTip } from '../InfoTip'
import { HabitPanel } from './HabitPanel'
import { fixedScore } from './insights'
import './habits.css'

type Identity = { id: string; demo: boolean }
type Props = { identity: Identity; view: string; exportWorkout: () => void }
export type HabitHandle = { canSignOut: () => boolean; leave: (done: () => void) => void; snapshot: () => HabitData | null; exportData: () => void; replace: (data: HabitData) => void }
const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const combineNotes = (recorded: string, retained: string) => recorded && retained && recorded !== retained ? `${recorded}\n\n${retained}` : recorded || retained
const scheduleSummary = (habit: Habit) => { const today = localDate(); const day = habit.end && habit.end < today ? habit.end : today < habit.start ? habit.start : today; const schedule = versionAt(habit.schedules, day); if (!schedule) return 'No schedule'; const weekdays = schedule.weekdays.length === 7 ? 'Every day' : schedule.weekdays.map(index => labels[index]).join(', '); return schedule.kind === 'flexible' ? `${schedule.target} / week · ${weekdays}` : weekdays }
function download(data: unknown, scope: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `one-ring-${scope}-${stamp}.json`; link.click(); URL.revokeObjectURL(url)
}

export const HabitApp = forwardRef<HabitHandle, Props>(function HabitApp({ identity, view, exportWorkout }, ref) {
  const [data, setData] = useState<HabitData | null>(() => identity.demo ? demoHabitData() : null)
  const dataRef = useRef(data)
  const [store, setStore] = useState<OnlineHabitStore | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [date, setDate] = useState(localDate)
  const [tab, setTab] = useState<'today' | 'manage' | 'week' | 'insights'>('today')
  const [returnToInsights, setReturnToInsights] = useState(false)
  const insightsScroll = useRef(0)
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [draft, setDraft] = useState<HabitDraft | null>(null)
  const draftRef = useRef<HabitDraft | null>(null)
  const setEntryDraft = (next: HabitDraft | null) => { draftRef.current = next; setDraft(next) }
  const draftDirty = Boolean(draft && (draft.outcome !== draft.originalOutcome || draft.note !== draft.originalNote))
  const [managed, setManaged] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [catchUpOpen, setCatchUpOpen] = useState(false)
  const [message, setMessage] = useState('')
  const entryIndex = useMemo(() => indexEntries(data?.entries || []), [data?.entries])
  const discardDraft = () => { const current = draftRef.current; if (current && current.note !== current.originalNote) saveNote(current.note); setEntryDraft(null); setExpanded(null); return true }
  const changeDate = (next: string) => { if (next !== date && discardDraft()) setDate(next) }
  const switchTab = (next: typeof tab) => { if (next === tab) return; if (editing && !window.confirm('Discard unsaved habit changes?')) return; if (!discardDraft()) return; setReturnToInsights(false); setTab(next); setEditing(null) }

  useEffect(() => {
    if (identity.demo) return
    if (!supabase) { setLoadError(true); return }
    let active = true
    const next = new OnlineHabitStore(supabase, identity.id)
    setLoadError(false)
    next.load().then(result => { if (active) { dataRef.current = result; setData(result); setStore(next) } }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [identity.id, identity.demo, attempt])
  useLayoutEffect(() => { if (!store) return; store.onStatus = setStatus; return () => { store.onStatus = () => {} } }, [store])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (status !== 'saved' || draftDirty || editing) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [status, draftDirty, editing])
  const update = (next: HabitData) => {
    const validated = parseHabits(JSON.stringify(next))
    dataRef.current = validated; setData(validated); store?.update(validated)
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
    if (!discardDraft()) return false
    const record = entry(habitId, day)
    setDate(day); setExpanded(habitId)
    const note = combineNotes(record?.note || '', dataRef.current?.unloggedNotes?.find(item => item.habitId === habitId && item.date === day)?.note || '')
    setEntryDraft({ habitId, date: day, outcome: record?.outcome || null, note, originalOutcome: record?.outcome || null, originalNote: note })
    return true
  }
  const saveNote = (note: string) => {
    const current = draftRef.current; const workspace = dataRef.current
    if (!current || !workspace || current.date > localDate()) return
    const previous = workspace.entries.find(item => item.habitId === current.habitId && item.date === current.date)
    if (current.originalNote === note) return
    const unloggedNotes = (workspace.unloggedNotes || []).filter(item => item.habitId !== current.habitId || item.date !== current.date)
    if (!previous && note) unloggedNotes.push({ habitId: current.habitId, date: current.date, note })
    update({ ...workspace, entries: previous ? workspace.entries.map(item => item === previous ? { ...item, note } : item) : workspace.entries, unloggedNotes })
    setEntryDraft({ ...current, note, originalNote: note })
  }
  const saveOutcome = (habitId: string, day: string, outcome: Outcome | null) => {
    const workspace = dataRef.current; const current = draftRef.current
    if (!workspace || day > localDate()) return
    const habit = workspace.habits.find(item => item.id === habitId)
    const previous = workspace.entries.find(item => item.habitId === habitId && item.date === day)
    if (!habit || (outcome && !previous && !eligible(habit, day))) return
    const entries = workspace.entries.filter(item => item.habitId !== habitId || item.date !== day)
    const savedNote = workspace.unloggedNotes?.find(item => item.habitId === habitId && item.date === day)?.note || ''
    const note = current?.habitId === habitId && current.date === day ? current.note : combineNotes(previous?.note || '', savedNote)
    const unloggedNotes = (workspace.unloggedNotes || []).filter(item => item.habitId !== habitId || item.date !== day)
    if (outcome) entries.push({ habitId, date: day, outcome, note })
    else if (note) unloggedNotes.push({ habitId, date: day, note })
    update({ ...workspace, entries, unloggedNotes }); setEntryDraft(null); setExpanded(null)
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
        <div className="page-heading habit-heading"><div><span className="habit-eyebrow">YOUR ROUTINES</span><h1>Habit Tracker<span className="accent">.</span></h1></div></div>
        <nav className="workout-subnav habit-nav" aria-label="Habit Tracker"><button className={tab === 'today' ? 'active' : ''} onClick={() => switchTab('today')}>Daily</button><button className={tab === 'week' ? 'active' : ''} onClick={() => switchTab('week')}>Week</button><button className={tab === 'insights' ? 'active' : ''} onClick={() => switchTab('insights')}>Insights</button><button className={tab === 'manage' ? 'active' : ''} onClick={() => switchTab('manage')}>Habits</button></nav>
        {message && <p role="status">{message}</p>}
        {editing ? <HabitForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onSave={saveHabit} onCancel={() => setEditing(null)}/> : <>
          {(tab === 'today' || tab === 'week') && <div className="habit-date-picker"><div className="habit-date"><button className="outline-button" onClick={() => changeDate(shiftDate(date, -1))} aria-label="Previous day">←</button><label>Date <input type="date" value={date} max={localDate()} onChange={event => { if (event.target.value && event.target.value <= localDate()) changeDate(event.target.value) }}/></label><button className="outline-button" disabled={date >= localDate()} onClick={() => changeDate(shiftDate(date, 1))} aria-label="Next day">→</button><button className="habit-today-button" disabled={date === localDate()} onClick={() => changeDate(localDate())}>Today</button></div>{tab === 'today' && <div className="habit-date-strip" aria-label="Dates in selected week">{Array.from({ length: 7 }, (_, i) => shiftDate(weekStart(date), i)).map(day => <button key={day} aria-label={day} aria-current={day === date ? 'date' : undefined} disabled={day > localDate()} onClick={() => changeDate(day)}><span>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>{Number(day.slice(8))}</strong></button>)}</div>}</div>}
          {tab === 'today' && <>
            {returnToInsights && <button className="text-button habit-insights-back" onClick={() => { if (discardDraft()) { setReturnToInsights(false); setTab('insights'); requestAnimationFrame(() => window.scrollTo(0, insightsScroll.current)) } }}>← Back to insights</button>}
            <section className="habit-daily-summary" aria-label="Fixed habit daily summary">{(() => { const score = fixedScore(data, date, date, entryIndex); return <><div><h2>{date === localDate() ? 'Today' : date}</h2><p>{score.due ? `${score.done + score.partial + score.missed} of ${score.due} fixed habits logged` : 'No fixed habits due'} <InfoTip label="About logging habits">Tap an outcome to log it; tap it again to unlog. Notes are kept. Intentional skip pauses the habit for the day and excludes flexible weeks from target judgment.</InfoTip></p></div><div className="habit-daily-score"><strong>{score.performance === null ? '—' : `${Math.round(score.performance * 100)}%`}</strong><span>Fixed score <InfoTip label="About the fixed score">Done counts as 1, Partial as ½, Missed as 0. The score is points divided by recorded Done, Partial and Missed outcomes. Intentional skips are one-day pauses, excluded from score and coverage; unlogged days are not missed. Flexible habits track weekly progress separately.</InfoTip></span></div></> })()}</section>
            {(() => { const pending = catchUpDays(data, localDate()); return pending.length > 0 && <section className="habit-catchup"><button className="habit-catchup-toggle" aria-expanded={catchUpOpen} onClick={() => setCatchUpOpen(value => !value)}><span><strong>Catch up</strong><small>{pending.length} {pending.length === 1 ? 'day' : 'days'} with unlogged fixed habits · last 7 days</small></span><span aria-hidden="true">{catchUpOpen ? '−' : '+'}</span></button>{catchUpOpen && <div className="habit-catchup-list">{pending.map(day => <button key={day.date} onClick={() => { changeDate(day.date); setCatchUpOpen(false) }}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span>{day.count} not logged <span aria-hidden="true">→</span></span></button>)}</div>}</section> })()}
            {data.habits.filter(habit => (!habit.archived && eligible(habit, date)) || entry(habit.id, date)).map(habit => {
              const record = entry(habit.id, date); const schedule = versionAt(habit.schedules, date); const progress = weekProgress(habit, entryIndex.byHabit.get(habit.id) || [], date)
              return <article className={`habit-card habit-daily-card ${record ? `is-${record.outcome}` : ''}`} key={habit.id}>
                <div className="habit-row habit-card-heading"><span className="habit-row-main"><strong><span aria-hidden="true">{habit.icon || '◈'}</span> {habit.title}</strong><small>{!eligible(habit, date) ? 'Not scheduled · recorded' : schedule?.kind === 'flexible' ? `Flexible · ${progress.points} / ${progress.target} through this day${progress.affected ? ' · target not judged' : ''}` : 'Fixed · scheduled'}</small></span></div>
                {(eligible(habit, date) || record) && <div className="habit-inline-outcomes" aria-label={`Quick outcomes for ${habit.title}`}>{(['done', 'partial', 'missed', 'skipped'] as const).map((outcome, index) => <button key={outcome} type="button" className={`habit-choice-${outcome}`} aria-label={outcome === 'skipped' ? `Intentional skip ${habit.title}` : `${outcomeLabel(habit, date, outcome)} · ${habit.title}`} aria-describedby={`quick-${habit.id}-${outcome}`} aria-pressed={record?.outcome === outcome} onClick={() => { if (discardDraft()) saveOutcome(habit.id, date, record?.outcome === outcome ? null : outcome) }}><span>{outcome === 'skipped' ? '⏭' : outcomeLabel(habit, date, outcome)}</span><small id={`quick-${habit.id}-${outcome}`}>{['Done · 1 point', 'Partial · ½ point', 'Missed · 0 points', 'Skip'][index]}</small></button>)}</div>}
                {expanded === habit.id && draft?.habitId === habit.id && <div className="habit-inline-note"><label>Note<textarea value={draft.note} onChange={event => setEntryDraft({ ...draft, note: event.target.value })} onBlur={event => saveNote(event.target.value)}/></label></div>}
                <div className="habit-card-footer"><button className="habit-note-button" type="button" onClick={() => expanded === habit.id ? discardDraft() : openEntry(habit.id, date)}><NotebookPen size={15} aria-hidden="true"/>{expanded === habit.id ? 'Close note' : record?.note || data.unloggedNotes?.some(item => item.habitId === habit.id && item.date === date) ? 'Edit note' : 'Add note'}</button>
                <RecentHabitDays habit={habit} date={date} entries={entryIndex.byHabitDate.get(habit.id)}/></div>
              </article>
            })}
            {!data.habits.some(habit => (!habit.archived && eligible(habit, date)) || entry(habit.id, date)) && <div className="habit-empty"><p>No habits scheduled for this date.</p>{data.habits.length === 0 && <button className="primary" onClick={() => { setTab('manage'); setEditing('new') }}>Create your first habit</button>}</div>}
            {data.habits.some(h => !h.archived && eligible(h, date) && !entry(h.id, date)) && <button className="outline-button habit-bulk" onClick={() => { if (!discardDraft()) return; if (!window.confirm('Mark all remaining eligible fixed and flexible habits on this date Done?')) return; const entries = [...data.entries]; for (const habit of data.habits) if (!habit.archived && eligible(habit, date) && !entry(habit.id, date)) entries.push({ habitId: habit.id, date, outcome: 'done', note: data.unloggedNotes?.find(item => item.habitId === habit.id && item.date === date)?.note || '' }); update({ ...data, entries, unloggedNotes: data.unloggedNotes?.filter(item => !(item.date === date && data.habits.some(habit => habit.id === item.habitId && !habit.archived && eligible(habit, date) && !entry(habit.id, date)))) }) }}>Mark remaining eligible habits Done</button>}
          </>}
          {tab === 'week' && <HabitWeek date={date} habits={data.habits} entries={entryIndex.byHabitDate} selected={draft} onDate={changeDate} onSelect={(habitId, day) => { openEntry(habitId, day) }} editor={habit => expanded === habit.id && draft?.habitId === habit.id && status !== 'error' && status !== 'conflict' ? <HabitPanel title={`${habit.icon || '◈'} ${habit.title} · ${draft.date}`} onClose={() => { discardDraft() }}><EntryEditor habit={habit} draft={draft} onChange={setEntryDraft} onNoteBlur={saveNote} onOutcome={outcome => saveOutcome(habit.id, draft.date, outcome)}/></HabitPanel> : null}/>}

          <div hidden={tab !== 'insights'}><Insights data={data} active={tab === 'insights' && view === 'habits' && status !== 'error' && status !== 'conflict'} onDate={(day, habitId) => { if (habitId ? openEntry(habitId, day) : (changeDate(day), true)) { insightsScroll.current = window.scrollY; setReturnToInsights(true); setTab('today') } }}/></div>
          {tab === 'manage' && <><div className="habit-manage-toolbar"><button className="primary" onClick={() => setEditing('new')}>Create habit</button><button className="text-button" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Hide archived' : 'Show archived'}</button></div>{data.habits.map(habit => (!habit.archived || showArchived) && <button className="habit-manage-row" key={habit.id} onClick={() => setManaged(habit.id)}><span className="habit-icon" aria-hidden="true">{habit.icon || '◈'}</span><span><strong>{habit.title}</strong><small>{habit.archived ? 'Archived' : paused(habit, localDate()) ? 'Paused' : habit.end && habit.end < localDate() ? 'Ended' : 'Active'} · {scheduleSummary(habit)}</small></span><span aria-hidden="true">›</span></button>)}{managed && status !== 'error' && status !== 'conflict' && (() => { const habit = data.habits.find(item => item.id === managed); if (!habit) return null; const index = data.habits.indexOf(habit); return <HabitPanel title={`${habit.icon || '◈'} ${habit.title}`} onClose={() => setManaged(null)}><p>{scheduleSummary(habit)}</p><CriteriaList criteria={versionAt(habit.criteria, localDate())}/><div className="habit-actions"><button onClick={() => { setManaged(null); setEditing(habit) }}>Edit habit</button><button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${habit.title} up`}>↑</button><button onClick={() => move(index, 1)} disabled={index === data.habits.length - 1} aria-label={`Move ${habit.title} down`}>↓</button></div><PauseControls habit={habit} onChange={changeHabit}/><div className="habit-actions"><button onClick={() => changeHabit({ ...habit, archived: !habit.archived })}>{habit.archived ? 'Unarchive' : 'Archive'}</button><button onClick={() => { if (window.confirm(`Permanently delete ${habit.title} and all its records?`)) { update({ ...data, habits: data.habits.filter(item => item.id !== habit.id), entries: data.entries.filter(item => item.habitId !== habit.id), unloggedNotes: data.unloggedNotes?.filter(item => item.habitId !== habit.id) }); setManaged(null) } }}>Delete</button></div></HabitPanel> })()}</>}
        </>}
      </>}
    </div>
    <div hidden={view !== 'settings'}>{data && <div className="settings-card backup-card"><h3>Habit backup</h3><p>Export or restore habits only. Workout data is not replaced.</p><div className="settings-actions"><button className="outline-button" onClick={exportData}><ArrowDownToLine size={16} aria-hidden="true"/> Export habits</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore habits<input type="file" accept="application/json,.json" onChange={event => { void restore(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}</div>
  </>
})
