import { useEffect, useState } from 'react'
import type { LipidClass } from '../lib/lipids'
import { toSmiles } from '../lib/smiles'
import Schematic from './Schematic'

interface Props { cls: LipidClass; c: number; d: number; iso: [number, number][] }

/**
 * Real 2D depiction of the selected species. Builds a SMILES from composition and
 * renders it with OpenChemLib (lazy-loaded, code-split). Falls back to the cartoon
 * schematic while loading, when a class has no template, or on any parse failure.
 */
export default function Structure({ cls, c, d, iso }: Props) {
  const smiles = toSmiles(cls, c, d)
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
          const out = mol.toSVG(340, 150, undefined, {
            autoCrop: true,
            autoCropMargin: 6,
            suppressChiralText: true,
            noStereoProblem: true,
          })
          setSvg(out)
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
        2D structure of the likely isomer {iso.map((x) => `${x[0]}:${x[1]}`).join(' / ')} · double-bond
        positions illustrative
      </div>
    </div>
  )
}
