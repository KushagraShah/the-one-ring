import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Request = { message: string; confirm: boolean; resolve: (accepted: boolean) => void }
const eventName = 'one-ring-app-dialog'
function request(message: string, confirm: boolean): Promise<boolean> {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent<Request>(eventName, { detail: { message, confirm, resolve } })))
}
export const confirmAction = (message: string) => request(message, true)
export const showMessage = (message: string) => request(message, false)

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
  const finish = (accepted: boolean) => { if (!current || settled.current.has(current)) return; settled.current.add(current); setQueue(items => items.slice(1)); current.resolve(accepted) }
  return <>{children}{createPortal(<dialog ref={dialog} className="app-dialog app-message-dialog" aria-labelledby="app-message-title" onCancel={event => { event.preventDefault(); finish(false) }}><h2 id="app-message-title">{current?.confirm ? 'Please confirm' : 'Notice'}</h2><p>{current?.message}</p><div className="dialog-actions">{current?.confirm && <button type="button" className="outline-button" onClick={() => finish(false)} autoFocus>Cancel</button>}<button type="button" className="primary" onClick={() => finish(true)}>{current?.confirm ? 'Continue' : 'OK'}</button></div></dialog>, document.body)}</>
}
