import type { Exercise } from './ExerciseLibrary'

// Legacy fields are retained so existing local backups remain readable.
export type Rotation = { id: string; name: string; primaryDay: string; complementDay: string; options: string[]; lastPrimaryId?: string; days?: string[]; remainingIds?: string[] }

export function rotationDays(group: Rotation): string[] {
  return group.days || [group.primaryDay, group.complementDay].filter(Boolean)
}

export function remainingRotationOptions(group: Rotation): string[] {
  if (group.remainingIds?.length) return group.remainingIds.filter(id => group.options.includes(id))
  const index = group.lastPrimaryId ? group.options.indexOf(group.lastPrimaryId) : -1
  return [...group.options.slice(index + 1), ...group.options.slice(0, index + 1)]
}

export function plannedRotation(group: Rotation, _mode?: 'primary' | 'complement'): string {
  return remainingRotationOptions(group)[0] || group.options[0]
}

export function planExercises(dayName: string, exercises: Exercise[], library: Exercise[], rotations: Rotation[]): Exercise[] {
  return exercises.map(exercise => {
    const original = { ...exercise, id: exercise.id || library.find(item => item.name === exercise.name)?.id }
    const group = rotations.find(item => rotationDays(item).includes(dayName) && original.id && item.options.includes(original.id))
    if (!group) return original
    const chosen = library.find(item => item.id === plannedRotation(group))
    if (!chosen) return original
    return { ...chosen, rotationGroupId: group.id, rotationMode: 'primary' }
  })
}

export function advanceRotations(rotations: Rotation[], exercises: Exercise[], completedNames: string[]): Rotation[] {
  return rotations.map(group => {
    const performed = exercises.find(exercise => exercise.rotationGroupId === group.id && completedNames.includes(exercise.name) && exercise.id && group.options.includes(exercise.id))
    if (!performed?.id) return group
    const remaining = remainingRotationOptions(group)
    if (!remaining.includes(performed.id)) return group
    const next = remaining.filter(id => id !== performed.id)
    return { ...group, lastPrimaryId: performed.id, remainingIds: next.length ? next : [...group.options] }
  })
}
