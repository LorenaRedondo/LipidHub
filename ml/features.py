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


def synthetic_targets(df: pd.DataFrame, feats: pd.DataFrame, seed: int = 42):
    """Physics-shaped synthetic CCS/RT for the demo (no measured data yet).

    Deliberately NON-linear (headgroup offsets, saturating unsaturation effect) so a
    linear fit can't nail it and the GBM demonstrably helps. Swap this out for a real
    training set (AllCCS/METLIN-CCS, RT libraries) and the rest of the pipeline is unchanged.
    """
    rng = np.random.default_rng(seed)
    m = feats["mass"].values
    d = feats["dbonds"].values
    hg_anion = (df["headgroup"] == "anionic").values.astype(float)
    hg_neut = (df["headgroup"] == "neutral").values.astype(float)
    # CCS: grows sublinearly with mass (mass^0.635), headgroup shape offset, unsaturation compacts
    ccs = 4.45 * np.power(m, 0.635) + 14 * hg_neut - 9 * hg_anion - 1.8 * d + rng.normal(0, 3, len(m))
    # RT: driven by hydrophobicity; saturates in double bonds (first ones matter most)
    rt = 1.5 + 0.30 * feats["carbons"].values - 3.2 * np.log1p(d) - 4.5 * hg_anion + rng.normal(0, 0.4, len(m))
    return np.round(ccs, 2), np.round(np.clip(rt, 0.2, None), 2)
