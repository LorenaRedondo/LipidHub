// ── Analytics: property correlations ───────────────────────────────────────
// Builds a dataset of plausible species with their computed properties (using
// the real trained-model CCS/RT predictions where available — same numbers the
// per-species Inspector shows — falling back to the composition formula only
// for species outside the model's coverage) and offers Pearson correlation.
// All framework-free and pure.

import { CLASSES, chainsOf, dMaxOf, PROTON, membraneBiophysics, props, status, synth, type Group } from './lipids'
import type { PredFile } from './predictions'

export interface Point {
  id: string
  clsK: string
  group: Group
  c: number
  d: number
  mass: number
  mz: number
  ccs: number
  rt: number
  predicted: boolean // true if ccs/rt came from the trained model, false if from the composition formula
  logp: number
  tm: number | null
  carbons: number
  carbonsPerChain: number | null // acyl-chain length normalized by chain count — the physically comparable unit across classes
  dbonds: number
  bio: number
  chem: number
  thickness: number | null
  breakthrough: number | null
  packing: number | null
}

/** Even-chain, plausible (non-rare) species across every class. */
export function buildDataset(pred?: PredFile | null): Point[] {
  const pts: Point[] = []
  for (const cls of CLASSES) {
    const [lo, hi] = cls.cRange
    const chains = chainsOf(cls)
    for (let c = lo % 2 === 0 ? lo : lo + 1; c <= hi; c += 2) {
      for (let d = 0; d <= dMaxOf(cls); d++) {
        if (status(cls, c, d) === 'rare') continue
        const id = `${cls.k}-${c}-${d}`
        const p = props(cls, c, d)
        const sy = synth(cls, c, d)
        const mem = membraneBiophysics(cls, c, d)
        const ml = pred?.predictions[id]
        pts.push({
          id, clsK: cls.k, group: cls.group, c, d,
          mass: p.M, mz: p.M + PROTON,
          ccs: ml?.ccs.v ?? p.ccs, rt: ml?.rt.v ?? p.rt, predicted: ml != null,
          logp: p.logp, tm: p.tm,
          carbons: c, carbonsPerChain: chains > 0 ? Math.round((c / chains) * 100) / 100 : null, dbonds: d,
          bio: sy.bio, chem: sy.chem,
          thickness: mem?.thicknessNm ?? null, breakthrough: mem?.breakthroughNn ?? null, packing: mem?.packing ?? null,
        })
      }
    }
  }
  return pts
}

export type FeatureKey = 'mass' | 'mz' | 'ccs' | 'rt' | 'logp' | 'tm' | 'carbons' | 'carbonsPerChain' | 'dbonds' | 'bio' | 'chem' | 'thickness' | 'breakthrough' | 'packing'
export interface Feature { key: FeatureKey; label: string; short: string; get: (p: Point) => number | null }

export const FEATURES: Feature[] = [
  { key: 'mass', label: 'Exact mass (Da)', short: 'mass', get: (p) => p.mass },
  { key: 'mz', label: '[M+H]⁺ m/z', short: 'm/z', get: (p) => p.mz },
  { key: 'ccs', label: 'CCS (Å²)', short: 'CCS', get: (p) => p.ccs },
  { key: 'rt', label: 'RT (min)', short: 'RT', get: (p) => p.rt },
  { key: 'logp', label: 'logP', short: 'logP', get: (p) => p.logp },
  { key: 'tm', label: 'Tm (°C)', short: 'Tm', get: (p) => p.tm },
  { key: 'carbons', label: 'Acyl carbons (total)', short: 'C', get: (p) => p.carbons },
  { key: 'carbonsPerChain', label: 'Carbons per chain', short: 'C/chain', get: (p) => p.carbonsPerChain },
  { key: 'dbonds', label: 'Double bonds', short: 'DB', get: (p) => p.dbonds },
  { key: 'bio', label: 'Biosynthetic score', short: 'bio', get: (p) => p.bio },
  { key: 'chem', label: 'Chemical synth.', short: 'chem', get: (p) => p.chem },
  { key: 'thickness', label: 'Bilayer thickness (nm)', short: 'thick', get: (p) => p.thickness },
  { key: 'breakthrough', label: 'Breakthrough force (nN)', short: 'Fb', get: (p) => p.breakthrough },
  { key: 'packing', label: 'Packing parameter', short: 'pack', get: (p) => p.packing },
]
export const FEATURE_MAP = Object.fromEntries(FEATURES.map((f) => [f.key, f])) as Record<FeatureKey, Feature>

