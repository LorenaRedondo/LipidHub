// ── SMILES construction from sum composition ───────────────────────────────
// Builds a plausible SMILES for the chosen "most abundant" isomer of a species,
// so the inspector can show a real 2D structure. Double-bond positions are
// illustrative (sum composition can't fix them) — same caveat as the MS/MS panel.
// Returns null when a class has no template; the UI falls back to the cartoon.

import { isomer, type LipidClass } from './lipids'

/** Alkyl chain of n carbons with d double bonds, spaced and non-adjacent. */
function alkyl(n: number, d: number): string {
  if (n <= 0) return ''
  const gaps = new Set<number>() // a gap g = double bond between carbon g and g+1
  let placed = 0
  for (let k = 1; k <= d && placed < d; k++) {
    let g = Math.max(2, Math.floor((k * n) / (d + 1)))
    while (g <= n - 1 && (gaps.has(g) || gaps.has(g - 1) || gaps.has(g + 1))) g++
    if (g <= n - 1) { gaps.add(g); placed++ }
  }
  let s = 'C'
  for (let i = 2; i <= n; i++) s += gaps.has(i - 1) ? '=C' : 'C'
  return s
}

// acyl written alkyl-first (…C(=O)) — attaches as  <acidRev>O–backbone
const acidRev = (c: number, d: number) => `${alkyl(c - 1, d)}C(=O)`
// acyl written carbonyl-first (C(=O)…) — attaches as  backbone–O<acidFwd>
const acidFwd = (c: number, d: number) => `C(=O)${alkyl(c - 1, d)}`

// phosphate headgroups appended after the sn-3  "…CO"
const PHOSPHO: Record<string, string> = {
  PC: 'P(=O)([O-])OCC[N+](C)(C)C',
  PE: 'P(=O)(O)OCCN',
  PS: 'P(=O)(O)OCC(N)C(=O)O',
  PG: 'P(=O)(O)OCC(O)CO',
  PA: 'P(=O)(O)O',
  PI: 'P(=O)(O)OC1C(O)C(O)C(O)C(O)C1O',
  LPC: 'P(=O)([O-])OCC[N+](C)(C)C',
  LPE: 'P(=O)(O)OCCN',
}

// sugar heads appended after the sn-3  "…CO"
const SUGAR: Record<string, string> = {
  MGDG: 'C1OC(CO)C(O)C(O)C1O',
  DGDG: 'C1OC(COC2OC(CO)C(O)C(O)C2O)C(O)C(O)C1O',
  SQDG: 'C1OC(CS(=O)(=O)O)C(O)C(O)C1O',
}

/** Cholesterol core; the "(O…)" is the 3-OH we esterify for CE. */
const CHOL = (sub: string) => `CC(C)CCCC(C)C1CCC2C1(C)CCC1C2CC=C2CC(${sub})CCC21C`

export function toSmiles(cls: LipidClass, c: number, d: number): string | null {
  const iso = isomer(cls, c, d)
  const kind = cls.kind ?? 'glycero'

  if (kind === 'fattyacyl') return `${alkyl(c - 1, d)}C(=O)O`

  // acylcarnitine: fatty acyl esterified to carnitine
  if (cls.k === 'CAR') return `${alkyl(c - 1, d)}C(=O)OC(C[N+](C)(C)C)CC([O-])=O`

  // cardiolipin: two diacyl-phosphatidyl arms bridged by a central glycerol
  if (cls.n === 4) {
    const [[c1, d1], [c2, d2], [c3, d3], [c4, d4]] = iso
    return `${acidRev(c1, d1)}OCC(O${acidFwd(c2, d2)})COP(=O)(O)OCC(O)COP(=O)(O)OCC(O${acidFwd(c3, d3)})CO${acidFwd(c4, d4)}`
  }

  if (kind === 'sterolester') return CHOL(`OC(=O)${alkyl(c - 1, d)}`)

  if (kind === 'sphingo') {
    const [[, bDB], [na, nd]] = iso // [base, N-acyl]
    const sn1 =
      cls.subhg === 'SM' ? 'COP(=O)([O-])OCC[N+](C)(C)C'
      : cls.subhg === 'Hex' ? 'COC1OC(CO)C(O)C(O)C1O'
      : 'CO'
    // N-acyl amide on the sphingoid base; base is d18:1 (Δ4 trans) or d18:0 dihydro
    const baseTail = bDB >= 1 ? 'C=CCCCCCCCCCCCCC' : 'CCCCCCCCCCCCCCC'
    return `${alkyl(na - 1, nd)}C(=O)NC(${sn1})C(O)${baseTail}`
  }

  if (kind === 'glyco') {
    const [[c1, d1], [c2, d2]] = iso
    return `${acidRev(c1, d1)}OCC(O${acidFwd(c2, d2)})CO${SUGAR[cls.subhg ?? 'MGDG']}`
  }

  // glycero family (n = 1, 2 or 3)
  if (cls.n === 1) {
    const [[c1, d1]] = iso
    return `${acidRev(c1, d1)}OCC(O)CO${PHOSPHO[cls.k] ?? ''}`
  }
  if (cls.n === 3) {
    const [[c1, d1], [c2, d2], [c3, d3]] = iso
    return `${acidRev(c1, d1)}OCC(O${acidFwd(c2, d2)})CO${acidFwd(c3, d3)}`
  }
  const [[c1, d1], [c2, d2]] = iso
  return `${acidRev(c1, d1)}OCC(O${acidFwd(c2, d2)})CO${PHOSPHO[cls.k] ?? ''}`
}

/** A representative, even-chain species near the class centre for depiction. */
export function defaultComposition(cls: LipidClass): [number, number] {
  const mid = cls.mid ?? (cls.n === 3 ? 52 : 34)
  let c = Math.round(mid)
  if (c % 2 !== 0) c += 1
  c = Math.max(cls.cRange[0], Math.min(cls.cRange[1], c))
  const d = cls.kind === 'sphingo' ? 1 : 1
  return [c, d]
}
