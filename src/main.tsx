import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronRight, Circle, Dumbbell, Flame, Home, ListChecks, MoreHorizontal, Plus, RotateCcw, Settings2, Sparkles, X } from 'lucide-react'
import './style.css'
import { AuthGate } from './auth'
import { ExerciseLibrary, type Exercise } from './workout/ExerciseLibrary'
import { WorkoutSession, startingSets, previousFor, type Session, type Workout } from './workout/WorkoutSession'
import { WorkoutStats } from './workout/WorkoutStats'
import { parseBackup, type Backup } from './workout/backup'
import { SyncPanel } from './sync/SyncPanel'
import { advanceRotations, planExercises, type Rotation } from './workout/rotations'
import { sessionAccountedFor } from './workout/sessionLogic'
import { WorkoutReview } from './workout/WorkoutReview'
import { RoutineBuilder, type RoutineDay } from './workout/RoutineBuilder'
import { mapCycleDays } from './workout/routineDraft'
import { ConfirmDialog } from './ConfirmDialog'

type Day = { name: string; subtitle: string; exercises: Exercise[] }
type Data = { completed: string[]; skippedDays?: string[]; workouts: Workout[]; session: Session | null }
type RoutineBook = { active: string; routines: { id: string; name: string; days: Day[]; completed: string[]; skippedDays?: string[]; rotations?: Rotation[] }[] }

