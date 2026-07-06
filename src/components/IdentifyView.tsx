import { useMemo, useState } from 'react'
import { identifyByMz } from '../lib/service'
import { downloadCSV } from '../lib/download'

interface Props { onOpen: (clsK: string, c: number, d: number) => void }

const ADDUCTS = ['[M+H]+', '[M-H]-', '[M+NH4]+', '[M+HCOO]-']
const numOr = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s))

/** Rank candidates by combined evidence: mass (required) + optional CCS + RT. */
function score(errPpm: number, tol: number, predCcs: number, obsCcs: number | undefined, predRt: number, obsRt: number | undefined) {
  const mass = Math.max(0, 1 - Math.abs(errPpm) / tol)
  let ccs = 1, rt = 1, used = 1
  if (obsCcs != null) { ccs = Math.max(0, 1 - Math.abs(predCcs - obsCcs) / (0.05 * predCcs)); used++ } // 5% window
  if (obsRt != null) { rt = Math.max(0, 1 - Math.abs(predRt - obsRt) / 2); used++ } // ±2 min window
  // weighted: mass counts double (it's the hard constraint)
  const conf = (2 * mass + (obsCcs != null ? ccs : 0) + (obsRt != null ? rt : 0)) / (2 + (obsCcs != null ? 1 : 0) + (obsRt != null ? 1 : 0))
  return { conf: Math.round(conf * 100), ccsMatch: obsCcs != null ? ccs : null, rtMatch: obsRt != null ? rt : null, evidence: used }
}

export default function IdentifyView({ onOpen }: Props) {
  const [mz, setMz] = useState('760.585')
  const [adduct, setAdduct] = useState('[M+H]+')
  const [ppm, setPpm] = useState('10')
  const [ccs, setCcs] = useState('')
  const [rt, setRt] = useState('')

  const results = useMemo(() => {
    const m = numOr(mz)
    if (m == null || !isFinite(m)) return []
    const tol = numOr(ppm) ?? 10
    const obsCcs = numOr(ccs)
    const obsRt = numOr(rt)
    return identifyByMz(m, tol, adduct)
      .map((cand) => ({ cand, s: score(cand.errorPpm, tol, cand.record.properties.ccs, obsCcs, cand.record.properties.rt, obsRt) }))
      .sort((a, b) => b.s.conf - a.s.conf || Math.abs(a.cand.errorPpm) - Math.abs(b.cand.errorPpm))
  }, [mz, adduct, ppm, ccs, rt])

  const isobaric = results.length > 1

  return (
    <section className="view on">
      <div className="doc wide">
        <span className="eyebrow">Identify</span>
        <h2 style={{ marginTop: 8 }}>What lipid is this feature?</h2>
        <p className="lede">
          Enter an observed m/z from a run — add CCS and RT to disambiguate. You get ranked
          candidates with a confidence score, <b>including species no spectral library has</b>
          because the atlas predicted them.{' '}
          <span style={{ color: 'var(--faint)' }}>Mass is exact; CCS/RT are predicted (issue #3).</span>
        </p>

        <div className="idf-inputs">
          <label className="facet">m/z (observed)
            <input value={mz} onChange={(e) => setMz(e.target.value)} inputMode="decimal" placeholder="760.585" />
          </label>
          <label className="facet">Adduct
            <select value={adduct} onChange={(e) => setAdduct(e.target.value)}>
              {ADDUCTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="facet">Tolerance (ppm)
            <input className="one" value={ppm} onChange={(e) => setPpm(e.target.value)} inputMode="numeric" placeholder="10" />
          </label>
          <label className="facet">CCS (optional, Å²)
            <input className="one" value={ccs} onChange={(e) => setCcs(e.target.value)} inputMode="decimal" placeholder="—" />
          </label>
          <label className="facet">RT (optional, min)
            <input className="one" value={rt} onChange={(e) => setRt(e.target.value)} inputMode="decimal" placeholder="—" />
          </label>
        </div>

        <div className="srch-count">
          <b className="num">{results.length}</b> candidate{results.length === 1 ? '' : 's'} within tolerance
          {isobaric && <span className="an-sub"> · isobaric — use CCS/RT to disambiguate</span>}
          {results.length > 0 && (
            <button className="dl-link" onClick={() => downloadCSV('lipidex-identify.csv',
              ['shorthand', 'formula', 'adduct', 'adduct_mz', 'error_ppm', 'ccs_pred', 'rt_pred', 'origin', 'confidence'],
              results.map(({ cand, s }) => [cand.record.shorthand, cand.record.formula, cand.adduct, cand.adductMz.toFixed(4), cand.errorPpm.toFixed(2), cand.record.properties.ccs, cand.record.properties.rt, cand.record.origin, s.conf]))}>download CSV ↓</button>
          )}
        </div>

        <div className="cmp-scroll">
          <table className="cmp srch-table">
            <thead>
              <tr>
                <th>Candidate</th><th className="num">Formula</th><th className="num">{adduct} m/z</th>
                <th className="num">Δ ppm</th><th className="num">CCS</th><th className="num">RT</th>
                <th>Origin</th><th className="num">Confidence</th><th />
              </tr>
            </thead>
            <tbody>
              {results.map(({ cand, s }) => {
                const r = cand.record
                return (
                  <tr key={r.id}>
                    <td className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{r.shorthand}</td>
                    <td className="num">{r.formula}</td>
                    <td className="num">{cand.adductMz.toFixed(4)}</td>
                    <td className="num" style={{ color: Math.abs(cand.errorPpm) < 3 ? 'var(--known)' : 'var(--muted)' }}>{cand.errorPpm.toFixed(2)}</td>
                    <td className="num">{r.properties.ccs}{s.ccsMatch != null && <span className="u"> {s.ccsMatch > 0.6 ? '✓' : '✗'}</span>}</td>
                    <td className="num">{r.properties.rt}{s.rtMatch != null && <span className="u"> {s.rtMatch > 0.6 ? '✓' : '✗'}</span>}</td>
                    <td><span className={'badge ' + (r.origin === 'curated' ? 'known' : 'gap')} style={{ fontSize: 9 }}>{r.origin === 'curated' ? 'curated' : 'gap'}</span></td>
                    <td className="num">
                      <div className="conf-cell">
                        <div className="conf-bar"><i style={{ width: `${s.conf}%`, background: s.conf > 66 ? 'var(--known)' : s.conf > 40 ? 'var(--gold)' : 'var(--rare)' }} /></div>
                        <span>{s.conf}</span>
                      </div>
                    </td>
                    <td><button className="openbtn" onClick={() => onOpen(r.class.k, r.composition.carbons, r.composition.doubleBonds)}>open →</button></td>
                  </tr>
                )
              })}
              {!results.length && (
                <tr><td colSpan={9} style={{ color: 'var(--muted)', padding: '26px 16px', textAlign: 'center' }}>
                  No candidates — check the adduct, or widen the ppm tolerance.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="note" style={{ marginTop: 16 }}>
          Confidence weights the mass match (exact) most, then CCS and RT closeness (predicted) when
          you provide them. Ties at the same m/z are genuine isobars — resolve them with orthogonal
          evidence, not a coin flip. Open a candidate to see its predicted MS/MS fragments.
        </p>
      </div>
    </section>
  )
}
