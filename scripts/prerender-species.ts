// ── Prerender canonical species pages for SEO ──────────────────────────────
// Generates standalone, crawlable static HTML (with JSON-LD, OpenGraph, canonical)
// for every curated species, plus a sitemap. Content is server-rendered from the
// pure service layer, so search engines see real text — not an empty SPA shell.
//
// Run after a build:  npm run build:seo
import fs from 'node:fs'
import { CLASSES, LMSD_CURATED, dMaxOf, findClass } from '../src/lib/lipids'
import { buildRecord, type SpeciesRecord } from '../src/lib/service'
import structuresData from '../src/data/lmsdStructures.json'

const SITE = process.env.SITE_URL || 'https://lorenaredondo.github.io/LipidHub'
const OUT = 'dist/s'
const structures = (structuresData as { structures: Record<string, { lmId: string; inchikey: string; smiles: string }> }).structures

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function page(rec: SpeciesRecord): string {
  const cls = findClass(rec.class.k)!
  const st = structures[rec.id]
  const title = `${rec.shorthand} (${rec.formula}) — ${rec.class.name} | LIPIVERSE`
  const desc = `${rec.shorthand}: ${rec.class.name}. Formula ${rec.formula}, exact mass ${rec.exactMass} Da. Adduct [M+H]+ ${rec.adducts['[M+H]+']}. Predicted CCS ${rec.properties.ccs} Å². ${rec.origin === 'curated' ? `Curated in LIPID MAPS${st ? ` (${st.lmId})` : ''}.` : 'In-silico predicted.'} Occurs in ${rec.class.kingdoms.join(', ')}.`
  const canonical = `${SITE}/s/${rec.id}.html`
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'ChemicalSubstance',
    name: rec.shorthand, alternateName: rec.class.name,
    molecularFormula: rec.formula, molecularWeight: { '@type': 'QuantitativeValue', value: rec.exactMass, unitText: 'Da' },
    ...(st ? { identifier: [{ '@type': 'PropertyValue', propertyID: 'InChIKey', value: st.inchikey }, { '@type': 'PropertyValue', propertyID: 'LIPID MAPS', value: st.lmId }], smiles: st.smiles } : {}),
    url: canonical, isPartOf: { '@type': 'Dataset', name: 'LIPIVERSE' },
  }
  const row = (k: string, v: string) => `<div class="k">${k}</div><div class="v">${esc(v)}</div>`
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(rec.shorthand)} · LIPIVERSE">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>body{font-family:system-ui,sans-serif;background:#0b1418;color:#e2edf0;margin:0;line-height:1.5}
main{max-width:760px;margin:0 auto;padding:32px 24px 80px}a{color:#4ecbc6}
h1{font-family:ui-monospace,monospace;font-size:34px;margin:0 0 4px}.sub{color:#93a8b2}
.badge{font-family:ui-monospace,monospace;font-size:11px;border:1px solid #2f6b4c;color:#5fca8b;border-radius:20px;padding:3px 9px}
.gap{border-color:#7a6428;color:#e6b34d}.kv{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:20px 0;font-size:14px}
.k{color:#93a8b2}.v{font-family:ui-monospace,monospace;text-align:right}.note{color:#647883;font-size:12px}
h2{font-size:14px;color:#647883;text-transform:uppercase;letter-spacing:.08em;margin:26px 0 10px}</style>
</head><body><main>
<p><a href="${SITE}/">← LIPIVERSE</a></p>
<p><span class="badge ${rec.origin === 'curated' ? '' : 'gap'}">${rec.origin === 'curated' ? 'curated · LIPID MAPS' : 'predicted gap'}</span></p>
<h1>${esc(rec.shorthand)}</h1>
<div class="sub">${esc(rec.class.name)} · ${esc(rec.class.category)}</div>
<h2>Mass spectrometry</h2><div class="kv">
${row('Formula', rec.formula)}${row('Exact mass', rec.exactMass + ' Da')}
${Object.entries(rec.adducts).map(([a, m]) => row(a, m + ' m/z')).join('')}
${row('CCS (predicted)', rec.properties.ccs + ' Å²')}${row('RT (predicted)', rec.properties.rt + ' min')}
${row('Diagnostic fragment', rec.msmsHeadgroup.label)}</div>
<h2>Physical &amp; biology</h2><div class="kv">
${row('logP', String(rec.properties.logP))}${row('Tm', rec.properties.tm != null ? rec.properties.tm + ' °C' : 'n/a')}
${row('Headgroup', rec.headgroupCharge)}${row('Occurs in', rec.class.kingdoms.join(', '))}
${row('Biosynthesis', cls.pw)}</div>
<h2>Identity</h2><div class="kv">
${row('Origin', rec.origin === 'curated' ? 'curated in LIPID MAPS (LMSD)' : 'in-silico (enumerated)')}
${st ? row('LIPID MAPS ID', st.lmId) + row('InChIKey', st.inchikey) : ''}</div>
<p><a href="${SITE}/#/species/${rec.id}">Explore interactively →</a></p>
<p class="note">Formula, mass and adduct m/z are computed exactly; CCS, RT, Tm and synthesizability
are heuristic placeholders in this research preview. Curated status &amp; identifiers from LIPID MAPS (CC BY 4.0).</p>
</main></body></html>`
}

// which species to prerender: every curated composition (real, index-worthy)
const ids: string[] = []
for (const cls of CLASSES) {
  const e = LMSD_CURATED.classes[cls.k]
  if (!e) continue
  for (const cd of Object.keys(e.comps)) {
    const [c, d] = cd.split(':').map(Number)
    if (c >= cls.cRange[0] && c <= cls.cRange[1] && d <= dMaxOf(cls)) ids.push(`${cls.k}-${c}-${d}`)
  }
}

fs.mkdirSync(OUT, { recursive: true })
let written = 0
for (const id of ids) {
  const m = id.match(/^([A-Za-z]+)-(\d+)-(\d+)$/)!
  const cls = findClass(m[1])!
  fs.writeFileSync(`${OUT}/${id}.html`, page(buildRecord(cls, +m[2], +m[3])))
  written++
}

const urls = ids.map((id) => `<url><loc>${SITE}/s/${id}.html</loc></url>`).join('\n')
fs.writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)

console.error(`prerendered ${written} curated species pages → ${OUT}/`)
console.error(`wrote dist/sitemap.xml (${ids.length} urls)`)
