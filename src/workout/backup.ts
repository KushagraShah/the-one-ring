import type { Exercise } from './ExerciseLibrary'
import type { Session, Workout } from './WorkoutSession'
import type { Rotation } from './rotations'

type Day = { name: string; subtitle: string; exercises: Exercise[] }
type Routine = { id: string; name: string; days: Day[]; completed: string[]; skippedDays?: string[]; rotations?: Rotation[] }
export type Backup = { version: 1; data: { completed: string[]; skippedDays?: string[]; workouts: Workout[]; session: Session | null }; warmupItems: string[]; days?: Day[]; library?: Exercise[]; routines?: { active: string; routines: Routine[] } }

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string'
const optText = (v: unknown) => v === undefined || text(v)
const safeLink = (v: unknown) => { if (v === undefined || v === '') return true; if (!text(v)) return false; try { return ['http:', 'https:'].includes(new URL(v).protocol) } catch { return false } }
const strings = (v: unknown) => Array.isArray(v) && v.every(text)
const arrayOf = (v: unknown, fn: (x: unknown) => boolean) => Array.isArray(v) && v.every(fn)
const exercise = (v: unknown) => obj(v) && text(v.name) && text(v.equipment) && text(v.sets) && optText(v.id) && optText(v.note) && optText(v.instructions) && safeLink(v.video) && (v.tags === undefined || strings(v.tags)) && (v.archived === undefined || typeof v.archived === 'boolean') && (v.alternatives === undefined || strings(v.alternatives)) && (v.kind === undefined || v.kind === 'strength' || v.kind === 'cardio')
const day = (v: unknown) => obj(v) && text(v.name) && text(v.subtitle) && arrayOf(v.exercises, exercise)
const set = (v: unknown) => obj(v) && text(v.weight) && text(v.reps) && typeof v.done === 'boolean'
const cardio = (v: unknown) => obj(v) && text(v.duration) && text(v.speed) && text(v.incline) && typeof v.done === 'boolean'
const workoutExercise = (v: unknown) => obj(v) && text(v.name) && optText(v.exerciseId) && optText(v.plannedName) && optText(v.plannedId) && arrayOf(v.sets, set) && typeof v.skipped === 'boolean' && optText(v.note) && (v.cardio === undefined || cardio(v.cardio))
const workout = (v: unknown) => obj(v) && text(v.day) && text(v.date) && !Number.isNaN(Date.parse(v.date)) && arrayOf(v.exercises, workoutExercise)
const mapOf = (v: unknown, fn: (x: unknown) => boolean) => obj(v) && Object.values(v).every(fn)
const session = (v: unknown) => v === null || (obj(v) && text(v.day) && arrayOf(v.exercises, exercise) && mapOf(v.entries, entries => arrayOf(entries, set)) && strings(v.skipped) && strings(v.warmups) && (v.notes === undefined || mapOf(v.notes, text)) && (v.cardio === undefined || mapOf(v.cardio, cardio)))
const rotation = (v: unknown) => obj(v) && text(v.id) && text(v.name) && text(v.primaryDay) && text(v.complementDay) && Array.isArray(v.options) && v.options.length >= 2 && v.options.every(text) && new Set(v.options).size === v.options.length && optText(v.lastPrimaryId) && (v.days === undefined || (strings(v.days) && (v.days as string[]).length > 0 && new Set(v.days as string[]).size === (v.days as string[]).length)) && (v.remainingIds === undefined || (strings(v.remainingIds) && (v.remainingIds as string[]).length > 0 && new Set(v.remainingIds as string[]).size === (v.remainingIds as string[]).length && (v.remainingIds as string[]).every(id => (v.options as string[]).includes(id))))
const routine = (v: unknown) => obj(v) && text(v.id) && text(v.name) && arrayOf(v.days, day) && Array.isArray(v.days) && v.days.length > 0 && strings(v.completed) && (v.skippedDays === undefined || strings(v.skippedDays)) && (v.rotations === undefined || arrayOf(v.rotations, rotation))

export function parseBackup(input: string): Backup {
  if (input.length > 10_000_000) throw new Error('Backup is too large.')
  const value: unknown = JSON.parse(input)
  if (!obj(value) || value.version !== 1 || !obj(value.data) || !strings(value.data.completed) || (value.data.skippedDays !== undefined && !strings(value.data.skippedDays)) || !arrayOf(value.data.workouts, workout) || !session(value.data.session) || !strings(value.warmupItems) || (value.days !== undefined && (!arrayOf(value.days, day) || (value.days as unknown[]).length === 0)) || (value.library !== undefined && !arrayOf(value.library, exercise))) throw new Error('Invalid backup data.')
  if (value.routines !== undefined) {
    const book = value.routines
    if (!obj(book) || !text(book.active) || !arrayOf(book.routines, routine) || !(book.routines as Routine[]).some(item => item.id === book.active)) throw new Error('Invalid routines in backup.')
  }
  return value as Backup
}
