import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Dumbbell, ListChecks } from 'lucide-react'
import mountains from '../assets/brand/mountains.svg'
import { DwarfRings } from './DwarfRings'

export function Home({ open }: { open: (view: 'workout' | 'habits') => void }) {
  const [showOtherRings, setShowOtherRings] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const changePage = (show: boolean) => {
    setShowOtherRings(show)
    requestAnimationFrame(() => { heading.current?.focus(); window.scrollTo(0, 0) })
  }
  if (showOtherRings) return <div className="ring-home other-rings-page">
    <button className="ring-back" onClick={() => changePage(false)}><ArrowLeft size={18} aria-hidden="true"/> Your apps</button>
    <header className="other-rings-header"><p className="ring-kicker">THE RINGS OF POWER</p><h1 ref={heading} tabIndex={-1}>The other rings<span>.</span></h1><p>Not yet in use. Their place in this space is still being imagined.</p></header>
    <section className="ring-collection dwarven-collection" aria-labelledby="dwarf-rings">
      <div className="collection-heading"><div><p className="ring-kicker">SEVEN RINGS</p><h2 id="dwarf-rings">For the Dwarves</h2></div><span className="collection-emblem" aria-hidden="true">◆</span></div>
      <p>Perhaps one day, these could represent services. For now, they are only an idea.</p>
      <DwarfRings/>
      <p className="ring-lore"><span aria-hidden="true">✧</span> In Tolkien’s story, four were consumed by dragons.</p>
    </section>
    <section className="ring-collection elven-collection" aria-labelledby="elf-rings">
      <div className="collection-heading"><div><p className="ring-kicker">THREE RINGS</p><h2 id="elf-rings">For the Elves</h2></div><span className="collection-emblem" aria-hidden="true">✦</span></div>
      <p>These might one day represent integrations. Nothing is connected yet.</p>
      <div className="elven-ring-set" role="img" aria-label="Three decorative Elven rings, inspired by Narya, Nenya and Nilya."><span className="elven-ring narya"/><span className="elven-ring nenya"/><span className="elven-ring nilya"/></div>
      <p className="ring-lore"><span aria-hidden="true">✧</span> Inspired by Narya, Nenya and Nilya.</p>
    </section>
  </div>
  return <div className="ring-home">
    <header className="ring-hero">
      <img src={mountains} alt="" className="ring-landscape" />
      <div className="ring-hero-copy"><p className="ring-kicker">THE ONE RING</p><h1 ref={heading} tabIndex={-1}>Your rings<span>.</span></h1><p>A little corner of Middle-earth, for your everyday life.</p></div>
    </header>
    <section aria-labelledby="your-apps" className="rings-of-men">
      <div className="ring-section-heading"><div><p className="ring-kicker">NINE RINGS OF MEN</p><h2 id="your-apps">Your apps</h2></div><span>2 OF 9 IN USE</span></div>
      <p className="ring-intro">Each ring holds an app. The rest await their purpose.</p>
      <div className="app-rings" aria-label="Nine app rings">
        <button className="app-ring app-ring-active ring-workouts" aria-label="Go to workouts" onClick={() => open('workout')}><span className="app-ring-art"><Dumbbell size={25} aria-hidden="true"/></span><strong>Workouts</strong></button>
        <button className="app-ring app-ring-active ring-habits" aria-label="Go to habits" onClick={() => open('habits')}><span className="app-ring-art"><ListChecks size={25} aria-hidden="true"/></span><strong>Habits</strong></button>
        {Array.from({ length: 7 }, (_, index) => <div className="app-ring app-ring-empty" role="img" key={index} aria-label={`App ring ${index + 3}, unassigned`}><span className="app-ring-art" aria-hidden="true"><span className="ring-star">✦</span></span><small aria-hidden="true">{String(index + 3).padStart(2, '0')}</small></div>)}
      </div>
    </section>
    <button className="other-rings-link" onClick={() => changePage(true)}><span className="other-rings-symbol" aria-hidden="true">✧</span><span><strong>The other rings</strong><small>Explore the seven and the three</small></span><ArrowRight size={20} aria-hidden="true"/></button>
  </div>
}
