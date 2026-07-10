/**
 * Force-vs-indentation curve, the primary data product of AFM force spectroscopy on a
 * supported lipid bilayer: the tip presses in (elastic ramp), then punches through at the
 * breakthrough force (sharp jump-through), then contacts the underlying support.
 *
 * Only the marked breakthrough point is real (Fb, from membraneBiophysics() — Tanford/
 * Israelachvili packing-parameter theory, same formula the breakthrough-vs-chain-length
 * Analytics trend cites against Garcia-Manyes/Oncins/Sanz AFM nanoindentation literature).
 * The curve *shape* is illustrative: we don't have a real indentation-depth (nm) formula to
 * plot against, or the tip-geometry/contact-mechanics assumptions needed to derive one from
 * Kᴀ — so the x-axis is deliberately unitless ("relative indentation"), not a fabricated nm
 * scale. This shows what the measurement looks like, not a physics simulation of it.
 */
export default function AfmForceCurve({ breakthroughNn }: { breakthroughNn: number }) {
  const W = 380, H = 150, M = { l: 44, r: 12, t: 12, b: 28 }
  const ymax = breakthroughNn * 1.25
  const sx = (v: number) => M.l + v * (W - M.l - M.r)
  const sy = (v: number) => H - M.b - (v / ymax) * (H - M.t - M.b)

  const xBreak = 0.82 // illustrative — where the jump-through happens along the ramp
  const yPostRupture = breakthroughNn * 0.25 // illustrative — force drop on punch-through
  const yEnd = breakthroughNn * 0.42 // illustrative — rising again on the underlying support

  const path = [
    `M ${sx(0).toFixed(1)} ${sy(0).toFixed(1)}`,
    `L ${sx(xBreak).toFixed(1)} ${sy(breakthroughNn).toFixed(1)}`, // elastic ramp
    `L ${sx(xBreak).toFixed(1)} ${sy(yPostRupture).toFixed(1)}`, // jump-through
    `L ${sx(1).toFixed(1)} ${sy(yEnd).toFixed(1)}`, // tip on substrate
  ].join(' ')

  return (
    <div className="sp-card">
      <h3>AFM force curve <span className="pred-model">illustrative shape</span></h3>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="simulated AFM force-indentation curve" style={{ marginTop: 6 }}>
        <path d={path} fill="none" stroke="var(--cyan)" strokeWidth={1.6} strokeLinejoin="round" />
        <circle cx={sx(xBreak)} cy={sy(breakthroughNn)} r={4} fill="var(--gold)" stroke="var(--ground)" strokeWidth={1.2} />
        {[0, ymax / 2, ymax].map((t, i) => (
          <text key={i} x={M.l - 6} y={sy(t) + 3} textAnchor="end" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">{t.toFixed(1)}</text>
        ))}
        <text x={sx(xBreak) + 6} y={sy(breakthroughNn) - 6} fill="var(--gold)" fontSize={9} fontFamily="var(--mono)">Fb {breakthroughNn} nN</text>
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" fill="var(--faint)" fontSize={9} fontFamily="var(--sans)">relative indentation →  ·  force (nN)</text>
      </svg>
      <p className="note" style={{ marginTop: 4 }}>
        Only the marked breakthrough point is real (computed). The ramp/jump-through/recovery
        shape illustrates what AFM force spectroscopy measures — it isn't a contact-mechanics
        simulation, we don't have a real indentation-depth scale to plot against.
      </p>
    </div>
  )
}
