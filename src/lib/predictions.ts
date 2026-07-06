// Lazy access to precomputed ML predictions (CCS/RT with calibrated intervals).
// Written by ml/train.py into src/data/predictions.json; code-split so it loads on demand.
import { useEffect, useState } from 'react'

export interface Interval { v: number; lo: number; hi: number }
export interface SpeciesPrediction { ccs: Interval; rt: Interval }
export interface PredFile { model_version: string; method: string; unit: { ccs: string; rt: string }; predictions: Record<string, SpeciesPrediction> }

let cache: PredFile | null = null
let inflight: Promise<PredFile> | null = null

export function loadPredictions(): Promise<PredFile> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) inflight = import('../data/predictions.json').then((m) => { cache = m.default as unknown as PredFile; return cache })
  return inflight
}

/** The whole prediction file (null while loading). */
export function usePredictions(): PredFile | null {
  const [f, setF] = useState<PredFile | null>(cache)
  useEffect(() => { let x = false; loadPredictions().then((p) => { if (!x) setF(p) }); return () => { x = true } }, [])
  return f
}

export function predictionFor(f: PredFile | null, id: string): SpeciesPrediction | null {
  return f?.predictions[id] ?? null
}
