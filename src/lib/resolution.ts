// ── Structural resolution & structure status ───────────────────────────────
// LipidHub enumerates *sum compositions* (class + total carbons + total double
// bonds, e.g. PC 34:1). A sum composition is not one molecule: it covers many
// chain combinations, sn-positions and double-bond positions/geometries. These
// types make that explicit so UI, REST and MCP never imply more than is known.
// Shorthand levels follow the LIPID MAPS / Liebisch et al. conventions; have
// them reviewed by lipidomics specialists before relying on the wording.

export type StructuralResolution =
  | 'class'
  | 'sum_composition'
  | 'molecular_species'
  | 'sn_resolved'
  | 'structure_resolved'

export const RESOLUTION_LEVELS: { level: StructuralResolution; example: string; known: string }[] = [
  { level: 'class', example: 'PC', known: 'Broad lipid class' },
  { level: 'sum_composition', example: 'PC 34:1', known: 'Total carbons and double bonds' },
  { level: 'molecular_species', example: 'PC 16:0_18:1', known: 'Fatty-acid composition, positions unresolved' },
  { level: 'sn_resolved', example: 'PC 16:0/18:1', known: 'Chain positions assigned' },
  { level: 'structure_resolved', example: 'fully specified', known: 'Positional, geometric and stereochemical details established' },
]

export interface Identity {
  resolution: StructuralResolution
  /** What a record at this level does and does not identify. */
  caveat: string
}

/** Every enumerated LipidHub record is a sum composition. */
export const SUM_COMPOSITION_IDENTITY: Identity = {
  resolution: 'sum_composition',
  caveat:
    'A sum composition (class, total carbons, total double bonds), not a single molecule. ' +
    'Many isomers (chain combinations, sn-positions, double-bond positions and geometry) share it.',
}

/** Provenance class of a depicted structure. */
export type StructureStatus = 'database-derived' | 'illustrative'

export interface StructureInfo {
  smiles: string
  status: StructureStatus
  /** How the structure was obtained. */
  method: string
  source?: string
  lmId?: string
  inchikey?: string
  caveat: string
}

export function illustrativeStructure(smiles: string): StructureInfo {
  return {
    smiles,
    status: 'illustrative',
    method: 'Generated from the sum composition with fixed chain-length and double-bond placement rules (src/lib/smiles.ts).',
    caveat:
      'Illustrative only: chain distribution and double-bond positions are assumed, not known. ' +
      'Do not treat as the identified molecule or use for structure-level properties.',
  }
}

export function databaseStructure(smiles: string, lmId: string, inchikey: string | null): StructureInfo {
  return {
    smiles,
    status: 'database-derived',
    method: 'Representative LIPID MAPS (LMSD) entry matched to this sum composition.',
    source: 'LIPID MAPS Structure Database (LMSD)',
    lmId,
    ...(inchikey ? { inchikey } : {}),
    caveat:
      'One representative isomer of this sum composition from a reference database; ' +
      'other isomers with the same sum composition exist.',
  }
}
