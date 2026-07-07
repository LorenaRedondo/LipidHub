// ── LIPIDEX MCP server ─────────────────────────────────────────────────────
// Exposes the atlas to agents. Run: npm run mcp  (stdio transport).
// Queries the SQLite-backed adapter (same layer server/api.ts uses; in
// production it would proxy the REST API). Add to Claude Code with:
//   claude mcp add lipidex -- npm run mcp
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  compare, findGaps, findLabOnly, getSpecies, identifyByMz, listClasses, search,
} from '../server/db'
import { enrichWithLmsd } from '../src/lib/lmsd'
import { verifyPathway } from '../src/lib/pathway'
import { findClass } from '../src/lib/lipids'
import predData from '../src/data/predictions.json'

const PRED = predData as unknown as { model_version: string; predictions: Record<string, unknown> }

const server = new McpServer({ name: 'lipidex', version: '0.1.0' })

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] })

server.registerTool(
  'list_lipid_classes',
  { title: 'List lipid classes', description: 'List all lipid classes in the atlas with their taxonomy (group, LIPID MAPS category, kingdoms of occurrence).', inputSchema: {} },
  async () => json(listClasses()),
)

server.registerTool(
  'get_lipid',
  {
    title: 'Get a lipid species',
    description: 'Return the full record for one species by id or shorthand (e.g. "PC-34-1" or "PC 34:1"): formula, exact mass, adduct m/z, predicted CCS/RT/logP/Tm, synthesizability, biological taxonomy, SMILES, and a literature link.',
    inputSchema: { id: z.string().describe('Species id or shorthand, e.g. PC-34-1 or "MGDG 34:6"') },
  },
  async ({ id }) => {
    const rec = getSpecies(id)
    return rec ? json(rec) : json({ error: 'not found', hint: 'ids look like PC-34-1 (class-carbons-doublebonds)' })
  },
)

server.registerTool(
  'search_lipids',
  {
    title: 'Search the lipidome',
    description: 'Faceted search over the enumerated lipidome. Filter by text, class group, kingdom, mass range, carbon/double-bond range, origin (curated vs in_silico gap), and synthesizability. Returns a total count and a page of records.',
    inputSchema: {
      q: z.string().optional().describe('free text: matches shorthand or class name'),
      classK: z.string().optional().describe('exact class, e.g. PC, MGDG, SM'),
      group: z.string().optional().describe('Glycerophospholipids | Glycerolipids | Glycolipids | Sphingolipids | Sterol lipids | Fatty acyls'),
      kingdom: z.string().optional().describe('Animals | Plants | Algae | Fungi | Bacteria | Archaea'),
      massMin: z.number().optional(),
      massMax: z.number().optional(),
      origin: z.enum(['curated', 'in_silico']).optional(),
      minBiosynthetic: z.number().optional().describe('0–100'),
      maxSaScore: z.number().optional().describe('synthetic-accessibility ceiling, 1(easy)–10(hard)'),
      pageSize: z.number().optional(),
    },
  },
  async (args) => json(search(args)),
)

server.registerTool(
  'identify_by_mz',
  {
    title: 'Identify a lipid by m/z',
    description: 'Given an observed m/z from a mass-spec run, return candidate lipid species within a ppm tolerance for a given adduct. The core untargeted-lipidomics identification step.',
    inputSchema: {
      mz: z.number().describe('observed m/z'),
      ppm: z.number().optional().describe('mass tolerance in ppm (default 10)'),
      adduct: z.string().optional().describe('adduct, e.g. [M+H]+ (default), [M-H]-, [M+NH4]+, [M+HCOO]-'),
    },
  },
  async ({ mz, ppm, adduct }) => json({ query: { mz, ppm: ppm ?? 10, adduct: adduct ?? '[M+H]+' }, candidates: identifyByMz(mz, ppm ?? 10, adduct ?? '[M+H]+') }),
)

server.registerTool(
  'compare_lipids',
  {
    title: 'Compare lipid species',
    description: 'Return full records for several species side by side (2–6 ids).',
    inputSchema: { ids: z.array(z.string()).describe('species ids, e.g. ["PC-34-1","MGDG-34-2"]') },
  },
  async ({ ids }) => json({ species: compare(ids) }),
)

server.registerTool(
  'predict_properties',
  {
    title: 'Predict CCS & RT with uncertainty',
    description: 'Return ML-predicted collision cross-section (CCS) and retention time (RT) for a species, each with a 90% calibrated uncertainty interval and the model version. Precomputed by the property engine.',
    inputSchema: { id: z.string().describe('species id, e.g. PC-34-1') },
  },
  async ({ id }) => {
    const p = PRED.predictions[id]
    return p ? json({ id, model_version: PRED.model_version, method: 'predicted', ...p, note: '90% conformal intervals; demo model (issue #33)' })
      : json({ error: 'no prediction for this id (only plausible enumerated species are precomputed)' })
  },
)

server.registerTool(
  'check_lmsd',
  {
    title: 'Verify against LIPID MAPS',
    description: 'Check whether a species is actually curated in the LIPID MAPS Structure Database (LMSD) — the authoritative reference. Returns real LM IDs and the official classification (core / main class / sub class), or confirms it is an uncatalogued gap. Use this to ground-truth an identification before reporting it.',
    inputSchema: { id: z.string().describe('species id or shorthand, e.g. PC-34-1') },
  },
  async ({ id }) => {
    const rec = getSpecies(id)
    if (!rec) return json({ error: 'not found', hint: 'ids look like PC-34-1' })
    const lmsd = await enrichWithLmsd(rec.shorthand, rec.class.group)
    return json({ species: { id: rec.id, shorthand: rec.shorthand, formula: rec.formula, exactMass: rec.exactMass }, lmsd })
  },
)

server.registerTool(
  'find_gaps',
  {
    title: 'Find predicted gaps',
    description: 'Return species that are in-silico only (not curated) — the "gaps" in the atlas — optionally for one class. Useful for discovering enumerable-but-uncatalogued lipids.',
    inputSchema: { classK: z.string().optional().describe('restrict to a class, e.g. SM'), limit: z.number().optional() },
  },
  async ({ classK, limit }) => json({ gaps: findGaps(classK, limit ?? 50) }),
)

server.registerTool(
  'check_pathway',
  {
    title: 'Verify a class\'s biosynthetic pathway',
    description: 'Live-check a lipid class\'s declared enzymes (UniProt, reviewed human genes) and reaction (Rhea, approved + balanced), and discover the real, complete enzyme set UniProt annotates for that reaction plus its real substrate/product names — not just a verification of a hand-picked guess (#5).',
    inputSchema: { classK: z.string().describe('class code, e.g. PC, MGDG, SM') },
  },
  async ({ classK }) => {
    const cls = findClass(classK)
    if (!cls) return json({ error: 'not found', hint: 'class looks like PC, MGDG, SM' })
    return json(await verifyPathway(cls))
  },
)

server.registerTool(
  'find_lab_only',
  {
    title: 'Find lab-only lipids (the valuable quadrant)',
    description: 'Return species with high chemical accessibility (low SAScore) but low biosynthetic accessibility — lab-makeable lipids nature doesn\'t produce (e.g. candidate novel LNP components).',
    inputSchema: { limit: z.number().optional() },
  },
  async ({ limit }) => json({ species: findLabOnly(limit ?? 50) }),
)

const transport = new StdioServerTransport()
await server.connect(transport)
// eslint-disable-next-line no-console
console.error('LIPIDEX MCP server ready (stdio)')
