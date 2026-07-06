import { CLASSES, type LipidClass, type Persona } from '../lib/lipids'

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
  return (
    <aside className="rail">
      <div className="railgroup">
        <span className="eyebrow">Lipid class</span>
        <div>
          {CLASSES.map((cl) => (
            <button
              key={cl.k}
              className={'classbtn' + (cl.k === cls.k ? ' on' : '')}
              onClick={() => onSelectClass(cl)}
            >
              <span>
                <span className="abbr">{cl.k}</span>{' '}
                <span className="nm">{cl.name.replace(/^Phosphatidyl/, 'Pt-').slice(0, 14)}</span>
              </span>
              <span className="cat">×{cl.n}</span>
            </button>
          ))}
        </div>
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
      <p className="note">
        Each cell is one lipid species at a given <b>sum composition</b>. Colour encodes whether
        it's experimentally catalogued or exists only in the enumerated space — the <b>gaps</b>.
      </p>
    </aside>
  )
}
