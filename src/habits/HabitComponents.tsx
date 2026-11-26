import { DetailView } from '../DetailView'
import { ChoiceSelect } from '../ChoiceSelect'
import { useEffect, useId, useRef, useState } from 'react'
import { useScopedConfirm } from '../AppDialog'
import { localDate, MIN_HABIT_DATE, outcomeLabel, paused, shiftDate, validHabitDate, versionAt, type Criteria, type Habit, type Outcome, type Schedule } from './model'
import { InfoTip } from '../InfoTip'
import { useDraftCapture } from '../app/DraftCapture'

const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const cap = (text: string) => text[0].toUpperCase() + text.slice(1)
const validDate = validHabitDate
const fullDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

export function CriteriaList({ criteria }: { criteria?: Criteria }) {
  if (!criteria || !(criteria.done || criteria.partial || criteria.missed)) return null
  return <dl className="habit-criteria-list" aria-label="Outcome criteria">{(['done', 'partial', 'missed'] as const).map(key => criteria[key] && <div key={key}><dt>{cap(key)}</dt><dd>{criteria[key]}</dd></div>)}</dl>
}

export type HabitDraft = { habitId: string; date: string; outcome: Outcome | null; note: string; originalOutcome: Outcome | null; originalNote: string }
export function EntryEditor({ habit, draft, onChange, onNoteBlur, onOutcome, allowOutcome = true }: { habit: Habit; draft: HabitDraft; onChange: (draft: HabitDraft) => void; onNoteBlur: (note: string) => void; onOutcome: (outcome: Outcome | null) => void; allowOutcome?: boolean }) {
  const id = useId()
  const options = ['done', 'partial', 'missed'] as const
  const flexible = versionAt(habit.schedules, draft.date)?.kind === 'flexible'
  const currentLabel = draft.outcome ? outcomeLabel(habit, draft.date, draft.outcome) : null
  const canonical = draft.outcome ? cap(draft.outcome) : null
  return <div className="habit-details habit-entry-editor">
    <p className="habit-entry-context"><strong>{fullDate(draft.date)}</strong><span>{currentLabel ? `${currentLabel}${currentLabel.trim() !== canonical ? ` · ${canonical}` : ''}` : draft.originalNote.trim() ? 'Unlogged · Note saved' : 'Unlogged'}</span></p>
    {habit.description && <p>{habit.description}</p>}
    {allowOutcome ? <>
      <p className="habit-detail-label">{draft.originalOutcome ? 'Change outcome' : 'How did it go?'} <InfoTip label="About habit outcomes">Done adds 1 point; Partial adds ½; Missed and Skip add 0. Two Partial outcomes meet a one-point goal. An unlogged day is not automatically Missed. Skip applies only to this day: it is excluded from fixed performance and coverage, and does not exclude a flexible week or reduce its target.</InfoTip></p>
      <div className="habit-outcomes habit-outcome-choices">{options.map(outcome => {
        const personal = outcomeLabel(habit, draft.date, outcome)
        return <button type="button" key={outcome} aria-label={personal} aria-describedby={`${id}-${outcome}`} aria-pressed={draft.outcome === outcome} className={draft.outcome === outcome ? `selected outcome-${outcome}` : ''} onClick={() => onOutcome(draft.outcome === outcome ? null : outcome)}><span className="habit-choice-title">{personal}</span><span id={`${id}-${outcome}`} className="habit-choice-description">{personal.trim() !== cap(outcome) ? `${cap(outcome)} · ` : ''}{outcome === 'done' ? '1 point' : outcome === 'partial' ? '½ point' : '0 points'}</span></button>
      })}</div>
      <div className="habit-intentional-skip"><div><strong>Intentional skip</strong><p>{flexible ? 'This day only · 0 points. Skip does not exclude the week from judgment or reduce its target.' : 'This day only; excluded from fixed performance and coverage.'}</p></div><button type="button" aria-pressed={draft.outcome === 'skipped'} onClick={() => onOutcome(draft.outcome === 'skipped' ? null : 'skipped')}>Skip habit</button></div>
      <p className="habit-form-help">Outcomes apply immediately. Tap the selected outcome again to unlog it; your note is kept.</p>
    </> : <p>No new outcome is available on this date; this unlogged note can still be edited.</p>}
    <label>Note<textarea value={draft.note} onChange={event => onChange({ ...draft, note: event.target.value })} onBlur={event => onNoteBlur(event.target.value)}/></label>
  </div>
}

