# Data architecture

From five fragmented sources to one queryable, provenance-tagged atlas. Everything
flows left to right; every stored value knows how it was produced.

```
01 INGEST  →  02 RECONCILE  →  03 ENUMERATE  →  04 INFER  →  05 SERVE
```

## 01 · Ingest — reference sources (all open, all with bulk + API access)

| Source | Gives us | Access |
|---|---|---|
| LIPID MAPS **LMSD** | ~48k curated known species, structures, classification | bulk SDF, REST |
| LIPID MAPS **LMISSD / COMP_DB** | ~1.1M in-silico enumerated species | bulk |
| ~~SwissLipids~~ | lipid ↔ enzyme ↔ reaction ↔ pathway | not viable — undocumented private API (see #5) |
| **Rhea** + **UniProt** | reaction definitions, real discovered enzyme accessions | REST, live (see #4/#5) |
| **HMDB**, **ChEBI** | biological/clinical context, ontology | bulk, API |

## 02 · Reconcile — normalize & dedup

- Canonicalize every entry to **LIPID MAPS shorthand** (`PC 34:1`, `TG 52:3`).
- Structure identity via **InChIKey / canonical SMILES** (RDKit standardization) — one
  species is one node even when five databases name it differently.
- Persist all source accessions as cross-references rather than collapsing them.

## 03 · Enumerate — define the space (this is what makes the "periodic table" complete)

- A **headgroup × acyl-chain generator** with chemically sane bounds (carbon range,
  degree of unsaturation, odd/even, chain count per class).
- Follow the SwissLipids model: transparent, rule-based, brute-force enumeration.
- **Diff the enumerated set against the curated set → the gaps.** Each gap becomes a
  first-class species with `origin = in_silico`.

## 04 · Infer — the property engine

| Property | Method | Provenance tag |
|---|---|---|
| formula, exact mass, adduct m/z | exact calculation from composition | `calculated` |
| logP, TPSA, descriptors | RDKit | `calculated` |
| **CCS** | ML (DeepCCS / AllCCS-style, per adduct) | `predicted` + model version |
| **RT** | ML per chromatography method | `predicted` |
| **MS/MS** | in-silico fragmentation | `predicted` |
| **Tm**, packing | biophysical heuristics / QSPR | `predicted` |
| **synthesizability** | see below | mixed — real where verified/computed, else `predicted` |

Where a measured value exists (from LMSD, spectral libraries, literature), it is stored
as `measured` and always wins the display over a prediction.

### Synthesizability (the novel column)

Split deliberately into two independent scores, each with its own provenance
(`synth.bio_method`/`bio_model_version`, `synth.chem_method`/`chem_model_version` —
they can succeed or fall back independently):

- **Biosynthetic accessibility** — is there a known enzyme + pathway that produces this
  species? The server (`src/lib/pathway.ts`) live-verifies a class's declared enzymes
  against **UniProt** (reviewed human gene) and its reaction against **Rhea** (exists,
  approved, mass/charge balanced) — `calculated`, tagged `pathway-verified-v1`. That
  confidence scales a composition-based attainability heuristic (odd-chain, very-long,
  highly-polyunsaturated compositions penalized) exported as `bioAttainability()` in
  `src/lib/lipids.ts`. Falls back to the heuristic alone (`predicted`, `heuristic-v0`)
  if UniProt/Rhea are unreachable at build time.
- **Chemical accessibility** — the real **Ertl/Schuffenhauer SAScore**, computed by
  RDKit (`ml/synth.py`, vendoring RDKit's `Contrib/SA_Score`) from each species'
  generated SMILES — `calculated`, tagged with the RDKit version. A retrosynthesis pass
  (e.g. AiZynthFinder) to attach a candidate route is **not yet implemented** — `synth
  .route_json` stays null (tracked under #4).

The valuable quadrant is **high chemical, low biosynthetic** — lab-accessible lipids
nature doesn't make (e.g. novel LNP components); surfaced via `GET /lab-only` and the
`find_lab_only` MCP tool.

The synthesizability *scores* land server-side only (REST + MCP + the SQLite store) —
the frontend's Atlas/Compare/Analytics views still call the client-side heuristic
`synth()` directly. The *pathway graph* (below) is the exception: it's precomputed at
build time into a committed JSON artifact, so the Inspector shows it too.

### Origin & pathway graph (#5)

Real enzyme/reaction links, not the hand-authored `LipidClass.enz`/`.rhea`/`.pw` prose.
SwissLipids turned out not to be viable (its REST API is an undocumented Angular-app
backend with no public schema) — UniProt + Rhea, already integrated for synthesizability
above, cover this better:

- `discoverEnzymes()` (`src/lib/pathway.ts`) queries UniProt's `cc_catalytic_activity:
  "RHEA:{id}"` — every reviewed human enzyme UniProt itself annotates as catalyzing that
  reaction. This *discovers* the real enzyme set (e.g. PC's reaction resolves to 7 real
  enzymes — `LPCAT1-4`, `MBOAT1/2`, and `PRDX6`, a documented moonlighting LPCAT
  activity), rather than only verifying our hand-picked 3-gene guess.
- `reactionParticipants()` parses Rhea's `htmlequation` for real ChEBI substrate/product
  names — not our paraphrased pathway description.
- `scripts/build-db.ts` populates the `pathway` table (one row per species × discovered
  enzyme — the class-level fact replicated per species, same honest granularity as
  `bio_score`) and writes `src/data/pathwayGraph.json`, which the Inspector's "Origin &
  biosynthesis" section loads (lazy, code-split, same pattern as `predictions.json`) to
  show the real enzymes + equation alongside the existing curated prose.
- Reaction `direction` (which side is the biosynthetic product) is not determined — Rhea's
  canonical orientation isn't necessarily the biosynthetic one; stored `null` rather than
  guessed. True per-species enzyme specificity (e.g. which LPCAT isoform for which chain
  length) isn't modeled either — the class-level reaction is the honest granularity here.

## 05 · Serve — access layer

- **Dev store today: SQLite** (`db/schema.sqlite.sql`, built by `npm run db:build` from
  `scripts/build-db.ts`) — same tables as below, backing the REST API and MCP server
  via `server/db.ts`. Regenerated any time from the enumeration + LMSD/ML overlays; not
  hand-edited.
- **Production target: Postgres + RDKit cartridge** for structural search; **graph
  store** for pathways. The swap is scoped to `server/db.ts` — port its SQL to
  `pg`/`postgres.js`, keep the same exported function signatures, and `server/api.ts` /
  `mcp/server.ts` don't change.
- **REST + SPARQL + bulk export**; stable IDs and cross-refs on every species (SPARQL +
  bulk export still open, #7).
- The **Atlas UI** (this repo) computes client-side and never touches the store — it
  works standalone (e.g. GitHub Pages) and is one client of the API for everyone else.

## Core schema — provenance is a first-class citizen

```sql
-- one row per canonical species; identity by structure, not name
TABLE species (
  id            uuid PK,
  shorthand     text,          -- 'PC 34:1'
  lipid_class   text,          -- FK → class ontology (LIPID MAPS)
  n_carbon      int, n_dbond   int,
  formula       text, exact_mass numeric,
  inchikey      text UNIQUE,
  origin        enum('curated','in_silico')   -- ← is it a gap?
);

-- every property value knows how it was produced
TABLE property (
  species_id    uuid FK,
  key           text,          -- 'ccs_mh', 'rt_rp', 'tm', 'logp'…
  value         numeric,
  method        enum('measured','calculated','predicted'),
  model_version text,          -- 'DeepCCS v2.1' — reproducible
  confidence    numeric,       -- ± interval
  source        text           -- DOI / DB accession
);

TABLE pathway (species_id, enzyme_uniprot, rhea_rxn, direction);  -- populated: real UniProt/Rhea discovery (#5)
TABLE synth   (species_id, bio_score, chem_sascore, route_json);
TABLE xref    (species_id, db, accession);   -- LMSD, HMDB… (SwissLipids not viable, see #5)
```

## Non-negotiables

1. **Predicted ≠ measured, always visible.** Researchers will not adopt a black box.
2. **Reproducible predictions.** Every predicted value carries its model version.
3. **Transparent enumeration.** The rules that define the space are documented and diffable.
