import { useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Plus, X } from 'lucide-react'
import type { Exercise } from './ExerciseLibrary'

export type SetEntry = { weight: string; reps: string; done: boolean }
export type CardioEntry = { duration: string; speed: string; incline: string; done: boolean }
export type WorkoutExercise = { name: string; sets: SetEntry[]; skipped: boolean; note?: string; cardio?: CardioEntry }
export type Workout = { day: string; date: string; exercises: WorkoutExercise[] }
export type Session = { day: string; exercises: Exercise[]; entries: Record<string, SetEntry[]>; skipped: string[]; warmups: string[]; notes?: Record<string, string>; cardio?: Record<string, CardioEntry> }

const blankCardio = (): CardioEntry => ({ duration: '', speed: '', incline: '', done: false })
export const isCardio = (exercise: Exercise) => exercise.kind === 'cardio' || (!exercise.kind && /treadmill/i.test(exercise.name))
export function previousFor(workouts: Workout[], name: string): WorkoutExercise | undefined {
  return workouts.flatMap(workout => workout.exercises).find(exercise => exercise.name === name && (exercise.sets.length > 0 || exercise.cardio?.done))
}
export function startingSets(exercise: Exercise, workouts: Workout[]): SetEntry[] {
  const previous = previousFor(workouts, exercise.name)
  if (previous?.sets.length === 3) return previous.sets.map(set => ({ ...set, done: false }))
  return Array.from({ length: 3 }, () => ({ weight: '', reps: '', done: false }))
}

type Props = {
  session: Session
  workouts: Workout[]
  library: Exercise[]
  warmupItems: string[]
  onChange: (session: Session) => void
  onFinish: () => void
  onBack: () => void
  onWarmups: (items: string[]) => void
}

