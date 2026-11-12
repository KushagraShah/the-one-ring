import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { AvatarImage, avatars, type AvatarGroup } from './avatars'

type Category = 'All' | Exclude<AvatarGroup, 'Classic'>
const categories: Category[] = ['All', 'Fellowship', 'Allies', 'Dark']
const retired = new Set(['lotr-bilbo', 'lotr-eomer', 'lotr-denethor', 'lotr-witch-king', 'lotr-lurtz', 'lotr-elrond'])

export function AvatarPicker({ value, choose, back }: { value: string; choose: (id: string) => void; back: () => void }) {
  const [category, setCategory] = useState<Category>('All')
  const visible = avatars.filter(avatar => avatar.group !== 'Classic' && !retired.has(avatar.id) && (category === 'All' || avatar.group === category))
  return <section className="avatar-picker" aria-labelledby="avatar-picker-title">
    <button className="ring-back" type="button" onClick={back}><ArrowLeft size={18} aria-hidden="true"/> Settings</button>
    <header className="avatar-picker-heading"><p className="ring-kicker">YOUR ACCOUNT</p><h1 id="avatar-picker-title">Choose an avatar<span>.</span></h1><p>Select a character, then save your profile in Settings.</p></header>
    <div className="avatar-categories" role="group" aria-label="Avatar categories">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="character-grid">{visible.map(avatar => <button type="button" key={avatar.id} aria-label={avatar.label} aria-pressed={value === avatar.id} onClick={() => choose(avatar.id)}><span className="character-art"><AvatarImage id={avatar.id}/></span><span>{avatar.label}</span></button>)}</div>
  </section>
}
