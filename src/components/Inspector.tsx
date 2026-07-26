import type { ReactNode } from 'react'
import {
  FORMATE, KINGDOMS, NH4, PROTON, faFragment, fam, formulaParts, headgroupCharge,
  isomer, membraneBiophysics, pmcSearchUrl, prefersAmmonium, props, status, synth,
  type LipidClass, type Method, type Persona,
} from '../lib/lipids'
import { ccsRtFor, logpFor, saScoreFor, chemScoreFromSa, SOURCE } from '../lib/realProps'
import { MAX_PINS, type Cell, type Pin } from '../App'
import { useLmsdStructure } from '../lib/lmsdStructures'
import { pathwayForClass, usePathwayGraph } from '../lib/pathwayGraph'
import Structure from './Structure'
import ConfBadge, { ProvenanceLegend } from './ConfBadge'

function KV({ k, v, u, m }: { k: ReactNode; v: ReactNode; u?: string; m?: Method }) {
  return (
    <>
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {u && <span className="u"> {u}</span>}
        {m && <ConfBadge m={m} />}
      </div>
    </>
  )
}

function Section({ title, tag, focus, children }: { title: string; tag: string; focus?: boolean; children: ReactNode }) {
  return (
    <div className={'section' + (focus ? ' focus' : '')}>
      <h4>{title}<span className="tagm">{tag}</span></h4>
      {children}
    </div>
  )
}

function Formula({ cls, c, d }: { cls: LipidClass; c: number; d: number }) {
  return (
    <>
      {formulaParts(props(cls, c, d).f).map((p) => (
        <span key={p.el}>{p.el}{p.n > 1 && <sub>{p.n}</sub>}</span>
      ))}
    </>
  )
}

interface Props { cls: LipidClass; sel: Cell | null; persona: Persona; pins: Pin[]; onTogglePin: (pin: Pin) => void }

