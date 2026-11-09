import { useState } from 'react'
import type { Exercise } from './ExerciseLibrary'
import { Sheet } from './Sheet'

export function ExercisePicker({ exercises, onChoose, onClose }: { exercises: Exercise[]; onChoose: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const matches = exercises.filter(item => item.id && [item.name, item.equipment, ...(item.tags || [])].some(value => value.toLowerCase().includes(query.toLowerCase().trim()))).sort((a, b) => a.name.localeCompare(b.name))
  return <Sheet title="Choose an exercise" onClose={onClose}><label className="picker-search">Search<input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Exercise, equipment or tag"/></label><div className="picker-list">{matches.map(item => <button className="sheet-row" key={item.id} onClick={() => onChoose(item.id!)}><span>{item.name}<small>{item.equipment || 'No equipment specified'}{item.archived ? ' · Archived' : ''}</small></span><span aria-hidden="true">›</span></button>)}{!matches.length && <p>No exercises match.</p>}</div></Sheet>
}
