# LIPIDEX API & agent access

Three ways to consume the atlas, all over the same shared service layer
([`src/lib/service.ts`](../src/lib/service.ts)): a **REST API**, an **MCP server**, and a
**Claude Skill**. Because they share the model, all three return identical records.

> Research preview: `formula`, `exactMass`, and `adducts` are computed exactly.
> `ccs` / `rt` / `tm` / `synthesizability` are heuristic placeholders (see issue #3).

## REST API

```bash
npm run api        # http://localhost:8787  (API_PORT to override)
```

| Endpoint | Purpose |
|---|---|
| `GET /classes` | the 17 classes with taxonomy |
| `GET /species/:id` | one species, e.g. `/species/PC-34-1` |
| `GET /search?…` | faceted search (see params below) |
| `GET /identify?mz=760.585&ppm=10&adduct=[M+H]+` | candidate species for an m/z |
| `GET /compare?ids=PC-34-1,MGDG-34-2` | several species at once |
| `GET /gaps?class=SM&limit=50` | in-silico-only "gap" species |
| `GET /lmsd/:id` | **live LIPID MAPS verification** — real LM IDs + classification |
| `GET /species/:id?lmsd=1` | species record enriched with LMSD verification |

Search params: `q, classK, group, kingdom, massMin, massMax, carbonsMin, carbonsMax, dbMin, dbMax, origin, minBiosynthetic, maxSaScore, includeRare, page, pageSize`.

```bash
curl "localhost:8787/species/PC-34-1"
curl "localhost:8787/identify?mz=760.585&ppm=10&adduct=%5BM%2BH%5D%2B"
curl "localhost:8787/search?group=Glycolipids&kingdom=Plants&massMin=700&massMax=800"
```

## MCP server (for agents)

```bash
npm run mcp                          # stdio transport
claude mcp add lipidex -- npm run mcp
```

Tools: `list_lipid_classes`, `get_lipid`, `search_lipids`, `identify_by_mz`,
`compare_lipids`, `check_lmsd`, `find_gaps`. Smoke-test end-to-end:

```bash
npx tsx mcp/test-client.ts
# tools: list_lipid_classes, get_lipid, search_lipids, identify_by_mz, compare_lipids, find_gaps
# identify_by_mz 760.585 -> PC 34:1 | PE 37:1
```

## Claude Skill

[`skills/lipidex-atlas/SKILL.md`](../skills/lipidex-atlas/SKILL.md) packages the domain
guidance (identify from m/z, disambiguate isobars, read synthesizability, respect
predicted-vs-exact) on top of the MCP tools.

## Layering

```
src/lib/lipids.ts + smiles.ts   ← model (pure)
        └── src/lib/service.ts  ← query/record functions (pure, shared)
                ├── server/api.ts   ← REST (Hono)
                └── mcp/server.ts    ← MCP (stdio)  ──►  skills/lipidex-atlas  (agents)
```

In production the MCP server would proxy the REST API rather than importing the service
directly; for the prototype both call the shared layer so no extra process is required.

## Live LIPID MAPS verification

`check_lmsd` / `GET /lmsd/:id` query the [LIPID MAPS](https://www.lipidmaps.org) REST API
server-side (the browser can't — CORS) to confirm whether a species is actually curated in
the Structure Database, returning real **LM IDs** and the authoritative classification
(core → main class → sub class). Sphingolipids are queried with the `;O2` hydroxyl suffix
LMSD uses. Results are cached per process.

This is the honest bridge from the prototype's *rule-based* curated/gap guess to ground
truth; the full bulk ingest is issue #1. Lipid data © LIPID MAPS, **CC BY 4.0**.