export function WorkoutSession({ session, workouts, library, warmupItems, onChange, onFinish, onBack, onWarmups }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [warmupText, setWarmupText] = useState('')
  const [addName, setAddName] = useState('')
  const [error, setError] = useState('')
  const updateSet = (name: string, index: number, field: 'weight' | 'reps', value: string) => {
    const stored = session.entries[name] || []
    const entries = Array.from({ length: Math.max(3, stored.length) }, (_, i) => ({ ...(stored[i] || { weight: '', reps: '', done: false }), done: false }))
    entries[index] = { ...entries[index], [field]: value }
    onChange({ ...session, entries: { ...session.entries, [name]: entries } })
  }
  const updateCardio = (name: string, patch: Partial<CardioEntry>) => onChange({ ...session, cardio: { ...session.cardio, [name]: { ...(session.cardio?.[name] || blankCardio()), ...patch } } })
  const add = () => {
    const exercise = library.find(item => item.name === addName)
    if (!exercise) return
    if (session.exercises.some(item => item.name === exercise.name)) { setError('This exercise is already in the workout.'); return }
    const previousCardio = previousFor(workouts, exercise.name)?.cardio
    onChange({ ...session, exercises: [...session.exercises, { ...exercise }], entries: { ...session.entries, [exercise.name]: startingSets(exercise, workouts) }, cardio: { ...session.cardio, [exercise.name]: previousCardio ? { ...previousCardio, done: false } : blankCardio() } })
    setExpanded(exercise.name); setAddName(''); setError('')
  }
  const swap = (exercise: Exercise, name: string) => {
    const replacement = library.find(item => item.name === name)
    if (!replacement) return
    if (session.exercises.some(item => item.name === name)) { setError('This exercise is already in the workout.'); return }
    const entries = session.entries[exercise.name] || []
    if ((entries.some(set => set.done) || session.cardio?.[exercise.name]?.done) && !window.confirm('Switching removes the completed result for this exercise. Continue?')) return
    const nextEntries = { ...session.entries }; delete nextEntries[exercise.name]; nextEntries[name] = startingSets(replacement, workouts)
    const notes = { ...session.notes }; delete notes[exercise.name]
    const cardio = { ...session.cardio }; delete cardio[exercise.name]
    const previousCardio = previousFor(workouts, replacement.name)?.cardio
    cardio[name] = previousCardio ? { ...previousCardio, done: false } : blankCardio()
    onChange({ ...session, exercises: session.exercises.map(item => item.name === exercise.name ? { ...replacement, alternatives: [exercise.name, ...(exercise.alternatives || []).filter(item => item !== name)] } : item), entries: nextEntries, notes, cardio, skipped: session.skipped.filter(item => item !== exercise.name) })
    setExpanded(name); setError('')
  }
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Back to workouts</button>
    <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> WORKOUT IN PROGRESS</div><h1>{session.day === 'Free workout' ? session.day : `${session.day} day`}<span className="accent">.</span></h1><p>Choose exercises in any order. Changes are saved on this device.</p></div><button className="primary" onClick={onFinish}>Finish workout <Check size={17}/></button></div>
    <div className="session-layout"><section>
      <details className="warmup"><summary><strong>Warmup</strong><span>{session.warmups.length} / {warmupItems.length} done</span></summary>
        {warmupItems.map(item => <div className="warmup-item" key={item}><label><input type="checkbox" checked={session.warmups.includes(item)} onChange={() => onChange({ ...session, warmups: session.warmups.includes(item) ? session.warmups.filter(x => x !== item) : [...session.warmups, item] })}/> {item}</label><button onClick={() => onWarmups(warmupItems.filter(x => x !== item))} aria-label={`Remove ${item}`}><X size={14}/></button></div>)}
        <form className="warmup-add" onSubmit={event => { event.preventDefault(); if (warmupText.trim() && !warmupItems.includes(warmupText.trim())) onWarmups([...warmupItems, warmupText.trim()]); setWarmupText('') }}><input placeholder="Add a warmup item" value={warmupText} onChange={event => setWarmupText(event.target.value)}/><button aria-label="Add warmup"><Plus size={16}/></button></form>
      </details>
      <div className="section-head compact exercise-heading"><div><div className="eyebrow muted">TODAY'S WORKOUT</div><h2>Exercises</h2></div></div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="exercise-list">{session.exercises.map((exercise, index) => {
        const stored = session.entries[exercise.name] || []
        const entries = Array.from({ length: Math.max(3, stored.length) }, (_, i) => stored[i] || { weight: '', reps: '', done: false })
        const cardio = session.cardio?.[exercise.name] || blankCardio()
        const cardioType = isCardio(exercise)
        const completed = cardioType ? cardio.done : entries.length === 3 && entries.every(set => set.done)
        const skipped = session.skipped.includes(exercise.name)
        const previous = previousFor(workouts, exercise.name)
        const open = expanded === exercise.name
        return <div className={`exercise-card ${open ? 'open' : ''}`} key={`${exercise.name}-${index}`}>
          <button className="exercise-header" onClick={() => { setExpanded(open ? null : exercise.name); setError('') }} aria-expanded={open}><span className="exercise-index">{completed ? <Check size={16}/> : String(index + 1).padStart(2, '0')}</span><span className="exercise-name"><strong>{exercise.name}</strong><small>{skipped ? 'Skipped' : completed ? 'Completed' : exercise.equipment || 'Not started'}</small></span><ChevronDown size={17} className={open ? 'rotated' : ''}/></button>
          {open && <div className="exercise-body">
            {exercise.note && <div className="setup-note"><strong>Setup</strong> {exercise.note}</div>}
            {exercise.instructions && <p className="exercise-instructions">{exercise.instructions}</p>}
            {exercise.video && <a className="exercise-video" href={exercise.video} target="_blank" rel="noreferrer">Watch reference video ↗</a>}
            <div className="previous">PREVIOUS <strong>{previous ? previous.cardio?.done ? `${previous.cardio.duration} min · ${previous.cardio.speed} km/h · ${previous.cardio.incline}°` : previous.sets.map(set => `${set.weight || '0'} kg × ${set.reps}`).join(' / ') : 'No previous record'}</strong>{previous?.note && <p className="previous-note">{previous.note}</p>}</div>
            <label className="swap-label">Swap exercise <select value="" onChange={event => swap(exercise, event.target.value)}><option value="">Choose from library</option>{library.filter(item => item.name !== exercise.name).map(item => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label>
            <p className="entry-hint">{previous ? 'Values from your last workout are a starting point. Confirm after performing the exercise.' : 'Enter today’s result, then complete the exercise.'}</p>
            {cardioType ? <div className="cardio-fields">{([['duration', 'Duration (min)'], ['speed', 'Speed (km/h)'], ['incline', 'Incline (degrees)']] as const).map(([field, label]) => <label key={field}>{label}<input type="number" min="0" step="any" value={cardio[field]} onChange={event => updateCardio(exercise.name, { [field]: event.target.value, done: false })}/></label>)}</div> : <><div className="set-head"><span>SET</span><span>WEIGHT (KG)</span><span>REPS</span></div>{entries.map((entry, i) => <div className="set-row three-columns" key={i}><span>{i + 1}</span><input aria-label={`Set ${i + 1} weight in kilograms`} type="number" min="0" step="any" value={entry.weight} onChange={event => updateSet(exercise.name, i, 'weight', event.target.value)}/><input aria-label={`Set ${i + 1} reps`} type="number" min="0" step="1" value={entry.reps} onChange={event => updateSet(exercise.name, i, 'reps', event.target.value)}/></div>)}</>}
            {entries.length > 3 && !cardioType && <button className="text-button" onClick={() => { if (window.confirm('Discard extra sets from this older in-progress workout?')) onChange({ ...session, entries: { ...session.entries, [exercise.name]: entries.slice(0, 3).map(set => ({ ...set, done: false })) } }) }}>Remove extra sets from older workout</button>}
            <label className="session-note">Notes<textarea placeholder="How did it feel?" value={session.notes?.[exercise.name] || ''} onChange={event => onChange({ ...session, notes: { ...session.notes, [exercise.name]: event.target.value } })}/></label>
            <button className="primary wide complete-exercise" onClick={() => {
              if (cardioType) {
                if (!completed && !cardio.duration) { setError('Enter the duration before completing cardio.'); return }
                onChange({ ...session, skipped: session.skipped.filter(item => item !== exercise.name), cardio: { ...session.cardio, [exercise.name]: { ...cardio, done: !completed } } })
              } else {
                if (!completed && (entries.length !== 3 || entries.some(set => set.reps === '' || !Number.isInteger(Number(set.reps)) || Number(set.reps) < 0 || (set.weight !== '' && Number(set.weight) < 0)))) { setError('Enter reps for all three sets. Weight can be left blank for bodyweight.'); return }
                onChange({ ...session, skipped: session.skipped.filter(item => item !== exercise.name), entries: { ...session.entries, [exercise.name]: entries.map(set => ({ ...set, done: !completed })) } })
              }
              setError(''); if (!completed) setExpanded(null)
            }}>{completed ? 'Edit completed exercise' : 'Complete exercise'} <Check size={16}/></button>
            <button className="text-button" onClick={() => { const nextEntries = entries.map(set => ({ ...set, done: false })); onChange({ ...session, skipped: skipped ? session.skipped.filter(item => item !== exercise.name) : [...session.skipped, exercise.name], entries: { ...session.entries, [exercise.name]: nextEntries }, cardio: { ...session.cardio, [exercise.name]: { ...cardio, done: false } } }); setExpanded(null) }}>{skipped ? 'Undo skip' : 'Skip exercise'}</button>
          </div>}
        </div>
      })}</div>
      <div className="add-library-exercise"><label>Add an exercise<select value={addName} onChange={event => setAddName(event.target.value)}><option value="">Choose from your library</option>{library.filter(item => !session.exercises.some(existing => existing.name === item.name)).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><button className="outline-button" onClick={add} disabled={!addName}><Plus size={16}/> Add</button></div>
    </section></div>
  </>
}
