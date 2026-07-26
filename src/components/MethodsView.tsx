import meta from '../data/meta.json'

const REAL_VS_ILLUSTRATIVE: { component: string; current: string; target: string }[] = [
  { component: 'Formula & exact mass', current: 'computed exactly from backbone + acyl chains', target: 'same' },
  { component: 'Adduct m/z', current: 'computed exactly', target: 'same' },
  { component: 'CCS / RT', current: `real ML model (${meta.models.ccsRt}), shown in the Inspector, Analytics, REST, and MCP with a 90% interval; "not available" where the model doesn't cover the species; CCS validated against held-out real experimental data`, target: 'per-adduct/per-method scope, evaluate a GNN, monotonicity constraint (see issue #33)' },
  { component: 'logP', current: `real RDKit Crippen calculation (${meta.models.logP}) for species with a valid SMILES — shown everywhere (frontend + API/MCP); "not available" otherwise`, target: 'TPSA / other descriptors (see issue #3)' },
  { component: 'Tm', current: 'not reported — no reliable measured or trained source (was previously a composition heuristic; removed)', target: 'trained model or QSPR' },
  { component: 'Synthesizability', current: `chemical: real RDKit SAScore (${meta.models.chemSascore}), shown everywhere; "not available" (labelled composition estimate) where no RDKit value. biosynthetic: composition estimate, live-verified against UniProt/Rhea server-side`, target: 'retrosynthesis route generation (see issue #52)' },
  { component: 'Membrane geometry', current: 'Tanford/Israelachvili packing, curvature, thickness, area — a geometric model estimate, labelled as such', target: 'measured tier (AFM / X-ray)' },
  { component: 'Origin & pathway graph', current: `real — enzymes discovered from UniProt's catalytic-activity annotations per Rhea reaction (${meta.models.pathway})`, target: 'per-species (not per-class) enzyme specificity' },
  { component: 'Known vs. gap status', current: `real — ingested from LMSD (${meta.lmsdRecordsScanned.toLocaleString()} structures scanned)`, target: 'full structures/InChIKeys for every curated species' },
  { component: 'Classes', current: `${meta.classes} across 6 groups (GP, GL, glycolipids, SP, ST, FA) — incl. free sterols & oxysterols`, target: '+ archaeal/prenol ether lipids, gangliosides, …' },
  { component: 'Biological taxonomy', current: 'kingdom occurrence per class (curated)', target: 'per-species, from HMDB/literature' },
  { component: 'Per-species citations', current: 'live Europe PMC search per class', target: 'curated refs via database integration' },
  { component: '2D structures', current: 'real LIPID MAPS structures for curated species; SMILES built from composition (illustrative double-bond positions) for gaps', target: 'canonical SVGs cached server-side (RDKit) for every species' },
  { component: 'Bulk export / SPARQL', current: 'not built — see issue #7', target: 'full-atlas download + SPARQL endpoint' },
  { component: 'Retrosynthesis routes', current: 'not built — public AiZynthFinder model validated but chemically unreliable for lipids, see issue #52', target: 'on-demand route generation, cached on success' },
]

export default function MethodsView() {
  return (
    <section className="view on">
      <div className="doc">
        <span className="eyebrow">Methods</span>
        <h2 style={{ marginTop: 8 }}>What's real, what's a placeholder, and as of when</h2>
        <p className="lede">
          Every value in this atlas is tagged <b>measured</b>, <b>calculated</b>, or{' '}
          <b>predicted</b> at the point of use — this page is the consolidated version, generated
          from the same build that's currently running, not hand-maintained prose that can drift
          out of sync with it.
        </p>

        <h3 className="refsub">This build</h3>
        <table className="methods-table">
          <tbody>
            <tr><th>Built</th><td className="cur">{new Date(meta.builtAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
            <tr><th>Classes</th><td className="cur">{meta.classes}</td></tr>
            <tr><th>Species (curated / gap / rare)</th><td className="cur">{meta.species.curated.toLocaleString()} / {meta.species.gap.toLocaleString()} / {meta.species.rare.toLocaleString()} — {meta.species.total.toLocaleString()} total</td></tr>
            <tr><th>LMSD structures scanned</th><td className="cur">{meta.lmsdRecordsScanned.toLocaleString()} (CC BY 4.0, lipidmaps.org)</td></tr>
            <tr><th>CCS / RT model</th><td className="cur">{meta.models.ccsRt}</td></tr>
            <tr><th>Chemical SAScore model</th><td className="cur">{meta.models.chemSascore}</td></tr>
            <tr><th>logP model</th><td className="cur">{meta.models.logP}</td></tr>
            <tr><th>Pathway verification model</th><td className="cur">{meta.models.pathway}</td></tr>
          </tbody>
        </table>

        <h3 className="refsub">What is real vs. illustrative</h3>
        <table className="methods-table">
          <thead><tr><th>Component</th><th>This build</th><th>Target</th></tr></thead>
          <tbody>
            {REAL_VS_ILLUSTRATIVE.map((r) => (
              <tr key={r.component}>
                <td className="cur">{r.component}</td>
                <td className="cur">{r.current}</td>
                <td className="tgt">{r.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