const sampleDays: Day[] = [
  { name: 'Push', subtitle: 'Chest, shoulders & triceps', exercises: [
    { name: 'Chest press', equipment: 'Chest press machine', sets: '30 kg · 12 / 10 / 8', note: 'Seat 4 · Side grip' },
    { name: 'Shoulder press', equipment: 'Shoulder press machine', sets: '20 kg · 12 / 10 / 8', note: 'Keep shoulders relaxed' },
    { name: 'Chest fly', equipment: 'Pec deck machine', sets: '25 kg · 12 / 10 / 8' },
    { name: 'Tricep pushdown', equipment: 'Cable machine', sets: '20 kg · 12 / 10 / 8', alternatives: ['Overhead tricep extension', 'Seated tricep press'] },
    { name: 'Lateral raises', equipment: 'Dumbbells', sets: '5 kg · 12 / 10 / 8' },
  ]},
  { name: 'Pull', subtitle: 'Back, biceps & rear delts', exercises: [
    { name: 'Seated row', equipment: 'Row machine', sets: '30 kg · 12 / 10 / 8' }, { name: 'Lat pulldown', equipment: 'Cable machine', sets: '25 kg · 12 / 10 / 8' }, { name: 'Shrugs', equipment: 'Dumbbells', sets: '10 kg · 12 / 10 / 8' }, { name: 'Hammer curls', equipment: 'Dumbbells', sets: '6 kg · 12 / 10 / 8', alternatives: ['Bicep curls'] }, { name: 'Rear delt fly', equipment: 'Pec deck machine', sets: '15 kg · 12 / 10 / 8' },
  ]},
  { name: 'Accessories', subtitle: 'Arms, core & cardio', exercises: [
    { name: 'Overhead tricep extension', equipment: 'Cable machine', sets: '15 kg · 12 / 10 / 8' }, { name: 'Bicep curls', equipment: 'Dumbbells', sets: '6 kg · 12 / 10 / 8' }, { name: 'Lower back extension', equipment: 'Lower back machine', sets: '25 kg · 12 / 10 / 8' }, { name: 'Weighted crunches', equipment: 'Crunch machine', sets: '20 kg · 12 / 10 / 8' }, { name: 'Incline treadmill walk', equipment: 'Treadmill', sets: '5 km/h · 8° · 20 min', note: '2 min ramp-up and cooldown' },
  ]},
  { name: 'Legs', subtitle: 'Quads, glutes & hamstrings', exercises: [
    { name: 'Leg press', equipment: 'Leg press machine', sets: '60 kg · 12 / 10 / 8' }, { name: 'Leg extension', equipment: 'Leg extension machine', sets: '30 kg · 12 / 10 / 8' }, { name: 'Hamstring curls', equipment: 'Leg curl machine', sets: '25 kg · 12 / 10 / 8' }, { name: 'Hip abduction', equipment: 'Hip machine', sets: '30 kg · 12 / 10 / 8', alternatives: ['Hip adduction'] }, { name: 'Hip thrust', equipment: 'Hip thrust machine', sets: '30 kg · 12 / 10 / 8' }, { name: 'Calf raises', equipment: 'Calf raise machine', sets: '30 kg · 12 / 10 / 8' },
  ]},
]
const initial: Data = { completed: ['Push'], workouts: [], session: null }
const key = 'one-ring-demo-v1'
function load(storageKey: string): Data { try { const data = JSON.parse(localStorage.getItem(storageKey) || 'null'); return data && Array.isArray(data.completed) && Array.isArray(data.workouts) ? data : initial } catch { return initial } }
function App({ identity, signOut }: { identity: { id: string; email: string; demo: boolean }; signOut: () => void }) {
  const storageKey = identity.demo ? key : `one-ring-user-${identity.id}`
  const warmupKey = `${storageKey}-warmups`
  const [hasLocalData] = useState(() => localStorage.getItem(storageKey) !== null || localStorage.getItem(`${storageKey}-routine`) !== null || localStorage.getItem(`${storageKey}-library`) !== null)
  const [data, setData] = useState<Data>(() => {
    const loaded = identity.demo ? load(storageKey) : (() => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null') || { completed: [], workouts: [], session: null } } catch { return { completed: [], workouts: [], session: null } } })()
    const normalized = { ...loaded, workouts: loaded.workouts.map((workout: Workout) => ({ ...workout, id: workout.id || crypto.randomUUID() })) }
    if (normalized.workouts.some((workout: Workout, index: number) => workout.id !== loaded.workouts[index].id)) localStorage.setItem(storageKey, JSON.stringify(normalized))
    return normalized
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('one-ring-theme') || 'lime')
  const routinesKey = `${storageKey}-routine`
  const [days, setDays] = useState<Day[]>(() => { try { const saved = JSON.parse(localStorage.getItem(routinesKey) || 'null'); return Array.isArray(saved) && saved.length ? saved : sampleDays } catch { return sampleDays } })
  const saveDays = (next: Day[]) => { setDays(next); localStorage.setItem(routinesKey, JSON.stringify(next)) }
  const bookKey = `${storageKey}-routine-book`
  const [book, setBook] = useState<RoutineBook>(() => {
    try { const saved = JSON.parse(localStorage.getItem(bookKey) || 'null'); if (saved && Array.isArray(saved.routines) && saved.routines.some((r: { id: string }) => r.id === saved.active)) return saved } catch { /* keep legacy routine */ }
    return { active: 'initial', routines: [{ id: 'initial', name: 'My routine', days, completed: data.completed }] }
  })
  const currentBook = (): RoutineBook => ({ ...book, routines: book.routines.map(routine => routine.id === book.active ? { ...routine, days, completed: data.completed, skippedDays: data.skippedDays || [] } : routine) })
  const rotations = book.routines.find(routine => routine.id === book.active)?.rotations || []
  const saveRotations = (next: Rotation[]) => { const updated = currentBook(); setBook({ ...updated, routines: updated.routines.map(routine => routine.id === updated.active ? { ...routine, rotations: next } : routine) }) }
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
      return updated ? { ...updated, alternatives: (exercise.alternatives || []).map(a => renames.get(a) || a) } : exercise
    }) }))
    // Bind legacy name-based records before a rename; snapshots keep their old names.
    if (renames.size) {
      const workouts = data.workouts.map(workout => ({ ...workout, exercises: workout.exercises.map(exercise => ({ ...exercise, exerciseId: exercise.exerciseId || library.find(item => item.name === exercise.name)?.id })) }))
      const session = data.session ? { ...data.session, exercises: data.session.exercises.map(exercise => ({ ...exercise, id: exercise.id || library.find(item => item.name === exercise.name)?.id })) } : null
      save({ ...data, workouts, session })
    }
    saveDays(updatedDays); setLibrary(next); localStorage.setItem(libraryKey, JSON.stringify(next))
  }
  const [page, setPageState] = useState<'home' | 'routine' | 'builder' | 'library' | 'session' | 'activity' | 'settings'>('home')
  const [builderDirty, setBuilderDirty] = useState(false)
  const [sessionDirty, setSessionDirty] = useState(false)
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; label: string; action: () => void } | null>(null)
  const setPage = (next: typeof page) => {
    if (page === 'builder' && next !== 'builder' && builderDirty) {
      setConfirmation({ title: 'Discard routine draft?', message: 'Your unsaved routine changes will be lost.', label: 'Discard and leave', action: () => { setBuilderDirty(false); setPageState(next) } }); return
    }
    if (page === 'session' && next !== 'session' && sessionDirty) { setConfirmation({ title: 'Leave workout?', message: 'Unconfirmed log and setup edits will be discarded. Confirmed entries remain in the workout.', label: 'Leave workout', action: () => setPageState(next) }); return }
    setPageState(next)
  }
  const [selectedDay, setSelectedDay] = useState('')
  const [warmupItems, setWarmupItems] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(warmupKey) || (identity.demo ? localStorage.getItem('one-ring-warmups') : null) || 'null') || ['A little movement', 'Get the joints moving'] } catch { return ['A little movement', 'Get the joints moving'] } })
  const [notice, setNotice] = useState('')
  const save = (next: Data) => { setData(next); localStorage.setItem(storageKey, JSON.stringify(next)) }
  const remaining = days.filter(day => !data.completed.includes(day.name))
  const nextDay = remaining[0] || days[0]
  const currentDay = days.find(day => day.name === selectedDay) || nextDay
  const session = data.session
  const updateSession = (next: Session) => {
    if (sessionAccountedFor(next)) finishSession(next)
    else save({ ...data, session: next })
  }
  const saveRoutineDraft = (nextDays: RoutineDay[], nextRotations: Rotation[], names: Record<string, string | null>, baseline: string) => {
    if (session) { setNotice('Finish or cancel the active workout before saving routine changes.'); return false }
    if (baseline !== JSON.stringify({ days, rotations })) { setNotice('The saved routine changed while editing. Your draft has not been applied; review it before retrying.'); return false }
    const nextData = { ...data, completed: mapCycleDays(data.completed, names), skippedDays: mapCycleDays(data.skippedDays || [], names) }
    const updated = currentBook()
    const nextBook = { ...updated, routines: updated.routines.map(routine => routine.id === updated.active ? { ...routine, days: nextDays, completed: nextData.completed, skippedDays: nextData.skippedDays, rotations: nextRotations } : routine) }
    const writes: [string, string][] = [[storageKey, JSON.stringify(nextData)], [routinesKey, JSON.stringify(nextDays)], [bookKey, JSON.stringify(nextBook)]]
    const original = writes.map(([key]) => [key, localStorage.getItem(key)] as const)
    try { writes.forEach(([key, value]) => localStorage.setItem(key, value)) } catch { original.forEach(([key, value]) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* best effort */ } }); setNotice('Could not save routine changes. Export a backup and check browser storage.'); return false }
    setDays(nextDays); setData(nextData); setBook(nextBook); setSelectedDay(names[selectedDay] || ''); setNotice('Routine changes saved.'); return true
  }
  const switchRoutine = (id: string) => {
    if (data.session) { window.alert('Finish your current workout before switching routines.'); return }
    const updated = currentBook()
    const target = updated.routines.find(routine => routine.id === id)
    if (!target) return
    setBook({ ...updated, active: id }); saveDays(target.days); save({ ...data, completed: target.completed, skippedDays: target.skippedDays || [] }); setSelectedDay('')
  }
  const createRoutine = (name: string) => {
    if (data.session) { window.alert('Finish your current workout before switching routines.'); return }
    const routine = { id: crypto.randomUUID(), name, days: [{ name: 'Day 1', subtitle: '', exercises: [] }], completed: [] as string[] }
    const updated = currentBook(); setBook({ active: routine.id, routines: [...updated.routines, routine] }); saveDays(routine.days); save({ ...data, completed: [], skippedDays: [] }); setSelectedDay('')
  }
  const start = (day: Day | null) => {
    if (session) { setPage('session'); setNotice('Resume your workout in progress.'); return }
    const exercises = day ? planExercises(day.name, day.exercises, library, rotations) : []
    if (new Set(exercises.map(exercise => exercise.name)).size !== exercises.length) { window.alert('This rotation produces the same exercise twice on this day. Adjust the routine or rotation before starting.'); return }
    save({ ...data, session: { day: day?.name || 'Free workout', exercises, entries: Object.fromEntries(exercises.map(e => [e.name, startingSets(e, data.workouts)])), skipped: [], warmups: [], cardio: Object.fromEntries(exercises.map(e => { const prev = previousFor(data.workouts, e)?.cardio; return [e.name, prev ? { ...prev, done: false } : { duration: '', speed: '', incline: '', done: false }] })) } })
    setPage('session')
  }
  const finishSession = (finished: Session) => {
    const workout: Workout = { id: crypto.randomUUID(), day: finished.day, date: new Date().toISOString(), exercises: finished.exercises.map(e => ({ name: e.name, exerciseId: e.id || library.find(item => item.name === e.name)?.id, plannedName: e.plannedName, plannedId: e.plannedId, sets: (finished.entries[e.name] || []).filter(s => s.done), skipped: finished.skipped.includes(e.name), note: finished.notes?.[e.name], cardio: finished.cardio?.[e.name]?.done ? finished.cardio[e.name] : undefined })) }
    const completedNames = workout.exercises.filter(exercise => exercise.sets.length === 3 || exercise.cardio?.done).map(exercise => exercise.name)
    saveRotations(advanceRotations(rotations, finished.exercises, completedNames))
    let completed = [...data.completed]
    const hasResults = completedNames.length > 0
    const allSkipped = finished.exercises.length > 0 && finished.exercises.every(exercise => finished.skipped.includes(exercise.name))
    if ((hasResults || allSkipped) && days.some(d => d.name === finished.day) && !completed.includes(finished.day)) completed.push(finished.day)
    let skippedDays = (data.skippedDays || []).filter(name => name !== finished.day)
    if (allSkipped) skippedDays = [...skippedDays, finished.day]
    if (completed.length === days.length) { completed = []; skippedDays = []; setNotice('Cycle complete. A fresh cycle is ready for you.') } else setNotice('Workout saved. Nice work showing up!')
    save({ completed, skippedDays, workouts: [workout, ...data.workouts], session: null }); setSessionDirty(false); setPageState('activity')
  }
  const finish = () => {
    if (!session) return
    setConfirmation({ title: 'Finish workout early?', message: `Unfinished exercises will not be saved as completed.${sessionDirty ? ' Unconfirmed result and setup edits will be discarded.' : ''}`, label: 'Finish workout', action: () => finishSession(session) })
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
  const skipDay = (day: string) => setConfirmation({ title: `Skip ${day}?`, message: 'This day will be skipped for the current routine cycle.', label: 'Skip day', action: () => { let completed = [...data.completed, day]; let skippedDays = [...(data.skippedDays || []), day]; if (completed.length >= days.length) { completed = []; skippedDays = [] } save({ ...data, completed, skippedDays }); setNotice(`${day} skipped for this cycle.`) } })
  const snapshot = (): Backup => ({ version: 1, data, warmupItems, days, library, routines: currentBook() })
  const exportData = () => { const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'one-ring-backup.json'; a.click(); URL.revokeObjectURL(url) }
  const applyBackup = (parsed: Backup) => {
    const restoredDays = parsed.days || days
    const restoredData = { ...parsed.data, workouts: parsed.data.workouts.map(workout => ({ ...workout, id: workout.id || crypto.randomUUID() })) }
    const restoredBook: RoutineBook = parsed.routines || { active: 'initial', routines: [{ id: 'initial', name: 'Restored routine', days: restoredDays, completed: restoredData.completed }] }
    const exercises = parsed.library || restoredDays.flatMap(day => day.exercises).filter((exercise, index, list) => list.findIndex(item => item.name === exercise.name) === index)
    const restoredLibrary = exercises.map(exercise => ({ ...exercise, id: exercise.id || crypto.randomUUID() }))
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
      if (!window.confirm('Replace local workout data for this account on this device with this backup? Export your current data first.')) return
      applyBackup(parsed); setNotice('Backup restored.'); setPage('home')
    } catch { window.alert('Unable to restore this backup. Check the file and available browser storage; your data may require a previous export if storage failed.') }
  }

  return <div className="app-shell" data-theme={theme}>
    {confirmation && <ConfirmDialog title={confirmation.title} message={confirmation.message} confirmLabel={confirmation.label} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.action; setConfirmation(null); action() }}/> }
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><span /></span><span>the one ring<small>YOUR SPACE TO GROW</small></span></div><div className="sidebar-label">YOUR SPACE</div><button className={`side-link ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}><Home size={18}/> Home</button><button className={`side-link ${page === 'routine' || page === 'builder' || page === 'library' || page === 'session' ? 'active' : ''}`} onClick={() => setPage('routine')}><Dumbbell size={18}/> Workouts <span className="side-arrow">↗</span></button><div className="sidebar-bottom"><div className="demo-card"><Sparkles size={16}/><strong>A little better,<br/>every day.</strong><p>Small steps add up to something great.</p></div><button className="profile" onClick={() => setPage('settings')}><span className="avatar">D</span><span><strong>{identity.demo ? "Demo user" : identity.email}</strong><small>{identity.demo ? "Demo mode" : "Local data only"}</small></span><MoreHorizontal size={19}/></button></div></aside>
    <main className="main"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><span/></span> the one ring</div><div className="breadcrumb">YOUR SPACE <ChevronRight size={13}/> <span>{page === 'home' ? 'Overview' : page === 'settings' ? 'Settings' : 'Workout Tracker'}</span></div><button className="top-profile" onClick={() => setPage('settings')}><span className="status-dot"/> {identity.demo ? "Demo mode" : "Local only"} <span className="avatar small">{identity.demo ? "D" : identity.email[0].toUpperCase()}</span></button></header>
    <div className="content">{notice && <div className="notice">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
    {page !== 'home' && page !== 'settings' && <nav className="workout-subnav" aria-label="Workout Tracker"><strong>Workout Tracker</strong><button className={page === 'routine' || page === 'session' ? 'active' : ''} onClick={() => setPage('routine')}>Workout</button><button className={page === 'builder' || page === 'library' ? 'active' : ''} onClick={() => setPage('builder')}>Build routine</button><button className={page === 'activity' ? 'active' : ''} onClick={() => setPage('activity')}>Activity</button></nav>}
    {page === 'home' && <><div className="greeting"><div><div className="eyebrow"><span className="live-dot"/> YOUR PERSONAL SPACE</div><h1>Your apps<span className="accent">.</span></h1><p>Everything you need, together in one place.</p></div><div className="date-pill"><span>✳</span> YOUR SPACE, YOUR PACE</div></div>
      <div className="section-head"><div><div className="eyebrow muted">THE DAILY LINEUP</div><h2>Choose an app</h2></div><span className="section-aside">A little something for you <span>✳</span></span></div>
      <div className="dashboard-grid"><div className="workout-card"><div className="card-top"><div className="icon-box"><Dumbbell size={22}/></div><span className="card-tag"><span/> READY WHEN YOU ARE</span></div><div className="workout-card-body"><div className="eyebrow">YOUR WORKOUT SPACE</div><h3>Workout<br/><em>tracker.</em></h3><p>Build routines and keep a record of your workouts.</p><button className="primary" onClick={() => setPage('routine')}>Go to workouts <ArrowUpRight size={17}/></button></div><div className="card-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-center"><Dumbbell size={49} strokeWidth={1.1}/></div><span className="art-star">✳</span><span className="art-plus">+</span></div><div className="card-footer"><span>UP NEXT</span><strong>{nextDay.name} day</strong></div></div>
      <div className="side-stack"><div className="coming-card"><div className="coming-icon"><ListChecks size={20}/></div><span className="soon">COMING LATER</span><h3>Habit<br/>tracker.</h3><p>A place for the habits you want to keep.</p><span className="quiet-link">Not available yet</span></div><div className="quote-card"><span className="quote-star">✳</span><p>“You don’t have to do it all. Just start somewhere.”</p><span>A LITTLE REMINDER</span></div></div></div>
      <div className="bottom-note"><span>✳</span> MADE FOR YOUR EVERYDAY <span className="bottom-right">ONE DAY AT A TIME ↗</span></div></>}
    {page === 'routine' && <><div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> YOUR WORKOUT SPACE</div><h1>Start a workout<span className="accent">.</span></h1><p>Choose a routine day or start a free workout.</p></div><button className="outline-button" onClick={() => start(null)}><Plus size={16}/> Free workout</button></div>
      {session && <button className="resume" onClick={() => setPage('session')}><span><strong>Workout in progress</strong><small>{session.day} · Pick up where you left off</small></span><span>Resume <ArrowRight size={16}/></span></button>}
      {!session && <section className="up-next-card"><div><span className="eyebrow muted">UP NEXT</span><h2>{nextDay.name} day</h2><p>First: {planExercises(nextDay.name, nextDay.exercises, library, rotations)[0]?.name || 'No exercises yet'}</p></div><button className="primary" onClick={() => start(nextDay)}>Start workout <ArrowRight size={16}/></button></section>}
      <div className="routine-picker"><label>Active routine<select value={book.active} onChange={event => switchRoutine(event.target.value)}>{book.routines.map(routine => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label></div>
      <div className="routine-layout"><section><div className="section-head compact"><div><div className="eyebrow muted">YOUR CURRENT ROUTINE</div><h2>{book.routines.find(routine => routine.id === book.active)?.name || 'Your routine'} <span className="routine-badge">ACTIVE</span></h2><p>Choose any day, at your own pace.</p></div></div><div className="round-bar"><div><span className="round-icon"><RotateCcw size={16}/></span><span><strong>Your current cycle</strong><small>{data.completed.length} of {days.length} days accounted for</small></span></div><button onClick={() => { if (window.confirm('Start a fresh cycle? Current cycle progress will be cleared.')) save({ ...data, completed: [], skippedDays: [] }) }}>Reset cycle</button></div><div className="day-list">{days.map((day, i) => <button className={`day-row ${currentDay.name === day.name ? 'selected' : ''}`} key={day.name} onClick={() => setSelectedDay(day.name)}><span className={`day-number ${data.completed.includes(day.name) ? 'done' : ''}`}>{data.skippedDays?.includes(day.name) ? '–' : data.completed.includes(day.name) ? <Check size={16}/> : `0${i + 1}`}</span><span className="day-info"><strong>{day.name} day {day.name === nextDay.name && <span className="up-next">UP NEXT</span>}</strong><small>{data.skippedDays?.includes(day.name) ? 'Skipped this cycle' : data.completed.includes(day.name) ? 'Completed this cycle' : day.subtitle}</small></span><span className="day-count">{day.exercises.length} exercises</span><ChevronRight size={17}/></button>)}</div><div className="helper"><Sparkles size={16}/><span>Life doesn’t follow a schedule. Choose any day, any time.</span></div></section>
      <aside className="detail-panel"><div className="detail-top"><span className="eyebrow muted">THE GAME PLAN</span><span className="detail-number">0{days.indexOf(currentDay) + 1}</span></div><h2>{currentDay.name} day<span className="accent">.</span></h2><p>{currentDay.subtitle}</p><div className="detail-divider"/><div className="detail-label">ON THE LIST <span>{currentDay.exercises.length} EXERCISES</span></div><div className="preview-exercises">{planExercises(currentDay.name, currentDay.exercises, library, rotations).map((e, i) => <div key={e.name}><span>{String(i + 1).padStart(2, '0')}</span><strong>{e.name}</strong></div>)}</div><button className="primary wide" onClick={() => start(currentDay)}>Start {currentDay.name.toLowerCase()} day <ArrowRight size={17}/></button>{!data.completed.includes(currentDay.name) && <button className="text-button" onClick={() => skipDay(currentDay.name)}>Skip this day in the cycle</button>}<p className="detail-hint">Switch things up anytime. This is your workout.</p></aside></div></>}
    {page === 'builder' && <RoutineBuilder key={book.active} days={days} library={library} rotations={rotations} routines={book.routines} activeRoutine={book.active} hasSession={Boolean(session)} onDirty={setBuilderDirty} onSave={saveRoutineDraft} onBack={() => setPage('routine')} onLibrary={() => setPage('library')} onNew={createRoutine} onSwitch={switchRoutine} onCancelWorkout={() => { save({ ...data, session: null }); setSessionDirty(false); setNotice('Workout cancelled. Your routine draft is unchanged.') }}/>}
    {page === 'library' && <ExerciseLibrary exercises={library} onSave={saveLibrary} onBack={() => setPage('builder')}/>}
    {page === 'session' && session && <WorkoutSession session={session} workouts={data.workouts} library={library} rotations={rotations} onChange={updateSession} onFinish={finish} onCancel={cancelSession} onDirty={setSessionDirty} onBack={() => setPage('routine')} onSetup={updateSetup}/>}
    {page === 'activity' && data.workouts[0] && <section className="latest-review"><h2>Latest workout</h2><p>{data.workouts[0].day} · {new Date(data.workouts[0].date).toLocaleDateString()}</p>{data.workouts[0].exercises.map((exercise, index) => <WorkoutReview key={`${data.workouts[0].id}-${index}`} exercise={exercise} onSave={next => save({ ...data, workouts: data.workouts.map((workout, workoutIndex) => workoutIndex === 0 ? { ...workout, exercises: workout.exercises.map((item, itemIndex) => itemIndex === index ? next : item) } : workout) })}/>)}</section>}
    {page === 'activity' && <><div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> YOUR JOURNEY</div><h1>Every bit counts<span className="accent">.</span></h1><p>A little look back at the work you’ve put in.</p></div></div><WorkoutStats workouts={data.workouts}/><div className="section-head compact"><div><div className="eyebrow muted">THE HISTORY BOOKS</div><h2>Recent workouts</h2></div></div>{data.workouts.length === 0 ? <div className="empty-state"><Circle size={25}/><h3>A fresh start.</h3><p>Your completed workouts will show up here.</p><button className="outline-button" onClick={() => setPage('routine')}>Explore workouts <ArrowRight size={16}/></button></div> : <div className="history-list">{data.workouts.map((w, i) => <div className="history-card" key={i}><span className="history-icon"><Dumbbell size={18}/></span><div><strong>{w.day === 'Free workout' ? w.day : `${w.day} day`}</strong><small>{new Date(w.date).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {w.exercises.reduce((n, e) => n + e.sets.length, 0)} sets completed</small><div className="history-details">{w.exercises.filter(e => e.sets.length || e.cardio?.done).map(e => e.cardio?.done ? `${e.name}: ${e.cardio.duration} min, ${e.cardio.speed || '–'} km/h, ${e.cardio.incline || '–'}°${e.note ? ` (${e.note})` : ''}` : `${e.name}: ${e.sets.map(s => `${s.weight || '0'} kg × ${s.reps}`).join(', ')}${e.note ? ` (${e.note})` : ''}`).join(' · ') || 'No exercises completed'}</div></div></div>)}</div>}</>}
    {page === 'settings' && <><div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> YOUR SETTINGS</div><h1>Make yourself at home<span className="accent">.</span></h1><p>A few things about your space.</p></div></div><div className="settings-card"><div className="settings-row"><span className="avatar">D</span><div><strong>{identity.demo ? "Demo user" : identity.email}</strong><small>Workout data is stored only in this browser.</small></div></div><div className="detail-divider"/><h3>Appearance</h3><p>Choose an accent color for your space.</p><div className="theme-options">{[['lime', 'Lime'], ['blue', 'Blue'], ['violet', 'Violet'], ['coral', 'Coral']].map(([value, label]) => <button key={value} className={`theme-choice ${theme === value ? 'selected' : ''}`} onClick={() => { setTheme(value); localStorage.setItem('one-ring-theme', value) }}><span className={`theme-swatch ${value}`}/>{label}</button>)}</div><div className="detail-divider"/><h3>Your data, your way</h3><p>Export a backup to keep it safe, or restore a previous backup on this device. Restoring replaces the current local data.</p><div className="settings-actions"><button className="outline-button" onClick={exportData}><ArrowDownToLine size={16}/> Export backup</button><label className="outline-button file-button"><RotateCcw size={16}/> Restore backup<input type="file" accept="application/json,.json" onChange={e => { void restore(e.target.files?.[0]); e.target.value = '' }}/></label></div><div className="demo-warning"><strong>Just a heads up</strong><p>{identity.demo ? "This is a local demo." : "You are signed in, but your workout data is local only."} {identity.demo ? "Demo workouts stay on this device." : "Cloud sync is experimental and must be configured below."} Clearing browser data can delete your workouts, so export a backup.</p></div><button className="outline-button signout" onClick={() => { if (identity.demo || window.confirm("Before signing out, sync and export a backup. Unsynced work stays on this device. Sign out?")) signOut() }}>{identity.demo ? "Exit demo" : "Sign out"}</button></div></>}
    {!identity.demo && <div hidden={page !== 'settings'}><SyncPanel owner={identity.id} snapshot={snapshot()} hasLocalData={hasLocalData} onImport={applyBackup}/></div>}
    </div></main><nav className="mobile-nav"><button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}><Home size={19}/>Home</button><button className={page === 'routine' || page === 'builder' || page === 'library' || page === 'session' ? 'active' : ''} onClick={() => setPage('routine')}><Dumbbell size={19}/>Workouts</button><button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}><Settings2 size={19}/>Settings</button></nav>
  </div>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthGate>{(identity, signOut) => <App key={identity.id} identity={identity} signOut={signOut}/>}</AuthGate></React.StrictMode>)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(error => console.error('Offline shell registration failed:', error))
  })
}
