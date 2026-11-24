import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type RecoveryOwner = { canProceed: () => boolean }
type Request = { message: string; confirm: boolean; confirmLabel?: string; owner: RecoveryOwner | null; resolve: (accepted: boolean) => void }
const eventName = 'one-ring-app-dialog'
const DialogActive = createContext(false)
export const RecoveryOwnerContext = createContext<RecoveryOwner | null>(null)
export const useAppDialogActive = () => useContext(DialogActive)
function request(message: string, confirm: boolean, confirmLabel?: string, owner?: RecoveryOwner | null): Promise<boolean> {
  const boundary = document.activeElement?.closest<HTMLElement>('[data-recovery-boundary]')
  const stableOwner = owner || (boundary ? { canProceed: () => boundary.isConnected && boundary.dataset.recoveryBlocked !== 'true' } : null)
  return new Promise(resolve => window.dispatchEvent(new CustomEvent<Request>(eventName, { detail: { message, confirm, confirmLabel, owner: stableOwner, resolve } })))
}
export const confirmAction = (message: string, confirmLabel?: string) => request(message, true, confirmLabel)
export const showMessage = (message: string) => request(message, false)
export function useScopedConfirm() {
  const owner = useContext(RecoveryOwnerContext)
  return (message: string, confirmLabel?: string) => request(message, true, confirmLabel, owner)
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Request[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  const requestRef = useRef<Request[]>([])
  const settled = useRef(new WeakSet<Request>())
  requestRef.current = queue
  useEffect(() => {
    const listener = (event: Event) => setQueue(current => [...current, (event as CustomEvent<Request>).detail])
    window.addEventListener(eventName, listener)
    return () => { window.removeEventListener(eventName, listener); requestRef.current.forEach(item => item.resolve(false)) }
  }, [])
  useEffect(() => { if (queue.length && dialog.current && !dialog.current.open) dialog.current.showModal(); else if (!queue.length && dialog.current?.open) dialog.current.close() }, [queue.length])
  const current = queue[0]
  const finish = (accepted: boolean) => { if (!current || settled.current.has(current)) return; settled.current.add(current); setQueue(items => items.slice(1)); current.resolve(accepted && (!current.owner || current.owner.canProceed())) }
  return <DialogActive.Provider value={queue.length > 0}>{children}{createPortal(<dialog ref={dialog} className="app-dialog app-message-dialog" aria-labelledby="app-message-title" onCancel={event => { event.preventDefault(); finish(false) }}><h2 id="app-message-title">{current?.confirm ? 'Please confirm' : 'Notice'}</h2><p>{current?.message}</p><div className="dialog-actions">{current?.confirm && <button type="button" className="outline-button" onClick={() => finish(false)} autoFocus><span aria-hidden="true">×</span> Cancel</button>}<button type="button" className="primary" onClick={() => finish(true)}>{current?.confirm ? current.confirmLabel || 'Continue' : 'OK'}</button></div></dialog>, document.body)}</DialogActive.Provider>
}
