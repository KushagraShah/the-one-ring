import { DetailView } from '../DetailView'
import { ChoiceSelect } from '../ChoiceSelect'
import { useMemo, useRef, useState } from 'react'
import type { Workout, WorkoutExercise } from './WorkoutSession'
import type { Exercise } from './ExerciseLibrary'
import { WorkoutReview } from './WorkoutReview'
import { ResultTable } from './ResultTable'
import type { CycleEvent } from './backup'
import { Insights } from './Insights'
import { ExerciseProgress } from './ExerciseProgress'

const PAGE_SIZE = 10
const keyFor = (exercise: WorkoutExercise) => exercise.exerciseId ? `id:${exercise.exerciseId}` : `legacy:${exercise.name}`
const localDay = (date: string) => {
  const value = new Date(date)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function Activity({ workouts, library, cycleHistory, openLatest, onSave, onSaveWorkout }: { workouts: Workout[]; library: Exercise[]; cycleHistory: { routine: string; event: CycleEvent }[]; openLatest: boolean; onSave: (workoutIndex: number, exerciseIndex: number, exercise: WorkoutExercise) => void; onSaveWorkout: (workoutIndex: number, workout: Workout) => void }) {
  const returnScroll = useRef(0)
  const [highlightId, setHighlightId] = useState('')
  const openWorkout = (index: number, exerciseId = '') => { setHighlightId(exerciseId); returnScroll.current = window.scrollY; setSelectedWorkout(index); window.scrollTo(0, 0); if (exerciseId) requestAnimationFrame(() => document.querySelector('.review-exercise.is-highlighted')?.scrollIntoView({ block: 'center' })) }
  const [selectedWorkout, setSelectedWorkout] = useState<number | null>(openLatest && workouts.length ? 0 : null)
  const [exerciseKey, setExerciseKey] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [cycleVisible, setCycleVisible] = useState(PAGE_SIZE)
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState('')
  const workout = selectedWorkout === null ? null : workouts[selectedWorkout]
  const options = useMemo(() => {
    const found = new Map<string, string>()
    for (const item of library) if (item.id) found.set(`id:${item.id}`, `${item.name}${item.equipment ? ` · ${item.equipment}` : ''}${item.archived ? ' (archived)' : ''}`)
    for (const session of workouts) for (const exercise of session.exercises) {
      const key = keyFor(exercise)
      if (found.has(key)) continue
      const item = exercise.exerciseId ? library.find(entry => entry.id === exercise.exerciseId) : undefined
      found.set(key, item ? `${item.name}${item.equipment ? ` · ${item.equipment}` : ''}${item.archived ? ' (archived)' : ''}` : `${exercise.name}${exercise.exerciseId ? ' (not in library)' : ' (older name-only record)'}`)
    }
    return [...found.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [workouts, library])
  const filtered = useMemo(() => workouts.map((item, index) => ({ item, index })).filter(({ item }) => {
    const date = localDay(item.date)
    return (!from || date >= from) && (!to || date <= to) && (!exerciseKey || item.exercises.some(exercise => keyFor(exercise) === exerciseKey))
  }).sort((a, b) => b.item.date.localeCompare(a.item.date) || a.index - b.index), [workouts, exerciseKey, from, to])
  const shown = filtered.slice(0, visible)
  const sortedCycle = useMemo(() => [...cycleHistory].sort((a, b) => b.event.at.localeCompare(a.event.at)), [cycleHistory])
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const recent = workouts.filter(item => { const time = new Date(item.date).getTime(); return time >= cutoff && time < end && item.exercises.some(exercise => !exercise.skipped && (exercise.sets.length > 0 || exercise.cardio?.done)) }).length

  const review = workout && selectedWorkout !== null ? <section className="latest-review"><button className="back-link" onClick={() => { setSelectedWorkout(null); setEditingDate(false); requestAnimationFrame(() => window.scrollTo(0, returnScroll.current)) }}>← Back</button><h1>{workout.day}</h1><p>{new Date(workout.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}{workout.routineName ? ` · ${workout.routineName}` : ''}</p>{editingDate ? <div className="workout-date-editor"><label>Workout date <input type="date" value={dateDraft} onChange={event => setDateDraft(event.target.value)}/></label> <button className="outline-button" disabled={!dateDraft} onClick={() => { const [year, month, day] = dateDraft.split('-').map(Number); const date = new Date(workout.date); date.setFullYear(year, month - 1, day); if (Number.isNaN(date.getTime())) return; onSaveWorkout(selectedWorkout, { ...workout, date: date.toISOString() }); setEditingDate(false) }}>Save date</button> <button className="text-button" onClick={() => setEditingDate(false)}><span aria-hidden="true">×</span> Cancel</button><p>Changes the date for this workout and all its results. Cycle history is not changed.</p></div> : <button className="text-button" onClick={() => { setDateDraft(localDay(workout.date)); setEditingDate(true) }}>Edit workout date</button>}{workout.plan && workout.plan.length > 0 && <DetailView className="workout-plan" title="Original plan"><ol>{workout.plan.map(item => <li key={item.slotId}>{item.cycleName ? `${item.cycleName}: ` : ''}{item.name}{item.equipment ? ` · ${item.equipment}` : ''}</li>)}</ol></DetailView>}{workout.exercises.length ? workout.exercises.map((exercise, index) => <WorkoutReview key={`${workout.id || workout.date}-${index}`} highlighted={Boolean(highlightId && exercise.exerciseId === highlightId)} exercise={exercise} library={library} workouts={workouts} onSave={next => onSave(selectedWorkout, index, next)}/>) : <p>No exercises recorded.</p>}</section> : null

  return <>{review}<div hidden={Boolean(review)}><div className="page-heading"><div><div className="eyebrow">YOUR JOURNEY</div><h1>Activity<span className="accent">.</span></h1><p>Browse your workouts and exercise progress.</p></div></div>
    <Insights workouts={workouts}/>
    <ExerciseProgress workouts={workouts} library={library} onOpenWorkout={openWorkout} paused={Boolean(review)}/>
    <section className="history-section"><h2>Workout history</h2><p className="history-count">{recent} workouts with results in the last 28 days</p><div className="history-filters"><label>Exercise<ChoiceSelect label="Exercise" value={exerciseKey} onChange={value => { setExerciseKey(value); setVisible(PAGE_SIZE) }}><option value="">All exercises</option>{options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ChoiceSelect></label><label>From<input type="date" value={from} onChange={event => { setFrom(event.target.value); setVisible(PAGE_SIZE) }}/></label><label>To<input type="date" value={to} onChange={event => { setTo(event.target.value); setVisible(PAGE_SIZE) }}/></label></div>
      {from && to && from > to ? <p role="alert">The start date must be on or before the end date.</p> : <>
        <p className="history-count">{filtered.length} {filtered.length === 1 ? 'workout' : 'workouts'} · showing {shown.length}</p>
        {!shown.length ? <p className="stats-empty">No workouts match these filters.</p> : <div className="history-list">{shown.map(({ item, index }) => {
          const entries = item.exercises.filter(exercise => !exerciseKey || keyFor(exercise) === exerciseKey)
          return <button className="history-card history-button" key={item.id || `${item.date}-${index}`} onClick={() => openWorkout(index)}><span className="history-content"><strong>{new Date(item.date).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {item.routineName ? `${item.routineName} · ` : ''}{item.day}</strong>{entries.slice(0, 3).map((exercise, i) => <span className="history-result" key={exercise.id || i}><span>{exercise.name}</span><span>{exercise.skipped ? 'Skipped' : exercise.sets.length || exercise.cardio?.done ? <ResultTable sets={exercise.sets} cardio={exercise.cardio}/> : 'Not completed'}</span></span>)}{entries.length > 3 && <small>+ {entries.length - 3} more exercises</small>}</span><span aria-hidden="true">→</span></button>
        })}</div>}
        {visible < filtered.length && <button className="outline-button history-more" onClick={() => setVisible(count => count + PAGE_SIZE)}>Show more workouts</button>}
      </>}
    </section>
    {sortedCycle.length > 0 && <DetailView className="workout-plan" title="Routine cycle history"><div className="stats-history">{sortedCycle.slice(0, cycleVisible).map(({ routine, event }) => <div key={event.id}><strong>{routine} · {event.type === 'rollover' ? 'Cycle completed' : event.type === 'reset' ? 'Cycle reset' : `${event.day} ${event.type}`}</strong><small>{new Date(event.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small></div>)}</div>{cycleVisible < sortedCycle.length && <button className="outline-button history-more" onClick={() => setCycleVisible(count => count + PAGE_SIZE)}>Show more cycle events</button>}</DetailView>}
  </div></>
}
