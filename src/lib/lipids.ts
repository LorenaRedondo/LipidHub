// ── LIPIDEX data model ────────────────────────────────────────────────────
// Pure, framework-free chemistry + property inference. Every formula/mass is
// computed exactly from composition; CCS/RT/logP/Tm/synthesizability are
// clearly-labelled heuristic model outputs pending the real pipelines (see
// docs/architecture.md and GitHub issues #3, #4).

export type Elem = 'C' | 'H' | 'O' | 'N' | 'P'
export type Formula = Record<Elem, number>
export type Kind = 'glycero' | 'sphingo' | 'sterolester'
export type SubHead = 'SM' | 'Hex'
export type Persona = 'analyst' | 'biophys' | 'chem' | 'bioinfo'
export type Status = 'known' | 'gap' | 'rare'
export type Method = 'measured' | 'calculated' | 'predicted'

export interface LipidClass {
  k: string
  name: string
  cat: string
  kind?: Kind
  bb?: Partial<Formula> // deacylated backbone (glycero classes only)
  n: number // acyl chain count
  cRange: [number, number]
  mid?: number
  pref: string // preferred ionization adduct
  lpOff: number // logP headgroup offset
  hasTm: boolean
  xlabel?: string
  subhg?: SubHead
  enz: string[]
  rhea: string
  pw: string
  hgFrag: { lab: string; mz: number | null }
}

export const MASS: Record<Elem, number> = {
  C: 12,
  H: 1.0078250319,
  O: 15.9949146221,
  N: 14.0030740052,
  P: 30.97376151,
}
export const PROTON = 1.0072764
export const NH4 = 18.0338254
export const FORMATE = 44.9982
export const GRID_D = 6

