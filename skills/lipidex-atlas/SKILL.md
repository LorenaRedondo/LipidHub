---
name: lipidex-atlas
description: >
  Query the LIPIDEX lipidome atlas — identify lipids from mass-spec m/z, look up a
  species' properties and structure, search/filter the enumerated lipidome, compare
  species, and find in-silico "gap" lipids. Use when a task involves identifying,
  looking up, comparing, or discovering lipids (phospholipids, glycolipids,
  sphingolipids, sterols, fatty acids) or interpreting lipidomics data.
---

# LIPIDEX atlas

You have access to the LIPIDEX MCP server, which exposes a lipidome atlas: known and
enumerated lipid species with computed properties, biological taxonomy, and structures.

## Tools

- `list_lipid_classes` — the 17 classes with their group, LIPID MAPS category, and kingdoms.
- `get_lipid({ id })` — one species by id/shorthand (`PC-34-1` or `"PC 34:1"`): formula, exact
  mass, adduct m/z, predicted CCS/RT/logP/Tm, synthesizability, taxonomy, SMILES, literature link.
- `search_lipids({ q?, classK?, group?, kingdom?, massMin?, massMax?, origin?, minBiosynthetic?, maxSaScore?, pageSize? })`
  — faceted search; returns a total and a page of records.
- `identify_by_mz({ mz, ppm?, adduct? })` — candidate species for an observed m/z (default 10 ppm, `[M+H]+`).
- `compare_lipids({ ids: [...] })` — several species side by side.
- `find_gaps({ classK?, limit? })` — in-silico-only species (not curated) — the atlas "gaps".
- `check_lmsd({ id })` — verify a species against the **LIPID MAPS Structure Database** (the
  authoritative reference): returns `inLMSD`, real LM IDs, and the official classification.

## How to use it

**Always trust exact values, flag predicted ones.** Formula, exact mass, and adduct m/z are
computed exactly. CCS, RT, Tm, and synthesizability are **heuristic placeholders** in this
research preview — never present them as measured. Each record carries a `properties.note`
saying so; pass that caveat on.

**Ground-truth before you assert curation.** The `origin` field ("curated" / "in_silico") is a
rule-based estimate. To *know* whether a species is real, call `check_lmsd` — it queries the
live LIPID MAPS database and returns real LM IDs. Prefer it whenever curation status matters.

**Identifying a feature from a run.** Call `identify_by_mz` with the observed m/z and the
ionization adduct. Multiple candidates at the same m/z are usually *isobaric* (e.g. `PC 34:1`
and `PE 37:1`) — do not pick one silently; report the alternatives and suggest orthogonal
evidence (CCS, RT, MS/MS headgroup fragment from `get_lipid`) to disambiguate.

**"Is this makeable / natural?"** Read `synthesizability`: `biosynthetic` (0–100, does a
pathway exist) vs `saScore` (1 easy–10 hard to synthesise chemically). "Lab-only" candidates
are low biosynthetic + low SAScore — search with `origin:"in_silico"` and `maxSaScore`.

**Where a lipid occurs.** `class.kingdoms` and `class.occurrence` give the biological context;
filter searches by `kingdom` (e.g. plant photosynthetic lipids: `group:"Glycolipids", kingdom:"Plants"`).

**Discovery.** `find_gaps` surfaces enumerated-but-uncatalogued species; combine with mass and
synthesizability filters to shortlist novel-but-plausible targets.

## Don't

- Don't invent species ids — validate via `get_lipid`; ids are `CLASS-carbons-doublebonds`.
- Don't state a double-bond position or sn-position as known — sum composition doesn't fix them.
- Don't treat predicted CCS/RT/Tm as ground truth.
