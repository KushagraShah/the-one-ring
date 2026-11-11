import { DetailView } from '../DetailView'
import { ChoiceSelect } from '../ChoiceSelect'
import { confirmAction } from '../AppDialog'
import { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, List, Plus, X } from 'lucide-react'
import type { Exercise } from './ExerciseLibrary'
import type { Rotation } from './rotations'
import { addSessionExercise, adjacentExercise, exerciseComplete, recentPerformances, replaceSessionExercise, sessionAccountedFor, toggleSessionSkip } from './sessionLogic'
import { ResultTable } from './ResultTable'
import { ExerciseDetails } from './ExerciseDetails'
import { InfoTip } from '../InfoTip'
import { SetupText } from './SetupText'
import { Sheet } from './Sheet'
import { ExercisePicker } from './ExercisePicker'

export type SetEntry = { weight: string; reps: string; done: boolean }
export type CardioEntry = { duration: string; speed: string; incline: string; done: boolean }
export type PlannedExercise = { slotId: string; name: string; exerciseId?: string; equipment: string; cycleId?: string; cycleName?: string }
export type WorkoutExercise = { id?: string; name: string; exerciseId?: string; plannedName?: string; plannedId?: string; equipmentSnapshot?: string; correctedFrom?: { name: string; exerciseId?: string; equipment?: string }; sessionSlotId?: string; source?: Exercise['sessionSource']; sets: SetEntry[]; skipped: boolean; note?: string; cardio?: CardioEntry }
export type Workout = { id?: string; day: string; dayId?: string; date: string; exercises: WorkoutExercise[]; startedAt?: string; routineId?: string; routineName?: string; plan?: PlannedExercise[] }
export type Session = { id?: string; day: string; dayId?: string; exercises: Exercise[]; entries: Record<string, SetEntry[]>; skipped: string[]; warmups: string[]; notes?: Record<string, string>; cardio?: Record<string, CardioEntry>; startedAt?: string; routineId?: string; routineName?: string; plan?: PlannedExercise[] }

const blankCardio = (): CardioEntry => ({ duration: '', speed: '', incline: '', done: false })
export const isCardio = (exercise: Exercise) => exercise.kind === 'cardio' || (!exercise.kind && /treadmill/i.test(exercise.name))
export function previousFor(workouts: Workout[], target: Exercise): WorkoutExercise | undefined {
  return recentPerformances(workouts, target, 1)[0]?.exercise
}
export function startingSets(exercise: Exercise, workouts: Workout[]): SetEntry[] {
  const previous = previousFor(workouts, exercise)
  if (previous?.sets.length === 3) return previous.sets.map(set => ({ ...set, done: false }))
  return Array.from({ length: 3 }, () => ({ weight: '', reps: '', done: false }))
}

type Props = {
  session: Session
  workouts: Workout[]
  library: Exercise[]
  rotations: Rotation[]
  onChange: (session: Session) => void
  onFinish: () => void
  onBack: () => void
  onCancel: () => void
  onDirty: (dirty: boolean) => void
  onSetup: (exercise: Exercise, note: string) => void
}

