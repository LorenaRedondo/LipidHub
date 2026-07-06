// ── LMSD bulk ingest ───────────────────────────────────────────────────────
// Streams a LIPID MAPS LMSD structures.sdf and builds a compact curated index
// (which sum compositions are actually curated, per class) that the app ships
// to mark real curated-vs-gap status offline.
//
// Download first (CC BY 4.0):
//   curl -L -A Mozilla/5.0 -o lmsd.sdf.zip \
//     "https://www.lipidmaps.org/files/?file=LMSD&ext=sdf.zip" && unzip lmsd.sdf.zip
// Then:  npx tsx scripts/ingest-lmsd.ts path/to/structures.sdf
import fs from 'node:fs'
import readline from 'node:readline'

const SDF = process.argv[2]
if (!SDF || !fs.existsSync(SDF)) {
  console.error('usage: tsx scripts/ingest-lmsd.ts <structures.sdf>')
  process.exit(1)
}

// our 17 classes; sphingolipids carry LMSD's ";O2" hydroxyl suffix
const SPHINGO = new Set(['Cer', 'SM', 'HexCer'])
const OURS = new Set(['PC', 'PE', 'PS', 'PG', 'PI', 'PA', 'LPC', 'DG', 'TG', 'MGDG', 'DGDG', 'SQDG', 'Cer', 'SM', 'HexCer', 'CE', 'FA'])

interface ClassEntry { core?: string; mainClass?: string; comps: Record<string, number>; curatedCount: number }
const classes: Record<string, ClassEntry> = {}

let field: string | null = null
let abbrev = '', category = '', mainClass = ''
let records = 0

function commit() {
  records++
  if (!abbrev) return
  const sp = abbrev.indexOf(' ')
  if (sp < 0) return
  const token = abbrev.slice(0, sp)
  if (!OURS.has(token)) return
  const rest = abbrev.slice(sp + 1)
  const isSphingo = SPHINGO.has(token)
  let cd: string
  if (isSphingo) {
    if (!rest.endsWith(';O2')) return
    cd = rest.slice(0, -3)
  } else {
    if (rest.includes(';') || rest.includes('-') || rest.includes('O')) return // skip ether/oxidised variants
    cd = rest
  }
  if (!/^\d+:\d+$/.test(cd)) return
  const e = (classes[token] ??= { comps: {}, curatedCount: 0 })
  if (!e.comps[cd]) e.curatedCount++
  e.comps[cd] = (e.comps[cd] || 0) + 1
  if (!e.core && category) { e.core = category; e.mainClass = mainClass }
}

const rl = readline.createInterface({ input: fs.createReadStream(SDF), crlfDelay: Infinity })
for await (const line of rl) {
  if (line.startsWith('> <')) { field = line.slice(3, line.indexOf('>', 3)); continue }
  if (line.startsWith('$$$$')) { commit(); abbrev = category = mainClass = ''; field = null; continue }
  if (field) {
    const v = line.trim()
    if (field === 'ABBREVIATION') abbrev = v
    else if (field === 'CATEGORY') category = v
    else if (field === 'MAIN_CLASS') mainClass = v
    field = null
  }
}
commit()

const out = {
  source: 'LIPID MAPS Structure Database (LMSD)',
  license: 'CC BY 4.0',
  url: 'https://www.lipidmaps.org',
  recordsScanned: records,
  classes,
}
const dir = 'src/data'
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(`${dir}/lmsdCurated.json`, JSON.stringify(out))

const summary = Object.entries(classes).map(([k, e]) => `${k}:${e.curatedCount}`).join('  ')
console.error(`scanned ${records} records`)
console.error(`curated sum-compositions per class → ${summary}`)
console.error(`wrote ${dir}/lmsdCurated.json (${(fs.statSync(`${dir}/lmsdCurated.json`).size / 1024).toFixed(0)} KB)`)
