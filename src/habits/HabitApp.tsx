import { useScopedConfirm, showMessage } from '../AppDialog'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, NotebookPen, RotateCcw, X } from 'lucide-react'
import { supabase } from '../auth'
import { catchUpDays, eligible, evaluateFlexibleWeek, flexibleWeekText, indexEntries, localDate, MIN_HABIT_DATE, outcomeLabel, parseHabits, paused, shiftDate, validHabitDate, versionAt, weekStart, type Habit, type HabitData, type Outcome } from './model'
import { demoHabitData } from './demo'
import { OnlineHabitStore, type SaveStatus } from './online'
import { Insights } from './Insights'
import { CriteriaList, EntryEditor, HabitForm, PauseControls, type HabitDraft } from './HabitComponents'
import { RecentHabitDays } from './RecentHabitDays'
import { HabitWeek } from './HabitWeek'
import { InfoTip } from '../InfoTip'
import { HabitPanel } from './HabitPanel'
import { fixedScore } from './insights'
import { automaticDailyDate, dailyStripDays, nextDailyBoundary } from './dailyDate'
import { BACKUP_FILE_LIMIT } from '../backupLimits'
import { useDraftCapture } from '../app/DraftCapture'
import './habits.css'

type Identity = { id: string; demo: boolean }
type Props = { identity: Identity; view: string; onStatus: (status: SaveStatus) => void }
export type HabitHandle = { canSignOut: () => boolean; isRecoveryBlocked: () => boolean; leave: (done: () => void) => void; snapshot: () => HabitData | null; exportData: () => void; replace: (data: HabitData) => void; retry: () => void }
const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const canonicalOutcomes = { done: 'Done', partial: 'Partial', missed: 'Missed', skipped: 'Skipped' }
export function reorderNeighbor(habits: readonly Habit[], habitId: string, direction: -1 | 1): number | null {
  const index = habits.findIndex(habit => habit.id === habitId)
  if (index < 0) return null
  for (let target = index + direction; target >= 0 && target < habits.length; target += direction) {
    if (habits[target].archived === habits[index].archived) return target
  }
  return null
}
const combineNotes = (recorded: string, retained: string) => recorded && retained && recorded !== retained ? `${recorded}\n\n${retained}` : recorded || retained
const scheduleSummary = (habit: Habit) => { const today = localDate(); const day = habit.end && habit.end < today ? habit.end : today < habit.start ? habit.start : today; const schedule = versionAt(habit.schedules, day); if (!schedule) return 'No schedule'; const weekdays = schedule.weekdays.length === 7 ? 'Every day' : schedule.weekdays.map(index => labels[index]).join(', '); return schedule.kind === 'flexible' ? `${schedule.target} / week · ${weekdays}` : weekdays }
function download(data: unknown, scope: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `one-ring-${scope}-${stamp}.json`; link.click(); URL.revokeObjectURL(url)
}

