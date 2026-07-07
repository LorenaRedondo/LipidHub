# LIPIDEX ML pipeline

Two independent steps that both write into the store the API/MCP/UI read (the "ML
writes into the store" pattern from `docs/vision.md`):

```
pip install -r ml/requirements.txt
npm run export:dataset       # TS → ml/dataset.csv (enumerated species + composition + SMILES)
python ml/train.py           # CCS/RT models → src/data/predictions.json + models/metrics.json
python ml/synth.py           # real SAScore (RDKit) → src/data/synth.json
npm run db:build             # overlays both, plus live UniProt/Rhea pathway verification, into db/lipidex.sqlite
```

## What it does
- `features.py` — physically-meaningful features (mass, mean chain length, unsaturation
  index, a packing proxy, headgroup one-hot). No RDKit needed for CCS/RT.
- `train.py` — gradient-boosted trees + **split-conformal 90% intervals**; reports MAE, R²,
  and interval coverage (should be ≈0.90).
- `synth.py` — the real Ertl/Schuffenhauer synthetic accessibility score (SAScore) via
  `sascorer.py` + `fpscores.pkl.gz`, vendored unmodified from RDKit's `Contrib/SA_Score`
  (see `NOTICE`). Computed directly from each species' SMILES — a real structural
  calculation, not a trained-model prediction (`method: 'calculated'`). Replaces the
  fabricated linear heuristic previously used for chemical accessibility (#4). The
  biosynthetic half of #4 (live UniProt/Rhea pathway verification) lives in
  `src/lib/pathway.ts` and runs as part of `npm run db:build`, not this script.

## Demo vs production
`train.py` trains on **physics-shaped synthetic targets** (`features.synthetic_targets`) — a
non-linear function a linear fit can't capture — so the pipeline is exercised end to end.
For production, replace the target loader with a real dataset (AllCCS / METLIN-CCS for CCS,
retention-time libraries for RT); nothing else in the pipeline changes. Add RDKit descriptors
and the physics-informed (baseline + residual) variant per issue #36. `synth.py` is already
real — no synthetic-target caveat applies to it.
