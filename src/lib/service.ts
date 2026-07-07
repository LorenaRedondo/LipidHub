// ── LIPIDEX service layer ──────────────────────────────────────────────────
// Pure query/record functions over the model. Shared by the REST API and the
// MCP server so agents and HTTP clients return identical records.

import {
  CLASSES, FORMATE, dMaxOf, NH4, PROTON, fmtObj, formulaParts, findClass, headgroupCharge,
  membraneBiophysics, pmcSearchUrl, prefersAmmonium, props, status, synth,
  type Group, type Kingdom, type LipidClass, type Membrane,
} from './lipids'
import { toSmiles } from './smiles'

export interface SpeciesRecord {
  id: string
  shorthand: string
  class: { k: string; name: string; group: Group; category: string; kingdoms: Kingdom[]; occurrence: string }
  composition: { carbons: number; doubleBonds: number }
  formula: string
  exactMass: number
  adducts: Record<string, number>
  properties: { ccs: number; rt: number; logP: number; tm: number | null; note: string }
  synthesizability: { biosynthetic: number; chemicalScore: number; saScore: number; note?: string }
  membrane: Membrane | null
  headgroupCharge: string
  origin: 'curated' | 'in_silico'
  isGap: boolean
  smiles: string | null
  msmsHeadgroup: { label: string; mz: number | null }
  literatureSearch: string
  /** Real enzyme/reaction links, live-discovered from UniProt/Rhea (#5). Server-only — absent client-side. */
  pathway?: { enzymeUniprot: string; gene?: string; proteinName?: string; rheaRxn: string; equation?: string }[]
}

export function formulaString(cls: LipidClass, c: number, d: number): string {
  return formulaParts(fmtObj(cls, c, d)).map((p) => p.el + (p.n > 1 ? p.n : '')).join('')
}

export function parseId(id: string): { cls: LipidClass; c: number; d: number } | null {
  const m = id.trim().match(/^([A-Za-z]+)[- ]?(\d{1,2})[:\-](\d{1,2})$/)
  if (!m) return null
  const cls = findClass(m[1])
  if (!cls) return null
  const c = +m[2], d = +m[3]
  if (c < cls.cRange[0] || c > cls.cRange[1] || d > dMaxOf(cls)) return null
  return { cls, c, d }
}

export function buildRecord(cls: LipidClass, c: number, d: number): SpeciesRecord {
  const p = props(cls, c, d)
  const sy = synth(cls, c, d)
  const st = status(cls, c, d)
  const ammon = prefersAmmonium(cls)
  return {
    id: `${cls.k}-${c}-${d}`,
    shorthand: `${cls.k} ${c}:${d}`,
    class: { k: cls.k, name: cls.name, group: cls.group, category: cls.category, kingdoms: cls.kingdoms, occurrence: cls.occurrence },
    composition: { carbons: c, doubleBonds: d },
    formula: formulaString(cls, c, d),
    exactMass: round4(p.M),
    adducts: {
      '[M+H]+': round4(p.M + PROTON),
      '[M-H]-': round4(p.M - PROTON),
      [ammon ? '[M+NH4]+' : '[M+HCOO]-']: round4(ammon ? p.M + NH4 : p.M + FORMATE),
    },
    properties: { ccs: p.ccs, rt: p.rt, logP: p.logp, tm: p.tm, note: 'CCS/RT/Tm are heuristic placeholders (see issue #3); mass/formula are exact.' },
    synthesizability: { biosynthetic: sy.bio, chemicalScore: sy.chem, saScore: sy.sa },
    membrane: membraneBiophysics(cls, c, d),
    headgroupCharge: headgroupCharge(cls),
    origin: st === 'known' ? 'curated' : 'in_silico',
    isGap: st !== 'known',
    smiles: toSmiles(cls, c, d),
    msmsHeadgroup: { label: cls.hgFrag.lab, mz: cls.hgFrag.mz },
    literatureSearch: pmcSearchUrl(cls),
  }
}

export function getSpecies(id: string): SpeciesRecord | null {
  const parsed = parseId(id)
  return parsed ? buildRecord(parsed.cls, parsed.c, parsed.d) : null
}