export const HabitApp = forwardRef<HabitHandle, Props>(function HabitApp({ identity, view, onStatus }, ref) {
  const confirmAction = useScopedConfirm()
  const today = localDate()
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
  const dailyCards = useRef(new Map<string, HTMLElement>())
  const dateStrip = useRef<HTMLDivElement>(null)
  const navigationToken = useRef(0)
  const [historyTarget, setHistoryTarget] = useState<{ habitId: string; date: string; token: number } | null>(null)
  const insightsReturnToken = useRef<number | null>(null)
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [editingFocus, setEditingFocus] = useState<'end' | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [draft, setDraft] = useState<HabitDraft | null>(null)
  const draftRef = useRef<HabitDraft | null>(null)
  const setEntryDraft = (next: HabitDraft | null) => { draftRef.current = next; setDraft(next) }
  const draftDirty = Boolean(draft && (draft.outcome !== draft.originalOutcome || draft.note !== draft.originalNote))
  useDraftCapture('habit-entry', draft, draftDirty)
  const [managed, setManaged] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [hasMutation, setHasMutation] = useState(false)
  const deletePending = useRef(false)
  const entryIndex = useMemo(() => indexEntries(data?.entries || []), [data?.entries])
  const noteIndex = useMemo(() => {
    const index = new Map<string, Map<string, string>>()
    for (const note of data?.unloggedNotes || []) {
      const dates = index.get(note.habitId) || new Map<string, string>()
      dates.set(note.date, note.note); index.set(note.habitId, dates)
    }
    return index
  }, [data?.unloggedNotes])
  const cancelHistoryNavigation = () => { navigationToken.current += 1; setHistoryTarget(null); insightsReturnToken.current = null }
  const closeHabitForm = () => { setEditing(null); setEditingFocus(null) }
  const editHabit = (habit: Habit | 'new', focus: 'end' | null = null) => { setEditingFocus(focus); setEditing(habit); setActionError('') }
  const discardDraft = () => { const current = draftRef.current; if (current && current.note !== current.originalNote && !saveNote(current.note)) return false; setEntryDraft(null); setExpanded(null); return true }
  const changeDate = (next: string) => {
    if (!validHabitDate(next) || next > localDate()) return false
    if (next !== date && !discardDraft()) return false
    cancelHistoryNavigation()
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
    if (discardDraft()) { cancelHistoryNavigation(); rolloverPending.current = false; setDate(next) }
  }
  const switchTab = async (next: typeof tab) => { if (next === tab) return; if (editing && !await confirmAction('Discard unsaved habit changes?')) return; if (!discardDraft()) return; cancelHistoryNavigation(); if (next === 'week' && automatic.current) { rolloverPending.current = false; setDate(localDate()) } setReturnToInsights(false); setTab(next); closeHabitForm() }

  useLayoutEffect(() => {
    const target = historyTarget
    if (!target) return
    if (tab !== 'today' || view !== 'habits' || date !== target.date || expanded !== target.habitId || navigationToken.current !== target.token) { setHistoryTarget(null); return }
    const frame = requestAnimationFrame(() => {
      if (navigationToken.current !== target.token) return
      const card = dailyCards.current.get(target.habitId)
      if (card) card.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      else setMessage('This habit is no longer available. Return to insights to choose another record.')
      setHistoryTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [historyTarget, tab, view, date, expanded])
  useLayoutEffect(() => {
    const token = insightsReturnToken.current
    if (tab !== 'insights' || token === null) return
    const frame = requestAnimationFrame(() => { if (navigationToken.current === token) { window.scrollTo(0, insightsScroll.current); insightsReturnToken.current = null } })
    return () => cancelAnimationFrame(frame)
  }, [tab])
  useLayoutEffect(() => {
    const strip = dateStrip.current
    const selected = strip?.querySelector<HTMLElement>('[aria-current="date"]')
    if (!strip || !selected) return
    const left = selected.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft - strip.clientLeft
    if (left < strip.scrollLeft) strip.scrollLeft = left
    else if (left + selected.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = left + selected.offsetWidth - strip.clientWidth
  }, [date, tab, today, view, editing, data !== null])

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
  useEffect(() => { if (status === 'saved') { noteSavePending.current = false; if (rolloverPending.current) resyncRef.current() } }, [status])
  useLayoutEffect(() => { onStatus(status) }, [status, onStatus])
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (status !== 'saved' || draftDirty || editing) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [status, draftDirty, editing])
  const update = (next: HabitData) => {
    setMessage(''); setActionError('')
    if (store && (store.getStatus() === 'error' || store.getStatus() === 'conflict')) { setActionError('Changes could not be accepted. Your draft is still open; resolve the save problem first.'); return false }
    try {
      const validated = parseHabits(JSON.stringify(next))
      dataRef.current = validated; setData(validated); setHasMutation(true); store?.update(validated)
      return true
    } catch { setActionError('Changes could not be accepted. Your draft is still open.'); return false }
  }
  const readyRef = useRef<() => boolean>(() => false)
  readyRef.current = () => !!dataRef.current && status === 'saved' && (!store || store.getStatus() === 'saved') && !editing && !draftDirty
  const recoveryBlocked = () => status === 'error' || status === 'conflict' || store?.getStatus() === 'error' || store?.getStatus() === 'conflict'
  useImperativeHandle(ref, () => ({ canSignOut: () => readyRef.current(), isRecoveryBlocked: recoveryBlocked, leave: async done => { if (recoveryBlocked()) { done(); return } if (editing && !await confirmAction('Discard unsaved habit changes?')) return; if (!discardDraft()) return; closeHabitForm(); cancelHistoryNavigation(); done() }, snapshot: () => dataRef.current, exportData, replace: next => update(next), retry: () => store?.retry() }))
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
    const workspace = dataRef.current
    if (!workspace?.habits.some(habit => habit.id === habitId) || !validHabitDate(day) || day > localDate()) return false
    if (!discardDraft()) return false
    cancelHistoryNavigation()
    const record = dataRef.current?.entries.find(item => item.habitId === habitId && item.date === day)
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
  const saveOutcome = (habitId: string, day: string, outcome: Outcome | null, options: { keepEditorOpen?: boolean } = {}): boolean => {
    const workspace = dataRef.current; const current = draftRef.current
    if (!workspace || day > localDate()) return false
    const habit = workspace.habits.find(item => item.id === habitId)
    const previous = workspace.entries.find(item => item.habitId === habitId && item.date === day)
    if (!habit || (outcome && !previous && (habit.archived || !eligible(habit, day)))) return false
    const entries = workspace.entries.filter(item => item.habitId !== habitId || item.date !== day)
    const savedNote = workspace.unloggedNotes?.find(item => item.habitId === habitId && item.date === day)?.note || ''
    const note = current?.habitId === habitId && current.date === day ? current.note : combineNotes(previous?.note || '', savedNote)
    const unloggedNotes = (workspace.unloggedNotes || []).filter(item => item.habitId !== habitId || item.date !== day)
    if (outcome) entries.push({ habitId, date: day, outcome, note })
    else if (note) unloggedNotes.push({ habitId, date: day, note })
    if (!update({ ...workspace, entries, unloggedNotes })) return false
    if (current && current.habitId === habitId && current.date === day && current.note !== current.originalNote && store && store.getStatus() !== 'saved') noteSavePending.current = true
    if (options.keepEditorOpen && current?.habitId === habitId && current.date === day) setEntryDraft({ ...current, outcome, originalOutcome: outcome, note, originalNote: note })
    else { setEntryDraft(null); setExpanded(null) }
    return true
  }
  const saveHabit = (habit: Habit) => {
    const workspace = dataRef.current
    if (!workspace) return false
    const exists = workspace.habits.some(item => item.id === habit.id)
    if (editing !== 'new' && !exists) return false
    if (!update({ ...workspace, habits: exists ? workspace.habits.map(item => item.id === habit.id ? habit : item) : [...workspace.habits, habit] })) return false
    closeHabitForm()
    return true
  }
  const changeHabit = (habit: Habit) => {
    const workspace = dataRef.current
    return Boolean(workspace && workspace.habits.some(item => item.id === habit.id) && update({ ...workspace, habits: workspace.habits.map(item => item.id === habit.id ? habit : item) }))
  }
  const move = (habitId: string, direction: -1 | 1) => {
    const workspace = dataRef.current
    if (!workspace) return false
    const target = reorderNeighbor(workspace.habits, habitId, direction)
    if (target === null) return false
    const habits = [...workspace.habits]; const index = habits.findIndex(habit => habit.id === habitId)
    const moving = habits[index]; habits[index] = habits[target]; habits[target] = moving
    const saved = update({ ...workspace, habits })
    if (saved) {
      const group = habits.filter(habit => habit.archived === moving.archived)
      const position = group.findIndex(habit => habit.id === moving.id) + 1
      setOrderMessage(`${moving.title} moved ${direction < 0 ? 'up' : 'down'}. Position ${position} of ${group.length} in ${moving.archived ? 'archived' : 'active'} habits.`)
    }
    return saved
  }
  const deleteHabit = async (habitId: string) => {
    const habit = dataRef.current?.habits.find(item => item.id === habitId)
    if (!habit || deletePending.current) return
    deletePending.current = true
    try {
      if (!await confirmAction(`Permanently delete ${habit.title} and all its records?`)) return
      const workspace = dataRef.current
      if (!workspace || recoveryBlocked() || !workspace.habits.some(item => item.id === habitId)) return
      if (!update({ ...workspace, habits: workspace.habits.filter(item => item.id !== habitId), entries: workspace.entries.filter(item => item.habitId !== habitId), unloggedNotes: workspace.unloggedNotes?.filter(item => item.habitId !== habitId) })) return
      setManaged(null)
      if (draftRef.current?.habitId === habitId) { setEntryDraft(null); setExpanded(null) }
      if (editing !== 'new' && editing?.id === habitId) closeHabitForm()
      cancelHistoryNavigation()
    } finally { deletePending.current = false }
  }
  const modalSaveStatus = <div className="habit-modal-save-status" role="status">{actionError || <>{message && <span>{message} </span>}{identity.demo ? 'Demo changes last until refresh.' : status === 'saving' ? 'Saving habits…' : status === 'error' || status === 'conflict' ? 'Habit changes need save recovery.' : hasMutation ? 'Habit changes saved.' : ''}</>}</div>
  const dailyScore = data ? fixedScore(data, date, date, entryIndex) : null
  const dailyHabits = (data?.habits || []).filter(habit => (!habit.archived && eligible(habit, date)) || entry(habit.id, date) || noteIndex.get(habit.id)?.has(date)).sort((a, b) => Number(versionAt(a.schedules, date)?.kind === 'flexible') - Number(versionAt(b.schedules, date)?.kind === 'flexible'))
  const flexibleHabits = (data?.habits || []).filter(habit => !habit.archived && habit.start <= date && (!habit.end || habit.end >= date) && versionAt(habit.schedules, date)?.kind === 'flexible')
  const weeklyGoals = flexibleHabits.length > 0 && <section className="habit-weekly-summary"><h2>Weekly goals</h2><small>Through {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · Done = 1 point · Partial = ½. Flexible days are opportunities, not daily obligations.</small>{flexibleHabits.map(habit => {
    const result = evaluateFlexibleWeek(habit, entryIndex.byHabitDate.get(habit.id) || new Map(), weekStart(date), date)
    return <div key={habit.id}><span>{habit.icon || '◈'} {habit.title}</span><span>{flexibleWeekText(result)}{result.phase === 'in-progress' && result.primaryExclusion ? ' · Week in progress' : ''}</span></div>
  })}</section>
  const editorHabit = draft ? data?.habits.find(habit => habit.id === draft.habitId) : null
  const loading = loadError ? <div className="settings-card"><h2>Could not load habits</h2><p>Check your connection and that the habit database migration is installed. No local account data was loaded.</p><button className="outline-button" onClick={() => setAttempt(n => n + 1)}>Retry</button></div> : <p>Loading habits…</p>
  return <>
    {status === 'saving' && <div role="status" className="habit-saving">Saving habits…</div>}
    <div hidden={view !== 'habits'} className="habit-app">
      {identity.demo && <p className="demo-example-note">Demo mode · Fictional sample habits. Changes reset when you refresh.</p>}
      {!data ? loading : <>
        <header className="page-heading habit-heading"><h1>Habit Tracker<span className="accent">.</span></h1>{!identity.demo && <p className="habit-save-feedback" role="status">{hasMutation ? status === 'saved' ? 'Habit changes saved.' : status === 'saving' ? 'Saving habits…' : 'Habit changes need save recovery.' : ''}</p>}</header>
        <nav className="workout-subnav habit-nav" aria-label="Habit Tracker"><button className={tab === 'today' ? 'active' : ''} onClick={() => switchTab('today')}>Daily</button><button className={tab === 'week' ? 'active' : ''} onClick={() => switchTab('week')}>Week</button><button className={tab === 'insights' ? 'active' : ''} onClick={() => switchTab('insights')}>Insights</button><button className={tab === 'manage' ? 'active' : ''} onClick={() => switchTab('manage')}>Habits</button></nav>
        {message && <p role="status">{message}</p>}
        {editing ? <HabitPanel variant="form" title={editing === 'new' ? 'Create habit' : 'Edit habit'} onClose={() => { void (async () => { if (await confirmAction('Discard unsaved habit changes?')) closeHabitForm() })() }}>
          {modalSaveStatus}
          <HabitForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} focusField={editingFocus} onSave={saveHabit} onCancel={closeHabitForm}/>
        </HabitPanel> : <>
          {tab === 'week' && <div className="habit-date-tools habit-week-date-tools"><label>Date <input type="date" value={date} min={MIN_HABIT_DATE} max={today} onChange={event => { if (event.target.value) changeDate(event.target.value) }}/></label><button type="button" disabled={today === MIN_HABIT_DATE} onClick={() => changeDate(shiftDate(today, -1))}>Yesterday</button><button type="button" disabled={date === today} onClick={() => changeDate(today)}>Today</button></div>}
          {tab === 'today' && <>
            {returnToInsights && <button type="button" className="text-button habit-insights-back" onClick={() => { if (discardDraft()) { cancelHistoryNavigation(); insightsReturnToken.current = navigationToken.current; setReturnToInsights(false); setTab('insights') } }}>← Back to insights</button>}
            <header className="habit-daily-header">
              <div className="habit-daily-date-heading"><h2>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
                <div className="habit-date-tools"><label>Date <input type="date" value={date} min={MIN_HABIT_DATE} max={today} onChange={event => { if (event.target.value) changeDate(event.target.value) }}/></label><button type="button" disabled={date === today} onClick={() => changeDate(today)}>Today</button></div>
              </div>
              <div className="habit-daily-context">{dailyScore && <p>{dailyScore.due ? `${dailyScore.done + dailyScore.partial + dailyScore.missed} of ${dailyScore.due} fixed habits logged` : 'No fixed habits due'}{dailyScore.skipped > 0 && ` · ${dailyScore.skipped} skipped`} <InfoTip label="About logging habits">Tap an outcome to log it; tap it again to unlog. Notes are kept. Skip applies to one day and adds no points. It does not reduce a weekly goal or exclude the week from judgment.</InfoTip></p>}
              </div>
              <div ref={dateStrip} className="habit-date-strip" aria-label="Selected date and recent days">{dailyStripDays(date, today).map(day => {
                const score = fixedScore(data, day, day, entryIndex); const count = score.done + score.partial + score.missed
                return <button type="button" key={day} aria-current={date === day ? 'date' : undefined} aria-label={`${day}: ${score.due ? `${count} of ${score.due} fixed habits logged` : 'no fixed habits due'}`} onClick={() => changeDate(day)}><span>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>{Number(day.slice(8))}</strong><small>{score.due ? `${count}/${score.due}` : '—'}</small></button>
              })}</div>
              <small className="habit-strip-caption">Fixed habits logged / due · — no fixed habits due</small>
            </header>
            {(() => { const pending = catchUpDays(data, today); return pending.length > 0 && <section className="habit-catchup"><div className="habit-catchup-heading"><strong>Catch up · previous 7 days</strong><small>Unlogged fixed habits</small></div><div className="habit-catchup-chips">{pending.map(day => <button type="button" key={day.date} onClick={() => changeDate(day.date)} aria-label={`${day.date}: ${day.count} unlogged fixed habits`}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })} · {day.count}</button>)}</div></section> })()}
            {dailyHabits.map(habit => {
              const record = entry(habit.id, date); const schedule = versionAt(habit.schedules, date)
              const progress = schedule?.kind === 'flexible' ? evaluateFlexibleWeek(habit, entryIndex.byHabitDate.get(habit.id) || new Map(), weekStart(date), date) : null
              return <article key={habit.id} ref={node => { if (node) dailyCards.current.set(habit.id, node); else dailyCards.current.delete(habit.id) }} className={`habit-card habit-daily-card ${record ? `is-${record.outcome}` : ''}`}>
                <div className="habit-row habit-card-heading"><span className="habit-row-main"><strong><span aria-hidden="true">{habit.icon || '◈'}</span> {habit.title}</strong><small>{habit.archived ? record ? 'Archived · recorded' : 'Archived · note only' : !eligible(habit, date) ? record ? 'Not scheduled · recorded' : 'Not scheduled · note only' : progress ? `Flexible · ${flexibleWeekText(progress)}` : 'Fixed · scheduled'}</small></span></div>
                {((!habit.archived && eligible(habit, date)) || record) && <div className="habit-inline-outcomes" aria-label={`Quick outcomes for ${habit.title}`}>{(['done', 'partial', 'missed', 'skipped'] as const).map(outcome => {
                  const personal = outcomeLabel(habit, date, outcome); const canonical = canonicalOutcomes[outcome]
                  return <button key={outcome} type="button" className={`habit-choice-${outcome}`} aria-label={outcome === 'skipped' ? `Intentional skip ${habit.title}` : `${personal}${personal !== canonical ? ` (${canonical})` : ''} · ${habit.title}`} aria-pressed={record?.outcome === outcome} onClick={() => { if (discardDraft()) { const latest = dataRef.current?.entries.find(item => item.habitId === habit.id && item.date === date); saveOutcome(habit.id, date, latest?.outcome === outcome ? null : outcome) } }}><span>{outcome === 'skipped' ? '⏭' : personal}</span>{outcome === 'skipped' ? <small>Skip</small> : personal !== canonical && <small>{canonical}</small>}</button>
                })}</div>}
                {expanded === habit.id && draft?.habitId === habit.id && <div className="habit-inline-note"><label>Note<textarea value={draft.note} onChange={event => setEntryDraft({ ...draft, note: event.target.value })} onBlur={event => saveNote(event.target.value)}/></label></div>}
                <div className="habit-card-footer"><button className="habit-note-button" type="button" onClick={() => expanded === habit.id ? discardDraft() : openEntry(habit.id, date, false)}>{expanded === habit.id ? <X size={15} aria-hidden="true"/> : <NotebookPen size={15} aria-hidden="true"/>}{expanded === habit.id ? 'Close note' : record?.note || noteIndex.get(habit.id)?.has(date) ? 'Edit note' : 'Add note'}</button>
                <RecentHabitDays habit={habit} date={date} entries={entryIndex.byHabitDate.get(habit.id)} notes={noteIndex.get(habit.id)}/></div>
              </article>
            })}
            {dailyHabits.length === 0 && <div className="habit-empty"><p>No habits scheduled for this date.</p>{data.habits.length === 0 && <button type="button" className="primary" onClick={() => { setTab('manage'); editHabit('new') }}>Create your first habit</button>}</div>}
            {weeklyGoals}
          </>}
          {tab === 'week' && <HabitWeek date={date} habits={data.habits} entries={entryIndex.byHabitDate} notes={data.unloggedNotes || []} selected={draft} onDate={changeDate} onSelect={(habitId, day) => { openEntry(habitId, day) }}/>}
          {tab === 'week' && draft && editorHabit && !recoveryBlocked() && <HabitPanel title={`${editorHabit.icon || '◈'} ${editorHabit.title} · ${new Date(`${draft.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`} onClose={() => { discardDraft() }}>
            {modalSaveStatus}
            <p className="habit-detail-label">{draft.originalOutcome ? `Current outcome: ${outcomeLabel(editorHabit, draft.date, draft.originalOutcome)}` : draft.originalNote ? 'Unlogged · note saved' : 'Unlogged'}</p>
            <EntryEditor habit={editorHabit} draft={draft} allowOutcome={Boolean(entry(editorHabit.id, draft.date)) || (!editorHabit.archived && eligible(editorHabit, draft.date))} onChange={setEntryDraft} onNoteBlur={saveNote} onOutcome={outcome => saveOutcome(editorHabit.id, draft.date, outcome, { keepEditorOpen: true })}/>
          </HabitPanel>}

          <div hidden={tab !== 'insights'}><Insights data={data} active={tab === 'insights' && view === 'habits' && !recoveryBlocked()} onDate={(day, habitId) => {
            if (habitId ? openEntry(habitId, day) : changeDate(day)) {
              insightsScroll.current = window.scrollY
              if (habitId) setHistoryTarget({ habitId, date: day, token: navigationToken.current })
              setReturnToInsights(true); setTab('today')
            }
          }}/></div>
          {tab === 'manage' && <>
            <div className="habit-manage-toolbar"><button type="button" className="primary" onClick={() => editHabit('new')}>Create habit</button><button type="button" onClick={() => { setReordering(!reordering); setOrderMessage('') }}>{reordering ? 'Done' : 'Reorder'}</button></div>
            <nav className="habit-insight-nav" aria-label="Habit views"><button type="button" aria-pressed={!showArchived} onClick={() => { setShowArchived(false); setOrderMessage('') }}>Active habits</button><button type="button" aria-pressed={showArchived} onClick={() => { setShowArchived(true); setOrderMessage('') }}>Archived habits</button></nav>
            <p className="habit-insight-note">{showArchived ? 'Archived habits leave aggregate summaries and current streaks; recorded history remains correctable.' : 'Your active habits, including paused and ended habits.'}</p>
            <p role="status" className="habit-insight-note">{actionError || orderMessage}</p>
            {!data.habits.some(habit => habit.archived === showArchived) && <p className="habit-empty">{showArchived ? 'No archived habits.' : 'No active habits. Create a habit to get started.'}</p>}
            {data.habits.map(habit => habit.archived === showArchived && <div className="habit-manage-item" key={habit.id}><button type="button" className="habit-manage-row" onClick={() => { setActionError(''); setMessage(''); setManaged(habit.id) }}><span className="habit-icon" aria-hidden="true">{habit.icon || '◈'}</span><span><strong>{habit.title}</strong><small>{habit.archived ? 'Archived' : paused(habit, today) ? 'Paused' : habit.end && habit.end < today ? 'Ended' : 'Active'} · {scheduleSummary(habit)}</small></span><span aria-hidden="true">›</span></button>{reordering && <div className="habit-order-controls"><button type="button" onClick={() => move(habit.id, -1)} disabled={reorderNeighbor(data.habits, habit.id, -1) === null} aria-label={`Move ${habit.title} up`}>↑</button><button type="button" onClick={() => move(habit.id, 1)} disabled={reorderNeighbor(data.habits, habit.id, 1) === null} aria-label={`Move ${habit.title} down`}>↓</button></div>}</div>)}
            {managed && !recoveryBlocked() && (() => {
              const habit = data.habits.find(item => item.id === managed)
              if (!habit) return null
              return <HabitPanel title={`${habit.icon || '◈'} ${habit.title}`} onClose={() => setManaged(null)}>
                {modalSaveStatus}<p>{habit.archived && 'Archived · '}{scheduleSummary(habit)}</p>
                <CriteriaList criteria={versionAt(habit.criteria, today)}/>
                <div className="habit-actions"><button type="button" onClick={() => { setManaged(null); editHabit(habit) }}>Edit habit</button>
                  {habit.end && habit.end < today && <button type="button" onClick={() => { setManaged(null); editHabit(habit, 'end') }}>Extend habit</button>}
                </div>
                <PauseControls habit={habit} onChange={changeHabit}/>
                <p className="habit-form-help">Archived habits leave aggregate summaries, current streaks and new opportunities. Recorded history remains correctable. Unarchiving keeps active dates and pauses.</p>
                <div className="habit-actions"><button type="button" onClick={() => { const latest = dataRef.current?.habits.find(item => item.id === habit.id); if (latest && changeHabit({ ...latest, archived: !latest.archived })) setMessage(`${latest.title} ${latest.archived ? 'unarchived' : 'archived'}. Recorded history remains available.`) }}>{habit.archived ? 'Unarchive' : 'Archive'}</button><button type="button" onClick={() => { void deleteHabit(habit.id) }}>Delete</button></div>
              </HabitPanel>
            })()}
          </>}
        </>}
      </>}
    </div>
    <div hidden={view !== 'settings'}>{data && <div className="settings-card backup-card"><h3>Habit backup</h3><p>Export or restore habits only. Workout data is not replaced.</p><div className="settings-actions"><button className="outline-button" onClick={exportData}><ArrowDownToLine size={16} aria-hidden="true"/> Export habits</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore habits<input type="file" accept="application/json,.json" onChange={event => { void restore(event.target.files?.[0]); event.target.value = '' }}/></label></div></div>}</div>
  </>
})
