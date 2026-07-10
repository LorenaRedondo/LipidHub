// ── LIPIVERSE data model ───────────────────────────────────────────────────
// Pure, framework-free chemistry + property inference + biological taxonomy.
// Formulas/masses are computed exactly from composition; CCS/RT/logP/Tm/
// synthesizability are clearly-labelled heuristic model outputs pending the
// real pipelines (see docs/architecture.md and GitHub issues #3, #4).

import curatedData from '../data/lmsdCurated.json'

interface LmsdIndex {
  source: string
  license: string
  recordsScanned: number
  classes: Record<string, { comps: Record<string, number>; curatedCount: number; core?: string; mainClass?: string }>
}
export const LMSD_CURATED = curatedData as unknown as LmsdIndex

export type Elem = 'C' | 'H' | 'O' | 'N' | 'P' | 'S'
export type Formula = Record<Elem, number>
export type Kind = 'glycero' | 'sphingo' | 'sterolester' | 'glyco' | 'fattyacyl' | 'sterol'
export type SubHead = 'SM' | 'Hex' | 'MGDG' | 'DGDG' | 'SQDG'
export type Persona = 'analyst' | 'biophys' | 'chem' | 'bioinfo'

/** Shared across the Atlas inspector and Analytics — one "who am I" identity, several views. */
export const PERSONAS: { id: Persona; ic: string; short: string; label: string }[] = [
  { id: 'analyst', ic: '◎', short: 'Analyst', label: 'Mass-spec analyst' },
  { id: 'biophys', ic: '≋', short: 'Biophysics', label: 'Membrane biophysicist' },
  { id: 'chem', ic: '⚗', short: 'Chemist', label: 'Synthetic chemist' },
  { id: 'bioinfo', ic: '⌗', short: 'Bioinfo', label: 'Bioinformatician' },
]
export type Status = 'known' | 'gap' | 'rare'
export type Method = 'measured' | 'calculated' | 'predicted'
export type Kingdom = 'Animals' | 'Plants' | 'Algae' | 'Fungi' | 'Bacteria' | 'Archaea'

/** Display grouping used by the class rail (broader than the LIPID MAPS category). */
export const GROUPS = [
  'Glycerophospholipids',
  'Glycerolipids',
  'Glycolipids',
  'Sphingolipids',
  'Sterol lipids',
  'Fatty acyls',
] as const
export type Group = (typeof GROUPS)[number]

export const KINGDOMS: Kingdom[] = ['Animals', 'Plants', 'Algae', 'Fungi', 'Bacteria', 'Archaea']

export interface LipidClass {
  k: string
  name: string
  group: Group
  category: string // LIPID MAPS category (code + name)
  kingdoms: Kingdom[]
  occurrence: string
  kind?: Kind
  bb?: Partial<Formula> // deacylated backbone (glycero classes only)
  n: number // acyl chain count
  cRange: [number, number]
  dMax?: number // max double bonds on the grid (defaults to GRID_D); higher for many-chain classes
  mid?: number
  pref: string // preferred ionization adduct
  lpOff: number // logP headgroup offset
  hasTm: boolean
  xlabel?: string
  subhg?: SubHead
  oxyCount?: number // total oxygens on a free-sterol ring system (1 = native 3-OH, 2 = oxysterol)
  enz: string[]
  rhea: string
  pw: string
  hgFrag: { lab: string; mz: number | null }
}

export const MASS: Record<Elem, number> = {
  C: 12,
  H: 1.0078250319,
  O: 15.9949146221,
  N: 14.0030740052,
  P: 30.97376151,
  S: 31.9720707,
}
export const PROTON = 1.0072764
export const NH4 = 18.0338254
export const FORMATE = 44.9982
export const GRID_D = 6
/** Max double bonds on the composition grid for a class (many-chain classes go higher). */
export function dMaxOf(cls: LipidClass): number { return cls.dMax ?? GRID_D }

const empty: Formula = { C: 0, H: 0, O: 0, N: 0, P: 0, S: 0 }

