import type { SupabaseClient } from '@supabase/supabase-js'
import type { Kind, RemoteDocument, SyncBatch } from './store'
import type { SyncResult, SyncTransport } from './engine'

const kinds = new Set(['exercise', 'routine', 'workout', 'session', 'settings'])

export function supabaseTransport(client: SupabaseClient, owner: string): SyncTransport {
  async function authorization() {
    const { data, error } = await client.auth.getSession()
    if (error || !data.session || data.session.user.id !== owner) throw new Error('The signed-in account changed. Sync stopped; your local data is retained.')
    return `Bearer ${data.session.access_token}`
  }
  return {
    async pull() {
      const token = await authorization()
      const records: RemoteDocument[] = []
      // Stable ordering and pagination avoid silently truncating histories.
      for (let start = 0; ; start += 500) {
        const { data, error } = await client.from('tor_sync_records').select('kind,entity_id,revision,deleted,body').eq('user_id', owner).order('kind').order('entity_id').range(start, start + 499).setHeader('Authorization', token)
        if (error) throw error
        if (!data) throw new Error('Missing sync response.')
        for (const row of data) {
          if (!kinds.has(row.kind) || typeof row.entity_id !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.deleted !== 'boolean' || (row.deleted ? row.body !== null : !row.body || typeof row.body !== 'object' || Array.isArray(row.body))) throw new Error('Invalid sync data from server.')
          records.push({ kind: row.kind as Kind, id: row.entity_id, revision: row.revision, deleted: row.deleted, body: row.body })
        }
        if (data.length < 500) return records
      }
    },
    async push(batch: SyncBatch) {
      const token = await authorization()
      const { data, error } = await client.rpc('tor_apply_sync_batch', { p_operation_id: batch.operationId, p_changes: batch.changes }).setHeader('Authorization', token)
      if (error) throw error
      if (!data || (data.status !== 'ok' && data.status !== 'conflict')) throw new Error('Invalid sync response from server.')
      if (data.status === 'ok' && !Array.isArray(data.records)) throw new Error('Invalid sync response from server.')
      if (data.status === 'conflict' && !Array.isArray(data.conflicts)) throw new Error('Invalid sync response from server.')
      return data as SyncResult
    },
  }
}
