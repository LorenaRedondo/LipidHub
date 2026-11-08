import { useMemo, useState } from 'react'
import { GROUPS, KINGDOMS, type Kingdom } from '../lib/lipids'
import { search, type SearchParams } from '../lib/service'
import { downloadCSV } from '../lib/download'
import { MAX_PINS, type Pin } from '../App'

const PAGE = 25

interface Props {
  onOpen: (clsK: string, c: number, d: number) => void
  pins: Pin[]
  onTogglePin: (pin: Pin) => void
}

const numOr = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s))

export default function SearchView({ onOpen, pins, onTogglePin }: Props) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [kingdom, setKingdom] = useState<Kingdom | ''>('')
  const [origin, setOrigin] = useState<'' | 'curated' | 'in_silico'>('')
  const [massMin, setMassMin] = useState('')
  const [massMax, setMassMax] = useState('')
  const [dbMin, setDbMin] = useState('')
  const [dbMax, setDbMax] = useState('')
  const [minBio, setMinBio] = useState('')
  const [maxSa, setMaxSa] = useState('')
  const [page, setPage] = useState(1)

  const params: SearchParams = {
    q, group: group || undefined, kingdom: kingdom || undefined,
    origin: origin || undefined,
    massMin: numOr(massMin), massMax: numOr(massMax),
    dbMin: numOr(dbMin), dbMax: numOr(dbMax),
    minBiosynthetic: numOr(minBio), maxSaScore: numOr(maxSa),
    page, pageSize: PAGE,
  }
  // reset to page 1 whenever a filter (other than page) changes
  const filterKey = JSON.stringify({ ...params, page: 0 })
  const result = useMemo(() => search({ ...JSON.parse(filterKey), page, pageSize: PAGE }), [filterKey, page])
  const pages = Math.max(1, Math.ceil(result.total / PAGE))

  function exportCsv() {
    const all = search({ ...JSON.parse(filterKey), page: 1, pageSize: 5000 }).results
    downloadCSV('lipidhub-search.csv',
      ['id', 'shorthand', 'group', 'category', 'formula', 'exact_mass', 'ccs_pred', 'rt_pred', 'logp', 'origin', 'biosynthetic', 'sascore', 'kingdoms'],
      all.map((r) => [r.id, r.shorthand, r.class.group, r.class.category, r.formula, r.exactMass, r.properties.ccs ?? '', r.properties.rt ?? '', r.properties.logP ?? '', r.origin, r.synthesizability.biosynthetic, r.synthesizability.saScore, r.class.kingdoms.join('|')]))
  }

  function reset() {
    setQ(''); setGroup(''); setKingdom(''); setOrigin(''); setMassMin(''); setMassMax('')
    setDbMin(''); setDbMax(''); setMinBio(''); setMaxSa(''); setPage(1)
  }
  const onFilter = (fn: () => void) => { fn(); setPage(1) }

  return (
    <section className="view on">
      <div className="doc wide">
        <span className="eyebrow">Search</span>
        <h2 style={{ marginTop: 8 }}>Query the lipidome</h2>
        <p className="lede">
          Search and filter across every plausible species instead of browsing class by class.
          Runs over the same service layer the API and MCP tools use.{' '}
          <span style={{ color: 'var(--faint)' }}>Mass/formula exact; CCS/synthesizability predicted.</span>
        </p>

        <div className="srch-bar">
          <span className="mag">⌕</span>
          <input
            value={q}
            onChange={(e) => onFilter(() => setQ(e.target.value))}
            placeholder="name or shorthand — e.g. sphingomyelin, MGDG, PC 34"
            autoComplete="off" spellCheck={false}
          />
        </div>

        <div className="facets">
          <label className="facet">Group
            <select value={group} onChange={(e) => onFilter(() => setGroup(e.target.value))}>
              <option value="">any</option>
              {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="facet">Kingdom
            <select value={kingdom} onChange={(e) => onFilter(() => setKingdom(e.target.value as Kingdom | ''))}>
              <option value="">any</option>
              {KINGDOMS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <div className="facet">Origin
            <div className="seg" role="group" aria-label="Filter by origin">
              <button aria-pressed={origin === ''} className={origin === '' ? 'on' : ''} onClick={() => onFilter(() => setOrigin(''))}>any</button>
              <button aria-pressed={origin === 'curated'} className={origin === 'curated' ? 'on' : ''} onClick={() => onFilter(() => setOrigin('curated'))}>curated</button>
              <button aria-pressed={origin === 'in_silico'} className={origin === 'in_silico' ? 'on' : ''} onClick={() => onFilter(() => setOrigin('in_silico'))}>gaps</button>
            </div>
          </div>
          <label className="facet">Mass
            <span className="rng">
              <input value={massMin} onChange={(e) => onFilter(() => setMassMin(e.target.value))} placeholder="min" inputMode="numeric" />–
              <input value={massMax} onChange={(e) => onFilter(() => setMassMax(e.target.value))} placeholder="max" inputMode="numeric" />
            </span>
          </label>
          <label className="facet">Double bonds
            <span className="rng">
              <input value={dbMin} onChange={(e) => onFilter(() => setDbMin(e.target.value))} placeholder="min" inputMode="numeric" />–
              <input value={dbMax} onChange={(e) => onFilter(() => setDbMax(e.target.value))} placeholder="max" inputMode="numeric" />
            </span>
          </label>
          <label className="facet">Min biosynthetic
            <input className="one" value={minBio} onChange={(e) => onFilter(() => setMinBio(e.target.value))} placeholder="0–100" inputMode="numeric" />
          </label>
          <label className="facet">Max SAScore
            <input className="one" value={maxSa} onChange={(e) => onFilter(() => setMaxSa(e.target.value))} placeholder="1–10" inputMode="numeric" />
          </label>
          <button className="cta ghost srch-reset" onClick={reset}>clear</button>
        </div>

        <div className="srch-count">
          <b className="num">{result.total.toLocaleString()}</b> species match
          <span className="an-sub"> · showing {result.results.length ? (page - 1) * PAGE + 1 : 0}–{(page - 1) * PAGE + result.results.length}</span>
          {result.total > 0 && <button className="dl-link" onClick={exportCsv}>download CSV ↓</button>}
        </div>

        <div className="cmp-scroll">
          <table className="cmp srch-table">
            <thead>
              <tr>
                <th>Species</th><th>Group</th><th className="num">Formula</th><th className="num">Mass</th>
                <th className="num">CCS</th><th className="num">logP</th><th>Origin</th><th className="num">bio / SA</th><th /><th />
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => {
                const pin: Pin = { clsK: r.class.k, c: r.composition.carbons, d: r.composition.doubleBonds }
                const isPinned = pins.some((p) => p.clsK === pin.clsK && p.c === pin.c && p.d === pin.d)
                const compareFull = pins.length >= MAX_PINS && !isPinned
                return (
                  <tr key={r.id}>
                    <td className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{r.shorthand}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.class.group}</td>
                    <td className="num">{r.formula}</td>
                    <td className="num">{r.exactMass.toFixed(4)}</td>
                    <td className="num">{r.properties.ccs ?? 'n/a'}</td>
                    <td className="num">{r.properties.logP ?? 'n/a'}</td>
                    <td>
                      <span className={'badge ' + (r.origin === 'curated' ? 'known' : 'gap')} style={{ fontSize: 9 }}>
                        {r.origin === 'curated' ? 'curated' : 'gap'}
                      </span>
                    </td>
                    <td className="num">{r.synthesizability.biosynthetic} / {r.synthesizability.saScore}</td>
                    <td>
                      <button
                        className={'pinbtn' + (isPinned ? ' on' : '')}
                        disabled={compareFull}
                        onClick={() => onTogglePin(pin)}
                        title={compareFull ? `Compare is full (${MAX_PINS})` : 'Add to side-by-side comparison'}
                      >
                        {isPinned ? '✓ comparing' : compareFull ? 'compare full' : '+ compare'}
                      </button>
                    </td>
                    <td><button className="openbtn" onClick={() => onOpen(r.class.k, r.composition.carbons, r.composition.doubleBonds)}>open →</button></td>
                  </tr>
                )
              })}
              {!result.results.length && (
                <tr><td colSpan={10} style={{ color: 'var(--muted)', padding: '26px 16px', textAlign: 'center' }}>No species match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="pager">
            <button className="cta ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← prev</button>
            <span className="num">page {page} / {pages}</span>
            <button className="cta ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>next →</button>
          </div>
        )}
      </div>
    </section>
  )
}