export const CLASSES: LipidClass[] = [
  // ── Glycerophospholipids ──────────────────────────────────────────────
  { k: 'PC', name: 'Phosphatidylcholine', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids',
    kingdoms: ['Animals', 'Plants', 'Fungi'], occurrence: 'The most abundant membrane phospholipid in eukaryotes; rare in most bacteria.',
    bb: { C: 8, H: 20, O: 6, N: 1, P: 1 }, n: 2, cRange: [26, 46], pref: '[M+H]⁺', lpOff: 8.0, hasTm: true,
    enz: ['LPCAT1', 'CHKA', 'PCYT1A'], rhea: 'RHEA:12937', pw: 'Kennedy pathway (CDP-choline); remodelled by Lands cycle acyltransferases.',
    hgFrag: { lab: 'phosphocholine (+)', mz: 184.0733 } },
  { k: 'PE', name: 'Phosphatidylethanolamine', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids',
    kingdoms: ['Animals', 'Plants', 'Fungi', 'Bacteria'], occurrence: 'Ubiquitous across all domains; the primary phospholipid of many bacteria.',
    bb: { C: 5, H: 14, O: 6, N: 1, P: 1 }, n: 2, cRange: [26, 46], pref: '[M-H]⁻', lpOff: 7.4, hasTm: true,
    enz: ['EPT1', 'PCYT2', 'PISD'], rhea: 'RHEA:32943', pw: 'CDP-ethanolamine pathway; also PS decarboxylation (PISD) in mitochondria.',
    hgFrag: { lab: 'neutral loss 141 (−)', mz: 141.0191 } },
  { k: 'PS', name: 'Phosphatidylserine', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids',
    kingdoms: ['Animals', 'Plants', 'Fungi', 'Bacteria'], occurrence: 'Inner-leaflet anionic lipid; its externalisation is an apoptosis "eat-me" signal.',
    bb: { C: 6, H: 14, O: 8, N: 1, P: 1 }, n: 2, cRange: [28, 46], pref: '[M-H]⁻', lpOff: 7.7, hasTm: true,
    enz: ['PTDSS1', 'PTDSS2'], rhea: 'RHEA:45088', pw: 'Base-exchange from PC/PE by PS synthases at ER–mito contact sites.',
    hgFrag: { lab: 'neutral loss 87 (−)', mz: 87.032 } },
  { k: 'PG', name: 'Phosphatidylglycerol', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids',
    kingdoms: ['Animals', 'Plants', 'Algae', 'Bacteria'], occurrence: 'Major bacterial and chloroplast lipid; cardiolipin precursor and lung surfactant component.',
    bb: { C: 6, H: 15, O: 8, N: 0, P: 1 }, n: 2, cRange: [28, 44], pref: '[M-H]⁻', lpOff: 7.0, hasTm: true,
    enz: ['PGS1', 'PTPMT1'], rhea: 'RHEA:33203', pw: 'PGP synthase → dephosphorylation; precursor to cardiolipin.',
    hgFrag: { lab: 'glycerophosphate (−)', mz: 152.9958 } },
  { k: 'PI', name: 'Phosphatidylinositol', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids',
    kingdoms: ['Animals', 'Plants', 'Fungi'], occurrence: 'Eukaryotic signalling hub; head of the phosphoinositide (PIP/PIP₂/PIP₃) tree.',
    bb: { C: 9, H: 19, O: 11, N: 0, P: 1 }, n: 2, cRange: [30, 46], pref: '[M-H]⁻', lpOff: 7.9, hasTm: true,
    enz: ['CDIPT'], rhea: 'RHEA:11580', pw: 'PI synthase from CDP-DAG + myo-inositol; head of the phosphoinositide tree.',
    hgFrag: { lab: 'inositol phosphate (−)', mz: 241.0119 } },
  { k: 'PA', name: 'Phosphatidic acid', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids',
    kingdoms: ['Animals', 'Plants', 'Fungi', 'Bacteria'], occurrence: 'Low-abundance but central metabolic and signalling hub; branch point of all glycerolipids.',
    bb: { C: 3, H: 9, O: 6, N: 0, P: 1 }, n: 2, cRange: [26, 44], pref: '[M-H]⁻', lpOff: 4.6, hasTm: true,
    enz: ['AGPAT1', 'LPIN1', 'DGKA'], rhea: 'RHEA:19709', pw: 'Central hub — de novo (AGPAT) and from DAG (DGK); branch point of all glycerolipids.',
    hgFrag: { lab: 'glycerophosphate (−)', mz: 152.9958 } },
  { k: 'LPC', name: 'Lysophosphatidylcholine', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids',
    kingdoms: ['Animals', 'Plants', 'Fungi'], occurrence: 'Single-chain signalling lyso-lipid; elevated in inflammation and oxidised LDL.',
    bb: { C: 8, H: 20, O: 6, N: 1, P: 1 }, n: 1, cRange: [12, 22], mid: 17, pref: '[M+H]⁺', lpOff: 9.5, hasTm: false,
    xlabel: 'sn-1 acyl carbons', enz: ['PLA2G4A', 'LPCAT1'], rhea: 'RHEA:15801', pw: 'Produced by phospholipase A₂ hydrolysis of PC; re-acylated by LPCAT (Lands cycle).',
    hgFrag: { lab: 'phosphocholine (+)', mz: 184.0733 } },

  // ── Glycerolipids ─────────────────────────────────────────────────────
  { k: 'DG', name: 'Diacylglycerol', group: 'Glycerolipids', category: 'GL · Glycerolipids',
    kingdoms: ['Animals', 'Plants', 'Fungi'], occurrence: 'Second messenger (activates PKC) and biosynthetic intermediate to TG and phospholipids.',
    bb: { C: 3, H: 8, O: 3, N: 0, P: 0 }, n: 2, cRange: [26, 44], pref: '[M+NH₄]⁺', lpOff: 2.0, hasTm: false,
    enz: ['LPIN1', 'PLCG1'], rhea: 'RHEA:27562', pw: 'From PA (phosphatase) or PIP₂ (PLC); signalling lipid and TG/PL precursor.',
    hgFrag: { lab: '[M+H−RCOOH]⁺ (acyl loss)', mz: null } },
  { k: 'TG', name: 'Triacylglycerol', group: 'Glycerolipids', category: 'GL · Glycerolipids',
    kingdoms: ['Animals', 'Plants', 'Algae', 'Fungi'], occurrence: 'The universal neutral storage fat of lipid droplets and plant/algal oils.',
    bb: { C: 3, H: 8, O: 3, N: 0, P: 0 }, n: 3, cRange: [44, 60], dMax: 9, pref: '[M+NH₄]⁺', lpOff: -4.0, hasTm: false,
    enz: ['DGAT1', 'DGAT2'], rhea: 'RHEA:10868', pw: 'Final esterification of DAG by DGAT; the storage-fat endpoint.',
    hgFrag: { lab: '[M+NH₄−RCOOH]⁺ (acyl loss)', mz: null } },

  // ── Glycolipids (glycosyldiacylglycerols) ─────────────────────────────
  { k: 'MGDG', name: 'Monogalactosyldiacylglycerol', group: 'Glycolipids', category: 'GL · Glycerolipids (glycolipid)',
    kingdoms: ['Plants', 'Algae', 'Bacteria'], occurrence: 'The single most abundant lipid on Earth — dominates photosynthetic thylakoid membranes.',
    kind: 'glyco', subhg: 'MGDG', n: 2, cRange: [28, 42], mid: 34, pref: '[M+HCOO]⁻', lpOff: 8.5, hasTm: true,
    enz: ['MGD1', 'MGD2'], rhea: 'RHEA:16989', pw: 'MGDG synthase (MGD) transfers galactose from UDP-Gal onto DAG in the chloroplast envelope.',
    hgFrag: { lab: '−galactose (162) neutral loss', mz: null } },
  { k: 'DGDG', name: 'Digalactosyldiacylglycerol', group: 'Glycolipids', category: 'GL · Glycerolipids (glycolipid)',
    kingdoms: ['Plants', 'Algae', 'Bacteria'], occurrence: 'Bilayer-forming galactolipid of chloroplast membranes; accumulates under phosphate starvation.',
    kind: 'glyco', subhg: 'DGDG', n: 2, cRange: [28, 42], mid: 34, pref: '[M+HCOO]⁻', lpOff: 9.5, hasTm: true,
    enz: ['DGD1', 'DGD2'], rhea: 'RHEA:16217', pw: 'DGDG synthase adds a second galactose to MGDG; strongly induced by phosphate limitation.',
    hgFrag: { lab: '−digalactose (324) neutral loss', mz: null } },
  { k: 'SQDG', name: 'Sulfoquinovosyldiacylglycerol', group: 'Glycolipids', category: 'GL · Glycerolipids (sulfolipid)',
    kingdoms: ['Plants', 'Algae', 'Bacteria'], occurrence: 'Anionic sulfolipid of photosynthetic membranes; substitutes for PG when phosphate is scarce.',
    kind: 'glyco', subhg: 'SQDG', n: 2, cRange: [28, 42], mid: 34, pref: '[M-H]⁻', lpOff: 8.5, hasTm: true,
    enz: ['SQD1', 'SQD2'], rhea: 'RHEA:22908', pw: 'SQD1 builds UDP-sulfoquinovose; SQD2 transfers it to DAG. The only sulfonate lipid.',
    hgFrag: { lab: 'sulfoquinovose [C₆H₉O₇S]⁻', mz: 225.0069 } },

  // ── Sphingolipids ─────────────────────────────────────────────────────
  { k: 'Cer', name: 'Ceramide', group: 'Sphingolipids', category: 'SP · Sphingolipids',
    kingdoms: ['Animals', 'Plants', 'Fungi'], occurrence: 'Pro-apoptotic signalling hub and the backbone of all complex sphingolipids.',
    kind: 'sphingo', n: 1, cRange: [32, 46], mid: 40, pref: '[M+H]⁺', lpOff: 10.5, hasTm: true,
    xlabel: 'Total carbons · d18 base + N-acyl', enz: ['CERS2', 'CERS5', 'DEGS1'], rhea: 'RHEA:53424',
    pw: 'De novo from serine + palmitoyl-CoA → dihydroceramide → DEGS desaturase; the hub of sphingolipid metabolism.',
    hgFrag: { lab: 'sphingoid base −H₂O (+)', mz: 264.2686 } },
  { k: 'SM', name: 'Sphingomyelin', group: 'Sphingolipids', category: 'SP · Sphingolipids',
    kingdoms: ['Animals'], occurrence: 'Major animal plasma-membrane lipid; partners with cholesterol to form ordered rafts.',
    kind: 'sphingo', subhg: 'SM', n: 1, cRange: [32, 46], mid: 40, pref: '[M+H]⁺', lpOff: 11.5, hasTm: true,
    xlabel: 'Total carbons · d18 base + N-acyl', enz: ['SGMS1', 'SGMS2'], rhea: 'RHEA:18765',
    pw: 'SM synthase transfers phosphocholine from PC onto ceramide at the Golgi.',
    hgFrag: { lab: 'phosphocholine (+)', mz: 184.0733 } },
  { k: 'HexCer', name: 'Hexosylceramide', group: 'Sphingolipids', category: 'SP · Sphingolipids',
    kingdoms: ['Animals', 'Plants', 'Fungi'], occurrence: 'Glucosyl/galactosylceramide — the entry point to gangliosides and glycosphingolipids.',
    kind: 'sphingo', subhg: 'Hex', n: 1, cRange: [32, 46], mid: 40, pref: '[M+H]⁺', lpOff: 11.0, hasTm: true,
    xlabel: 'Total carbons · d18 base + N-acyl', enz: ['UGCG', 'UGT8'], rhea: 'RHEA:12088',
    pw: 'Glucosyl/galactosylceramide synthase glycosylates ceramide; the entry to glycosphingolipids.',
    hgFrag: { lab: '−hexose (162) neutral loss (+)', mz: 162.0528 } },

  // ── Sterol lipids ─────────────────────────────────────────────────────
  { k: 'CE', name: 'Cholesteryl ester', group: 'Sterol lipids', category: 'ST · Sterol lipids',
    kingdoms: ['Animals'], occurrence: 'The storage/transport form of cholesterol; the lipid core of LDL/HDL particles.',
    kind: 'sterolester', n: 1, cRange: [12, 24], mid: 18, pref: '[M+NH₄]⁺', lpOff: -6.0, hasTm: false,
    xlabel: 'N-acyl carbons · cholesterol fixed', enz: ['SOAT1', 'LCAT'], rhea: 'RHEA:35807',
    pw: "ACAT/SOAT (cells) or LCAT (plasma) esterifies cholesterol's 3-OH; the storage/transport form of sterol.",
    hgFrag: { lab: 'cholestene fragment (+)', mz: 369.3516 } },
  { k: 'ST', name: 'Sterol', group: 'Sterol lipids', category: 'ST · Sterol lipids (free sterol)',
    kingdoms: ['Animals', 'Plants', 'Fungi'], occurrence: 'The free (non-esterified) sterol itself — cholesterol in animals, ergosterol in fungi, phytosterols (sitosterol, stigmasterol, campesterol) in plants. The dominant membrane-rigidifying lipid; ergosterol is the target of azole antifungals.',
    kind: 'sterol', oxyCount: 1, n: 0, cRange: [24, 31], dMax: 4, mid: 28, pref: '[M+H-H₂O]⁺', lpOff: -3.0, hasTm: false,
    xlabel: 'Ring-system carbons · dMax = C=C + ring unsaturation', enz: ['DHCR7', 'DHCR24', 'CYP51', 'ERG6'], rhea: 'RHEA:36783',
    pw: 'Cyclized from squalene via lanosterol (animals/fungi) or cycloartenol (plants), then tailored by demethylation/desaturation — DHCR7 makes the final animal step (cholesterol); CYP51/ERG genes build ergosterol.',
    hgFrag: { lab: '[M+H−H₂O]⁺ dehydration', mz: 18.0106 } },
  { k: 'OxST', name: 'Oxysterol', group: 'Sterol lipids', category: 'ST · Sterol lipids (oxysterol; our own split of LIPID MAPS ST01)',
    kingdoms: ['Animals'], occurrence: 'A sterol bearing a second oxygen (extra hydroxyl or keto group) beyond the native 3-OH — potent signalling lipids (LXR/oxysterol-receptor ligands, e.g. 25-hydroxycholesterol, 27-hydroxycholesterol) and oxidative-stress markers (7-ketocholesterol).',
    kind: 'sterol', oxyCount: 2, n: 0, cRange: [24, 31], dMax: 4, mid: 28, pref: '[M+H]⁺', lpOff: -4.0, hasTm: false,
    xlabel: 'Ring-system carbons · dMax = C=C + ring unsaturation', enz: ['CH25H', 'CYP27A1', 'CYP7B1'], rhea: 'RHEA:50292',
    pw: 'Cholesterol hydroxylases (CH25H, CYP27A1, CYP46A1) or non-enzymatic oxidation add the second oxygen; the resulting oxysterols are LXR ligands and cholesterol-homeostasis signals.',
    hgFrag: { lab: '[M+H−H₂O]⁺ dehydration', mz: 18.0106 } },

  // ── Fatty acyls ───────────────────────────────────────────────────────
  { k: 'FA', name: 'Fatty acid', group: 'Fatty acyls', category: 'FA · Fatty acyls',
    kingdoms: ['Animals', 'Plants', 'Algae', 'Fungi', 'Bacteria', 'Archaea'], occurrence: 'Universal building block and energy substrate; the free pool is small but highly dynamic.',
    kind: 'fattyacyl', n: 1, cRange: [10, 26], mid: 18, pref: '[M-H]⁻', lpOff: 1.0, hasTm: false,
    xlabel: 'Acyl carbons', enz: ['FASN', 'ACACA', 'SCD'], rhea: 'RHEA:16385',
    pw: 'De novo synthesis by fatty acid synthase from acetyl/malonyl-CoA; released by lipases and thioesterases.',
    hgFrag: { lab: '[M−H]⁻ carboxylate', mz: null } },

  { k: 'CL', name: 'Cardiolipin', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids (cardiolipin)',
    kingdoms: ['Animals', 'Plants', 'Fungi', 'Bacteria'], occurrence: 'Four-chain signature lipid of mitochondrial (and bacterial) membranes; concentrated at curved cristae. Remodelling by tafazzin is disrupted in Barth syndrome.',
    bb: { C: 9, H: 22, O: 13, N: 0, P: 2 }, n: 4, cRange: [60, 80], dMax: 12, mid: 72, pref: '[M-H]⁻', lpOff: 14.0, hasTm: true,
    xlabel: 'Total acyl carbons · 4 chains', enz: ['CRLS1', 'TAZ', 'PGS1'], rhea: 'RHEA:32931',
    pw: 'Cardiolipin synthase (CRLS1) condenses PG with CDP-DAG; remodelled by tafazzin (TAZ) to its mature tetra-acyl form.',
    hgFrag: { lab: 'phosphatidyl / glycerophosphate (−)', mz: 152.9958 } },
  { k: 'LPE', name: 'Lysophosphatidylethanolamine', group: 'Glycerophospholipids', category: 'GP · Glycerophospholipids (lyso)',
    kingdoms: ['Animals', 'Plants', 'Fungi'], occurrence: 'Single-chain lyso-PE; a signalling and membrane-remodelling intermediate.',
    bb: { C: 5, H: 14, O: 6, N: 1, P: 1 }, n: 1, cRange: [12, 22], mid: 18, pref: '[M-H]⁻', lpOff: 9.0, hasTm: false,
    xlabel: 'sn-1 acyl carbons', enz: ['PLA2G6', 'MBOAT'], rhea: 'RHEA:32967',
    pw: 'Phospholipase A hydrolysis of PE; re-acylated by lyso-PE acyltransferases (Lands cycle).',
    hgFrag: { lab: 'neutral loss 141 (−)', mz: 141.0191 } },
  { k: 'CAR', name: 'Acylcarnitine', group: 'Fatty acyls', category: 'FA · Fatty acyls (acylcarnitine)',
    kingdoms: ['Animals', 'Plants', 'Fungi', 'Bacteria'], occurrence: 'Fatty acyl esterified to carnitine — the mitochondrial fatty-acid import shuttle; a clinical biomarker of fatty-acid-oxidation disorders.',
    bb: { C: 7, H: 15, O: 3, N: 1, P: 0 }, n: 1, cRange: [2, 20], mid: 16, pref: '[M+H]⁺', lpOff: 4.0, hasTm: false,
    xlabel: 'Acyl carbons', enz: ['CPT1A', 'CPT2', 'CRAT'], rhea: 'RHEA:12929',
    pw: 'Carnitine palmitoyltransferases (CPT1/CPT2) shuttle acyl groups into mitochondria for β-oxidation.',
    hgFrag: { lab: 'carnitine fragment (+)', mz: 85.0284 } },
]

