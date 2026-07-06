// Validates that every class's generated SMILES parses and matches the model mass.
// Run: npm run validate:smiles
import OCL from 'openchemlib'
import { CLASSES, fmtObj, mass } from '../src/lib/lipids'
import { toSmiles, defaultComposition } from '../src/lib/smiles'

let fails = 0
for (const cls of CLASSES) {
  const [c, d] = defaultComposition(cls)
  const smi = toSmiles(cls, c, d)
  if (!smi) { console.log('  SKIP    ', cls.k, '(no template — UI falls back to cartoon)'); continue }
  let oclMass: number
  try {
    oclMass = OCL.Molecule.fromSmiles(smi).getMolecularFormula().absoluteWeight
  } catch {
    console.log('  PARSEFAIL', cls.k.padEnd(6), smi); fails++; continue
  }
  const ourMass = mass(fmtObj(cls, c, d))
  const dm = Math.abs(oclMass - ourMass)
  const tag = dm < 0.06 ? 'OK      ' : 'MISMATCH'
  if (dm >= 0.06) fails++
  console.log(` ${tag} ${cls.k.padEnd(6)} ${(c + ':' + d).padEnd(6)} smiles ${oclMass.toFixed(4)}  model ${ourMass.toFixed(4)}  Δ ${dm.toFixed(4)}`)
}
console.log(fails ? `\n✗ ${fails} problem(s)` : '\n✓ all SMILES valid and mass-consistent')
process.exit(fails ? 1 : 0)
