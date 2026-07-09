// Smoke-tests the MCP server end-to-end over stdio.
// Run: npx tsx mcp/test-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'mcp/server.ts'] })
const client = new Client({ name: 'lipiverse-test', version: '0.1.0' })
await client.connect(transport)

const tools = await client.listTools()
console.log('tools:', tools.tools.map((t) => t.name).join(', '))

async function call(name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args })
  const text = (r.content as { type: string; text: string }[])[0]?.text ?? ''
  const parsed = JSON.parse(text)
  return parsed
}

const lipid = await call('get_lipid', { id: 'PC-34-1' })
console.log('get_lipid PC-34-1 ->', lipid.formula, lipid.exactMass, lipid.origin)

const id = await call('identify_by_mz', { mz: 760.585, ppm: 10 })
console.log('identify_by_mz 760.585 ->', id.candidates.map((c: { record: { shorthand: string } }) => c.record.shorthand).join(' | '))

const gaps = await call('find_gaps', { classK: 'SM', limit: 3 })
console.log('find_gaps SM ->', gaps.gaps.map((g: { shorthand: string }) => g.shorthand).join(' | '))

const lmsd = await call('check_lmsd', { id: 'PC-34-1' })
console.log('check_lmsd PC-34-1 -> inLMSD', lmsd.lmsd.inLMSD, '| LM IDs', lmsd.lmsd.lmIds.slice(0, 2).join(', '), '|', lmsd.lmsd.classification?.subClass)

const pp = await call('predict_properties', { id: 'PC-34-1' })
console.log('predict_properties PC-34-1 ->', pp.model_version, '| CCS', pp.ccs.v, `[${pp.ccs.lo}-${pp.ccs.hi}]`, '| RT', pp.rt.v)

const pathway = await call('check_pathway', { classK: 'PC' })
console.log('check_pathway PC -> confidence', pathway.confidence, '| enzymes found', pathway.enzymes.filter((e: { found: boolean }) => e.found).length, '/', pathway.enzymes.length, '| reaction', pathway.reaction.found, pathway.reaction.approved, pathway.reaction.balanced)
console.log('  discovered enzymes ->', pathway.discoveredEnzymes.map((e: { gene?: string }) => e.gene).join(', '))
console.log('  substrates ->', pathway.substrates.map((p: { name: string }) => p.name).join(' + '), '-> products ->', pathway.products.map((p: { name: string }) => p.name).join(' + '))

const labOnly = await call('find_lab_only', { limit: 3 })
console.log('find_lab_only ->', labOnly.species.map((s: { shorthand: string; synthesizability: { saScore: number; biosynthetic: number } }) => `${s.shorthand} (sa=${s.synthesizability.saScore}, bio=${s.synthesizability.biosynthetic})`).join(' | '))

await client.close()
console.log('\n✓ MCP server responds correctly over stdio')
process.exit(0)