export function PauseControls({ habit, onChange }: { habit: Habit; onChange: (habit: Habit) => boolean }) {
  const id = useId()
  const untilInput = useRef<HTMLInputElement>(null)
  const [until, setUntil] = useState('')
  const [error, setError] = useState('')
  const today = localDate()
  const apply = (next: Habit) => {
    try {
      if (!onChange(next)) { setError('Changes could not be accepted. Your pause date is still here.'); return }
      setUntil('')
      setError('')
    } catch {
      setError('Changes could not be accepted. Your pause date is still here.')
    }
  }
  if (habit.start > today || (habit.end && habit.end < today)) return null
  if (paused(habit, today)) return <div className="habit-pause"><button type="button" className="text-button" onClick={() => apply({ ...habit, pauses: habit.pauses.flatMap(p => p.start <= today && (!p.end || p.end >= today) ? p.start === today ? [] : [{ ...p, end: shiftDate(today, -1) }] : [p]) })}>Resume today</button>{error && <p className="habit-field-error" role="alert">{error}</p>}</div>
  return <div className="habit-pause">
    <label htmlFor={`${id}-until`}>Pause through<input ref={untilInput} id={`${id}-until`} type="date" min={today} value={until} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={event => { setUntil(event.target.value); setError('') }}/></label>
    <p id={`${id}-help`} className="habit-form-help">Starts today; end date included. Leave blank for an indefinite pause.</p>
    {error && <p id={`${id}-error`} className="habit-field-error" role="alert">{error}</p>}
    <button type="button" onClick={() => {
      const input = untilInput.current
      if ((until && (!validDate(until) || until < today)) || input?.validity.badInput) { setError('Choose a valid pause end date on or after today.'); input?.focus(); return }
      apply({ ...habit, pauses: [...habit.pauses, { start: today, end: until || null }] })
    }}>Pause {until ? 'through date' : 'indefinitely'}</button>
  </div>
}

type Field = 'title' | 'days' | 'target' | 'start' | 'end' | 'effective' | 'icon'
type FieldErrors = Partial<Record<Field, string>>
const fieldOrder: Field[] = ['title', 'days', 'target', 'start', 'end', 'effective', 'icon']

