import { useState } from 'react'
import type { WorkoutExercise } from './WorkoutSession'

const fields = { duration: 'Duration (min)', speed: 'Speed (km/h)', incline: 'Incline (degrees)' } as const
export function CardioInsights({ records, selectedRange, onRangeChange }: { records: { date: string; exercise: WorkoutExercise }[]; selectedRange?: string; onRangeChange?: (range: string) => void }) {
  const [metric, setMetric] = useState<keyof typeof fields>('duration')
  const [localRange, setLocalRange] = useState('all')
  const range = selectedRange ?? localRange
  const setRange = (value: string) => { setLocalRange(value); onRangeChange?.(value) }
  const cutoff = range === 'all' ? -Infinity : Date.now() - Number(range) * 86400000
  const points = records.flatMap(({ date, exercise }) => {
    const value = exercise.cardio?.[metric]; const time = new Date(date).getTime()
    return value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number.isFinite(time) && time >= cutoff ? [{ date, time, value: Number(value) }] : []
  }).sort((a, b) => a.time - b.time)
  const minTime = points[0]?.time || 0; const maxTime = points[points.length - 1]?.time || 0
  const values = points.map(point => point.value); const min = Math.min(...values); const max = Math.max(...values); const padding = Math.max((max - min) * 0.15, 1)
  const x = (time: number) => 16 + (time - minTime) / Math.max(1, maxTime - minTime) * 288
  const y = (value: number) => 122 - (value - (min - padding)) / (max - min + 2 * padding) * 100
  return <div className="cardio-insights"><div className="chart-heading"><label>Cardio metric <select value={metric} onChange={event => setMetric(event.target.value as keyof typeof fields)}>{Object.entries(fields).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Range <select value={range} onChange={event => setRange(event.target.value)}><option value="all">All time</option><option value="90">Last 90 days</option><option value="365">Last year</option></select></label></div>{points.length >= 2 ? <><p>Latest: {points[points.length - 1].value} · {fields[metric]}</p><svg viewBox="0 0 320 145" role="img" aria-label={`${fields[metric]} over time`}><polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points.map(point => `${x(point.time)},${y(point.value)}`).join(' ')}/>{points.map((point, index) => <circle key={`${point.date}-${index}`} cx={x(point.time)} cy={y(point.value)} r="4" fill="var(--accent)"/>)}</svg><div className="chart-axis"><span>{new Date(minTime).toLocaleDateString()}</span><span>{new Date(maxTime).toLocaleDateString()}</span></div></> : <p>{points.length ? 'One recorded value; more are needed for a trend.' : 'No values recorded for this metric.'}</p>}{points.length > 0 && <details className="chart-results"><summary>View {points.length} recorded values</summary><table className="result-table"><thead><tr><th scope="col">Date</th><th scope="col">{fields[metric]}</th></tr></thead><tbody>{[...points].reverse().map((point, index) => <tr key={`${point.date}-${index}`}><td>{new Date(point.date).toLocaleDateString()}</td><td>{point.value}</td></tr>)}</tbody></table></details>}</div>
}
