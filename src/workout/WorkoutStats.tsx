import { useMemo, useState } from 'react'
import type { WorkoutExercise } from './WorkoutSession'

/** One exact exercise at a time: top recorded set weight, not a strength score. */
export function WorkoutStats({ records, selectedRange, onRangeChange }: { records: { date: string; exercise: WorkoutExercise }[]; selectedRange?: string; onRangeChange?: (range: string) => void }) {
  const [localRange, setLocalRange] = useState('all')
  const range = selectedRange ?? localRange
  const setRange = (value: string) => { setLocalRange(value); onRangeChange?.(value) }
  const [selected, setSelected] = useState<number | null>(null)
  const points = useMemo(() => {
    const cutoff = range === 'all' ? -Infinity : Date.now() - Number(range) * 86400000
    return records.flatMap(({ date, exercise }) => {
      const time = new Date(date).getTime()
      const sets = exercise.sets.filter(set => set.weight !== '' && Number.isFinite(Number(set.weight)))
      const best = sets.reduce<typeof sets[number] | undefined>((current, set) => !current || Number(set.weight) > Number(current.weight) ? set : current, undefined)
      return best && Number.isFinite(time) && time >= cutoff ? [{ date, time, weight: Number(best.weight), reps: best.reps }] : []
    }).sort((a, b) => a.time - b.time)
  }, [records, range])
  if (points.length < 2) return <div className="progress-chart"><h3>Top recorded weight</h3><label>Range <select value={range} onChange={event => { setRange(event.target.value); setSelected(null) }}><option value="all">All time</option><option value="90">Last 90 days</option><option value="365">Last year</option></select></label><p className="stats-empty">At least two recorded weights are needed for a trend.</p></div>
  const minTime = points[0].time; const maxTime = points[points.length - 1].time
  const minWeight = Math.min(...points.map(point => point.weight)); const maxWeight = Math.max(...points.map(point => point.weight))
  const padding = Math.max((maxWeight - minWeight) * 0.15, 1)
  const x = (time: number) => 16 + (time - minTime) / Math.max(1, maxTime - minTime) * 288
  const y = (weight: number) => 122 - (weight - (minWeight - padding)) / (maxWeight - minWeight + 2 * padding) * 100
  const active = points[selected ?? points.length - 1] || points[points.length - 1]
  return <div className="progress-chart"><div className="chart-heading"><h3>Top recorded weight</h3><label>Range <select value={range} onChange={event => { setRange(event.target.value); setSelected(null) }}><option value="all">All time</option><option value="90">Last 90 days</option><option value="365">Last year</option></select></label></div><p>{new Date(active.date).toLocaleDateString()} · <strong>{active.weight} kg × {active.reps || '—'} reps</strong></p><p>Recorded range: {minWeight}–{maxWeight} kg · heaviest set per result</p><svg viewBox="0 0 320 145" role="img" aria-label="Top recorded set weight over time; select a result in the list for details"><line x1="16" y1="125" x2="304" y2="125" stroke="currentColor" opacity=".25"/><polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points.map(point => `${x(point.time)},${y(point.weight)}`).join(' ')}/>{points.map((point, index) => <circle key={`${point.date}-${index}`} cx={x(point.time)} cy={y(point.weight)} r="4" fill="var(--accent)"/>)}</svg><div className="chart-axis"><span>{new Date(minTime).toLocaleDateString()}</span><span>{new Date(maxTime).toLocaleDateString()}</span></div><details className="chart-results"><summary>View {points.length} recorded weights</summary><table className="result-table"><thead><tr><th scope="col">Date</th><th scope="col">Weight</th><th scope="col">Reps</th></tr></thead><tbody>{[...points].reverse().map((point, index) => <tr key={`${point.date}-${index}`}><td><button className="chart-point" onClick={() => setSelected(points.length - index - 1)}>{new Date(point.date).toLocaleDateString()}</button></td><td>{point.weight} kg</td><td>{point.reps || '—'}</td></tr>)}</tbody></table></details></div>
}
