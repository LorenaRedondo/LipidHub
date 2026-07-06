// ── LIPID MAPS (LMSD) live verification ────────────────────────────────────
// Server-side only (the browser SPA can't call lipidmaps.org — CORS). Confirms
// whether a species' sum composition is actually curated in the LIPID MAPS
// Structure Database, and returns real LM IDs + the authoritative classification.
// Data © LIPID MAPS, CC BY 4.0.  https://www.lipidmaps.org

export interface LmsdRecord {
  lm_id: string
  abbrev?: string
  name?: string
  core?: string
  main_class?: string
  sub_class?: string
  formula?: string
  exactmass?: string
  inchi_key?: string
}

export interface LmsdEnrichment {
  queryAbbrev: string
  inLMSD: boolean
  count: number
  lmIds: string[]
  classification?: { core?: string; mainClass?: string; subClass?: string }
  source: string
  note: string
}

const BASE = 'https://www.lipidmaps.org/rest/compound'
const cache = new Map<string, LmsdEnrichment>()

/** LMSD writes sphingolipids with a hydroxyl suffix, e.g. "SM 34:1;O2". */
export function toLmsdAbbrev(shorthand: string, group: string): string {
  return group === 'Sphingolipids' ? `${shorthand};O2` : shorthand
}

function normalize(data: unknown): LmsdRecord[] {
  if (!data || Array.isArray(data)) return [] // [] => no match
  if (typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  if (typeof obj.lm_id === 'string') return [obj as unknown as LmsdRecord]
  return Object.values(obj).filter((v): v is LmsdRecord => !!v && typeof v === 'object' && 'lm_id' in (v as object))
}

async function fetchAbbrev(abbrev: string, timeoutMs = 15000): Promise<LmsdRecord[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}/abbrev/${encodeURIComponent(abbrev)}/all/json`, { signal: ctrl.signal })
    if (!res.ok) return []
    return normalize(await res.json())
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** Verify a species against LMSD by its (notation-corrected) abbreviation. */
export async function enrichWithLmsd(shorthand: string, group: string): Promise<LmsdEnrichment> {
  const queryAbbrev = toLmsdAbbrev(shorthand, group)
  const cached = cache.get(queryAbbrev)
  if (cached) return cached

  const recs = await fetchAbbrev(queryAbbrev)
  const enr: LmsdEnrichment = recs.length
    ? {
        queryAbbrev, inLMSD: true, count: recs.length,
        lmIds: recs.slice(0, 6).map((r) => r.lm_id),
        classification: { core: recs[0].core, mainClass: recs[0].main_class, subClass: recs[0].sub_class },
        source: 'LIPID MAPS LMSD (CC BY 4.0)',
        note: `${recs.length} curated structure(s) share this sum composition in LMSD`,
      }
    : {
        queryAbbrev, inLMSD: false, count: 0, lmIds: [],
        source: 'LIPID MAPS LMSD (CC BY 4.0)',
        note: 'No LMSD entry for this abbreviation (uncatalogued gap, or a notation the lookup did not match)',
      }
  cache.set(queryAbbrev, enr)
  return enr
}