export function HabitForm({ initial, onSave, onCancel, focusField }: { initial: Habit | null; onSave: (habit: Habit) => boolean; onCancel: () => void; focusField?: 'end' | null }) {
  const confirmAction = useScopedConfirm()
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const fields = useRef<Partial<Record<Field, HTMLInputElement | null>>>({})
  const mounted = useRef(false)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const today = localDate()
  const initialEffective = initial ? today < initial.start ? initial.start : initial.end && today > initial.end ? initial.end : today : today
  const [title, setTitle] = useState(initial?.title || '')
  const [icon, setIcon] = useState(initial?.icon || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [start, setStart] = useState(initial?.start || today)
  const [end, setEnd] = useState(initial?.end || '')
  const [effective, setEffective] = useState(initialEffective)
  const existing = initial ? versionAt(initial.schedules, initialEffective) : undefined
  const oldCriteria = initial ? versionAt(initial.criteria, initialEffective) : undefined
  const [kind, setKind] = useState<Schedule['kind']>(existing?.kind || 'fixed')
  const [days, setDays] = useState<number[]>(existing?.weekdays || [0, 1, 2, 3, 4, 5, 6])
  const [target, setTarget] = useState(String(existing?.target || 1))
  const [done, setDone] = useState(oldCriteria?.done || '')
  const [partial, setPartial] = useState(oldCriteria?.partial || '')
  const [missed, setMissed] = useState(oldCriteria?.missed || '')
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [mutationError, setMutationError] = useState('')
  const [focusRequest, setFocusRequest] = useState(0)
  useDraftCapture('habit-form', { initialId: initial?.id || null, title, icon, description, start, end, effective, kind, days, target, done, partial, missed }, true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const reveal = (field: Field) => {
    const control = fields.current[field]
    control?.focus({ preventScroll: true })
    control?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  }
  useEffect(() => {
    if (!focusField) return
    const frame = requestAnimationFrame(() => reveal(focusField))
    return () => cancelAnimationFrame(frame)
  }, [focusField])
  useEffect(() => {
    if (!focusRequest) return
    const first = fieldOrder.find(field => errors[field])
    if (!first) return
    const frame = requestAnimationFrame(() => reveal(first))
    return () => cancelAnimationFrame(frame)
  }, [focusRequest])

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    const goal = Number(target)
    if (!title.trim() || fields.current.title?.validity.valueMissing) next.title = 'Enter a habit name.'
    if (!days.length) next.days = 'Choose at least one day.'
    if (kind === 'flexible' && (!/^\d+$/.test(target.trim()) || !Number.isFinite(goal) || !Number.isInteger(goal) || goal < 1 || goal > days.length || fields.current.target?.validity.badInput)) next.target = days.length ? `Enter a whole-number goal from 1 to ${days.length}.` : 'Choose eligible weekdays, then enter a whole-number goal.'
    if (!validDate(start) || fields.current.start?.validity.badInput) next.start = 'Choose a valid start date.'
    if ((end && (!validDate(end) || (validDate(start) && end < start))) || fields.current.end?.validity.badInput) next.end = 'Choose an end date on or after the start date.'
    if (initial && (!validDate(effective) || (validDate(start) && effective < start) || (validDate(end) && effective > end) || fields.current.effective?.validity.badInput)) next.effective = "Choose an effective date within the habit's active dates."
    if (icon.length > 32 || fields.current.icon?.validity.tooLong) next.icon = 'Use an icon of at most 32 characters.'
    return next
  }
  // Recompute submitted feedback when a field or one of its dependencies changes.
  useEffect(() => {
    if (submitted) setErrors(validate())
  }, [submitted, title, days, kind, target, start, end, effective, icon])

  // The input may be empty while typing. Only a deliberate version load replaces this baseline.
  const loaded = useRef({ date: initialEffective, kind, days, target, done, partial, missed })
  const begin = () => { if (busy.current) return false; busy.current = true; setPending(true); return true }
  const finish = () => { busy.current = false; if (mounted.current) setPending(false) }
  const changeEffective = async (next: string) => {
    if (next === effective || !begin()) return
    try {
      if (!validDate(next) || next === loaded.current.date) { setEffective(next); return }
      const baseline = loaded.current
      const changed = baseline.kind !== kind || JSON.stringify([...baseline.days].sort()) !== JSON.stringify([...days].sort()) || (kind === 'flexible' && (!target.trim() || Number(baseline.target) !== Number(target))) || baseline.done !== done || baseline.partial !== partial || baseline.missed !== missed
      if (changed && !await confirmAction('Changing the effective date reloads its saved schedule and criteria. Discard your unsaved schedule and criteria edits?')) return
      if (mounted.current) {
        const schedule = initial ? versionAt(initial.schedules, next) : undefined
        const criteria = initial ? versionAt(initial.criteria, next) : undefined
        const version = { date: next, kind: schedule?.kind || 'fixed' as const, days: schedule?.weekdays || [0, 1, 2, 3, 4, 5, 6], target: String(schedule?.target || 1), done: criteria?.done || '', partial: criteria?.partial || '', missed: criteria?.missed || '' }
        loaded.current = version
        setKind(version.kind); setDays(version.days); setTarget(version.target)
        setDone(version.done); setPartial(version.partial); setMissed(version.missed)
        setMutationError(''); setEffective(next)
      }
    } finally { finish() }
  }
  const cancel = async () => {
    if (!begin()) return
    try { if (await confirmAction('Discard unsaved habit changes?', 'Discard changes') && mounted.current) onCancel() }
    finally { finish() }
  }
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!begin()) return
    setMutationError('')
    setSubmitted(true)
    try {
      const nextErrors = validate()
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length) { setFocusRequest(value => value + 1); return }
      const from = initial ? effective : start
      const schedule: Schedule = { effective: from, kind, weekdays: [...days].sort(), target: kind === 'fixed' ? 1 : Number(target) }
      const criteria: Criteria = { effective: from, done, partial, missed }
      const beforeSchedule = initial && versionAt(initial.schedules, from)
      const beforeCriteria = initial && versionAt(initial.criteria, from)
      const sameSchedule = beforeSchedule && beforeSchedule.kind === schedule.kind && beforeSchedule.target === schedule.target && JSON.stringify([...beforeSchedule.weekdays].sort()) === JSON.stringify(schedule.weekdays)
      const sameCriteria = beforeCriteria && beforeCriteria.done === done && beforeCriteria.partial === partial && beforeCriteria.missed === missed
      if (initial && (start !== initial.start || (end || null) !== initial.end) && !await confirmAction('Changing active dates changes which days are expected. Existing records and criteria are kept. If the start is earlier, the earliest schedule and criteria are used for the added dates. Continue?')) return
      if (!mounted.current) return
      let schedules = initial ? sameSchedule ? [...initial.schedules] : [...initial.schedules.filter(item => item.effective !== from), schedule] : [schedule]
      let allCriteria = initial ? sameCriteria ? [...initial.criteria] : [...initial.criteria.filter(item => item.effective !== from), criteria] : [criteria]
      if (initial && !versionAt(schedules, start)) schedules = [...schedules, { ...[...schedules].sort((a, b) => a.effective.localeCompare(b.effective))[0], effective: start }]
      if (initial && !versionAt(allCriteria, start)) allCriteria = [...allCriteria, { ...[...allCriteria].sort((a, b) => a.effective.localeCompare(b.effective))[0], effective: start }]
      const habit: Habit = { id: initial?.id || crypto.randomUUID(), title: title.trim(), icon: icon.trim(), description, start, end: end || null, archived: initial?.archived || false, pauses: initial?.pauses || [], schedules, criteria: allCriteria }
      if (!onSave(habit) && mounted.current) setMutationError('Changes could not be accepted; your draft is still open.')
    } catch {
      if (mounted.current) setMutationError('Changes could not be accepted; your draft is still open.')
    } finally { finish() }
  }
  const fieldProps = (field: Field) => ({
    id: `${id}-${field}`,
    ref: (element: HTMLInputElement | null) => { fields.current[field] = element },
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined,
  })
  const feedback = (field: Field) => errors[field] && <p id={`${id}-${field}-error`} className="habit-field-error">{errors[field]}</p>
  return <form ref={form} noValidate className="habit-form settings-card" onSubmit={submit} onChange={() => setMutationError('')}>
    <p className="habit-form-help">Scroll for all fields and save actions.</p>
    <label htmlFor={`${id}-title`}>Title<input {...fieldProps('title')} value={title} required onChange={event => setTitle(event.target.value)}/></label>
    {feedback('title')}

    <section className="habit-form-section" aria-labelledby={`${id}-schedule-heading`}>
      <h3 id={`${id}-schedule-heading`}>Schedule</h3>
      <p className="habit-form-help">Choose when this habit is available. Flexible habits have a weekly goal rather than being due every selected day.</p>
      <label>Schedule<ChoiceSelect label="Schedule" value={kind} onChange={value => setKind(value as Schedule['kind'])}><option value="fixed">Fixed weekdays</option><option value="flexible">Flexible weekly target</option></ChoiceSelect></label>
      <fieldset aria-invalid={Boolean(errors.days)} aria-describedby={errors.days ? `${id}-days-error` : undefined}>
        <legend>{kind === 'fixed' ? 'Due weekdays' : 'Eligible weekdays'}</legend>
        <div className="habit-weekdays">{labels.map((label, day) => <label key={label}><input type="checkbox" ref={day === 0 ? element => { fields.current.days = element } : undefined} checked={days.includes(day)} onChange={event => setDays(event.target.checked ? [...days, day] : days.filter(item => item !== day))}/>{label}</label>)}</div>
      </fieldset>
      {feedback('days')}
      {kind === 'flexible' && <><label htmlFor={`${id}-target`}>Weekly goal (points)<input {...fieldProps('target')} type="text" inputMode="numeric" required value={target} aria-describedby={`${id}-target-help${errors.target ? ` ${id}-target-error` : ''}`} onChange={event => setTarget(event.target.value)}/></label><p id={`${id}-target-help`} className="habit-form-help">Done adds 1; Partial adds ½.</p>{feedback('target')}</>}
    </section>

    <section className="habit-form-section" aria-labelledby={`${id}-dates-heading`}>
      <h3 id={`${id}-dates-heading`}>Active dates</h3>
      <div className="habit-form-dates">
        <div><label htmlFor={`${id}-start`}>Start date<input {...fieldProps('start')} type="date" min={MIN_HABIT_DATE} required value={start} onChange={event => setStart(event.target.value)}/></label>{feedback('start')}</div>
        <div><label htmlFor={`${id}-end`}>End date (optional)<input {...fieldProps('end')} type="date" min={validHabitDate(start) ? start : MIN_HABIT_DATE} value={end} onChange={event => setEnd(event.target.value)}/></label>{feedback('end')}</div>
      </div>
      {initial && <><label htmlFor={`${id}-effective`}>Schedule and criteria effective from<input {...fieldProps('effective')} type="date" required min={validHabitDate(start) ? start : MIN_HABIT_DATE} max={end || undefined} value={effective} aria-describedby={`${id}-effective-help${errors.effective ? ` ${id}-effective-error` : ''}`} onChange={event => { void changeEffective(event.target.value) }}/></label>{feedback('effective')}<p id={`${id}-effective-help`} className="habit-form-help">Schedule and criteria changes apply from this date. Earlier dates keep their previous settings.</p></>}
    </section>

    <section className="habit-form-section" aria-labelledby={`${id}-details-heading`}>
      <h3 id={`${id}-details-heading`}>Optional details</h3>
      <label htmlFor={`${id}-icon`}>Icon (optional emoji)<input {...fieldProps('icon')} value={icon} maxLength={32} placeholder="✨" onChange={event => setIcon(event.target.value)}/></label>
      {feedback('icon')}
      <div className="habit-emoji-palette" role="group" aria-label="Choose an icon">{['✨', '🌱', '💧', '📚', '🏃', '🧘', '💪', '🎨', '🎵', '🌙', '☀️', '❤️'].map(emoji => <button key={emoji} type="button" aria-label={`Use ${emoji} as icon`} aria-pressed={icon === emoji} onClick={() => setIcon(emoji)}>{emoji}</button>)}<button type="button" onClick={() => setIcon('')}>Clear</button></div>
      <label>Description<textarea value={description} onChange={event => setDescription(event.target.value)}/></label>
      <DetailView title="Outcome criteria (optional)"><label>Done<textarea aria-label="Done" value={done} onChange={event => setDone(event.target.value)}/></label><label>Partial<textarea aria-label="Partial" value={partial} onChange={event => setPartial(event.target.value)}/></label><label>Missed<textarea aria-label="Missed" value={missed} onChange={event => setMissed(event.target.value)}/></label></DetailView>
    </section>
    <div className="habit-form-footer">
      {Object.keys(errors).length > 0 && <p role="alert" className="habit-form-feedback">Review the highlighted fields.</p>}
      {mutationError && <p role="alert" className="habit-form-feedback">{mutationError}</p>}
      <div className="habit-actions"><button type="submit" className="primary" disabled={pending}>Save habit</button><button type="button" className="outline-button" disabled={pending} onClick={() => { void cancel() }}><span aria-hidden="true">×</span> Cancel</button></div>
    </div>
  </form>
}
