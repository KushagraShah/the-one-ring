import { useEffect, useRef, type ReactNode } from 'react'

/** Native modal dialog provides focus containment, Escape and focus restoration. */
export function Sheet({ title, onClose, children, scrollPosition }: { title: string; onClose: () => void; children: ReactNode; scrollPosition?: { current: number } }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const backdropPress = useRef(false)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    const body = element.querySelector('.sheet-body')
    if (body && scrollPosition) body.scrollTop = scrollPosition.current
    const cancel = (event: Event) => { event.preventDefault(); close.current() }
    element.addEventListener('cancel', cancel)
    return () => { element.removeEventListener('cancel', cancel); element.close() }
  }, [])
  const outside = (element: HTMLDialogElement, x: number, y: number) => { const rect = element.getBoundingClientRect(); return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom }
  return <dialog className="workout-sheet native-sheet" ref={dialog} aria-label={title} onPointerDown={event => { backdropPress.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY) }} onPointerCancel={() => { backdropPress.current = false }} onClick={event => { const dismiss = backdropPress.current && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY); backdropPress.current = false; if (dismiss) onClose() }}><div className="sheet-heading"><strong>{title}</strong><button type="button" className="text-button" onClick={onClose}>Close</button></div><div className="sheet-body" onScroll={event => { if (scrollPosition) scrollPosition.current = event.currentTarget.scrollTop }}>{children}</div></dialog>
}