// ── chemistry ──────────────────────────────────────────────────────────────

/** Molecular formula from sum composition (acyl carbons c, double bonds d). */
export function fmtObj(cls: LipidClass, c: number, d: number): Formula {
  const kind = cls.kind ?? 'glycero'
  if (kind === 'sphingo') {
    // c = total carbons (d18 sphingoid base + N-acyl). Cer d18:1/16:0 = C34H67NO3.
    const f: Formula = { ...empty, C: c, H: 1 + 2 * c - 2 * d, O: 3, N: 1 }
    if (cls.subhg === 'SM') { f.C += 5; f.H += 12; f.N += 1; f.O += 3; f.P += 1 }
    else if (cls.subhg === 'Hex') { f.C += 6; f.H += 10; f.O += 5 }
    return f
  }
  if (kind === 'sterolester') {
    // c = N-acyl carbons; cholesterol backbone fixed at C27 (CE 18:1 = C45H78O2).
    return { ...empty, C: 27 + c, H: 44 + 2 * c - 2 * d, O: 2 }
  }
  if (kind === 'glyco') {
    // diacylglycerol core + sugar head (validated: MGDG 34:6 = C43H70O10).
    if (cls.subhg === 'MGDG') return { ...empty, C: 9 + c, H: 14 + 2 * c - 2 * d, O: 10 }
    if (cls.subhg === 'DGDG') return { ...empty, C: 15 + c, H: 24 + 2 * c - 2 * d, O: 15 }
    // SQDG: DAG + sulfoquinovose − H2O
    return { ...empty, C: 9 + c, H: 14 + 2 * c - 2 * d, O: 12, S: 1 }
  }
  if (kind === 'fattyacyl') {
    // free fatty acid CnH(2n-2d)O2 (palmitic C16H32O2, oleic C18H34O2).
    return { ...empty, C: c, H: 2 * c - 2 * d, O: 2 }
  }
  if (kind === 'sterol') {
    // tetracyclic ring system; d = C=C double bonds + ring-fusion unsaturation folded
    // into the constant. Verified against live LIPID MAPS: cholesterol ST 27:1;O =
    // C27H46O, ergosterol ST 28:3;O = C28H44O, 25-OH-cholesterol-class ST 27:1;O2 =
    // C27H46O2 (extra O from hydroxylation costs no H — confirmed against real entries).
    return { ...empty, C: c, H: 2 * c - 2 * d - 6, O: cls.oxyCount ?? 1 }
  }
  const b = cls.bb!
  const n = cls.n
  return {
    ...empty,
    C: (b.C ?? 0) + c,
    H: (b.H ?? 0) + 2 * c - 2 * d - 2 * n,
    O: (b.O ?? 0) + n,
    N: b.N ?? 0,
    P: b.P ?? 0,
  }
}

