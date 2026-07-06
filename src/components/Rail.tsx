import { useState } from 'react'
import { CLASSES, GROUPS, KINGDOMS, type Kingdom, type LipidClass, type Persona } from '../lib/lipids'

const PERSONAS: { id: Persona; ic: string; label: string }[] = [
  { id: 'analyst', ic: '◎', label: 'Mass-spec analyst' },
  { id: 'biophys', ic: '≋', label: 'Membrane biophysicist' },
  { id: 'chem', ic: '⚗', label: 'Synthetic chemist' },
  { id: 'bioinfo', ic: '⌗', label: 'Bioinformatician' },
]

interface Props {
  cls: LipidClass
  onSelectClass: (c: LipidClass) => void
  persona: Persona
  onPersona: (p: Persona) => void
}

export default function Rail({ cls, onSelectClass, persona, onPersona }: Props) {
  const [kingdom, setKingdom] = useState<Kingdom | null>(null)

  const visible = kingdom ? CLASSES.filter((c) => c.kingdoms.includes(kingdom)) : CLASSES

  return (
    <aside className="rail">
      <div className="railgroup">
        <span className="eyebrow">Occurs in kingdom</span>
        <div className="kchips">
          <button className={'kchip' + (kingdom === null ? ' on' : '')} onClick={() => setKingdom(null)}>All</button>
          {KINGDOMS.map((kg) => {
            const count = CLASSES.filter((c) => c.kingdoms.includes(kg)).length
            return (
              <button
                key={kg}
                className={'kchip' + (kingdom === kg ? ' on' : '') + (count === 0 ? ' empty' : '')}
                onClick={() => setKingdom(kingdom === kg ? null : kg)}
                disabled={count === 0}
                title={`${count} class${count === 1 ? '' : 'es'}`}
              >
                {kg}
              </button>
            )
          })}
        </div>
      </div>

      <div className="railgroup">
        <span className="eyebrow">Lipid class</span>
        {GROUPS.map((g) => {
          const members = visible.filter((c) => c.group === g)
          if (!members.length) return null
          return (
            <div className="classgroup" key={g}>
              <div className="grouphead">{g}</div>
              {members.map((cl) => (
                <button
                  key={cl.k}
                  className={'classbtn' + (cl.k === cls.k ? ' on' : '')}
                  onClick={() => onSelectClass(cl)}
                >
                  <span>
                    <span className="abbr">{cl.k}</span>{' '}
                    <span className="nm">{cl.name.replace(/^Phosphatidyl/, 'Pt-').replace(/^Lysophosphatidyl/, 'Lyso-Pt-').slice(0, 15)}</span>
                  </span>
                  <span className="cat">×{cl.n}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div className="railgroup">
        <span className="eyebrow">View as…</span>
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            className={'persona' + (p.id === persona ? ' on' : '')}
            onClick={() => onPersona(p.id)}
          >
            <span className="ic">{p.ic}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
