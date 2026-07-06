# LIPIDEX — an atlas of the known & predicted lipidome

A navigable atlas that unifies the **known** lipids (from reference databases), the
**enumerated but uncatalogued** ones (the *gaps*), their **properties inferred from
composition**, their **biological origin**, and — the piece nobody has built
systematically — whether a species is **synthesizable** in nature, in a lab, or neither.

> **Status:** early interactive prototype. The property engine computes real
> formulas/masses from composition; CCS / RT / Tm / logP / synthesizability are
> illustrative model outputs pending the real pipelines (see [issues](../../issues)).

## Stack

Vite + React 18 + TypeScript. The chemistry and property-inference model lives in
[`src/lib/lipids.ts`](src/lib/lipids.ts) as pure, typed, framework-free functions; the
UI in [`src/components/`](src/components) is a thin view over it.

```bash
npm install
npm run dev        # local dev server
npm run build      # tsc -b (strict) + vite build → dist/
npm run typecheck  # types only
```

The original single-file vanilla-JS prototype is preserved at
[`legacy/prototype.html`](legacy/prototype.html).

### API & agent access

The atlas is also consumable programmatically and by agents — a **REST API**, an **MCP
server**, and a **Claude Skill**, all over one shared service layer. See
[`docs/api.md`](docs/api.md).

```bash
npm run api                          # REST at http://localhost:8787
npm run mcp                          # MCP server (stdio)
claude mcp add lipidex -- npm run mcp
```

## Try it

Run `npm run dev`, or open the built `dist/` (via GitHub Pages once enabled).

- **Atlas tab** — a carbon-number × double-bond *gap map* per lipid class. Classes are
  grouped by taxonomy and filterable by the **kingdom** they occur in. Click any cell to
  inspect a species (a **2D chemical structure** built from its composition, formula,
  adducts, predicted CCS/RT/Tm/logP, synthesizability, **biological taxonomy &
  occurrence**, and a live literature link); search `PC 34:1`,
  `MGDG 34:6`, `TG 52:3`; walk cells with the arrow keys; every selection is
  deep-linkable (`#PC-34-1`). The "View as…" presets reorder the inspector per audience.
- **Search tab** — query and filter across *all* plausible species (name/shorthand + facets
  for group, kingdom, origin, mass, double bonds, synthesizability) instead of browsing class
  by class; each result opens in the Atlas. Runs over the same service layer as the API/MCP.
- **Compare tab** — pin up to four species (`+ compare` in the inspector) and line their
  properties up side by side.
- **Analytics tab** — every plausible species as one point: a property **correlation
  matrix** (Pearson r), an interactive **scatter** for any property pair, and **k-means
  clustering** that groups species by their whole property profile.
- **References tab** — foundational papers the atlas is built on, plus a live Europe PMC
  search per class.
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
| Known vs. gap status | ✅ real — ingested from LMSD (50,516 structures) | full structures/InChIKeys too |
| Classes | 17 across 6 groups (GP, GL, glycolipids, SP, ST, FA) | + free sterols, oxysterols, archaeal/prenol, gangliosides, … |
| Biological taxonomy | ✅ kingdom occurrence per class (curated) | per-species, from HMDB/literature |
| Per-species citations | ⚠️ live Europe PMC search per class | curated refs via DB integration |
| 2D structures | ✅ SMILES built from composition, drawn by OpenChemLib | canonical SVGs cached server-side (RDKit) |

See [`docs/architecture.md`](docs/architecture.md) for the full data architecture.

## Layout

```
index.html              # Vite entry
src/
  main.tsx              # React root
  App.tsx               # state: view, class, selected cell, persona; keyboard nav + deep links
  lib/lipids.ts         # typed data model + chemistry + property inference (framework-free)
  components/            # Header, AtlasView, Rail, GapMap, Inspector, Schematic, Pipeline/Users views
  styles.css            # the instrument theme
legacy/prototype.html   # original single-file vanilla-JS prototype
docs/architecture.md    # data sources, schema, property + synthesizability pipelines
docs/roadmap.md         # phased plan; mirrors the GitHub issues
```

## Sources

- LIPID MAPS — Nucleic Acids Research 2024, D1677 (LMSD, LMISSD, COMP_DB)
- SwissLipids — Bioinformatics 2015 (enzyme/pathway-driven enumeration)
- CCS/RT ML prediction — e.g. large-scale HMDB prediction, DeepCCS/AllCCS families
