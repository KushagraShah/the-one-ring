import { useEffect, useRef, useState } from 'react'
import type { Backup } from '../backup'
import { supabase } from '../auth'
import { syncOnce } from './engine'
import { SyncStore, type StoredDocument } from './store'
import { supabaseTransport } from './supabase'
import { workspaceDocuments, workspaceFromRecords } from './workspace'

type Props = { owner: string; snapshot: Backup; hasLocalData: boolean; onImport: (backup: Backup) => void }

export function SyncPanel({ owner, snapshot, hasLocalData, onImport }: Props) {
  const [store, setStore] = useState<SyncStore | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Cloud sync has not been set up on this device.')
  const [conflict, setConflict] = useState(false)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const latest = useRef(snapshot)
  latest.current = snapshot
  const serialized = JSON.stringify(snapshot)

  useEffect(() => {
    let active = true
    let opened: SyncStore | null = null
    SyncStore.open().then(async next => {
      opened = next
      const state = await next.read(owner)
      if (!active) { next.close(); return }
      setStore(next)
      if (Object.keys(state.records).length) {
        if (!hasLocalData) onImport(workspaceFromRecords(state.records))
        setEnabled(true)
        setConflict(Boolean(state.pending?.conflicts?.length))
        setStatus(state.pending?.conflicts?.length ? 'A sync conflict needs your attention.' : Object.values(state.records).some(record => record.dirty) ? 'Changes waiting to sync.' : 'Local sync data is ready.')
      }
    }).catch(() => { if (active) setStatus('IndexedDB is unavailable. Your existing browser data is unchanged; sync is disabled.') })
    return () => { active = false; opened?.close() }
  }, [owner])

  useEffect(() => {
    if (!store || !enabled) return
    let documents
    try { documents = workspaceDocuments(snapshot) } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to prepare local data.'); return }
    // Serialize local writes so rapid edits cannot reorder snapshots.
    queue.current = queue.current.catch(() => {}).then(() => store.replace(owner, documents)).then(async () => { const state = await store.read(owner); if (Object.values(state.records).some(record => record.dirty)) setStatus('Changes saved locally; sync to check the cloud.') }).catch(() => { setStatus('Unable to save the sync queue. Export a backup before continuing.'); throw new Error('IndexedDB write failed') })
    void queue.current.catch(() => {})
  }, [store, enabled, owner, serialized])

  async function connectOrSync() {
    if (!store || !supabase || busy) return
    setBusy(true)
    try {
      const beforeConnection = JSON.stringify(latest.current)
      const transport = supabaseTransport(supabase, owner)
      if (!enabled) {
        const remote = await transport.pull()
        const visible = remote.filter(record => !record.deleted)
        if (visible.length) {
          const records: Record<string, StoredDocument> = Object.fromEntries(remote.map(record => [`${record.kind}/${record.id}`, { ...record, generation: 0, dirty: false }]))
          const imported = workspaceFromRecords(records)
          if (!window.confirm('This account already has cloud data. Download it and replace this device’s local workout data? Export a local backup first. Cancel leaves both unchanged.')) return
          if (beforeConnection !== JSON.stringify(latest.current)) throw new Error('Local data changed while connecting. Please review and try again.')
          await store.mergeRemote(owner, remote)
          onImport(imported)
          setEnabled(true); setConflict(false); setStatus('Cloud data downloaded to this device.')
          return
        }
        if (!window.confirm('No cloud data was found. Upload this device’s current workout data to your account?')) return
        await store.replace(owner, workspaceDocuments(latest.current))
        setEnabled(true)
      }
      await queue.current
      const before = JSON.stringify(latest.current)
      const result = await syncOnce(store, owner, transport)
      await queue.current
      const state = await store.read(owner)
      if (result === 'conflict') { setConflict(true); setStatus('A sync conflict needs your attention. No conflicting changes were overwritten.'); return }
      if (before !== JSON.stringify(latest.current) || Object.values(state.records).some(record => record.dirty)) { setStatus('New changes were made during sync. Sync again.'); return }
      const imported = workspaceFromRecords(state.records)
      onImport(imported)
      setConflict(false); setStatus('Synced with your account.')
    } catch (error) {
      setStatus(`Sync could not finish. Local data is unchanged. ${error instanceof Error ? error.message : 'Check your connection and database setup.'}`)
    } finally { setBusy(false) }
  }

  async function resolve(choice: 'local' | 'remote') {
    if (!store || !supabase || busy) return
    const message = choice === 'local'
      ? 'Keep the local version of every conflicting item and overwrite its cloud version on the next sync? Export both devices first if you need both copies.'
      : 'Replace every conflicting local item with its cloud version? Local edits to those items will be lost. Export a local backup first.'
    if (!window.confirm(message)) return
    setBusy(true)
    try {
      await queue.current
      const before = JSON.stringify(latest.current)
      const transport = supabaseTransport(supabase, owner)
      const remote = await transport.pull()
      const state = await store.read(owner)
      if (!state.pending?.conflicts) throw new Error('No conflict to resolve.')
      // Recheck current server revisions, so the choice applies to fresh versions.
      const conflicts = state.pending.conflicts.map(item => ({ ...item, actual: remote.find(record => record.kind === item.kind && record.id === item.id)?.revision || 0 }))
      await store.markConflict(owner, state.pending.operationId, conflicts)
      await store.resolve(owner, choice, remote)
      const result = await syncOnce(store, owner, transport)
      if (result === 'conflict') { setConflict(true); setStatus('The cloud changed again. Review the conflict and retry.'); return }
      await queue.current
      const after = await store.read(owner)
      if (before !== JSON.stringify(latest.current) || Object.values(after.records).some(record => record.dirty)) { setStatus('New changes were made during sync. Sync again.'); return }
      onImport(workspaceFromRecords(after.records)); setConflict(false); setStatus('Conflict resolved and synced.')
    } catch (error) { setStatus(`Could not resolve conflict. ${error instanceof Error ? error.message : 'Try again.'}`) }
    finally { setBusy(false) }
  }

  return <section className="sync-panel"><h3>Cloud sync <span className="sync-beta">TESTING</span></h3><p role="status">{status}</p><p>Back up first. Sync requires the database migrations and an internet connection. Demo data never syncs.</p><button className="outline-button" disabled={!store || busy} onClick={() => { void connectOrSync() }}>{busy ? 'Working…' : enabled ? 'Sync now' : 'Set up sync'}</button>{conflict && <div className="sync-conflicts"><p>Choose a version for all conflicting items. Other pending changes will be retained.</p><button className="outline-button" disabled={busy} onClick={() => { void resolve('local') }}>Keep local</button><button className="outline-button" disabled={busy} onClick={() => { void resolve('remote') }}>Use cloud</button></div>}</section>
}
