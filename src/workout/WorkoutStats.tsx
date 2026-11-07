import { useMemo, useState } from 'react'
import type { Workout } from './WorkoutSession'

export function WorkoutStats({ workouts }: { workouts: Workout[] }) {
  const [selected, setSelected] = useState('')
  const records = useMemo(() => workouts.flatMap(workout => workout.exercises
    .filter(exercise => exercise.sets.length > 0 || exercise.cardio?.done)
    .map(exercise => ({ ...exercise, date: workout.date, key: exercise.exerciseId || `legacy:${exercise.name}` }))), [workouts])
  const exercises = useMemo(() => [...new Map(records.map(record => [record.key, record.name])).entries()], [records])
  const displayed = records.filter(record => record.key === selected)
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27).getTime()
  const recentCount = workouts.filter(workout => new Date(workout.date).getTime() >= cutoff).length
  return <section className="stats-section">
    <div className="section-head compact"><div><div className="eyebrow muted">PROGRESS</div><h2>Your activity</h2></div></div>
    <div className="activity-summary"><div><span>LAST 28 DAYS</span><strong>{recentCount}</strong><small>Workouts completed</small></div><div><span>ALL TIME</span><strong>{workouts.length}</strong><small>Workouts completed</small></div></div>
    <label className="stats-select">Exercise history<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">Choose an exercise</option>{exercises.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    {selected && <div className="stats-history">{displayed.map((record, index) => <div key={`${record.date}-${index}`}><strong>{new Date(record.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</strong><span>{record.cardio?.done ? `${record.cardio.duration} min · ${record.cardio.speed || '–'} km/h · ${record.cardio.incline || '–'}°` : record.sets.map(set => `${set.weight || '0'} kg × ${set.reps}`).join(' / ')}</span>{record.note && <small>{record.note}</small>}</div>)}</div>}
    {workouts.length === 0 && <p className="stats-empty">Complete a workout to see your history here.</p>}
  </section>
}
