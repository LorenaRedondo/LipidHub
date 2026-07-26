// ── Real, source-backed property overlays ──────────────────────────────────
// The single source of truth for property values that come from real data
// rather than a composition heuristic: trained CCS/RT (predictions.json),
// RDKit Crippen logP (logp.json) and RDKit SAScore (synth.json).
//
// Anything not covered by these files is genuinely "not available" — every
// accessor returns null instead of fabricating a placeholder number, so the
// UI and the API can say so honestly. Each real value ships with a source
// label (model + method) so it can be shown and cited transparently.
import predData from '../data/predictions.json'
import logpData from '../data/logp.json'
import synthData from '../data/synth.json'

export interface Interval { v: number; lo: number; hi: number }

interface PredFileShape {
  model_version: string
  method: string
  unit: { ccs: string; rt: string }
  predictions: Record<string, { ccs: Interval; rt: Interval }>
}
interface ValueFileShape { model_version: string; method: string; values: Record<string, number> }
interface ScoreFileShape { model_version: string; method: string; scores: Record<string, number> }

const PRED = predData as unknown as PredFileShape
const LOGP = logpData as unknown as ValueFileShape
const SASC = synthData as unknown as ScoreFileShape

export const CCS_RT_MODEL = PRED.model_version
export const LOGP_MODEL = LOGP.model_version
export const SASCORE_MODEL = SASC.model_version

/** Human-readable source labels — shown next to each real value for transparency. */
export const SOURCE = {
  ccsRt: `trained ML model ${CCS_RT_MODEL} · predicted, 90% CI`,
  logP: `RDKit Crippen ${LOGP_MODEL} · calculated`,
  saScore: `RDKit SAScore ${SASCORE_MODEL} · calculated`,
} as const

/** Trained-model CCS + RT (with calibrated intervals) for a species id, or null if uncovered. */
export function ccsRtFor(id: string): { ccs: Interval; rt: Interval } | null {
  return PRED.predictions[id] ?? null
}
/** RDKit Crippen logP for a species id, or null if not computed for it. */
export function logpFor(id: string): number | null {
  const v = LOGP.values[id]
  return v == null ? null : v
}
/** RDKit SAScore for a species id, or null if not computed for it. */
export function saScoreFor(id: string): number | null {
  const v = SASC.scores[id]
  return v == null ? null : v
}

/** SAScore (1–10, lower = easier) → a 0–100 chemical-accessibility score. Mirrors server/db.ts. */
export function chemScoreFromSa(sa: number): number {
  return Math.round(Math.max(8, 100 - (sa - 2.6) * 15))
}
