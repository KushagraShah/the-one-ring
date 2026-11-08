import type { Exercise } from './ExerciseLibrary'
import type { CardioEntry, Session, SetEntry, Workout, WorkoutExercise } from './WorkoutSession'
import type { Rotation } from './rotations'

export function adjacentExercise(session: Session, name: string, offset: number): string | null {
  const index = session.exercises.findIndex(exercise => exercise.name === name)
  if (index < 0 || !session.exercises.length) return null
  return session.exercises[((index + offset) % session.exercises.length + session.exercises.length) % session.exercises.length].name
}

/** These operations affect only the session snapshot, never the saved routine. */
export function addSessionExercise(session: Session, exercise: Exercise, sets: SetEntry[], cardio: CardioEntry): Session {
  return { ...session, exercises: [...session.exercises, { ...exercise, rotationGroupId: undefined, rotationMode: undefined, sessionSlotId: undefined, sessionItemId: crypto.randomUUID(), sessionSource: 'extra' }], entries: { ...session.entries, [exercise.name]: sets }, cardio: { ...session.cardio, [exercise.name]: cardio } }
}

export function replaceSessionExercise(session: Session, exercise: Exercise, replacement: Exercise, sets: SetEntry[], previousCardio: CardioEntry, cycle?: Rotation): Session {
  if (cycle && (exercise.rotationGroupId !== cycle.id || !replacement.id || !cycle.options.includes(replacement.id))) throw new Error('The selected exercise is not a variant of this cycle.')
  const entries = { ...session.entries }; delete entries[exercise.name]; entries[replacement.name] = sets
  const notes = { ...session.notes }; delete notes[exercise.name]
  const cardio = { ...session.cardio }; delete cardio[exercise.name]; cardio[replacement.name] = previousCardio
  return { ...session, exercises: session.exercises.map(item => item.name === exercise.name ? { ...replacement, plannedName: exercise.plannedName || exercise.name, plannedId: exercise.plannedId || exercise.id, sessionSlotId: exercise.sessionSlotId, sessionItemId: exercise.sessionItemId, sessionSource: exercise.sessionSource === 'extra' ? 'extra' : cycle ? 'cycle' : 'substitution', rotationGroupId: cycle?.id, rotationMode: cycle ? exercise.rotationMode : undefined, alternatives: [exercise.name, ...(exercise.alternatives || []).filter(item => item !== replacement.name)] } : item), entries, notes, cardio, skipped: session.skipped.filter(item => item !== exercise.name) }
}

export function toggleSessionSkip(session: Session, exercise: Exercise, sets: SetEntry[], cardio: CardioEntry): { session: Session; next: string | null } {
  const wasSkipped = session.skipped.includes(exercise.name)
  return {
    session: { ...session, skipped: wasSkipped ? session.skipped.filter(item => item !== exercise.name) : [...session.skipped, exercise.name], entries: { ...session.entries, [exercise.name]: sets.map(set => ({ ...set, done: false })) }, cardio: { ...session.cardio, [exercise.name]: { ...cardio, done: false } } },
    next: wasSkipped ? null : adjacentExercise(session, exercise.name, 1),
  }
}

export function exerciseComplete(session: Session, exercise: Exercise): boolean {
  if (exercise.kind === 'cardio' || (!exercise.kind && /treadmill/i.test(exercise.name))) return Boolean(session.cardio?.[exercise.name]?.done)
  const sets = session.entries[exercise.name] || []
  return sets.length === 3 && sets.every(set => set.done)
}

export function sessionAccountedFor(session: Session): boolean {
  return session.exercises.length > 0 && session.exercises.every(exercise => session.skipped.includes(exercise.name) || exerciseComplete(session, exercise))
}

export function recentPerformances(workouts: Workout[], target: Exercise, limit = Infinity, exact = false): { date: string; exercise: WorkoutExercise }[] {
  const results: { date: string; exercise: WorkoutExercise }[] = []
  if (limit <= 0) return results
  for (const workout of [...workouts].sort((a, b) => b.date.localeCompare(a.date))) for (const exercise of workout.exercises) {
    if ((exercise.exerciseId && target.id ? exercise.exerciseId === target.id : exact && (exercise.exerciseId || target.id) ? false : exercise.name === target.name) &&
        (exercise.sets.length > 0 || exercise.cardio?.done)) {
      results.push({ date: workout.date, exercise })
      if (results.length >= limit) return results
    }
  }
  return results
}
