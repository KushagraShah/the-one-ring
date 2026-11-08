import type { Exercise } from './ExerciseLibrary'
import type { Backup } from './backup'
import type { Workout, WorkoutExercise } from './WorkoutSession'

type Day = { id?: string; name: string; subtitle: string; exercises: Exercise[] }

/** Isolated, fictional history; identities are shared with this demo's library and routine. */
export function demoWorkoutBackup(source: Day[], today = new Date()): Backup {
  const library: Exercise[] = []
  const identify = (exercise: Exercise): Exercise => {
    let existing = library.find(item => item.name === exercise.name)
    if (!existing) { existing = { ...exercise, id: crypto.randomUUID() }; library.push(existing) }
    return existing
  }
  const days = source.map(day => ({ ...day, id: crypto.randomUUID(), exercises: day.exercises.map(exercise => ({ ...identify(exercise), routineSlotId: crypto.randomUUID() })) }))
  for (const exercise of source.flatMap(day => day.exercises)) for (const name of exercise.alternatives || []) identify({ name, equipment: '', sets: '' })
  const workouts: Workout[] = Array.from({ length: 16 }, (_, index) => {
    const day = days[[0, 1, 3, 2][index % 4]]
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1 - index * 4, 12)
    const exercises: WorkoutExercise[] = day.exercises.slice(0, 3).map((exercise, position) => {
      const weight = [30, 20, 25][position] + Math.max(0, 3 - Math.floor(index / 4)) * 2.5
      return { id: crypto.randomUUID(), name: exercise.name, exerciseId: exercise.id, equipmentSnapshot: exercise.equipment, sessionSlotId: exercise.routineSlotId, source: 'planned', sets: [12, 10, 8].map(reps => ({ weight: String(weight), reps: String(reps), done: true })), skipped: false, note: index === 0 && position === 0 ? 'Example workout note.' : undefined }
    })
    if (day.name === 'Accessories') {
      const treadmill = day.exercises.find(exercise => /treadmill/i.test(exercise.name))
      if (treadmill) exercises.push({ id: crypto.randomUUID(), name: treadmill.name, exerciseId: treadmill.id, equipmentSnapshot: treadmill.equipment, sessionSlotId: treadmill.routineSlotId, source: 'planned', sets: [], skipped: false, cardio: { duration: String(20 + index % 3 * 5), speed: '5', incline: '8', done: true } })
    }
    return { id: crypto.randomUUID(), day: day.name, dayId: day.id, date: at.toISOString(), routineId: 'initial', routineName: 'My routine', exercises }
  })
  const completed = ['Push']
  return { version: 1, data: { completed, workouts, session: null }, warmupItems: [], days, library, routines: { active: 'initial', routines: [{ id: 'initial', name: 'My routine', days, completed }] } }
}

export function seedDemoWorkouts(storage: Storage, source: Day[], today?: Date) {
  const snapshot = demoWorkoutBackup(source, today)
  const key = 'one-ring-demo-v1'
  storage.setItem(key, JSON.stringify(snapshot.data))
  storage.setItem(`${key}-routine`, JSON.stringify(snapshot.days))
  storage.setItem(`${key}-library`, JSON.stringify(snapshot.library))
  storage.setItem(`${key}-routine-book`, JSON.stringify(snapshot.routines))
  storage.setItem(`${key}-warmups`, JSON.stringify(snapshot.warmupItems))
}
