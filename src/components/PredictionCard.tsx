import { usePredictions, predictionFor } from '../lib/predictions'
import type { LipidClass } from '../lib/lipids'

/**
 * ML property predictions with calibrated uncertainty (from ml/train.py), plus a
 * CCS-vs-chain-length trend plot with a 90% conformal band and the current species marked.
 */
export default function PredictionCard({ cls, c, d }: { cls: LipidClass; c: number; d: number }) {
  const file = usePredictions()
  const id = `${cls.k}-${c}-${d}`
  const pred = predictionFor(file, id)
  if (!file || !pred) return null

  // trend: CCS vs carbon number at the current double-bond count
  const pts = [] as { c: number; v: number; lo: number; hi: number }[]
  for (let cc = cls.cRange[0]; cc <= cls.cRange[1]; cc++) {
    const p = file.predictions[`${cls.k}-${cc}-${d}`]
    if (p) pts.push({ c: cc, v: p.ccs.v, lo: p.ccs.lo, hi: p.ccs.hi })
  }

  const W = 380, H = 150, M = { l: 44, r: 12, t: 12, b: 28 }
  const xs = pts.map((p) => p.c), ys = pts.flatMap((p) => [p.lo, p.hi])
  const xmin = Math.min(...xs), xmax = Math.max(...xs)
  const ymin = Math.min(...ys), ymax = Math.max(...ys)
  const sx = (v: number) => M.l + ((v - xmin) / (xmax - xmin || 1)) * (W - M.l - M.r)
  const sy = (v: number) => H - M.b - ((v - ymin) / (ymax - ymin || 1)) * (H - M.t - M.b)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.c).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ')
  const band = pts.map((p) => `${sx(p.c).toFixed(1)},${sy(p.hi).toFixed(1)}`).join(' ') + ' ' +
    pts.slice().reverse().map((p) => `${sx(p.c).toFixed(1)},${sy(p.lo).toFixed(1)}`).join(' ')

  return (
    <div className="sp-card">
      <h3>Predicted properties <span className="pred-model">{file.model_version}</span></h3>
      <div className="kv">
        <div className="k">CCS <span className="conf pred">pred</span></div>
        <div className="v">{pred.ccs.v} <span className="u">Å²</span> <span className="ci">[{pred.ccs.lo}–{pred.ccs.hi}]</span></div>
        <div className="k">RT <span className="conf pred">pred</span></div>
        <div className="v">{pred.rt.v} <span className="u">min</span> <span className="ci">[{pred.rt.lo}–{pred.rt.hi}]</span></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="predicted CCS vs chain length" style={{ marginTop: 6 }}>
        <polygon points={band} fill="var(--cyan)" fillOpacity={0.14} />
        <path d={line} fill="none" stroke="var(--cyan)" strokeWidth={1.6} />
        <circle cx={sx(c)} cy={sy(pred.ccs.v)} r={4} fill="var(--amber)" stroke="#0b1418" strokeWidth={1.2} />
        {[ymin, (ymin + ymax) / 2, ymax].map((t, i) => (
          <text key={i} x={M.l - 6} y={sy(t) + 3} textAnchor="end" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">{Math.round(t)}</text>
        ))}
        <text x={sx(c)} y={sy(pred.ccs.v) - 8} textAnchor="middle" fill="var(--amber)" fontSize={9} fontFamily="var(--mono)">{cls.k} {c}:{d}</text>
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">carbons →  ·  CCS Å² (90% band)</text>
      </svg>
    </div>
  )
}
