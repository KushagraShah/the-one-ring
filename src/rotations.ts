import type { Exercise } from './ExerciseLibrary'

export type Rotation = { id: string; name: string; primaryDay: string; complementDay: string; options: [string, string]; lastPrimaryId?: string }

export function plannedRotation(group: Rotation, mode: 'primary' | 'complement'): string {
  const [first, second] = group.options
  if (mode === 'primary') return group.lastPrimaryId === first ? second : first
  return group.lastPrimaryId === second ? first : second
}

export function planExercises(dayName: string, exercises: Exercise[], library: Exercise[], rotations: Rotation[]): Exercise[] {
  return exercises.map(exercise => {
    const original = { ...exercise, id: exercise.id || library.find(item => item.name === exercise.name)?.id }
    const group = rotations.find(item => (item.primaryDay === dayName || item.complementDay === dayName) && original.id && item.options.includes(original.id))
    if (!group) return original
    const mode = group.primaryDay === dayName ? 'primary' : 'complement'
    const chosen = library.find(item => item.id === plannedRotation(group, mode))
    if (!chosen) return original
    return { ...chosen, rotationGroupId: group.id, rotationMode: mode }
  })
}

export function advanceRotations(rotations: Rotation[], exercises: Exercise[], completedNames: string[]): Rotation[] {
  return rotations.map(group => {
    const performed = exercises.find(exercise => exercise.rotationGroupId === group.id && exercise.rotationMode === 'primary' && completedNames.includes(exercise.name))
    return performed?.id && group.options.includes(performed.id) ? { ...group, lastPrimaryId: performed.id } : group
  })
}
