---
name: lipiverse-atlas
description: >
  Query the LIPIVERSE lipidome atlas — identify lipids from mass-spec m/z, look up a
  species' properties and structure, search/filter the enumerated lipidome, compare
  species, and find in-silico "gap" lipids. Use when a task involves identifying,
  looking up, comparing, or discovering lipids (phospholipids, glycolipids,
  sphingolipids, sterols, fatty acids) or interpreting lipidomics data.
---

# LIPIVERSE atlas

You have access to the LIPIVERSE MCP server, which exposes a lipidome atlas: known and
enumerated lipid species with computed properties, biological taxonomy, and structures.

## Tools

- `list_lipid_classes` — the 20 classes with their group, LIPID MAPS category, and kingdoms.
- `get_lipid({ id })` — one species by id/shorthand (`PC-34-1` or `"PC 34:1"`): formula, exact
  mass, adduct m/z, CCS/RT (trained model), logP (RDKit), synthesizability, taxonomy, SMILES,
  literature link. Any property with no reliable value is `null` ("not available"); `tm` is
  always `null`. `properties.provenance` names each value's source.
- `search_lipids({ q?, classK?, group?, kingdom?, massMin?, massMax?, origin?, minBiosynthetic?, maxSaScore?, pageSize? })`
  — faceted search; returns a total and a page of records.
- `identify_by_mz({ mz, ppm?, adduct? })` — candidate species for an observed m/z (default 10 ppm, `[M+H]+`).
- `compare_lipids({ ids: [...] })` — several species side by side.
- `find_gaps({ classK?, limit? })` — in-silico-only species (not curated) — the atlas "gaps".
- `predict_properties({ id })` — ML-predicted CCS/RT with a 90% calibrated uncertainty interval
  and model version, where a trained model covers the species (otherwise "not available").
- `check_lmsd({ id })` — verify a species against the **LIPID MAPS Structure Database** (the
  authoritative reference): returns `inLMSD`, real LM IDs, and the official classification.
- `check_pathway({ classK })` — live-verify a class's declared enzymes (UniProt) and reaction
  (Rhea), and discover the real, complete enzyme set + substrate/product names UniProt/Rhea
  report for that reaction — grounded biology, not our own guess.
- `find_lab_only({ limit? })` — the "valuable quadrant": high chemical accessibility (low
  SAScore), low biosynthetic accessibility — lab-makeable lipids nature doesn't produce.

## How to use it

**Always trust exact values, flag predicted ones, and never invent missing ones.** Formula,
exact mass, and adduct m/z are computed exactly. `properties.provenance`/`note` and
`synthesizability.note` say how each value was produced (trained ML model, RDKit, live-verified
pathway) — read and pass on that caveat rather than presenting anything as measured. A `null`
property means "not available" — report it as such, don't estimate it. Prefer
`predict_properties` over the CCS/RT in `get_lipid`/`search_lipids` when a real model version
is available; both surface the same value, but `predict_properties` is explicit about it.

**Ground-truth before you assert curation.** The `origin` field ("curated" / "in_silico") is a
rule-based estimate. To *know* whether a species is real, call `check_lmsd` — it queries the
live LIPID MAPS database and returns real LM IDs. Prefer it whenever curation status matters.

**Identifying a feature from a run.** Call `identify_by_mz` with the observed m/z and the
ionization adduct. Multiple candidates at the same m/z are usually *isobaric* (e.g. `PC 34:1`
and `PE 37:1`) — do not pick one silently; report the alternatives and suggest orthogonal
evidence (CCS, RT, MS/MS headgroup fragment from `get_lipid`) to disambiguate.

**"Is this makeable / natural?"** Read `synthesizability`: `biosynthetic` (0–100, scaled by a
live UniProt/Rhea pathway verification) vs `saScore` (1 easy–10 hard, the real RDKit SAScore).
Call `check_pathway` to see the actual verified enzymes/reaction behind a class's biosynthetic
score. For lab-only candidates, prefer `find_lab_only` over hand-rolling the filter.

**Where a lipid occurs.** `class.kingdoms` and `class.occurrence` give the biological context;
filter searches by `kingdom` (e.g. plant photosynthetic lipids: `group:"Glycolipids", kingdom:"Plants"`).

**Discovery.** `find_gaps` surfaces enumerated-but-uncatalogued species; combine with mass and
synthesizability filters to shortlist novel-but-plausible targets.

## Example prompts → tool sequences

- *"What's PC 34:1 near m/z 760.585?"* → `identify_by_mz({ mz: 760.585, ppm: 10 })` → report
  all candidates (isobars), not just the top hit → `get_lipid` on the top candidate for CCS/RT/
  MS-MS fragment to help disambiguate → `check_lmsd` to confirm it's actually curated.
- *"Find lipids we could make in the lab that nature doesn't."* → `find_lab_only({ limit: 20 })`
  → for the most interesting hit, `check_pathway({ classK })` to show why it scores low
  biosynthetically (which enzyme/reaction step is missing or unverified).
- *"Annotate this list of features: m/z 786.6, 704.5, 662.4 (positive mode)."* → loop
  `identify_by_mz` per m/z → for each, `check_lmsd` to flag which are real vs. gaps → summarize
  as a table with candidates, ppm error, and curation status.

## Don't

- Don't invent species ids — validate via `get_lipid`; ids are `CLASS-carbons-doublebonds`.
- Don't state a double-bond position or sn-position as known — sum composition doesn't fix them.
- Don't treat predicted CCS/RT as ground truth, and don't report a `null` property as a number.
- Don't claim a retrosynthesis route exists — route generation isn't implemented yet (`synth
  .route_json` is always null).
