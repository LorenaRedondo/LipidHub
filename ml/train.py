"""Train CCS & RT models: clean data in, hyperparameter-tuned GBM + conformal intervals
out, every trial tracked in MLflow, precomputed predictions written for the app to serve.

Pipeline:
  ml/data_prep.py (already run)  ->  real anchor/test CCS split
  featurize (ml/features.py)     ->  physics features for the full enumerated space
  calibrate CCS baseline         ->  fit physics-prior coefficients to the real anchor split
  Optuna search (K-fold CV)      ->  tune GBM hyperparameters, every trial logged to MLflow
  refit champion on full train   ->  split conformal 90% interval on a held-out calibration set
  evaluate                       ->  synthetic test split AND (CCS only) the real held-out set
  precompute                     ->  src/data/predictions.json (unchanged contract)

Run: python ml/train.py
View experiments: mlflow ui --backend-store-uri sqlite:///ml/mlflow.db   (then open localhost:5000)
"""
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import mlflow
import numpy as np
import optuna
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import KFold, train_test_split

from features import calibrate_ccs_baseline, featurize, synthetic_targets

optuna.logging.set_verbosity(optuna.logging.WARNING)

MODEL_VERSION = "gbm-v2-optuna-real-anchored"
HERE = os.path.dirname(__file__)
ROOT = os.path.dirname(HERE)
N_TRIALS = 25
N_FOLDS = 4
SEED = 42

mlflow.set_tracking_uri(f"sqlite:///{os.path.join(HERE, 'mlflow.db')}")
mlflow.set_experiment("lipidex-property-models")


def load_real_ccs() -> pd.DataFrame:
    """Real, cleaned CCS anchor points restricted to a single reference adduct ([M+H]+) so
    values are directly comparable (different adducts shift CCS systematically)."""
    path = os.path.join(HERE, "data", "processed", "real_lipid_ccs.csv")
    if not os.path.exists(path):
        return pd.DataFrame(columns=["id", "class", "carbons", "dbonds", "ccs_measured", "headgroup", "mass"])
    real = pd.read_csv(path)
    real = real[real["adduct"] == "[M+H]+"].copy()
    dataset = pd.read_csv(os.path.join(HERE, "dataset.csv"))
    real = real.merge(dataset[["id", "exact_mass", "headgroup"]], on="id", how="inner")
    real = real.rename(columns={"exact_mass": "mass"})
    return real.drop_duplicates(subset="id")


def cv_score(X, y, params) -> float:
    """Mean K-fold CV MAE for one hyperparameter configuration."""
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)
    errs = []
    for tr_idx, va_idx in kf.split(X):
        m = GradientBoostingRegressor(random_state=SEED, **params)
        m.fit(X[tr_idx], y[tr_idx])
        pred = m.predict(X[va_idx])
        errs.append(np.mean(np.abs(pred - y[va_idx])))
    return float(np.mean(errs))


def suggest_params(trial: optuna.Trial) -> dict:
    return {
        "n_estimators": trial.suggest_int("n_estimators", 80, 500),
        "max_depth": trial.suggest_int("max_depth", 2, 5),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
        "subsample": trial.suggest_float("subsample", 0.6, 1.0),
        "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 20),
    }


def tune(X, y, label: str) -> dict:
    """Optuna search over GBM hyperparameters; every trial logged as a nested MLflow run."""
    with mlflow.start_run(run_name=f"{label}-search", nested=True):
        mlflow.log_params({"n_trials": N_TRIALS, "n_folds": N_FOLDS, "n_train_rows": len(X)})

        def objective(trial: optuna.Trial) -> float:
            params = suggest_params(trial)
            score = cv_score(X, y, params)
            with mlflow.start_run(run_name=f"{label}-trial-{trial.number}", nested=True):
                mlflow.log_params(params)
                mlflow.log_metric("cv_mae", score)
            return score

        study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=SEED))
        study.optimize(objective, n_trials=N_TRIALS, show_progress_bar=False)
        mlflow.log_metric("best_cv_mae", study.best_value)
        mlflow.log_params({f"best_{k}": v for k, v in study.best_params.items()})
        return study.best_params


def fit_with_conformal(X_train, y_train, X_cal, y_cal, params, seed=0):
    model = GradientBoostingRegressor(random_state=seed, **params)
    model.fit(X_train, y_train)
    resid = np.abs(y_cal - model.predict(X_cal))
    qhat = float(np.quantile(resid, 0.90))
    return model, qhat


