// ── LIPIVERSE REST API ──────────────────────────────────────────────────────
// Run: npm run api   (tsx server/api.ts).  Thin HTTP layer over src/lib/service.
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  compare, findGaps, findLabOnly, getSpecies, identifyByMz, listClasses, search,
} from './db'
import { enrichWithLmsd } from '../src/lib/lmsd'
import { verifyPathway } from '../src/lib/pathway'
import { findClass } from '../src/lib/lipids'
import predData from '../src/data/predictions.json'

const PRED = predData as unknown as { model_version: string; unit: Record<string, string>; predictions: Record<string, { ccs: { v: number; lo: number; hi: number }; rt: { v: number; lo: number; hi: number } }> }

const app = new Hono()
app.use('/*', cors())

const num = (v: string | undefined) => (v == null || v === '' ? undefined : Number(v))

app.get('/', (c) =>
  c.json({
    name: 'LIPIVERSE API',
    version: '0.1.0',
    note: 'Research preview. mass/formula/adducts are exact; CCS/RT/Tm/synthesizability are heuristic placeholders (issue #3).',
    endpoints: [
      'GET /health',
      'GET /classes',
      'GET /species/:id            (e.g. /species/PC-34-1 ; add ?lmsd=1 to verify against LIPID MAPS)',
      'GET /lmsd/:id               (live LIPID MAPS LMSD verification: real LM IDs + classification)',
      'GET /search?q=&group=&kingdom=&massMin=&massMax=&carbonsMin=&carbonsMax=&dbMin=&dbMax=&origin=&minBiosynthetic=&maxSaScore=&page=&pageSize=',
      'GET /identify?mz=760.585&ppm=10&adduct=[M+H]+',
      'GET /compare?ids=PC-34-1,MGDG-34-2',
      'GET /gaps?class=PC&limit=50',
      'GET /predict/:id             (ML CCS/RT with 90% uncertainty intervals)',
      'GET /pathway/:class          (live UniProt/Rhea pathway verification + the real discovered enzyme/reaction graph, #5)',
      'GET /lab-only?limit=50       (the "valuable quadrant": high chemical accessibility, low biosynthetic)',
    ],
  }),
)

app.get('/health', (c) => c.json({ ok: true }))
app.get('/classes', (c) => c.json(listClasses()))

app.get('/species/:id', async (c) => {
  const rec = getSpecies(c.req.param('id'))
  if (!rec) return c.json({ error: 'not found', hint: 'id looks like PC-34-1' }, 404)
  if (c.req.query('lmsd')) {
    const lmsd = await enrichWithLmsd(rec.shorthand, rec.class.group)
    return c.json({ ...rec, origin: lmsd.inLMSD ? 'curated' : rec.origin, lmsd })
  }
  return c.json(rec)
})

// live LIPID MAPS verification for a species
app.get('/lmsd/:id', async (c) => {
  const rec = getSpecies(c.req.param('id'))
  if (!rec) return c.json({ error: 'not found', hint: 'id looks like PC-34-1' }, 404)
  const lmsd = await enrichWithLmsd(rec.shorthand, rec.class.group)
  return c.json({ species: { id: rec.id, shorthand: rec.shorthand, formula: rec.formula, exactMass: rec.exactMass }, lmsd })
})

app.get('/search', (c) => {
  const q = c.req.query()
  const params = {
    q: q.q, group: q.group, kingdom: q.kingdom,
    massMin: num(q.massMin), massMax: num(q.massMax),
    carbonsMin: num(q.carbonsMin), carbonsMax: num(q.carbonsMax),
    dbMin: num(q.dbMin), dbMax: num(q.dbMax),
    origin: q.origin as 'curated' | 'in_silico' | undefined,
    minBiosynthetic: num(q.minBiosynthetic), maxSaScore: num(q.maxSaScore),
    includeRare: q.includeRare === 'true',
    page: num(q.page), pageSize: q.format === 'csv' ? 5000 : num(q.pageSize),
  }
  const res = search(params)
  if (q.format === 'csv') {
    const head = 'id,shorthand,group,formula,exact_mass,ccs_pred,rt_pred,logp,origin,biosynthetic,sascore'
    const rows = res.results.map((r) => [r.id, r.shorthand, r.class.group, r.formula, r.exactMass, r.properties.ccs, r.properties.rt, r.properties.logP, r.origin, r.synthesizability.biosynthetic, r.synthesizability.saScore].join(','))
    return c.body([head, ...rows].join('\n'), 200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="lipiverse-search.csv"' })
  }
  return c.json(res)
})

app.get('/identify', (c) => {
  const mz = num(c.req.query('mz'))
  if (mz == null || !isFinite(mz)) return c.json({ error: 'mz query param required, e.g. ?mz=760.585' }, 400)
  return c.json({ query: { mz, ppm: num(c.req.query('ppm')) ?? 10, adduct: c.req.query('adduct') ?? '[M+H]+' },
    candidates: identifyByMz(mz, num(c.req.query('ppm')) ?? 10, c.req.query('adduct') ?? '[M+H]+') })
})

app.get('/compare', (c) => {
  const ids = (c.req.query('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!ids.length) return c.json({ error: 'ids query param required, e.g. ?ids=PC-34-1,MGDG-34-2' }, 400)
  return c.json({ species: compare(ids) })
})

app.get('/gaps', (c) => c.json({ gaps: findGaps(c.req.query('class'), num(c.req.query('limit')) ?? 50) }))

// live UniProt/Rhea verification of a class's declared enzymes + reaction (issue #4)
app.get('/pathway/:class', async (c) => {
  const cls = findClass(c.req.param('class'))
  if (!cls) return c.json({ error: 'not found', hint: 'class looks like PC, MGDG, SM' }, 404)
  return c.json(await verifyPathway(cls))
})

// the "valuable quadrant" (#4): high chemical accessibility, low biosynthetic
app.get('/lab-only', (c) => c.json({ species: findLabOnly(num(c.req.query('limit')) ?? 50) }))

// ML property predictions with calibrated uncertainty (from ml/train.py)
app.get('/predict/:id', (c) => {
  const p = PRED.predictions[c.req.param('id')]
  if (!p) return c.json({ error: 'no prediction for this id', hint: 'only plausible enumerated species are precomputed' }, 404)
  return c.json({ id: c.req.param('id'), model_version: PRED.model_version, method: 'predicted', units: PRED.unit,
    ccs: p.ccs, rt: p.rt, note: 'demo model trained on synthetic targets (issue #33); 90% conformal intervals' })
})

const port = Number(process.env.API_PORT) || 8787
serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`LIPIVERSE API on http://localhost:${info.port}`)
})
