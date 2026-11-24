import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { RecoveryOwnerContext, useAppDialogActive } from '../AppDialog'

// Modal dialogs escape an inert ancestor, so suspend open child dialogs as well.
export function RecoveryBoundary({ blocked, isBlockedNow, restoreDialogs, children }: { blocked: boolean; isBlockedNow: () => boolean; restoreDialogs: boolean; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const latestBlocked = useRef(isBlockedNow)
  latestBlocked.current = isBlockedNow
  const owner = useRef({ canProceed: () => !!root.current?.isConnected && root.current.dataset.recoveryBlocked !== 'true' && !latestBlocked.current() })
  const suspended = useRef(new Set<HTMLDialogElement>())
  const appDialogActive = useAppDialogActive()
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    element.inert = blocked
    if (!blocked) {
      if (restoreDialogs && !appDialogActive) {
        for (const dialog of suspended.current) if (dialog.isConnected && !dialog.open) dialog.showModal()
        suspended.current.clear()
      }
      return
    }
    const suspendDialogs = () => {
      element.querySelectorAll('dialog[open]').forEach(dialog => {
        if (dialog instanceof HTMLDialogElement) { suspended.current.add(dialog); dialog.close() }
      })
    }
    suspendDialogs()
    const observer = new MutationObserver(suspendDialogs)
    observer.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    return () => observer.disconnect()
  }, [blocked, restoreDialogs, appDialogActive])
  return <div ref={root} data-recovery-boundary="" data-recovery-blocked={blocked ? 'true' : undefined}><RecoveryOwnerContext.Provider value={owner.current}>{children}</RecoveryOwnerContext.Provider></div>
}
