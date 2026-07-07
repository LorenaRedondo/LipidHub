// ── Live pathway verification (UniProt + Rhea) ─────────────────────────────
// Server-side only (same reason as src/lib/lmsd.ts — CORS blocks these from
// the browser SPA). Confirms a lipid class's declared enzymes (LipidClass.enz)
// and reaction (LipidClass.rhea) are real, reviewed UniProt/Rhea entries —
// the "does a known enzyme + pathway exist?" half of synthesizability (#4).
import type { LipidClass } from './lipids'

export interface EnzymeCheck { gene: string; found: boolean; accession?: string; proteinName?: string }
export interface RheaCheck { id: string; found: boolean; equation?: string; approved?: boolean; balanced?: boolean }

export interface PathwayVerification {
  classK: string
  enzymes: EnzymeCheck[]
  reaction: RheaCheck
  /** Fraction of declared enzymes confirmed + reaction confirmed/approved/balanced, in [0,1]. */
  confidence: number
  source: string
}

const UNIPROT_BASE = 'https://rest.uniprot.org/uniprotkb/search'
const RHEA_BASE = 'https://www.rhea-db.org/rhea/'

const enzymeCache = new Map<string, EnzymeCheck>()
const rheaCache = new Map<string, RheaCheck>()
const pathwayCache = new Map<string, PathwayVerification>()

async function fetchJson(url: string, timeoutMs = 15000): Promise<unknown | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (LIPIDEX research preview)' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Confirm a reviewed human gene exists in UniProt (Swiss-Prot). */
export async function verifyEnzyme(gene: string): Promise<EnzymeCheck> {
  const cached = enzymeCache.get(gene)
  if (cached) return cached

  const url = `${UNIPROT_BASE}?query=${encodeURIComponent(`gene:${gene} AND organism_id:9606 AND reviewed:true`)}&fields=accession,protein_name&format=json`
  const data = await fetchJson(url) as { results?: { primaryAccession?: string; proteinDescription?: { recommendedName?: { fullName?: { value?: string } } } }[] } | null
  const hit = data?.results?.[0]
  const check: EnzymeCheck = hit
    ? { gene, found: true, accession: hit.primaryAccession, proteinName: hit.proteinDescription?.recommendedName?.fullName?.value }
    : { gene, found: false }
  enzymeCache.set(gene, check)
  return check
}

/** Confirm a Rhea reaction exists and is approved + mass/charge balanced. */
export async function verifyRhea(rheaId: string): Promise<RheaCheck> {
  const cached = rheaCache.get(rheaId)
  if (cached) return cached

  const id = rheaId.replace(/^RHEA:/, '')
  const url = `${RHEA_BASE}?query=${encodeURIComponent(`RHEA:${id}`)}&columns=rhea-id,equation,status&format=json`
  const data = await fetchJson(url) as { results?: { id?: string; equation?: string; status?: string; balanced?: boolean }[] } | null
  const hit = data?.results?.[0]
  const check: RheaCheck = hit
    ? { id: rheaId, found: true, equation: hit.equation, approved: hit.status === 'approved', balanced: hit.balanced }
    : { id: rheaId, found: false }
  rheaCache.set(rheaId, check)
  return check
}

/** Verify all of a class's declared enzymes + its reaction; cached per class code. */
export async function verifyPathway(cls: LipidClass): Promise<PathwayVerification> {
  const cached = pathwayCache.get(cls.k)
  if (cached) return cached

  const enzymes = await Promise.all(cls.enz.map(verifyEnzyme))
  const reaction = await verifyRhea(cls.rhea)

  const enzymeFraction = enzymes.length ? enzymes.filter((e) => e.found).length / enzymes.length : 0
  const reactionScore = reaction.found ? (0.5 + (reaction.approved ? 0.25 : 0) + (reaction.balanced ? 0.25 : 0)) : 0
  const confidence = Math.round((enzymeFraction * 0.6 + reactionScore * 0.4) * 100) / 100

  const result: PathwayVerification = { classK: cls.k, enzymes, reaction, confidence, source: 'UniProt (Swiss-Prot) + Rhea, live' }
  pathwayCache.set(cls.k, result)
  return result
}
