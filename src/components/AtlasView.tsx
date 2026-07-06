import { useState } from 'react'
import { findClass, GRID_D, type LipidClass, type Persona } from '../lib/lipids'
import type { Cell } from '../App'
import Rail from './Rail'
import GapMap from './GapMap'
import Inspector from './Inspector'

interface Props {
  cls: LipidClass
  onSelectClass: (c: LipidClass) => void
  sel: Cell | null
  onSelect: (c: number, d: number) => void
  persona: Persona
  onPersona: (p: Persona) => void
}

export default function AtlasView({ cls, onSelectClass, sel, onSelect, persona, onPersona }: Props) {
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
        <Rail cls={cls} onSelectClass={onSelectClass} persona={persona} onPersona={onPersona} />
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
            <Inspector cls={cls} sel={sel} persona={persona} />
          </div>
        </aside>
      </div>
    </section>
  )
}
