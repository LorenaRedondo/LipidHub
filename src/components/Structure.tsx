import { useEffect, useState } from 'react'
import type { LipidClass } from '../lib/lipids'
import { toSmiles } from '../lib/smiles'
import { useLmsdStructure } from '../lib/lmsdStructures'
import Schematic from './Schematic'

interface Props { cls: LipidClass; c: number; d: number; iso: [number, number][] }

/**
 * 2D depiction of the selected species. Prefers the real LIPID MAPS structure for
 * curated species; otherwise builds a SMILES from composition. Renders with
 * OpenChemLib (lazy-loaded), falling back to the cartoon on any failure.
 */
export default function Structure({ cls, c, d, iso }: Props) {
  const real = useLmsdStructure(`${cls.k}-${c}-${d}`)
  const smiles = real?.smiles ?? toSmiles(cls, c, d)
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    if (!smiles) return
    import('openchemlib')
      .then((OCL) => {
        if (cancelled) return
        try {
          const mol = OCL.Molecule.fromSmiles(smiles)
          mol.stripStereoInformation()
          setSvg(mol.toSVG(340, 150, undefined, { autoCrop: true, autoCropMargin: 6, suppressChiralText: true, noStereoProblem: true }))
        } catch {
          setSvg(null)
        }
      })
      .catch(() => { if (!cancelled) setSvg(null) })
    return () => { cancelled = true }
  }, [smiles])

  if (!svg) return <Schematic cls={cls} iso={iso} />

  return (
    <div className="structure">
      <div className="struct-canvas" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="struct-cap">
        {real
          ? <>Real structure from <b>LIPID MAPS</b> · {real.lmId}</>
          : <>Predicted 2D structure of the likely isomer {iso.map((x) => `${x[0]}:${x[1]}`).join(' / ')} · double-bond positions illustrative</>}
      </div>
    </div>
  )
}