export function mass(f: Formula): number {
  let m = 0
  for (const e in f) m += f[e as Elem] * MASS[e as Elem]
  return m
}

const ORDER: Elem[] = ['C', 'H', 'N', 'O', 'P', 'S']
/** Hill-order formula segments for React (element + optional count). */
export function formulaParts(f: Formula): { el: string; n: number }[] {
  return ORDER.filter((e) => f[e] > 0).map((e) => ({ el: e, n: f[e] }))
}

// ── property inference ─────────────────────────────────────────────────────

export function likelihood(cls: LipidClass, c: number, d: number): number {
  let lik = 1
  // sterols are built by single-carbon methylation (squalene cyclization + tailoring),
  // not 2-carbon fatty-acid elongation — odd carbon counts are entirely normal.
  if (cls.kind !== 'sterol' && c % 2 !== 0) lik -= 0.5
  const [lo, hi] = cls.cRange
  const mid = cls.mid ?? (cls.n === 3 ? 52 : 35)
  lik -= Math.min(0.4, Math.abs(c - mid) / 40)
  if (d === 0) lik -= 0.08
  if (d > 3) lik -= (d - 3) * 0.14
  if (c < lo + 2 || c > hi - 2) lik -= 0.15
  return Math.max(0.08, Math.min(1, lik))
}

