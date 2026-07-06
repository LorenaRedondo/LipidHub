import type { ReactNode } from 'react'
import {
  FORMATE, KINGDOMS, NH4, PROTON, faFragment, fam, formulaParts, headgroupCharge,
  isomer, pmcSearchUrl, prefersAmmonium, props, status, synth,
  type LipidClass, type Method, type Persona,
} from '../lib/lipids'
import { MAX_PINS, type Cell, type Pin } from '../App'
import { useLmsdStructure } from '../lib/lmsdStructures'
import Structure from './Structure'

function Conf({ m }: { m: Method }) {
  const cls = m === 'measured' ? 'meas' : m === 'calculated' ? 'calc' : 'pred'
  const label = m === 'measured' ? 'meas' : m === 'calculated' ? 'calc' : 'pred'
  return <span className={`conf ${cls}`}>{label}</span>
}

function KV({ k, v, u, m }: { k: ReactNode; v: ReactNode; u?: string; m?: Method }) {
  return (
    <>
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {u && <span className="u"> {u}</span>}
        {m && <Conf m={m} />}
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
  if (!sel) {
    return <div className="insp-empty">Select a cell in the map<br />to inspect a species →</div>
  }
  const { c, d } = sel
  const p = props(cls, c, d)
  const sy = synth(cls, c, d)
  const st = status(cls, c, d)
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
    <Section title="Mass spec — identification" tag="predicted from formula" focus={persona === 'analyst'}>
      <div className="kv">
        <KV k="Exact mass (neutral)" v={p.M.toFixed(4)} u="Da" m="calculated" />
        <KV k="[M+H]⁺" v={(p.M + PROTON).toFixed(4)} u="m/z" m="calculated" />
        <KV k="[M−H]⁻" v={(p.M - PROTON).toFixed(4)} u="m/z" m="calculated" />
        <KV
          k={ammon ? '[M+NH₄]⁺' : '[M+HCOO]⁻'}
          v={(ammon ? p.M + NH4 : p.M + FORMATE).toFixed(4)}
          u="m/z" m="calculated"
        />
        <KV k={`CCS ${cls.pref}`} v={p.ccs} u="Å²" m="predicted" />
        <KV k="RT (RP-C18, 20 min)" v={p.rt} u="min" m="predicted" />
      </div>
    </Section>
  )

  const secMSMS = (
    <Section title="Predicted MS/MS" tag="most abundant isomer">
      <p className="note" style={{ margin: '-4px 0 10px' }}>
        Diagnostic fragments for the likely isomer <b>{iso.map((x) => `${x[0]}:${x[1]}`).join(' / ')}</b>.
        Sum composition alone can't fix sn-position — flagged, not hidden.
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
    <Section title="Membrane / physical" tag="heuristic + RDKit" focus={persona === 'biophys'}>
      <div className="kv">
        {p.tm != null
          ? <KV k={<>Transition T<sub>m</sub></>} v={p.tm} u="°C" m="predicted" />
          : <KV k={<>Transition T<sub>m</sub></>} v="n/a — neutral lipid" m="calculated" />}
        <KV k="logP" v={p.logp} m="calculated" />
        <KV k="Carbons / DB" v={`C${c} · ${d} =`} m="calculated" />
        <KV k="Headgroup" v={headgroupCharge(cls)} m="measured" />
      </div>
    </Section>
  )

  const bioVerdict = sy.bio > 60
    ? <><span className="ok">✔ biosynthesized</span> — pathway present</>
    : sy.bio > 25
      ? <><span className="mid">~ minor / conditional</span> — enzyme exists, species uncommon</>
      : <><span className="no">✘ not known in nature</span> — no reported pathway</>
  const chemVerdict = sy.sa < 4
    ? <span className="ok">✔ readily synthesizable</span>
    : sy.sa < 6
      ? <span className="mid">~ multi-step</span>
      : <span className="no">✘ demanding</span>

  const secSynth = (
    <Section title="Synthesizability" tag="bio + chemical" focus={persona === 'chem'}>
      <div className="synth-row">
        <div className="top"><span>Biosynthetic accessibility</span><b>{sy.bio}/100</b></div>
        <div className="bar"><i style={{ width: `${sy.bio}%`, background: 'var(--known)' }} /></div>
      </div>
      <div className="synth-row">
        <div className="top"><span>Chemical (100−SAScore)</span><b>{sy.chem}/100 · SA {sy.sa}</b></div>
        <div className="bar"><i style={{ width: `${sy.chem}%`, background: 'var(--amber)' }} /></div>
      </div>
      <p className="verdict">
        {bioVerdict}<br />
        {chemVerdict} — SAScore {sy.sa}, retrosynthesis route available.
      </p>
    </Section>
  )

  const secOrigin = (
    <Section title="Origin & biosynthesis" tag="SwissLipids · Rhea">
      <p className="pathway">
        {cls.pw}<br />
        <span style={{ color: 'var(--faint)' }}>Enzymes:</span>{' '}
        {cls.enz.map((e, i) => (
          <span key={e}>{i > 0 && ' · '}<span className="enz">{e}</span></span>
        ))}
        <br />
        <span style={{ color: 'var(--faint)' }}>Reaction:</span> <span className="enz">{cls.rhea}</span>
      </p>
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
    analyst: [secMS, secMSMS, secBio, secSynth, secTax, secOrigin, secLit, secXref],
    biophys: [secBio, secTax, secMS, secOrigin, secSynth, secMSMS, secLit, secXref],
    chem: [secSynth, secOrigin, secTax, secBio, secMS, secLit, secXref, secMSMS],
    bioinfo: [secXref, secTax, secMS, secOrigin, secSynth, secBio, secLit, secMSMS],
  }

  const tips: Record<Persona, string> = {
    analyst: "Match your feature's m/z + CCS + RT against these predictions to confirm an ID even with no library spectrum.",
    biophys: 'Scan neighbouring cells: +1 double bond or +2 carbons shows how Tm and logP shift across the class.',
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
      {sections[persona].map((node, i) => <div key={i}>{node}</div>)}
    </>
  )
}
