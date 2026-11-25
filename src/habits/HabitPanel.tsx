import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseButton } from '../CloseButton'

/** Native modal; its owner keeps close and recovery guards. */
export function HabitPanel({ title, onClose, children, scrollPosition, variant }: { title: string; onClose: () => void; children: ReactNode; scrollPosition?: { current: number }; variant?: 'form' }) {
  const body = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { const current = dialog.current; if (current && !current.open) current.showModal(); return () => { if (current?.open) current.close() } }, [])
  useEffect(() => { if (body.current && scrollPosition) body.current.scrollTop = scrollPosition.current }, [])
  return <dialog ref={dialog} className={`detail-dialog habit-modal habit-panel${variant === 'form' ? ' habit-modal-form' : ''}`} aria-labelledby={titleId} onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); onClose() }}><header className="habit-modal-header"><h2 id={titleId} className="habit-modal-title">{title}</h2><CloseButton onClick={onClose}/></header><div ref={body} className="habit-modal-body" onScroll={event => { if (scrollPosition) scrollPosition.current = event.currentTarget.scrollTop }}>{children}</div></dialog>
}
