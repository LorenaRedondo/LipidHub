import type { ReactNode } from 'react'
import {
  FORMATE, NH4, PROTON, fam, findClass, formulaParts, headgroupCharge,
  prefersAmmonium, props, status, synth, type LipidClass,
} from '../lib/lipids'
import type { Pin } from '../App'

interface Resolved { pin: Pin; cls: LipidClass }

function formulaText(cls: LipidClass, c: number, d: number): string {
  return formulaParts(props(cls, c, d).f).map((p) => p.el + (p.n > 1 ? p.n : '')).join('')
}

export default function CompareView({ pins, onTogglePin, onGoAtlas }: { pins: Pin[]; onTogglePin: (p: Pin) => void; onGoAtlas: () => void }) {
  const cols: Resolved[] = pins
    .map((pin) => ({ pin, cls: findClass(pin.clsK) }))
    .filter((r): r is Resolved => !!r.cls)

  if (!cols.length) {
    return (
      <section className="view on">
        <div className="doc">
          <span className="eyebrow">Compare</span>
          <h2 style={{ marginTop: 8 }}>Nothing pinned yet</h2>
          <p className="lede">
            Open the <b>Atlas</b>, select any species, and hit <b>+ compare</b> in the inspector to
            pin it here. Add up to four and their properties line up side by side — handy for seeing
            how one more double bond or a different headgroup moves mass, CCS, T<sub>m</sub>, and
            synthesizability.
          </p>
          <button className="cta" onClick={onGoAtlas}>Go to the Atlas →</button>
        </div>
      </section>
    )
  }

  const rows: { label: string; get: (r: Resolved) => ReactNode; mono?: boolean }[] = [
    { label: 'Group', get: (r) => r.cls.group },
    { label: 'Category', get: (r) => r.cls.category },
    { label: 'Occurs in', get: (r) => r.cls.kingdoms.join(', ') },
    { label: 'Formula', get: (r) => formulaText(r.cls, r.pin.c, r.pin.d), mono: true },
    { label: 'Exact mass (Da)', get: (r) => props(r.cls, r.pin.c, r.pin.d).M.toFixed(4), mono: true },
    { label: '[M+H]⁺', get: (r) => (props(r.cls, r.pin.c, r.pin.d).M + PROTON).toFixed(4), mono: true },
    { label: '[M−H]⁻', get: (r) => (props(r.cls, r.pin.c, r.pin.d).M - PROTON).toFixed(4), mono: true },
    { label: prefersAmmoniumLabel, get: (r) => { const M = props(r.cls, r.pin.c, r.pin.d).M; return (prefersAmmonium(r.cls) ? M + NH4 : M + FORMATE).toFixed(4) }, mono: true },
    { label: 'CCS (Å²) · pred', get: (r) => props(r.cls, r.pin.c, r.pin.d).ccs, mono: true },
    { label: 'RT (min) · pred', get: (r) => props(r.cls, r.pin.c, r.pin.d).rt, mono: true },
    { label: 'logP · calc', get: (r) => props(r.cls, r.pin.c, r.pin.d).logp, mono: true },
    { label: 'Tm (°C) · pred', get: (r) => { const t = props(r.cls, r.pin.c, r.pin.d).tm; return t == null ? 'n/a' : t }, mono: true },
    { label: 'Headgroup', get: (r) => headgroupCharge(r.cls) },
    { label: 'Biosynthetic', get: (r) => `${synth(r.cls, r.pin.c, r.pin.d).bio}/100`, mono: true },
    { label: 'Chemical (SAScore)', get: (r) => `${synth(r.cls, r.pin.c, r.pin.d).sa}`, mono: true },
    { label: 'Status', get: (r) => status(r.cls, r.pin.c, r.pin.d) },
  ]

  return (
    <section className="view on">
      <div className="doc wide">
        <span className="eyebrow">Compare · {cols.length}/4</span>
        <h2 style={{ marginTop: 8 }}>Side-by-side</h2>
        <p className="lede" style={{ marginBottom: 22 }}>
          Property values are computed live from each species' composition. Anything marked
          <span className="conf pred" style={{ margin: '0 4px' }}>pred</span> is a model estimate, not a measurement.
        </p>

        <div className="cmp-scroll">
          <table className="cmp">
            <thead>
              <tr>
                <th className="rowhead" />
                {cols.map((r) => (
                  <th key={r.cls.k + r.pin.c + r.pin.d}>
                    <div className="cmp-species">{r.cls.k} {fam(r.pin.c, r.pin.d)}</div>
                    <div className="cmp-name">{r.cls.name}</div>
                    <button className="cmp-remove" onClick={() => onTogglePin(r.pin)} title="Remove from comparison">remove ✕</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="rowhead">{row.label}</td>
                  {cols.map((r) => (
                    <td key={r.cls.k + r.pin.c + r.pin.d} className={row.mono ? 'num' : ''}>{row.get(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="cta ghost" onClick={onGoAtlas} style={{ marginTop: 22 }}>← Back to the Atlas</button>
      </div>
    </section>
  )
}

const prefersAmmoniumLabel = '[M+NH₄]⁺ or [M+HCOO]⁻'
