import { useScopedConfirm, showMessage } from '../AppDialog'
import { DetailView } from '../DetailView'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, NotebookPen, RotateCcw, X } from 'lucide-react'
import { supabase } from '../auth'
import { catchUpDays, eligible, indexEntries, localDate, outcomeLabel, parseHabits, paused, shiftDate, versionAt, weekProgress, type Habit, type HabitData, type Outcome } from './model'
import { demoHabitData } from './demo'
import { OnlineHabitStore, type SaveStatus } from './online'
import { Insights } from './Insights'
import { CriteriaList, EntryEditor, HabitForm, PauseControls, type HabitDraft } from './HabitComponents'
import { RecentHabitDays } from './RecentHabitDays'
import { HabitWeek } from './HabitWeek'
import { InfoTip } from '../InfoTip'
import { HabitPanel } from './HabitPanel'
import { fixedScore, habitStreak } from './insights'
import { automaticDailyDate, nextDailyBoundary } from './dailyDate'
import { BACKUP_FILE_LIMIT } from '../backupLimits'
import { useDraftCapture } from '../app/DraftCapture'
import './habits.css'

function HabitFormDialog({ initial, onSave, onClose, saving }: { initial: Habit | null; onSave: (habit: Habit) => void; onClose: () => void; saving: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const confirmAction = useScopedConfirm()
  useEffect(() => { dialog.current?.showModal() }, [])
  const close = async () => { if (!saving && await confirmAction('Discard unsaved habit changes?')) onClose() }
  return <dialog ref={dialog} className="habit-form-dialog" aria-label={initial ? 'Edit habit' : 'Create habit'} onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); void close() }} onClick={event => { if (event.target === event.currentTarget) void close() }}><HabitForm initial={initial} onSave={onSave} onCancel={onClose} saving={saving}/></dialog>
}

type Identity = { id: string; demo: boolean }
type Props = { identity: Identity; view: string; onStatus: (status: SaveStatus) => void }
export type HabitHandle = { canSignOut: () => boolean; isRecoveryBlocked: () => boolean; leave: (done: () => void) => void; snapshot: () => HabitData | null; exportData: () => void; replace: (data: HabitData) => void; retry: () => void }
const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const combineNotes = (recorded: string, retained: string) => recorded && retained && recorded !== retained ? `${recorded}\n\n${retained}` : recorded || retained
const scheduleSummary = (habit: Habit) => { const today = localDate(); const day = habit.end && habit.end < today ? habit.end : today < habit.start ? habit.start : today; const schedule = versionAt(habit.schedules, day); if (!schedule) return 'No schedule'; const weekdays = schedule.weekdays.length === 7 ? 'Every day' : schedule.weekdays.map(index => labels[index]).join(', '); return schedule.kind === 'flexible' ? `${schedule.target} / week · ${weekdays}` : weekdays }
function download(data: unknown, scope: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `one-ring-${scope}-${stamp}.json`; link.click(); URL.revokeObjectURL(url)
}