export default function Inspector({ cls, sel, persona, pins, onTogglePin }: Props) {
  const real = useLmsdStructure(sel ? `${cls.k}-${sel.c}-${sel.d}` : '')
  const pathwayGraph = usePathwayGraph()
  const realPathway = pathwayForClass(pathwayGraph, cls.k)
  if (!sel) {
    return <div className="insp-empty">Select a cell in the map<br />to inspect a species →</div>
  }
  const { c, d } = sel
  const id = `${cls.k}-${c}-${d}`
  const p = props(cls, c, d)
  const sy = synth(cls, c, d)
  const st = status(cls, c, d)
  const pr = ccsRtFor(id)          // real trained-model CCS/RT, or null
  const lp = logpFor(id)           // real RDKit Crippen logP, or null
  const sa = saScoreFor(id)        // real RDKit SAScore, or null
  const iso = isomer(cls, c, d)
  const ammon = prefersAmmonium(cls)
  const isPinned = pins.some((x) => x.clsK === cls.k && x.c === c && x.d === d)
  const compareFull = pins.length >= MAX_PINS && !isPinned

  const badge =
    st === 'known' ? <span className="badge known">curated · LMSD</span>
    : st === 'gap' ? <span className="badge gap">predicted gap</span>
    : <span className="badge rare">rare / edge</span>

  const idline = real
    ? `${real.lmId} · InChIKey ${real.inchikey}`
    : st === 'known'
      ? 'curated in LIPID MAPS'
      : `in-silico  LEX:${cls.k}-${c}-${d} · not in LMSD`

  const secMS = (
    <Section title="Mass spec — identification" tag="exact m/z · trained-model CCS/RT" focus={persona === 'analyst'}>
      <div className="kv">
        <KV k="Exact mass (neutral)" v={p.M.toFixed(4)} u="Da" m="calculated" />
        <KV k="[M+H]⁺" v={(p.M + PROTON).toFixed(4)} u="m/z" m="calculated" />
        <KV k="[M−H]⁻" v={(p.M - PROTON).toFixed(4)} u="m/z" m="calculated" />
        <KV
          k={ammon ? '[M+NH₄]⁺' : '[M+HCOO]⁻'}
          v={(ammon ? p.M + NH4 : p.M + FORMATE).toFixed(4)}
          u="m/z" m="calculated"
        />
        {pr
          ? <KV k={`CCS ${cls.pref}`} v={<>{pr.ccs.v} <span className="ci">[{pr.ccs.lo}–{pr.ccs.hi}]</span></>} u="Å²" m="predicted" />
          : <KV k={`CCS ${cls.pref}`} v="not available" />}
        {pr
          ? <KV k="RT (RP-C18, 20 min)" v={<>{pr.rt.v} <span className="ci">[{pr.rt.lo}–{pr.rt.hi}]</span></>} u="min" m="predicted" />
          : <KV k="RT (RP-C18, 20 min)" v="not available" />}
      </div>
      <p className="note" style={{ marginTop: 8 }}>
        {pr
          ? <>CCS &amp; RT source: {SOURCE.ccsRt}.</>
          : <>No trained-model CCS/RT for this species — shown as <b>not available</b> rather than a heuristic guess.</>}
      </p>
    </Section>
  )

  const secMSMS = (
    <Section title="Predicted MS/MS" tag={cls.kind === 'sterol' ? 'fixed structure' : 'most abundant isomer'}>
      <p className="note" style={{ margin: '-4px 0 10px' }}>
        {cls.kind === 'sterol'
          ? <>The ring system's carbon:double-bond count fixes a single real structure — no sn-position or chain-split ambiguity to flag here.</>
          : <>Diagnostic fragments for the likely isomer <b>{iso.map((x) => `${x[0]}:${x[1]}`).join(' / ')}</b>. Sum composition alone can't fix sn-position — flagged, not hidden.</>}
      </p>
      <div className="frag">
        <span className="lab">{cls.hgFrag.lab}</span>
        <span className="mz">{cls.hgFrag.mz != null ? cls.hgFrag.mz.toFixed(4) : '—'}</span>
      </div>
      {cls.kind === 'sphingo' ? (
        <>
          <div className="frag">
            <span className="lab">sphingoid base d{iso[0][0]}:{iso[0][1]}</span>
            <span className="mz">—</span>
          </div>
          <div className="frag">
            <span className="lab">N-acyl FA {iso[1][0]}:{iso[1][1]} [FA−H]⁻</span>
            <span className="mz">{faFragment(iso[1][0], iso[1][1]).toFixed(4)}</span>
          </div>
        </>
      ) : cls.kind === 'sterol' ? (
        <p className="note" style={{ margin: '4px 0 0' }}>
          No acyl chain to fragment — the ring system's dehydration ion above is the
          characteristic diagnostic fragment for free sterols/oxysterols.
        </p>
      ) : (
        iso.map((ch, i) => (
          <div className="frag" key={i}>
            <span className="lab">FA {ch[0]}:{ch[1]} [FA−H]⁻</span>
            <span className="mz">{faFragment(ch[0], ch[1]).toFixed(4)}</span>
          </div>
        ))
      )}
    </Section>
  )

  const secBio = (
    <Section title="Physical properties" tag="RDKit + exact" focus={persona === 'biophys'}>
      <div className="kv">
        {lp != null
          ? <KV k="logP" v={lp} m="calculated" />
          : <KV k="logP" v="not available" />}
        <KV k={<>Transition T<sub>m</sub></>} v="not available" />
        <KV k="Carbons / DB" v={`C${c} · ${d} =`} m="calculated" />
        <KV k="Headgroup" v={headgroupCharge(cls)} m="measured" />
      </div>
      <p className="note" style={{ marginTop: 8 }}>
        {lp != null && <>logP source: {SOURCE.logP}. </>}
        T<sub>m</sub> has no reliable per-species source (measured or trained) and is not reported.
      </p>
    </Section>
  )

  const saVal = sa ?? sy.sa            // prefer real RDKit SAScore; heuristic only as a labelled estimate
  const chemVal = sa != null ? chemScoreFromSa(sa) : sy.chem
  const bioVerdict = sy.bio > 60
    ? <><span className="ok">✔ biosynthesized</span> — pathway present</>
    : sy.bio > 25
      ? <><span className="mid">~ minor / conditional</span> — enzyme exists, species uncommon</>
      : <><span className="no">✘ not known in nature</span> — no reported pathway</>
  const chemVerdict = saVal < 4
    ? <span className="ok">✔ readily synthesizable</span>
    : saVal < 6
      ? <span className="mid">~ multi-step</span>
      : <span className="no">✘ demanding</span>

  const secSynth = (
    <Section title="Synthesizability" tag="bio + chemical" focus={persona === 'chem'}>
      <div className="synth-row">
        <div className="top"><span>Biosynthetic accessibility</span><b>{sy.bio}/100</b></div>
        <div className="bar"><i style={{ width: `${sy.bio}%`, background: 'var(--known)' }} /></div>
      </div>
      <div className="synth-row">
        <div className="top"><span>Chemical (100−SAScore)</span><b>{chemVal}/100 · SA {saVal}</b></div>
        <div className="bar"><i style={{ width: `${chemVal}%`, background: 'var(--gold)' }} /></div>
      </div>
      <p className="verdict">
        {bioVerdict}<br />
        {chemVerdict} — SAScore {saVal}. Retrosynthesis route generation not yet implemented (issue #4).
      </p>
      <p className="note" style={{ marginTop: 8 }}>
        Chemical: {sa != null ? SOURCE.saScore : 'composition estimate (no RDKit SAScore for this species)'}.
        Biosynthetic accessibility is a composition-based estimate (live-verified against UniProt/Rhea server-side).
      </p>
    </Section>
  )

  const secOrigin = (
    <Section title="Origin & biosynthesis" tag="UniProt · Rhea">
      <p className="pathway">
        {cls.pw}<br />
        <span style={{ color: 'var(--faint)' }}>Enzymes (documented):</span>{' '}
        {cls.enz.map((e, i) => (
          <span key={e}>{i > 0 && ' · '}<span className="enz">{e}</span></span>
        ))}
        <br />
        <span style={{ color: 'var(--faint)' }}>Reaction:</span> <span className="enz">{cls.rhea}</span>
      </p>
      {realPathway && (
        <p className="pathway">
          <span style={{ color: 'var(--faint)' }}>Enzymes (discovered — live UniProt catalytic-activity match, precomputed at build):</span>{' '}
          {realPathway.enzymes.map((e, i) => (
            <span key={e.accession}>{i > 0 && ' · '}<span className="enz" title={e.proteinName}>{e.gene ?? e.accession}</span></span>
          ))}
          {realPathway.equation && (
            <>
              <br />
              <span style={{ color: 'var(--faint)' }}>Reaction (Rhea):</span>{' '}
              {realPathway.substrates.map((p) => p.name).join(' + ')} ⇌ {realPathway.products.map((p) => p.name).join(' + ')}
            </>
          )}
        </p>
      )}
    </Section>
  )

  const secXref = (
    <Section title="Identity & access" tag="provenance" focus={persona === 'bioinfo'}>
      <div className="kv">
        <KV k="Origin" v={st === 'known' ? 'curated in LMSD' : 'in-silico (enumerated)'} m="measured" />
        <KV k="LIPID MAPS ID" v={real ? real.lmId : st === 'known' ? 'curated' : '—'} m="measured" />
        <KV k="InChIKey" v={real ? real.inchikey : 'computed on demand'} m={real ? 'measured' : 'calculated'} />
        <KV k="API" v={`GET /species/${cls.k}-${c}-${d}`} m="measured" />
      </div>
    </Section>
  )

  const mem = membraneBiophysics(cls, c, d)
  const secMembrane = mem ? (
    <Section title="Membrane geometry" tag="Tanford/Israelachvili model" focus={persona === 'biophys'}>
      <div className="kv">
        <KV k="Packing / curvature" v={`${mem.packing} · ${mem.curvature}`} m="calculated" />
        <KV k="Bilayer thickness" v={mem.thicknessNm} u="nm" m="calculated" />
        <KV k="Area / lipid" v={mem.areaPerLipid} u="Å²" m="calculated" />
      </div>
      <p className="note" style={{ marginTop: 8 }}>
        Source: the Israelachvili packing parameter P = v/(a₀·l_c) with Tanford hydrocarbon
        volume/length and literature per-class headgroup areas — a geometric model estimate.
        Phase state, T<sub>m</sub>, AFM breakthrough force and the compressibility modulus had no
        validated per-species source and are shown as <b>not available</b> until a measured tier exists.
      </p>
    </Section>
  ) : null

  const secTax = (
    <Section title="Taxonomy & occurrence" tag="biological">
      <div className="kv">
        <KV k="LIPID MAPS category" v={cls.category} />
        <KV k="Group" v={cls.group} />
      </div>
      <div className="kingdombadges">
        {KINGDOMS.map((kg) => (
          <span key={kg} className={'kbadge' + (cls.kingdoms.includes(kg) ? ' on' : '')}>{kg}</span>
        ))}
      </div>
      <p className="occ">{cls.occurrence}</p>
    </Section>
  )

  const secLit = (
    <Section title="Literature" tag="Europe PMC">
      <p className="note" style={{ margin: '-2px 0 10px' }}>
        Real papers where <b>{cls.k}</b> species appear — opens a live Europe PMC search (no fabricated citations).
      </p>
      <a className="litlink" href={pmcSearchUrl(cls)} target="_blank" rel="noreferrer">
        Search “{cls.name}” on Europe PMC →
      </a>
      <p className="note" style={{ marginTop: 10 }}>
        Curated per-species citations arrive with database integration (#5, #7).
      </p>
    </Section>
  )

  const sections: Record<Persona, ReactNode[]> = {
    analyst: [secMS, secMSMS, secBio, secMembrane, secSynth, secTax, secOrigin, secLit, secXref],
    biophys: [secMembrane, secBio, secTax, secMS, secOrigin, secSynth, secMSMS, secLit, secXref],
    chem: [secSynth, secOrigin, secTax, secBio, secMembrane, secMS, secLit, secXref, secMSMS],
    bioinfo: [secXref, secTax, secMS, secOrigin, secSynth, secBio, secMembrane, secLit, secMSMS],
  }

  const tips: Record<Persona, string> = {
    analyst: "Match your feature's m/z + CCS + RT against these predictions to confirm an ID even with no library spectrum.",
    biophys: 'Membrane geometry is up top: packing parameter, preferred curvature, bilayer thickness and area per lipid, from the Tanford/Israelachvili model. Walk cells to see how a double bond changes the packing.',
    chem: "Look for high chemical + low biosynthetic score — lab-accessible lipids nature doesn't make.",
    bioinfo: 'Every field here is one API call away; origin flag tells you measured vs. predicted before you trust it.',
  }

  return (
    <>
      <div className="insp-head">
        <div className="cls">
          {badge}<span className="eyebrow">{cls.group}</span>
          <button
            className={'pinbtn' + (isPinned ? ' on' : '')}
            disabled={compareFull}
            onClick={() => onTogglePin({ clsK: cls.k, c, d })}
            title={compareFull ? `Compare is full (${MAX_PINS})` : 'Add to side-by-side comparison'}
          >
            {isPinned ? '✓ comparing' : compareFull ? 'compare full' : '+ compare'}
          </button>
        </div>
        <h3>{cls.k} {fam(c, d)}</h3>
        <div className="formula em">
          <Formula cls={cls} c={c} d={d} /> &nbsp;·&nbsp; {p.M.toFixed(4)} Da
        </div>
        <div className="idline">{idline}</div>
        <a className="fullpage-link" href={`#/species/${cls.k}-${c}-${d}`}>open full page ↗</a>
      </div>
      <div className="schematic"><Structure cls={cls} c={c} d={d} iso={iso} /></div>
      <div className="tip"><b>{persona} view</b>{tips[persona]}</div>
      <ProvenanceLegend />
      {sections[persona].map((node, i) => <div key={i}>{node}</div>)}
    </>
  )
}