export function WorkoutSession({ session, workouts, library, rotations, onChange, onFinish, onBack, onCancel, onDirty, onSetup }: Props) {
  const [expanded, setExpanded] = useState<string | null>(() => session.exercises.find(exercise => !session.skipped.includes(exercise.name) && !exerciseComplete(session, exercise))?.name || session.exercises[0]?.name || null)
  const [drafts, setDrafts] = useState<Record<string, SetEntry[]>>({})
  const [cardioDrafts, setCardioDrafts] = useState<Record<string, CardioEntry>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [completedDetails, setCompletedDetails] = useState<Record<string, boolean>>({})
  const [picker, setPicker] = useState<'add' | 'replace' | null>(null)
  const [error, setError] = useState('')
  const [setupEdit, setSetupEdit] = useState<string | null>(null)
  const [setupDraft, setSetupDraft] = useState('')
  const [overviewOpen, setOverviewOpen] = useState(false)
  useEffect(() => { onDirty(Boolean(Object.keys(drafts).length || Object.keys(cardioDrafts).length || Object.keys(noteDrafts).length || setupEdit)); return () => onDirty(false) }, [drafts, cardioDrafts, noteDrafts, setupEdit, onDirty])
  const navigate = async (offset: number) => {
    if (setupEdit && !await confirmAction('Discard unsaved setup changes?')) return
    const next = expanded && adjacentExercise(session, expanded, offset)
    if (next) setExpanded(next)
    setSetupEdit(null); setError('')
  }
  const updateSet = (name: string, index: number, field: 'weight' | 'reps', value: string) => {
    const stored = drafts[name] || session.entries[name] || []
    const entries = Array.from({ length: Math.max(3, stored.length) }, (_, i) => ({ ...(stored[i] || { weight: '', reps: '', done: false }), done: false }))
    entries[index] = { ...entries[index], [field]: value }
    setDrafts(current => ({ ...current, [name]: entries }))
  }
  const updateWeight = (name: string, value: string) => {
    const stored = drafts[name] || session.entries[name] || []
    setDrafts(current => ({ ...current, [name]: Array.from({ length: Math.max(3, stored.length) }, (_, i) => ({ ...(stored[i] || { reps: '', done: false }), weight: value, done: false })) }))
  }
  const updateCardio = (name: string, patch: Partial<CardioEntry>) => setCardioDrafts(current => ({ ...current, [name]: { ...(current[name] || session.cardio?.[name] || blankCardio()), ...patch } }))
  const commit = (next: Session) => {
    onChange(next); return true
  }
  const add = async (id: string) => {
    const exercise = library.find(item => item.id === id)
    if (!exercise) return
    if (setupEdit && !await confirmAction('Discard unsaved setup changes and add this exercise?')) return
    if (session.exercises.some(item => item.name === exercise.name)) { setError('This exercise is already in the workout.'); return }
    const previousCardio = previousFor(workouts, exercise)?.cardio
    onChange(addSessionExercise(session, exercise, startingSets(exercise, workouts), previousCardio ? { ...previousCardio, done: false } : blankCardio()))
    setExpanded(exercise.name); setPicker(null); setSetupEdit(null); setError('')
  }
  const swap = async (exercise: Exercise, replacement: Exercise | undefined, cycle?: Rotation) => {
    if (!replacement) return
    const name = replacement.name
    if (session.exercises.some(item => item.name === name)) { setError('This exercise is already in the workout.'); return }
    const entries = session.entries[exercise.name] || []
    if ((entries.some(set => set.done) || session.cardio?.[exercise.name]?.done || drafts[exercise.name] || cardioDrafts[exercise.name] || noteDrafts[exercise.name] !== undefined || session.notes?.[exercise.name] || setupEdit) && !await confirmAction('Replacing this exercise removes its result, notes and any unsaved setup edits from today’s workout. Continue?')) return
    const previousCardio = previousFor(workouts, replacement)?.cardio
    setDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
    setCardioDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
    setNoteDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
    onChange(replaceSessionExercise(session, exercise, replacement, startingSets(replacement, workouts), previousCardio ? { ...previousCardio, done: false } : blankCardio(), cycle))
    setExpanded(name); setSetupEdit(null); setError('')
  }
  return <>
    <div className="session-top"><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Leave</button><strong>{session.day} · In progress</strong><InfoTip label="About changes during a workout">Setup edits update your exercise library. Results and notes belong to this workout; replacements and extras do not change your routine. Cycle progress is recorded when you finish.</InfoTip><button className="outline-button" onClick={onFinish}>{sessionAccountedFor(session) ? 'Finish' : 'Finish early'}</button><button className="outline-button danger-action" onClick={onCancel}><X size={16} aria-hidden="true"/> Cancel workout</button></div>
    <div className="session-layout"><section>
      {session.exercises.length > 0 && <div className="session-strip"><div className="session-strip-items" aria-label="Exercises in this workout">{session.exercises.map((item, index) => { const skipped = session.skipped.includes(item.name); const completed = exerciseComplete(session, item); return <button key={item.sessionItemId || item.name} className={`session-chip ${expanded === item.name ? 'current' : ''} ${completed ? 'done' : skipped ? 'skipped' : ''}`} aria-label={`${index + 1}. ${item.name}, ${completed ? 'completed' : skipped ? 'skipped' : 'not completed'}`} aria-current={expanded === item.name ? 'step' : undefined} onClick={async () => { if (setupEdit && !await confirmAction('Discard unsaved setup changes?')) return; setSetupEdit(null); setExpanded(item.name); setError('') }}>{completed ? '✓' : skipped ? '–' : index + 1}</button> })}</div><button className="session-list-button" aria-label="Workout overview" onClick={() => setOverviewOpen(true)}><List size={18}/></button></div>}
      {overviewOpen && <Sheet title="Workout overview" onClose={() => setOverviewOpen(false)}>{session.exercises.map((item, index) => { const skipped = session.skipped.includes(item.name); const completed = exerciseComplete(session, item); return <button className="sheet-row" key={item.sessionItemId || item.name} onClick={async () => { if (setupEdit && !await confirmAction('Discard unsaved setup changes?')) return; setSetupEdit(null); setExpanded(item.name); setOverviewOpen(false) }}><span>{index + 1}. {item.name}</span><small>{completed ? '✓ Completed' : skipped ? '– Skipped' : 'To do'}</small></button> })}</Sheet>}
      {session.exercises.length === 0 && <p>Add an exercise to start this workout.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="exercise-list">{session.exercises.map((exercise, index) => {
        if (exercise.name !== expanded) return null
        const stored = drafts[exercise.name] || session.entries[exercise.name] || []
        const entries = Array.from({ length: Math.max(3, stored.length) }, (_, i) => stored[i] || { weight: '', reps: '', done: false })
        const cardio = cardioDrafts[exercise.name] || session.cardio?.[exercise.name] || blankCardio()
        const cardioType = isCardio(exercise)
        const completed = exerciseComplete(session, exercise)
        const skipped = session.skipped.includes(exercise.name)
        const previous = recentPerformances(workouts, exercise, 3)
        const cycle = rotations.find(group => group.id === exercise.rotationGroupId && exercise.id && group.options.includes(exercise.id))
        const open = expanded === exercise.name
        return <div className={`exercise-card ${open ? 'open' : ''} ${completed ? 'exercise-done' : skipped ? 'exercise-skipped' : ''}`} key={`${exercise.name}-${index}`}>
          <div className="exercise-header sticky-exercise"><button className="exercise-nav-arrow" aria-label="Previous exercise" disabled={session.exercises.length < 2} onClick={() => navigate(-1)}><ChevronLeft size={20}/></button><span className="exercise-name"><strong>{exercise.name}</strong><small>{skipped ? '– Skipped' : completed ? '✓ Completed' : exercise.equipment || 'To do'} · {index + 1} of {session.exercises.length}</small></span><button className="exercise-nav-arrow" aria-label="Next exercise" disabled={session.exercises.length < 2} onClick={() => navigate(1)}><ChevronRight size={20}/></button></div>
          {open && <div className="exercise-body">{skipped ? <div className="skipped-summary"><span>– Skipped for this workout</span><button className="outline-button" onClick={() => { const change = toggleSessionSkip(session, exercise, entries, cardio); commit(change.session) }}>Undo skip</button></div> : completed && editing !== exercise.name && !completedDetails[exercise.name] ? <div className="completed-summary"><div><strong>✓ Log saved</strong><small>Today · In progress</small><ResultTable sets={session.entries[exercise.name] || []} cardio={cardioType ? session.cardio?.[exercise.name] : undefined}/>{session.notes?.[exercise.name] && <p>{session.notes[exercise.name]}</p>}</div><div className="completed-actions"><button className="outline-button" onClick={() => setEditing(exercise.name)}>Edit log</button><button className="text-button" onClick={() => setCompletedDetails(current => ({ ...current, [exercise.name]: true }))}>Setup &amp; history</button></div></div> : <>
            {cycle && <div className="cycle-choice"><label>Exercise cycle · {cycle.name}<ChoiceSelect label={`Exercise cycle · ${cycle.name}`} value={exercise.id} onChange={value => swap(exercise, library.find(item => item.id === value), cycle)}>{cycle.options.map(id => { const variant = library.find(item => item.id === id); return <option key={id} value={id} disabled={!variant || (id !== exercise.id && session.exercises.some(item => item.name === variant.name))}>{variant?.name || 'Unavailable variant'}</option> })}</ChoiceSelect></label><p>Choose a cycle variant for today. Completing it counts toward this cycle when the workout is saved.</p></div>}
            <button className="text-button replace-exercise" onClick={() => setPicker('replace')}>Replace for this workout</button>
            {picker === 'replace' && <ExercisePicker exercises={library.filter(item => item.name !== exercise.name)} onClose={() => setPicker(null)} onChoose={async id => { await swap(exercise, library.find(item => item.id === id)); setPicker(null) }}/>}
            <div className="setup-note setup-panel"><div className="setup-heading"><strong>📌 Setup</strong>{setupEdit !== exercise.name && <button className="text-button" onClick={() => { setSetupDraft(exercise.note || ''); setSetupEdit(exercise.name) }}>Edit setup</button>}</div>{setupEdit === exercise.name ? <><label className="session-note">Machine setup<textarea rows={5} value={setupDraft} onChange={event => setSetupDraft(event.target.value)} placeholder={'- Seat height\n- Grip and precautions'}/></label><div className="setup-actions"><button className="outline-button" onClick={() => { onSetup(exercise, setupDraft); setSetupEdit(null) }}>Save setup</button><button className="text-button" onClick={() => setSetupEdit(null)}><X size={15} aria-hidden="true"/> Cancel</button></div></> : exercise.note ? <SetupText text={exercise.note}/> : <p className="setup-text">No setup notes yet.</p>}</div>
            {exercise.instructions && <p className="exercise-instructions">{exercise.instructions}</p>}
            {exercise.video && <a className="exercise-video" href={exercise.video} target="_blank" rel="noreferrer">Watch reference video ↗</a>}
            <ExerciseDetails key={exercise.id || exercise.name} exercise={exercise} workouts={workouts}/>
            <div className="previous"><strong>Recent results</strong>{completed && <div className="recent-result"><time>Today · In progress</time><div><ResultTable sets={session.entries[exercise.name] || []} cardio={cardioType ? session.cardio?.[exercise.name] : undefined}/>{session.notes?.[exercise.name] && <small>{session.notes[exercise.name]}</small>}</div></div>}{previous.length ? previous.map(({ date, exercise: result }, i) => <div className="recent-result" key={`${date}-${i}`}><time>{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time><div><ResultTable sets={result.sets} cardio={result.cardio}/>{result.note && <small>{result.note}</small>}</div></div>) : !completed && <p>No previous record</p>}</div>
            {completed && editing !== exercise.name ? <div className="result-locked"><strong>✓ Log saved</strong><ResultTable sets={session.entries[exercise.name] || []} cardio={cardioType ? cardio : undefined}/>{session.notes?.[exercise.name] && <p>{session.notes[exercise.name]}</p>}<button className="outline-button" onClick={() => setEditing(exercise.name)}>Edit log</button><button className="text-button" onClick={() => setCompletedDetails(current => ({ ...current, [exercise.name]: false }))}>Hide details</button></div> : <>
            {cardioType ? <div className="cardio-fields">{([['duration', 'Duration (min)'], ['speed', 'Speed (km/h)'], ['incline', 'Incline (degrees)']] as const).map(([field, label]) => <label key={field}>{label}<input type="number" min="0" step="any" value={cardio[field]} onChange={event => updateCardio(exercise.name, { [field]: event.target.value, done: false })}/></label>)}</div> : <>
              <div className="weight-stepper"><span>Weight (kg)</span><button aria-label="Decrease weight by 2.5 kilograms" onClick={() => updateWeight(exercise.name, String(Math.max(0, (Number(entries[0].weight) || 0) - 2.5)))}>−</button><input aria-label="Weight in kilograms" type="number" min="0" step="any" value={entries[0].weight} onChange={event => updateWeight(exercise.name, event.target.value)}/><button aria-label="Increase weight by 2.5 kilograms" onClick={() => updateWeight(exercise.name, String((Number(entries[0].weight) || 0) + 2.5))}>+</button></div>
              {entries.some(set => set.weight !== entries[0].weight) && <p className="entry-hint">Different set weights are recorded below. Changing the shared weight replaces them.</p>}
              <div className="rep-patterns"><span>Reps</span>{[[12,10,8],[15,12,10],[15,15,15],[10,10,8]].map(pattern => <button className="outline-button" key={pattern.join('/')} onClick={() => setDrafts(current => ({ ...current, [exercise.name]: entries.map((entry, i) => ({ ...entry, reps: String(pattern[i] ?? ''), done: false })) }))}>{pattern.join(' / ')}</button>)}</div>
              <DetailView className="custom-sets" title="Custom reps or different set weights">{entries.map((entry, i) => <div className="set-row three-columns" key={i}><span>Set {i + 1}</span><input aria-label={`Set ${i + 1} weight in kilograms`} type="number" min="0" step="any" value={entry.weight} onChange={event => updateSet(exercise.name, i, 'weight', event.target.value)}/><input aria-label={`Set ${i + 1} reps`} type="number" min="0" step="1" value={entry.reps} onChange={event => updateSet(exercise.name, i, 'reps', event.target.value)}/></div>)}</DetailView>
              <p className="rep-summary">{entries.slice(0, 3).map(set => set.reps || '–').join(' / ')}</p>
            </>}
            {entries.length > 3 && !cardioType && <button className="text-button" onClick={async () => { if (await confirmAction('Discard extra sets from this older in-progress workout?')) setDrafts(current => ({ ...current, [exercise.name]: entries.slice(0, 3).map(set => ({ ...set, done: false })) })) }}>Remove extra sets from older workout</button>}
            <label className="session-note">Note <span>Optional</span><textarea placeholder="How did it feel?" value={noteDrafts[exercise.name] ?? session.notes?.[exercise.name] ?? ''} onChange={event => setNoteDrafts(current => ({ ...current, [exercise.name]: event.target.value }))}/></label>
            <button className="primary confirm-result" aria-label="Save exercise log" onClick={() => {
              if (cardioType) {
                if (!cardio.duration || !Number.isFinite(Number(cardio.duration)) || Number(cardio.duration) < 0 || [cardio.speed, cardio.incline].some(value => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0))) { setError('Enter a valid duration and nonnegative cardio values.'); return }
                if (!commit({ ...session, skipped: session.skipped.filter(item => item !== exercise.name), notes: { ...session.notes, [exercise.name]: noteDrafts[exercise.name] ?? session.notes?.[exercise.name] ?? '' }, cardio: { ...session.cardio, [exercise.name]: { ...cardio, done: true } } })) return
                setCardioDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
              } else {
                if (entries.length !== 3 || entries.some(set => set.reps === '' || !Number.isInteger(Number(set.reps)) || Number(set.reps) < 0 || (set.weight !== '' && (!Number.isFinite(Number(set.weight)) || Number(set.weight) < 0)))) { setError('Enter reps for all three sets. Weight can be left blank for bodyweight.'); return }
                if (!commit({ ...session, skipped: session.skipped.filter(item => item !== exercise.name), notes: { ...session.notes, [exercise.name]: noteDrafts[exercise.name] ?? session.notes?.[exercise.name] ?? '' }, entries: { ...session.entries, [exercise.name]: entries.map(set => ({ ...set, done: true })) } })) return
                setDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next })
              }
              setNoteDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next }); setEditing(null); setError('')
            }}><Check size={18}/> Save log</button>{editing === exercise.name && <button className="text-button" onClick={() => { setDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next }); setCardioDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next }); setNoteDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next }); setEditing(null) }}><X size={15} aria-hidden="true"/> Cancel edit</button>}</>}
            <div className="exercise-navigation"><button className="outline-button" onClick={async () => { if (completed && !await confirmAction('Skip this exercise and remove its saved result and note?')) return; if (!skipped && (setupEdit || drafts[exercise.name] || cardioDrafts[exercise.name] || noteDrafts[exercise.name] !== undefined) && !await confirmAction('Discard unconfirmed edits and skip this exercise?')) return; const change = toggleSessionSkip(session, exercise, entries, cardio); if (completed) { const notes = { ...change.session.notes }; delete notes[exercise.name]; change.session.notes = notes } if (commit(change.session)) { setDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next }); setCardioDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next }); setNoteDrafts(current => { const next = { ...current }; delete next[exercise.name]; return next }); setEditing(null); if (change.next) { setSetupEdit(null); setExpanded(change.next); setError('') } } }}>{skipped ? 'Undo skip' : 'Skip exercise'}</button></div>
          </>}</div>}
        </div>
      })}</div>
      <button className="outline-button add-workout-button" onClick={() => setPicker('add')}><Plus size={16}/> Add exercise</button>
      {picker === 'add' && <ExercisePicker exercises={library.filter(item => !session.exercises.some(existing => existing.name === item.name))} onClose={() => setPicker(null)} onChoose={add}/>}
    </section></div>
  </>
}
