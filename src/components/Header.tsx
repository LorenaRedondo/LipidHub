export type View = 'atlas' | 'search' | 'identify' | 'compare' | 'analytics' | 'refs' | 'pipe' | 'users'

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

export default function Header({ view, onView, compareCount }: { view: View; onView: (v: View) => void; compareCount: number }) {
  return (
    <header>
      <div className="brand">
        <span className="logo">LIPID<b>EX</b></span>
        <span className="tag">A navigable atlas of the known &amp; predicted lipidome</span>
      </div>
      <nav aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} aria-current={view === t.id ? 'page' : undefined} className={view === t.id ? 'on' : ''} onClick={() => onView(t.id)}>
            {t.label}
            {t.id === 'compare' && compareCount > 0 && (
              <span className="navbadge" aria-label={`${compareCount} pinned for comparison`}>{compareCount}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="status">
        <span className="dot" />
        <span>Research preview · 20 classes · curated status from LMSD</span>
      </div>
    </header>
  )
}
