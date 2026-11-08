import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Plus } from 'lucide-react'
import type { Exercise } from './ExerciseLibrary'
import type { Rotation } from './rotations'
import { addSessionExercise, adjacentExercise, exerciseComplete, recentPerformances, replaceSessionExercise, sessionAccountedFor, toggleSessionSkip } from './sessionLogic'
import { ResultTable } from './ResultTable'
import { ExerciseDetails } from './ExerciseDetails'

export type SetEntry = { weight: string; reps: string; done: boolean }
export type CardioEntry = { duration: string; speed: string; incline: string; done: boolean }
export type PlannedExercise = { slotId: string; name: string; exerciseId?: string; equipment: string; cycleId?: string; cycleName?: string }
export type WorkoutExercise = { id?: string; name: string; exerciseId?: string; plannedName?: string; plannedId?: string; equipmentSnapshot?: string; correctedFrom?: { name: string; exerciseId?: string; equipment?: string }; sessionSlotId?: string; source?: Exercise['sessionSource']; sets: SetEntry[]; skipped: boolean; note?: string; cardio?: CardioEntry }
export type Workout = { id?: string; day: string; dayId?: string; date: string; exercises: WorkoutExercise[]; startedAt?: string; routineId?: string; routineName?: string; plan?: PlannedExercise[] }
export type Session = { id?: string; day: string; dayId?: string; exercises: Exercise[]; entries: Record<string, SetEntry[]>; skipped: string[]; warmups: string[]; notes?: Record<string, string>; cardio?: Record<string, CardioEntry>; startedAt?: string; routineId?: string; routineName?: string; plan?: PlannedExercise[] }

const blankCardio = (): CardioEntry => ({ duration: '', speed: '', incline: '', done: false })
export const isCardio = (exercise: Exercise) => exercise.kind === 'cardio' || (!exercise.kind && /treadmill/i.test(exercise.name))
export function previousFor(workouts: Workout[], target: Exercise): WorkoutExercise | undefined {
  return recentPerformances(workouts, target, 1)[0]?.exercise
}
export function startingSets(exercise: Exercise, workouts: Workout[]): SetEntry[] {
  const previous = previousFor(workouts, exercise)
  if (previous?.sets.length === 3) return previous.sets.map(set => ({ ...set, done: false }))
  return Array.from({ length: 3 }, () => ({ weight: '', reps: '', done: false }))
}

type Props = {
  session: Session
  workouts: Workout[]
  library: Exercise[]
  rotations: Rotation[]
  onChange: (session: Session) => void
  onFinish: () => void
  onBack: () => void
  onCancel: () => void
  onDirty: (dirty: boolean) => void
  onSetup: (exercise: Exercise, note: string) => void
}