export const CLASSES: LipidClass[] = [
  { k: 'PC', name: 'Phosphatidylcholine', cat: 'Glycerophospholipid', bb: { C: 8, H: 20, O: 6, N: 1, P: 1 }, n: 2,
    cRange: [26, 46], pref: '[M+H]⁺', lpOff: 8.0, hasTm: true,
    enz: ['LPCAT1', 'CHKA', 'PCYT1A'], rhea: 'RHEA:12937', pw: 'Kennedy pathway (CDP-choline); remodelled by Lands cycle acyltransferases.',
    hgFrag: { lab: 'phosphocholine (+)', mz: 184.0733 } },
  { k: 'PE', name: 'Phosphatidylethanolamine', cat: 'Glycerophospholipid', bb: { C: 5, H: 14, O: 6, N: 1, P: 1 }, n: 2,
    cRange: [26, 46], pref: '[M-H]⁻', lpOff: 7.4, hasTm: true,
    enz: ['EPT1', 'PCYT2', 'PISD'], rhea: 'RHEA:32943', pw: 'CDP-ethanolamine pathway; also PS decarboxylation (PISD) in mitochondria.',
    hgFrag: { lab: 'neutral loss 141 (−)', mz: 141.0191 } },
  { k: 'PS', name: 'Phosphatidylserine', cat: 'Glycerophospholipid', bb: { C: 6, H: 14, O: 8, N: 1, P: 1 }, n: 2,
    cRange: [28, 46], pref: '[M-H]⁻', lpOff: 7.7, hasTm: true,
    enz: ['PTDSS1', 'PTDSS2'], rhea: 'RHEA:45088', pw: 'Base-exchange from PC/PE by PS synthases at ER–mito contact sites.',
    hgFrag: { lab: 'neutral loss 87 (−)', mz: 87.0320 } },
  { k: 'PG', name: 'Phosphatidylglycerol', cat: 'Glycerophospholipid', bb: { C: 6, H: 15, O: 8, N: 0, P: 1 }, n: 2,
    cRange: [28, 44], pref: '[M-H]⁻', lpOff: 7.0, hasTm: true,
    enz: ['PGS1', 'PTPMT1'], rhea: 'RHEA:33203', pw: 'PGP synthase → dephosphorylation; precursor to cardiolipin.',
    hgFrag: { lab: 'glycerophosphate (−)', mz: 152.9958 } },
  { k: 'PI', name: 'Phosphatidylinositol', cat: 'Glycerophospholipid', bb: { C: 9, H: 19, O: 11, N: 0, P: 1 }, n: 2,
    cRange: [30, 46], pref: '[M-H]⁻', lpOff: 7.9, hasTm: true,
    enz: ['CDIPT'], rhea: 'RHEA:11580', pw: 'PI synthase from CDP-DAG + myo-inositol; head of the phosphoinositide tree.',
    hgFrag: { lab: 'inositol phosphate (−)', mz: 241.0119 } },
  { k: 'PA', name: 'Phosphatidic acid', cat: 'Glycerophospholipid', bb: { C: 3, H: 9, O: 6, N: 0, P: 1 }, n: 2,
    cRange: [26, 44], pref: '[M-H]⁻', lpOff: 4.6, hasTm: true,
    enz: ['AGPAT1', 'LPIN1', 'DGKA'], rhea: 'RHEA:19709', pw: 'Central hub — de novo (AGPAT) and from DAG (DGK); branch point of all glycerolipids.',
    hgFrag: { lab: 'glycerophosphate (−)', mz: 152.9958 } },
  { k: 'DG', name: 'Diacylglycerol', cat: 'Glycerolipid', bb: { C: 3, H: 8, O: 3, N: 0, P: 0 }, n: 2,
    cRange: [26, 44], pref: '[M+NH₄]⁺', lpOff: 2.0, hasTm: false,
    enz: ['LPIN1', 'PLCG1'], rhea: 'RHEA:27562', pw: 'From PA (phosphatase) or PIP₂ (PLC); signalling lipid and TG/PL precursor.',
    hgFrag: { lab: '[M+H−RCOOH]⁺ (acyl loss)', mz: null } },
  { k: 'TG', name: 'Triacylglycerol', cat: 'Glycerolipid', bb: { C: 3, H: 8, O: 3, N: 0, P: 0 }, n: 3,
    cRange: [44, 60], pref: '[M+NH₄]⁺', lpOff: -4.0, hasTm: false,
    enz: ['DGAT1', 'DGAT2'], rhea: 'RHEA:10868', pw: 'Final esterification of DAG by DGAT; the storage-fat endpoint.',
    hgFrag: { lab: '[M+NH₄−RCOOH]⁺ (acyl loss)', mz: null } },

  { k: 'Cer', name: 'Ceramide', cat: 'Sphingolipid', kind: 'sphingo', n: 1, cRange: [32, 46], mid: 40,
    pref: '[M+H]⁺', lpOff: 10.5, hasTm: true, xlabel: 'Total carbons · d18 base + N-acyl',
    enz: ['CERS2', 'CERS5', 'DEGS1'], rhea: 'RHEA:53424', pw: 'De novo from serine + palmitoyl-CoA → dihydroceramide → DEGS desaturase; the hub of sphingolipid metabolism.',
    hgFrag: { lab: 'sphingoid base −H₂O (+)', mz: 264.2686 } },
  { k: 'SM', name: 'Sphingomyelin', cat: 'Sphingolipid', kind: 'sphingo', subhg: 'SM', n: 1, cRange: [32, 46], mid: 40,
    pref: '[M+H]⁺', lpOff: 11.5, hasTm: true, xlabel: 'Total carbons · d18 base + N-acyl',
    enz: ['SGMS1', 'SGMS2'], rhea: 'RHEA:18765', pw: 'SM synthase transfers phosphocholine from PC onto ceramide at the Golgi.',
    hgFrag: { lab: 'phosphocholine (+)', mz: 184.0733 } },
  { k: 'HexCer', name: 'Hexosylceramide', cat: 'Sphingolipid', kind: 'sphingo', subhg: 'Hex', n: 1, cRange: [32, 46], mid: 40,
    pref: '[M+H]⁺', lpOff: 11.0, hasTm: true, xlabel: 'Total carbons · d18 base + N-acyl',
    enz: ['UGCG', 'UGT8'], rhea: 'RHEA:12088', pw: 'Glucosyl/galactosylceramide synthase glycosylates ceramide; the entry to glycosphingolipids.',
    hgFrag: { lab: '−hexose (162) neutral loss (+)', mz: 162.0528 } },
  { k: 'CE', name: 'Cholesteryl ester', cat: 'Sterol lipid', kind: 'sterolester', n: 1, cRange: [12, 24], mid: 18,
    pref: '[M+NH₄]⁺', lpOff: -6.0, hasTm: false, xlabel: 'N-acyl carbons · cholesterol fixed',
    enz: ['SOAT1', 'LCAT'], rhea: 'RHEA:35807', pw: "ACAT/SOAT (cells) or LCAT (plasma) esterifies cholesterol's 3-OH; the storage/transport form of sterol.",
    hgFrag: { lab: 'cholestene fragment (+)', mz: 369.3516 } },
]

