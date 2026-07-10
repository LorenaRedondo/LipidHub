import { useState } from 'react'
import { classifyPhase, type PhaseDiagramDef } from '../lib/phaseDiagram'

export default function PhaseDiagramCard({ diagram, x, y }: { diagram: PhaseDiagramDef; x: number; y: number }) {
  const [tempC, setTempC] = useState((diagram.tempRangeC[0] + diagram.tempRangeC[1]) / 2)
  const result = classifyPhase(diagram, x, y, tempC)
  const rows = diagram.tieLines.filter((t) => t.tempC === result.nearestTempC).sort((a, b) => a.xLa - b.xLa)

  const W = 300, H = 220, M = { l: 34, r: 12, t: 12, b: 30 }
  const sx = (v: number) => M.l + v * (W - M.l - M.r)
  const sy = (v: number) => H - M.b - v * (H - M.t - M.b)
  const laPath = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${sx(r.xLa).toFixed(1)} ${sy(r.yLa).toFixed(1)}`).join(' ')
  const loPath = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${sx(r.xLo).toFixed(1)} ${sy(r.yLo).toFixed(1)}`).join(' ')

  return (
    <div className="sp-card">
      <h3>Phase diagram <span className="pred-model">digitized data, {diagram.tempRangeC[0]}–{diagram.tempRangeC[1]} °C</span></h3>
      <label className="rline" style={{ justifyContent: 'space-between' }}>
        <span>Temperature</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number" min={diagram.tempRangeC[0]} max={diagram.tempRangeC[1]} step={0.5} value={tempC}
            onChange={(e) => setTempC(Number(e.target.value))} className="one" style={{ width: 60 }}
          />
          <span className="an-sub">°C</span>
        </span>
      </label>
      {result.outOfRange && (
        <p className="note" style={{ marginTop: 4 }}>
          {tempC} °C is outside the tabulated range ({diagram.tempRangeC[0]}–{diagram.tempRangeC[1]} °C) — shown
          using the nearest boundary ({result.nearestTempC} °C) as a rough guide, not a real extrapolation.
        </p>
      )}
      <div className="kv" style={{ marginTop: 8 }}>
        <div className="k">Phase</div><div className="v">{result.phase}</div>
        <div className="k">Nearest tabulated T</div><div className="v">{result.nearestTempC} °C</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="phase boundary chart" style={{ marginTop: 8 }}>
        <path d={laPath} fill="none" stroke="var(--cyan)" strokeWidth={1.6} />
        <path d={loPath} fill="none" stroke="var(--alert)" strokeWidth={1.6} />
        {rows.map((r, i) => (
          <line key={i} x1={sx(r.xLa)} y1={sy(r.yLa)} x2={sx(r.xLo)} y2={sy(r.yLo)} stroke="var(--faint)" strokeWidth={0.6} strokeDasharray="2,2" />
        ))}
        <circle cx={sx(x)} cy={sy(y)} r={4} fill="var(--gold)" stroke="var(--ground)" strokeWidth={1.2} />
        <text x={sx(0)} y={12} fontSize={9} fill="var(--cyan)" fontFamily="var(--mono)">Lα boundary</text>
        <text x={sx(0)} y={24} fontSize={9} fill="var(--alert)" fontFamily="var(--mono)">Lo boundary</text>
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--faint)" fontFamily="var(--sans)">{diagram.xLabel}</text>
      </svg>
      <p className="note" style={{ marginTop: 4 }}>
        Boundaries digitized from {diagram.citation} (data originally from {diagram.originalSource}), using only
        tie-lines at the nearest tabulated temperature — a first-order approximation from sparse discrete points,
        not a fitted physical model. {diagram.note}
      </p>
    </div>
  )
}
