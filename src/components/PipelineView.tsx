interface Stage { step: string; title: string; items: string[]; why: string }

const STAGES: Stage[] = [
  { step: '01 · INGEST', title: 'Reference sources',
    items: ['LIPID MAPS LMSD — ~48k curated', 'LMISSD + COMP_DB — 1.1M in-silico', 'SwissLipids — enzyme/pathway', 'Rhea · UniProt — reactions', 'HMDB · ChEBI — context & ontology'],
    why: 'All open, all with bulk + API access.' },
  { step: '02 · RECONCILE', title: 'Normalize & dedup',
    items: ['Canonical LIPID MAPS shorthand', 'InChIKey / SMILES identity', 'Cross-reference IDs across DBs', 'RDKit structure standardization'],
    why: 'One species = one node, many sources.' },
  { step: '03 · ENUMERATE', title: 'Define the space',
    items: ['headgroup × acyl-chain generator', 'chemically-sane bounds & rules', 'diff vs. curated → the gaps'],
    why: 'This is what makes the "periodic table" complete.' },
  { step: '04 · INFER', title: 'Property engine',
    items: ['RDKit — formula, mass, logP, TPSA', 'ML — CCS, RT, in-silico MS/MS', 'heuristics — Tm, packing', 'synthesizability — bio + chemical'],
    why: 'Every gap gets predicted, testable properties.' },
  { step: '05 · SERVE', title: 'Access layer',
    items: ['Postgres + RDKit cartridge', 'graph store for pathways', 'REST · SPARQL · bulk export', 'the Atlas UI (this)'],
    why: 'Researchers meet it as UI, API, or download.' },
]

const SCHEMA_HTML = `<span class="cm">-- one row per canonical species; identity by structure, not name</span>
<span class="kw">TABLE</span> species (
  id            <span class="ty">uuid PK</span>,
  shorthand     <span class="ty">text</span>,        <span class="cm">-- 'PC 34:1'</span>
  lipid_class   <span class="ty">text</span>,        <span class="cm">-- FK → class ontology (LIPID MAPS)</span>
  n_carbon      <span class="ty">int</span>,  n_dbond <span class="ty">int</span>,
  formula       <span class="ty">text</span>,  exact_mass <span class="ty">numeric</span>,
  inchikey      <span class="ty">text UNIQUE</span>,
  origin        <span class="ty">enum</span>(<span class="st">'curated'</span>,<span class="st">'in_silico'</span>)   <span class="cm">-- ← is it a gap?</span>
);

<span class="cm">-- every property value knows how it was produced</span>
<span class="kw">TABLE</span> property (
  species_id    <span class="ty">uuid FK</span>,
  key           <span class="ty">text</span>,        <span class="cm">-- 'ccs_mh', 'rt_rp', 'tm', 'logp'…</span>
  value         <span class="ty">numeric</span>,
  method        <span class="ty">enum</span>(<span class="st">'measured'</span>,<span class="st">'calculated'</span>,<span class="st">'predicted'</span>),
  model_version <span class="ty">text</span>,        <span class="cm">-- 'DeepCCS v2.1' — reproducible</span>
  confidence    <span class="ty">numeric</span>,     <span class="cm">-- ± interval</span>
  source        <span class="ty">text</span>          <span class="cm">-- DOI / DB accession</span>
);

<span class="kw">TABLE</span> pathway  (species_id, enzyme_uniprot, rhea_rxn, direction);
<span class="kw">TABLE</span> synth    (species_id, bio_score, chem_sascore, route_json);
<span class="kw">TABLE</span> xref     (species_id, db, accession);   <span class="cm">-- LMSD, SwissLipids, HMDB…</span>`

export default function PipelineView() {
  return (
    <section className="view on">
      <div className="doc">
        <span className="eyebrow">Data architecture</span>
        <h2 style={{ marginTop: 8 }}>From five fragmented sources to one queryable atlas</h2>
        <p className="lede">
          Nothing here needs to be invented from scratch — the reference data exists and ships with
          open licences and APIs. The work is <b>reconciliation, enumeration, and inference</b>, plus
          the two layers nobody has built: systematic synthesizability, and the gap map. Everything
          flows left to right; every value carries its provenance.
        </p>

        <div className="pipe">
          {STAGES.map((s) => (
            <div className="pcard" key={s.step}>
              <span className="step">{s.step}</span>
              <h3>{s.title}</h3>
              <ul>{s.items.map((it) => <li key={it}>{it}</li>)}</ul>
              <span className="why">{s.why}</span>
            </div>
          ))}
        </div>
        <div className="pipe-arrows"><span>→</span><span>→</span><span>→</span><span>→</span><span /></div>

        <div className="schema">
          <div className="bar-t"><span style={{ color: 'var(--amber)' }}>◧</span> core schema — provenance is a first-class citizen</div>
          <pre dangerouslySetInnerHTML={{ __html: SCHEMA_HTML }} />
        </div>

        <div className="callouts">
          <div className="callout">
            <h3><span className="chip">novel</span> Synthesizability as a real column</h3>
            <p>
              No lipid DB systematically answers "can I make this?". We split it: a <b>biosynthetic
              score</b> (live-verified enzyme + reaction match against UniProt/Rhea) and a{' '}
              <b>chemical score</b> (the real RDKit SAScore; a retrosynthesis pass, e.g. AiZynthFinder,
              is not yet implemented). That single distinction —
              nature-accessible vs. lab-accessible vs. neither — is defensible and, as far as the
              reference DBs go, unoccupied.
            </p>
          </div>
          <div className="callout">
            <h3><span className="chip">trust</span> Predicted ≠ measured, always visible</h3>
            <p>
              Researchers won't adopt a black box. Every number in the inspector is tagged{' '}
              <span style={{ color: 'var(--known)' }}>measured</span>,{' '}
              <span style={{ color: 'var(--cyan)' }}>calculated</span>, or{' '}
              <span style={{ color: 'var(--gold)' }}>predicted</span>, with the model version and an
              uncertainty interval. A value is a claim with a receipt — which is exactly what lets
              someone cite it, or decide to go measure it.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
