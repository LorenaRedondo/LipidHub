// ── Analytics: property correlations + clustering ─────────────────────────
// Builds a dataset of plausible species with their computed properties, then
// offers Pearson correlation and (seeded, deterministic) k-means clustering.
// All framework-free and pure.

import { CLASSES, PROTON, props, status, synth, type Group } from './lipids'

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
  logp: number
  tm: number | null
  carbons: number
  dbonds: number
  bio: number
  chem: number
}

/** Even-chain, plausible (non-rare) species across every class. */
export function buildDataset(): Point[] {
  const pts: Point[] = []
  for (const cls of CLASSES) {
    const [lo, hi] = cls.cRange
    for (let c = lo % 2 === 0 ? lo : lo + 1; c <= hi; c += 2) {
      for (let d = 0; d <= 6; d++) {
        if (status(cls, c, d) === 'rare') continue
        const p = props(cls, c, d)
        const sy = synth(cls, c, d)
        pts.push({
          id: `${cls.k}-${c}-${d}`, clsK: cls.k, group: cls.group, c, d,
          mass: p.M, mz: p.M + PROTON, ccs: p.ccs, rt: p.rt, logp: p.logp, tm: p.tm,
          carbons: c, dbonds: d, bio: sy.bio, chem: sy.chem,
        })
      }
    }
  }
  return pts
}

export type FeatureKey = 'mass' | 'mz' | 'ccs' | 'rt' | 'logp' | 'tm' | 'carbons' | 'dbonds' | 'bio' | 'chem'
export interface Feature { key: FeatureKey; label: string; short: string; get: (p: Point) => number | null }

export const FEATURES: Feature[] = [
  { key: 'mass', label: 'Exact mass (Da)', short: 'mass', get: (p) => p.mass },
  { key: 'mz', label: '[M+H]⁺ m/z', short: 'm/z', get: (p) => p.mz },
  { key: 'ccs', label: 'CCS (Å²)', short: 'CCS', get: (p) => p.ccs },
  { key: 'rt', label: 'RT (min)', short: 'RT', get: (p) => p.rt },
  { key: 'logp', label: 'logP', short: 'logP', get: (p) => p.logp },
  { key: 'tm', label: 'Tm (°C)', short: 'Tm', get: (p) => p.tm },
  { key: 'carbons', label: 'Acyl carbons', short: 'C', get: (p) => p.carbons },
  { key: 'dbonds', label: 'Double bonds', short: 'DB', get: (p) => p.dbonds },
  { key: 'bio', label: 'Biosynthetic score', short: 'bio', get: (p) => p.bio },
  { key: 'chem', label: 'Chemical synth.', short: 'chem', get: (p) => p.chem },
]
export const FEATURE_MAP = Object.fromEntries(FEATURES.map((f) => [f.key, f])) as Record<FeatureKey, Feature>

/** Features every point has (Tm is null for neutral lipids) — used for clustering. */
export const CLUSTER_FEATURES: FeatureKey[] = ['mass', 'ccs', 'rt', 'logp', 'carbons', 'dbonds', 'bio', 'chem']

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

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const dist2 = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d } return s }

/** Deterministic k-means (k-means++ init) on z-scored features. Returns per-point cluster ids. */
export function kmeans(points: Point[], featureKeys: FeatureKey[], k: number, seed = 42): number[] {
  const rows = points.map((p) => featureKeys.map((f) => FEATURE_MAP[f].get(p) as number))
  const nF = featureKeys.length
  const means = Array(nF).fill(0), sds = Array(nF).fill(0)
  for (const r of rows) for (let j = 0; j < nF; j++) means[j] += r[j]
  for (let j = 0; j < nF; j++) means[j] /= rows.length
  for (const r of rows) for (let j = 0; j < nF; j++) { const dx = r[j] - means[j]; sds[j] += dx * dx }
  for (let j = 0; j < nF; j++) sds[j] = Math.sqrt(sds[j] / rows.length) || 1
  const Z = rows.map((r) => r.map((v, j) => (v - means[j]) / sds[j]))

  const rand = mulberry32(seed)
  const centroids: number[][] = [Z[Math.floor(rand() * Z.length)].slice()]
  while (centroids.length < k) {
    const d2 = Z.map((z) => Math.min(...centroids.map((c) => dist2(z, c))))
    const sum = d2.reduce((a, b) => a + b, 0)
    let r = rand() * sum, idx = 0
    for (; idx < d2.length - 1; idx++) { r -= d2[idx]; if (r <= 0) break }
    centroids.push(Z[idx].slice())
  }

  const assign = new Array(Z.length).fill(0)
  for (let iter = 0; iter < 60; iter++) {
    let changed = false
    for (let i = 0; i < Z.length; i++) {
      let best = 0, bd = Infinity
      for (let cI = 0; cI < k; cI++) { const dd = dist2(Z[i], centroids[cI]); if (dd < bd) { bd = dd; best = cI } }
      if (assign[i] !== best) { assign[i] = best; changed = true }
    }
    const sums = Array.from({ length: k }, () => Array(nF).fill(0)), counts = Array(k).fill(0)
    for (let i = 0; i < Z.length; i++) { counts[assign[i]]++; for (let j = 0; j < nF; j++) sums[assign[i]][j] += Z[i][j] }
    for (let cI = 0; cI < k; cI++) if (counts[cI]) centroids[cI] = sums[cI].map((s) => s / counts[cI])
    if (!changed) break
  }
  return assign
}

export const GROUP_COLORS: Record<string, string> = {
  Glycerophospholipids: '#4ecbc6',
  Glycerolipids: '#f0a94b',
  Glycolipids: '#5fca8b',
  Sphingolipids: '#b98cff',
  'Sterol lipids': '#e8705a',
  'Fatty acyls': '#e6b34d',
}
export const CLUSTER_COLORS = ['#4ecbc6', '#f0a94b', '#5fca8b', '#b98cff', '#e8705a', '#e6b34d', '#6aa3ff', '#ff8fb0']