/** True curated status from the ingested LIPID MAPS LMSD index (CC BY 4.0). */
export function isCurated(clsK: string, c: number, d: number): boolean {
  const e = LMSD_CURATED.classes[clsK]
  return !!e && e.comps[`${c}:${d}`] > 0
}
/** Number of curated LMSD structures sharing this sum composition. */
export function curatedCount(clsK: string, c: number, d: number): number {
  return LMSD_CURATED.classes[clsK]?.comps[`${c}:${d}`] ?? 0
}

export function status(cls: LipidClass, c: number, d: number): Status {
  if (isCurated(cls.k, c, d)) return 'known' // real LMSD entry
  const lik = likelihood(cls, c, d)
  if (lik >= 0.24) return 'gap'
  return 'rare'
}

export interface Props { f: Formula; M: number; ccs: number; rt: number; logp: number; tm: number | null }
export function props(cls: LipidClass, c: number, d: number): Props {
  const f = fmtObj(cls, c, d)
  const M = mass(f)
  return {
    f,
    M,
    ccs: Math.round((105 + 0.262 * M - 1.4 * d) * 10) / 10,
    rt: Math.max(0.4, Math.round((2.0 + 0.3 * c - 0.9 * d) * 10) / 10),
    logp: Math.round((0.52 * c - 0.6 * d - cls.lpOff) * 10) / 10,
    tm: cls.hasTm ? Math.round(3.0 * c - 55 - 25 * d) : null,
  }
}

