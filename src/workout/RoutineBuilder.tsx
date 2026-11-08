import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import type { Exercise } from './ExerciseLibrary'
import { rotationDays, type Rotation } from './rotations'
import { describeCycleDay, moveItem } from './routineDraft'
import { InfoTip } from '../InfoTip'

export type RoutineDay = { id?: string; name: string; subtitle: string; exercises: Exercise[] }
type DraftDay = RoutineDay & { originalName: string | null }
type Props = {
  days: RoutineDay[]; library: Exercise[]; rotations: Rotation[]
  routines: { id: string; name: string }[]; activeRoutine: string; hasSession: boolean
  onDirty: (dirty: boolean) => void
  onSave: (days: RoutineDay[], rotations: Rotation[], names: Record<string, string | null>, baseline: string) => boolean
  onLibrary: () => void; onNew: (name: string) => void; onSwitch: (id: string) => void; onCancelWorkout: () => void
}

export function RoutineBuilder({ days, library, rotations, routines, activeRoutine, hasSession, onDirty, onSave, onLibrary, onNew, onSwitch, onCancelWorkout }: Props) {
  const [baseline, setBaseline] = useState(() => JSON.stringify({ days, rotations }))
  const [draft, setDraft] = useState<DraftDay[]>(() => days.map(day => ({ ...day, originalName: day.name })))
  const [groups, setGroups] = useState(rotations)
  const [dirty, setDirty] = useState(false)
  const [openDay, setOpenDay] = useState<number | null>(0)
  const [selected, setSelected] = useState('')
  const [cycleSlot, setCycleSlot] = useState('')
  const [options, setOptions] = useState<string[]>([''])
  const [cycleName, setCycleName] = useState('')
  const [cycleDays, setCycleDays] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; action: () => void } | null>(null)
  const dayEffect = (day: DraftDay, group: Rotation | undefined, firstId?: string) => {
    const selectedDay = cycleDays.includes(day.name)
    const wasLinked = group && rotationDays(group).includes(day.name)
    const ids = [firstId, ...options].filter(Boolean)
    const match = day.exercises.find(exercise => ids.includes(exercise.id || library.find(item => item.name === exercise.name)?.id))
    return describeCycleDay(selectedDay, Boolean(wasLinked), match?.name)
  }
  const ask = (title: string, message: string, label: string, action: () => void) => setConfirm({ title, message, label, action })
  const mark = () => { setDirty(true); onDirty(true) }
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || cycleSlot) event.preventDefault() }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty, cycleSlot])
  const updateDay = (index: number, day: DraftDay) => { setDraft(draft.map((item, i) => i === index ? day : item)); mark() }
  const save = () => {
    if (draft.some(day => !day.name.trim()) || new Set(draft.map(day => day.name.trim().toLowerCase())).size !== draft.length) { setError('Each day needs a unique name.'); return }
    const names: Record<string, string | null> = Object.fromEntries(days.map(day => [day.name, draft.find(item => item.originalName === day.name)?.name || null]))
    const clean = draft.map(({ originalName: _original, ...day }) => ({ ...day, id: day.id || crypto.randomUUID(), exercises: day.exercises.map(exercise => ({ ...exercise, routineSlotId: exercise.routineSlotId || crypto.randomUUID() })) }))
    if (onSave(clean, groups, names, baseline)) { setBaseline(JSON.stringify({ days: clean, rotations: groups })); setDraft(clean.map(day => ({ ...day, originalName: day.name }))); setDirty(false); onDirty(false); setError('') }
  }
  const switchTo = (id: string) => {
    if (id === activeRoutine) return
    if (hasSession) { setError('Cancel or finish the active workout before switching routines.'); return }
    if (dirty || cycleSlot) { ask('Discard draft?', 'Your unsaved routine changes will be lost.', 'Discard and switch', () => { onDirty(false); onSwitch(id) }); return }
    onSwitch(id)
  }
  return <>
    <div className="builder-title"><div><h1>Build routine<span className="accent">.</span></h1><p>Edit a routine without changing today’s workout. <InfoTip label="About routines and exercise cycles">Routine edits are drafts until saved. Exercise cycles suggest the first remaining variant and can share progress across days. A cycle selection counts when the workout finishes; skips, ordinary replacements and extras do not.</InfoTip></p></div><button className="outline-button" onClick={onLibrary}>Exercise library</button></div>
    <div className="builder-toolbar"><label>Routine<select value={activeRoutine} onChange={event => switchTo(event.target.value)}>{routines.map(routine => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label><details className="new-routine"><summary>+ New routine</summary><div><input aria-label="New routine name" placeholder="Routine name" value={newName} onChange={event => setNewName(event.target.value)}/><button className="outline-button" disabled={!newName.trim() || hasSession} onClick={() => { const name = newName.trim(); if (!name) return; if (dirty || cycleSlot) { ask('Discard draft?', 'Your unsaved changes will be lost before creating the new routine.', 'Discard and create', () => { onDirty(false); onNew(name) }); return } onNew(name) }}>Create routine</button></div></details><button className="primary" disabled={!dirty || hasSession || Boolean(cycleSlot)} onClick={save}>Save changes</button><small>{cycleSlot ? 'Apply or close the cycle editor first' : dirty ? 'Unsaved changes' : 'Saved'}</small></div>
    {hasSession && <div className="builder-warning"><span>A workout is in progress. Cancel it to save or switch routines; your draft will remain here.</span><button className="outline-button" onClick={() => ask('Cancel workout?', 'This discards the in-progress workout and its entries. Your routine draft and previous history are kept.', 'Cancel workout', onCancelWorkout)}>Cancel workout</button></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="builder-list">{draft.map((day, index) => <section className="builder-day" key={index}>
      <button className="builder-day-toggle" aria-expanded={openDay === index} onClick={() => { const change = () => { setOpenDay(openDay === index ? null : index); setSelected(''); setCycleSlot(''); onDirty(dirty) }; if (cycleSlot) ask('Close cycle editor?', 'Unapplied cycle edits will be discarded.', 'Close editor', change); else change() }}><strong>{day.name || 'Unnamed day'}</strong><span>{day.exercises.length} exercises · {openDay === index ? 'Close' : 'Edit'}</span></button>
      {openDay === index && <div className="builder-day-content"><div className="builder-heading"><label>Day name<input value={day.name} onChange={event => { const name = event.target.value; const old = day.name; if (draft.some((item, i) => i !== index && item.name.toLowerCase() === name.toLowerCase())) { setError('Each day needs a unique name.'); return } setError(''); updateDay(index, { ...day, name }); setGroups(groups.map(group => ({ ...group, primaryDay: group.primaryDay === old ? name : group.primaryDay, complementDay: group.complementDay === old ? name : group.complementDay, days: group.days?.map(item => item === old ? name : item) }))) }}/></label><button className="text-button" disabled={draft.length === 1} onClick={() => ask('Remove day?', `${day.name} will be removed from this routine draft.`, 'Remove day', () => { setDraft(draft.filter((_, i) => i !== index)); setGroups(groups.map(group => ({ ...group, days: rotationDays(group).filter(item => item !== day.name) })).filter(group => group.days.length)); setOpenDay(null); mark() })}>Remove day</button></div>
        {day.exercises.map((exercise, exerciseIndex) => {
          const id = exercise.id || library.find(item => item.name === exercise.name)?.id
          const group = groups.find(item => rotationDays(item).includes(day.name) && id && item.options.includes(id))
          const key = `${index}/${exerciseIndex}`
          return <div className="builder-slot" key={key}><div className="builder-exercise"><div><strong>{group ? group.name : exercise.name}</strong><small>{group ? `Cycle · ${group.options.length} variants` : 'Exercise'}</small></div><div className="slot-actions"><button className="outline-button slot-move" aria-label={`Move ${group?.name || exercise.name} up`} disabled={exerciseIndex === 0 || Boolean(cycleSlot)} onClick={() => updateDay(index, { ...day, exercises: moveItem(day.exercises, exerciseIndex, -1) })}>↑</button><button className="outline-button slot-move" aria-label={`Move ${group?.name || exercise.name} down`} disabled={exerciseIndex === day.exercises.length - 1 || Boolean(cycleSlot)} onClick={() => updateDay(index, { ...day, exercises: moveItem(day.exercises, exerciseIndex, 1) })}>↓</button><button className="outline-button" disabled={Boolean(cycleSlot)} onClick={() => ask('Remove from day?', `${group?.name || exercise.name} will be removed from ${day.name} in this draft.`, 'Remove', () => { updateDay(index, { ...day, exercises: day.exercises.filter((_, i) => i !== exerciseIndex) }); if (group) setGroups(groups.map(item => item.id === group.id ? { ...item, days: rotationDays(item).filter(name => name !== day.name) } : item).filter(item => rotationDays(item).length)) })}>Remove</button></div></div>
            {group && <small>{group.options.map(option => library.find(item => item.id === option)?.name || 'Missing exercise').join(' · ')}</small>}
            <div className="slot-cycle-action"><button className="outline-button" onClick={() => { const open = () => { const closing = cycleSlot === key; setCycleSlot(closing ? '' : key); onDirty(closing ? dirty : true); setOptions(group ? group.options.slice(1) : ['']); setCycleName(group?.name || ''); setCycleDays(group ? rotationDays(group) : [day.name]); setError('') }; if (cycleSlot) ask('Close cycle editor?', 'Unapplied cycle edits will be discarded.', 'Close editor', open); else open() }}>{cycleSlot === key ? 'Close cycle editor' : group ? 'Edit cycle' : 'Make exercise cycle'}</button></div>
            {cycleSlot === key && <div className="cycle-editor"><label>Cycle name<input value={cycleName} onChange={event => setCycleName(event.target.value)} placeholder="e.g. Biceps"/></label><p>First: {library.find(item => item.id === (group?.options[0] || id))?.name || exercise.name}. Variants cycle in order; select days that share the cycle.</p>{options.map((option, optionIndex) => <label key={optionIndex}>Variant {optionIndex + 2}<select value={option} onChange={event => setOptions(options.map((item, i) => i === optionIndex ? event.target.value : item))}><option value="">Choose variant</option>{library.filter(item => item.id && item.id !== (group?.options[0] || id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{options.length > 1 && <button className="text-button" onClick={() => setOptions(options.filter((_, i) => i !== optionIndex))}>Remove variant</button>}</label>)}<button className="text-button" onClick={() => setOptions([...options, ''])}>Add variant</button><fieldset className="cycle-days"><legend>Use on days</legend><p>For each selected day, an existing variant becomes the cycle slot; otherwise a new slot is added.</p>{draft.map(item => <label key={item.name}><input type="checkbox" checked={cycleDays.includes(item.name)} disabled={item.name === day.name} onChange={event => setCycleDays(event.target.checked ? [...cycleDays, item.name] : cycleDays.filter(name => name !== item.name))}/><span><strong>{item.name}</strong><small>{dayEffect(item, group, group?.options[0] || id)}</small></span></label>)}</fieldset><button className="outline-button" onClick={() => {
              const first = group?.options[0] || id
              const all = first ? [first, ...options] : []
              if (!cycleName.trim() || !first || options.some(option => !option) || new Set(all).size !== all.length) { setError('Choose a cycle name and distinct variants.'); return }
              const matches = (item: Exercise) => all.includes(item.id || library.find(candidate => candidate.name === item.name)?.id || '')
              if (draft.filter(item => cycleDays.includes(item.name)).some(item => item.exercises.filter(matches).length > 1) || groups.some(existing => existing.id !== group?.id && rotationDays(existing).some(name => cycleDays.includes(name)) && existing.options.some(option => all.includes(option)))) { setError('Each day can contain only one slot for these variants.'); return }
              const oldOptions = group?.options || []; const firstExercise = library.find(item => item.id === first)
              if (!firstExercise) { setError('The first variant is missing from the library.'); return }
              setDraft(draft.map(item => {
                const hadSlot = group && rotationDays(group).includes(item.name)
                const oldMatch = (candidate: Exercise) => oldOptions.includes(candidate.id || library.find(found => found.name === candidate.name)?.id || '')
                const withoutOld = hadSlot ? item.exercises.filter(candidate => !oldMatch(candidate)) : item.exercises
                if (!cycleDays.includes(item.name)) return { ...item, exercises: withoutOld }
                if (hadSlot) return { ...item, exercises: item.exercises.map(candidate => oldMatch(candidate) ? { ...firstExercise, routineSlotId: candidate.routineSlotId } : candidate) }
                return withoutOld.some(matches) ? item : { ...item, exercises: [...withoutOld, { ...firstExercise, routineSlotId: crypto.randomUUID() }] }
              }))
              const remainingIds = group?.remainingIds ? [...group.remainingIds.filter(option => all.includes(option)), ...all.filter(option => !oldOptions.includes(option))] : undefined
              const nextGroup: Rotation = { ...group, id: group?.id || crypto.randomUUID(), name: cycleName.trim(), primaryDay: cycleDays[0], complementDay: cycleDays[1] || '', days: cycleDays, options: all, ...(remainingIds?.length ? { remainingIds } : { remainingIds: undefined }) }
              setGroups(group ? groups.map(item => item.id === group.id ? nextGroup : item) : [...groups, nextGroup]); setCycleSlot(''); setError(''); mark()
            }}>Apply cycle to draft</button></div>}
          </div>
        })}
        <details className="add-to-day"><summary>+ Add exercise or existing cycle</summary><label className="builder-select">Choose<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">Choose exercise or cycle</option><optgroup label="Exercises">{library.filter(exercise => !day.exercises.some(item => item.name === exercise.name)).map(exercise => <option key={exercise.name} value={`exercise:${exercise.name}`}>{exercise.name}</option>)}</optgroup><optgroup label="Existing cycles">{groups.filter(group => !rotationDays(group).includes(day.name)).map(group => <option key={group.id} value={`cycle:${group.id}`}>{group.name}</option>)}</optgroup></select></label><button className="outline-button" disabled={!selected} onClick={() => {
          if (selected.startsWith('exercise:')) { const exercise = library.find(item => item.name === selected.slice(9)); if (exercise) updateDay(index, { ...day, exercises: [...day.exercises, { ...exercise, routineSlotId: crypto.randomUUID() }] }) }
          else { const group = groups.find(item => item.id === selected.slice(6)); const exercise = library.find(item => item.id === group?.options[0]); if (!group || !exercise || day.exercises.some(item => group.options.includes(item.id || library.find(candidate => candidate.name === item.name)?.id || ''))) { setError('This day already contains a variant of the cycle or a variant is missing.'); return } updateDay(index, { ...day, exercises: [...day.exercises, { ...exercise, routineSlotId: crypto.randomUUID() }] }); setGroups(groups.map(item => item.id === group.id ? { ...item, days: [...rotationDays(item), day.name] } : item)) }
          setSelected(''); setError('')
        }}>Add to draft</button></details>
      </div>}
    </section>)}</div>
    <button className="outline-button" onClick={() => { let n = draft.length + 1; while (draft.some(day => day.name.toLowerCase() === `day ${n}`)) n++; setDraft([...draft, { name: `Day ${n}`, subtitle: '', exercises: [], originalName: null }]); setOpenDay(draft.length); mark() }}>Add day</button>
    {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.label} onCancel={() => setConfirm(null)} onConfirm={() => { const action = confirm.action; setConfirm(null); action() }}/>}
  </>
}
