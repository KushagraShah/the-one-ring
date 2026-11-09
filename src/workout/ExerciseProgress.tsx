import { useMemo, useState } from 'react'
import type { Exercise } from './ExerciseLibrary'
import type { Workout } from './WorkoutSession'
import { ResultTable } from './ResultTable'
import { WorkoutStats } from './WorkoutStats'
import { CardioInsights } from './CardioInsights'
import { InfoTip } from '../InfoTip'

export function ExerciseProgress({ workouts, library, onOpenWorkout }: { workouts: Workout[]; library: Exercise[]; onOpenWorkout: (index: number) => void }) {
  const [id, setId] = useState('')
  const [limit, setLimit] = useState(10)
  const [showChart, setShowChart] = useState(false)
  const options = useMemo(() => library.filter(item => item.id).sort((a, b) => a.name.localeCompare(b.name)), [library])
  const records = useMemo(() => workouts.flatMap((workout, index) => workout.exercises.filter(item => item.exerciseId === id && !item.skipped && (item.sets.length > 0 || item.cardio?.done)).map(exercise => ({ date: workout.date, exercise, index }))).sort((a, b) => b.date.localeCompare(a.date) || a.index - b.index), [workouts, id])
  const latest = records[0]?.exercise.sets
  const previous = records[1]?.exercise.sets
  const comparable = latest?.length === 3 && previous?.length === 3 && latest.every((set, index) => set.weight !== '' && set.weight === previous[index].weight && set.reps !== '' && previous[index].reps !== '' && Number.isFinite(Number(set.reps)) && Number.isFinite(Number(previous[index].reps)))
  const difference = comparable ? latest.reduce((sum, set) => sum + Number(set.reps), 0) - previous.reduce((sum, set) => sum + Number(set.reps), 0) : null
  return <section className="exercise-progress"><div className="context-section-heading"><div><span className="context-label">YOUR PROGRESS</span><h2>Exercise progress <InfoTip label="About exercise progress">Results are linked to one exact library exercise, across all dates. Older name-only records stay separate. Rep comparisons require the same recorded weight for each set; they are not a strength score.</InfoTip></h2></div></div>
    <label>Progress exercise<select value={id} onChange={event => { setId(event.target.value); setLimit(10); setShowChart(false) }}><option value="">Choose an exercise</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}{item.equipment ? ` · ${item.equipment}` : ''}{item.archived ? ' (archived)' : ''}</option>)}</select></label>
    {id && (records.length ? <><p>{records.length} recorded {records.length === 1 ? 'result' : 'results'} across all dates.{difference !== null ? ` Latest vs previous at matching set weights: ${difference > 0 ? '+' : ''}${difference} total reps.` : ''}</p><div className="context-history">{records.slice(0, limit).map((record, index) => <div className="context-history-row" key={`${record.date}-${index}`}><div><time>{new Date(record.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</time><strong><ResultTable sets={record.exercise.sets} cardio={record.exercise.cardio}/></strong>{record.exercise.note && <p>{record.exercise.note}</p>}</div><button className="text-button" onClick={() => onOpenWorkout(record.index)}>Open workout</button></div>)}</div>{limit < records.length && <button className="outline-button history-more" onClick={() => setLimit(value => value + 10)}>Show more results</button>}<button className="outline-button history-more" aria-expanded={showChart} onClick={() => setShowChart(value => !value)}>{showChart ? 'Hide trends' : 'Show trends'}</button>{showChart && <div className="exercise-progress-trends">{records.some(record => record.exercise.sets.length > 0) && <WorkoutStats records={records.slice(0, 12)}/>} {records.some(record => record.exercise.cardio?.done) && <CardioInsights records={records}/>}</div>}</> : <p className="context-empty">No recorded results for this exercise yet.</p>)}
  </section>
}