export const HabitApp = forwardRef<HabitHandle, Props>(function HabitApp({ identity, view, onStatus }, ref) {
  const confirmAction = useScopedConfirm()
  const [data, setData] = useState<HabitData | null>(() => identity.demo ? demoHabitData() : null)
  const dataRef = useRef(data)
  const [store, setStore] = useState<OnlineHabitStore | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [date, setDate] = useState(automaticDailyDate)
  const automatic = useRef(true)
  const rolloverPending = useRef(false)
  const noteSavePending = useRef(false)
  const resyncRef = useRef<() => void>(() => {})
  const [, setClockRevision] = useState(0)
  const [tab, setTab] = useState<'today' | 'manage' | 'week' | 'insights'>('today')
  const [returnToInsights, setReturnToInsights] = useState(false)
  const insightsScroll = useRef(0)
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const formSaving = useRef(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [draft, setDraft] = useState<HabitDraft | null>(null)
  const draftRef = useRef<HabitDraft | null>(null)
  const setEntryDraft = (next: HabitDraft | null) => { draftRef.current = next; setDraft(next) }
  const draftDirty = Boolean(draft && (draft.outcome !== draft.originalOutcome || draft.note !== draft.originalNote))
  useDraftCapture('habit-entry', draft, draftDirty)
  const [managed, setManaged] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [message, setMessage] = useState('')
  const entryIndex = useMemo(() => indexEntries(data?.entries || []), [data?.entries])
  const discardDraft = () => { const current = draftRef.current; if (current && current.note !== current.originalNote && !saveNote(current.note)) return false; setEntryDraft(null); setExpanded(null); return true }
  const changeDate = (next: string) => {
    if (next !== date && !discardDraft()) return false
    automatic.current = next === localDate()
    rolloverPending.current = false
    setDate(next)
    return true
  }
  resyncRef.current = () => {
    setClockRevision(value => value + 1)
    if (tab !== 'today') { rolloverPending.current = false; return }
    const next = automaticDailyDate()
    if (!automatic.current || next === date) { rolloverPending.current = false; return }
    rolloverPending.current = true
    const current = draftRef.current
    if (current && current.note !== current.originalNote && !saveNote(current.note)) return
    if ((current || noteSavePending.current) && store && store.getStatus() !== 'saved') return
    if (discardDraft()) { rolloverPending.current = false; setDate(next) }
  }
  const switchTab = async (next: typeof tab) => { if (next === tab) return; if (editing && !await confirmAction('Discard unsaved habit changes?')) return; if (!discardDraft()) return; if (next === 'week' && automatic.current) { rolloverPending.current = false; setDate(localDate()) } setReturnToInsights(false); setTab(next); setEditing(null) }

  useEffect(() => { if (tab === 'today') resyncRef.current() }, [tab])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { resyncRef.current(); schedule() }, nextDailyBoundary() + 20) }
    const foreground = () => { if (document.visibilityState === 'visible') { resyncRef.current(); schedule() } }
    schedule()
    document.addEventListener('visibilitychange', foreground)
    window.addEventListener('focus', foreground)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', foreground); window.removeEventListener('focus', foreground) }
  }, [])
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
  useEffect(() => { if (status === 'saved') { noteSavePending.current = false; if (rolloverPending.current) resyncRef.current(); if (formSaving.current) { formSaving.current = false; setEditing(null) } } }, [status])
  useLayoutEffect(() => { onStatus(status) }, [status, onStatus])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (status !== 'saved' || draftDirty || editing) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [status, draftDirty, editing])
  const update = (next: HabitData) => {
    if (store && (store.getStatus() === 'error' || store.getStatus() === 'conflict')) return false
    const validated = parseHabits(JSON.stringify(next))
    dataRef.current = validated; setData(validated); store?.update(validated)
    return true
  }
  const readyRef = useRef<() => boolean>(() => false)
  readyRef.current = () => !!dataRef.current && status === 'saved' && (!store || store.getStatus() === 'saved') && !editing && !draftDirty
  const recoveryBlocked = () => status === 'error' || status === 'conflict' || store?.getStatus() === 'error' || store?.getStatus() === 'conflict'
  useImperativeHandle(ref, () => ({ canSignOut: () => readyRef.current(), isRecoveryBlocked: recoveryBlocked, leave: async done => { if (formSaving.current && store?.getStatus() === 'saving') return; if (recoveryBlocked()) { done(); return } if (editing && !await confirmAction('Discard unsaved habit changes?')) return; if (!discardDraft()) return; setEditing(null); done() }, snapshot: () => dataRef.current, exportData, replace: next => update(next), retry: () => store?.retry() }))
  const exportData = () => { if (data) download({ scope: 'habits', format: 1, exportedAt: new Date().toISOString(), data }, 'habits') }
  const restore = async (file?: File) => {
    if (!file) return
    if (!readyRef.current()) { void showMessage('Finish habit edits and wait for saving before restoring.'); return }
    const baseline = JSON.stringify(dataRef.current)
    const unchanged = () => readyRef.current() && JSON.stringify(dataRef.current) === baseline
    try {
      if (file.size > BACKUP_FILE_LIMIT) throw new Error('Too large')
      const value = JSON.parse(await file.text())
      if (value.scope !== 'habits' || value.format !== 1) throw new Error('Wrong scope')
      const next = parseHabits(JSON.stringify(value.data))
      if (!unchanged()) { void showMessage('Habit data or edits changed while reading. Finish saving and try again.'); return }
      if (await confirmAction('Replace all habit data with this backup? Workout data will not change. Export current habits first.')) {
        if (!unchanged()) { void showMessage('Habit data or edits changed while confirming. Finish saving and try again.'); return }
        update(next); setMessage('Habit backup loaded. Wait for saving to finish.')
      }
    } catch { void showMessage('Unable to restore this habit backup. The file may be invalid or exceed the 200 MB file or 50 MB workspace limit. No habit data was replaced.') }
  }
  const entry = (habitId: string, day: string) => entryIndex.byHabitDate.get(habitId)?.get(day)
  const openEntry = (habitId: string, day: string, manual = true) => {
    if (!discardDraft()) return false
    const record = entry(habitId, day)
    if (manual) { automatic.current = day === localDate(); rolloverPending.current = false }
    setDate(day); setExpanded(habitId)
    const note = combineNotes(record?.note || '', dataRef.current?.unloggedNotes?.find(item => item.habitId === habitId && item.date === day)?.note || '')
    setEntryDraft({ habitId, date: day, outcome: record?.outcome || null, note, originalOutcome: record?.outcome || null, originalNote: note })
    return true
  }
  const saveNote = (note: string) => {
    const current = draftRef.current; const workspace = dataRef.current
    if (!current || !workspace || current.date > localDate()) return false
    const previous = workspace.entries.find(item => item.habitId === current.habitId && item.date === current.date)
    if (current.originalNote === note) return true
    const unloggedNotes = (workspace.unloggedNotes || []).filter(item => item.habitId !== current.habitId || item.date !== current.date)
    if (!previous && note) unloggedNotes.push({ habitId: current.habitId, date: current.date, note })
    if (!update({ ...workspace, entries: previous ? workspace.entries.map(item => item === previous ? { ...item, note } : item) : workspace.entries, unloggedNotes })) return false
    if (store && store.getStatus() !== 'saved') noteSavePending.current = true
    setEntryDraft({ ...current, note, originalNote: note })
    return true
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
    if (update({ ...workspace, entries, unloggedNotes })) {
      if (current && current.habitId === habitId && current.date === day && current.note !== current.originalNote && store && store.getStatus() !== 'saved') noteSavePending.current = true
      setEntryDraft(null); setExpanded(null)
    }
  }
  const saveHabit = (habit: Habit) => {
    if (!data) return
    const exists = data.habits.some(item => item.id === habit.id)
    if (update({ ...data, habits: exists ? data.habits.map(item => item.id === habit.id ? habit : item) : [...data.habits, habit] })) { if (store && store.getStatus() !== 'saved') formSaving.current = true; else setEditing(null) }
  }
  const changeHabit = (habit: Habit) => { if (data) update({ ...data, habits: data.habits.map(item => item.id === habit.id ? habit : item) }) }
  const move = (index: number, direction: number) => {
    if (!data || index + direction < 0 || index + direction >= data.habits.length) return
    const habits = [...data.habits]; const visible = habits.map((habit, i) => habit.archived === habits[index].archived ? i : -1).filter(i => i >= 0); const other = visible[visible.indexOf(index) + direction]; if (other === undefined) return; [habits[index], habits[other]] = [habits[other], habits[index]]; update({ ...data, habits })
  }
  const loading = loadError ? <div className="settings-card"><h2>Could not load habits</h2><p>Check your connection and that the habit database migration is installed. No local account data was loaded.</p><button className="outline-button" onClick={() => setAttempt(n => n + 1)}>Retry</button></div> : <p>Loading habits…</p>
  return <>
    {status === 'saving' && <div role="status" className="habit-saving">Saving habits…</div>}
    <div hidden={view !== 'habits'} className="habit-app">
      {identity.demo && <p className="demo-example-note">Demo mode · Fictional sample habits. Changes reset when you refresh.</p>}
      {!data ? loading : <>
        <header className="page-heading habit-heading"><h1>Habit Tracker<span className="accent">.</span></h1></header>
        <nav className="workout-subnav habit-nav" aria-label="Habit Tracker"><button className={tab === 'today' ? 'active' : ''} onClick={() => switchTab('today')}>Daily</button><button className={tab === 'week' ? 'active' : ''} onClick={() => switchTab('week')}>Week</button><button className={tab === 'insights' ? 'active' : ''} onClick={() => switchTab('insights')}>Insights</button><button className={tab === 'manage' ? 'active' : ''} onClick={() => switchTab('manage')}>Habits</button></nav>
        {message && <p role="status">{message}</p>}
        {editing ? <HabitFormDialog key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onSave={saveHabit} onClose={() => setEditing(null)} saving={formSaving.current && status === 'saving'}/> : <>
          {(tab === 'today' || tab === 'week') && <div className="habit-date-picker"><div className="habit-date"><button className="outline-button" onClick={() => changeDate(shiftDate(date, -1))} aria-label="Previous day">←</button><label>Date <input type="date" value={date} max={localDate()} onChange={event => { if (event.target.value && event.target.value <= localDate()) changeDate(event.target.value) }}/></label><button className="outline-button" disabled={date >= localDate()} onClick={() => changeDate(shiftDate(date, 1))} aria-label="Next day">→</button><button className="habit-yesterday-button" onClick={() => changeDate(shiftDate(localDate(), -1))}>Yesterday</button><button className="habit-today-button" disabled={date === localDate()} onClick={() => { if (changeDate(localDate())) automatic.current = true }}>Today</button></div></div>}
          {tab === 'today' && <>
            {returnToInsights && <button className="text-button habit-insights-back" onClick={() => { if (discardDraft()) { setReturnToInsights(false); setTab('insights'); requestAnimationFrame(() => window.scrollTo(0, insightsScroll.current)) } }}>← Back to insights</button>}
            <section className="habit-daily-summary" aria-label="Fixed habit daily summary">{(() => { const score = fixedScore(data, date, date, entryIndex); return <><div><h2>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2><p>{score.due ? `${score.done + score.partial + score.missed} of ${score.due} fixed habits logged` : 'No fixed habits due'} <InfoTip label="About logging habits">Tap an outcome to log it; tap it again to unlog. Notes are kept. Intentional skip pauses the habit for the day and excludes flexible weeks from target judgment.</InfoTip></p></div><div className="habit-daily-score"><strong>{score.performance === null ? '—' : `${Math.round(score.performance * 100)}%`}</strong><span>Fixed score <InfoTip label="About the fixed score">Done counts as 1, Partial as ½, Missed as 0. The score is points divided by recorded Done, Partial and Missed outcomes. Intentional skips are one-day pauses, excluded from score and coverage; unlogged days are not missed. Flexible habits track weekly progress separately.</InfoTip></span></div></> })()}</section>
            {(() => { const pending = catchUpDays(data, localDate()); return pending.length > 0 && <section className="habit-catchup"><DetailView title="Catch up" trigger={<span><strong>Catch up</strong><small>{pending.length} {pending.length === 1 ? 'day' : 'days'} with unlogged fixed habits · last 7 days</small></span>} closeOnAction><div className="habit-catchup-list">{pending.map(day => <button key={day.date} onClick={() => changeDate(day.date)}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span>{day.count} not logged <span aria-hidden="true">→</span></span></button>)}</div></DetailView></section> })()}
            {data.habits.filter(habit => (!habit.archived && date >= habit.start && (!habit.end || date <= habit.end) && (eligible(habit, date) || versionAt(habit.schedules, date)?.kind === 'flexible')) || entry(habit.id, date) || data.unloggedNotes?.some(note => note.habitId === habit.id && note.date === date)).map(habit => {
              const record = entry(habit.id, date); const schedule = versionAt(habit.schedules, date); const progress = weekProgress(habit, entryIndex.byHabit.get(habit.id) || [], date); const streak = habit.archived ? null : habitStreak(habit, entryIndex.byHabit.get(habit.id) || [], localDate())
              return <article className={`habit-card habit-daily-card ${record ? `is-${record.outcome}` : ''}`} key={habit.id}>
                <div className="habit-row habit-card-heading"><span className="habit-row-main"><strong><span aria-hidden="true">{habit.icon || '◈'}</span> {habit.title}</strong><small>{schedule?.kind === 'flexible' ? `Weekly goal · ${progress.points} / ${progress.target} points · ${progress.points >= progress.target ? 'goal met so far' : 'in progress'} · ${schedule.weekdays.map(day => labels[day]).join(', ')} · ${eligible(habit, date) ? 'eligible today' : record ? 'not eligible · recorded' : 'not eligible today'}${progress.affected ? ` · not judged: ${progress.reason}` : ''}` : !eligible(habit, date) ? 'Not scheduled · recorded' : 'Fixed · scheduled'}</small><small>{record ? record.outcome === 'skipped' ? 'Intentional skip' : `${outcomeLabel(habit, date, record.outcome)} · ${record.outcome}` : 'Unlogged'}</small>{streak && <small className="habit-current-streak">Current success streak · {streak.success} {streak.success === 1 ? streak.unit.slice(0, -1) : streak.unit}</small>}</span></div>
                {(eligible(habit, date) || record) && <div className="habit-inline-outcomes" aria-label={`Quick outcomes for ${habit.title}`}>{(['done', 'partial', 'missed', 'skipped'] as const).map((outcome, index) => <button key={outcome} type="button" className={`habit-choice-${outcome}`} aria-label={outcome === 'skipped' ? `Intentional skip ${habit.title}` : `${outcomeLabel(habit, date, outcome)} · ${habit.title}`} aria-describedby={`quick-${habit.id}-${outcome}`} aria-pressed={record?.outcome === outcome} onClick={async () => { if (outcome === 'skipped' && record?.outcome !== 'skipped' && schedule?.kind === 'flexible' && !await confirmAction('An intentional skip excludes this entire week from goal judgment. Continue?')) return; if (discardDraft()) saveOutcome(habit.id, date, record?.outcome === outcome ? null : outcome) }}><span>{outcome === 'skipped' ? '⏭' : outcomeLabel(habit, date, outcome)}</span><small id={`quick-${habit.id}-${outcome}`}>{record?.outcome === outcome ? '✓ Selected · ' : ''}{['Done · 1 point', 'Partial · ½ point', 'Missed · 0 points', 'Intentional skip'][index]}</small></button>)}</div>}
                {expanded === habit.id && draft?.habitId === habit.id && <div className="habit-inline-note"><label>Note<textarea value={draft.note} onChange={event => setEntryDraft({ ...draft, note: event.target.value })} onBlur={event => saveNote(event.target.value)}/></label></div>}
                <div className="habit-card-footer"><button className="habit-note-button" type="button" onClick={() => expanded === habit.id ? discardDraft() : openEntry(habit.id, date, false)}>{expanded === habit.id ? <X size={15} aria-hidden="true"/> : <NotebookPen size={15} aria-hidden="true"/>}{expanded === habit.id ? 'Close note' : record?.note || data.unloggedNotes?.some(item => item.habitId === habit.id && item.date === date) ? 'Edit note' : 'Add note'}</button>
                <RecentHabitDays habit={habit} date={date} entries={entryIndex.byHabitDate.get(habit.id)}/></div>
              </article>
            })}
            {!data.habits.some(habit => (!habit.archived && date >= habit.start && (!habit.end || date <= habit.end) && (eligible(habit, date) || versionAt(habit.schedules, date)?.kind === 'flexible')) || entry(habit.id, date) || data.unloggedNotes?.some(note => note.habitId === habit.id && note.date === date)) && <div className="habit-empty"><p>No habits scheduled for this date.</p>{data.habits.length === 0 && <button className="primary" onClick={() => { setTab('manage'); setEditing('new') }}>Create your first habit</button>}</div>}
          </>}
          {tab === 'week' && <HabitWeek date={date} habits={data.habits} entries={entryIndex.byHabitDate} selected={draft} onDate={changeDate} onSelect={(habitId, day) => { openEntry(habitId, day) }} editor={habit => expanded === habit.id && draft?.habitId === habit.id && status !== 'error' && status !== 'conflict' ? <HabitPanel title={`${habit.icon || '◈'} ${habit.title} · ${draft.date}`} onClose={() => { discardDraft() }}><EntryEditor habit={habit} draft={draft} onChange={setEntryDraft} onNoteBlur={saveNote} onOutcome={outcome => saveOutcome(habit.id, draft.date, outcome)}/></HabitPanel> : null}/>}

          <div hidden={tab !== 'insights'}><Insights data={data} active={tab === 'insights' && view === 'habits' && status !== 'error' && status !== 'conflict'} onDate={(day, habitId) => { if (habitId ? openEntry(habitId, day) : changeDate(day)) { insightsScroll.current = window.scrollY; setReturnToInsights(true); setTab('today') } }}/></div>
          {tab === 'manage' && <><div className="habit-manage-toolbar"><button className="primary" onClick={() => setEditing('new')}>Create habit</button><button className="text-button" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'View active' : 'View archived'}</button></div>{data.habits.map(habit => (habit.archived === showArchived) && <button className="habit-manage-row" key={habit.id} onClick={() => setManaged(habit.id)}><span className="habit-icon" aria-hidden="true">{habit.icon || '◈'}</span><span><strong>{habit.title}</strong><small>{habit.archived ? 'Archived' : paused(habit, localDate()) ? 'Paused' : habit.end && habit.end < localDate() ? 'Ended' : 'Active'} · {scheduleSummary(habit)}</small></span><span aria-hidden="true">›</span></button>)}{managed && status !== 'error' && status !== 'conflict' && (() => { const habit = data.habits.find(item => item.id === managed); if (!habit) return null; const index = data.habits.indexOf(habit); return <HabitPanel title={`${habit.icon || '◈'} ${habit.title}`} onClose={() => setManaged(null)}><p>{scheduleSummary(habit)}</p><CriteriaList criteria={versionAt(habit.criteria, localDate())}/><div className="habit-actions"><button onClick={() => { setManaged(null); setEditing(habit) }}>Edit habit</button><button onClick={() => move(index, -1)} disabled={!data.habits.slice(0, index).some(item => item.archived === habit.archived)} aria-label={`Move ${habit.title} up`}>↑</button><button onClick={() => move(index, 1)} disabled={!data.habits.slice(index + 1).some(item => item.archived === habit.archived)} aria-label={`Move ${habit.title} down`}>↓</button></div><PauseControls habit={habit} onChange={changeHabit}/><div className="habit-actions"><button onClick={() => changeHabit({ ...habit, archived: !habit.archived })}>{habit.archived ? 'Unarchive' : 'Archive'}</button><button onClick={async () => { if (await confirmAction(`Permanently delete ${habit.title} and all its records?`)) { update({ ...data, habits: data.habits.filter(item => item.id !== habit.id), entries: data.entries.filter(item => item.habitId !== habit.id), unloggedNotes: data.unloggedNotes?.filter(item => item.habitId !== habit.id) }); setManaged(null) } }}>Delete</button></div></HabitPanel> })()}</>}
        </>}
      </>}
    </div>
    <div hidden={view !== 'settings'}>{data && <div className="settings-card backup-card"><h3>Habit backup</h3><p>Export or restore habits only. Workout data is not replaced.</p><div className="settings-actions"><button className="outline-button" onClick={exportData}><ArrowDownToLine size={16} aria-hidden="true"/> Export habits</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore habits<input type="file" accept="application/json,.json" onChange={event => { void restore(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}</div>
  </>
})
