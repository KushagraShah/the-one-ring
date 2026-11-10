import { confirmAction } from '../AppDialog'
import { useState } from 'react'
import type { Exercise } from './ExerciseLibrary'
import type { Rotation } from './rotations'

type Day = { name: string; exercises: Exercise[] }
type Props = { days: Day[]; library: Exercise[]; rotations: Rotation[]; onChange: (rotations: Rotation[]) => void }

export function RotationManager({ days, library, rotations, onChange }: Props) {
  const [name, setName] = useState('')
  const [primaryDay, setPrimaryDay] = useState('')
  const [complementDay, setComplementDay] = useState('')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [extra, setExtra] = useState<string[]>([])
  const [error, setError] = useState('')
  const add = (event: React.FormEvent) => {
    event.preventDefault()
    const options = [first, second, ...extra]
    const matchesDay = (dayName: string) => days.find(day => day.name === dayName)?.exercises.filter(exercise => {
      const id = exercise.id || library.find(item => item.name === exercise.name)?.id
      return id && options.includes(id)
    }).length === 1
    if (!name.trim() || !primaryDay || !complementDay || primaryDay === complementDay || options.some(id => !id) || new Set(options).size !== options.length) { setError('Choose two different days and at least two different exercise variants.'); return }
    if (!matchesDay(primaryDay) || !matchesDay(complementDay)) { setError('Add exactly one of the variants to each day first, so the rotation knows which exercise to replace.'); return }
    if (rotations.some(group => (group.primaryDay === primaryDay || group.complementDay === primaryDay || group.primaryDay === complementDay || group.complementDay === complementDay) && group.options.some(id => options.includes(id)))) { setError('A selected day and exercise already belongs to another rotation.'); return }
    onChange([...rotations, { id: crypto.randomUUID(), name: name.trim(), primaryDay, complementDay, options }]); setName(''); setExtra([]); setError('')
  }
  return <section className="rotation-panel"><div className="section-head compact"><div><div className="eyebrow muted">OPTIONAL</div><h2>Exercise rotations</h2><p>Rotate variants independently. The other day suggests the next variant.</p></div></div>
    {rotations.map(rotation => <div className="rotation-item" key={rotation.id}><div><strong>{rotation.name}</strong><small>{rotation.primaryDay} ↔ {rotation.complementDay} · {rotation.options.map(id => library.find(item => item.id === id)?.name || 'Missing exercise').join(' / ')}</small></div><button className="text-button" onClick={async () => { if (await confirmAction(`Remove the ${rotation.name} rotation? Routine exercises will remain.`)) onChange(rotations.filter(item => item.id !== rotation.id)) }}>Remove</button></div>)}
    <details><summary>Add a rotation</summary><form onSubmit={add} className="rotation-form"><label>Rotation name<input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Triceps"/></label><label>Primary day<select value={primaryDay} onChange={event => setPrimaryDay(event.target.value)}><option value="">Choose day</option>{days.map(day => <option key={day.name}>{day.name}</option>)}</select></label><label>Other day<select value={complementDay} onChange={event => setComplementDay(event.target.value)}><option value="">Choose day</option>{days.map(day => <option key={day.name}>{day.name}</option>)}</select></label>{([[first, setFirst, 'First exercise'], [second, setSecond, 'Other exercise']] as const).map(([value, setter, label]) => <label key={label}>{label}<select value={value} onChange={event => setter(event.target.value)}><option value="">Choose exercise</option>{library.filter(item => item.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}{extra.map((value, index) => <label key={index}>Additional exercise {index + 1}<select value={value} onChange={event => setExtra(extra.map((item, i) => i === index ? event.target.value : item))}><option value="">Choose exercise</option>{library.filter(item => item.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" className="text-button" onClick={() => setExtra(extra.filter((_, i) => i !== index))}>Remove option</button></label>)}<button type="button" className="text-button" onClick={() => setExtra([...extra, ''])}>Add another variant</button>{error && <p role="alert" className="form-error">{error}</p>}<button className="outline-button">Save rotation</button></form></details>
  </section>
}
