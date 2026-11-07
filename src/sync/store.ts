import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type Kind = 'exercise' | 'routine' | 'workout' | 'session' | 'settings'
export type Document = { kind: Kind; id: string; body: Record<string, unknown> | null; deleted: boolean }
export type StoredDocument = Document & { revision: number; generation: number; dirty: boolean }
export type RemoteDocument = Document & { revision: number }
export type SyncChange = Document & { base_revision: number }
export type SyncBatch = { operationId: string; changes: SyncChange[]; generations: Record<string, number>; conflicts?: { kind: Kind; id: string; expected: number; actual: number }[] }
export type SyncState = { records: Record<string, StoredDocument>; pending: SyncBatch | null }

interface SyncDatabase extends DBSchema {
  workspaces: { key: string; value: SyncState }
}

const documentKey = (kind: Kind, id: string) => `${kind}/${id}`
const empty = (): SyncState => ({ records: {}, pending: null })
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
  return value
}
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
export const sameDocument = (a: Document | undefined, b: Document | undefined) => Boolean(a && b && a.kind === b.kind && a.id === b.id && a.deleted === b.deleted && equal(a.body, b.body))
/** Only advance the UI's base when it already displays that exact server value. */
export function matchingRevisions(records: Record<string, StoredDocument>, displayed: Document[], previous: Record<string, number>): Record<string, number> {
  const visible = new Map(displayed.map(document => [documentKey(document.kind, document.id), document]))
  const revisions = { ...previous }
  for (const [key, record] of Object.entries(records)) if (!record.dirty && sameDocument(record, visible.get(key))) revisions[key] = record.revision
  return revisions
}

/** One database contains independent account/demo workspaces, keyed by owner. */
export class SyncStore {
  private constructor(private db: IDBPDatabase<SyncDatabase>) {}

  static async open(name = 'one-ring-sync-v1'): Promise<SyncStore> {
    const db = await openDB<SyncDatabase>(name, 1, { upgrade(database) { database.createObjectStore('workspaces') } })
    return new SyncStore(db)
  }

  close() { this.db.close() }

  async read(owner: string): Promise<SyncState> {
    return (await this.db.get('workspaces', owner)) || empty()
  }

  /** Atomically commit related local changes; no network is required. */
  async put(owner: string, documents: Document[]): Promise<void> {
    const tx = this.db.transaction('workspaces', 'readwrite')
    const state = (await tx.store.get(owner)) || empty()
    for (const document of documents) {
      const key = documentKey(document.kind, document.id)
      const current = state.records[key]
      if (current && current.deleted === document.deleted && equal(current.body, document.body)) continue
      state.records[key] = { ...document, revision: current?.revision || 0, generation: (current?.generation || 0) + 1, dirty: true }
    }
    await tx.store.put(state, owner)
    await tx.done
  }

  /** Replace the local projection in one transaction, keeping removals as tombstones. */
  async replace(owner: string, documents: Document[]): Promise<void> {
    const tx = this.db.transaction('workspaces', 'readwrite')
    const state = (await tx.store.get(owner)) || empty()
    const incoming = new Map(documents.map(document => [documentKey(document.kind, document.id), document]))
    for (const [key, old] of Object.entries(state.records)) {
      if (!incoming.has(key) && !old.deleted) incoming.set(key, { kind: old.kind, id: old.id, body: null, deleted: true })
    }
    for (const [key, document] of incoming) {
      const current = state.records[key]
      if (current && current.deleted === document.deleted && equal(current.body, document.body)) continue
      state.records[key] = { ...document, revision: current?.revision || 0, generation: (current?.generation || 0) + 1, dirty: true }
    }
    await tx.store.put(state, owner)
    await tx.done
  }

  /** Project only changes made by the UI since its last snapshot. A newer
   * unseen cloud revision must not become the base for a local edit. */
  async project(owner: string, previous: Document[], documents: Document[], baseRevisions: Record<string, number>): Promise<void> {
    const tx = this.db.transaction('workspaces', 'readwrite')
    const state = (await tx.store.get(owner)) || empty()
    const before = new Map(previous.map(document => [documentKey(document.kind, document.id), document]))
    const after = new Map(documents.map(document => [documentKey(document.kind, document.id), document]))
    for (const [key, old] of before) if (!after.has(key)) after.set(key, { kind: old.kind, id: old.id, body: null, deleted: true })
    for (const [key, document] of after) {
      const old = before.get(key)
      if (old && old.deleted === document.deleted && equal(old.body, document.body)) continue
      const current = state.records[key]
      if (current && current.deleted === document.deleted && equal(current.body, document.body)) continue
      const base = current && sameDocument(current, old) ? current.revision : baseRevisions[key] ?? 0
      state.records[key] = { ...document, revision: current?.dirty ? current.revision : base, generation: (current?.generation || 0) + 1, dirty: true }
    }
    await tx.store.put(state, owner)
    await tx.done
  }

