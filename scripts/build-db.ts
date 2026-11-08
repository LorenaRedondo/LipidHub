// ── SQLite store builder ───────────────────────────────────────────────────
// Materializes the enumerated lipidome + curated overlays into db/lipidhub.sqlite,
// the dev/local store behind the REST API + MCP server (server/db.ts). Derived
// artifact — regenerate any time with `npm run db:build`; not hand-edited.
//
// The browser bundle is untouched by this: it keeps computing client-side from
// src/lib. This only feeds the server-side surfaces (REST, MCP, future bulk
// export / SPARQL).
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLASSES, bioAttainability, dMaxOf, props, status, synth } from '../src/lib/lipids'
import { formulaString } from '../src/lib/service'
import { verifyEnzyme, verifyPathway } from '../src/lib/pathway'
import predData from '../src/data/predictions.json'
import structuresData from '../src/data/lmsdStructures.json'
import synthData from '../src/data/synth.json'
import logpData from '../src/data/logp.json'
import lmsdCuratedData from '../src/data/lmsdCurated.json'

const PRED = predData as unknown as {
  model_version: string
  unit: { ccs: string; rt: string }
  predictions: Record<string, { ccs: { v: number; lo: number; hi: number }; rt: { v: number; lo: number; hi: number } }>
}
const STRUCTURES = (structuresData as unknown as { structures: Record<string, { lmId: string; inchikey: string; smiles: string }> }).structures
const SYNTH = synthData as unknown as { model_version: string; method: string; scores: Record<string, number> }
const LOGP = logpData as unknown as { model_version: string; method: string; values: Record<string, number> }

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(HERE, '../db/lipidhub.sqlite')
const SCHEMA_PATH = path.join(HERE, '../db/schema.sqlite.sql')

const round4 = (n: number) => Math.round(n * 1e4) / 1e4

fs.rmSync(DB_PATH, { force: true })
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'))

const insertClass = db.prepare(
  `INSERT INTO lipid_class (code, abbrev, name, core, main_class, display_group, n_chains)
   VALUES (@code, @abbrev, @name, @core, @main_class, @display_group, @n_chains)`,
)
const insertSpecies = db.prepare(
  `INSERT INTO species (id, shorthand, class_code, n_carbon, n_dbond, formula, exact_mass, origin, status, lm_id)
   VALUES (@id, @shorthand, @class_code, @n_carbon, @n_dbond, @formula, @exact_mass, @origin, @status, NULL)`,
)
const insertSynth = db.prepare(
  `INSERT INTO synth (species_id, bio_score, bio_method, bio_model_version, chem_sascore, chem_method, chem_model_version)
   VALUES (@species_id, @bio_score, 'predicted', 'heuristic-v0', @chem_sascore, 'predicted', 'heuristic-v0')`,
)
let speciesCount = 0
let curatedCount = 0
let gapCount = 0
let rareCount = 0

const buildAll = db.transaction(() => {
  for (const cls of CLASSES) {
    insertClass.run({ code: cls.k, abbrev: cls.k, name: cls.name, core: cls.category, main_class: null, display_group: cls.group, n_chains: cls.n })

    const [lo, hi] = cls.cRange
    for (let c = lo; c <= hi; c++) {
      for (let d = 0; d <= dMaxOf(cls); d++) {
        const st = status(cls, c, d)
        if (st === 'known') curatedCount++
        else if (st === 'gap') gapCount++
        else rareCount++

        const id = `${cls.k}-${c}-${d}`
        const p = props(cls, c, d)
        const sy = synth(cls, c, d)

        insertSpecies.run({
          id, shorthand: `${cls.k} ${c}:${d}`, class_code: cls.k, n_carbon: c, n_dbond: d,
          formula: formulaString(cls, c, d), exact_mass: round4(p.M),
          origin: st === 'known' ? 'curated' : 'in_silico', status: st,
        })
        insertSynth.run({ species_id: id, bio_score: sy.bio, chem_sascore: sy.sa })

        // CCS/RT/logP are inserted only by the real overlays below (trained model / RDKit).
        // No heuristic placeholder rows: a species with no real value simply has no property
        // row, so the API reports "not available" rather than a fabricated number. Tm has no
        // reliable per-species source and is not stored at all.

        speciesCount++
      }
    }
  }
})
buildAll()

