# LIPIDEX — an atlas of the known & predicted lipidome

A navigable atlas that unifies the **known** lipids (from reference databases), the
**enumerated but uncatalogued** ones (the *gaps*), their **properties inferred from
composition**, their **biological origin**, and — the piece nobody has built
systematically — whether a species is **synthesizable** in nature, in a lab, or neither.

> **Status:** early interactive prototype. The property engine computes real
> formulas/masses from composition; CCS / RT / Tm / logP / synthesizability are
> illustrative model outputs pending the real pipelines (see [issues](../../issues)).

## Try it

Open [`index.html`](index.html) in a browser (or via GitHub Pages once enabled).

- **Atlas tab** — a carbon-number × double-bond *gap map* per lipid class. Click any
  cell to inspect a species; search `PC 34:1`, `PE 36:2`, `TG 52:3`. The "View as…"
  presets reorder the inspector for different audiences.
- **Pipeline tab** — the data architecture (Ingest → Reconcile → Enumerate → Infer →
  Serve), the core schema, and where provenance lives.
- **Who it's for** — six audiences and the concrete task each brings.

## The thesis

Reference databases already own *"the list"* — [LIPID MAPS](https://www.lipidmaps.org/)
(~48k curated), its in-silico set (~1.1M enumerated), and
[SwissLipids](https://www.swisslipids.org/) (enzyme/pathway links). Competing on
catalogue size is a losing game. LIPIDEX competes on **integration + inference + two
missing layers**:

1. **A systematic synthesizability column** — biosynthetic accessibility (does an
   enzyme + pathway exist?) split from chemical accessibility (SAScore / retrosynthesis).
2. **An explicit gap map** — the enumerated space minus the curated space, with
   predicted, testable properties attached to every hole.

Every value is tagged `measured` / `calculated` / `predicted` with its model version.
Predicted is never hidden — that is what makes a number citable, or worth going to
measure.

## What is real vs. illustrative in this build

| Component | This prototype | Target |
|---|---|---|
| Formula & exact mass | ✅ computed exactly from backbone + acyl chains | same |
| Adduct m/z | ✅ computed | same |
| CCS / RT / logP / Tm | ⚠️ heuristic placeholders | trained ML + RDKit |
| Synthesizability | ⚠️ heuristic placeholders | pathway match + SAScore/retrosynthesis |
| Known vs. gap status | ⚠️ rule-based demo | real diff vs. LMSD |
| Classes | 12: 8 glycero/glycerophospho + Cer/SM/HexCer + CE | + free sterols, oxysterols, … |

See [`docs/architecture.md`](docs/architecture.md) for the full data architecture.

## Layout

```
index.html            # the single-file prototype (no build step, no dependencies)
docs/architecture.md  # data sources, schema, property + synthesizability pipelines
docs/roadmap.md       # phased plan; mirrors the GitHub issues
```

## Sources

- LIPID MAPS — Nucleic Acids Research 2024, D1677 (LMSD, LMISSD, COMP_DB)
- SwissLipids — Bioinformatics 2015 (enzyme/pathway-driven enumeration)
- CCS/RT ML prediction — e.g. large-scale HMDB prediction, DeepCCS/AllCCS families
