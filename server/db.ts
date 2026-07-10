// ── LIPIVERSE SQLite-backed service adapter ─────────────────────────────────
// Server-only. Same exported names/shapes as src/lib/service.ts, backed by
// db/lipidex.sqlite (built with `npm run db:build`) instead of recomputing the
// full enumerated space on every request. The frontend never imports this —
// it keeps using src/lib/service.ts directly and computes client-side.
//
// This is the designed swap point for Postgres/Supabase later: port the SQL
// below to `pg`/`postgres.js`, keep every exported function signature
// identical, and server/api.ts + mcp/server.ts don't change at all.
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FORMATE, NH4, PROTON, dMaxOf, findClass, headgroupCharge,
  membraneBiophysics, pmcSearchUrl, prefersAmmonium,
  type Group, type Kingdom, type LipidClass,
} from '../src/lib/lipids'
import { toSmiles } from '../src/lib/smiles'
import type { SearchParams, SpeciesRecord } from '../src/lib/service'
import pathwayGraphData from '../src/data/pathwayGraph.json'

const PATHWAY_GRAPH = (pathwayGraphData as unknown as {
  classes: Record<string, { rheaId: string; equation?: string; enzymes: { accession: string; gene?: string; proteinName?: string }[] }>
}).classes

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.LIPIDEX_DB ?? path.join(HERE, '../db/lipidex.sqlite')

const db = new Database(DB_PATH, { fileMustExist: true })
db.pragma('journal_mode = WAL')

