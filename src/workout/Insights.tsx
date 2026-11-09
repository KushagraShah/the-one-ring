import { useState } from 'react'
import type { Workout } from './WorkoutSession'
import { InfoTip } from '../InfoTip'

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function workoutInsights(workouts: Workout[], days: number, now = new Date(), offset = 0) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1 - offset)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 - offset)
  const sessions = workouts.filter(workout => { const date = new Date(workout.date); return date >= start && date < end && workout.exercises.some(exercise => !exercise.skipped && (exercise.sets.length > 0 || exercise.cardio?.done)) })
  const dates = new Set(sessions.map(workout => dayKey(new Date(workout.date))))
  const weeks = new Set(sessions.map(workout => { const date = new Date(workout.date); date.setDate(date.getDate() - (date.getDay() + 6) % 7); return dayKey(date) }))
  const counts = new Map<string, number>()
  for (const workout of sessions) for (const item of workout.exercises) {
    if (item.skipped || !(item.sets.length > 0 || item.cardio?.done)) continue
    const key = item.exerciseId || `legacy:${item.name}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const dayCounts = new Map<string, number>()
  for (const workout of sessions) dayCounts.set(workout.day, (dayCounts.get(workout.day) || 0) + 1)
  return { sessions: sessions.length, days: dates.size, weeks: weeks.size, exercises: counts.size, results: [...counts.values()].reduce((sum, count) => sum + count, 0), dayCounts: [...dayCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) }
}

export function Insights({ workouts }: { workouts: Workout[] }) {
  const [days, setDays] = useState(28)
  const result = workoutInsights(workouts, days)
  const previous = workoutInsights(workouts, days, new Date(), days)
  return <section className="workout-insights"><div className="workout-insights-header"><div><div className="context-label">YOUR ACTIVITY</div><h2>Activity insights <InfoTip label="About activity insights">Counts use local calendar days, including today. Workouts need at least one recorded result, including older two-set records. Training days are distinct dates; active weeks run Monday–Sunday. Results count exercises, not sets. Skips are excluded.</InfoTip></h2></div>
    <label className="insights-period"><span>Period</span><select value={days} onChange={event => setDays(Number(event.target.value))}><option value={28}>Last 28 days</option><option value={90}>Last 90 days</option><option value={365}>Last 365 days</option></select></label></div>
    {result.sessions ? <><div className="insight-grid">{[[result.sessions, 'Workouts'], [result.days, 'Training days'], [result.weeks, 'Active weeks'], [result.results, 'Exercise results'], [result.exercises, 'Distinct exercises']].map(([value, label]) => <div className="insight-tile" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div><p className="insights-comparison">Previous {days} days: {previous.sessions} workouts · {previous.days} training days</p><div className="insights-days"><strong>Workout days</strong><p>Based on saved workout labels, including free workouts and imported labels.</p>{result.dayCounts.map(([name, count]) => <span key={name}>{name}: {count}</span>)}</div></> : <p className="context-empty">No recorded results in this period. Previous {days} days: {previous.sessions} workouts.</p>}
  </section>
}
