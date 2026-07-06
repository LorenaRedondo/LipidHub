// Lazy access to representative real LMSD structures (SMILES + InChIKey + LM ID)
// for curated species. Code-split so the ~300 KB file loads only when needed.
import { useEffect, useState } from 'react'

export interface LmsdStructure { lmId: string; inchikey: string; smiles: string }

let cache: Record<string, LmsdStructure> | null = null
let inflight: Promise<Record<string, LmsdStructure>> | null = null

export function loadLmsdStructures(): Promise<Record<string, LmsdStructure>> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = import('../data/lmsdStructures.json').then((m) => {
      cache = (m.default as { structures: Record<string, LmsdStructure> }).structures
      return cache
    })
  }
  return inflight
}

/** React hook: resolves the real LMSD structure for an id, or null. */
export function useLmsdStructure(id: string): LmsdStructure | null {
  const [rec, setRec] = useState<LmsdStructure | null>(cache?.[id] ?? null)
  useEffect(() => {
    let cancelled = false
    loadLmsdStructures().then((m) => { if (!cancelled) setRec(m[id] ?? null) })
    return () => { cancelled = true }
  }, [id])
  return rec
}
