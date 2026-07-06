import { CLASSES, FOUNDATIONAL_REFS, GROUPS, pmcSearchUrl } from '../lib/lipids'

export default function ReferencesView() {
  return (
    <section className="view on">
      <div className="doc">
        <span className="eyebrow">References</span>
        <h2 style={{ marginTop: 8 }}>Where the lipids — and this atlas — come from</h2>
        <p className="lede">
          Two kinds of literature. <b>Foundational references</b> are the papers this atlas is built
          on — classification, nomenclature, and the source databases. <b>Per-class literature</b>{' '}
          opens a live Europe PMC search so you get real, current papers rather than a hand-picked
          (and quickly stale) list. Curated per-species citations come later, with database
          integration.
        </p>

        <h3 className="refsub">Foundational references</h3>
        <ol className="reflist">
          {FOUNDATIONAL_REFS.map((r) => (
            <li key={r.doi}>
              <span className="refauth">{r.authors}</span>{' '}
              <span className="reftitle">{r.title}.</span>{' '}
              <span className="refjournal">{r.journal}</span> <span className="refyear">{r.year}</span>.{' '}
              <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">doi:{r.doi}</a>
            </li>
          ))}
        </ol>

        <h3 className="refsub">Explore the literature by class</h3>
        <p className="note" style={{ marginBottom: 16 }}>
          Each link runs a live <b>Europe PMC</b> search for that lipid class in the context of lipidomics.
        </p>
        {GROUPS.map((g) => {
          const members = CLASSES.filter((c) => c.group === g)
          if (!members.length) return null
          return (
            <div className="refgroup" key={g}>
              <div className="refgrouphead">{g}</div>
              <div className="reflinks">
                {members.map((c) => (
                  <a key={c.k} className="reflink" href={pmcSearchUrl(c)} target="_blank" rel="noreferrer">
                    <b>{c.k}</b> <span>{c.name}</span> <span className="arrow">→</span>
                  </a>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
