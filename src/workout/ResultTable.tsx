import type { CardioEntry, SetEntry } from './WorkoutSession'

/** The same compact, readable result format is used during and after training. */
export function ResultTable({ sets, cardio }: { sets: SetEntry[]; cardio?: CardioEntry }) {
  if (cardio?.done) return <dl className="result-metrics"><div><dt>Duration</dt><dd>{cardio.duration || '—'} min</dd></div><div><dt>Speed</dt><dd>{cardio.speed || '—'} km/h</dd></div><div><dt>Incline</dt><dd>{cardio.incline || '—'}°</dd></div></dl>
  if (!sets.length) return null
  return <table className="result-table"><thead><tr><th scope="col">Set</th><th scope="col">Weight</th><th scope="col">Reps</th></tr></thead><tbody>{sets.map((set, index) => <tr key={index}><th scope="row">{index + 1}</th><td>{set.weight === '' ? '—' : `${set.weight} kg`}</td><td>{set.reps === '' ? '—' : set.reps}</td></tr>)}</tbody></table>
}