export function pearson(a: number[], b: number[]): number {
  const n = a.length
  if (n < 2) return 0
  let ma = 0, mb = 0
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i] }
  ma /= n; mb /= n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y }
  return da && db ? num / Math.sqrt(da * db) : 0
}

/** Pearson r for a feature pair over complete cases (both non-null). */
export function correlate(points: Point[], fx: FeatureKey, fy: FeatureKey): number {
  const xs: number[] = [], ys: number[] = []
  for (const p of points) {
    const x = FEATURE_MAP[fx].get(p), y = FEATURE_MAP[fy].get(p)
    if (x != null && y != null) { xs.push(x); ys.push(y) }
  }
  return pearson(xs, ys)
}

// ── Theoretically-motivated trend curves ────────────────────────────────────
// A fitted line is only ever drawn for a pair with a real physical/established
// basis — otherwise the scatter shows points + Pearson r and nothing else, so
// we never imply a model that isn't there. Two curated relationships:
//
//  - CCS vs mass: Mason–Schamp mobility scaling, CCS ∝ mass^0.635 — the same
//    fixed exponent ml/features.py calibrates its baseline against (α is a
//    literature constant, not fit per-plot; only the scale factor is fit here).
//  - thickness vs carbonsPerChain: Tanford's hydrocarbon-chain-length rule
//    (lc = 1.5 + 1.265·nc), which membraneBiophysics() already implements —
//    linear once carbons are normalized per chain, which is why this pair
//    uses `carbonsPerChain` rather than raw `carbons` (raw carbons conflates
//    1-, 2-, 3- and 4-chain classes into separate parallel bands).
export interface Trend {
  x: FeatureKey // the curve's natural independent axis
  y: FeatureKey // the curve's natural dependent axis
  reason: string
  fit: (xs: number[], ys: number[]) => (x: number) => number
}

const CCS_MASS_EXPONENT = 0.635 // matches ml/features.py — literature range ~0.6–0.7

function fitPowerFixedExponent(xs: number[], ys: number[], alpha: number): (x: number) => number {
  // y = scale * x^alpha ⇒ fit scale by least squares on y / x^alpha (single free parameter)
  let num = 0, den = 0
  for (let i = 0; i < xs.length; i++) { const xa = Math.pow(xs[i], alpha); num += xa * ys[i]; den += xa * xa }
  const scale = den ? num / den : 0
  return (x) => scale * Math.pow(x, alpha)
}

function fitLinear(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  let mx = 0, my = 0
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i] }
  mx /= n; my /= n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx }
  const slope = den ? num / den : 0, intercept = my - slope * mx
  return (x) => slope * x + intercept
}

const TRENDS: Trend[] = [
  { x: 'mass', y: 'ccs', reason: 'Mason–Schamp: CCS ∝ mass^0.635 (fixed exponent, scale fit here)', fit: (xs, ys) => fitPowerFixedExponent(xs, ys, CCS_MASS_EXPONENT) },
  { x: 'carbonsPerChain', y: 'thickness', reason: "Tanford's rule: bilayer half-thickness ∝ chain length", fit: fitLinear },
]

/** A curve is only offered for the pair actually being plotted (either axis order). */
export function trendFor(fx: FeatureKey, fy: FeatureKey): Trend | null {
  return TRENDS.find((t) => (t.x === fx && t.y === fy) || (t.x === fy && t.y === fx)) ?? null
}

export const GROUP_COLORS: Record<string, string> = {
  Glycerophospholipids: '#4ecbc6',
  Glycerolipids: '#f0a94b',
  Glycolipids: '#5fca8b',
  Sphingolipids: '#b98cff',
  'Sterol lipids': '#e8705a',
  'Fatty acyls': '#e6b34d',
}