export interface Synth { bio: number; sa: number; chem: number }

/**
 * Composition-based biosynthetic attainability (0–100): does this sum
 * composition sit within what a real enzyme's substrate preference would
 * plausibly make, independent of whether the pathway itself exists? Odd
 * chains, very long chains, and highly polyunsaturated compositions are
 * penalized. Server-side, this is scaled by a live UniProt/Rhea pathway
 * verification (src/lib/pathway.ts) to get the full biosynthetic score (#4).
 */
export function bioAttainability(cls: LipidClass, c: number, d: number): number {
  let bio = 90
  if (cls.kind !== 'sterol' && c % 2 !== 0) bio -= 45
  if (d > 4) bio -= (d - 4) * 14
  if (cls.n > 0) {
    const perChain = c / cls.n
    if (perChain > 24) bio -= (perChain - 24) * 6
    if (perChain < 12) bio -= (12 - perChain) * 5
  }
  return Math.max(4, Math.min(97, Math.round(bio)))
}

export function synth(cls: LipidClass, c: number, d: number): Synth {
  const bio = bioAttainability(cls, c, d)
  const oddPenalty = cls.kind !== 'sterol' && c % 2 !== 0 ? 0.4 : 0
  const perChainOver = cls.n > 0 ? Math.max(0, c / cls.n - 22) : 0
  let sa = 2.6 + d * 0.28 + oddPenalty + perChainOver * 0.08
  if (cls.kind === 'glyco') sa += 0.6 // glycosidic + regiochem
  if (cls.kind === 'sterol') sa += 1.4 // fused polycyclic ring system — genuinely harder to build than a linear chain
  sa = Math.round(Math.min(8.6, sa) * 10) / 10
  const chem = Math.round(Math.max(8, 100 - (sa - 2.6) * 15))
  return { bio, sa, chem }
}

