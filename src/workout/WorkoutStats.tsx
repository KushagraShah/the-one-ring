import type { WorkoutExercise } from './WorkoutSession'

/** Chart the supplied results; the accompanying table is accessible. */
export function WorkoutStats({ records }: { records: { date: string; exercise: WorkoutExercise }[] }) {
  const points = records.map(({ date, exercise }) => {
    const sets = exercise.sets.filter(set => set.weight !== '' && Number.isFinite(Number(set.weight)))
    const best = sets.reduce<typeof sets[number] | undefined>((current, set) => !current || Number(set.weight) > Number(current.weight) ? set : current, undefined)
    return best ? { date, weight: Number(best.weight), reps: best.reps } : null
  }).filter((point): point is { date: string; weight: number; reps: string } => point !== null).reverse()
  if (points.length < 2) return <p className="stats-empty">At least two recorded weights are needed for a chart.</p>
  const max = Math.max(...points.map(point => point.weight), 1)
  return <div className="progress-chart"><h3>Top recorded weight</h3><p>Heaviest set per workout among the results used for this chart; reps are shown alongside each weight.</p><div className="chart-bars" aria-hidden="true">{points.map((point, index) => <div className="chart-column" key={`${point.date}-${index}`}><span>{point.weight} kg</span><div className="chart-track"><div style={{ height: `${Math.max(4, point.weight / max * 100)}%` }}/></div><small>{new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></div>)}</div><table className="result-table"><thead><tr><th scope="col">Date</th><th scope="col">Weight</th><th scope="col">Reps</th></tr></thead><tbody>{points.map((point, index) => <tr key={`${point.date}-${index}`}><td>{new Date(point.date).toLocaleDateString()}</td><td>{point.weight} kg</td><td>{point.reps || '—'}</td></tr>)}</tbody></table></div>
}
