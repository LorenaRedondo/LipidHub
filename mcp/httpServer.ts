// ── LipidHub hosted MCP server (HTTP transport) ────────────────────────────
// Run: npm run mcp:http   (requires MCP_API_KEYS to be set — fails fast otherwise).
// Same tools as mcp/server.ts's stdio transport, reachable over the network for
// agents that don't have a local checkout of this repo. Auth: one shared API key
// per caller, checked against MCP_API_KEYS (comma-separated). Rate limited per key.
// See src/components/DataAccessView.tsx for connection instructions.
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { buildMcpServer } from './server'
import { checkRateLimit } from './rateLimit'

const rawKeys = process.env.MCP_API_KEYS ?? ''
const API_KEYS = new Set(rawKeys.split(',').map((k) => k.trim()).filter(Boolean))
if (!API_KEYS.size) {
  throw new Error('MCP_API_KEYS is not set — refusing to start an unauthenticated hosted MCP server. Set one or more comma-separated keys (e.g. `openssl rand -hex 32`).')
}

const app = new Hono()
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'mcp-session-id', 'mcp-protocol-version'],
  exposeHeaders: ['mcp-session-id', 'mcp-protocol-version'],
}))

app.get('/health', (c) => c.json({ ok: true }))

app.get('/', (c) => c.json({
  name: 'LipidHub hosted MCP server',
  transport: 'streamable-http',
  endpoint: '/mcp',
  auth: 'Authorization: Bearer <key>',
  rateLimit: '60 requests/minute per key',
  note: 'Same tools as the stdio server (npm run mcp) — see /health for liveness.',
}))

app.all('/mcp', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!key || !API_KEYS.has(key)) {
    return c.json({ error: 'unauthorized', hint: 'set Authorization: Bearer <key>' }, 401)
  }

  const rl = checkRateLimit(key)
  if (!rl.allowed) {
    c.header('Retry-After', String(rl.retryAfterSec))
    return c.json({ error: 'rate limit exceeded', retryAfterSec: rl.retryAfterSec }, 429)
  }

  const transport = new WebStandardStreamableHTTPServerTransport()
  const server = buildMcpServer()
  await server.connect(transport)
  return transport.handleRequest(c.req.raw)
})

const port = Number(process.env.MCP_HTTP_PORT) || 8788
serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`LipidHub MCP server (HTTP) on http://localhost:${info.port}/mcp — ${API_KEYS.size} key(s) configured`)
})
