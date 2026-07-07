import type { Method } from '../lib/lipids'

const TAGS: Record<Method, { label: string; title: string }> = {
  measured: { label: 'meas', title: 'Measured — from a real experiment or curated database entry.' },
  calculated: { label: 'calc', title: 'Calculated — computed exactly from the structure, not modelled.' },
  predicted: { label: 'pred', title: 'Predicted — a model estimate. Check its uncertainty interval before relying on it.' },
}

/** Small provenance badge: measured / calculated / predicted, with an explanatory tooltip. */
export default function ConfBadge({ m }: { m: Method }) {
  const t = TAGS[m]
  const cls = m === 'measured' ? 'meas' : m === 'calculated' ? 'calc' : 'pred'
  return <span className={`conf ${cls}`} title={t.title}>{t.label}</span>
}

/** Compact legend explaining the three provenance tiers — one definition, reused everywhere. */
export function ProvenanceLegend() {
  return (
    <div className="prov-legend">
      <span className="prov-legend-label">Provenance</span>
      <span><ConfBadge m="measured" /> real data</span>
      <span><ConfBadge m="calculated" /> exact, from structure</span>
      <span><ConfBadge m="predicted" /> model estimate</span>
    </div>
  )
}
