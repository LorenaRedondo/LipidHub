export type View = 'atlas' | 'search' | 'compare' | 'analytics' | 'refs' | 'pipe' | 'users'

const TABS: { id: View; label: string }[] = [
  { id: 'atlas', label: 'Atlas' },
  { id: 'search', label: 'Search' },
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
      <nav>
        {TABS.map((t) => (
          <button key={t.id} className={view === t.id ? 'on' : ''} onClick={() => onView(t.id)}>
            {t.label}
            {t.id === 'compare' && compareCount > 0 && <span className="navbadge">{compareCount}</span>}
          </button>
        ))}
      </nav>
      <div className="status">
        <span className="dot" />
        <span>Research preview · 17 lipid classes</span>
      </div>
    </header>
  )
}
