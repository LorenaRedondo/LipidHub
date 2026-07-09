import { useMemo, useState } from 'react'
import { PERSONAS, type Persona } from '../lib/lipids'
import {
  FEATURES, FEATURE_MAP, GROUP_COLORS, LAB_ONLY_BIO_MAX, LAB_ONLY_CHEM_MIN, PERSONA_ANALYTICS,
  buildDataset, correlate, isLabOnly, labOnlyCandidates, trendFor, type FeatureKey,
} from '../lib/analytics'
import { usePredictions } from '../lib/predictions'
import { downloadSVG } from '../lib/download'

interface Props { persona: Persona; onPersona: (p: Persona) => void; onOpen: (clsK: string, c: number, d: number) => void }

export default function AnalyticsView({ persona, onPersona, onOpen }: Props) {
  const pred = usePredictions()
  const data = useMemo(() => buildDataset(pred), [pred])
  const [xKey, setXKey] = useState<FeatureKey>(PERSONA_ANALYTICS[persona].x)
  const [yKey, setYKey] = useState<FeatureKey>(PERSONA_ANALYTICS[persona].y)

  // clicking a persona resets the pair to that persona's default lens; the
  // pickers below stay fully manual after that, this is just a starting point
  function selectPersona(p: Persona) {
    onPersona(p)
    setXKey(PERSONA_ANALYTICS[p].x)
    setYKey(PERSONA_ANALYTICS[p].y)
  }
  const r = useMemo(() => correlate(data, xKey, yKey), [data, xKey, yKey])
  const trend = useMemo(() => trendFor(xKey, yKey), [xKey, yKey])
  const isBioChemPair = (xKey === 'bio' && yKey === 'chem') || (xKey === 'chem' && yKey === 'bio')
  const showLabOnly = persona === 'chem' && isBioChemPair
  const candidates = useMemo(() => (showLabOnly ? labOnlyCandidates(data) : []), [showLabOnly, data])
  const predictedCount = useMemo(() => data.filter((p) => p.predicted).length, [data])

  // correlation matrix (complete-case per pair)
  const matrix = useMemo(
    () => FEATURES.map((fa) => FEATURES.map((fb) => correlate(data, fa.key, fb.key))),
    [data],
  )

  // ── scatter geometry ────────────────────────────────────────────────
  const W = 600, H = 400, M = { l: 62, r: 16, t: 14, b: 46 }
  const fx = FEATURE_MAP[xKey], fy = FEATURE_MAP[yKey]
  const pts = data
    .map((p, i) => ({ p, i, x: fx.get(p), y: fy.get(p) }))
    .filter((o): o is { p: typeof o.p; i: number; x: number; y: number } => o.x != null && o.y != null)
  const xs = pts.map((o) => o.x), ys = pts.map((o) => o.y)
  const xmin = Math.min(...xs), xmax = Math.max(...xs)
  const ymin = Math.min(...ys), ymax = Math.max(...ys)
  const sx = (v: number) => M.l + ((v - xmin) / (xmax - xmin || 1)) * (W - M.l - M.r)
  const sy = (v: number) => H - M.b - ((v - ymin) / (ymax - ymin || 1)) * (H - M.t - M.b)
  const ticks = (min: number, max: number) => Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4)
  const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10)

  // trend curve, fit in the pair's *natural* orientation (trend.x/trend.y) then re-oriented
  // onto whichever axis the user currently has it plotted on
  const trendPath = useMemo(() => {
    if (!trend) return null
    const swapped = trend.x !== xKey // xKey must be trend.y if not trend.x, since trendFor() matched
    const fitXs = swapped ? ys : xs, fitYs = swapped ? xs : ys
    if (fitXs.length < 3) return null
    const f = trend.fit(fitXs, fitYs)
    const lo = swapped ? ymin : xmin, hi = swapped ? ymax : xmax
    const steps = 40
    const path: string[] = []
    for (let i = 0; i <= steps; i++) {
      const t = lo + ((hi - lo) * i) / steps
      const val = f(t)
      const [px, py] = swapped ? [val, t] : [t, val]
      path.push(`${i ? 'L' : 'M'} ${sx(px).toFixed(1)} ${sy(py).toFixed(1)}`)
    }
    return path.join(' ')
  }, [trend, xKey, xs, ys, xmin, xmax, ymin, ymax])

  // lab-only quadrant rect, in whichever axis orientation chem/bio currently sit
  const labOnlyRect = useMemo(() => {
    if (!showLabOnly) return null
    const chemOnX = xKey === 'chem'
    const chemMin = Math.max(LAB_ONLY_CHEM_MIN, chemOnX ? xmin : ymin)
    const bioMax = Math.min(LAB_ONLY_BIO_MAX, chemOnX ? ymax : xmax)
    if (chemMin > (chemOnX ? xmax : ymax) || bioMax < (chemOnX ? ymin : xmin)) return null
    const left = chemOnX ? sx(chemMin) : sx(xmin)
    const right = chemOnX ? sx(xmax) : sx(bioMax)
    const top = chemOnX ? sy(ymax) : sy(chemMin)
    const bottom = chemOnX ? sy(bioMax) : sy(ymin)
    return { x: Math.min(left, right), y: Math.min(top, bottom), w: Math.abs(right - left), h: Math.abs(bottom - top) }
  }, [showLabOnly, xKey, xs, ys, xmin, xmax, ymin, ymax])

  const corrColor = (v: number) =>
    v >= 0 ? `rgba(224,168,63,${(0.12 + 0.88 * v).toFixed(3)})` : `rgba(78,203,198,${(0.12 + 0.88 * -v).toFixed(3)})`
  const strength = Math.abs(r) > 0.8 ? 'strong' : Math.abs(r) > 0.5 ? 'moderate' : Math.abs(r) > 0.2 ? 'weak' : 'no'

  return (
    <section className="view on">
      <div className="doc wide">
        <span className="eyebrow">Analytics</span>
        <h2 style={{ marginTop: 8 }}>Explore property relationships</h2>
        <p className="lede">
          Every plausible species in the atlas as one point. What's worth looking at here depends
          on what you're trying to do — pick a view below for a relevant starting pair, or set
          any two properties yourself.{' '}
          <span style={{ color: 'var(--faint)' }}>
            ({data.length} species · {predictedCount} with real ML-predicted CCS/RT
            {pred ? ` (${pred.model_version})` : ''}, rest from the composition formula.)
          </span>
        </p>

        <div className="persona-bar standalone" style={{ marginBottom: 20 }}>
          <span className="persona-bar-label">View as</span>
          <div className="persona-chips" role="group" aria-label="Analyze as">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                aria-pressed={p.id === persona}
                className={'pchip' + (p.id === persona ? ' on' : '')}
                onClick={() => selectPersona(p.id)}
                title={p.label}
              >
                <span className="ic" aria-hidden="true">{p.ic}</span>
                <span>{p.short}</span>
              </button>
            ))}
          </div>
          <p className="note" style={{ marginTop: 8, marginBottom: 0 }}>{PERSONA_ANALYTICS[persona].framing}</p>
        </div>

        <div className="an-grid">
          {/* correlation matrix */}
          <div className="an-card">
            <h3 className="an-h">Property correlation matrix <span className="an-sub">Pearson r · click a cell to plot</span></h3>
            <div className="corr-wrap">
              <table className="corr">
                <tbody>
                  <tr>
                    <td className="corr-corner" />
                    {FEATURES.map((f) => <td key={f.key} className="corr-colhead">{f.short}</td>)}
                  </tr>
                  {FEATURES.map((fa, i) => (
                    <tr key={fa.key}>
                      <td className="corr-rowhead">{fa.short}</td>
                      {FEATURES.map((fb, j) => (
                        <td
                          key={fb.key}
                          className={'corr-cell' + (i === j ? ' diag' : '')}
                          style={{ background: i === j ? 'var(--raise)' : corrColor(matrix[i][j]) }}
                          title={`${fa.label} × ${fb.label}: r = ${matrix[i][j].toFixed(2)}`}
                          onClick={() => { if (i !== j) { setXKey(fb.key); setYKey(fa.key) } }}
                        >
                          {i === j ? '' : matrix[i][j].toFixed(1).replace('0.', '.')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="corr-key">
              <span className="sw" style={{ background: 'rgba(78,203,198,.9)' }} /> −1
              <span className="sw" style={{ background: 'var(--raise)' }} /> 0
              <span className="sw" style={{ background: 'rgba(224,168,63,.9)' }} /> +1
            </div>
          </div>

          {/* scatter */}
          <div className="an-card">
            <div className="an-ctrls">
              <label>X<select value={xKey} onChange={(e) => setXKey(e.target.value as FeatureKey)}>{FEATURES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
              <label>Y<select value={yKey} onChange={(e) => setYKey(e.target.value as FeatureKey)}>{FEATURES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
              <button className="dl-link" onClick={() => downloadSVG(`lipiverse-${xKey}-vs-${yKey}.svg`, document.querySelector('.scatter-wrap svg'))}>SVG ↓</button>
            </div>

            {trend && (
              <>
                <div className="rline">
                  r = <b className="num" style={{ color: r >= 0 ? 'var(--gold)' : 'var(--cyan)' }}>{r.toFixed(2)}</b>
                  <span className="an-sub">{strength} {r >= 0 ? 'positive' : 'negative'} correlation</span>
                  <span className={'trend-basis ' + trend.basis}>
                    {trend.basis === 'validation' ? 'tested vs. real model output' : 'formula reference, not independent data'}
                  </span>
                </div>
                <div className="an-sub" style={{ marginTop: -6, marginBottom: 8 }}>trend curve: {trend.reason}</div>
              </>
            )}
            {showLabOnly && (
              <div className="an-sub" style={{ marginBottom: 8 }}>
                shaded region: chem ≥ {LAB_ONLY_CHEM_MIN}, bio ≤ {LAB_ONLY_BIO_MAX} (same definition as <code>/lab-only</code>) — {candidates.length} candidates below
              </div>
            )}

            <div className="scatter-wrap">
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="property scatter plot">
                {/* grid + ticks */}
                {ticks(ymin, ymax).map((t, i) => (
                  <g key={'y' + i}>
                    <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth={1} />
                    <text x={M.l - 8} y={sy(t) + 3} textAnchor="end" className="ax">{fmt(t)}</text>
                  </g>
                ))}
                {ticks(xmin, xmax).map((t, i) => (
                  <g key={'x' + i}>
                    <text x={sx(t)} y={H - M.b + 16} textAnchor="middle" className="ax">{fmt(t)}</text>
                  </g>
                ))}
                {labOnlyRect && (
                  <rect x={labOnlyRect.x} y={labOnlyRect.y} width={labOnlyRect.w} height={labOnlyRect.h} fill="var(--cyan)" fillOpacity={0.07} stroke="var(--cyan-dim)" strokeDasharray="3 3" />
                )}
                {pts.map((o) => (
                  <circle
                    key={o.p.id} cx={sx(o.x)} cy={sy(o.y)} r={showLabOnly && isLabOnly(o.p) ? 3.4 : 2.7}
                    fill={showLabOnly && isLabOnly(o.p) ? 'var(--cyan)' : GROUP_COLORS[o.p.group]}
                    fillOpacity={showLabOnly ? (isLabOnly(o.p) ? 0.95 : 0.35) : 0.72}
                  >
                    <title>{`${o.p.clsK} ${o.p.c}:${o.p.d} · ${fx.short} ${fmt(o.x)} · ${fy.short} ${fmt(o.y)}`}</title>
                  </circle>
                ))}
                {trendPath && <path d={trendPath} fill="none" stroke="var(--text)" strokeWidth={1.6} strokeDasharray="4 3" opacity={0.85} />}
                <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="axtitle">{fx.label}</text>
                <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" className="axtitle">{fy.label}</text>
              </svg>
            </div>

            {showLabOnly ? (
              candidates.length > 0 && (
                <div className="an-legend" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, marginTop: 12 }}>
                  {candidates.map((c) => (
                    <div key={c.id} className="rline" style={{ marginBottom: 0, justifyContent: 'space-between' }}>
                      <span><b className="num">{c.clsK} {c.c}:{c.d}</b> <span className="an-sub">chem {c.chem} · bio {c.bio}</span></span>
                      <button className="openbtn" onClick={() => onOpen(c.clsK, c.c, c.d)}>open →</button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="an-legend">
                {Object.entries(GROUP_COLORS).map(([g, c]) => <span key={g} className="lg"><span className="dot2" style={{ background: c }} />{g}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
