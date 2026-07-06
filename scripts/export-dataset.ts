// Exports the plausible enumerated species (composition only) for the ML pipeline.
// Run: npm run export:dataset  →  ml/dataset.csv
import fs from 'node:fs'
import { CLASSES, dMaxOf, headgroupCharge, mass, fmtObj, status } from '../src/lib/lipids'

const rows: string[] = ['id,class,group,carbons,dbonds,exact_mass,headgroup']
for (const cls of CLASSES) {
  const [lo, hi] = cls.cRange
  for (let c = lo; c <= hi; c++) {
    for (let d = 0; d <= dMaxOf(cls); d++) {
      if (status(cls, c, d) === 'rare') continue
      rows.push([`${cls.k}-${c}-${d}`, cls.k, cls.group, c, d, mass(fmtObj(cls, c, d)).toFixed(6), headgroupCharge(cls)].join(','))
    }
  }
}
fs.mkdirSync('ml', { recursive: true })
fs.writeFileSync('ml/dataset.csv', rows.join('\n'))
console.error(`wrote ml/dataset.csv (${rows.length - 1} species)`)