interface SpeciesRow {
  id: string; shorthand: string; class_code: string; n_carbon: number; n_dbond: number
  formula: string; exact_mass: number; origin: 'curated' | 'in_silico'; status: string
  display_group: Group; bio_score: number | null; bio_model_version: string | null
  chem_sascore: number | null; chem_model_version: string | null
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4
/** Mirrors the sa→chemicalScore derivation in src/lib/lipids.ts synth() — not persisted in schema.sql. */
const chemScoreFromSa = (sa: number) => Math.round(Math.max(8, 100 - (sa - 2.6) * 15))

function synthNote(row: SpeciesRow): string {
  const bio = row.bio_model_version === 'heuristic-v0' ? 'heuristic composition penalty' : `live UniProt/Rhea pathway verification (${row.bio_model_version})`
  const chem = row.chem_model_version === 'heuristic-v0' ? 'heuristic formula' : `RDKit SAScore (${row.chem_model_version})`
  return `Biosynthetic from ${bio}; chemical (SAScore) from ${chem}. Retrosynthesis route generation not yet implemented (issue #4).`
}

function propsNote(byKey: Record<string, { model_version: string | null }>): string {
  const ccs = byKey.ccs?.model_version === 'heuristic-v0' ? 'heuristic formula' : `real ML model (${byKey.ccs?.model_version}, see issue #33 for remaining scope)`
  const logp = byKey.logp?.model_version?.startsWith('rdkit-') ? `RDKit Crippen (${byKey.logp?.model_version})` : 'heuristic formula'
  return `CCS/RT from ${ccs}; logP from ${logp}; Tm is a heuristic placeholder (see issue #3). Mass/formula are exact.`
}

const propsForIdStmt = db.prepare(`SELECT key, value, model_version, ci_low, ci_high FROM property_best WHERE species_id = ?`)
const pathwayForIdStmt = db.prepare(`SELECT enzyme_uniprot, rhea_rxn FROM pathway WHERE species_id = ?`)

/** Real enzyme/reaction links for a species — the `pathway` table (#5), enzyme names resolved from pathwayGraph.json. */
export function getPathwayLinks(speciesId: string, classCode: string): NonNullable<SpeciesRecord['pathway']> {
  const rows = pathwayForIdStmt.all(speciesId) as { enzyme_uniprot: string; rhea_rxn: string }[]
  const classGraph = PATHWAY_GRAPH[classCode]
  return rows.map((r) => {
    const enz = classGraph?.enzymes.find((e) => e.accession === r.enzyme_uniprot)
    return { enzymeUniprot: r.enzyme_uniprot, gene: enz?.gene, proteinName: enz?.proteinName, rheaRxn: r.rhea_rxn, equation: classGraph?.equation }
  })
}

/** Assemble the full SpeciesRecord contract from a DB row + its property_best rows. */
function assembleRecord(row: SpeciesRow): SpeciesRecord {
  const cls = findClass(row.class_code) as LipidClass
  const c = row.n_carbon, d = row.n_dbond
  const propRows = propsForIdStmt.all(row.id) as { key: string; value: number; model_version: string | null; ci_low: number | null; ci_high: number | null }[]
  const byKey = Object.fromEntries(propRows.map((p) => [p.key, p]))
  const ammon = prefersAmmonium(cls)
  const M = row.exact_mass
  const pathway = getPathwayLinks(row.id, row.class_code)

  return {
    id: row.id,
    shorthand: row.shorthand,
    class: { k: cls.k, name: cls.name, group: cls.group, category: cls.category, kingdoms: cls.kingdoms, occurrence: cls.occurrence },
    composition: { carbons: c, doubleBonds: d },
    formula: row.formula,
    exactMass: M,
    adducts: {
      '[M+H]+': round4(M + PROTON),
      '[M-H]-': round4(M - PROTON),
      [ammon ? '[M+NH4]+' : '[M+HCOO]-']: round4(ammon ? M + NH4 : M + FORMATE),
    },
    properties: {
      ccs: byKey.ccs?.value ?? 0, rt: byKey.rt?.value ?? 0, logP: byKey.logp?.value ?? 0, tm: byKey.tm?.value ?? null,
      note: propsNote(byKey),
    },
    synthesizability: {
      biosynthetic: row.bio_score ?? 0, chemicalScore: row.chem_sascore != null ? chemScoreFromSa(row.chem_sascore) : 0, saScore: row.chem_sascore ?? 0,
      note: synthNote(row),
    },
    membrane: membraneBiophysics(cls, c, d),
    headgroupCharge: headgroupCharge(cls),
    origin: row.origin,
    isGap: row.status !== 'known',
    smiles: toSmiles(cls, c, d),
    msmsHeadgroup: { label: cls.hgFrag.lab, mz: cls.hgFrag.mz },
    literatureSearch: pmcSearchUrl(cls),
    pathway: pathway.length ? pathway : undefined,
  }
}

const SPECIES_COLUMNS = `
  s.id, s.shorthand, s.class_code, s.n_carbon, s.n_dbond, s.formula, s.exact_mass, s.origin, s.status,
  lc.display_group, sy.bio_score, sy.bio_model_version, sy.chem_sascore, sy.chem_model_version
`
const SPECIES_FROM = `FROM species s JOIN lipid_class lc ON lc.code = s.class_code LEFT JOIN synth sy ON sy.species_id = s.id`

const byIdStmt = db.prepare(`SELECT ${SPECIES_COLUMNS} ${SPECIES_FROM} WHERE s.id = ?`)

export function parseId(id: string): { cls: LipidClass; c: number; d: number } | null {
  const m = id.trim().match(/^([A-Za-z]+)[- ]?(\d{1,2})[:-](\d{1,2})$/)
  if (!m) return null
  const cls = findClass(m[1])
  if (!cls) return null
  const c = +m[2], d = +m[3]
  if (c < cls.cRange[0] || c > cls.cRange[1] || d > dMaxOf(cls)) return null
  return { cls, c, d }
}

export function getSpecies(id: string): SpeciesRecord | null {
  const parsed = parseId(id)
  if (!parsed) return null
  const canonicalId = `${parsed.cls.k}-${parsed.c}-${parsed.d}`
  const row = byIdStmt.get(canonicalId) as SpeciesRow | undefined
  return row ? assembleRecord(row) : null
}

export function listClasses() {
  const rows = db.prepare(`SELECT code FROM lipid_class`).all() as { code: string }[]
  return rows.map((r) => {
    const c = findClass(r.code) as LipidClass
    return { k: c.k, name: c.name, group: c.group, category: c.category, chains: c.n, kingdoms: c.kingdoms, occurrence: c.occurrence, carbonRange: c.cRange, preferredAdduct: c.pref }
  })
}

export function search(params: SearchParams) {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50))

  const where: string[] = []
  const args: (string | number)[] = []
  if (params.classK) { where.push(`s.class_code = ? COLLATE NOCASE`); args.push(params.classK) }
  if (params.group) { where.push(`lc.display_group = ?`); args.push(params.group) }
  if (params.kingdom) {
    const codes = listClasses().filter((c) => c.kingdoms.includes(params.kingdom as Kingdom)).map((c) => c.k)
    where.push(`s.class_code IN (${codes.map(() => '?').join(',') || 'NULL'})`)
    args.push(...codes)
  }
  if (params.carbonsMin != null) { where.push(`s.n_carbon >= ?`); args.push(params.carbonsMin) }
  if (params.carbonsMax != null) { where.push(`s.n_carbon <= ?`); args.push(params.carbonsMax) }
  if (params.dbMin != null) { where.push(`s.n_dbond >= ?`); args.push(params.dbMin) }
  if (params.dbMax != null) { where.push(`s.n_dbond <= ?`); args.push(params.dbMax) }
  if (!params.includeRare) where.push(`s.status != 'rare'`)
  if (params.origin) { where.push(`s.origin = ?`); args.push(params.origin) }
  if (params.massMin != null) { where.push(`s.exact_mass >= ?`); args.push(params.massMin) }
  if (params.massMax != null) { where.push(`s.exact_mass <= ?`); args.push(params.massMax) }
  if (params.minBiosynthetic != null) { where.push(`sy.bio_score >= ?`); args.push(params.minBiosynthetic) }
  if (params.maxSaScore != null) { where.push(`sy.chem_sascore <= ?`); args.push(params.maxSaScore) }

  const sql = `
    SELECT ${SPECIES_COLUMNS} ${SPECIES_FROM}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY s.exact_mass
  `
  let rows = db.prepare(sql).all(...args) as SpeciesRow[]

  const q = params.q?.trim().toLowerCase()
  if (q) {
    rows = rows.filter((r) => {
      const cls = findClass(r.class_code) as LipidClass
      return r.shorthand.toLowerCase().includes(q) || cls.name.toLowerCase().includes(q) || r.formula.toLowerCase() === q
    })
  }

  const total = rows.length
  const start = (page - 1) * pageSize
  const results = rows.slice(start, start + pageSize).map(assembleRecord)
  return { total, page, pageSize, results }
}

