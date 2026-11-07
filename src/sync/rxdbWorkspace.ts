import { createRxDatabase, type RxCollection, type RxDatabase, type RxJsonSchema } from 'rxdb/plugins/core'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { replicateSupabase } from 'rxdb/plugins/replication-supabase'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { parseBackup, type Backup } from '../workout/backup'

/** A workout workspace is one atomic local document. Other mini-apps use their own collections. */
export type WorkspaceDocument = { id: string; user_id: string; payload: string; alternatives: string }
type Collections = { workspaces: RxCollection<WorkspaceDocument> }

const schema: RxJsonSchema<WorkspaceDocument> = {
  title: 'workout workspace',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    user_id: { type: 'string', maxLength: 36 },
    payload: { type: 'string' },
    alternatives: { type: 'string' },
  },
  required: ['id', 'user_id', 'payload', 'alternatives'],
}

/** Preserve both sides rather than using RxDB's default server-wins handler. */
export function conflictAlternatives(server: WorkspaceDocument, local: WorkspaceDocument): WorkspaceDocument {
  const parse = (value: string): string[] => {
    const result: unknown = JSON.parse(value)
    if (!Array.isArray(result) || !result.every(item => typeof item === 'string')) throw new Error('Invalid conflict data.')
    return result
  }
  const alternatives = [...new Set([...parse(server.alternatives), ...parse(local.alternatives), local.payload])].filter(value => value !== server.payload).sort()
  return { ...server, alternatives: JSON.stringify(alternatives) }
}

export async function openWorkoutWorkspace(owner: string, databaseName = `one-ring-rxdb-${owner.toLowerCase()}`): Promise<RxDatabase<Collections>> {
  if (!/^(demo|[0-9a-f-]{36})$/i.test(owner)) throw new Error('Invalid workspace owner.')
  const database = await createRxDatabase<Collections>({ name: databaseName, storage: getRxStorageDexie(), multiInstance: true })
  await database.addCollections({
    workspaces: {
      schema,
      conflictHandler: {
        isEqual: (a, b) => a.id === b.id && a.user_id === b.user_id && a.payload === b.payload && a.alternatives === b.alternatives && a._deleted === b._deleted,
        resolve: async ({ realMasterState, newDocumentState }) => ({ ...conflictAlternatives(realMasterState, newDocumentState), _deleted: false }),
      },
    },
  })
  return database
}

export async function readWorkoutWorkspace(database: RxDatabase<Collections>, owner: string): Promise<Backup | null> {
  const document = await database.workspaces.findOne(`${owner}-workout`).exec()
  return document ? parseBackup(document.payload) : null
}

export async function writeWorkoutWorkspace(database: RxDatabase<Collections>, owner: string, snapshot: Backup): Promise<void> {
  const payload = JSON.stringify(snapshot)
  parseBackup(payload)
  const id = `${owner}-workout`
  const existing = await database.workspaces.findOne(id).exec()
  if (existing) {
    await existing.incrementalModify(current => {
      if (JSON.parse(current.alternatives).length) throw new Error('Resolve the workspace conflict before editing.')
      current.payload = payload
      return current
    })
  } else await database.workspaces.insert({ id, user_id: owner, payload, alternatives: '[]' })
}

/** Bind every request to the intended account, including after account switches. */
export function startWorkoutReplication(database: RxDatabase<Collections>, owner: string, authClient: SupabaseClient, url: string, publishableKey: string) {
  const client = createClient(url, publishableKey, {
    accessToken: async () => {
      const { data, error } = await authClient.auth.getSession()
      if (error || !data.session || data.session.user.id !== owner) throw new Error('The signed-in account changed; replication stopped.')
      return data.session.access_token
    },
  })
  return replicateSupabase({
    collection: database.workspaces,
    tableName: 'tor_rx_workout_workspaces',
    client,
    replicationIdentifier: `workout-${owner}`,
    live: true,
    pull: { batchSize: 20, queryBuilder: ({ query }) => query.eq('user_id', owner) },
    push: { batchSize: 20 },
  })
}
