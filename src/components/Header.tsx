import { useRef } from 'react'
import meta from '../data/meta.json'

export type View = 'atlas' | 'search' | 'identify' | 'compare' | 'analytics' | 'refs' | 'pipe' | 'users' | 'access' | 'methods'

const TABS: { id: View; label: string }[] = [
  { id: 'atlas', label: 'Atlas' },
  { id: 'search', label: 'Search' },
  { id: 'identify', label: 'Identify' },
  { id: 'compare', label: 'Compare' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'refs', label: 'References' },
  { id: 'pipe', label: 'Pipeline' },
  { id: 'users', label: "Who it's for" },
]

const RESOURCES: { id: View; label: string }[] = [
  { id: 'access', label: 'Data & Access' },
  { id: 'methods', label: 'Methods' },
]

export default function Header({ view, onView, compareCount }: { view: View; onView: (v: View) => void; compareCount: number }) {
  const hamburgerRef = useRef<HTMLDetailsElement>(null)
  const navmenuRef = useRef<HTMLDetailsElement>(null)

  const go = (id: View) => {
    onView(id)
    hamburgerRef.current?.removeAttribute('open')
    navmenuRef.current?.removeAttribute('open')
  }

  return (
    <>
    <header>
      <div className="brand">
        <span className="logo">LIPI<b>VERSE</b></span>
        <span className="tag">A navigable atlas of the known &amp; predicted lipidome</span>
      </div>

      <nav aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} aria-current={view === t.id ? 'page' : undefined} className={view === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            {t.label}
            {t.id === 'compare' && compareCount > 0 && (
              <span className="navbadge" aria-label={`${compareCount} pinned for comparison`}>{compareCount}</span>
            )}
          </button>
        ))}
      </nav>

      {/* mobile-only: collapses the primary tabs above into a disclosure menu */}
      <details className="hamburger" ref={hamburgerRef}>
        <summary aria-label="Open navigation menu">☰ Menu</summary>
        <div className="navmenu-list">
          {TABS.map((t) => (
            <button key={t.id} aria-current={view === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              {t.label}{t.id === 'compare' && compareCount > 0 ? ` (${compareCount})` : ''}
            </button>
          ))}
          <div className="sep" />
          {RESOURCES.map((r) => (
            <button key={r.id} aria-current={view === r.id ? 'page' : undefined} onClick={() => go(r.id)}>{r.label}</button>
          ))}
          <a href="https://github.com/LorenaRedondo/LipidHub" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </details>

      {/* always visible: docs/API/methods, kept separate from the primary data-browsing tabs */}
      <details className="navmenu" ref={navmenuRef}>
        <summary aria-label="Open resources menu">Resources ▾</summary>
        <div className="navmenu-list">
          {RESOURCES.map((r) => (
            <button key={r.id} aria-current={view === r.id ? 'page' : undefined} onClick={() => go(r.id)}>{r.label}</button>
          ))}
          <div className="sep" />
          <a href="https://github.com/LorenaRedondo/LipidHub" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </details>

    </header>
    <div className="substatus">
      <span className="dot" />
      <span>
        {meta.species.curated.toLocaleString()} curated species · {meta.classes} classes · from {meta.lmsdRecordsScanned.toLocaleString()} LMSD structures
      </span>
      <button className="fullpage-link" style={{ margin: 0, background: 'none', border: 'none', padding: 0, font: 'inherit' }} onClick={() => go('methods')}>details →</button>
    </div>
    </>
  )
}
