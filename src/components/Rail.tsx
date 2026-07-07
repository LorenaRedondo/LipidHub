import { useState } from 'react'
import { CLASSES, GROUPS, KINGDOMS, type Kingdom, type LipidClass } from '../lib/lipids'

interface Props {
  cls: LipidClass
  onSelectClass: (c: LipidClass) => void
}

export default function Rail({ cls, onSelectClass }: Props) {
  const [kingdom, setKingdom] = useState<Kingdom | null>(null)

  const visible = kingdom ? CLASSES.filter((c) => c.kingdoms.includes(kingdom)) : CLASSES

  return (
    <aside className="rail">
      <div className="railgroup">
        <span className="eyebrow">Occurs in kingdom</span>
        <div className="kchips" role="group" aria-label="Filter classes by kingdom">
          <button aria-pressed={kingdom === null} className={'kchip' + (kingdom === null ? ' on' : '')} onClick={() => setKingdom(null)}>All</button>
          {KINGDOMS.map((kg) => {
            const count = CLASSES.filter((c) => c.kingdoms.includes(kg)).length
            return (
              <button
                key={kg}
                aria-pressed={kingdom === kg}
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
                  aria-current={cl.k === cls.k ? 'true' : undefined}
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
    </aside>
  )
}
