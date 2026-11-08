import { useState } from 'react'
import type { WorkoutExercise } from './WorkoutSession'

const fields = { duration: 'Duration (min)', speed: 'Speed (km/h)', incline: 'Incline (degrees)' } as const
export function CardioInsights({ records }: { records: { date: string; exercise: WorkoutExercise }[] }) {
  const [metric, setMetric] = useState<keyof typeof fields>('duration')
  const points = records.flatMap(({ date, exercise }) => {
    const value = exercise.cardio?.[metric]
    return value !== undefined && value !== '' && Number.isFinite(Number(value)) ? [{ date, value: Number(value) }] : []
  }).slice(0, 12)
  return <div><label>Cardio metric <select value={metric} onChange={event => setMetric(event.target.value as keyof typeof fields)}>{Object.entries(fields).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><p>Latest {points.length} recorded values; missing values are omitted. Incline is degrees, not percent.</p>{points.length ? <table className="result-table"><thead><tr><th scope="col">Date</th><th scope="col">{fields[metric]}</th></tr></thead><tbody>{points.map((point, index) => <tr key={`${point.date}-${index}`}><td>{new Date(point.date).toLocaleDateString()}</td><td>{point.value}</td></tr>)}</tbody></table> : <p>No values recorded for this metric.</p>}</div>
}
