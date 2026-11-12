import { useEffect, useRef, useState } from 'react'
import dragon from '../assets/brand/flying-dragon-openclipart.svg'

const ANIMATION_MS = 2400

function chooseLostRings() {
  const rings = Array.from({ length: 7 }, (_, index) => index)
  for (let index = rings.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[rings[index], rings[swap]] = [rings[swap], rings[index]]
  }
  return rings.slice(0, 4)
}

export function DwarfRings() {
  const [lost, setLost] = useState<number[]>([])
  const [chosen] = useState(chooseLostRings)
  const [flying, setFlying] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const consume = (index: number) => {
    if (flying !== null || lost.includes(index)) return
    if (!chosen.includes(index)) { setAnnouncement(`Ring ${index + 1} remains untouched.`); return }
    const finish = () => { setLost(previous => [...previous, index]); setFlying(null); setAnnouncement(`Ring ${index + 1} was consumed by a dragon.`); timer.current = null }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return }
    setFlying(index)
    setAnnouncement(`A dragon approaches ring ${index + 1}.`)
    timer.current = setTimeout(finish, ANIMATION_MS)
  }

  return <>
    <p className="dragon-instructions">Tap a ring to discover its fate. Four are chosen at random each time you visit.</p>
    <div className="dwarf-ring-set" role="group" aria-label="Seven Dwarf rings">
      {Array.from({ length: 7 }, (_, index) => <button type="button" key={index} className={`dwarf-ring-button ${flying === index ? 'dragon-scene' : ''}`} aria-label={`Dwarf ring ${index + 1}, ${lost.includes(index) ? 'consumed by a dragon' : flying === index ? 'dragon approaching' : 'tap to see its fate'}`} aria-disabled={lost.includes(index) || flying !== null} onClick={() => consume(index)}>
          <span className={`dwarf-ring ${lost.includes(index) ? 'dwarf-ring-lost' : ''}`} aria-hidden="true"/>
          {flying === index && <><span className="dragon-flame" aria-hidden="true"/><img src={dragon} className="dragon-flight" alt=""/></>}
        </button>)}
    </div>
    <p className="dragon-status" role="status">{announcement || 'The rings reset when you leave this screen.'}</p>
  </>
}