export function identifyByMz(mz: number, ppm = 10, adduct = '[M+H]+') {
  const tol = (mz * ppm) / 1e6
  const rows = db.prepare(`SELECT id, class_code, exact_mass FROM species WHERE status != 'rare'`).all() as { id: string; class_code: string; exact_mass: number }[]
  const out: { record: SpeciesRecord; adduct: string; adductMz: number; errorPpm: number }[] = []
  for (const r of rows) {
    const cls = findClass(r.class_code) as LipidClass
    const ammon = prefersAmmonium(cls)
    const adducts: Record<string, number> = {
      '[M+H]+': r.exact_mass + PROTON,
      '[M-H]-': r.exact_mass - PROTON,
      [ammon ? '[M+NH4]+' : '[M+HCOO]-']: ammon ? r.exact_mass + NH4 : r.exact_mass + FORMATE,
    }
    const am = adducts[adduct]
    if (am == null) continue
    if (Math.abs(am - mz) <= tol) {
      const rec = getSpecies(r.id)
      if (rec) out.push({ record: rec, adduct, adductMz: round4(am), errorPpm: round4(((am - mz) / mz) * 1e6) })
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

const LAB_ONLY_MAX_SASCORE = 4.5
const LAB_ONLY_MAX_BIOSYNTHETIC = 30

/** The "valuable quadrant" (#4): high chemical accessibility (low SAScore), low biosynthetic score — lab-accessible lipids nature doesn't make. */
export function findLabOnly(limit = 50): SpeciesRecord[] {
  const sql = `
    SELECT ${SPECIES_COLUMNS} ${SPECIES_FROM}
    WHERE sy.chem_sascore <= ? AND sy.bio_score <= ? AND s.status != 'rare'
    ORDER BY sy.chem_sascore ASC, sy.bio_score ASC
    LIMIT ?
  `
  const rows = db.prepare(sql).all(LAB_ONLY_MAX_SASCORE, LAB_ONLY_MAX_BIOSYNTHETIC, Math.min(200, limit)) as SpeciesRow[]
  return rows.map(assembleRecord)
}
