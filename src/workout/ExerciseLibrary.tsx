import { ChoiceSelect } from '../ChoiceSelect'
import { confirmAction } from '../AppDialog'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Workout } from './WorkoutSession'
import { ExerciseDetails } from './ExerciseDetails'
import { Sheet } from './Sheet'
import { SetupText } from './SetupText'

export type Exercise = { id?: string; name: string; equipment: string; sets: string; kind?: 'strength' | 'cardio'; note?: string; instructions?: string; video?: string; tags?: string[]; archived?: boolean; alternatives?: string[]; rotationGroupId?: string; rotationMode?: 'primary' | 'complement'; plannedName?: string; plannedId?: string; routineSlotId?: string; sessionSlotId?: string; sessionItemId?: string; sessionSource?: 'planned' | 'cycle' | 'substitution' | 'extra' }

type Props = {
  exercises: Exercise[]
  workouts: Workout[]
  onSave: (exercises: Exercise[]) => void
  onDirty: (dirty: boolean) => void
}

const empty: Exercise = { name: '', equipment: '', sets: '', note: '', instructions: '', video: '' }
const tagColor = (tag: string) => [...tag.toLowerCase()].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5

export function ExerciseLibrary({ exercises, workouts, onSave, onDirty }: Props) {
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [originalName, setOriginalName] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [tagText, setTagText] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const selectedExercise = exercises.find(item => (item.id || item.name) === selected)
  useEffect(() => { onDirty(Boolean(editing)); return () => onDirty(false) }, [editing, onDirty])
  const tags = [...new Set(exercises.flatMap(exercise => exercise.tags || []))].sort((a, b) => a.localeCompare(b))
  const visible = exercises.filter(exercise => (showArchived || !exercise.archived) && (!tagFilter || exercise.tags?.includes(tagFilter)) && [exercise.name, exercise.equipment, ...(exercise.tags || [])].some(value => value.toLowerCase().includes(search.trim().toLowerCase())))
  const closeEditor = async () => { if (await confirmAction('Discard exercise edits?')) setEditing(null) }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    if (!event.currentTarget.checkValidity()) { setError('Enter a name and a valid reference URL.'); return }
    const name = editing.name.trim()
    if (!name) { setError('Enter an exercise name.'); return }
    if (exercises.some(e => e.name.toLowerCase() === name.toLowerCase() && e.name !== originalName)) { setError('Use a unique name for each equipment-specific variant.'); return }
    if (editing.video) {
      try { const url = new URL(editing.video); if (!['http:', 'https:'].includes(url.protocol)) throw new Error() } catch { setError('Enter a complete http or https video URL.'); return }
    }
    const parsedTags = [...new Map(tagText.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => [tag.toLowerCase(), tag])).values()]
    const saved = { ...editing, name, tags: parsedTags }
    onSave(originalName ? exercises.map(e => e.name === originalName ? saved : e) : [...exercises, { ...saved, id: crypto.randomUUID() }])
    setEditing(null); setError('')
  }
  return <>
    <div className="library-heading"><h1>Exercise library<span className="accent">.</span></h1><button className="primary" onClick={() => { setOriginalName(null); setEditing({ ...empty }); setTagText(''); setError('') }}><Plus size={16}/> New exercise</button></div>
    {editing && <Sheet title={originalName ? 'Edit exercise' : 'New exercise'} onClose={closeEditor}><form noValidate className="library-form" onSubmit={submit}>
      <h2>{originalName ? 'Edit exercise' : 'New exercise'}</h2>
      <p>Give similar machines distinct names so their records stay separate.</p>
      <label>Exercise / variant name<input required maxLength={100} placeholder="e.g. HammerStrength chest press" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label>
      <label>Machine or equipment<input placeholder="e.g. HammerStrength chest press machine" value={editing.equipment} onChange={e => setEditing({ ...editing, equipment: e.target.value })}/></label>
      <label>Tags <span>Optional, separated by commas. For browsing your library.</span><input placeholder="e.g. Chest, Machine, Anchor" value={tagText} onChange={e => setTagText(e.target.value)}/></label>
      <label>Tracking type<ChoiceSelect label="Tracking type" value={editing.kind || (/treadmill/i.test(editing.name) ? 'cardio' : 'strength')} onChange={value => setEditing({ ...editing, kind: value as 'strength' | 'cardio' })}><option value="strength">Strength: weight and reps</option><option value="cardio">Cardio: duration, speed and incline</option></ChoiceSelect></label>
      <label>My setup<textarea placeholder="e.g. Seat 4, side grip" value={editing.note || ''} onChange={e => setEditing({ ...editing, note: e.target.value })}/></label>
      <label>Instructions<textarea placeholder="Quick reminders for this exercise" value={editing.instructions || ''} onChange={e => setEditing({ ...editing, instructions: e.target.value })}/></label>
      <label>Video link <span>(optional)</span><input type="url" placeholder="https://…" value={editing.video || ''} onChange={e => setEditing({ ...editing, video: e.target.value })}/></label>
      {originalName && <p>Changing the name updates future routine workouts. Past workouts keep their original name.</p>}
      {error && <p role="alert" className="auth-message">{error}</p>}
      <div className="library-actions"><button className="primary">Save exercise</button><button className="outline-button" type="button" onClick={closeEditor}><span aria-hidden="true">×</span> Cancel</button></div>
    </form></Sheet>}
    <div className="library-filters"><label>Search<input type="search" placeholder="Exercise, equipment or tag" value={search} onChange={event => setSearch(event.target.value)}/></label><label>Tag<ChoiceSelect label="Tag" value={tagFilter} onChange={value => setTagFilter(value)}><option value="">All tags</option>{tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</ChoiceSelect></label><label className="library-archive-filter"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)}/> Show archived</label></div>
    <p className="library-count">{visible.length} {visible.length === 1 ? 'exercise' : 'exercises'} · Archiving hides an exercise here without changing routines or history.</p>
    <div className="library-list">{visible.length === 0 && <p>No exercises match. Try another search or tag.</p>}{visible.map(exercise => <button className="library-row" key={exercise.id || exercise.name} onClick={() => setSelected(exercise.id || exercise.name)}><span className="library-emoji" aria-hidden="true">{exercise.kind === 'cardio' || /treadmill/i.test(exercise.name) ? '🏃' : exercise.tags?.some(tag => /chest/i.test(tag)) ? '🖐️' : exercise.tags?.some(tag => /leg|quad|hamstring|calves/i.test(tag)) ? '🦵' : exercise.tags?.some(tag => /bicep|tricep/i.test(tag)) ? '💪' : '🏋️'}</span><span><strong>{exercise.name}{exercise.archived ? ' · Archived' : ''}</strong><small>{exercise.equipment || 'No equipment specified'} {exercise.tags?.[0] && <span className={`category-chip category-${tagColor(exercise.tags[0])}`}>{exercise.tags[0]}</span>}</small></span><span aria-hidden="true">›</span></button>)}</div>
    {selectedExercise && !editing && <Sheet title={selectedExercise.name} onClose={() => setSelected(null)}><div className="library-detail"><p>{selectedExercise.equipment || 'No equipment specified'}</p><div className="library-tags">{selectedExercise.tags?.map(tag => <span key={tag}>{tag}</span>)}</div><h3>Setup</h3>{selectedExercise.note ? <SetupText text={selectedExercise.note}/> : <p>No setup notes yet.</p>}{selectedExercise.instructions && <p>{selectedExercise.instructions}</p>}{selectedExercise.video && <a href={selectedExercise.video} target="_blank" rel="noreferrer">Watch reference ↗</a>}<ExerciseDetails exercise={selectedExercise} workouts={workouts}/><div className="library-actions"><button className="outline-button" onClick={() => { setOriginalName(selectedExercise.name); setEditing({ ...selectedExercise }); setTagText((selectedExercise.tags || []).join(',')); setError('') }}>Edit exercise</button><button className="outline-button" onClick={() => onSave(exercises.map(item => item === selectedExercise ? { ...item, archived: !item.archived } : item))}>{selectedExercise.archived ? 'Unarchive' : 'Archive'}</button></div></div></Sheet>}
  </>
}
