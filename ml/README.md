# LIPIDEX ML pipeline

Train CCS & RT property models with **calibrated uncertainty**, then precompute
predictions for the enumerated space into `src/data/predictions.json` — the store the
API and UI read (the "ML writes into the store" pattern from `docs/vision.md`).

```
pip install -r ml/requirements.txt
npm run export:dataset       # TS → ml/dataset.csv (enumerated species + composition)
python ml/train.py           # trains, evaluates, writes predictions.json + models/metrics.json
```

## What it does
- `features.py` — physically-meaningful features (mass, mean chain length, unsaturation
  index, a packing proxy, headgroup one-hot). No RDKit needed for the enumerated space.
- `train.py` — gradient-boosted trees + **split-conformal 90% intervals**; reports MAE, R²,
  and interval coverage (should be ≈0.90).

## Demo vs production
The demo trains on **physics-shaped synthetic targets** (`features.synthetic_targets`) — a
non-linear function a linear fit can't capture — so the pipeline is exercised end to end.
For production, replace the target loader with a real dataset (AllCCS / METLIN-CCS for CCS,
retention-time libraries for RT); nothing else in the pipeline changes. Add RDKit descriptors
and the physics-informed (baseline + residual) variant per issue #36.
