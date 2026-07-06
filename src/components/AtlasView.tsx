import { useState } from 'react'
import { findClass, GRID_D, type LipidClass, type Persona } from '../lib/lipids'
import type { Cell, Pin } from '../App'
import Rail from './Rail'
import GapMap from './GapMap'
import Inspector from './Inspector'

const PERSONAS: { id: Persona; ic: string; short: string; label: string }[] = [
  { id: 'analyst', ic: '◎', short: 'Analyst', label: 'Mass-spec analyst' },
  { id: 'biophys', ic: '≋', short: 'Biophysics', label: 'Membrane biophysicist' },
  { id: 'chem', ic: '⚗', short: 'Chemist', label: 'Synthetic chemist' },
  { id: 'bioinfo', ic: '⌗', short: 'Bioinfo', label: 'Bioinformatician' },
]

interface Props {
  cls: LipidClass
  onSelectClass: (c: LipidClass) => void
  sel: Cell | null
  onSelect: (c: number, d: number) => void
  persona: Persona
  onPersona: (p: Persona) => void
  pins: Pin[]
  onTogglePin: (pin: Pin) => void
}

export default function AtlasView({ cls, onSelectClass, sel, onSelect, persona, onPersona, pins, onTogglePin }: Props) {
  const [query, setQuery] = useState('')

  function onSearch(value: string) {
    setQuery(value)
    const m = value.trim().toUpperCase().match(/([A-Z]{2,6})\s*(\d{1,2})\s*[:/]\s*(\d{1,2})/)
    if (!m) return
    const cl = findClass(m[1])
    if (!cl) return
    const c = +m[2]
    const d = +m[3]
    if (c < cl.cRange[0] || c > cl.cRange[1] || d > GRID_D) return
    if (cl.k !== cls.k) onSelectClass(cl)
    // defer selection to next tick so the class change lands first
    setTimeout(() => onSelect(c, d), 0)
  }

  return (
    <section className="view on">
      <div className="atlas">
        <Rail cls={cls} onSelectClass={onSelectClass} />
        <main className="stage">
          <div className="toolbar">
            <div className="search">
              <span className="mag">⌕</span>
              <input
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search e.g.  PC 34:1   ·   Cer 40:1   ·   TG 52:3"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <GapMap cls={cls} sel={sel} onSelect={onSelect} />
        </main>
        <aside className="inspector">
          <div className="insp-scroll">
            <div className="persona-bar">
              <span className="persona-bar-label">View as</span>
              <div className="persona-chips">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    className={'pchip' + (p.id === persona ? ' on' : '')}
                    onClick={() => onPersona(p.id)}
                    title={p.label}
                  >
                    <span className="ic">{p.ic}</span>
                    <span>{p.short}</span>
                  </button>
                ))}
              </div>
            </div>
            <Inspector cls={cls} sel={sel} persona={persona} pins={pins} onTogglePin={onTogglePin} />
          </div>
        </aside>
      </div>
    </section>
  )
}
