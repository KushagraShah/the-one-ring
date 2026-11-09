import { useMemo, useRef, useState } from 'react'
import type { Exercise } from './ExerciseLibrary'
import type { Workout } from './WorkoutSession'
import { ResultTable } from './ResultTable'
import { WorkoutStats } from './WorkoutStats'
import { CardioInsights } from './CardioInsights'
import { ExercisePicker } from './ExercisePicker'
import { Sheet } from './Sheet'

export function ExerciseProgress({ workouts, library, onOpenWorkout, paused = false }: { workouts: Workout[]; library: Exercise[]; onOpenWorkout: (index: number, exerciseId: string) => void; paused?: boolean }) {
  const [id, setId] = useState('')
  const [limit, setLimit] = useState(10)
  const [showChart, setShowChart] = useState(false)
  const [chartRange, setChartRange] = useState('all')
  const [picker, setPicker] = useState(false)
  const [open, setOpen] = useState(false)
  const scrollPosition = useRef(0)
  const exercise = library.find(item => item.id === id)
  const records = useMemo(() => workouts.flatMap((workout, index) => workout.exercises.filter(item => item.exerciseId === id && !item.skipped && (item.sets.length > 0 || item.cardio?.done)).map(item => ({ date: workout.date, exercise: item, index }))).sort((a, b) => b.date.localeCompare(a.date) || a.index - b.index), [workouts, id])
  const latest = records[0]?.exercise.sets
  const previous = records[1]?.exercise.sets
  const comparable = latest?.length === 3 && previous?.length === 3 && latest.every((set, index) => set.weight !== '' && set.weight === previous[index].weight && set.reps !== '' && previous[index].reps !== '' && Number.isFinite(Number(set.reps)) && Number.isFinite(Number(previous[index].reps)))
  const difference = comparable ? latest.reduce((sum, set) => sum + Number(set.reps), 0) - previous.reduce((sum, set) => sum + Number(set.reps), 0) : null
  return <section className="exercise-progress"><div className="context-section-heading"><div><span className="context-label">YOUR PROGRESS</span><h2>Exercise progress</h2></div></div><button className="outline-button progress-picker" onClick={() => setPicker(true)}>{exercise ? exercise.name : 'Choose an exercise'} <span aria-hidden="true">⌕</span></button>
    {picker && !paused && <ExercisePicker exercises={library} onClose={() => setPicker(false)} onChoose={value => { setId(value); setLimit(10); setShowChart(false); setChartRange('all'); scrollPosition.current = 0; setPicker(false); setOpen(true) }}/>}
    {open && exercise && !paused && <Sheet title={exercise.name} scrollPosition={scrollPosition} onClose={() => setOpen(false)}><div className="exercise-progress-detail"><p>{exercise.equipment || 'No equipment specified'} · {records.length} {records.length === 1 ? 'result' : 'results'}</p>{difference !== null && <p>At matching weights: {difference > 0 ? '+' : ''}{difference} reps since the previous result.</p>}<div className="progress-tabs"><button className={!showChart ? 'active' : ''} onClick={() => setShowChart(false)}>History</button><button className={showChart ? 'active' : ''} onClick={() => setShowChart(true)}>Trends</button></div>{showChart ? <div className="exercise-progress-trends">{records.some(record => record.exercise.sets.length > 0) && <WorkoutStats records={records} selectedRange={chartRange} onRangeChange={setChartRange}/>} {records.some(record => record.exercise.cardio?.done) && <CardioInsights records={records} selectedRange={chartRange} onRangeChange={setChartRange}/>} {!records.length && <p>No results yet.</p>}</div> : records.length ? <><div className="context-history">{records.slice(0, limit).map((record, index) => <button className="progress-result" key={`${record.date}-${index}`} onClick={() => onOpenWorkout(record.index, id)}><time>{new Date(record.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</time><span><strong><ResultTable sets={record.exercise.sets} cardio={record.exercise.cardio}/></strong>{record.exercise.note && <small>{record.exercise.note}</small>}</span><span aria-label="Open workout">›</span></button>)}</div>{limit < records.length && <button className="outline-button history-more" onClick={() => setLimit(value => value + 10)}>Show more results</button>}</> : <p className="context-empty">No recorded results for this exercise yet.</p>}</div></Sheet>}
  </section>
}
