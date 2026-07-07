// Lazy access to the real, discovered enzyme/reaction graph (UniProt + Rhea).
// Written by scripts/build-db.ts into src/data/pathwayGraph.json; code-split so it
// loads on demand. Supersedes the hand-picked LipidClass.enz/.rhea for display —
// this is what UniProt/Rhea actually say catalyzes the class's reaction (#5).
import { useEffect, useState } from 'react'

export interface DiscoveredEnzyme { accession: string; gene?: string; proteinName?: string }
export interface Participant { chebiId: string; name: string }
export interface ClassPathway {
  rheaId: string
  equation?: string
  enzymes: DiscoveredEnzyme[]
  substrates: Participant[]
  products: Participant[]
}
export interface PathwayGraphFile { model_version: string; method: string; classes: Record<string, ClassPathway> }

let cache: PathwayGraphFile | null = null
let inflight: Promise<PathwayGraphFile> | null = null

export function loadPathwayGraph(): Promise<PathwayGraphFile> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) inflight = import('../data/pathwayGraph.json').then((m) => { cache = m.default as unknown as PathwayGraphFile; return cache })
  return inflight
}

/** React hook: resolves the whole pathway graph file (null while loading). */
export function usePathwayGraph(): PathwayGraphFile | null {
  const [f, setF] = useState<PathwayGraphFile | null>(cache)
  useEffect(() => { let x = false; loadPathwayGraph().then((p) => { if (!x) setF(p) }); return () => { x = true } }, [])
  return f
}

export function pathwayForClass(f: PathwayGraphFile | null, classK: string): ClassPathway | null {
  return f?.classes[classK] ?? null
}
