import { parseBackup, type Backup } from '../backup'
import type { Document, StoredDocument } from './store'

const settingsId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const legacyRoutineId = '00000000-0000-4000-8000-000000000003'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const doc = (kind: Document['kind'], id: string, body: object): Document => {
  if (!uuid.test(id)) throw new Error(`Cannot sync ${kind}: missing stable ID.`)
  return { kind, id, body: JSON.parse(JSON.stringify(body)), deleted: false }
}

/** Split a local workspace into independent records; each workout is a separate record. */
export function workspaceDocuments(snapshot: Backup): Document[] {
  if (!snapshot.routines || !snapshot.library) throw new Error('Workspace is missing routines or the exercise library.')
  const docs: Document[] = [doc('settings', settingsId, { active: snapshot.routines.active, warmupItems: snapshot.warmupItems })]
  for (const exercise of snapshot.library) docs.push(doc('exercise', exercise.id || '', exercise))
  for (const routine of snapshot.routines.routines) docs.push(doc('routine', routine.id === 'initial' ? legacyRoutineId : routine.id, routine))
  for (const workout of snapshot.data.workouts) docs.push(doc('workout', workout.id || '', workout))
  if (snapshot.data.session) docs.push(doc('session', sessionId, { session: snapshot.data.session }))
  const keys = docs.map(item => `${item.kind}/${item.id}`)
  if (new Set(keys).size !== keys.length) throw new Error('Workspace contains duplicate IDs.')
  return docs
}

/** Decode and validate a complete projection before replacing any local state. */
export function workspaceFromRecords(records: Record<string, StoredDocument>): Backup {
  const visible = Object.values(records).filter(record => !record.deleted)
  const settings = visible.find(record => record.kind === 'settings' && record.id === settingsId)?.body
  if (!settings || typeof settings.active !== 'string' || !Array.isArray(settings.warmupItems)) throw new Error('Cloud workspace has no valid settings record.')
  const routines = visible.filter(record => record.kind === 'routine').map(record => record.body)
  const active = routines.find(routine => routine?.id === settings.active)
  if (!active) throw new Error('Cloud workspace is missing its active routine.')
  const workouts = visible.filter(record => record.kind === 'workout').map(record => record.body).sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')))
  const session = visible.find(record => record.kind === 'session' && record.id === sessionId)?.body?.session || null
  return parseBackup(JSON.stringify({ version: 1, data: { completed: active.completed, skippedDays: active.skippedDays || [], workouts, session }, warmupItems: settings.warmupItems, days: active.days, library: visible.filter(record => record.kind === 'exercise').map(record => record.body), routines: { active: settings.active, routines } }))
}
