import { useState } from 'react'
import type { Workout } from './WorkoutSession'
import { InfoTip } from './InfoTip'

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function workoutInsights(workouts: Workout[], days: number, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const sessions = workouts.filter(workout => { const date = new Date(workout.date); return date >= start && date < end && workout.exercises.some(exercise => exercise.sets.length === 3 || exercise.cardio?.done) })
  const dates = new Set(sessions.map(workout => dayKey(new Date(workout.date))))
  const weeks = new Set(sessions.map(workout => { const date = new Date(workout.date); date.setDate(date.getDate() - (date.getDay() + 6) % 7); return dayKey(date) }))
  const counts = new Map<string, number>()
  for (const workout of sessions) for (const item of workout.exercises) {
    if (!(item.sets.length === 3 || item.cardio?.done)) continue
    const key = item.exerciseId || `legacy:${item.name}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return { sessions: sessions.length, days: dates.size, weeks: weeks.size, exercises: counts.size, results: [...counts.values()].reduce((sum, count) => sum + count, 0) }
}

export function Insights({ workouts }: { workouts: Workout[] }) {
  const [days, setDays] = useState(28)
  const result = workoutInsights(workouts, days)
  return <section className="workout-insights"><div className="workout-insights-header"><div><div className="context-label">YOUR ACTIVITY</div><h2>Activity insights <InfoTip label="About activity insights">Counts use local calendar days, including today. Workouts need at least one completed result. Training days are distinct dates; active weeks run Monday–Sunday. Results count completed exercises, not sets. Skips are excluded.</InfoTip></h2></div>
    <label className="insights-period"><span>Period</span><select value={days} onChange={event => setDays(Number(event.target.value))}><option value={28}>Last 28 days</option><option value={90}>Last 90 days</option><option value={365}>Last 365 days</option></select></label></div>
    {result.sessions ? <div className="insight-grid">{[[result.sessions, 'Workouts'], [result.days, 'Training days'], [result.weeks, 'Active weeks'], [result.results, 'Exercise results'], [result.exercises, 'Distinct exercises']].map(([value, label]) => <div className="insight-tile" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div> : <p className="context-empty">No completed results in this period.</p>}
  </section>
}
