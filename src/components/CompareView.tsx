import { useMemo, useState, type ReactNode } from 'react'
import {
  FORMATE, MEMBRANE_CLASSES, NH4, PROTON, fam, findClass, formulaParts, headgroupCharge,
  mixMembraneBiophysics, prefersAmmonium, props, status, synth, type LipidClass,
} from '../lib/lipids'
import { ccsRtFor, logpFor, saScoreFor } from '../lib/realProps'
import { matchPhaseDiagram } from '../lib/phaseDiagram'
import type { Pin } from '../App'
import ConfBadge from './ConfBadge'
import PhaseDiagramCard from './PhaseDiagramCard'

interface Resolved { pin: Pin; cls: LipidClass }

function formulaText(cls: LipidClass, c: number, d: number): string {
  return formulaParts(props(cls, c, d).f).map((p) => p.el + (p.n > 1 ? p.n : '')).join('')
}

const pinKey = (p: Pin) => `${p.clsK}-${p.c}-${p.d}`

export default function CompareView({ pins, onTogglePin, onGoAtlas }: { pins: Pin[]; onTogglePin: (p: Pin) => void; onGoAtlas: () => void }) {
  const [mode, setMode] = useState<'table' | 'mixture'>('table')
  const cols: Resolved[] = pins
    .map((pin) => ({ pin, cls: findClass(pin.clsK) }))
    .filter((r): r is Resolved => !!r.cls)
  const membraneCols = cols.filter((r) => MEMBRANE_CLASSES.has(r.cls.k))

  const [fractions, setFractions] = useState<Record<string, number>>({})
  const fractionFor = (r: Resolved) => fractions[pinKey(r.pin)] ?? 1 / Math.max(1, membraneCols.length)

  const mixed = useMemo(() => {
    if (membraneCols.length < 2) return null
    return mixMembraneBiophysics(membraneCols.map((r) => ({ cls: r.cls, c: r.pin.c, d: r.pin.d, molFraction: fractionFor(r) })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membraneCols.map((r) => pinKey(r.pin)).join(','), fractions])

  const diagram = useMemo(
    () => matchPhaseDiagram(cols.map((r) => ({ clsK: r.cls.k, c: r.pin.c, d: r.pin.d }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cols.map((r) => pinKey(r.pin)).join(',')],
  )
  const [phasePct, setPhasePct] = useState<Record<string, number>>({})
  const phaseFractionFor = (r: Resolved) => phasePct[pinKey(r.pin)] ?? 1 / 3
  function setPhaseFraction(r: Resolved, pct: number) {
    setPhasePct((prev) => ({ ...prev, [pinKey(r.pin)]: Math.max(0, Math.min(100, pct)) / 100 }))
  }
  const phaseInputs = useMemo(() => {
    if (!diagram) return null
    const find = (key: string) => cols.find((r) => `${r.cls.k}-${r.pin.c}-${r.pin.d}` === key)
    const lowR = find(diagram.system.lowMelt), hiR = find(diagram.system.highMelt), cholR = find(diagram.system.sterol)
    if (!lowR || !hiR || !cholR) return null
    const total = phaseFractionFor(lowR) + phaseFractionFor(hiR) + phaseFractionFor(cholR)
    const pLow = phaseFractionFor(lowR) / total, pHi = phaseFractionFor(hiR) / total, pChol = phaseFractionFor(cholR) / total
    return { lowR, hiR, cholR, x: pHi / (pHi + pLow || 1), y: pChol }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram, phasePct])

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
    { label: 'CCS (Å²) · pred', get: (r) => { const pr = ccsRtFor(pinKey(r.pin)); return pr ? pr.ccs.v : 'not available' }, mono: true },
    { label: 'RT (min) · pred', get: (r) => { const pr = ccsRtFor(pinKey(r.pin)); return pr ? pr.rt.v : 'not available' }, mono: true },
    { label: 'logP · calc', get: (r) => { const v = logpFor(pinKey(r.pin)); return v == null ? 'not available' : v }, mono: true },
    { label: 'Headgroup', get: (r) => headgroupCharge(r.cls) },
    { label: 'Biosynthetic (est.)', get: (r) => `${synth(r.cls, r.pin.c, r.pin.d).bio}/100`, mono: true },
    { label: 'Chemical (SAScore)', get: (r) => { const v = saScoreFor(pinKey(r.pin)); return v == null ? `${synth(r.cls, r.pin.c, r.pin.d).sa} (est.)` : v }, mono: true },
    { label: 'Status', get: (r) => status(r.cls, r.pin.c, r.pin.d) },
  ]

  function setFraction(r: Resolved, pct: number) {
    setFractions((prev) => ({ ...prev, [pinKey(r.pin)]: Math.max(0, Math.min(100, pct)) / 100 }))
  }

  return (
    <section className="view on">
      <div className="doc wide">
        <span className="eyebrow">Compare · {cols.length}/4</span>
        <h2 style={{ marginTop: 8 }}>{mode === 'table' ? 'Side-by-side' : 'As a mixture'}</h2>
        <div className="seg" style={{ marginBottom: membraneCols.length < 2 ? 6 : 16 }} role="group" aria-label="Compare mode">
          <button aria-pressed={mode === 'table'} className={mode === 'table' ? 'on' : ''} onClick={() => setMode('table')}>side-by-side</button>
          <button aria-pressed={mode === 'mixture'} className={mode === 'mixture' ? 'on' : ''} onClick={() => setMode('mixture')} disabled={membraneCols.length < 2} title={membraneCols.length < 2 ? 'Pin at least 2 membrane-forming species' : undefined}>as a mixture</button>
        </div>
        {membraneCols.length < 2 && (
          <p className="note" style={{ marginBottom: 16 }}>
            "as a mixture" needs at least 2 pinned species that form bilayers (glycerophospholipids,
            glycolipids, sphingolipids, or cardiolipin) — {cols.length ? `you have ${membraneCols.length} of ${cols.length} pinned that qualify` : 'nothing pinned yet'}.
            Fatty acyls, sterols, and storage lipids (TG/DG/CE) aren't modeled as bilayer components here.
          </p>
        )}

        {mode === 'table' ? (
          <>
            <p className="lede" style={{ marginBottom: 22 }}>
              Property values are computed live from each species' composition. Anything marked
              <span style={{ margin: '0 4px' }}><ConfBadge m="predicted" /></span> is a model estimate, not a measurement.
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
          </>
        ) : (
          <>
            <p className="lede" style={{ marginBottom: 22 }}>
              Set mole fractions for each membrane-forming pinned species — the emergent bilayer
              properties below are computed by blending each species' real physical inputs
              (specific-volume/area additivity, a standard first-order <b>ideal-mixing</b>{' '}
              approximation), then deriving thickness/curvature from the blend with
              the same Tanford geometry used for a single species. This is <b>not</b> a phase-separation
              model — real mixtures of e.g. cholesterol + saturated lipids deviate from ideal
              mixing significantly (tracked separately, issue #63).
              {cols.length !== membraneCols.length && (
                <span style={{ display: 'block', marginTop: 6, color: 'var(--faint)' }}>
                  {cols.length - membraneCols.length} pinned species don't form membranes and are excluded from the blend.
                </span>
              )}
            </p>

            <div className="mix-inputs" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {membraneCols.map((r) => (
                <div key={pinKey(r.pin)} className="rline" style={{ marginBottom: 0, justifyContent: 'space-between' }}>
                  <span><b className="num">{r.cls.k} {fam(r.pin.c, r.pin.d)}</b> <span className="an-sub">{r.cls.name}</span></span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number" min={0} max={100} step={1}
                      value={Math.round(fractionFor(r) * 100)}
                      onChange={(e) => setFraction(r, Number(e.target.value))}
                      className="one" style={{ width: 60 }}
                    />
                    <span className="an-sub">mol %</span>
                  </label>
                </div>
              ))}
            </div>

            {mixed && (
              <div className="sp-grid" style={{ maxWidth: 820 }}>
                <div className="sp-card">
                  <h3>Emergent bilayer geometry <span className="pred-model">ideal-mixing approx.</span></h3>
                  <div className="kv">
                    <div className="k">Packing / curvature</div><div className="v">{mixed.packing} · {mixed.curvature}</div>
                    <div className="k">Bilayer thickness</div><div className="v">{mixed.thicknessNm} <span className="u">nm</span></div>
                    <div className="k">Area / lipid</div><div className="v">{mixed.areaPerLipid} <span className="u">Å²</span></div>
                  </div>
                  <p className="note" style={{ marginTop: 8 }}>
                    Tanford/Israelachvili geometry only. Phase state, T<sub>m</sub> and AFM nanomechanics
                    have no validated source and are not reported.
                  </p>
                </div>
              </div>
            )}

            {diagram && phaseInputs ? (
              <div style={{ marginTop: 20, maxWidth: 480 }}>
                <p className="lede" style={{ marginBottom: 14 }}>
                  This exact pin combination (DOPC + DPPC + cholesterol) has a real, published ternary
                  phase diagram — set mole fractions below to classify liquid-disordered (Lα) /
                  liquid-ordered (Lo) coexistence instead of the ideal-mixing approximation above.
                </p>
                <div className="mix-inputs" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {[phaseInputs.lowR, phaseInputs.hiR, phaseInputs.cholR].map((r) => (
                    <div key={pinKey(r.pin)} className="rline" style={{ marginBottom: 0, justifyContent: 'space-between' }}>
                      <span><b className="num">{r.cls.k} {fam(r.pin.c, r.pin.d)}</b> <span className="an-sub">{r.cls.name}</span></span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number" min={0} max={100} step={1}
                          value={Math.round(phaseFractionFor(r) * 100)}
                          onChange={(e) => setPhaseFraction(r, Number(e.target.value))}
                          className="one" style={{ width: 60 }}
                        />
                        <span className="an-sub">mol %</span>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="sp-grid" style={{ maxWidth: 480 }}>
                  <PhaseDiagramCard diagram={diagram} x={phaseInputs.x} y={phaseInputs.y} />
                </div>
              </div>
            ) : cols.length === 3 ? (
              <p className="note" style={{ marginTop: 16, maxWidth: 480 }}>
                No published phase diagram is digitized for this combination yet — real Lo/Ld domain
                data currently only covers DOPC (PC 36:2) + DPPC (PC 32:0) + cholesterol. See issue #63.
              </p>
            ) : null}
          </>
        )}
        <button className="cta ghost" onClick={onGoAtlas} style={{ marginTop: 22 }}>← Back to the Atlas</button>
      </div>
    </section>
  )
}

const prefersAmmoniumLabel = '[M+NH₄]⁺ or [M+HCOO]⁻'
