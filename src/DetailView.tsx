import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CloseButton } from './CloseButton'

/** Opens supporting information in a bounded view rather than expanding the page. */
export function DetailView({ title, trigger, children, className, closeOnAction = false, triggerLabel }: { title: string; trigger?: ReactNode; children: ReactNode; className?: string; closeOnAction?: boolean; triggerLabel?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  const backdropPress = useRef(false)
  const titleId = useId()
  useEffect(() => { const dialog = ref.current; if (!dialog || !open) return; dialog.showModal(); return () => { if (dialog.open) dialog.close() } }, [open])
  const close = () => { if (ref.current?.open) ref.current.close(); setOpen(false) }
  const outside = (element: HTMLDialogElement, x: number, y: number) => { const rect = element.getBoundingClientRect(); return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom }
  return <div className={className}><button type="button" className="detail-trigger" aria-label={triggerLabel} aria-haspopup="dialog" onClick={() => setOpen(true)}>{trigger || title}<span aria-hidden="true">›</span></button>{open && <dialog ref={ref} className="detail-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close() }} onPointerDown={event => { backdropPress.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY) }} onPointerCancel={() => { backdropPress.current = false }} onClick={event => { const dismiss = backdropPress.current && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY); backdropPress.current = false; if (dismiss) close() }}><header><h2 id={titleId}>{title}</h2><CloseButton onClick={close}/></header><div className="detail-dialog-body" onClick={event => { if (closeOnAction && (event.target as HTMLElement).closest('button')) close() }}>{children}</div></dialog>}</div>
}
