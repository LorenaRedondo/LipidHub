"""Physically-meaningful features for lipid property prediction.

No RDKit needed — everything is derived from sum composition + headgroup, which is
what we have for the enumerated space. These are the features a physics-informed
model wants: size, unsaturation, packing, and headgroup identity.
"""
import numpy as np
import pandas as pd

HEADGROUPS = ["zwitterionic", "anionic", "neutral"]
# n chains per class (for mean chain length); default 2
NCHAINS = {"TG": 3, "FA": 1, "LPC": 1, "CE": 1, "Cer": 1, "SM": 1, "HexCer": 1}


def featurize(df: pd.DataFrame) -> pd.DataFrame:
    c = df["carbons"].astype(float)
    d = df["dbonds"].astype(float)
    n = df["class"].map(lambda k: NCHAINS.get(k, 2)).astype(float)
    mean_chain = c / n
    unsat_index = d / c.clip(lower=1)                 # double bonds per carbon
    # packing proxy: longer, straighter (fewer double bonds) chains pack tighter
    packing = mean_chain * (1.0 - 0.15 * (d / n))
    feats = pd.DataFrame({
        "mass": df["exact_mass"].astype(float),
        "carbons": c,
        "dbonds": d,
        "mean_chain": mean_chain,
        "unsat_index": unsat_index,
        "packing": packing,
    })
    for hg in HEADGROUPS:                              # one-hot headgroup
        feats[f"hg_{hg}"] = (df["headgroup"] == hg).astype(float)
    return feats


CCS_MASS_EXPONENT = 0.635  # fixed physical exponent (literature range ~0.6-0.7 for CCS~mass scaling);
# only the linear coefficients below are fit from real data — 4 free params on ~17-20
# real anchor points is a defensible small-data regime, estimating an exponent from that
# few points would not be.
DEFAULT_CCS_COEF = {"scale": 4.45, "hg_neutral": 14.0, "hg_anionic": -9.0, "dbond": -1.8}


def calibrate_ccs_baseline(real_df: pd.DataFrame) -> dict:
    """Fit the CCS physics-baseline's linear coefficients (mass-scale, headgroup offsets,
    unsaturation slope) to real measured anchor points via ordinary least squares, with the
    literature-typical mass exponent held fixed. Falls back to DEFAULT_CCS_COEF's hand-set
    constants when there isn't enough real data to fit (e.g. < 6 points, or a singular design
    matrix from too little headgroup diversity) — never silently returns garbage.
    """
    if len(real_df) < 6:
        return dict(DEFAULT_CCS_COEF)
    x1 = np.power(real_df["mass"].values, CCS_MASS_EXPONENT)
    hg_neut = (real_df["headgroup"] == "neutral").values.astype(float)
    hg_anion = (real_df["headgroup"] == "anionic").values.astype(float)
    d = real_df["dbonds"].values.astype(float)
    X = np.column_stack([x1, hg_neut, hg_anion, d])
    y = real_df["ccs_measured"].values.astype(float)
    try:
        coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    except np.linalg.LinAlgError:
        return dict(DEFAULT_CCS_COEF)
    if not np.all(np.isfinite(coef)):
        return dict(DEFAULT_CCS_COEF)
    return {"scale": float(coef[0]), "hg_neutral": float(coef[1]), "hg_anionic": float(coef[2]), "dbond": float(coef[3])}


def synthetic_targets(df: pd.DataFrame, feats: pd.DataFrame, seed: int = 42, ccs_coef: dict | None = None):
    """Physics-shaped CCS/RT targets for the full enumerated space.

    CCS: the functional FORM is a physics prior (sublinear mass scaling, headgroup shape
    offset, unsaturation compaction); the COEFFICIENTS are fit to real measured CCS anchor
    points when available (see calibrate_ccs_baseline), falling back to hand-set constants
    otherwise. Either way this is still a *baseline* being learned from, not ground truth —
    the GBM is trained to correct its residuals, and real held-out points are what actually
    validate the result (see train.py).

    RT: no public bulk RT dataset for lipids was obtainable in this environment (retention
    time is method/instrument-specific and not centrally curated the way CCS is — see
    ml/README.md). This stays a physics-shaped synthetic target, clearly labelled as such
    everywhere it's surfaced; swapping in a real, single-method RT library only requires
    replacing this half of the function.
    """
    coef = ccs_coef or DEFAULT_CCS_COEF
    rng = np.random.default_rng(seed)
    m = feats["mass"].values
    d = feats["dbonds"].values
    hg_anion = (df["headgroup"] == "anionic").values.astype(float)
    hg_neut = (df["headgroup"] == "neutral").values.astype(float)
    ccs = (
        coef["scale"] * np.power(m, CCS_MASS_EXPONENT)
        + coef["hg_neutral"] * hg_neut
        + coef["hg_anionic"] * hg_anion
        + coef["dbond"] * d
        + rng.normal(0, 3, len(m))
    )
    # RT: driven by hydrophobicity; saturates in double bonds (first ones matter most)
    rt = 1.5 + 0.30 * feats["carbons"].values - 3.2 * np.log1p(d) - 4.5 * hg_anion + rng.normal(0, 0.4, len(m))
    return np.round(ccs, 2), np.round(np.clip(rt, 0.2, None), 2)
