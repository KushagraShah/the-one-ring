import { confirmAction } from '../AppDialog'
import { useEffect, useState } from 'react'
import type { WorkoutExercise } from './WorkoutSession'
import { isCardio } from './WorkoutSession'
import { ResultTable } from './ResultTable'
import type { Exercise } from './ExerciseLibrary'
import type { Workout } from './WorkoutSession'
import { ExercisePicker } from './ExercisePicker'
import { Sheet } from './Sheet'

export function WorkoutReview({ exercise, library, onSave, highlighted = false }: { exercise: WorkoutExercise; library: Exercise[]; workouts: Workout[]; onSave: (next: WorkoutExercise) => void; highlighted?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [sets, setSets] = useState(exercise.sets)
  const [note, setNote] = useState(exercise.note || '')
  const [error, setError] = useState('')
  const [cardio, setCardio] = useState(exercise.cardio)
  const [correcting, setCorrecting] = useState(false)
  const dirty = editing && (JSON.stringify(sets) !== JSON.stringify(exercise.sets) || note !== (exercise.note || '') || JSON.stringify(cardio) !== JSON.stringify(exercise.cardio))
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  const close = async () => { if (dirty && !await confirmAction('Discard unsaved result changes?')) return; setSets(exercise.sets); setCardio(exercise.cardio); setNote(exercise.note || ''); setEditing(false); setError('') }
  if (!exercise.sets.length && !exercise.cardio?.done) return <div className="review-exercise"><strong>{exercise.name}</strong><span>{exercise.skipped ? 'Skipped' : 'Not completed'}</span></div>
  return <div className={`review-exercise ${highlighted ? 'is-highlighted' : ''}`}><div className="review-heading"><strong>{exercise.name}</strong><button className="text-button" onClick={() => { setSets(exercise.sets); setCardio(exercise.cardio); setNote(exercise.note || ''); setEditing(true) }}>Edit</button></div>{exercise.equipmentSnapshot && <small>{exercise.equipmentSnapshot}</small>}<ResultTable sets={exercise.sets} cardio={exercise.cardio}/>{exercise.note && <p>{exercise.note}</p>}{exercise.correctedFrom && <small>Originally recorded as: {exercise.correctedFrom.name}</small>}{exercise.plannedName && exercise.plannedName !== exercise.name && <small>Originally planned: {exercise.plannedName}</small>}<button className="text-button review-correct" onClick={() => setCorrecting(true)}>Change recorded exercise</button>
    {correcting && <ExercisePicker exercises={library.filter(item => item.id !== exercise.exerciseId && isCardio(item) === Boolean(exercise.cardio?.done))} onClose={() => setCorrecting(false)} onChoose={async id => { const target = library.find(item => item.id === id); if (!target || !await confirmAction(`Move this result to ${target.name}? The original plan and cycle progress stay unchanged.`)) return; onSave({ ...exercise, name: target.name, exerciseId: target.id, equipmentSnapshot: target.equipment, correctedFrom: exercise.correctedFrom || { name: exercise.name, exerciseId: exercise.exerciseId, equipment: exercise.equipmentSnapshot } }); setCorrecting(false) }}/>}
    {editing && <Sheet title={`Edit ${exercise.name}`} onClose={close}><div className="review-editor">{cardio ? <div className="cardio-fields">{([['duration', 'Duration (min)'], ['speed', 'Speed (km/h)'], ['incline', 'Incline (degrees)']] as const).map(([field, label]) => <label key={field}>{label}<input type="number" min="0" step="any" value={cardio[field]} onChange={event => setCardio({ ...cardio, [field]: event.target.value })}/></label>)}</div> : sets.map((set, i) => <div className="set-row three-columns" key={i}><span>Set {i + 1}</span><input type="number" min="0" step="any" aria-label={`Set ${i + 1} weight`} value={set.weight} onChange={event => setSets(sets.map((item, index) => index === i ? { ...item, weight: event.target.value } : item))}/><input type="number" min="0" step="1" aria-label={`Set ${i + 1} reps`} value={set.reps} onChange={event => setSets(sets.map((item, index) => index === i ? { ...item, reps: event.target.value } : item))}/></div>)}<label className="session-note">Notes<textarea value={note} onChange={event => setNote(event.target.value)}/></label>{error && <p role="alert" className="form-error">{error}</p>}<div className="library-actions"><button className="primary" onClick={() => {
      if (cardio ? !cardio.duration || [cardio.duration, cardio.speed, cardio.incline].some(value => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) : (sets.length !== 3 && sets.length !== exercise.sets.length) || sets.some(set => set.reps === '' || !Number.isInteger(Number(set.reps)) || Number(set.reps) < 0 || (set.weight !== '' && (!Number.isFinite(Number(set.weight)) || Number(set.weight) < 0)))) { setError('Enter valid nonnegative values for the result.'); return }
      onSave({ ...exercise, sets, cardio, note }); setEditing(false); setError('')
    }}>Save changes</button><button className="outline-button" onClick={close}><span aria-hidden="true">×</span> Cancel</button></div></div></Sheet>}
  </div>
}
