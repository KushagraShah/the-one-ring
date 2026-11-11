import { useEffect, useId, useRef } from 'react'

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: { title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { ref.current?.showModal(); return () => { if (ref.current?.open) ref.current.close() } }, [])
  return <dialog ref={ref} className="app-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onCancel() }}><h2 id={titleId}>{title}</h2><p>{message}</p><div className="dialog-actions"><button className="outline-button" onClick={onCancel}><span aria-hidden="true">×</span> Go back</button><button className="primary" onClick={onConfirm}>{confirmLabel}</button></div></dialog>
}
