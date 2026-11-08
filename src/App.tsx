import { useCallback, useEffect, useState } from 'react'
import { CLASSES, dMaxOf, findClass, type LipidClass, type Persona } from './lib/lipids'
import Disclaimer from './components/Disclaimer'
import Header, { type View } from './components/Header'
import AtlasView from './components/AtlasView'
import PipelineView from './components/PipelineView'
import UsersView from './components/UsersView'
import CompareView from './components/CompareView'
import AnalyticsView from './components/AnalyticsView'
import ReferencesView from './components/ReferencesView'
import SearchView from './components/SearchView'
import IdentifyView from './components/IdentifyView'
import SpeciesPage from './components/SpeciesPage'
import DataAccessView from './components/DataAccessView'
import MethodsView from './components/MethodsView'

export interface Cell { c: number; d: number }
export interface Pin { clsK: string; c: number; d: number }
export const MAX_PINS = 4

/** Canonical species-page route: #/species/PC-34-1 */
function matchSpeciesRoute(): string | null {
  const m = location.hash.match(/^#\/species\/([A-Za-z]+-\d+-\d+)$/)
  return m ? m[1] : null
}

export default function App() {
  const [view, setView] = useState<View>('atlas')
  const [cls, setCls] = useState<LipidClass>(CLASSES[0])
  const [sel, setSel] = useState<Cell | null>(null)
  const [persona, setPersona] = useState<Persona>('analyst')
  const [pins, setPins] = useState<Pin[]>([])
  const [speciesRoute, setSpeciesRoute] = useState<string | null>(() => matchSpeciesRoute())

  const select = useCallback((c: number, d: number, c2 = cls) => {
    setSel({ c, d })
    try { history.replaceState(null, '', `#${c2.k}-${c}-${d}`) } catch { /* noop */ }
  }, [cls])

  const selectClass = useCallback((next: LipidClass) => {
    setCls(next)
    setSel(null)
  }, [])

  const openInAtlas = useCallback((clsK: string, c: number, d: number) => {
    const cl = findClass(clsK)
    if (!cl) return
    setCls(cl)
    setSel({ c, d })
    try { history.replaceState(null, '', `#${cl.k}-${c}-${d}`) } catch { /* noop */ }
    setView('atlas')
  }, [])

  const togglePin = useCallback((pin: Pin) => {
    setPins((prev) => {
      const i = prev.findIndex((p) => p.clsK === pin.clsK && p.c === pin.c && p.d === pin.d)
      if (i >= 0) return prev.filter((_, j) => j !== i)
      if (prev.length >= MAX_PINS) return prev
      return [...prev, pin]
    })
  }, [])

  // deep-link (#PC-34-1) on first mount, else preselect a familiar species
  useEffect(() => {
    const m = (location.hash || '').replace('#', '').match(/^([A-Za-z]+)-(\d+)-(\d+)$/)
    if (m) {
      const cl = findClass(m[1])
      const c = +m[2]
      const d = +m[3]
      if (cl && c >= cl.cRange[0] && c <= cl.cRange[1] && d <= dMaxOf(cl)) {
        setCls(cl)
        setSel({ c, d })
        return
      }
    }
    setSel({ c: 34, d: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // arrow-key navigation of the gap map
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view !== 'atlas' || !sel) return
      const tag = (e.target as HTMLElement)?.tagName || ''
      if (/^(INPUT|TEXTAREA)$/.test(tag)) return
      let { c, d } = sel
      let moved = false
      if (e.key === 'ArrowLeft' && c > cls.cRange[0]) { c--; moved = true }
      else if (e.key === 'ArrowRight' && c < cls.cRange[1]) { c++; moved = true }
      else if (e.key === 'ArrowUp' && d < dMaxOf(cls)) { d++; moved = true }
      else if (e.key === 'ArrowDown' && d > 0) { d--; moved = true }
      if (moved) { e.preventDefault(); select(c, d) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, sel, cls, select])

  // canonical species-page routing (#/species/PC-34-1)
  useEffect(() => {
    const onHash = () => setSpeciesRoute(matchSpeciesRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (speciesRoute) {
    return <SpeciesPage id={speciesRoute} onBack={() => { location.hash = ''; setSpeciesRoute(null) }} />
  }

  return (
    <div className="app">
      <Header view={view} onView={setView} compareCount={pins.length} />
      {view === 'atlas' && (
        <AtlasView
          cls={cls}
          onSelectClass={selectClass}
          sel={sel}
          onSelect={(c, d) => select(c, d)}
          persona={persona}
          onPersona={setPersona}
          pins={pins}
          onTogglePin={togglePin}
        />
      )}
      {view === 'search' && <SearchView onOpen={openInAtlas} pins={pins} onTogglePin={togglePin} />}
      {view === 'identify' && <IdentifyView onOpen={openInAtlas} />}
      {view === 'compare' && <CompareView pins={pins} onTogglePin={togglePin} onGoAtlas={() => setView('atlas')} />}
      {view === 'analytics' && <AnalyticsView persona={persona} onPersona={setPersona} onOpen={openInAtlas} />}
      {view === 'refs' && <ReferencesView />}
      {view === 'pipe' && <PipelineView />}
      {view === 'users' && <UsersView />}
      {view === 'access' && <DataAccessView />}
      {view === 'methods' && <MethodsView />}
      <Disclaimer />
    </div>
  )
}
