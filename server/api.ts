// ── LIPIDEX REST API ───────────────────────────────────────────────────────
// Run: npm run api   (tsx server/api.ts).  Thin HTTP layer over src/lib/service.
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  compare, findGaps, getSpecies, identifyByMz, listClasses, search,
} from '../src/lib/service'
import { enrichWithLmsd } from '../src/lib/lmsd'

const app = new Hono()
app.use('/*', cors())

const num = (v: string | undefined) => (v == null || v === '' ? undefined : Number(v))

app.get('/', (c) =>
  c.json({
    name: 'LIPIDEX API',
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
  return c.json(
    search({
      q: q.q, group: q.group, kingdom: q.kingdom,
      massMin: num(q.massMin), massMax: num(q.massMax),
      carbonsMin: num(q.carbonsMin), carbonsMax: num(q.carbonsMax),
      dbMin: num(q.dbMin), dbMax: num(q.dbMax),
      origin: q.origin as 'curated' | 'in_silico' | undefined,
      minBiosynthetic: num(q.minBiosynthetic), maxSaScore: num(q.maxSaScore),
      includeRare: q.includeRare === 'true',
      page: num(q.page), pageSize: num(q.pageSize),
    }),
  )
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

const port = Number(process.env.API_PORT) || 8787
serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`LIPIDEX API on http://localhost:${info.port}`)
})
