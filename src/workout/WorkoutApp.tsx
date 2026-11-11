import { ChoiceSelect } from '../ChoiceSelect'
import { confirmAction, showMessage } from '../AppDialog'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useState } from 'react'
import { ArrowDownToLine, ArrowRight, Check, ChevronRight, RotateCcw, X } from 'lucide-react'
import { supabase } from '../auth'
import { ExerciseLibrary, type Exercise } from './ExerciseLibrary'
import { WorkoutSession, startingSets, previousFor, type Session, type Workout } from './WorkoutSession'
import { Activity } from './Activity'
import { parseBackup, type Backup, type CycleEvent } from './backup'
import { prepareRestore } from './restore'
import { memoryStorage, OnlineWorkoutStore, seedStorage, type SaveStatus } from './online'
import { advanceRotations, planExercises, type Rotation } from './rotations'
import { RoutineBuilder, type RoutineDay } from './RoutineBuilder'
import { mapCycleDays } from './routineDraft'
import { ConfirmDialog } from '../ConfirmDialog'
import { seedDemoWorkouts } from './demo'
import { sampleDays } from './sampleDays'
import './workout-redesign.css'

type Day = { id?: string; name: string; subtitle: string; exercises: Exercise[] }
const identifyDays = (days: Day[]): Day[] => days.map(day => ({ ...day, id: day.id || crypto.randomUUID(), exercises: day.exercises.map(exercise => ({ ...exercise, routineSlotId: exercise.routineSlotId || crypto.randomUUID() })) }))
type Data = { completed: string[]; skippedDays?: string[]; workouts: Workout[]; session: Session | null }
type RoutineBook = { active: string; routines: { id: string; name: string; days: Day[]; completed: string[]; skippedDays?: string[]; rotations?: Rotation[]; cycleHistory?: CycleEvent[] }[] }

