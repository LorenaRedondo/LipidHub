# LIPIVERSE ML pipeline

Cleans real experimental data, trains hyperparameter-tuned property models with every
experiment tracked in MLflow, and writes into the store the API/MCP/UI read (the "ML
writes into the store" pattern from `docs/vision.md`).

```
python3 -m venv ml/.venv && source ml/.venv/bin/activate
pip install -r ml/requirements.txt

npm run export:dataset       # TS → ml/dataset.csv (enumerated species + composition + SMILES)
python ml/data_prep.py       # raw real CCS data → ml/data/processed/real_lipid_ccs.csv (cleaned, QA'd)
python ml/train.py           # tunes + trains CCS/RT models → src/data/predictions.json + models/metrics.json
python ml/synth.py           # real SAScore (RDKit) → src/data/synth.json
python ml/logp.py            # real logP (RDKit Crippen) → src/data/logp.json
npm run db:build             # overlays everything, plus live UniProt/Rhea pathway verification, into db/lipidhub.sqlite

mlflow ui --backend-store-uri sqlite:///ml/mlflow.db   # compare every training run/trial
```

## The pipeline, stage by stage

**1. Cleaning (`data_prep.py`).** Source: the [PNNL/Baker-lab Unified CCS Compendium](https://github.com/PNNL-Comp-Mass-Spec/MetabolomicsCCS)
— real, drift-tube-measured, traceable-standard collision cross sections (CC-licensed,
GitHub-hosted, `ml/data/raw/pnnl_ccs_compendium.tsv`). It's a general metabolomics
standards library, not lipid-specific, so the cleaning work is:
- keep only lipid-relevant subclasses (Lipids, Fatty Acids, Steroids);
- parse names into our own `class / carbons / dbonds` shorthand — handles both direct
  shorthand (`LPC 18:1`) and chain notation (`PC (16:1/16:1)`, with inline stereo
  descriptors like `PC(18:1(9Z)/16:0)`), summing multi-chain compositions;
- **explicitly reject ether-linked species** (`16:0e`, `P-18:0` plasmalogens) — they have a
  genuinely different formula than our diacyl-only model computes, so silently matching
  them would poison the training data with a real chemistry error, not a rounding one;
- **two independent QA passes**: the compendium's own declared formula must match its own
  declared mass (catches transcription errors), *and* an independently-rederived diacyl
  formula for the parsed `(class, carbons, dbonds)` must match too (catches derivatized
  reference standards, e.g. a methylated `PG (16:0/16:0) 4Me` that parses fine but isn't
  chemically equivalent to plain `PG 32:0`);
- reshape the wide per-adduct columns into tidy rows, keep the lowest-RSD measurement per
  `(species, adduct)` when duplicated.

Result: ~20 real lipid species, ~34 (species, adduct) measurements, each with its real
relative standard deviation (a genuine experimental uncertainty, not invented).

**2. Transformation (`features.py`).** Physically-meaningful features — mass, mean chain
length, unsaturation index, a packing proxy, headgroup one-hot — computed from composition
alone (no RDKit needed for the enumerated space). Also fits the **CCS physics-baseline's
linear coefficients** (mass-scale, headgroup offsets, unsaturation slope) to the real,
cleaned anchor points via ordinary least squares — the literature-typical mass exponent
(~0.635) is held fixed since 4 free parameters is already a defensible ceiling for ~6–15
real anchor points; estimating the exponent too would not be. Falls back to hand-set
constants when there isn't enough real data to fit safely.

**3. Training with hyperparameter search (`train.py`).**
- The ~20 real CCS species are split into a **calibration anchor** set (used only to fit
  the baseline above) and a **held-out test set that nothing else ever touches**.
- GBM hyperparameters (`n_estimators`, `max_depth`, `learning_rate`, `subsample`,
  `min_samples_leaf`) are tuned via **Optuna** (25 trials, TPE sampler) against **4-fold
  CV MAE** on the training split — every trial logged as its own MLflow run.
- The champion config is refit on the full training split; a **split-conformal 90%
  interval** is calibrated on a separate held-out split (never used for training or
  hyperparameter selection).

**4. Test performance.** Reported for **three** disjoint sets, all logged to MLflow with
residual-plot artifacts:
- synthetic test split (broad-coverage sanity check — not real data);
- **the real held-out CCS measurements** — the only number in this whole app that
  compares a prediction to a real, physically-measured value it never saw;
- (RT has no real-data test — see caveat below.)

**5. `synth.py`** — the real Ertl/Schuffenhauer SAScore via `sascorer.py` +
`fpscores.pkl.gz`, vendored unmodified from RDKit's `Contrib/SA_Score` (see `NOTICE`).
Computed directly from each species' SMILES — a real structural calculation
(`method: 'calculated'`), not a trained-model guess.

**6. `logp.py`** — real logP via RDKit's Crippen atom-contribution method
(`rdkit.Chem.Crippen.MolLogP`), computed directly from each species' SMILES. Same
`method: 'calculated'` treatment as SAScore; replaces the heuristic linear formula
for the ~2,000 species with a valid SMILES (server/API/MCP only — see the frontend
caveat in the table below).

## What's real vs. what's still a documented placeholder

| Property | Status |
|---|---|
| CCS | **Physics baseline fit to real measurements** + GBM residual correction, hyperparameter-tuned, **validated against a held-out real test set** (see `ml/models/metrics.json` → `ccs.real_holdout_test`). Still small-N (single digits of held-out points) — the coverage number on that split is noisy by nature of the sample size; report the point estimate (MAE/R²) as primary evidence, not the coverage. |
| RT | Physics-*shaped* synthetic target only. Retention time is method/instrument-specific (unlike CCS, there's no single "true" RT — see [RepoRT](https://github.com/michaelwitting/RepoRT)/[PredRet](https://www.researchgate.net/publication/281108823_PredRet_Prediction_of_Retention_Time_by_Direct_Mapping_between_Multiple_Chromatographic_Systems)), and no bulk lipid RT dataset was obtainable in this environment. Swapping in a real, single-method RT library only touches `synthetic_targets()`'s RT half — everything downstream (Optuna search, MLflow tracking, conformal calibration, precompute) is already generic. |
| SAScore (chemical synthesizability) | Real RDKit computation, not a placeholder. |
| logP | Real RDKit (Crippen) computation for species with a valid SMILES (~2,000 of ~2,090 plausible species) — server/API/MCP only; the frontend SPA still computes its own heuristic client-side since it has no access to this offline pipeline's output beyond what's written into `db/lipidhub.sqlite`. TPSA/other RDKit descriptors not yet computed. |
| Biosynthetic score | Live UniProt/Rhea pathway verification (`src/lib/pathway.ts`), not this pipeline. |

## Comparing experiments

Every run of `train.py` is one MLflow parent run containing two nested hyperparameter
searches (CCS, RT), each with 25 child trial runs — 53 runs total, each with its params,
CV MAE, and (for the champion) final test metrics and residual plots. `mlflow ui` is the
tool the whole team can use to see whether a change (new data, a feature, a search space
tweak) actually moved the needle, not just whether the final numbers looked plausible.
