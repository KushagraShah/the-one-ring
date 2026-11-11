import { ChoiceSelect } from '../ChoiceSelect'
import { useState } from 'react'
import type { Workout } from './WorkoutSession'
import { InfoTip } from '../InfoTip'

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export function workoutInsights(workouts: Workout[], days: number, now = new Date(), offset = 0) {
  const start = days === Infinity ? new Date(-8640000000000000) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1 - offset)
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
  const [days, setDays] = useState(Infinity)
  const result = workoutInsights(workouts, days)
  const previous = days === Infinity ? null : workoutInsights(workouts, days, new Date(), days)
  return <section className="workout-insights"><div className="workout-insights-header"><div><div className="context-label">YOUR ACTIVITY</div><h2>Activity insights <InfoTip label="About activity insights">Counts use local calendar days, including today. Workouts need at least one recorded result, including older two-set records. Active weeks run Monday–Sunday. Skips and future workouts are excluded. Day names are saved labels.</InfoTip></h2></div></div>
    {result.sessions ? <><div className="insight-summary"><div><strong>{result.sessions}</strong><span>workouts</span></div><div><strong>{result.weeks}</strong><span>active weeks</span></div><div><strong>{result.exercises}</strong><span>exercises</span></div></div>{previous && <p className="insights-comparison">Previous {days} days: {previous.sessions} workouts</p>}<div className="insights-days"><strong>Workout days</strong>{result.dayCounts.map(([name, count]) => <span key={name}>{name}: {count}</span>)}</div></> : <p className="context-empty">No recorded results in this period.</p>}
    <label className="insights-period insights-period-bottom"><span>Period</span><ChoiceSelect label="Period" value={String(days)} onChange={value => setDays(Number(value))}><option value="Infinity">All time</option><option value="28">Last 28 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></ChoiceSelect></label>
  </section>
}
