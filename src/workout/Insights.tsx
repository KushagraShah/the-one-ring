import { useState } from 'react'
import type { Workout } from './WorkoutSession'

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
  return <section className="history-section"><h2>Activity insights</h2><details><summary>What do these numbers mean? ⓘ</summary><p>Uses local calendar days, including today. A workout counts only if it has a completed result. Training days count distinct dates; active weeks are Monday–Sunday weeks with a result, including partial weeks at the edges. Results count completed exercises, not sets. Skips are excluded.</p></details>
    <label>Period <select value={days} onChange={event => setDays(Number(event.target.value))}><option value={28}>Last 28 days</option><option value={90}>Last 90 days</option><option value={365}>Last 365 days</option></select></label>
    {result.sessions ? <div className="insight-grid"><p><strong>{result.sessions}</strong><br/>workouts</p><p><strong>{result.days}</strong><br/>training days</p><p><strong>{result.weeks}</strong><br/>active weeks</p><p><strong>{result.results}</strong><br/>exercise results</p><p><strong>{result.exercises}</strong><br/>distinct exercises</p></div> : <p>No completed results in this period.</p>}
  </section>
}
