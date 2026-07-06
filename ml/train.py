"""Train CCS & RT models with calibrated uncertainty, then precompute predictions.

Pipeline (Track A):
  features → gradient-boosted trees → split-conformal prediction intervals →
  evaluate (MAE / R² / coverage) → precompute predictions for the whole enumerated
  space into src/data/predictions.json (the store the API + UI read).

Demo uses physics-shaped synthetic targets (ml/features.synthetic_targets). Point the
loader at a real dataset (AllCCS/METLIN-CCS, RT libraries) and nothing else changes.

Run: python ml/train.py
"""
import json
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split

from features import featurize, synthetic_targets

MODEL_VERSION = "demo-gbm-0.1"
HERE = os.path.dirname(__file__)
ROOT = os.path.dirname(HERE)


def fit_with_conformal(X, y, seed=0):
    """GBM point model + split-conformal 90% interval (residual quantile on a calibration split)."""
    X_tr, X_cal, y_tr, y_cal = train_test_split(X, y, test_size=0.2, random_state=seed)
    model = GradientBoostingRegressor(n_estimators=300, max_depth=3, learning_rate=0.05, subsample=0.8, random_state=seed)
    model.fit(X_tr, y_tr)
    resid = np.abs(y_cal - model.predict(X_cal))
    qhat = float(np.quantile(resid, 0.90))            # 90% conformal half-width
    return model, qhat, (X_cal, y_cal)


def evaluate(model, qhat, X_cal, y_cal):
    pred = model.predict(X_cal)
    mae = float(np.mean(np.abs(pred - y_cal)))
    ss_res = float(np.sum((y_cal - pred) ** 2))
    ss_tot = float(np.sum((y_cal - np.mean(y_cal)) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    coverage = float(np.mean(np.abs(pred - y_cal) <= qhat))   # should be ~0.90
    return {"mae": round(mae, 3), "r2": round(r2, 3), "coverage": round(coverage, 3), "ci_halfwidth": round(qhat, 3)}


def main():
    df = pd.read_csv(os.path.join(HERE, "dataset.csv"))
    feats = featurize(df)
    X = feats.values
    ccs, rt = synthetic_targets(df, feats)

    ccs_model, ccs_q, ccs_cal = fit_with_conformal(X, ccs, seed=1)
    rt_model, rt_q, rt_cal = fit_with_conformal(X, rt, seed=2)

    metrics = {
        "model_version": MODEL_VERSION,
        "n_species": int(len(df)),
        "features": list(feats.columns),
        "note": "Trained on physics-shaped SYNTHETIC targets for the demo. Swap in AllCCS/METLIN-CCS + RT libraries for production.",
        "ccs": evaluate(ccs_model, ccs_q, *ccs_cal),
        "rt": evaluate(rt_model, rt_q, *rt_cal),
    }
    os.makedirs(os.path.join(HERE, "models"), exist_ok=True)
    with open(os.path.join(HERE, "models", "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # precompute predictions for the whole enumerated space → the store the UI/API read
    ccs_p = ccs_model.predict(X)
    rt_p = rt_model.predict(X)
    preds = {}
    for i, sid in enumerate(df["id"]):
        preds[sid] = {
            "ccs": {"v": round(float(ccs_p[i]), 1), "lo": round(float(ccs_p[i] - ccs_q), 1), "hi": round(float(ccs_p[i] + ccs_q), 1)},
            "rt": {"v": round(float(max(0.2, rt_p[i])), 2), "lo": round(float(max(0.0, rt_p[i] - rt_q)), 2), "hi": round(float(rt_p[i] + rt_q), 2)},
        }
    out = {"model_version": MODEL_VERSION, "method": "predicted", "unit": {"ccs": "Å²", "rt": "min"}, "predictions": preds}
    os.makedirs(os.path.join(ROOT, "src", "data"), exist_ok=True)
    with open(os.path.join(ROOT, "src", "data", "predictions.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))

    print("CCS", metrics["ccs"])
    print("RT ", metrics["rt"])
    print(f"wrote src/data/predictions.json ({len(preds)} species), ml/models/metrics.json")


if __name__ == "__main__":
    main()
