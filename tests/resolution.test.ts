import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLASSES, dMaxOf } from '../src/lib/lipids'
import { buildRecord } from '../src/lib/service'
import { RESOLUTION_LEVELS, databaseStructure } from '../src/lib/resolution'

test('every record declares sum-composition resolution', () => {
  for (const cls of CLASSES) {
    const rec = buildRecord(cls, Math.max(cls.cRange[0], 16), Math.min(1, dMaxOf(cls)))
    assert.equal(rec.identity.resolution, 'sum_composition')
    assert.match(rec.identity.caveat, /not a single molecule/)
  }
})

test('generated structures are labelled illustrative, never unlabeled', () => {
  const rec = buildRecord(CLASSES.find((c) => c.k === 'PC')!, 34, 1)
  assert.ok(rec.structure)
  assert.equal(rec.structure!.status, 'illustrative')
  assert.match(rec.structure!.caveat, /not known/)
  assert.equal('smiles' in rec, false, 'top-level smiles must not carry an unlabeled structure')
})

test('database-derived structures carry source and LMSD id', () => {
  const s = databaseStructure('CCCC(=O)O', 'LMFA01010003', 'XBDQKXXYIPTUBI-UHFFFAOYSA-N')
  assert.equal(s.status, 'database-derived')
  assert.equal(s.lmId, 'LMFA01010003')
  assert.match(s.caveat, /other isomers/)
})

test('resolution hierarchy is ordered coarse to fine', () => {
  assert.deepEqual(RESOLUTION_LEVELS.map((l) => l.level),
    ['class', 'sum_composition', 'molecular_species', 'sn_resolved', 'structure_resolved'])
})
