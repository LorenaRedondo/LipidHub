# LIPIDEX API & agent access

Three ways to consume the atlas: a **REST API**, an **MCP server**, and a **Claude
Skill**. The REST API and MCP server share one adapter
([`server/db.ts`](../server/db.ts), backed by the SQLite store built with
`npm run db:build` — see `docs/architecture.md`), so they return identical records; the
frontend uses the same record shape but computes it client-side from
[`src/lib/service.ts`](../src/lib/service.ts) instead (works standalone, e.g. GitHub Pages).

> Research preview: `formula`, `exactMass`, and `adducts` are computed exactly.
> `ccs`/`rt` are ML-predicted with uncertainty where available (else heuristic); `tm`/`logP`
> are heuristic placeholders (issue #3). `synthesizability` is real server-side (RDKit
> SAScore + live UniProt/Rhea pathway verification, issue #4) but still heuristic in the
> frontend UI.

## REST API

```bash
npm run db:build   # build db/lipidex.sqlite once (see docs/architecture.md)
npm run api        # http://localhost:8787  (API_PORT to override)
```

| Endpoint | Purpose |
|---|---|
| `GET /classes` | the 20 classes with taxonomy |
| `GET /species/:id` | one species, e.g. `/species/PC-34-1` |
| `GET /search?…` | faceted search (see params below) |
| `GET /identify?mz=760.585&ppm=10&adduct=[M+H]+` | candidate species for an m/z |
| `GET /compare?ids=PC-34-1,MGDG-34-2` | several species at once |
| `GET /gaps?class=SM&limit=50` | in-silico-only "gap" species |
| `GET /lmsd/:id` | **live LIPID MAPS verification** — real LM IDs + classification |
| `GET /species/:id?lmsd=1` | species record enriched with LMSD verification |
| `GET /pathway/:class` | **live UniProt/Rhea verification** of a class's enzymes + reaction |
| `GET /lab-only?limit=50` | the "valuable quadrant" — high chemical, low biosynthetic accessibility |
| `GET /predict/:id` | ML CCS/RT with 90% uncertainty intervals |

Search params: `q, classK, group, kingdom, massMin, massMax, carbonsMin, carbonsMax, dbMin, dbMax, origin, minBiosynthetic, maxSaScore, includeRare, page, pageSize`.

```bash
curl "localhost:8787/species/PC-34-1"
curl "localhost:8787/identify?mz=760.585&ppm=10&adduct=%5BM%2BH%5D%2B"
curl "localhost:8787/search?group=Glycolipids&kingdom=Plants&massMin=700&massMax=800"
curl "localhost:8787/lab-only?limit=10"
```

## MCP server (for agents)

```bash
npm run mcp                          # stdio transport
claude mcp add lipidex -- npm run mcp
```

Tools: `list_lipid_classes`, `get_lipid`, `search_lipids`, `identify_by_mz`,
`compare_lipids`, `predict_properties`, `check_lmsd`, `find_gaps`, `check_pathway`,
`find_lab_only`. Smoke-test end-to-end:

```bash
npx tsx mcp/test-client.ts
# tools: list_lipid_classes, get_lipid, search_lipids, identify_by_mz, compare_lipids,
#        predict_properties, check_lmsd, find_gaps, check_pathway, find_lab_only
# identify_by_mz 760.585 -> PC 34:1 | PE 37:1
```

## Claude Skill

[`skills/lipidex-atlas/SKILL.md`](../skills/lipidex-atlas/SKILL.md) packages the domain
guidance (identify from m/z, disambiguate isobars, read synthesizability, respect
predicted-vs-exact) on top of the MCP tools.

## Layering

```
src/lib/lipids.ts + smiles.ts        ← model (pure)
        ├── src/lib/service.ts       ← client-side query/record functions (frontend, standalone)
        └── server/db.ts             ← server-side adapter (SQLite; same record shape)
                ├── server/api.ts    ← REST (Hono)
                └── mcp/server.ts    ← MCP (stdio)  ──►  skills/lipidex-atlas  (agents)
```

In production the MCP server would proxy the REST API rather than importing the adapter
directly; for the prototype both call `server/db.ts` so no extra process is required.

## Live LIPID MAPS verification

`check_lmsd` / `GET /lmsd/:id` query the [LIPID MAPS](https://www.lipidmaps.org) REST API
server-side (the browser can't — CORS) to confirm whether a species is actually curated in
the Structure Database, returning real **LM IDs** and the authoritative classification
(core → main class → sub class). Sphingolipids are queried with the `;O2` hydroxyl suffix
LMSD uses. Results are cached per process.

This is the honest bridge from the prototype's *rule-based* curated/gap guess to ground
truth; the full bulk ingest is issue #1. Lipid data © LIPID MAPS, **CC BY 4.0**.