def evaluate(model, qhat, X, y) -> dict:
    pred = model.predict(X)
    mae = float(np.mean(np.abs(pred - y)))
    ss_res = float(np.sum((y - pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    coverage = float(np.mean(np.abs(pred - y) <= qhat))
    return {"mae": round(mae, 3), "r2": round(r2, 3), "coverage": round(coverage, 3), "ci_halfwidth": round(qhat, 3), "n": len(y)}


def residual_plot(y_true, y_pred, title: str, path: str):
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.scatter(y_true, y_pred, s=14, alpha=0.5, color="#2b7d7a")
    lo, hi = min(y_true.min(), y_pred.min()), max(y_true.max(), y_pred.max())
    ax.plot([lo, hi], [lo, hi], "--", color="#e6b34d", linewidth=1)
    ax.set_xlabel("true")
    ax.set_ylabel("predicted")
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)


def main():
    df = pd.read_csv(os.path.join(HERE, "dataset.csv"))
    feats = featurize(df)
    feature_cols = list(feats.columns)

    # ── real CCS anchor / held-out-test split (never touch the test half again) ──────
    real = load_real_ccs()
    if len(real) >= 6:
        real_anchor, real_test = train_test_split(real, test_size=0.4, random_state=SEED)
    else:
        real_anchor, real_test = real, real.iloc[0:0]
    ccs_coef = calibrate_ccs_baseline(real_anchor)

    ccs_target, rt_target = synthetic_targets(df, feats, seed=SEED, ccs_coef=ccs_coef)

    with mlflow.start_run(run_name="lipidex-training-run") as parent:
        mlflow.log_param("model_version", MODEL_VERSION)
        mlflow.log_param("n_species", len(df))
        mlflow.log_param("n_real_anchor", len(real_anchor))
        mlflow.log_param("n_real_test", len(real_test))
        mlflow.log_dict(ccs_coef, "ccs_baseline_coefficients.json")
        real_ccs_path = os.path.join(HERE, "data", "processed", "real_lipid_ccs.csv")
        if os.path.exists(real_ccs_path):
            mlflow.log_artifact(real_ccs_path)

        X = feats.values
        metrics = {"model_version": MODEL_VERSION, "n_species": int(len(df)), "features": feature_cols,
                   "ccs_baseline_coefficients": ccs_coef, "n_real_anchor_points": int(len(real_anchor)),
                   "n_real_holdout_points": int(len(real_test))}
        preds = {}

        for label, y_full in [("ccs", ccs_target), ("rt", rt_target)]:
            X_train, X_rest, y_train, y_rest = train_test_split(X, y_full, test_size=0.4, random_state=SEED)
            X_cal, X_test, y_cal, y_test = train_test_split(X_rest, y_rest, test_size=0.5, random_state=SEED)

            best_params = tune(X_train, y_train, label)
            model, qhat = fit_with_conformal(X_train, y_train, X_cal, y_cal, best_params, seed=SEED)

            synth_test_metrics = evaluate(model, qhat, X_test, y_test)
            plot_path = os.path.join(HERE, f"{label}_residuals.png")
            residual_plot(y_test, model.predict(X_test), f"{label.upper()} — synthetic test set", plot_path)
            mlflow.log_artifact(plot_path)
            mlflow.log_metrics({f"{label}_synth_{k}": v for k, v in synth_test_metrics.items() if isinstance(v, (int, float))})

            metrics[label] = {"synthetic_test": synth_test_metrics, "best_params": best_params}

            if label == "ccs" and len(real_test):
                real_input = pd.DataFrame({
                    "carbons": real_test["carbons"], "dbonds": real_test["dbonds"],
                    "class": real_test["class"], "exact_mass": real_test["mass"], "headgroup": real_test["headgroup"],
                })
                real_X = featurize(real_input).values
                real_metrics = evaluate(model, qhat, real_X, real_test["ccs_measured"].values)
                metrics[label]["real_holdout_test"] = real_metrics
                mlflow.log_metrics({f"ccs_real_{k}": v for k, v in real_metrics.items() if isinstance(v, (int, float))})
                real_plot = os.path.join(HERE, "ccs_real_residuals.png")
                residual_plot(real_test["ccs_measured"].values, model.predict(real_X), "CCS — REAL held-out measurements", real_plot)
                mlflow.log_artifact(real_plot)

            # precompute for the full enumerated space
            full_pred = model.predict(X)
            for i, sid in enumerate(df["id"]):
                preds.setdefault(sid, {})[label] = {
                    "v": round(float(full_pred[i]), 2 if label == "rt" else 1),
                    "lo": round(float(max(0, full_pred[i] - qhat)), 2 if label == "rt" else 1),
                    "hi": round(float(full_pred[i] + qhat), 2 if label == "rt" else 1),
                }

        mlflow.log_dict(metrics, "metrics.json")

    os.makedirs(os.path.join(HERE, "models"), exist_ok=True)
    with open(os.path.join(HERE, "models", "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    out = {"model_version": MODEL_VERSION, "method": "predicted", "unit": {"ccs": "Å²", "rt": "min"}, "predictions": preds}
    with open(os.path.join(ROOT, "src", "data", "predictions.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))

    print(f"CCS  synthetic test: {metrics['ccs']['synthetic_test']}")
    if "real_holdout_test" in metrics["ccs"]:
        print(f"CCS  REAL held-out : {metrics['ccs']['real_holdout_test']}")
    print(f"RT   synthetic test: {metrics['rt']['synthetic_test']}")
    print(f"wrote src/data/predictions.json ({len(preds)} species), ml/models/metrics.json")
    print(f"mlflow run: {parent.info.run_id}  (mlflow ui --backend-store-uri sqlite:///ml/mlflow.db)")


if __name__ == "__main__":
    main()
