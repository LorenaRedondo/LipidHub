import dopcDppcChol from '../data/phaseDiagrams/dopcDppcChol.json'

export interface TieLine { tempC: number; xLa: number; yLa: number; xLo: number; yLo: number }

export interface PhaseDiagramDef {
  system: { lowMelt: string; highMelt: string; sterol: string }
  xLabel: string
  yLabel: string
  tempRangeC: [number, number]
  citation: string
  originalSource: string
  note: string
  tieLines: TieLine[]
}

const DIAGRAMS: PhaseDiagramDef[] = [dopcDppcChol as PhaseDiagramDef]

export interface PinnedSpecies { clsK: string; c: number; d: number }
const speciesKey = (p: PinnedSpecies) => `${p.clsK}-${p.c}-${p.d}`

export function matchPhaseDiagram(pinned: PinnedSpecies[]): PhaseDiagramDef | null {
  if (pinned.length !== 3) return null
  const keys = pinned.map(speciesKey)
  return DIAGRAMS.find((d) => {
    const want = [d.system.lowMelt, d.system.highMelt, d.system.sterol]
    return want.every((w) => keys.includes(w)) && keys.every((k) => want.includes(k))
  }) ?? null
}

export type Phase = 'Lα' | 'Lo' | 'Lα+Lo'

export interface PhaseResult {
  phase: Phase
  nearestTempC: number
  outOfRange: boolean
}

type Pt = [number, number]

function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    const crosses = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function distToPolyline(p: Pt, pts: Pt[]): number {
  if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1])
  let min = Infinity
  for (let i = 0; i < pts.length - 1; i++) min = Math.min(min, distToSegment(p, pts[i], pts[i + 1]))
  return min
}

/**
 * First-order approximation: snaps to the nearest tabulated temperature (2.5°C steps in
 * the source table) rather than interpolating tie-lines across temperature — the tie-line
 * count varies per temperature (2-4), so there's no well-defined vertex correspondence to
 * interpolate between. The two-phase region at that temperature is approximated as the
 * polygon traced by the Lα-side tie-line endpoints, then back along the Lo-side endpoints
 * (each tie-line directly pairs one endpoint of each). Points outside the polygon are
 * classified by which boundary curve they're nearer to.
 */
export function classifyPhase(diagram: PhaseDiagramDef, x: number, y: number, tempC: number): PhaseResult {
  const [loT, hiT] = diagram.tempRangeC
  const outOfRange = tempC < loT || tempC > hiT
  const clampedT = Math.max(loT, Math.min(hiT, tempC))
  const temps = Array.from(new Set(diagram.tieLines.map((t) => t.tempC))).sort((a, b) => a - b)
  const nearestTempC = temps.reduce((best, t) => (Math.abs(t - clampedT) < Math.abs(best - clampedT) ? t : best), temps[0])

  const rows = diagram.tieLines.filter((t) => t.tempC === nearestTempC).sort((a, b) => a.xLa - b.xLa)
  const laCurve: Pt[] = rows.map((r) => [r.xLa, r.yLa])
  const loCurve: Pt[] = rows.map((r) => [r.xLo, r.yLo])
  const polygon: Pt[] = [...laCurve, ...[...loCurve].reverse()]

  const pt: Pt = [x, y]
  if (polygon.length >= 3 && pointInPolygon(pt, polygon)) return { phase: 'Lα+Lo', nearestTempC, outOfRange }
  const phase: Phase = distToPolyline(pt, laCurve) <= distToPolyline(pt, loCurve) ? 'Lα' : 'Lo'
  return { phase, nearestTempC, outOfRange }
}
