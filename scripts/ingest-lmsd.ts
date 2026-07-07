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

// our classes; some carry an LMSD hydroxyl/oxygen-count suffix instead of a plain "c:d".
// sphingolipids always use ";O2"; free sterols use ";O" (native 3-OH) and oxysterols use
// ";O2" too — but LMSD's own token for BOTH is "ST", so we disambiguate our two classes
// (ST vs OxST) purely by which suffix a given "ST c:d;..." record carries.
const SPHINGO = new Set(['Cer', 'SM', 'HexCer'])
const OURS = new Set(['PC', 'PE', 'PS', 'PG', 'PI', 'PA', 'LPC', 'LPE', 'DG', 'TG', 'MGDG', 'DGDG', 'SQDG', 'Cer', 'SM', 'HexCer', 'CE', 'FA', 'CL', 'CAR', 'ST', 'OxST'])

/** Map an LMSD abbreviation token to our app class code + resolve its "c:d" suffix. */
function resolveToken(lmToken: string, rest: string): { appClass: string; cd: string } | null {
  if (SPHINGO.has(lmToken)) {
    return rest.endsWith(';O2') ? { appClass: lmToken, cd: rest.slice(0, -3) } : null
  }
  if (lmToken === 'ST') {
    if (rest.endsWith(';O2')) return { appClass: 'OxST', cd: rest.slice(0, -3) }
    if (rest.endsWith(';O')) return { appClass: 'ST', cd: rest.slice(0, -2) }
    return null
  }
  if (rest.includes(';') || rest.includes('-') || rest.includes('O')) return null // skip ether/oxidised variants
  return OURS.has(lmToken) ? { appClass: lmToken, cd: rest } : null
}

interface ClassEntry { core?: string; mainClass?: string; comps: Record<string, number>; curatedCount: number }
const classes: Record<string, ClassEntry> = {}
// one representative real structure per curated composition, keyed by id (PC-34-1)
const structures: Record<string, { lmId: string; inchikey: string; smiles: string }> = {}

let field: string | null = null
let abbrev = '', category = '', mainClass = '', lmId = '', inchikey = '', smiles = ''
let records = 0

function commit() {
  records++
  if (!abbrev) return
  const sp = abbrev.indexOf(' ')
  if (sp < 0) return
  const lmToken = abbrev.slice(0, sp)
  const rest = abbrev.slice(sp + 1)
  const resolved = resolveToken(lmToken, rest)
  if (!resolved) return
  const { appClass, cd } = resolved
  if (!/^\d+:\d+$/.test(cd)) return
  const e = (classes[appClass] ??= { comps: {}, curatedCount: 0 })
  if (!e.comps[cd]) e.curatedCount++
  e.comps[cd] = (e.comps[cd] || 0) + 1
  if (!e.core && category) { e.core = category; e.mainClass = mainClass }

  const id = `${appClass}-${cd.replace(':', '-')}`
  if (lmId && smiles && !structures[id]) structures[id] = { lmId, inchikey, smiles } // first-wins
}

const rl = readline.createInterface({ input: fs.createReadStream(SDF), crlfDelay: Infinity })
for await (const line of rl) {
  if (line.startsWith('> <')) { field = line.slice(3, line.indexOf('>', 3)); continue }
  if (line.startsWith('$$$$')) { commit(); abbrev = category = mainClass = lmId = inchikey = smiles = ''; field = null; continue }
  if (field) {
    const v = line.trim()
    if (field === 'ABBREVIATION') abbrev = v
    else if (field === 'CATEGORY') category = v
    else if (field === 'MAIN_CLASS') mainClass = v
    else if (field === 'LM_ID') lmId = v
    else if (field === 'INCHI_KEY') inchikey = v
    else if (field === 'SMILES') smiles = v
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
fs.writeFileSync(`${dir}/lmsdStructures.json`, JSON.stringify({
  source: 'LIPID MAPS Structure Database (LMSD)', license: 'CC BY 4.0', structures,
}))

const summary = Object.entries(classes).map(([k, e]) => `${k}:${e.curatedCount}`).join('  ')
const kb = (f: string) => (fs.statSync(`${dir}/${f}`).size / 1024).toFixed(0)
console.error(`scanned ${records} records`)
console.error(`curated sum-compositions per class → ${summary}`)
console.error(`representative structures: ${Object.keys(structures).length}`)
console.error(`wrote lmsdCurated.json (${kb('lmsdCurated.json')} KB), lmsdStructures.json (${kb('lmsdStructures.json')} KB)`)
