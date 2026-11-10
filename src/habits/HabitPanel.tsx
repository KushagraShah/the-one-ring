import { useEffect, useRef, type ReactNode } from 'react'

/** Inline habit details, rather than a modal sheet. */
export function HabitPanel({ title, onClose, children, scrollPosition }: { title: string; onClose: () => void; children: ReactNode; scrollPosition?: { current: number } }) {
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => { if (body.current && scrollPosition) body.current.scrollTop = scrollPosition.current }, [])
  return <section className="habit-panel" aria-label={title}><header><strong>{title}</strong><button type="button" className="text-button" onClick={onClose}>Close</button></header><div ref={body} onScroll={event => { if (scrollPosition) scrollPosition.current = event.currentTarget.scrollTop }}>{children}</div></section>
}
