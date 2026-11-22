import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'

/** Hover for pointer users; tap/click for touch and keyboard users. */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false)
  const visible = open || hover || focused
  const [position, setPosition] = useState({ left: 16, top: 16 })
  const root = useRef<HTMLSpanElement>(null)
  const id = useId()
  useEffect(() => {
    if (!visible) return
    const dismiss = () => { setOpen(false); setHover(false); setFocused(false) }
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) dismiss() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); root.current?.querySelector('button')?.focus(); dismiss() } }
    const scroll = dismiss
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('scroll', scroll, true)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape, true); window.removeEventListener('scroll', scroll, true) }
  }, [visible])
  const updatePosition = () => {
    const rect = root.current?.getBoundingClientRect()
    if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.min(300, window.innerWidth - 24) - 12)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 170)) })
  }
  return <span className={`workout-info ${visible ? 'is-open' : ''}`} ref={root} onPointerEnter={event => { if (event.pointerType === 'mouse') { updatePosition(); setHover(true) } }} onPointerLeave={() => setHover(false)}>
    <button type="button" className="workout-info-button" aria-label={label} aria-expanded={visible} aria-describedby={id} onFocus={event => { if (event.currentTarget.matches(':focus-visible')) { updatePosition(); setFocused(true) } }} onBlur={() => { setFocused(false); setOpen(false) }} onClick={() => { updatePosition(); setFocused(false); setHover(false); setOpen(value => !value) }}><Info size={17} aria-hidden="true"/></button>
    <span className="workout-info-popover" style={{ '--tip-left': `${position.left}px`, '--tip-top': `${position.top}px` } as React.CSSProperties} id={id} role="tooltip">{children}</span>
  </span>
}
