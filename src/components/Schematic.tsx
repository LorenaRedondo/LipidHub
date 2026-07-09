import type { LipidClass } from '../lib/lipids'

/** Cartoon of headgroup + acyl tails; double bonds shown as kinks. */
export default function Schematic({ cls, iso }: { cls: LipidClass; iso: [number, number][] }) {
  const w = 330
  const h = 112
  const cx = 52
  const cy = 54
  const startX = cx + 30
  const hasP = !!cls.bb?.P

  const tails = iso.map(([cN, dN], idx) => {
    const y = iso.length === 3 ? cy - 22 + idx * 22 : idx === 0 ? cy - 15 : cy + 15
    const len = Math.min(240, 30 + cN * 6.2)
    const seg = Math.max(6, cN)
    const dx = len / seg
    const kinks: number[] = []
    for (let q = 0; q < dN; q++) kinks.push(Math.floor((seg * (q + 1)) / (dN + 1)))
    let path = `M ${startX} ${y}`
    for (let i = 1; i <= seg; i++) {
      let yy = y + (i % 2 === 0 ? 0 : -5)
      if (kinks.indexOf(i) >= 0) yy = y - 9
      path += ` L ${startX + dx * i} ${yy}`
    }
    return { path, y, len, cN, dN, opacity: 0.55 + 0.45 * (1 - idx * 0.18) }
  })

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxHeight: 120 }}>
      <circle cx={cx} cy={cy} r={14} fill="rgba(78,203,198,.15)" stroke="var(--cyan)" strokeWidth={1.6} />
      <text x={cx} y={cy + 4} fill="var(--cyan)" fontSize={10} fontFamily="var(--mono)" textAnchor="middle">
        {cls.kind === 'sterolester' ? 'Chol' : cls.k.slice(0, 4)}
      </text>
      {hasP && (
        <>
          <circle cx={cx + 18} cy={cy} r={5.5} fill="var(--cyan)" opacity={0.8} />
          <text x={cx + 18} y={cy + 3} fill="var(--ground)" fontSize={7} textAnchor="middle" fontWeight={700}>P</text>
        </>
      )}
      {tails.map((t, i) => (
        <g key={i}>
          <path d={t.path} fill="none" stroke="var(--cyan)" strokeWidth={1.8} strokeLinejoin="round" opacity={t.opacity} />
          <text x={startX + t.len + 6} y={t.y + 3} fill="var(--faint)" fontSize={9} fontFamily="var(--mono)">
            {t.cN}:{t.dN}
          </text>
        </g>
      ))}
    </svg>
  )
}