/** Split sum composition into a plausible "most abundant" isomer for MS/MS. */
export function isomer(cls: LipidClass, c: number, d: number): [number, number][] {
  const kind = cls.kind ?? 'glycero'
  if (kind === 'sphingo') {
    const bDB = d >= 1 ? 1 : 0
    return [[18, bDB], [c - 18, d - bDB]]
  }
  if (kind === 'sterolester' || kind === 'fattyacyl' || kind === 'sterol' || cls.n === 1) return [[c, d]]
  if (cls.n === 4) {
    const base = Math.floor(c / 4)
    const cs = [base, base, base, c - 3 * base]
    return cs.map((cc, i) => [cc, i < d % 4 ? Math.ceil(d / 4) : Math.floor(d / 4)]) as [number, number][]
  }
  if (cls.n === 2) {
    let c1 = 16
    let c2 = c - 16
    if (c2 < 12) { c1 = Math.floor(c / 2); c2 = c - c1 }
    return [[c1, 0], [c2, d]]
  }
  let cc = c - 34
  if (cc < 8) cc = c - 32
  return [[16, 0], [cc < 8 ? 16 : 18, d > 0 ? 1 : 0], [cc, Math.max(0, d - (d > 0 ? 1 : 0))]]
}

/** [FA−H]⁻ fragment m/z for a fatty acyl of c carbons, d double bonds. */
export function faFragment(c: number, d: number): number {
  return c * MASS.C + (2 * c - 2 * d - 1) * MASS.H + 2 * MASS.O - PROTON
}

export const fam = (c: number, d: number) => `${c}:${d}`
export function findClass(k: string): LipidClass | undefined {
  return CLASSES.find((x) => x.k.toUpperCase() === k.toUpperCase())
}

export function headgroupCharge(cls: LipidClass): string {
  if (cls.k === 'PC' || cls.k === 'SM' || cls.k === 'LPC' || cls.k === 'CAR') return 'zwitterionic'
  if (cls.k === 'SQDG' || cls.k === 'FA' || cls.k === 'CL') return 'anionic'
  if (cls.group === 'Glycerolipids' || cls.group === 'Glycolipids' || cls.group === 'Sterol lipids' || cls.k === 'Cer' || cls.k === 'HexCer') return 'neutral'
  return 'anionic'
}

/** Adducts that prefer ammonium (vs. formate) on the third displayed row. */
export function prefersAmmonium(cls: LipidClass): boolean {
  return cls.n === 3 || ['DG', 'CE', 'MGDG', 'DGDG'].includes(cls.k)
}

// ── membrane biophysics & nanomechanics ────────────────────────────────────
// First-class bilayer properties: structure (thickness, area/lipid), packing &
// curvature phase, phase state, and AFM-style nanomechanics (breakthrough force,
// area-compressibility modulus). Computed from composition — heuristic placeholders
// (method: predicted); the measured tier comes from AFM force spectroscopy.

/** Effective headgroup cross-sectional area (Å²) per class. */
const HEAD_AREA: Record<string, number> = {
  PC: 68, PE: 52, PS: 55, PG: 66, PI: 75, PA: 50, LPC: 92, LPE: 55,
  DGDG: 75, SQDG: 70, MGDG: 48, SM: 60, Cer: 40, HexCer: 65, CL: 120,
}
/** Classes that form / participate in membranes (vs. neutral storage lipids). */
export const MEMBRANE_CLASSES = new Set(Object.keys(HEAD_AREA))

export interface Membrane {
  bilayer: boolean
  thicknessNm: number
  areaPerLipid: number
  packing: number
  curvature: string
  phase37: string
  tmC: number
  breakthroughNn: number
  compressibilityKa: number
}

/** Acyl-chain count for per-chain geometry (sphingoid base + N-acyl count as 2, else cls.n). */
export function chainsOf(cls: LipidClass): number { return cls.kind === 'sphingo' ? 2 : cls.n }

interface MembraneInputs { chains: number; nc: number; dpc: number; a0: number; v: number; lc: number; tm: number }

function membraneInputs(cls: LipidClass, c: number, d: number): MembraneInputs {
  const chains = chainsOf(cls)
  const nc = c / chains // carbons per chain
  const dpc = d / chains // double bonds per chain
  const a0 = HEAD_AREA[cls.k] ?? 60
  const v = chains * (27.4 + 26.9 * nc) // hydrocarbon volume, Å³ (Tanford)
  const lc = 1.5 + 1.265 * nc // max chain length, Å (Tanford)
  const tm = 3.0 * c - 55 - 25 * d // same heuristic as props().tm
  return { chains, nc, dpc, a0, v, lc, tm }
}

