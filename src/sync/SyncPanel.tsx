import { useEffect, useRef, useState } from 'react'
import type { Backup } from '../workout/backup'
import { supabase } from '../auth'
import { syncOnce } from './engine'
import { SyncStore, matchingRevisions, sameDocument, type Document, type StoredDocument } from './store'
import { supabaseTransport } from './supabase'
import { workspaceDocuments, workspaceFromRecords } from './workspace'

type Props = { owner: string; snapshot: Backup; hasLocalData: boolean; canImport: boolean; fingerprint: () => string; onImport: (backup: Backup) => void; onStatus: (status: string) => void }

export function SyncPanel({ owner, snapshot, hasLocalData, canImport, fingerprint, onImport, onStatus }: Props) {
  const [store, setStore] = useState<SyncStore | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Cloud sync has not been set up on this device.')
  const [conflict, setConflict] = useState(false)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const latest = useRef(snapshot)
  const previous = useRef<Document[]>([])
  const revisions = useRef<Record<string, number>>({})
  const running = useRef(false)
  const rerun = useRef(false)
  const alive = useRef(true)
  const otherTab = useRef(false)
  const canImportRef = useRef(canImport)
  const syncRef = useRef<() => void>(() => {})
  latest.current = snapshot
  canImportRef.current = canImport
  const serialized = JSON.stringify(snapshot)
  function rememberMatchingRevisions(records: Record<string, StoredDocument>) {
    revisions.current = matchingRevisions(records, previous.current, revisions.current)
  }

  useEffect(() => { onStatus(status) }, [status])
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  useEffect(() => {
    let active = true
    let opened: SyncStore | null = null
    const initialSnapshot = JSON.stringify(latest.current)
    const initialDisk = fingerprint()
    SyncStore.open().then(async next => {
      opened = next
      const state = await next.read(owner)
      if (!active) { next.close(); return }
      if (Object.keys(state.records).length) {
        const records = Object.values(state.records)
        const stored = records.filter(record => !record.deleted).map(({ kind, id, body, deleted }) => ({ kind, id, body, deleted }))
        revisions.current = Object.fromEntries(records.map(record => [`${record.kind}/${record.id}`, record.revision]))
        if (!hasLocalData) {
          if (initialSnapshot !== JSON.stringify(latest.current) || initialDisk !== fingerprint() || !canImportRef.current) throw new Error('Local data changed during recovery. Reload before syncing.')
          const imported = workspaceFromRecords(state.records)
          previous.current = workspaceDocuments(imported)
          revisions.current = Object.fromEntries(records.map(record => [`${record.kind}/${record.id}`, record.revision]))
          onImport(imported)
        } else {
          const local = workspaceDocuments(latest.current)
          const localByKey = new Map(local.map(item => [`${item.kind}/${item.id}`, item]))
          for (const record of records) {
            const key = `${record.kind}/${record.id}`
            if (!record.dirty && !sameDocument(record, localByKey.get(key))) revisions.current[key] = 0
          }
          await next.project(owner, stored, local, revisions.current)
          previous.current = local
        }
        if (!active) { next.close(); return }
        setEnabled(true)
        setConflict(Boolean(state.pending?.conflicts?.length))
        setStatus(state.pending?.conflicts?.length ? 'A sync conflict needs your attention.' : 'Local sync data is ready.')
      }
      setStore(next)
    }).catch(error => { if (active) setStatus(error instanceof Error ? `${error.message} Your existing browser data is unchanged; reload before syncing.` : 'IndexedDB is unavailable. Your existing browser data is unchanged; sync is disabled.') })
    return () => { active = false; opened?.close() }
  }, [owner])

  useEffect(() => {
    if (!store || !enabled) return
    let documents
    try { documents = workspaceDocuments(snapshot) } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to prepare local data.'); return }
    const before = previous.current
    const bases = { ...revisions.current }
    previous.current = documents
    // Serialize local writes so rapid edits cannot reorder snapshots.
    queue.current = queue.current.then(() => store.project(owner, before, documents, bases)).then(async () => { const state = await store.read(owner); if (state.pending?.conflicts?.length) setStatus('A sync conflict needs your attention.'); else if (Object.values(state.records).some(record => record.dirty)) setStatus('Changes saved locally; waiting to sync.') }).catch(() => { setStatus('Unable to save the sync queue. Export a backup and reload before continuing.'); throw new Error('IndexedDB write failed') })
    void queue.current.catch(() => {})
  }, [store, enabled, owner, serialized])

  async function connectOrSync(automatic = false) {
    if (!store || !supabase || !alive.current || otherTab.current || (automatic && (!enabled || conflict))) return
    if (running.current) { if (automatic) rerun.current = true; return }
    running.current = true
    setBusy(true)
    try {
      const beforeConnection = JSON.stringify(latest.current)
      const diskBeforeConnection = fingerprint()
      const transport = supabaseTransport(supabase, owner)
      if (!enabled) {
        const remote = await transport.pull()
        const visible = remote.filter(record => !record.deleted)
        if (visible.length) {
          const records: Record<string, StoredDocument> = Object.fromEntries(remote.map(record => [`${record.kind}/${record.id}`, { ...record, generation: 0, dirty: false }]))
          const imported = workspaceFromRecords(records)
          if (!window.confirm('This account already has cloud data. Download it and replace this device’s local workout data? Export a local backup first. Cancel leaves both unchanged.')) return
          if (beforeConnection !== JSON.stringify(latest.current) || diskBeforeConnection !== fingerprint() || !canImportRef.current) throw new Error('Local data changed while connecting. Please review and try again.')
          if (!canImportRef.current) throw new Error('Finish or leave your current workout or draft before downloading cloud data.')
          await store.mergeRemote(owner, remote)
          if (!alive.current || otherTab.current || !canImportRef.current || beforeConnection !== JSON.stringify(latest.current) || diskBeforeConnection !== fingerprint()) throw new Error('Local data changed while connecting. Please review and try again.')
          previous.current = workspaceDocuments(imported)
          revisions.current = Object.fromEntries(remote.map(record => [`${record.kind}/${record.id}`, record.revision]))
          onImport(imported)
          setEnabled(true); setConflict(false); setStatus('Cloud data downloaded to this device.')
          return
        }
        if (!window.confirm('No cloud data was found. Upload this device’s current workout data to your account?')) return
        const local = workspaceDocuments(latest.current)
        await store.replace(owner, local)
        previous.current = local
        revisions.current = {}
        setEnabled(true)
      }
      await queue.current
      const before = JSON.stringify(latest.current)
      const diskBefore = fingerprint()
      const result = await syncOnce(store, owner, transport)
      await queue.current
      const state = await store.read(owner)
      if (result === 'conflict') { setConflict(true); setStatus('A sync conflict needs your attention. No conflicting changes were overwritten.'); return }
      if (!alive.current) return
      rememberMatchingRevisions(state.records)
      if (otherTab.current || before !== JSON.stringify(latest.current) || diskBefore !== fingerprint() || Object.values(state.records).some(record => record.dirty)) { setStatus(otherTab.current ? 'Another tab changed local data. Close it and reload before syncing.' : 'New changes were made during sync. Sync again.'); return }
      if (!canImportRef.current) { setStatus('Changes sent; cloud updates will be applied after leaving the current workout or editor.'); return }
      const imported = workspaceFromRecords(state.records)
      previous.current = workspaceDocuments(imported)
      revisions.current = Object.fromEntries(Object.entries(state.records).map(([key, record]) => [key, record.revision]))
      onImport(imported)
      setConflict(false); setStatus('Synced with your account.')
    } catch (error) {
      setStatus(`Sync could not finish. Local data is unchanged. ${error instanceof Error ? error.message : 'Check your connection and database setup.'}`)
    } finally {
      running.current = false; setBusy(false)
      if (rerun.current && alive.current) { rerun.current = false; window.setTimeout(() => syncRef.current(), 1500) }
    }
  }

  syncRef.current = () => { void connectOrSync(true) }
  useEffect(() => {
    if (!enabled || !store || conflict) return
    const timer = window.setTimeout(() => syncRef.current(), 1500)
    return () => window.clearTimeout(timer)
  }, [enabled, store, conflict, serialized, canImport])
  useEffect(() => {
    if (!enabled || !store) return
    const retry = () => { if (document.visibilityState === 'visible') syncRef.current() }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    const timer = window.setInterval(retry, 60000)
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', retry); window.clearInterval(timer) }
  }, [enabled, store])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(`one-ring-user-${owner}`)) {
        otherTab.current = true
        setStatus('Another tab changed local data. Close it and reload before syncing.')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [owner])

  async function resolve(choice: 'local' | 'remote') {
    if (!store || !supabase || running.current || otherTab.current) return
    const message = choice === 'local'
      ? 'Keep the local version of every conflicting item and overwrite its cloud version on the next sync? Export both devices first if you need both copies.'
      : 'Replace every conflicting local item with its cloud version? Local edits to those items will be lost. Export a local backup first.'
    if (!window.confirm(message)) return
    running.current = true
    setBusy(true)
    try {
      await queue.current
      const before = JSON.stringify(latest.current)
      const diskBefore = fingerprint()
      const initial = await store.read(owner)
      const transport = supabaseTransport(supabase, owner)
      const remote = await transport.pull()
      await queue.current
      if (before !== JSON.stringify(latest.current) || diskBefore !== fingerprint()) throw new Error('Local data changed while resolving the conflict. Review and retry.')
      const state = await store.read(owner)
      if (!state.pending?.conflicts) throw new Error('No conflict to resolve.')
      // Recheck current server revisions, so the choice applies to fresh versions.
      const conflicts = state.pending.conflicts.map(item => ({ ...item, actual: remote.find(record => record.kind === item.kind && record.id === item.id)?.revision || 0 }))
      await store.markConflict(owner, state.pending.operationId, conflicts)
      await store.resolve(owner, choice, remote, Object.fromEntries(Object.entries(initial.records).map(([key, record]) => [key, record.generation])))
      setConflict(false)
      const result = await syncOnce(store, owner, transport)
      if (result === 'conflict') { setConflict(true); setStatus('The cloud changed again. Review the conflict and retry.'); return }
      await queue.current
      const after = await store.read(owner)
      if (!alive.current) return
      rememberMatchingRevisions(after.records)
      if (otherTab.current || before !== JSON.stringify(latest.current) || diskBefore !== fingerprint() || Object.values(after.records).some(record => record.dirty)) { setStatus(otherTab.current ? 'Another tab changed local data. Close it and reload before syncing.' : 'New changes were made during sync. Sync again.'); return }
      if (!canImportRef.current) { setConflict(false); setStatus('Conflict resolved; cloud updates will be applied after leaving the current workout or editor.'); return }
      const imported = workspaceFromRecords(after.records)
      previous.current = workspaceDocuments(imported)
      revisions.current = Object.fromEntries(Object.entries(after.records).map(([key, record]) => [key, record.revision]))
      onImport(imported); setConflict(false); setStatus('Conflict resolved and synced.')
    } catch (error) { setStatus(`Could not resolve conflict. ${error instanceof Error ? error.message : 'Try again.'}`) }
    finally { running.current = false; setBusy(false) }
  }

  return <section className="sync-panel"><h3>Cloud sync <span className="sync-beta">TESTING</span></h3><p role="status">{status}</p><p>After setup, sync runs while the app is open. Cloud updates wait until you leave workouts, editors, and Activity. Keep backups; demo data never syncs.</p><button className="outline-button" disabled={!store || busy || otherTab.current} onClick={() => { void connectOrSync() }}>{busy ? 'Working…' : enabled ? 'Sync now' : 'Set up sync'}</button>{conflict && <div className="sync-conflicts"><p>Choose a version for all conflicting items. Other pending changes will be retained.</p><button className="outline-button" disabled={busy || otherTab.current} onClick={() => { void resolve('local') }}>Keep local</button><button className="outline-button" disabled={busy || otherTab.current} onClick={() => { void resolve('remote') }}>Use cloud</button></div>}</section>
}