// ── chemistry ──────────────────────────────────────────────────────────────

/** Molecular formula from sum composition (total acyl carbons c, double bonds d). */
export function fmtObj(cls: LipidClass, c: number, d: number): Formula {
  const kind = cls.kind ?? 'glycero'
  if (kind === 'sphingo') {
    // c = total carbons (d18 sphingoid base + N-acyl); ceramide core validated
    // Cer d18:1/16:0 = C34H67NO3 (537.5121).
    const f: Formula = { C: c, H: 1 + 2 * c - 2 * d, O: 3, N: 1, P: 0 }
    if (cls.subhg === 'SM') { f.C += 5; f.H += 12; f.N += 1; f.O += 3; f.P += 1 }
    else if (cls.subhg === 'Hex') { f.C += 6; f.H += 10; f.O += 5 }
    return f
  }
  if (kind === 'sterolester') {
    // c = N-acyl carbons; cholesterol backbone fixed at C27 (CE 18:1 = C45H78O2).
    return { C: 27 + c, H: 44 + 2 * c - 2 * d, O: 2, N: 0, P: 0 }
  }
  const b = cls.bb!
  const n = cls.n
  return {
    C: (b.C ?? 0) + c,
    H: (b.H ?? 0) + 2 * c - 2 * d - 2 * n,
    O: (b.O ?? 0) + n,
    N: b.N ?? 0,
    P: b.P ?? 0,
  }
}

export function mass(f: Formula): number {
  let m = 0
  for (const e in f) m += f[e as Elem] * MASS[e as Elem]
  return m
}

const ORDER: Elem[] = ['C', 'H', 'N', 'O', 'P']
/** Hill-order formula as HTML-safe segments for React (element + optional count). */
export function formulaParts(f: Formula): { el: string; n: number }[] {
  return ORDER.filter((e) => f[e] > 0).map((e) => ({ el: e, n: f[e] }))
}

// ── property inference ─────────────────────────────────────────────────────

/** Estimated biological likelihood 0..1 (drives cell opacity). */
export function likelihood(cls: LipidClass, c: number, d: number): number {
  let lik = 1
  if (c % 2 !== 0) lik -= 0.5 // odd-chain rare
  const [lo, hi] = cls.cRange
  const mid = cls.mid ?? (cls.n === 3 ? 52 : 35)
  lik -= Math.min(0.4, Math.abs(c - mid) / 40)
  if (d === 0) lik -= 0.08
  if (d > 3) lik -= (d - 3) * 0.14
  if (c < lo + 2 || c > hi - 2) lik -= 0.15
  return Math.max(0.08, Math.min(1, lik))
}