  /** Persist an immutable request before sending it, so interrupted calls retry safely. */
  async prepare(owner: string): Promise<SyncBatch | null> {
    const tx = this.db.transaction('workspaces', 'readwrite')
    const state = (await tx.store.get(owner)) || empty()
    if (!state.pending) {
      const dirty = Object.values(state.records).filter(record => record.dirty)
      if (dirty.length) {
        // A single operation is atomic; don't silently split related records.
        if (dirty.length > 500) { tx.abort(); await tx.done.catch(() => {}); throw new Error('Too many pending changes for one sync batch.') }
        state.pending = { operationId: crypto.randomUUID(), changes: dirty.map(({ kind, id, body, deleted, revision }) => ({ kind, id, body, deleted, base_revision: revision })), generations: Object.fromEntries(dirty.map(record => [documentKey(record.kind, record.id), record.generation])) }
        await tx.store.put(state, owner)
      }
    }
    await tx.done
    return state.pending
  }

  /** Acknowledge only the exact version sent; edits made in flight remain dirty. */
  async acknowledge(owner: string, operationId: string, versions: { kind: Kind; id: string; revision: number }[]): Promise<void> {
    const tx = this.db.transaction('workspaces', 'readwrite')
    const state = (await tx.store.get(owner)) || empty()
    const pending = state.pending
    if (!pending || pending.operationId !== operationId) { await tx.done; return }
    const byKey = new Map(versions.map(version => [documentKey(version.kind, version.id), version]))
    if (versions.length !== pending.changes.length || pending.changes.some(change => {
      const version = byKey.get(documentKey(change.kind, change.id))
      return !version || version.revision !== change.base_revision + 1
    })) { tx.abort(); await tx.done.catch(() => {}); throw new Error('Invalid sync response; pending data retained.') }
    for (const change of pending.changes) {
      const key = documentKey(change.kind, change.id)
      const record = state.records[key]
      if (!record) { tx.abort(); await tx.done.catch(() => {}); throw new Error('Local sync record missing; pending data retained.') }
      record.revision = byKey.get(key)!.revision
      record.dirty = record.generation !== pending.generations[key]
    }
    state.pending = null
    await tx.store.put(state, owner)
    await tx.done
  }

  async markConflict(owner: string, operationId: string, conflicts: NonNullable<SyncBatch['conflicts']>): Promise<void> {
    const tx = this.db.transaction('workspaces', 'readwrite')
    const state = (await tx.store.get(owner)) || empty()
    if (state.pending?.operationId === operationId) { state.pending.conflicts = conflicts; await tx.store.put(state, owner) }
    await tx.done
  }

  /** Pulling never overwrites a local edit or an in-flight request. */
  async mergeRemote(owner: string, documents: RemoteDocument[]): Promise<void> {
    const tx = this.db.transaction('workspaces', 'readwrite')
    const state = (await tx.store.get(owner)) || empty()
    for (const document of documents) {
      const key = documentKey(document.kind, document.id)
      const local = state.records[key]
      if (local?.dirty || (local && local.revision >= document.revision)) continue
      state.records[key] = { ...document, generation: local?.generation || 0, dirty: false }
    }
    await tx.store.put(state, owner)
    await tx.done
  }

  /** Explicitly resolve conflicts against fresh server versions. */
  async resolve(owner: string, choice: 'local' | 'remote', remote: RemoteDocument[], expectedGenerations?: Record<string, number>): Promise<void> {
    const tx = this.db.transaction('workspaces', 'readwrite')
    const state = (await tx.store.get(owner)) || empty()
    const pending = state.pending
    if (!pending?.conflicts?.length) { await tx.done; return }
    const remoteByKey = new Map(remote.map(record => [documentKey(record.kind, record.id), record]))
    for (const conflict of pending.conflicts) {
      const key = documentKey(conflict.kind, conflict.id)
      const local = state.records[key]
      const server = remoteByKey.get(key)
      if (!local || (server?.revision || 0) !== conflict.actual) { tx.abort(); await tx.done.catch(() => {}); throw new Error('Server data changed; refresh the conflict before resolving.') }
      if (expectedGenerations && local.generation !== expectedGenerations[key]) { tx.abort(); await tx.done.catch(() => {}); throw new Error('Local data changed while resolving the conflict. Review and retry.') }
      if (choice === 'local') { local.revision = server?.revision || 0; local.dirty = true }
      else if (server) state.records[key] = { ...server, generation: local.generation + 1, dirty: false }
      else delete state.records[key]
    }
    state.pending = null
    await tx.store.put(state, owner)
    await tx.done
  }
}