export function listClasses() {
  return CLASSES.map((c) => ({
    k: c.k, name: c.name, group: c.group, category: c.category, chains: c.n,
    kingdoms: c.kingdoms, occurrence: c.occurrence, carbonRange: c.cRange, preferredAdduct: c.pref,
  }))
}

export interface SearchParams {
  q?: string
  classK?: string
  group?: string
  kingdom?: string
  massMin?: number
  massMax?: number
  carbonsMin?: number
  carbonsMax?: number
  dbMin?: number
  dbMax?: number
  origin?: 'curated' | 'in_silico'
  minBiosynthetic?: number
  maxSaScore?: number
  includeRare?: boolean
  page?: number
  pageSize?: number
}

/** Enumerate + filter the space. Returns lightweight rows plus a total count. */
export function search(params: SearchParams) {
  const q = params.q?.trim().toLowerCase()
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50))
  const hits: SpeciesRecord[] = []

  for (const cls of CLASSES) {
    if (params.classK && cls.k.toLowerCase() !== params.classK.toLowerCase()) continue
    if (params.group && cls.group !== params.group) continue
    if (params.kingdom && !cls.kingdoms.includes(params.kingdom as Kingdom)) continue
    const [lo, hi] = cls.cRange
    for (let c = lo; c <= hi; c++) {
      if (params.carbonsMin != null && c < params.carbonsMin) continue
      if (params.carbonsMax != null && c > params.carbonsMax) continue
      for (let d = 0; d <= dMaxOf(cls); d++) {
        if (params.dbMin != null && d < params.dbMin) continue
        if (params.dbMax != null && d > params.dbMax) continue
        const st = status(cls, c, d)
        if (st === 'rare' && !params.includeRare) continue
        const rec = buildRecord(cls, c, d)
        if (params.origin && rec.origin !== params.origin) continue
        if (params.massMin != null && rec.exactMass < params.massMin) continue
        if (params.massMax != null && rec.exactMass > params.massMax) continue
        if (params.minBiosynthetic != null && rec.synthesizability.biosynthetic < params.minBiosynthetic) continue
        if (params.maxSaScore != null && rec.synthesizability.saScore > params.maxSaScore) continue
        if (q && !(`${cls.k} ${c}:${d}`.toLowerCase().includes(q) || cls.name.toLowerCase().includes(q) || rec.formula.toLowerCase() === q)) continue
        hits.push(rec)
      }
    }
  }
  hits.sort((a, b) => a.exactMass - b.exactMass)
  const start = (page - 1) * pageSize
  return { total: hits.length, page, pageSize, results: hits.slice(start, start + pageSize) }
}

/** Species near a target m/z within a tolerance (ppm) — for MS feature identification. */
export function identifyByMz(mz: number, ppm = 10, adduct = '[M+H]+') {
  const tol = (mz * ppm) / 1e6
  const out: { record: SpeciesRecord; adduct: string; adductMz: number; errorPpm: number }[] = []
  for (const cls of CLASSES) {
    const [lo, hi] = cls.cRange
    for (let c = lo; c <= hi; c++) {
      for (let d = 0; d <= dMaxOf(cls); d++) {
        if (status(cls, c, d) === 'rare') continue
        const rec = buildRecord(cls, c, d)
        const am = rec.adducts[adduct]
        if (am == null) continue
        if (Math.abs(am - mz) <= tol) out.push({ record: rec, adduct, adductMz: am, errorPpm: round4(((am - mz) / mz) * 1e6) })
      }
    }
  }
  return out.sort((a, b) => Math.abs(a.errorPpm) - Math.abs(b.errorPpm)).slice(0, 25)
}

export function compare(ids: string[]): SpeciesRecord[] {
  return ids.map(getSpecies).filter((r): r is SpeciesRecord => r != null)
}

export function findGaps(clsK?: string, limit = 50): SpeciesRecord[] {
  return search({ origin: 'in_silico', classK: clsK, pageSize: Math.min(200, limit) }).results
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4
