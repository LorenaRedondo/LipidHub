const ENDPOINTS: { method: string; path: string; purpose: string }[] = [
  { method: 'GET', path: '/classes', purpose: 'every lipid class with its taxonomy' },
  { method: 'GET', path: '/species/:id', purpose: 'one species, e.g. /species/PC-34-1' },
  { method: 'GET', path: '/search?…', purpose: 'faceted search (mass, kingdom, origin, synthesizability, …)' },
  { method: 'GET', path: '/identify?mz=&ppm=&adduct=', purpose: 'candidate species for an observed m/z' },
  { method: 'GET', path: '/compare?ids=', purpose: 'several species at once' },
  { method: 'GET', path: '/gaps?class=&limit=', purpose: 'in-silico-only "gap" species' },
  { method: 'GET', path: '/lmsd/:id', purpose: 'live LIPID MAPS verification — real LM IDs + classification' },
  { method: 'GET', path: '/pathway/:class', purpose: 'live UniProt/Rhea enzyme + reaction verification' },
  { method: 'GET', path: '/lab-only?limit=', purpose: 'high chemical, low biosynthetic accessibility' },
  { method: 'GET', path: '/predict/:id', purpose: 'ML CCS/RT with 90% uncertainty intervals' },
]

const MCP_TOOLS = [
  'list_lipid_classes', 'get_lipid', 'search_lipids', 'identify_by_mz', 'compare_lipids',
  'predict_properties', 'check_lmsd', 'find_gaps', 'check_pathway', 'find_lab_only',
]

export default function DataAccessView() {
  return (
    <section className="view on">
      <div className="doc">
        <span className="eyebrow">Data &amp; access</span>
        <h2 style={{ marginTop: 8 }}>Query this atlas from code</h2>
        <p className="lede">
          Everything in the interactive views runs over the same three surfaces below — a{' '}
          <b>REST API</b>, an <b>MCP server</b> for agents, and a <b>Claude Skill</b> with domain
          guidance on top of it. Formula/mass/adducts are computed exactly; CCS/RT are real
          ML predictions with uncertainty where a model is available. See <b>Methods</b> for
          model versions and what's still heuristic.
        </p>

        <h3 className="refsub">REST API</h3>
        <div className="plancode"><span className="cm"># build the store once, then run the server</span>{'\n'}
          npm run db:build{'\n'}
          npm run api        <span className="cm"># http://localhost:8787 (API_PORT to override)</span>
        </div>
        <table className="endpoint-table">
          <thead><tr><th>Endpoint</th><th>Returns</th></tr></thead>
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={e.path}>
                <td className="ep">{e.method} {e.path}</td>
                <td>{e.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="plancode">
          curl "localhost:8787/species/PC-34-1"{'\n'}
          curl "localhost:8787/identify?mz=760.585&amp;ppm=10&amp;adduct=%5BM%2BH%5D%2B"{'\n'}
          curl "localhost:8787/search?group=Glycolipids&amp;kingdom=Plants&amp;massMin=700"
        </div>

        <h3 className="refsub">MCP server (for agents)</h3>
        <p className="note" style={{ marginBottom: 10 }}>
          Same records as the REST API, exposed as tools over stdio — built for Claude and
          other MCP-compatible agents to query directly.
        </p>
        <div className="plancode">
          npm run mcp{'\n'}
          claude mcp add lipiverse -- npm run mcp
        </div>
        <p className="note" style={{ marginBottom: 20 }}>
          Tools: {MCP_TOOLS.map((t, i) => <span key={t}><code>{t}</code>{i < MCP_TOOLS.length - 1 ? ', ' : ''}</span>)}
        </p>

        <h3 className="refsub">Claude Skill</h3>
        <p className="note" style={{ marginBottom: 20 }}>
          <code>skills/lipiverse-atlas/SKILL.md</code> packages domain guidance — identifying
          from m/z, disambiguating isobars, respecting predicted-vs-exact — on top of the MCP
          tools above.
        </p>

        <h3 className="refsub">Bulk dataset export</h3>
        <p className="note">
          <span className="status-pill planned" style={{ marginRight: 8 }}>planned</span>
          A full-atlas download (all curated + enumerated species, CSV/Parquet) and a SPARQL
          endpoint are tracked in{' '}
          <a href="https://github.com/alpibrusl/lipidex/issues/7" target="_blank" rel="noreferrer">issue #7</a>{' '}
          — not built yet. Every interactive view (Search, Identify, Compare, Analytics) has a
          CSV/SVG export for its current result set in the meantime.
        </p>
      </div>
    </section>
  )
}