const initial: Data = { completed: ['Push'], workouts: [], session: null }
const key = 'one-ring-demo-v1'
function load(storage: Storage, storageKey: string): Data { try { const data = JSON.parse(storage.getItem(storageKey) || 'null'); return data && Array.isArray(data.completed) && Array.isArray(data.workouts) ? data : initial } catch { return initial } }
type Identity = { id: string; email: string; demo: boolean }
type View = 'home' | 'workout' | 'habits' | 'settings'
export type WorkoutHandle = { leave: (done: () => void) => void; open: () => void; canSignOut: () => boolean; canUpdate: () => boolean; snapshot: () => Backup; exportData: () => void; validateBackup: (value: unknown) => Backup; replace: (value: Backup) => void }
export const WorkspaceGate = forwardRef<WorkoutHandle, { identity: Identity; view: View; exportHabits: () => void }>(function WorkspaceGate({ identity, view, exportHabits }, ref) {
  const [state, setState] = useState<{ storage: Storage; online: OnlineWorkoutStore | null } | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const storage = memoryStorage()
    if (identity.demo) { seedDemoWorkouts(storage, sampleDays); setState({ storage, online: null }); return () => { active = false } }
    if (!supabase) { setError(true); return () => { active = false } }
    const online = new OnlineWorkoutStore(supabase, identity.id)
    setError(false)
    online.load().then(backup => {
      if (!active) return
      if (backup) seedStorage(storage, identity.id, backup)
      setState({ storage, online })
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [identity.id, identity.demo, attempt])
  if (error) return <div hidden={view !== 'workout' && view !== 'settings'} className="auth-card"><h1>Could not load workouts</h1><p>Check your connection and that the online workout database migration has been applied. No local workout data was loaded.</p><button className="primary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>
  if (!state) return <p hidden={view !== 'workout' && view !== 'settings'}>Loading workouts…</p>
  return <WorkoutApp ref={ref} identity={identity} view={view} exportHabits={exportHabits} storage={state.storage} online={state.online}/>
})
const WorkoutApp = forwardRef<WorkoutHandle, { identity: Identity; view: View; exportHabits: () => void; storage: Storage; online: OnlineWorkoutStore | null }>(function WorkoutApp({ identity, view, exportHabits, storage: localStorage, online }, ref) {
  const storageKey = identity.demo ? key : `one-ring-user-${identity.id}`
  const warmupKey = `${storageKey}-warmups`
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [data, setData] = useState<Data>(() => {
    const loaded = identity.demo ? load(localStorage, storageKey) : (() => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null') || { completed: [], workouts: [], session: null } } catch { return { completed: [], workouts: [], session: null } } })()
    const normalized = { ...loaded, workouts: loaded.workouts.map((workout: Workout) => ({ ...workout, id: workout.id || crypto.randomUUID() })) }
    if (normalized.workouts.some((workout: Workout, index: number) => workout.id !== loaded.workouts[index].id)) localStorage.setItem(storageKey, JSON.stringify(normalized))
    return normalized
  })
  const routinesKey = `${storageKey}-routine`
  const [days, setDays] = useState<Day[]>(() => { try { const saved = JSON.parse(localStorage.getItem(routinesKey) || 'null'); return identifyDays(Array.isArray(saved) && saved.length ? saved : sampleDays) } catch { return identifyDays(sampleDays) } })
  const saveDays = (next: Day[]) => { const identified = identifyDays(next); setDays(identified); localStorage.setItem(routinesKey, JSON.stringify(identified)) }
  const bookKey = `${storageKey}-routine-book`
  const [book, setBook] = useState<RoutineBook>(() => {
    try { const saved = JSON.parse(localStorage.getItem(bookKey) || 'null'); if (saved && Array.isArray(saved.routines) && saved.routines.some((r: { id: string }) => r.id === saved.active)) return saved } catch { /* keep legacy routine */ }
    return { active: 'initial', routines: [{ id: 'initial', name: 'My routine', days, completed: data.completed }] }
  })
  const currentBook = (): RoutineBook => ({ ...book, routines: book.routines.map(routine => routine.id === book.active ? { ...routine, days, completed: data.completed, skippedDays: data.skippedDays || [] } : routine) })
  const rotations = book.routines.find(routine => routine.id === book.active)?.rotations || []
  const recordCycle = (events: Omit<CycleEvent, 'id' | 'at'>[], nextRotations?: Rotation[]) => { const updated = currentBook(); setBook({ ...updated, routines: updated.routines.map(routine => routine.id === updated.active ? { ...routine, rotations: nextRotations || routine.rotations, cycleHistory: [...(routine.cycleHistory || []), ...events.map(event => ({ ...event, routineName: routine.name, daysSnapshot: days.map(day => ({ id: day.id, name: day.name })), completedBefore: [...data.completed], skippedBefore: [...(data.skippedDays || [])], id: crypto.randomUUID(), at: new Date().toISOString() }))] } : routine) }) }
  useEffect(() => { localStorage.setItem(bookKey, JSON.stringify(currentBook())) }, [book, days, data.completed, data.skippedDays])
  const libraryKey = `${storageKey}-library`
  const [library, setLibrary] = useState<Exercise[]>(() => {
    let unique: Exercise[] | null = null
    try { const saved = JSON.parse(localStorage.getItem(libraryKey) || 'null'); if (Array.isArray(saved)) unique = saved } catch { /* start with existing routine exercises */ }
    if (!unique) {
      const all = days.flatMap(day => day.exercises)
      unique = all.filter((exercise, index) => all.findIndex(other => other.name === exercise.name) === index)
      for (const name of all.flatMap(exercise => exercise.alternatives || [])) if (!unique.some(exercise => exercise.name === name)) unique.push({ name, equipment: '', sets: '' })
    }
    const withIds = unique.map(exercise => ({ ...exercise, id: exercise.id || crypto.randomUUID() }))
    localStorage.setItem(libraryKey, JSON.stringify(withIds))
    return withIds
  })
  const saveLibrary = (next: Exercise[]) => {
    const renames = new Map<string, string>()
    library.forEach((exercise, i) => { if (next[i] && next[i].name !== exercise.name) renames.set(exercise.name, next[i].name) })
    const updatedDays = days.map(day => ({ ...day, exercises: day.exercises.map(exercise => {
      const name = renames.get(exercise.name) || exercise.name
      const updated = next.find(item => item.name === name)
      return updated ? { ...updated, routineSlotId: exercise.routineSlotId, alternatives: (exercise.alternatives || []).map(a => renames.get(a) || a) } : exercise
    }) }))
    // Bind legacy name-based records before a rename; snapshots keep their old names.
    if (renames.size) {
      const workouts = data.workouts.map(workout => ({ ...workout, exercises: workout.exercises.map(exercise => ({ ...exercise, exerciseId: exercise.exerciseId || library.find(item => item.name === exercise.name)?.id })) }))
      const session = data.session ? { ...data.session, exercises: data.session.exercises.map(exercise => ({ ...exercise, id: exercise.id || library.find(item => item.name === exercise.name)?.id })) } : null
      save({ ...data, workouts, session })
    }
    saveDays(updatedDays); setLibrary(next); localStorage.setItem(libraryKey, JSON.stringify(next))
  }
  const [page, setPageState] = useState<'home' | 'routine' | 'builder' | 'library' | 'session' | 'activity'>('routine')
  const [reviewLatest, setReviewLatest] = useState(false)
  const [builderDirty, setBuilderDirty] = useState(false)
  const [sessionDirty, setSessionDirty] = useState(false)
  const [libraryDirty, setLibraryDirty] = useState(false)
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; label: string; action: () => void } | null>(null)
  const setPage = (next: typeof page, after?: () => void) => {
    if (page === 'builder' && next !== 'builder' && builderDirty) {
      setConfirmation({ title: 'Discard routine draft?', message: 'Your unsaved routine changes will be lost.', label: 'Discard and leave', action: () => { setBuilderDirty(false); setPageState(next); after?.() } }); return
    }
    if (page === 'session' && next !== 'session' && sessionDirty) { setConfirmation({ title: 'Leave workout?', message: 'Unconfirmed log and setup edits will be discarded. Confirmed entries remain in the workout.', label: 'Leave workout', action: () => { setPageState(next); after?.() } }); return }
    if (page === 'library' && next !== 'library' && libraryDirty) { setConfirmation({ title: 'Discard exercise edits?', message: 'Your unsaved exercise changes will be lost.', label: 'Discard and leave', action: () => { setLibraryDirty(false); setPageState(next); after?.() } }); return }
    if (next === 'activity') setReviewLatest(false)
    setPageState(next)
    after?.()
  }
  useImperativeHandle(ref, () => ({ leave: done => setPage('home', done), open: () => setPage('routine'), canSignOut: () => saveStatus === 'saved' && !libraryDirty && !builderDirty && !sessionDirty, canUpdate: () => saveStatus === 'saved' && !builderDirty && !sessionDirty && !libraryDirty && (page === 'home' || page === 'routine'), snapshot, exportData, validateBackup: value => prepareRestore(parseBackup(JSON.stringify(value)), days), replace: applyBackup }))
  const [selectedDay, setSelectedDay] = useState('')
  const [warmupItems, setWarmupItems] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(warmupKey) || (identity.demo ? localStorage.getItem('one-ring-warmups') : null) || 'null') || ['A little movement', 'Get the joints moving'] } catch { return ['A little movement', 'Get the joints moving'] } })
  const [notice, setNotice] = useState('')
  const save = (next: Data) => { setData(next); localStorage.setItem(storageKey, JSON.stringify(next)) }
  const remaining = days.filter(day => !data.completed.includes(day.name))
  const nextDay = remaining[0] || days[0]
  const currentDay = days.find(day => day.name === selectedDay) || nextDay
  const session = data.session
  const updateSession = (next: Session) => {
    save({ ...data, session: next })
  }
  const saveRoutineDraft = (nextDays: RoutineDay[], nextRotations: Rotation[], names: Record<string, string | null>, baseline: string) => {
    if (session) { setNotice('Finish or cancel the active workout before saving routine changes.'); return false }
    if (baseline !== JSON.stringify({ days, rotations })) { setNotice('The saved routine changed while editing. Your draft has not been applied; review it before retrying.'); return false }
    nextDays = identifyDays(nextDays)
    const nextData = { ...data, completed: mapCycleDays(data.completed, names), skippedDays: mapCycleDays(data.skippedDays || [], names) }
    const updated = currentBook()
    const nextBook = { ...updated, routines: updated.routines.map(routine => routine.id === updated.active ? { ...routine, days: nextDays, completed: nextData.completed, skippedDays: nextData.skippedDays, rotations: nextRotations } : routine) }
    const writes: [string, string][] = [[storageKey, JSON.stringify(nextData)], [routinesKey, JSON.stringify(nextDays)], [bookKey, JSON.stringify(nextBook)]]
    const original = writes.map(([key]) => [key, localStorage.getItem(key)] as const)
    try { writes.forEach(([key, value]) => localStorage.setItem(key, value)) } catch { original.forEach(([key, value]) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* best effort */ } }); setNotice('Could not save routine changes. Your draft is unchanged.'); return false }
    setDays(nextDays); setData(nextData); setBook(nextBook); setSelectedDay(names[selectedDay] || ''); setNotice('Routine changes saved.'); return true
  }
  const switchRoutine = (id: string) => {
    if (data.session) { void showMessage('Finish your current workout before switching routines.'); return }
    const updated = currentBook()
    const target = updated.routines.find(routine => routine.id === id)
    if (!target) return
    setBook({ ...updated, active: id }); saveDays(target.days); save({ ...data, completed: target.completed, skippedDays: target.skippedDays || [] }); setSelectedDay('')
  }
  const createRoutine = (name: string) => {
    if (data.session) { void showMessage('Finish your current workout before switching routines.'); return }
    const routine = { id: crypto.randomUUID(), name, days: [{ name: 'Day 1', subtitle: '', exercises: [] }], completed: [] as string[] }
    const updated = currentBook(); setBook({ active: routine.id, routines: [...updated.routines, routine] }); saveDays(routine.days); save({ ...data, completed: [], skippedDays: [] }); setSelectedDay('')
  }
  const start = (day: Day | null) => {
    if (session) { setPage('session'); setNotice('Resume your workout in progress.'); return }
    const exercises = day ? planExercises(day.name, day.exercises, library, rotations).map((exercise, index) => ({ ...exercise, sessionSlotId: day.exercises[index].routineSlotId || crypto.randomUUID(), sessionItemId: crypto.randomUUID(), sessionSource: exercise.rotationGroupId ? 'cycle' as const : 'planned' as const })) : []
    if (new Set(exercises.map(exercise => exercise.name)).size !== exercises.length) { void showMessage('This rotation produces the same exercise twice on this day. Adjust the routine or rotation before starting.'); return }
    const plan = day ? exercises.map(exercise => ({ slotId: exercise.sessionSlotId, name: exercise.name, exerciseId: exercise.id, equipment: exercise.equipment, cycleId: exercise.rotationGroupId, cycleName: rotations.find(group => group.id === exercise.rotationGroupId)?.name })) : []
    const routine = book.routines.find(item => item.id === book.active)
    save({ ...data, session: { id: crypto.randomUUID(), day: day?.name || 'Free workout', dayId: day?.id, startedAt: new Date().toISOString(), routineId: day ? routine?.id : undefined, routineName: day ? routine?.name : undefined, plan, exercises, entries: Object.fromEntries(exercises.map(e => [e.name, startingSets(e, data.workouts)])), skipped: [], warmups: [], cardio: Object.fromEntries(exercises.map(e => { const prev = previousFor(data.workouts, e)?.cardio; return [e.name, prev ? { ...prev, done: false } : { duration: '', speed: '', incline: '', done: false }] })) } })
    setPage('session')
  }
  const finishSession = (finished: Session) => {
    const workout: Workout = { id: finished.id || crypto.randomUUID(), day: finished.day, dayId: finished.dayId, date: new Date().toISOString(), startedAt: finished.startedAt, routineId: finished.routineId, routineName: finished.routineName, plan: finished.plan, exercises: finished.exercises.map(e => ({ id: e.sessionItemId, name: e.name, exerciseId: e.id || library.find(item => item.name === e.name)?.id, plannedName: e.plannedName, plannedId: e.plannedId, equipmentSnapshot: e.equipment, sessionSlotId: e.sessionSlotId, source: e.sessionSource, sets: (finished.entries[e.name] || []).filter(s => s.done), skipped: finished.skipped.includes(e.name), note: finished.notes?.[e.name], cardio: finished.cardio?.[e.name]?.done ? finished.cardio[e.name] : undefined })) }
    const completedNames = workout.exercises.filter(exercise => exercise.sets.length === 3 || exercise.cardio?.done).map(exercise => exercise.name)
    let completed = [...data.completed]
    const hasResults = completedNames.length > 0
    const allSkipped = finished.exercises.length > 0 && finished.exercises.every(exercise => finished.skipped.includes(exercise.name))
    if ((hasResults || allSkipped) && days.some(d => d.name === finished.day) && !completed.includes(finished.day)) completed.push(finished.day)
    let skippedDays = (data.skippedDays || []).filter(name => name !== finished.day)
    if (allSkipped) skippedDays = [...skippedDays, finished.day]
    const cycleEvents: Omit<CycleEvent, 'id' | 'at'>[] = []
    if ((hasResults || allSkipped) && days.some(day => day.name === finished.day)) cycleEvents.push({ type: allSkipped ? 'skipped' : 'completed', day: finished.day, workoutId: workout.id })
    if (completed.length === days.length) { cycleEvents.push({ type: 'rollover' }); completed = []; skippedDays = []; setNotice('Cycle complete. A fresh cycle is ready for you.') } else setNotice('Workout saved. Nice work showing up!')
    recordCycle(cycleEvents, advanceRotations(rotations, finished.exercises, completedNames))
    save({ completed, skippedDays, workouts: [workout, ...data.workouts], session: null }); setSessionDirty(false); setReviewLatest(true); setPageState('activity')
  }
  const finish = () => {
    if (!session) return
    setConfirmation({ title: 'Finish workout?', message: `Unfinished exercises will not be saved as completed.${sessionDirty ? ' Unconfirmed result and setup edits will be discarded.' : ''}`, label: 'Finish workout', action: () => finishSession(session) })
  }
  const cancelSession = () => {
    if (!session) return
    setConfirmation({ title: 'Cancel workout?', message: 'The in-progress workout and notes will be discarded. Your routine, cycle and history will not change.', label: 'Cancel workout', action: () => { save({ ...data, session: null }); setSessionDirty(false); setNotice('Workout cancelled.'); setPageState('routine') } })
  }
  const updateSetup = (exercise: Exercise, note: string) => {
    const matches = (item: Exercise) => exercise.id && item.id ? item.id === exercise.id : item.name === exercise.name
    const update = (item: Exercise) => matches(item) ? { ...item, note } : item
    const nextLibrary = library.map(update)
    const nextDays = days.map(day => ({ ...day, exercises: day.exercises.map(update) }))
    const updatedBook = currentBook()
    setLibrary(nextLibrary); localStorage.setItem(libraryKey, JSON.stringify(nextLibrary))
    saveDays(nextDays)
    setBook({ ...updatedBook, routines: updatedBook.routines.map(routine => ({ ...routine, days: routine.days.map(day => ({ ...day, exercises: day.exercises.map(update) })) })) })
    if (session) save({ ...data, session: { ...session, exercises: session.exercises.map(update) } })
  }
  const skipDay = (day: string) => setConfirmation({ title: `Skip ${day}?`, message: 'This day will be skipped for the current routine cycle.', label: 'Skip day', action: () => { let completed = [...data.completed, day]; let skippedDays = [...(data.skippedDays || []), day]; const events: Omit<CycleEvent, 'id' | 'at'>[] = [{ type: 'skipped', day }]; if (completed.length >= days.length) { events.push({ type: 'rollover' }); completed = []; skippedDays = [] } recordCycle(events); save({ ...data, completed, skippedDays }); setNotice(`${day} skipped for this cycle.`) } })
  const snapshot = (): Backup => ({ version: 1, data, warmupItems, days, library, routines: currentBook() })
  const exportData = () => { const exportedAt = new Date().toISOString(); const blob = new Blob([JSON.stringify({ ...snapshot(), scope: 'workouts', exportedAt }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `one-ring-workouts-${exportedAt.replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(url) }
  const applyBackup = (parsed: Backup) => {
    const prepared = prepareRestore(parsed, days)
    const restoredDays = identifyDays(prepared.days!)
    const restoredData = prepared.data
    const restoredBook = prepared.routines!
    const restoredLibrary = prepared.library!
    const writes: [string, string][] = [[storageKey, JSON.stringify(restoredData)], [routinesKey, JSON.stringify(restoredDays)], [libraryKey, JSON.stringify(restoredLibrary)], [warmupKey, JSON.stringify(parsed.warmupItems)], [bookKey, JSON.stringify(restoredBook)]]
    const original = writes.map(([key]) => [key, localStorage.getItem(key)] as const)
    try { writes.forEach(([key, value]) => localStorage.setItem(key, value)) }
    catch (error) { original.forEach(([key, value]) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* report failure below */ } }); throw error }
    setData(restoredData); setDays(restoredDays); setBook(restoredBook); setLibrary(restoredLibrary); setWarmupItems(parsed.warmupItems); setSelectedDay('')
  }
  const restore = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 10_000_000) throw new Error('Backup is too large.')
      const parsed = parseBackup(await file.text())
      const prepared = prepareRestore(parsed, days)
      if (!await confirmAction('Replace current workout data with this backup? Export your current data first.')) return
      applyBackup(prepared); setNotice(identity.demo ? 'Backup restored for this demo.' : 'Backup loaded. Wait for saving to finish before leaving.'); setPage('home')
    } catch { void showMessage('Unable to restore this backup. The file may be invalid, incompatible, or too large. Your current workout data was not replaced.') }
  }

  useLayoutEffect(() => {
    if (!online) return
    online.onStatus = setSaveStatus
    return () => { online.onStatus = () => {} }
  }, [online])
  useLayoutEffect(() => {
    if (!online) return
    try { online.update(snapshot()) } catch { setSaveStatus('error') }
  }, [online, data, days, book, library, warmupItems])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (saveStatus !== 'saved') event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveStatus])

  return <>
    {online && (saveStatus === 'error' || saveStatus === 'conflict') && <div role="alert" className="save-recovery-overlay"><div className="save-recovery-card"><h2>{saveStatus === 'conflict' ? 'Workout data changed elsewhere' : 'Could not save workout data'}</h2><p>{saveStatus === 'conflict' ? 'This device has unsaved changes. Export them before reloading the latest server data.' : 'Your changes have not been confirmed. Check your connection and retry. Keep this page open.'} Reloading can also discard unsaved habit changes.</p>{saveStatus === 'error' && <button className="primary" onClick={() => online.retry()}>Retry save</button>}<button className="outline-button" onClick={exportData}>Export unsaved data</button> <button className="outline-button" onClick={exportHabits}>Export habits</button> <button className="outline-button" onClick={async () => { if (await confirmAction('Discard ALL unsaved workout and habit changes and reload? Export both first.')) window.location.reload() }}>Discard and reload</button></div></div>}
    {online && saveStatus === 'saving' && <div role="status" style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: '#171717', color: '#fff', padding: '8px 16px', borderRadius: 8 }}>Saving workouts…</div>}
    {confirmation && <ConfirmDialog title={confirmation.title} message={confirmation.message} confirmLabel={confirmation.label} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.action; setConfirmation(null); action() }}/> }
    <div hidden={view !== 'workout'}>
    {identity.demo && <p className="demo-example-note">Demo mode · Fictional sample workouts. Changes reset when you refresh.</p>}
    {notice && !(page === 'builder' && notice.startsWith('Workout cancelled')) && <div className="notice">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
    <nav className="workout-subnav" aria-label="Workout Tracker"><strong>Workout Tracker</strong><button className={page === 'routine' || page === 'session' ? 'active' : ''} onClick={() => setPage('routine')}>Workout</button><button className={page === 'builder' ? 'active' : ''} onClick={() => setPage('builder')}>Build routine</button><button className={page === 'library' ? 'active' : ''} onClick={() => setPage('library')}>Library</button><button className={page === 'activity' ? 'active' : ''} onClick={() => setPage('activity')}>Activity</button></nav>
    {page === 'routine' && <div className="workout-home">
      <div className="workout-home-heading"><h1>Workout<span className="accent">.</span></h1>{!session && <button className="outline-button" onClick={() => start(null)}>Start free workout</button>}</div>
      {session ? <button className="resume active-session" onClick={() => setPage('session')}><span><strong>● Workout in progress</strong><small>{session.day} · {session.exercises.filter(item => session.skipped.includes(item.name) || (session.entries[item.name] || []).filter(set => set.done).length === 3 || session.cardio?.[item.name]?.done).length} / {session.exercises.length} accounted for</small></span><span>Resume <ArrowRight size={16}/></span></button> : <section className="up-next-card"><div><span className="eyebrow muted">UP NEXT</span><h2>{nextDay.name} day</h2><p>First: {planExercises(nextDay.name, nextDay.exercises, library, rotations)[0]?.name || 'No exercises yet'}</p></div><button className="primary" onClick={() => start(nextDay)}>Start workout <ArrowRight size={16}/></button></section>}
      <div className="routine-picker"><label>Active routine<ChoiceSelect label="Active routine" value={book.active} onChange={value => switchRoutine(value)}>{book.routines.map(routine => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</ChoiceSelect></label></div>
      <div className="routine-compact-heading"><h2>Routine days</h2><span>{data.completed.length} of {days.length} days accounted for</span><button className="text-button" onClick={async () => { if (await confirmAction('Start a fresh cycle? Current cycle progress will be cleared.')) { recordCycle([{ type: 'reset' }]); save({ ...data, completed: [], skippedDays: [] }) } }}>Reset cycle</button></div>
      <div className="day-list">{days.map((day, i) => <button className={`day-row ${currentDay.name === day.name ? 'selected' : ''}`} key={day.id || day.name} onClick={() => setSelectedDay(day.name)}><span className={`day-number ${data.completed.includes(day.name) ? 'done' : ''}`}>{data.skippedDays?.includes(day.name) ? '–' : data.completed.includes(day.name) ? <Check size={16}/> : i + 1}</span><span className="day-info"><strong>{day.name} {day.name === nextDay.name && <span className="up-next">UP NEXT</span>}</strong><small>{data.skippedDays?.includes(day.name) ? 'Skipped this cycle' : data.completed.includes(day.name) ? 'Completed this cycle' : `${day.exercises.length} exercises`}</small></span><ChevronRight size={17}/></button>)}</div>
      {!session && <div className="day-preview"><div className="routine-compact-heading"><h2>{currentDay.name}</h2><span>{currentDay.exercises.length} exercises</span></div><div className="preview-exercises">{planExercises(currentDay.name, currentDay.exercises, library, rotations).map((exercise, index) => <div key={exercise.routineSlotId || index}><span>{index + 1}</span><strong>{exercise.name}</strong></div>)}</div><button className="primary wide" onClick={() => start(currentDay)}>Start {currentDay.name.toLowerCase()} day <ArrowRight size={17}/></button>{!data.completed.includes(currentDay.name) && <button className="text-button" onClick={() => skipDay(currentDay.name)}>Skip this day in the cycle</button>}</div>}
    </div>}
    {page === 'builder' && <RoutineBuilder key={book.active} days={days} library={library} rotations={rotations} routines={book.routines} activeRoutine={book.active} hasSession={Boolean(session)} onDirty={setBuilderDirty} onSave={saveRoutineDraft} onLibrary={() => setPage('library')} onNew={createRoutine} onSwitch={switchRoutine}/>}
    {page === 'library' && <ExerciseLibrary exercises={library} workouts={data.workouts} onSave={saveLibrary} onDirty={setLibraryDirty}/>}
    {page === 'session' && session && <WorkoutSession session={session} workouts={data.workouts} library={library} rotations={rotations} onChange={updateSession} onFinish={finish} onCancel={cancelSession} onDirty={setSessionDirty} onBack={() => setPage('routine')} onSetup={updateSetup}/>}
    {page === 'activity' && <Activity openLatest={reviewLatest} workouts={data.workouts} library={library} cycleHistory={book.routines.flatMap(routine => (routine.cycleHistory || []).map(event => ({ routine: event.routineName || routine.name, event })))} onSave={(workoutIndex, exerciseIndex, next) => save({ ...data, workouts: data.workouts.map((workout, index) => index === workoutIndex ? { ...workout, exercises: workout.exercises.map((item, i) => i === exerciseIndex ? next : item) } : workout) })} onSaveWorkout={(workoutIndex, next) => save({ ...data, workouts: data.workouts.map((workout, index) => index === workoutIndex ? next : workout) })}/>}
    </div>
    <div hidden={view !== 'settings'} className="settings-card backup-card"><h3>Workout backup</h3><p>Export or restore workout data only. Restoring replaces the current workout data.</p><div className="settings-actions"><button className="outline-button" onClick={exportData}><ArrowDownToLine size={16} aria-hidden="true"/> Export backup</button><label className="outline-button file-button"><RotateCcw size={16} aria-hidden="true"/> Restore backup<input type="file" accept="application/json,.json" onChange={e => { void restore(e.target.files?.[0]); e.target.value = '' }}/></label></div></div>
  </>
})