/** Rule-based curated/gap classification (placeholder until real LMSD diff, #1). */
export function status(cls: LipidClass, c: number, d: number): Status {
  const lik = likelihood(cls, c, d)
  const core = c % 2 === 0 && d <= 4 && c >= cls.cRange[0] + 4 && c <= cls.cRange[1] - 4
  if (core && lik >= 0.62) return 'known'
  if (lik >= 0.24) return 'gap'
  return 'rare'
}

export interface Props {
  f: Formula
  M: number
  ccs: number
  rt: number
  logp: number
  tm: number | null
}
export function props(cls: LipidClass, c: number, d: number): Props {
  const f = fmtObj(cls, c, d)
  const M = mass(f)
  return {
    f,
    M,
    ccs: Math.round((105 + 0.262 * M - 1.4 * d) * 10) / 10,
    rt: Math.max(0.4, Math.round((2.0 + 0.3 * c - 0.9 * d) * 10) / 10),
    logp: Math.round((0.52 * c - 0.6 * d - cls.lpOff) * 10) / 10,
    tm: cls.hasTm ? Math.round(3.0 * c - 55 - 25 * d) : null,
  }
}

export interface Synth { bio: number; sa: number; chem: number }
export function synth(cls: LipidClass, c: number, d: number): Synth {
  let bio = 90
  if (c % 2 !== 0) bio -= 45
  if (d > 4) bio -= (d - 4) * 14
  const perChain = c / cls.n
  if (perChain > 24) bio -= (perChain - 24) * 6
  if (perChain < 12) bio -= (12 - perChain) * 5
  bio = Math.max(4, Math.min(97, Math.round(bio)))
  let sa = 2.6 + d * 0.28 + (c % 2 !== 0 ? 0.4 : 0) + Math.max(0, perChain - 22) * 0.08
  sa = Math.round(Math.min(8.2, sa) * 10) / 10
  const chem = Math.round(Math.max(8, 100 - (sa - 2.6) * 15))
  return { bio, sa, chem }
}

/** Split sum composition into a plausible "most abundant" isomer for MS/MS. */
export function isomer(cls: LipidClass, c: number, d: number): [number, number][] {
  const kind = cls.kind ?? 'glycero'
  if (kind === 'sphingo') {
    const bDB = d >= 1 ? 1 : 0 // d18:1 sphingosine (or d18:0 dihydro)
    return [[18, bDB], [c - 18, d - bDB]]
  }
  if (kind === 'sterolester') return [[c, d]]
  if (cls.n === 2) {
    let c1 = 16
    let c2 = c - 16
    if (c2 < 12) { c1 = Math.floor(c / 2); c2 = c - c1 }
    return [[c1, 0], [c2, d]]
  }
  const a = 16
  const b = 18
  let cc = c - 34
  if (cc < 8) { cc = c - 32; return [[16, 0], [16, d > 0 ? 1 : 0], [cc, Math.max(0, d - (d > 0 ? 1 : 0))]] }
  return [[a, 0], [b, d > 0 ? 1 : 0], [cc, Math.max(0, d - (d > 0 ? 1 : 0))]]
}

/** [FA−H]⁻ fragment m/z for a fatty acyl of c carbons, d double bonds. */
export function faFragment(c: number, d: number): number {
  return c * MASS.C + (2 * c - 2 * d - 1) * MASS.H + 2 * MASS.O - PROTON
}

export const fam = (c: number, d: number) => `${c}:${d}`

export function findClass(k: string): LipidClass | undefined {
  return CLASSES.find((x) => x.k.toUpperCase() === k.toUpperCase())
}

export function headgroupCharge(cls: LipidClass): string {
  if (cls.k === 'PC' || cls.k === 'SM') return 'zwitterionic'
  if (cls.cat === 'Glycerolipid' || cls.cat === 'Sterol lipid' || cls.k === 'Cer' || cls.k === 'HexCer') return 'neutral'
  return 'anionic'
}
