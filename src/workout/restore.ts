import { workspaceDocuments } from './workspace'
import { parseBackup, type Backup } from './backup'

/** Prepare and validate the entire replacement before changing the current workspace. */
export function prepareRestore(parsed: Backup, currentDays: NonNullable<Backup['days']>): Backup {
  const active = parsed.routines?.routines.find(routine => routine.id === parsed.routines?.active)
  const days = parsed.days || active?.days || currentDays
  const data = { ...parsed.data, workouts: parsed.data.workouts.map(workout => ({ ...workout, id: workout.id || crypto.randomUUID() })) }
  const routines = parsed.routines || { active: 'initial', routines: [{ id: 'initial', name: 'Restored routine', days, completed: data.completed }] }
  const normalizedRoutines = { ...routines, routines: routines.routines.map(routine => routine.id === routines.active ? { ...routine, days, completed: data.completed, skippedDays: data.skippedDays || [] } : routine) }
  const exercises = parsed.library || days.flatMap(day => day.exercises).filter((exercise, index, list) => list.findIndex(item => item.name === exercise.name) === index)
  const library = exercises.map(exercise => ({ ...exercise, id: exercise.id || crypto.randomUUID() }))
  const backup = parseBackup(JSON.stringify({ version: 1, data, warmupItems: parsed.warmupItems, days, library, routines: normalizedRoutines }))
  // Includes stable-ID and duplicate-record checks used by the online writer.
  workspaceDocuments(backup)
  return backup
}