// ── overlay: real ML predictions replace the heuristic ccs/rt (issue #9) ──
const deleteMlProp = db.prepare(`DELETE FROM property WHERE species_id = ? AND key = ?`)
const insertMlProp = db.prepare(
  `INSERT INTO property (species_id, key, value, unit, method, model_version, ci_low, ci_high)
   VALUES (@species_id, @key, @value, @unit, 'predicted', @model_version, @ci_low, @ci_high)`,
)
const speciesExists = db.prepare(`SELECT 1 FROM species WHERE id = ?`)

let predictionsOverlaid = 0
const overlayPredictions = db.transaction(() => {
  for (const [id, pred] of Object.entries(PRED.predictions)) {
    if (!speciesExists.get(id)) continue
    for (const key of ['ccs', 'rt'] as const) {
      deleteMlProp.run(id, key)
      insertMlProp.run({ species_id: id, key, value: pred[key].v, unit: PRED.unit[key], model_version: PRED.model_version, ci_low: pred[key].lo, ci_high: pred[key].hi })
    }
    predictionsOverlaid++
  }
})
overlayPredictions()

// ── overlay: real LMSD structures for curated species ──────────────────────
const updateStructure = db.prepare(`UPDATE species SET smiles = ?, inchikey = ?, lm_id = ? WHERE id = ?`)
const insertXref = db.prepare(`INSERT OR IGNORE INTO xref (species_id, db, accession) VALUES (?, 'LMSD', ?)`)

let structuresOverlaid = 0
const overlayStructures = db.transaction(() => {
  for (const [id, s] of Object.entries(STRUCTURES)) {
    if (!speciesExists.get(id)) continue
    updateStructure.run(s.smiles, s.inchikey, s.lmId, id)
    insertXref.run(id, s.lmId)
    structuresOverlaid++
  }
})
overlayStructures()

// ── overlay: real SAScore (RDKit) replaces the heuristic chem_sascore ──
const updateChem = db.prepare(`UPDATE synth SET chem_sascore = ?, chem_method = 'calculated', chem_model_version = ? WHERE species_id = ?`)
let saOverlaid = 0
const overlaySa = db.transaction(() => {
  for (const [id, score] of Object.entries(SYNTH.scores)) {
    if (!speciesExists.get(id)) continue
    updateChem.run(score, SYNTH.model_version, id)
    saOverlaid++
  }
})
overlaySa()

// ── overlay: real logP (RDKit Crippen) replaces the heuristic — property_best already
// prefers 'calculated' over 'predicted', so this just adds a second, better row per
// species rather than deleting the heuristic one ──
const insertLogp = db.prepare(
  `INSERT INTO property (species_id, key, value, unit, method, model_version, ci_low, ci_high)
   VALUES (@species_id, 'logp', @value, NULL, 'calculated', @model_version, NULL, NULL)`,
)
let logpOverlaid = 0
const overlayLogp = db.transaction(() => {
  for (const [id, value] of Object.entries(LOGP.values)) {
    if (!speciesExists.get(id)) continue
    insertLogp.run({ species_id: id, value, model_version: LOGP.model_version })
    logpOverlaid++
  }
})
overlayLogp()

// ── overlay: live UniProt/Rhea pathway verification scales bio_score and
// populates the `pathway` table + src/data/pathwayGraph.json with the real,
// discovered enzyme/reaction graph — not the hand-picked cls.enz/rhea.
// Best-effort: if UniProt is unreachable (offline build), bio_score stays the
// heuristic-only fallback and pathwayGraph.json is left untouched.
const updateBio = db.prepare(`UPDATE synth SET bio_score = ?, bio_method = 'calculated', bio_model_version = 'pathway-verified-v1' WHERE species_id = ?`)
const insertPathway = db.prepare(
  `INSERT INTO pathway (species_id, enzyme_uniprot, rhea_rxn, direction, source)
   VALUES (@species_id, @enzyme_uniprot, @rhea_rxn, NULL, 'UniProt (Swiss-Prot) + Rhea, live, precomputed at db:build')`,
)
let classesVerified = 0
let pathwayRows = 0
const PATHWAY_GRAPH_MODEL_VERSION = 'uniprot-rhea-live-v1'
const pathwayGraph: Record<string, {
  rheaId: string
  equation?: string
  enzymes: { accession: string; gene?: string; proteinName?: string }[]
  substrates: { chebiId: string; name: string }[]
  products: { chebiId: string; name: string }[]
}> = {}

