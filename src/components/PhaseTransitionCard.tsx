import { useState } from 'react'

/**
 * Gel↔fluid main-transition sweep. Only the marked T_m point is computed (a heuristic,
 * `3.0*c - 55 - 25*d` per chain composition — not independently validated per-species the
 * way the Tanford-derived thickness/breakthrough-force formulas are). The sigmoid's width is
 * illustrative: real transitions have a cooperative width that depends on the lipid and isn't
 * something this app has a validated formula for, so the curve shows the shape of a transition,
 * not a measured one. Shared by single species (Inspector) and mixtures (Compare) — mixtures
 * pass the mole-fraction-weighted blended T_m from mixMembraneBiophysics().
 */
export default function PhaseTransitionCard({ tmC }: { tmC: number }) {
  const [queryC, setQueryC] = useState(37)
  const W = 380, H = 150, M = { l: 40, r: 12, t: 14, b: 28 }
  const lo = tmC - 15, hi = tmC + 15
  const sx = (t: number) => M.l + ((t - lo) / (hi - lo)) * (W - M.l - M.r)
  const sy = (order: number) => M.t + (1 - order) * (H - M.t - M.b)

  const width = 3 // illustrative cooperative width, °C — not a measured value
  const order = (t: number) => 1 / (1 + Math.exp((t - tmC) / width))
  const steps = 60
  const path = Array.from({ length: steps + 1 }, (_, i) => {
    const t = lo + ((hi - lo) * i) / steps
    return `${i ? 'L' : 'M'} ${sx(t).toFixed(1)} ${sy(order(t)).toFixed(1)}`
  }).join(' ')

  const gel = queryC < tmC
  const clampedQuery = Math.max(lo, Math.min(hi, queryC))

  return (
    <div className="sp-card">
      <h3>Main transition (T<sub>m</sub>) <span className="pred-model">heuristic formula</span></h3>
      <label className="rline" style={{ justifyContent: 'space-between' }}>
        <span>Temperature</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number" step={0.5} value={queryC}
            onChange={(e) => setQueryC(Number(e.target.value))} className="one" style={{ width: 60 }}
          />
          <span className="an-sub">°C</span>
        </span>
      </label>
      <div className="kv" style={{ marginTop: 6 }}>
        <div className="k">State at {queryC} °C</div><div className="v">{gel ? 'gel (ordered)' : 'fluid (liquid-crystalline)'}</div>
        <div className="k">T<sub>m</sub></div><div className="v">{tmC} °C</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="phase transition sweep" style={{ marginTop: 6 }}>
        <line x1={sx(tmC)} x2={sx(tmC)} y1={M.t} y2={H - M.b} stroke="var(--faint)" strokeDasharray="2,2" strokeWidth={0.8} />
        <path d={path} fill="none" stroke="var(--cyan)" strokeWidth={1.6} strokeLinejoin="round" />
        <circle cx={sx(clampedQuery)} cy={sy(order(clampedQuery))} r={4} fill="var(--gold)" stroke="var(--ground)" strokeWidth={1.2} />
        <text x={sx(tmC)} y={M.t - 4} textAnchor="middle" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">T{'ₘ'} {tmC}°C</text>
        <text x={M.l} y={M.t + 8} fill="var(--faint)" fontSize={9} fontFamily="var(--sans)">gel</text>
        <text x={W - M.r} y={H - M.b - 4} textAnchor="end" fill="var(--faint)" fontSize={9} fontFamily="var(--sans)">fluid</text>
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fill="var(--faint)" fontSize={9} fontFamily="var(--sans)">temperature (°C)</text>
      </svg>
      <p className="note" style={{ marginTop: 4 }}>
        Only T<sub>m</sub> is computed (heuristic, from chain length/unsaturation — not
        independently validated per species). The curve's width and shape are illustrative,
        showing what a transition looks like, not a measured cooperativity.
      </p>
    </div>
  )
}
