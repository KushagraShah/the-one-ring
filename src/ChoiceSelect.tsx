import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from 'react'

type Option = { value: string; label: string; disabled: boolean; group?: string }
type Props = { label: string; value?: string | number; onChange: (value: string) => void; children: ReactNode }

/** A touch- and keyboard-accessible, app-styled alternative to a native select. */
export function ChoiceSelect({ label, value, onChange, children }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDialogElement>(null)
  const backdropPress = useRef(false)
  const titleId = useId()
  const valueId = useId()
  const options: Option[] = []
  const collect = (nodes: ReactNode, group?: string) => Children.forEach(nodes, node => {
    if (!isValidElement(node)) return
    const props = node.props as { value?: string | number; disabled?: boolean; label?: string; children?: ReactNode }
    if (node.type === 'optgroup') collect(props.children, props.label)
    else if (node.type === 'option') {
      const text = Children.toArray(props.children).map(item => typeof item === 'string' || typeof item === 'number' ? String(item) : '').join('')
      options.push({ value: String(props.value ?? text), label: text, disabled: Boolean(props.disabled), group })
    }
  })
  collect(children)
  const visible = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = options.find(option => option.value === String(value ?? ''))
  useEffect(() => { const dialog = ref.current; if (!dialog || !open) return; dialog.showModal(); dialog.querySelector<HTMLInputElement>('.choice-search input')?.focus(); return () => { if (dialog.open) dialog.close() } }, [open])
  const close = () => { if (ref.current?.open) ref.current.close(); setOpen(false) }
  const outside = (element: HTMLDialogElement, x: number, y: number) => { const rect = element.getBoundingClientRect(); return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom }
  return <><button type="button" className="choice-trigger" aria-label={label} aria-describedby={valueId} aria-haspopup="dialog" onClick={() => { setQuery(''); setOpen(true) }}><span id={valueId}>{selected?.label || 'Choose'}</span><span aria-hidden="true">⌄</span></button>{open && <dialog ref={ref} className="choice-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close() }} onPointerDown={event => { backdropPress.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY) }} onPointerCancel={() => { backdropPress.current = false }} onClick={event => { const dismiss = backdropPress.current && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY); backdropPress.current = false; if (dismiss) close() }}><header><h2 id={titleId}>{label}</h2><button type="button" className="text-button" onClick={close}>Close</button></header>{options.length > 8 && <label className="choice-search">Filter options<input type="search" value={query} onChange={event => setQuery(event.target.value)} autoFocus/></label>}<div className="choice-list">{visible.length === 0 && <p className="choice-empty">No matching options.</p>}{visible.map((option, index) => <div key={`${option.value}-${index}`}>{option.group && (index === 0 || option.group !== visible[index - 1].group) && <p className="choice-group">{option.group}</p>}<button type="button" disabled={option.disabled} aria-pressed={option.value === String(value ?? '')} onClick={() => { close(); if (option.value !== String(value ?? '')) onChange(option.value) }}><span>{option.label}</span>{option.value === String(value ?? '') && <span aria-hidden="true">✓</span>}</button></div>)}</div></dialog>}</>
}
