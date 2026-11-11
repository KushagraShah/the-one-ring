import { useEffect, useRef, type ReactNode } from 'react'
import { CloseButton } from '../CloseButton'

/** Inline habit details, rather than a modal sheet. */
export function HabitPanel({ title, onClose, children, scrollPosition }: { title: string; onClose: () => void; children: ReactNode; scrollPosition?: { current: number } }) {
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => { if (body.current && scrollPosition) body.current.scrollTop = scrollPosition.current }, [])
  return <section className="habit-panel" aria-label={title}><header><strong>{title}</strong><CloseButton onClick={onClose}/></header><div ref={body} onScroll={event => { if (scrollPosition) scrollPosition.current = event.currentTarget.scrollTop }}>{children}</div></section>
}
