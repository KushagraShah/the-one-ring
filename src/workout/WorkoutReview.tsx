import { useState } from 'react'
import type { WorkoutExercise } from './WorkoutSession'

export function WorkoutReview({ exercise, onSave }: { exercise: WorkoutExercise; onSave: (next: WorkoutExercise) => void }) {
  const [editing, setEditing] = useState(false)
  const [sets, setSets] = useState(exercise.sets)
  const [note, setNote] = useState(exercise.note || '')
  const [error, setError] = useState('')
  const [cardio, setCardio] = useState(exercise.cardio)
  if (!exercise.sets.length && !exercise.cardio?.done) return null
  return <div className="review-exercise"><strong>{exercise.name}</strong>{exercise.plannedName && exercise.plannedName !== exercise.name && <span>Substituted for {exercise.plannedName}</span>}{editing ? <>
    {cardio ? <div className="cardio-fields">{(['duration', 'speed', 'incline'] as const).map(field => <label key={field}>{field}<input type="number" min="0" step="any" value={cardio[field]} onChange={event => setCardio({ ...cardio, [field]: event.target.value })}/></label>)}</div> : sets.map((set, i) => <div className="set-row three-columns" key={i}><span>Set {i + 1}</span><input type="number" min="0" step="any" aria-label={`Set ${i + 1} weight`} value={set.weight} onChange={event => setSets(sets.map((item, index) => index === i ? { ...item, weight: event.target.value } : item))}/><input type="number" min="0" step="1" aria-label={`Set ${i + 1} reps`} value={set.reps} onChange={event => setSets(sets.map((item, index) => index === i ? { ...item, reps: event.target.value } : item))}/></div>)}
    <label className="session-note">Notes<textarea value={note} onChange={event => setNote(event.target.value)}/></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="outline-button" onClick={() => {
      if (cardio ? !cardio.duration || [cardio.duration, cardio.speed, cardio.incline].some(value => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) : sets.length !== 3 || sets.some(set => set.reps === '' || !Number.isInteger(Number(set.reps)) || Number(set.reps) < 0 || (set.weight !== '' && (!Number.isFinite(Number(set.weight)) || Number(set.weight) < 0)))) { setError('Enter valid nonnegative values for the result.'); return }
      onSave({ ...exercise, sets, cardio, note }); setEditing(false); setError('')
    }}>✓ Save changes</button> <button className="text-button" onClick={() => { setSets(exercise.sets); setCardio(exercise.cardio); setNote(exercise.note || ''); setEditing(false); setError('') }}>Cancel</button>
  </> : <><span>{exercise.cardio?.done ? `${exercise.cardio.duration} min · ${exercise.cardio.speed || '–'} km/h · ${exercise.cardio.incline || '–'}°` : exercise.sets.map(set => `${set.weight || '0'} kg × ${set.reps}`).join(' / ')}</span>{exercise.note && <span>{exercise.note}</span>}<button className="text-button" onClick={() => { setSets(exercise.sets); setCardio(exercise.cardio); setNote(exercise.note || ''); setEditing(true) }}>Edit result or note</button></>}</div>
}
