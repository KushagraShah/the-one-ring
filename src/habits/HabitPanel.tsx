import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseButton } from '../CloseButton'

/** Inline habit details, rather than a modal sheet. */
export function HabitPanel({ title, onClose, children, scrollPosition }: { title: string; onClose: () => void; children: ReactNode; scrollPosition?: { current: number } }) {
  const body = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { const current = dialog.current; current?.showModal(); return () => { if (current?.open) current.close() } }, [])
  useEffect(() => { if (body.current && scrollPosition) body.current.scrollTop = scrollPosition.current }, [])
  return <dialog ref={dialog} className="detail-dialog habit-modal habit-panel" aria-labelledby={titleId} onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); onClose() }}><header><strong id={titleId}>{title}</strong><CloseButton onClick={onClose}/></header><div ref={body} onScroll={event => { if (scrollPosition) scrollPosition.current = event.currentTarget.scrollTop }}>{children}</div></dialog>
}
