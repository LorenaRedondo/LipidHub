// Smoke-tests the MCP server end-to-end over stdio.
// Run: npx tsx mcp/test-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'mcp/server.ts'] })
const client = new Client({ name: 'lipidex-test', version: '0.1.0' })
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

await client.close()
console.log('\n✓ MCP server responds correctly over stdio')
process.exit(0)
