import { useState } from 'react'
import { ExternalLink, History } from 'lucide-react'
import { DetailView } from '../DetailView'
import type { Exercise } from './ExerciseLibrary'
import type { Workout, WorkoutExercise } from './WorkoutSession'
import { recentPerformances } from './sessionLogic'
import { formatResult } from './ResultTable'
import { WorkoutStats } from './WorkoutStats'
import { CardioInsights } from './CardioInsights'
import { InfoTip } from '../InfoTip'
import { Sheet } from './Sheet'
import { SetupText } from './SetupText'

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
  return <div className="exercise-context">
    <button className="exercise-context-toggle" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><History size={16}/><span>Exercise details and history</span><span aria-hidden="true">›</span></button>
    {open && <Sheet title={exercise.name} onClose={() => setOpen(false)}><div className="exercise-context-body">
      <div className="exercise-context-heading"><strong>{exercise.name}</strong>{exercise.equipment && <span>{exercise.equipment}</span>}</div>
      <div className="exercise-context-setup"><span className="context-label">MY SETUP</span>{exercise.note ? <SetupText text={exercise.note}/> : <p>No setup notes yet.</p>}</div>
      {exercise.instructions && <div className="exercise-context-setup"><span className="context-label">INSTRUCTIONS</span><p>{exercise.instructions}</p></div>}
      {exercise.video && <a className="context-reference" href={exercise.video} target="_blank" rel="noreferrer">Watch reference <ExternalLink size={13}/></a>}
      <div className="context-section-heading"><div><span className="context-label">YOUR PROGRESS</span><h3>Performance history</h3></div><span>{results.length} {results.length === 1 ? 'result' : 'results'}</span></div>
      {results.length > 0 && <DetailView title="Exercise insights"><div className="context-insights"><div className="context-insights-heading"><strong>Exercise insights</strong><InfoTip label="About exercise insights">Results are for this exact exercise. Compare reps and notes as well as weight; a heavier set alone does not describe overall progress.</InfoTip></div>
          {strengthResults.length > 0 && <>{difference !== null && <p>At the same set weights, the latest result had {difference === 0 ? 'the same total reps' : `${Math.abs(difference)} ${difference > 0 ? 'more' : 'fewer'} total reps`} than the previous result.</p>}<WorkoutStats records={strengthResults.filter(result => result.exercise.sets.some(set => set.weight !== ''))}/></>}
          {cardioResults.length > 0 && <CardioInsights records={cardioResults}/>}
        </div></DetailView>}
      {results.length ? <div className="context-history">{results.slice(0, limit).map(({ date, exercise: result }, index) => <div className="context-history-row" key={`${date}-${index}`}><div><time>{new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</time><strong>{formatResult(result.sets, result.cardio)}</strong>{result.note && <p>{result.note}</p>}</div>{onOpenWorkout && <button className="text-button" onClick={() => onOpenWorkout(result)}>Open workout</button>}</div>)}</div> : <p className="context-empty">No results yet. Your history will appear here after you log this exercise.</p>}
      {limit < results.length && <button className="outline-button context-more" onClick={() => setLimit(value => value + 10)}>Show more results</button>}
    </div></Sheet>}
  </div>
}
