import type { SupabaseClient } from '@supabase/supabase-js'
import { workspaceDocuments, workspaceFromRecords } from './workspace'
import type { StoredDocument } from './documents'
import type { Backup } from './backup'

export function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, String(value)) },
  }
}

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict'
type Request = { operation: string; revision: number; serialized: string; documents: ReturnType<typeof workspaceDocuments> }

/** In-memory coordination only: the server is the source of truth. */
export class OnlineWorkoutStore {
  private revision = 0
  private saved = ''
  private desired = ''
  private pending: Request | null = null
  private busy = false
  private status: SaveStatus = 'saved'
  onStatus: (status: SaveStatus) => void = () => {}

  constructor(private client: SupabaseClient, private owner: string) {}

  async load(): Promise<Backup | null> {
    const { data, error } = await this.client.rpc('tor_online_workout_read', { p_owner: this.owner })
    if (error) throw error
    if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Array.isArray(data.documents)) throw new Error('Invalid server response.')
    this.revision = data.revision
    if (data.revision === 0) {
      if (data.documents.length) throw new Error('Invalid empty workspace.')
      return null
    }
    const records: Record<string, StoredDocument> = {}
    for (const document of data.documents) {
      if (!document || !['exercise', 'routine', 'workout', 'session', 'settings'].includes(document.kind) || typeof document.id !== 'string' || !document.body || typeof document.body !== 'object' || Array.isArray(document.body)) throw new Error('Invalid server record.')
      const key = `${document.kind}/${document.id}`
      if (records[key]) throw new Error('Duplicate server record.')
      records[key] = { ...document, deleted: false, revision: data.revision, generation: 0, dirty: false }
    }
    const backup = workspaceFromRecords(records)
    this.saved = JSON.stringify(workspaceDocuments(backup))
    this.desired = this.saved
    return backup
  }

  update(snapshot: Backup) {
    this.desired = JSON.stringify(workspaceDocuments(snapshot))
    if (this.status === 'conflict' || this.status === 'error') return
    void this.flush()
  }

  retry() {
    if (this.status === 'conflict') return
    void this.flush()
  }

  private setStatus(status: SaveStatus) { this.status = status; this.onStatus(status) }

  private async flush() {
    if (this.busy || (!this.pending && this.desired === this.saved)) return
    this.busy = true
    this.setStatus('saving')
    try {
      while (this.pending || this.desired !== this.saved) {
        const request = this.pending || { operation: crypto.randomUUID(), revision: this.revision, serialized: this.desired, documents: JSON.parse(this.desired) }
        this.pending = request
        const { data, error } = await this.client.rpc('tor_online_workout_write', { p_owner: this.owner, p_revision: request.revision, p_operation: request.operation, p_documents: request.documents })
        if (error) throw error
        if (data?.status === 'conflict') { this.setStatus('conflict'); return }
        if (data?.status !== 'ok' || data.revision !== request.revision + 1) throw new Error('Invalid save response.')
        this.revision = data.revision
        this.saved = request.serialized
        this.pending = null
      }
      this.setStatus('saved')
    } catch {
      this.setStatus('error')
    } finally { this.busy = false }
  }
}

export function seedStorage(storage: Storage, owner: string, backup: Backup) {
  const key = `one-ring-user-${owner}`
  storage.setItem(key, JSON.stringify(backup.data))
  if (backup.days) storage.setItem(`${key}-routine`, JSON.stringify(backup.days))
  if (backup.routines) storage.setItem(`${key}-routine-book`, JSON.stringify(backup.routines))
  if (backup.library) storage.setItem(`${key}-library`, JSON.stringify(backup.library))
  storage.setItem(`${key}-warmups`, JSON.stringify(backup.warmupItems))
}