/** The real formulas, shared by single-species and mixture (ideal-mixing) callers alike. */
function deriveMembrane(inp: MembraneInputs): Membrane {
  const packing = inp.v / (inp.a0 * inp.lc) // shape / packing parameter P = v/(a0·lc)
  const curvature = packing < 0.55 ? 'micellar (positive curvature)'
    : packing <= 1.0 ? 'lamellar bilayer'
    : 'inverted hexagonal Hᴵᴵ (negative curvature)'
  const thicknessNm = Math.round((2 * inp.lc * 0.065 + 0.9 - 0.35 * inp.dpc) * 100) / 100
  const areaPerLipid = Math.round(inp.a0 + 7 * inp.dpc)
  const phase37 = inp.tm > 37 ? 'gel (ordered)' : 'fluid (liquid-crystalline)'
  const tmC = Math.round(inp.tm * 10) / 10
  const breakthroughNn = Math.round(Math.max(0.3, 0.32 * inp.nc - 2.0 * inp.dpc - 2.4) * 10) / 10
  const compressibilityKa = Math.round(180 + 7 * inp.nc - 45 * inp.dpc)
  return {
    bilayer: packing >= 0.55 && packing <= 1.05,
    thicknessNm, areaPerLipid, packing: Math.round(packing * 100) / 100,
    curvature, phase37, tmC, breakthroughNn, compressibilityKa,
  }
}

export function membraneBiophysics(cls: LipidClass, c: number, d: number): Membrane | null {
  if (!MEMBRANE_CLASSES.has(cls.k)) return null // neutral storage lipids don't form membranes
  return deriveMembrane(membraneInputs(cls, c, d))
}

export interface MixComponent { cls: LipidClass; c: number; d: number; molFraction: number }

/**
 * Ideal-mixing approximation: mole-fraction-weighted combination of each component's real
 * physical inputs (specific volume/area additivity — a standard first-order ideal-mixing
 * assumption), then the *same* real formulas above derive the emergent bilayer properties from
 * the mixed inputs — not an average of each component's pre-computed output properties.
 *
 * No non-ideal interaction terms: real mixtures deviate from this for well-studied pairs (e.g.
 * cholesterol's condensing effect, Lo/Ld phase separation) — this function doesn't model that,
 * see issue #63. Callers must present this as an approximation, not a discovered result.
 */
export function mixMembraneBiophysics(components: MixComponent[]): Membrane | null {
  const valid = components.filter((k) => MEMBRANE_CLASSES.has(k.cls.k) && k.molFraction > 0)
  if (!valid.length) return null
  const total = valid.reduce((s, k) => s + k.molFraction, 0)
  if (total <= 0) return null
  const mixed = valid.reduce((acc, k) => {
    const x = k.molFraction / total
    const inp = membraneInputs(k.cls, k.c, k.d)
    acc.chains += x * inp.chains
    acc.nc += x * inp.nc
    acc.dpc += x * inp.dpc
    acc.a0 += x * inp.a0
    acc.v += x * inp.v
    acc.lc += x * inp.lc
    acc.tm += x * inp.tm
    return acc
  }, { chains: 0, nc: 0, dpc: 0, a0: 0, v: 0, lc: 0, tm: 0 })
  return deriveMembrane(mixed)
}

// ── literature ───────────────────────────────────────────────────────────

export interface Ref { authors: string; title: string; journal: string; year: number; doi: string }

/** Foundational, verifiable references the atlas itself is built on. */
export const FOUNDATIONAL_REFS: Ref[] = [
  { authors: 'Fahy E, Subramaniam S, Brown HA, et al.', title: 'A comprehensive classification system for lipids',
    journal: 'J Lipid Res', year: 2005, doi: '10.1194/jlr.E400004-JLR200' },
  { authors: 'Fahy E, Subramaniam S, Murphy RC, et al.', title: 'Update of the LIPID MAPS comprehensive classification system for lipids',
    journal: 'J Lipid Res', year: 2009, doi: '10.1194/jlr.R800095-JLR200' },
  { authors: 'Sud M, Fahy E, Cotter D, et al.', title: 'LMSD: LIPID MAPS structure database',
    journal: 'Nucleic Acids Res', year: 2007, doi: '10.1093/nar/gkl838' },
  { authors: 'Liebisch G, Vizcaíno JA, Köfeler H, et al.', title: 'Shorthand notation for lipid structures derived from mass spectrometry',
    journal: 'J Lipid Res', year: 2013, doi: '10.1194/jlr.M033506' },
  { authors: 'Aimo L, Liechti R, Hyka-Nouspikel N, et al.', title: 'The SwissLipids knowledgebase for lipid biology',
    journal: 'Bioinformatics', year: 2015, doi: '10.1093/bioinformatics/btv285' },
]

/** Live Europe PMC search for a class — real papers, no fabricated citations. */
export function pmcSearchUrl(cls: LipidClass): string {
  return `https://europepmc.org/search?query=${encodeURIComponent(`"${cls.name}" lipidomics`)}`
}
