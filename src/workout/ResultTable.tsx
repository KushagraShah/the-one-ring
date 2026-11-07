import type { CardioEntry, SetEntry } from './WorkoutSession'

/** Keep each result on one compact line without losing per-set differences. */
export function formatResult(sets: SetEntry[], cardio?: CardioEntry): string {
  if (cardio?.done) return `${cardio.duration || '—'} min · ${cardio.speed || '—'} km/h · ${cardio.incline || '—'}°`
  if (!sets.length) return ''
  const reps = sets.map(set => set.reps || '—')
  if (sets.every(set => set.weight === sets[0].weight)) {
    return `${reps.join(' / ')} × ${sets[0].weight === '' ? 'weight not recorded' : `${sets[0].weight} kg`}`
  }
  return sets.map(set => `${set.reps || '—'} × ${set.weight === '' ? '—' : `${set.weight} kg`}`).join(' · ')
}

export function ResultTable({ sets, cardio }: { sets: SetEntry[]; cardio?: CardioEntry }) {
  const result = formatResult(sets, cardio)
  return result ? <span className="compact-result">{result}</span> : null
}
