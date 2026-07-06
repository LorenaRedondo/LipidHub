import { useMemo } from 'react'
import { fam, dMaxOf, likelihood, status, type LipidClass } from '../lib/lipids'
import type { Cell } from '../App'

interface Props {
  cls: LipidClass
  sel: Cell | null
  onSelect: (c: number, d: number) => void
}

const FILL: Record<string, string> = {
  known: 'var(--known)',
  gap: 'var(--gap)',
  rare: 'var(--rare)',
}

export default function GapMap({ cls, sel, onSelect }: Props) {
  const [lo, hi] = cls.cRange
  const cols = useMemo(() => {
    const a: number[] = []
    for (let c = lo; c <= hi; c++) a.push(c)
    return a
  }, [lo, hi])

  const rows = useMemo(() => {
    const r: number[] = []
    for (let d = dMaxOf(cls); d >= 0; d--) r.push(d)
    return r
  }, [cls])

  let known = 0
  let gap = 0
  cols.forEach((c) =>
    rows.forEach((d) => {
      const st = status(cls, c, d)
      if (st === 'known') known++
      else if (st === 'gap') gap++
    }),
  )

  const chainTxt =
    cls.kind === 'sphingo' ? 'd18 sphingoid base + N-acyl' : `${cls.n} acyl chain${cls.n > 1 ? 's' : ''}`

  return (
    <>
      <div className="headline">
        <h2>{cls.name}</h2>
        <span className="sub">
          {cls.category} · {chainTxt} · carbons {lo}–{hi}, 0–{dMaxOf(cls)} double bonds
        </span>
      </div>
      <div className="counts">
        <span><b className="k">{known}</b> curated cells</span>
        <span><b className="g">{gap}</b> predicted gaps</span>
        <span><b>{known + gap}</b> plausible species in view</span>
      </div>

      <div className="mapwrap">
        <div className="maptop">
          <span className="eyebrow">Composition map</span>
          <span className="eyebrow">{cls.k} · {cls.pref}</span>
        </div>
        <div className="grid-shell">
          <span className="axis-y-title">Double bonds →</span>
          <div className="ylabels">
            {rows.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="gridcore">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${cols.length},1fr)` }}>
              {rows.map((d) =>
                cols.map((c) => {
                  const st = status(cls, c, d)
                  const lik = likelihood(cls, c, d)
                  const isSel = sel?.c === c && sel?.d === d
                  return (
                    <div
                      key={`${c}-${d}`}
                      className={'cell' + (isSel ? ' sel' : '')}
                      title={`${cls.k} ${fam(c, d)}`}
                      onClick={() => onSelect(c, d)}
                      style={{
                        background: FILL[st],
                        opacity: st === 'rare' ? 0.28 : Number((0.32 + 0.68 * lik).toFixed(2)),
                      }}
                    />
                  )
                }),
              )}
            </div>
            <div className="xlabels" style={{ gridTemplateColumns: `repeat(${cols.length},1fr)` }}>
              {cols.map((c) => <span key={c}>{c % 2 === 0 && c % 4 === 0 ? c : ''}</span>)}
            </div>
            <div className="axis-x-title">{(cls.xlabel || 'Total acyl carbons')} →</div>
          </div>
        </div>
      </div>

      <div className="legend">
        <div className="it"><span className="sw" style={{ background: 'var(--known)' }} /> Curated — in reference DB (LMSD)</div>
        <div className="it"><span className="sw" style={{ background: 'var(--gap)', opacity: 0.85 }} /> Predicted gap — in-silico only</div>
        <div className="it"><span className="sw" style={{ background: 'var(--rare)' }} /> Rare / implausible</div>
        <div className="it"><span className="sw" style={{ border: '1px solid var(--cyan)', background: 'transparent' }} /> selected</div>
      </div>
      <p className="note">
        <b>Green cells are really in LIPID MAPS</b> — curated status comes from an ingest of the
        LMSD database (50,516 structures, CC BY 4.0), not a guess. Gold cells are enumerable but
        uncatalogued gaps, shown with predicted properties. Fill opacity ≈ estimated biological
        likelihood. Use the arrow keys to walk neighbouring cells.
      </p>
    </>
  )
}
