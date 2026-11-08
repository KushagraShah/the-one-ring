import type { Kind, RemoteDocument, SyncBatch, SyncStore } from './store'

export type SyncResult = { status: 'ok'; records: { kind: Kind; id: string; revision: number }[] } | { status: 'conflict'; conflicts: NonNullable<SyncBatch['conflicts']> }

export interface SyncTransport {
  pull(): Promise<RemoteDocument[]>
  push(batch: SyncBatch): Promise<SyncResult>
}

/** Network failures deliberately leave the saved operation intact for retry. */
export async function syncOnce(store: SyncStore, owner: string, transport: SyncTransport): Promise<'synced' | 'conflict'> {
  const remote = await transport.pull()
  await store.mergeRemote(owner, remote)
  const batch = await store.prepare(owner)
  if (!batch) return 'synced'
  if (batch.conflicts?.length) return 'conflict'
  const result = await transport.push(batch)
  if (result.status === 'conflict') {
    await store.markConflict(owner, batch.operationId, result.conflicts)
    return 'conflict'
  }
  await store.acknowledge(owner, batch.operationId, result.records)
  // An edit may have landed while the request was in flight. Do not report it synced.
  const remaining = await store.read(owner)
  return Object.values(remaining.records).some(record => record.dirty) ? syncOnce(store, owner, transport) : 'synced'
}