export function WorkoutSession({ session, workouts, library, rotations, onChange, onFinish, onBack, onCancel, onDirty, onSetup }: Props) {
  const [expanded, setExpanded] = useState<string | null>(() => session.exercises.find(exercise => !session.skipped.includes(exercise.name) && !exerciseComplete(session, exercise))?.name || session.exercises[0]?.name || null)
  const [drafts, setDrafts] = useState<Record<string, SetEntry[]>>({})
  const [cardioDrafts, setCardioDrafts] = useState<Record<string, CardioEntry>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [addName, setAddName] = useState('')
  const [error, setError] = useState('')
  const [setupEdit, setSetupEdit] = useState<string | null>(null)
  const [setupDraft, setSetupDraft] = useState('')
  useEffect(() => { onDirty(Boolean(Object.keys(drafts).length || Object.keys(cardioDrafts).length || setupEdit)); return () => onDirty(false) }, [drafts, cardioDrafts, setupEdit, onDirty])
  const navigate = (offset: number) => {
    if (setupEdit && !window.confirm('Discard unsaved setup changes?')) return
    const next = expanded && adjacentExercise(session, expanded, offset)
    if (next) setExpanded(next)
    setSetupEdit(null); setError('')
  }
  const updateSet = (name: string, index: number, field: 'weight' | 'reps', value: string) => {
    const stored = drafts[name] || session.entries[name] || []
    const entries = Array.from({ length: Math.max(3, stored.length) }, (_, i) => ({ ...(stored[i] || { weight: '', reps: '', done: false }), done: false }))
    entries[index] = { ...entries[index], [field]: value }
    setDrafts(current => ({ ...current, [name]: entries }))
  }
  const updateWeight = (name: string, value: string) => {
    const stored = drafts[name] || session.entries[name] || []
    setDrafts(current => ({ ...current, [name]: Array.from({ length: Math.max(3, stored.length) }, (_, i) => ({ ...(stored[i] || { reps: '', done: false }), weight: value, done: false })) }))
  }
  const updateCardio = (name: string, patch: Partial<CardioEntry>) => setCardioDrafts(current => ({ ...current, [name]: { ...(current[name] || session.cardio?.[name] || blankCardio()), ...patch } }))
  const commit = (next: Session) => {
    onChange(next); return true
  }
  const add = () => {
    const exercise = library.find(item => item.name === addName)
    if (!exercise) return
    if (setupEdit && !window.confirm('Discard unsaved setup changes and add this exercise?')) return
    if (session.exercises.some(item => item.name === exercise.name)) { setError('This exercise is already in the workout.'); return }
    const previousCardio = previousFor(workouts, exercise)?.cardio
    onChange(addSessionExercise(session, exercise, startingSets(exercise, workouts), previousCardio ? { ...previousCardio, done: false } : blankCardio()))
    setExpanded(exercise.name); setAddName(''); setSetupEdit(null); setError('')
  }
  const swap = (exercise: Exercise, replacement: Exercise | undefined, cycle?: Rotation) => {
    if (!replacement) return
    const name = replacement.name
    if (session.exercises.some(item => item.name === name)) { setError('This exercise is already in the workout.'); return }
    const entries = session.entries[exercise.name] || []
    if ((entries.some(set => set.done) || session.cardio?.[exercise.name]?.done || drafts[exercise.name] || cardioDrafts[exercise.name] || session.notes?.[exercise.name] || setupEdit) && !window.confirm('Replacing this exercise removes its result, notes and any unsaved setup edits from today’s workout. Continue?')) return
    const previousCardio = previousFor(workouts, replacement)?.cardio
    setDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
    setCardioDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
    onChange(replaceSessionExercise(session, exercise, replacement, startingSets(replacement, workouts), previousCardio ? { ...previousCardio, done: false } : blankCardio(), cycle))
    setExpanded(name); setSetupEdit(null); setError('')
  }
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Leave and resume later</button>
    <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> WORKOUT IN PROGRESS</div><h1>{session.day === 'Free workout' ? session.day : `${session.day} day`}<span className="accent">.</span></h1><p>Choose exercises in any order.</p></div><div><button className="outline-button" onClick={onCancel}>Cancel workout</button> <button className="outline-button" onClick={onFinish}>{sessionAccountedFor(session) ? 'Finish workout' : 'Finish early'} <Check size={17}/></button></div></div>
    {sessionAccountedFor(session) && <div className="notice" role="status">All exercises are accounted for. Add notes or extras, then finish the workout.</div>}
    <details className="exercise-details"><summary>About changes during a workout ⓘ</summary><p>Setup edits update this exercise in your library. Results and today’s notes are saved to this workout. Replacements and extras do not change your saved routine. Finish the workout to record cycle progress.</p></details>
    {session.exercises.length > 0 && <details className="exercise-details"><summary>Workout overview · {session.exercises.length} exercises</summary><div className="session-overview">{session.exercises.map(item => <button className="outline-button" key={item.sessionItemId || item.name} onClick={() => { if (setupEdit && !window.confirm('Discard unsaved setup changes?')) return; setSetupEdit(null); setExpanded(item.name); setError('') }}>{item.name} · {session.skipped.includes(item.name) ? 'Skipped' : exerciseComplete(session, item) ? 'Completed' : 'Not completed'}{expanded === item.name ? ' · Current' : ''}</button>)}</div></details>}
    <div className="session-layout"><section>
      {session.exercises.length === 0 && <p>Add an exercise to start this workout.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="exercise-list">{session.exercises.map((exercise, index) => {
        if (exercise.name !== expanded) return null
        const stored = drafts[exercise.name] || session.entries[exercise.name] || []
        const entries = Array.from({ length: Math.max(3, stored.length) }, (_, i) => stored[i] || { weight: '', reps: '', done: false })
        const cardio = cardioDrafts[exercise.name] || session.cardio?.[exercise.name] || blankCardio()
        const cardioType = isCardio(exercise)
        const completed = exerciseComplete(session, exercise)
        const skipped = session.skipped.includes(exercise.name)
        const previous = recentPerformances(workouts, exercise, 3)
        const cycle = rotations.find(group => group.id === exercise.rotationGroupId && exercise.id && group.options.includes(exercise.id))
        const open = expanded === exercise.name
        return <div className={`exercise-card ${open ? 'open' : ''}`} key={`${exercise.name}-${index}`}>
          <div className="exercise-header"><span className="exercise-index">{completed ? <Check size={16}/> : String(index + 1).padStart(2, '0')}</span><span className="exercise-name"><strong>{exercise.name}</strong><small>{skipped ? 'Skipped' : completed ? 'Completed' : exercise.equipment || 'Not started'} · {index + 1} of {session.exercises.length}</small></span></div>
          {open && <div className="exercise-body">
            {cycle && <div className="cycle-choice"><label>Exercise cycle · {cycle.name}<select value={exercise.id} onChange={event => swap(exercise, library.find(item => item.id === event.target.value), cycle)}>{cycle.options.map(id => { const variant = library.find(item => item.id === id); return <option key={id} value={id} disabled={!variant || (id !== exercise.id && session.exercises.some(item => item.name === variant.name))}>{variant?.name || 'Unavailable variant'}</option> })}</select></label><p>Choose a cycle variant for today. Completing it counts toward this cycle when the workout is saved.</p></div>}
            <details className="custom-sets"><summary>Replace with a different exercise today</summary><p className="entry-hint">This replaces the current exercise only for this workout. Your saved routine will not change, and the replacement will not count toward an exercise cycle.</p><label className="swap-label">Choose from library <select value="" onChange={event => swap(exercise, library.find(item => item.name === event.target.value))}><option value="">Choose an exercise</option>{library.filter(item => item.name !== exercise.name).map(item => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label></details>
            <div className="setup-note"><strong>Setup</strong>{setupEdit === exercise.name ? <><label className="session-note">Machine setup<textarea rows={5} value={setupDraft} onChange={event => setSetupDraft(event.target.value)} placeholder={'- Seat height\n- Grip and precautions'}/></label><button className="outline-button" onClick={() => { onSetup(exercise, setupDraft); setSetupEdit(null) }}>Save setup</button> <button className="text-button" onClick={() => setSetupEdit(null)}>Cancel</button></> : <><p className="setup-text">{exercise.note || 'No setup notes yet.'}</p><button className="text-button" onClick={() => { setSetupDraft(exercise.note || ''); setSetupEdit(exercise.name) }}>Edit setup</button></>}</div>
            {exercise.instructions && <p className="exercise-instructions">{exercise.instructions}</p>}
            {exercise.video && <a className="exercise-video" href={exercise.video} target="_blank" rel="noreferrer">Watch reference video ↗</a>}
            <ExerciseDetails key={exercise.id || exercise.name} exercise={exercise} workouts={workouts}/>
            <div className="previous"><strong>Recent results</strong>{previous.length ? <table className="recent-table"><thead><tr><th scope="col">Date</th><th scope="col">{cardioType ? 'Result' : 'Reps × weight'}</th></tr></thead><tbody>{previous.map(({ date, exercise: result }, i) => <tr key={`${date}-${i}`}><td>{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><ResultTable sets={result.sets} cardio={result.cardio}/>{result.note && <small className="previous-note">{result.note}</small>}</td></tr>)}</tbody></table> : <p>No previous record</p>}</div>
            <p className="entry-hint">{previous.length ? 'Previous values are a starting point. Confirm today’s result with the tick.' : 'Enter today’s result and confirm with the tick.'}</p>
            {completed && editing !== exercise.name ? <div className="result-locked"><strong>Log saved</strong><ResultTable sets={session.entries[exercise.name] || []} cardio={cardioType ? cardio : undefined}/><button className="outline-button" onClick={() => setEditing(exercise.name)}>Edit log</button></div> : <>
            {cardioType ? <div className="cardio-fields">{([['duration', 'Duration (min)'], ['speed', 'Speed (km/h)'], ['incline', 'Incline (degrees)']] as const).map(([field, label]) => <label key={field}>{label}<input type="number" min="0" step="any" value={cardio[field]} onChange={event => updateCardio(exercise.name, { [field]: event.target.value, done: false })}/></label>)}</div> : <>
              <div className="weight-stepper"><span>Weight (kg)</span><button aria-label="Decrease weight by 2.5 kilograms" onClick={() => updateWeight(exercise.name, String(Math.max(0, (Number(entries[0].weight) || 0) - 2.5)))}>−</button><input aria-label="Weight in kilograms" type="number" min="0" step="any" value={entries[0].weight} onChange={event => updateWeight(exercise.name, event.target.value)}/><button aria-label="Increase weight by 2.5 kilograms" onClick={() => updateWeight(exercise.name, String((Number(entries[0].weight) || 0) + 2.5))}>+</button></div>
              {entries.some(set => set.weight !== entries[0].weight) && <p className="entry-hint">Different set weights are recorded below. Changing the shared weight replaces them.</p>}
              <div className="rep-patterns"><span>Reps</span>{[[12,10,8],[15,12,10],[15,15,15],[10,10,8]].map(pattern => <button className="outline-button" key={pattern.join('/')} onClick={() => setDrafts(current => ({ ...current, [exercise.name]: entries.map((entry, i) => ({ ...entry, reps: String(pattern[i] ?? ''), done: false })) }))}>{pattern.join(' / ')}</button>)}</div>
              <details className="custom-sets"><summary>Custom reps or different set weights</summary>{entries.map((entry, i) => <div className="set-row three-columns" key={i}><span>Set {i + 1}</span><input aria-label={`Set ${i + 1} weight in kilograms`} type="number" min="0" step="any" value={entry.weight} onChange={event => updateSet(exercise.name, i, 'weight', event.target.value)}/><input aria-label={`Set ${i + 1} reps`} type="number" min="0" step="1" value={entry.reps} onChange={event => updateSet(exercise.name, i, 'reps', event.target.value)}/></div>)}</details>
              <p className="rep-summary">{entries.slice(0, 3).map(set => set.reps || '–').join(' / ')}</p>
            </>}
            {entries.length > 3 && !cardioType && <button className="text-button" onClick={() => { if (window.confirm('Discard extra sets from this older in-progress workout?')) setDrafts(current => ({ ...current, [exercise.name]: entries.slice(0, 3).map(set => ({ ...set, done: false })) })) }}>Remove extra sets from older workout</button>}
            <button className="primary confirm-result" aria-label="Save exercise log" onClick={() => {
              if (cardioType) {
                if (!cardio.duration || !Number.isFinite(Number(cardio.duration)) || Number(cardio.duration) < 0 || [cardio.speed, cardio.incline].some(value => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0))) { setError('Enter a valid duration and nonnegative cardio values.'); return }
                if (!commit({ ...session, skipped: session.skipped.filter(item => item !== exercise.name), cardio: { ...session.cardio, [exercise.name]: { ...cardio, done: true } } })) return
                setCardioDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
              } else {
                if (entries.length !== 3 || entries.some(set => set.reps === '' || !Number.isInteger(Number(set.reps)) || Number(set.reps) < 0 || (set.weight !== '' && (!Number.isFinite(Number(set.weight)) || Number(set.weight) < 0)))) { setError('Enter reps for all three sets. Weight can be left blank for bodyweight.'); return }
                if (!commit({ ...session, skipped: session.skipped.filter(item => item !== exercise.name), entries: { ...session.entries, [exercise.name]: entries.map(set => ({ ...set, done: true })) } })) return
                setDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
              }
              setEditing(null); setError('')
            }}><Check size={18}/> Save log</button></>}
            <label className="session-note">Today’s note<textarea placeholder="How did it feel?" value={session.notes?.[exercise.name] || ''} onChange={event => onChange({ ...session, notes: { ...session.notes, [exercise.name]: event.target.value } })}/></label>
            <div className="exercise-navigation"><button className="outline-button" disabled={session.exercises.length < 2} onClick={() => navigate(-1)}>← Previous</button><button className="outline-button" onClick={() => { if (completed && !window.confirm('Skip this exercise and remove its saved result?')) return; if (!skipped && setupEdit && !window.confirm('Discard unsaved setup changes and skip this exercise?')) return; const change = toggleSessionSkip(session, exercise, entries, cardio); if (commit(change.session) && change.next) { setSetupEdit(null); setExpanded(change.next); setError('') } }}>{skipped ? 'Undo skip' : 'Skip'}</button><button className="outline-button" disabled={session.exercises.length < 2} onClick={() => navigate(1)}>{index === session.exercises.length - 1 ? 'Go to first ↻' : 'Next →'}</button></div>
          </div>}
        </div>
      })}</div>
      <details className="add-workout-extra"><summary>Add exercise to this workout</summary><p>This adds an extra at the end of today’s workout. Your saved routine will not change.</p><div className="add-library-exercise"><label>Choose from your library<select value={addName} onChange={event => setAddName(event.target.value)}><option value="">Choose an exercise</option>{library.filter(item => !session.exercises.some(existing => existing.name === item.name)).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><button className="outline-button" onClick={add} disabled={!addName}><Plus size={16}/> Add to workout</button></div><p>To create a new exercise, use the exercise library in Build routine.</p></details>
    </section></div>
  </>
}
