import { Fragment, useEffect } from 'react'
import { findClass, isomer } from '../lib/lipids'
import { getSpecies } from '../lib/service'
import { useLmsdStructure } from '../lib/lmsdStructures'
import { usePredictions, predictionFor } from '../lib/predictions'
import { downloadJSON, downloadSVG } from '../lib/download'
import Structure from './Structure'
import PredictionCard from './PredictionCard'
import ConfBadge, { ProvenanceLegend } from './ConfBadge'

/** A canonical, shareable, indexable page for one species — the growth engine. */
export default function SpeciesPage({ id, onBack }: { id: string; onBack: () => void }) {
  const rec = getSpecies(id)
  const cls = rec ? findClass(rec.class.k) : undefined
  const real = useLmsdStructure(id)
  const predFile = usePredictions()
  const pred = rec ? predictionFor(predFile, rec.id) : null

  useEffect(() => {
    if (!rec) return
    const prev = document.title
    document.title = `${rec.shorthand} (${rec.formula}) · LIPIVERSE`
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta) }
    meta.setAttribute('content', `${rec.shorthand} — ${rec.class.name}. Formula ${rec.formula}, exact mass ${rec.exactMass}. Predicted CCS, RT, logP; ${rec.origin === 'curated' ? 'curated in LIPID MAPS' : 'in-silico'}.`)
    return () => { document.title = prev }
  }, [rec])

  if (!rec || !cls) {
    return (
      <div className="app"><div className="doc"><span className="eyebrow">Not found</span>
        <h2 style={{ marginTop: 8 }}>No species “{id}”</h2>
        <p className="lede">Ids look like <code>PC-34-1</code>.</p>
        <button className="cta" onClick={onBack}>← Back to the atlas</button>
      </div></div>
    )
  }

  const { c, d } = { c: rec.composition.carbons, d: rec.composition.doubleBonds }
  const iso = isomer(cls, c, d)
  const adductRows = Object.entries(rec.adducts)

  const downloadStructure = () => downloadSVG(`${rec!.id}.svg`, document.querySelector('.sp-struct .struct-canvas svg'))
  // Pin the model version (and the values it produced) into the citation text itself — the
  // live page updates when the model is retrained, but a copied citation shouldn't silently
  // drift with it (issue #57).
  const predNote = pred && predFile ? `CCS ${pred.ccs.v} Å², RT ${pred.rt.v} min (model ${predFile.model_version}). ` : ''
  const cite = `LIPIVERSE. ${rec.shorthand} (${rec.formula}). ${real ? `LIPID MAPS ${real.lmId}. ` : ''}${predNote}Retrieved from lipiverse, ${location.origin}/#/species/${rec.id}`

  return (
    <div className="app">
      <div className="species-page">
        <button className="crumb" onClick={onBack}>← LIPIVERSE atlas</button>

        <header className="sp-hero">
          <div className="sp-badges">
            <span className={'badge ' + (rec.origin === 'curated' ? 'known' : 'gap')}>
              {rec.origin === 'curated' ? 'curated · LIPID MAPS' : 'predicted gap · in-silico'}
            </span>
            <span className="eyebrow">{rec.class.category}</span>
          </div>
          <h1 className="sp-title">{rec.shorthand}</h1>
          <div className="sp-sub">{cls.name}</div>
          <div className="sp-formula mono">{rec.formula} &nbsp;·&nbsp; {rec.exactMass} Da</div>
          {real && <div className="sp-ids mono">{real.lmId} · InChIKey {real.inchikey}</div>}
        </header>

        <section className="sp-struct">
          <Structure cls={cls} c={c} d={d} iso={iso} />
        </section>

        <div className="sp-grid">
          <div className="sp-card">
            <h3>Mass spectrometry</h3>
            <div className="kv">
              <div className="k">Exact mass</div><div className="v">{rec.exactMass} <span className="u">Da</span></div>
              {adductRows.map(([a, m]) => (<Fragment key={a}><div className="k">{a}</div><div className="v">{m} <span className="u">m/z</span></div></Fragment>))}
              <div className="k">CCS <ConfBadge m="predicted" /></div><div className="v">{rec.properties.ccs} <span className="u">Å²</span></div>
              <div className="k">RT (RP-C18) <ConfBadge m="predicted" /></div><div className="v">{rec.properties.rt} <span className="u">min</span></div>
              <div className="k">Diagnostic fragment</div><div className="v" style={{ fontSize: 12 }}>{rec.msmsHeadgroup.label}</div>
            </div>
          </div>

          <PredictionCard cls={cls} c={c} d={d} />

          <div className="sp-card">
            <h3>Physical &amp; synthesizability</h3>
            <div className="kv">
              <div className="k">logP <ConfBadge m="calculated" /></div><div className="v">{rec.properties.logP}</div>
              <div className="k">T<sub>m</sub> {rec.properties.tm != null && <ConfBadge m="predicted" />}</div><div className="v">{rec.properties.tm ?? 'n/a'} {rec.properties.tm != null && <span className="u">°C</span>}</div>
              <div className="k">Headgroup</div><div className="v">{rec.headgroupCharge}</div>
              <div className="k">Biosynthetic</div><div className="v">{rec.synthesizability.biosynthetic}<span className="u">/100</span></div>
              <div className="k">Chemical (SAScore)</div><div className="v">{rec.synthesizability.saScore}</div>
            </div>
          </div>

          {rec.membrane && (
            <div className="sp-card">
              <h3>Membrane biophysics <span className="pred-model">AFM-measurable</span></h3>
              <div className="kv">
                <div className="k">Phase at 37 °C</div><div className="v" style={{ fontSize: 12 }}>{rec.membrane.phase37}</div>
                <div className="k">Curvature</div><div className="v" style={{ fontSize: 12 }}>{rec.membrane.curvature}</div>
                <div className="k">Packing param.</div><div className="v">{rec.membrane.packing}</div>
                <div className="k">Bilayer thickness</div><div className="v">{rec.membrane.thicknessNm} <span className="u">nm</span></div>
                <div className="k">Area / lipid</div><div className="v">{rec.membrane.areaPerLipid} <span className="u">Å²</span></div>
                <div className="k">Breakthrough force</div><div className="v">{rec.membrane.breakthroughNn} <span className="u">nN</span></div>
                <div className="k">Compressibility K<sub>A</sub></div><div className="v">{rec.membrane.compressibilityKa} <span className="u">mN/m</span></div>
              </div>
            </div>
          )}

          <div className="sp-card">
            <h3>Biology &amp; occurrence</h3>
            <div className="kingdombadges" style={{ marginTop: 0 }}>
              {rec.class.kingdoms.map((k) => <span key={k} className="kbadge on">{k}</span>)}
            </div>
            <p className="occ">{rec.class.occurrence}</p>
            <p className="pathway" style={{ marginTop: 10 }}>{cls.pw}<br />
              <span style={{ color: 'var(--faint)' }}>Enzymes:</span> {cls.enz.map((e, i) => <span key={e}>{i > 0 && ' · '}<span className="enz">{e}</span></span>)}
              <br /><span style={{ color: 'var(--faint)' }}>Reaction:</span> <span className="enz">{cls.rhea}</span>
            </p>
          </div>

          <div className="sp-card">
            <h3>Identity &amp; access</h3>
            <div className="kv">
              <div className="k">Origin</div><div className="v" style={{ fontSize: 12 }}>{rec.origin === 'curated' ? 'curated in LMSD' : 'in-silico (enumerated)'}</div>
              <div className="k">LIPID MAPS</div><div className="v" style={{ fontSize: 12 }}>{real ? real.lmId : '—'}</div>
              <div className="k">InChIKey</div><div className="v" style={{ fontSize: 11 }}>{real ? real.inchikey : 'computed on demand'}</div>
              <div className="k">API</div><div className="v" style={{ fontSize: 11 }}>GET /species/{rec.id}</div>
            </div>
            <div className="sp-actions">
              <button className="cta ghost" onClick={() => downloadJSON(`${rec.id}.json`, rec)}>Download JSON</button>
              <button className="cta ghost" onClick={downloadStructure}>Structure SVG</button>
              <button className="cta ghost" onClick={() => navigator.clipboard?.writeText(cite)}>Copy citation</button>
              <a className="cta ghost" href={rec.literatureSearch} target="_blank" rel="noreferrer">Literature ↗</a>
            </div>
          </div>
        </div>

        <ProvenanceLegend />
        <p className="note" style={{ marginTop: 10 }}>
          Formula, exact mass, and adduct m/z are computed exactly. The CCS/RT shown under
          "Mass spectrometry" above are from a composition heuristic (issue #33 tracks
          remaining gaps: single-adduct/single-method scope, no monotonicity constraint) —
          where a real trained-model prediction exists for this species, it's shown separately
          in "Predicted properties" with its model version and 90% uncertainty interval.
          T<sub>m</sub> and synthesizability remain heuristic placeholders. Curated status is
          ingested from LIPID MAPS (CC BY 4.0).
        </p>
      </div>
    </div>
  )
}