const live = (await verifyEnzyme('INS')).found // probe with a gene guaranteed to exist
if (live) {
  for (const cls of CLASSES) {
    const v = await verifyPathway(cls)
    if (v.confidence <= 0) continue // no verified signal for this class; leave heuristic fallback
    classesVerified++
    pathwayGraph[cls.k] = {
      rheaId: cls.rhea, equation: v.reaction.equation,
      enzymes: v.discoveredEnzymes, substrates: v.substrates, products: v.products,
    }

    const [lo, hi] = cls.cRange
    const updateClass = db.transaction(() => {
      for (let c = lo; c <= hi; c++) {
        for (let d = 0; d <= dMaxOf(cls); d++) {
          const id = `${cls.k}-${c}-${d}`
          updateBio.run(Math.round(bioAttainability(cls, c, d) * v.confidence), id)
          for (const enz of v.discoveredEnzymes) {
            insertPathway.run({ species_id: id, enzyme_uniprot: enz.accession, rhea_rxn: cls.rhea })
            pathwayRows++
          }
        }
      }
    })
    updateClass()
  }
  fs.writeFileSync(
    path.join(HERE, '../src/data/pathwayGraph.json'),
    JSON.stringify({ model_version: PATHWAY_GRAPH_MODEL_VERSION, method: 'calculated', classes: pathwayGraph }),
  )
} else {
  console.warn('  pathway verification: UniProt unreachable — bio_score stays heuristic-only, pathwayGraph.json left untouched')
}

db.close()

// ── build manifest: real, current facts for the in-app Methods page and the
// header status line — generated here so neither can drift out of sync with
// what this build actually produced.
fs.writeFileSync(
  path.join(HERE, '../src/data/meta.json'),
  JSON.stringify({
    builtAt: new Date().toISOString(),
    classes: CLASSES.length,
    species: { total: speciesCount, curated: curatedCount, gap: gapCount, rare: rareCount },
    lmsdRecordsScanned: (lmsdCuratedData as { recordsScanned: number }).recordsScanned,
    models: {
      ccsRt: PRED.model_version,
      chemSascore: SYNTH.model_version,
      logP: LOGP.model_version,
      pathway: live ? PATHWAY_GRAPH_MODEL_VERSION : 'heuristic-v0 (pathway verification skipped — offline build)',
    },
  }, null, 2),
)

console.log(`Built ${DB_PATH}`)
console.log(`  classes:              ${CLASSES.length}`)
console.log(`  species:              ${speciesCount}  (curated ${curatedCount} / gap ${gapCount} / rare ${rareCount})`)
console.log(`  ML predictions:       ${predictionsOverlaid} species (ccs+rt replaced; model ${PRED.model_version})`)
console.log(`  SAScore (RDKit):      ${saOverlaid} species (chem_sascore replaced; model ${SYNTH.model_version})`)
console.log(`  logP (RDKit Crippen): ${logpOverlaid} species (real logp added; model ${LOGP.model_version})`)
console.log(`  Pathway verification: ${live ? `${classesVerified}/${CLASSES.length} classes verified (bio_score scaled)` : 'skipped (offline)'}`)
console.log(`  Pathway graph:   ${live ? `${pathwayRows} pathway rows, ${Object.values(pathwayGraph).reduce((n, c) => n + c.enzymes.length, 0)} distinct enzyme links across ${classesVerified} classes` : 'skipped (offline)'}`)
console.log(`  LMSD structures:      ${structuresOverlaid} species (smiles/inchikey/lm_id + xref)`)
