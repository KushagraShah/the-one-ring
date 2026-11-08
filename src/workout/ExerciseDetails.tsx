import { useState } from 'react'
import type { Exercise } from './ExerciseLibrary'
import type { Workout, WorkoutExercise } from './WorkoutSession'
import { recentPerformances } from './sessionLogic'
import { formatResult } from './ResultTable'
import { WorkoutStats } from './WorkoutStats'
import { CardioInsights } from './CardioInsights'

/** Expandable context: no session state is unmounted while browsing. */
export function ExerciseDetails({ exercise, workouts, onOpenWorkout }: { exercise: Exercise; workouts: Workout[]; onOpenWorkout?: (result: WorkoutExercise) => void }) {
  const [limit, setLimit] = useState(10)
  const [open, setOpen] = useState(false)
  const results = open ? recentPerformances(workouts, exercise, Infinity, true) : []
  const cardioResults = results.filter(result => result.exercise.cardio?.done)
  const strengthResults = results.filter(result => result.exercise.sets.length > 0)
  const latest = strengthResults[0]?.exercise.sets
  const previous = strengthResults[1]?.exercise.sets
  const comparable = latest?.length === 3 && previous?.length === 3 && latest.every((set, index) => set.weight !== '' && set.weight === previous[index].weight && set.reps !== '' && previous[index].reps !== '')
  const difference = comparable ? latest.reduce((sum, set) => sum + Number(set.reps), 0) - previous.reduce((sum, set) => sum + Number(set.reps), 0) : null
  return <details className="exercise-details" onToggle={event => setOpen(event.currentTarget.open)}><summary>Exercise details and history</summary>{open && <>
    <p><strong>{exercise.name}</strong>{exercise.equipment ? ` · ${exercise.equipment}` : ''}</p>
    <p><strong>My setup</strong><br/>{exercise.note || 'No setup notes yet.'}</p>
    {exercise.instructions && <p><strong>Instructions</strong><br/>{exercise.instructions}</p>}
    {exercise.video && <p><a href={exercise.video} target="_blank" rel="noreferrer">Open reference ↗</a></p>}
    <h3>Performance history</h3>
    <details><summary>Exercise insights ⓘ</summary><p>{results.length} recorded {results.length === 1 ? 'result' : 'results'} for this exact exercise.</p>{strengthResults.length > 0 && <><p>A heavier set alone does not describe overall progress; compare its reps and notes too.</p>{difference !== null && <p>At the same set weights, the latest result had {difference === 0 ? 'the same total reps' : `${Math.abs(difference)} ${difference > 0 ? 'more' : 'fewer'} total reps`} than the previous result.</p>}<p>Chart: latest 12 results with recorded weights.</p><WorkoutStats records={strengthResults.filter(result => result.exercise.sets.some(set => set.weight !== '')).slice(0, 12)}/></>}{cardioResults.length > 0 && <CardioInsights records={cardioResults}/>}</details>
    {results.length ? <div className="stats-history">{results.slice(0, limit).map(({ date, exercise: result }, index) => <div key={`${date}-${index}`}><strong>{new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {formatResult(result.sets, result.cardio)}</strong>{result.note && <small>{result.note}</small>}{onOpenWorkout && <button className="text-button" onClick={() => onOpenWorkout(result)}>Open workout</button>}</div>)}</div> : <p>No previous results.</p>}
    {limit < results.length && <button className="outline-button" onClick={() => setLimit(value => value + 10)}>Show more results</button>}
  </>}</details>
}
