import type { ReactNode } from 'react'

interface Persona { ic: string; name: string; role: string; task: string; gives: ReactNode }

const PERSONAS: Persona[] = [
  { ic: '◎', name: 'Mass-spec lipidomics analyst', role: 'core user · daily',
    task: 'An untargeted run throws an unknown feature at m/z 760.58, RT 11.3, CCS 301. Is it real, and what is it?',
    gives: <>Search by <b>mass or CCS window</b>, land on candidate cells, compare <b>predicted vs. their measured</b> RT/CCS/MS-MS to confirm or reject an ID — including for species not in any spectral library because the atlas predicted them.</> },
  { ic: '≋', name: 'Membrane biophysicist', role: 'research · project-driven',
    task: 'Compare how acyl-chain length and unsaturation change bilayer packing and geometry.',
    gives: <>Read <b>membrane geometry</b> from the Tanford/Israelachvili model — packing parameter, preferred curvature, bilayer thickness and area/lipid — alongside RDKit logP; see how one more double bond changes the packing across the grid. Phase state and nanomechanics are shown as "not available" until a measured tier exists.</> },
  { ic: '⚗', name: 'Synthetic chemist / biotech', role: 'discovery',
    task: "Find a lipid that's chemically makeable but not naturally abundant.",
    gives: <>Query the space directly: <b>high chemical-synthesizability (RDKit SAScore), low biosynthetic score</b> — i.e. the "lab-only" quadrant — with the properties to prioritise candidates. Retrosynthesis route generation is not yet implemented.</> },
  { ic: '⌗', name: 'Bioinformatician / data scientist', role: 'integrator · programmatic',
    task: 'Annotate features and join lipids to enzymes for a network model.',
    gives: <>Hit the <b>REST API or MCP tools</b>; every species carries a provenance-tagged property table (measured / calculated / predicted) that's safe to build pipelines on, plus LMSD cross-refs where curated. Bulk export and SPARQL are planned (issue #2), not built yet.</> },
  { ic: '⚕', name: 'Pharma / clinical researcher', role: 'translational',
    task: 'A lipid biomarker moves in disease — what makes it, and is it druggable?',
    gives: <>Trace a species to its <b>biosynthetic enzymes and pathway</b>, see structurally-neighbouring species that co-vary, and assess whether the pathway is a tractable target.</> },
  { ic: '✎', name: 'Educators & students', role: 'reach · low-friction',
    task: 'Teach why lipid diversity explodes combinatorially and where nature actually lives in that space.',
    gives: <>The gap map is a <b>teaching object</b> on its own: the "periodic table" framing makes the enumerable space and nature's occupied subset visible at a glance.</> },
]

export default function UsersView() {
  return (
    <section className="view on">
      <div className="doc">
        <span className="eyebrow">Who it's for</span>
        <h2 style={{ marginTop: 8 }}>One data model, several different jobs</h2>
        <p className="lede">
          The same data model serves different jobs. The "View as…" presets in the Atlas reorder the
          inspector so each user sees the fields most relevant to them first.
        </p>

        <div className="pgrid">
          {PERSONAS.map((p) => (
            <div className="ucard" key={p.name}>
              <div className="who">
                <span className="ic">{p.ic}</span>
                <div><h3>{p.name}</h3><div className="role">{p.role}</div></div>
              </div>
              <div className="task"><b>The task</b>{p.task}</div>
              <div className="gives">{p.gives}</div>
            </div>
          ))}
        </div>

        <div className="marketnote">
          <b>How LipidHub fits alongside the reference databases.</b> LipidHub builds on the resources
          the field already relies on — LIPID MAPS, Rhea, UniProt, HMDB — rather than replacing
          them. It adds three things they don't put in one place: the <em>enumerated</em> space shown
          beside the <em>catalogued</em> one, so the gaps are visible; properties inferred for every
          species from its composition; and an explicit label on every value — measured, calculated,
          or predicted — with the model behind it. Nothing predicted is hidden, so you can cite a
          number, or decide it's worth taking to the bench.
        </div>
      </div>
    </section>
  )
}
