import { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react'

const useCommitEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

type Draft = { kind: string; data: unknown }
export class DraftRegistry {
  private entries = new Set<() => Draft | null>()
  register(read: () => Draft | null) { this.entries.add(read); return () => { this.entries.delete(read) } }
  has(prefix: string) { return [...this.entries].some(read => read()?.kind.startsWith(prefix)) }
  export() {
    const drafts = [...this.entries].map(read => read()).filter(Boolean)
    const blob = new Blob([JSON.stringify({ scope: 'workout-habit-manual-drafts', format: 1, drafts }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `one-ring-manual-drafts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click(); URL.revokeObjectURL(url)
  }
}
export const DraftContext = createContext<DraftRegistry | null>(null)
export function useDraftCapture(kind: string, data: unknown, active: boolean) {
  const registry = useContext(DraftContext)
  const latest = useRef({ kind, data, active })
  latest.current = { kind, data, active }
  useCommitEffect(() => registry?.register(() => latest.current.active ? { kind: latest.current.kind, data: latest.current.data } : null), [registry])
}
