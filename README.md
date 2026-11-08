# LIPIVERSE — an atlas of the known & predicted lipidome

A navigable atlas that unifies the **known** lipids (from reference databases), the
**enumerated but uncatalogued** ones (the *gaps*), their **properties inferred from
composition**, their **biological origin**, and a **synthesizability** view (accessible in
nature, in a lab, or neither).

> **Status:** interactive prototype. Formula, exact mass and adduct m/z are computed exactly.
> CCS/RT come from a trained model, logP and SAScore from RDKit — each shown only where a real
> value exists, otherwise **not available**. Tm is not reported (no reliable source yet). See
> [issues](../../issues) for what's still in progress.

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
server**, and a **Claude Skill**. The frontend keeps computing client-side (works
standalone, e.g. GitHub Pages); the REST API and MCP server are backed by a real
SQLite store (`db/schema.sqlite.sql`, see [`docs/architecture.md`](docs/architecture.md))
instead of recomputing the space per request. Build it once before running either:

```bash
npm run db:build                     # build db/lipidhub.sqlite (regenerate any time)
npm run api                          # REST at http://localhost:8787
npm run mcp                          # MCP server (stdio)
claude mcp add lipiverse -- npm run mcp
```

See [`docs/api.md`](docs/api.md) for endpoints/tools.

## Try it

Run `npm run dev`, or open the built `dist/` (via GitHub Pages once enabled).

Or via Docker Compose (builds the frontend + REST API, runs natively on Apple
Silicon — no emulation needed):

```
docker compose up --build
```

- web (nginx, static build) → http://localhost:5174
- api (Hono/Node) → http://localhost:8787

The `db:build` step (SQLite + ML predictions + SAScore + pathway graph) runs
during the image build, so both services start with a fully populated dataset.

- **Atlas tab** — a carbon-number × double-bond *gap map* per lipid class. Classes are
  grouped by taxonomy and filterable by the **kingdom** they occur in. Click any cell to
  inspect a species (a **2D chemical structure** built from its composition, formula,
  adducts, trained-model CCS/RT and RDKit logP where available, synthesizability,
  **biological taxonomy & occurrence**, and a live literature link); search `PC 34:1`,
  `MGDG 34:6`, `TG 52:3`; walk cells with the arrow keys; every selection is
  deep-linkable (`#PC-34-1`). The "View as…" presets reorder the inspector per audience.
- **Search tab** — query and filter across *all* plausible species (name/shorthand + facets
  for group, kingdom, origin, mass, double bonds, synthesizability) instead of browsing class
  by class; each result opens in the Atlas. Runs over the same service layer as the API/MCP.
- **Compare tab** — pin up to four species (`+ compare` in the inspector) and line their
  properties up side by side.
- **Analytics tab** — every plausible species as one point, using the real trained CCS/RT
  model's predictions where available (same numbers as the Inspector, not a placeholder
  formula): a property **correlation matrix** (Pearson r), and an interactive **scatter**
  for any property pair. A trend curve is only drawn where there's an established physical
  basis (e.g. Mason–Schamp CCS-vs-mass scaling, Tanford chain-length-vs-thickness) — we
  don't fit a line just because two axes were picked.
- **References tab** — foundational papers the atlas is built on, plus a live Europe PMC
  search per class.
- **Pipeline tab** — the data architecture (Ingest → Reconcile → Enumerate → Infer →
  Serve), the core schema, and where provenance lives.
- **Who it's for** — six audiences and the concrete task each brings.

## What it adds

The reference databases already hold the catalogue — [LIPID MAPS](https://www.lipidmaps.org/)
(~48k curated), its in-silico set (~1.1M enumerated), and
[SwissLipids](https://www.swisslipids.org/) (enzyme/pathway links). This project builds on that
open data and adds three things they don't put in one place:

1. **A synthesizability view** — biosynthetic accessibility (does an enzyme + pathway exist?)
   kept separate from chemical accessibility (RDKit SAScore).
2. **An explicit gap map** — the enumerated space minus the curated space, with predicted,
   testable properties attached to every hole.
3. **Provenance on every value** — tagged `measured` / `calculated` / `predicted` with its
   model version. A predicted value is never hidden or dressed up as measured, and a value with
   no reliable source reads "not available" rather than a placeholder.

## What is real vs. illustrative in this build

| Component | This prototype | Target |
|---|---|---|
| Formula & exact mass | ✅ computed exactly from backbone + acyl chains | same |
| Adduct m/z | ✅ computed | same |
| CCS / RT | ✅ trained GBM model with 90% intervals; shown where the model covers the species, else **not available** | per-adduct/method scope, GNN, monotonicity constraint (#33) |
| logP | ✅ real RDKit Crippen where a valid SMILES exists, else **not available** | TPSA / other descriptors |
| Tm | ⛔ **not reported** — no reliable measured or trained source | trained model or QSPR |
| Membrane geometry | ✅ Tanford/Israelachvili packing, curvature, thickness, area — a geometric model estimate, labelled as such | measured tier (AFM / X-ray) |
| Synthesizability | ✅ chemical: real RDKit SAScore (shown where computed, else the composition estimate is labelled). ✅ biosynthetic: composition estimate, live-verified against UniProt/Rhea server-side. | retrosynthesis route (e.g. AiZynthFinder) |
| Origin & pathway graph | ✅ real — enzymes discovered from UniProt's catalytic-activity annotations per Rhea reaction (not SwissLipids, see `docs/architecture.md` §04); shown in the Inspector | per-species (not per-class) enzyme specificity |
| Known vs. gap status | ✅ real — ingested from LMSD (50,516 structures) | full structures/InChIKeys too |
| Classes | 22 across 6 groups (GP, GL, glycolipids, SP, ST, FA) — incl. free sterols & oxysterols | + archaeal/prenol ether lipids, gangliosides, … |
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
docs/vision.md          # scope & design notes
docs/architecture.md    # data sources, schema, property + synthesizability pipelines
docs/api.md             # REST + MCP + Skill for agents
docs/roadmap.md         # phased plan; mirrors the GitHub issues
db/schema.sql           # reconciled data model (Postgres DDL, provenance-first)
```

A **canonical page per species** lives at `#/species/PC-34-1` (structure, real-vs-predicted
properties, biology, identity, cite/download). See [docs/vision.md](docs/vision.md) for the
design notes.

## Sources

- LIPID MAPS — Nucleic Acids Research 2024, D1677 (LMSD, LMISSD, COMP_DB)
- SwissLipids — Bioinformatics 2015 (enzyme/pathway-driven enumeration)
- CCS/RT ML prediction — e.g. large-scale HMDB prediction, DeepCCS/AllCCS families

## License

[EUPL-1.2](LICENSE). Third-party data and code keep their own licences — see [`NOTICE`](NOTICE).
