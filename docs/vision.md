# LIPIVERSE — vision & scope

## The one-liner

**Every lipid gets a great, honest, linkable page — and LIPIVERSE is the substrate the
lipidome is queried through, by humans and by agents.**

We don't out-curate LIPID MAPS (their data is CC BY — we build on it). We win on
**integration + inference + UX + being agent-native**, and on being the reconciled,
provenance-tagged, always-current layer nobody else wants to maintain.

## The wedge

Own one job for one audience, become a daily habit, then expand.

**Beachhead: identify a lipid from a mass-spec feature, for lipidomics analysts.**
The flow — *m/z + CCS + RT → ranked candidates with honest confidence, including species
no spectral library has because we predicted them* — is something nobody does well, and
it's a daily-use habit that turns into a destination.

## Architecture

```
Frontend (static SPA, CDN)
   │  REST + MCP
Backend API (FastAPI) ── Postgres + RDKit cartridge + search index
   ▲
ML pipeline (OFFLINE): trains models, PRECOMPUTES predictions for the bounded
enumerated space, writes them into the store. Online inference only for novel,
user-submitted structures.
```

Key decision: **ML is an offline pipeline that writes predictions into the store**, not a
model server in the hot path. The API stays fast and dumb; the space is bounded, so
precompute beats serve.

## Property models: beyond naive regression

- **Descriptor + GBM / GNN** trained on real datasets (AllCCS/METLIN-CCS, RT libraries).
- **Physics-informed (gray-box)**: physics baseline + ML residual (e.g. Crippen logP +
  correction; packing-energy Tm + residual) — extrapolates into gaps far better than pure fit.
- **Hard constraints**: monotonicity (CCS ↑ with size), chemical/biosynthetic priors.
- **Uncertainty is mandatory**: conformal / ensembles → calibrated error bars, so a
  predicted gap is trustworthy enough to go measure.

## v1 scope (the beachhead)

In:
- Reconciled real data (LMSD + SwissLipids) + enumerated gaps
- **A canonical page per species** (the growth engine — see below)
- Identification search: mass / CCS / RT → ranked candidates + confidence
- **CCS + RT models with uncertainty** — the two properties that matter for ID. That is the
  *whole* ML scope for v1.
- API + MCP + bulk download

Deferred to v2+:
- Synthesizability at scale · Tm / curvature / biophysics depth · embeddings/analytics depth ·
  full 8-category exhaustiveness · community curation

## How we become the place to go (in impact order)

1. **A canonical, linkable, indexable page per species.** `/{species}` → structure,
   real-vs-predicted properties with error bars, biology, pathway, LM ID/xrefs, literature,
   cite/download. 1M indexable pages ⇒ we're the top Google result for "PC 34:1 CCS". This is
   how PubChem/UniProt became reflexes.
   - *Interactive:* `#/species/PC-34-1` in the SPA.
   - *Crawlable:* `npm run build:seo` prerenders standalone static HTML per curated species
     (`dist/s/<id>.html`) with `<title>`, meta description, **JSON-LD `ChemicalSubstance`**,
     OpenGraph, canonical link, and full server-rendered content — plus `dist/sitemap.xml`.
     Production: extend to on-demand SSR for the full enumerated space + path-based routing.
2. **Open → citations → infrastructure.** Whatever everyone integrates with becomes the standard.
3. **Freshness by auto-ingest.** More current & better-integrated than any single source.
4. **Be a dependency, not a website.** R/Python packages, MCP/agents, plugins into MS-DIAL /
   Skyline / LipidSearch. Part of the workflow, not a tab.
5. **Trust as a feature.** Measured-vs-predicted labels, uncertainty, versioned models.
6. **Lead PR with the novel layers** (gap map + synthesizability); let identification be the habit.
7. **Resource paper** (NAR Database issue) + Zenodo DOI.
8. **Community curation** (later): users submit measured values → contributors → the DB compounds.

## Sequencing

- **Now (Track B):** honest analytics framework; canonical pages; reconciled data model.
- **Next (Track A):** CCS/RT models with UQ; identification workflow; API hardening.
- **Then:** distribution (packages/plugins), SSR/SEO, paper, community curation.
