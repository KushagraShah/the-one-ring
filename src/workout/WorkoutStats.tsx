import { useMemo, useState } from 'react'
import type { Workout } from './WorkoutSession'
import { ResultTable } from './ResultTable'

export function WorkoutStats({ workouts }: { workouts: Workout[] }) {
  const [selected, setSelected] = useState('')
  const records = useMemo(() => workouts.flatMap(workout => workout.exercises
    .filter(exercise => exercise.sets.length > 0 || exercise.cardio?.done)
    .map(exercise => ({ ...exercise, date: workout.date, key: exercise.exerciseId || `legacy:${exercise.name}` })))
    .sort((a, b) => b.date.localeCompare(a.date)), [workouts])
  const exercises = useMemo(() => [...new Map(records.map(record => [record.key, record.name])).entries()], [records])
  const displayed = records.filter(record => record.key === selected)
  const points = displayed.map(record => {
    const sets = record.sets.filter(set => set.weight !== '' && Number.isFinite(Number(set.weight)))
    const best = sets.reduce<typeof sets[number] | undefined>((current, set) => !current || Number(set.weight) > Number(current.weight) ? set : current, undefined)
    return best ? { date: record.date, weight: Number(best.weight), reps: best.reps } : null
  }).filter((point): point is { date: string; weight: number; reps: string } => point !== null).reverse()
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const trained = workouts.filter(workout => workout.exercises.some(exercise => exercise.sets.length === 3 || exercise.cardio?.done))
  const recentCount = trained.filter(workout => { const date = new Date(workout.date).getTime(); return date >= cutoff && date < end }).length
  const max = Math.max(...points.map(point => point.weight), 1)
  return <section className="stats-section">
    <div className="section-head compact"><div><div className="eyebrow muted">PROGRESS</div><h2>Your activity</h2></div></div>
    <div className="activity-summary"><div><span>LAST 28 DAYS</span><strong>{recentCount}</strong><small>Workouts with results</small></div><div><span>ALL TIME</span><strong>{trained.length}</strong><small>Workouts with results</small></div></div>
    <label className="stats-select">Exercise progress<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">Choose an exercise</option>{exercises.map(([id, name]) => <option key={id} value={id}>{name}{id.startsWith('legacy:') ? ' (older name-only record)' : ''}</option>)}</select></label>
    {selected && points.length >= 2 && <div className="progress-chart"><h3>Top recorded weight</h3><p>One heaviest set per workout; reps shown below. This is not a strength score.</p><div className="chart-bars" aria-hidden="true">{points.map((point, index) => <div className="chart-column" key={`${point.date}-${index}`}><span>{point.weight} kg</span><div className="chart-track"><div style={{ height: `${Math.max(4, point.weight / max * 100)}%` }}/></div><small>{new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></div>)}</div><table className="result-table"><thead><tr><th>Date</th><th>Weight</th><th>Reps</th></tr></thead><tbody>{points.map((point, index) => <tr key={`${point.date}-${index}`}><td>{new Date(point.date).toLocaleDateString()}</td><td>{point.weight} kg</td><td>{point.reps || '—'}</td></tr>)}</tbody></table></div>}
    {selected && <div className="stats-history">{displayed.map((record, index) => <div key={`${record.date}-${index}`}><strong>{new Date(record.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</strong><ResultTable sets={record.sets} cardio={record.cardio}/>{record.note && <small>{record.note}</small>}</div>)}</div>}
    {workouts.length === 0 && <p className="stats-empty">Complete a workout to see your history here.</p>}
  </section>
}
