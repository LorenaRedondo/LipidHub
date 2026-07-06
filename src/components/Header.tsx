export type View = 'atlas' | 'pipe' | 'users'

const TABS: { id: View; label: string }[] = [
  { id: 'atlas', label: 'Atlas' },
  { id: 'pipe', label: 'Pipeline' },
  { id: 'users', label: "Who it's for" },
]

export default function Header({ view, onView }: { view: View; onView: (v: View) => void }) {
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
          </button>
        ))}
      </nav>
      <div className="status">
        <span className="dot" />
        <span>demo build · 12 classes · properties computed live</span>
      </div>
    </header>
  )
}
