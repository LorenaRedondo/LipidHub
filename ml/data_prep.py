"""Cleaning pipeline: raw experimental CCS data -> a clean, QA'd training/validation table.

Source: the PNNL/Baker-lab "Unified CCS Compendium" (drift-tube MS, traceable standards,
CC-licensed, GitHub-hosted). It's a *general metabolomics* standards library, not
lipid-specific, so most of the cleaning work here is: find the lipid-relevant rows, parse
their names into our own class/carbons/dbonds shorthand, reshape the wide per-adduct CCS
columns into tidy rows, and cross-check the declared formula against what our own
composition model computes for the same species (a real correctness check, not busywork).

Run: python ml/data_prep.py
  in:  ml/data/raw/pnnl_ccs_compendium.tsv
  out: ml/data/processed/real_lipid_ccs.csv
"""
import os
import re

import pandas as pd

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "data", "raw", "pnnl_ccs_compendium.tsv")
OUT_DIR = os.path.join(HERE, "data", "processed")
OUT = os.path.join(OUT_DIR, "real_lipid_ccs.csv")

# subclasses in the compendium worth searching for lipid species we can map onto our
# own class/composition shorthand (Bile Acids and most Lipid Mediators are excluded —
# their names don't reduce to a "class + carbons:double-bonds" shorthand our model uses).
LIPID_SUBCLASSES = {"Lipids", "Fatty Acids", "Steroids"}

# element masses reused here (independent of the TS model, for a genuine cross-check —
# not importing src/lib/lipids.ts's constants would defeat the point of an independent QA)
MASS = {"C": 12.0, "H": 1.0078250319, "O": 15.9949146221, "N": 14.0030740052, "P": 30.97376151, "S": 31.9720707}

# mirrors the diacyl backbone constants in src/lib/lipids.ts CLASSES (bb + n) — an
# independent re-derivation, not an import, so this is a genuine second opinion on the
# formula rather than checking our own model against itself.
BACKBONES = {
    "PC": ({"C": 8, "H": 20, "O": 6, "N": 1, "P": 1}, 2),
    "PE": ({"C": 5, "H": 14, "O": 6, "N": 1, "P": 1}, 2),
    "PS": ({"C": 6, "H": 14, "O": 8, "N": 1, "P": 1}, 2),
    "PG": ({"C": 6, "H": 15, "O": 8, "N": 0, "P": 1}, 2),
    "PI": ({"C": 9, "H": 19, "O": 11, "N": 0, "P": 1}, 2),
    "PA": ({"C": 3, "H": 9, "O": 6, "N": 0, "P": 1}, 2),
    "LPC": ({"C": 8, "H": 20, "O": 6, "N": 1, "P": 1}, 1),
    "LPE": ({"C": 5, "H": 14, "O": 6, "N": 1, "P": 1}, 1),
    "DG": ({"C": 3, "H": 8, "O": 3, "N": 0, "P": 0}, 2),
    "TG": ({"C": 3, "H": 8, "O": 3, "N": 0, "P": 0}, 3),
}


def our_formula(cls: str, c: int, d: int) -> dict | None:
    """Independent re-derivation of the diacyl formula for a supported class, or None."""
    if cls == "FA":
        return {"C": c, "H": 2 * c - 2 * d, "O": 2}
    bb = BACKBONES.get(cls)
    if not bb:
        return None
    b, n = bb
    return {"C": b["C"] + c, "H": b["H"] + 2 * c - 2 * d - 2 * n, "O": b["O"] + n, "N": b.get("N", 0), "P": b.get("P", 0)}

# tolerates an inline stereo descriptor per chain, e.g. "PC(18:1(9Z)/16:0)"
_STEREO = r"(?:\([^)]*\))?"
CHAIN_RE = re.compile(
    rf"^([A-Za-z]{{2,3}})\s*\(?(\d+):(\d+){_STEREO}(?:[/_](\d+):(\d+){_STEREO})?(?:[/_](\d+):(\d+){_STEREO})?\)?",
    re.IGNORECASE,
)

ADDUCTS = [
    ("mPlusH", "mPlusHCCS", "mPlusHRsd", "[M+H]+"),
    ("mMinusH", "mMinusHCCS", "mMinusHRsd", "[M-H]-"),
    ("mPlusNa", "mPlusNaCCS", "mPlusNaRsd", "[M+Na]+"),
    ("mPlusDot", "mPlusDotCCS", "mPlusDotRsd", "[M]+*"),
]


ETHER_RE = re.compile(r"\d:\d+[eEpP]\b|\bO-\d")  # e.g. "16:0e", "P-18:0" — alkyl/alkenyl ether, not diacyl


def parse_shorthand(name: str):
    """'LPC 18:1' or 'PC (16:1/16:1)' -> (class, total_carbons, total_dbonds) or None.

    Explicitly rejects ether-linked species ("16:0e", "P-18:0" plasmalogens): they have a
    genuinely different formula (one less oxygen per ether bond, C-O-C vs C(=O)-O) than our
    diacyl-only composition model computes, so silently matching them as ordinary diacyl
    species would poison the training data with a real chemistry error, not a rounding one.
    """
    if not isinstance(name, str):
        return None
    if ETHER_RE.search(name):
        return None
    m = CHAIN_RE.match(name.strip())
    if not m:
        return None
    cls = m.group(1).upper()
    groups = m.groups()[1:]
    chains = [(int(groups[i]), int(groups[i + 1])) for i in range(0, len(groups), 2) if groups[i] is not None]
    if not chains:
        return None
    return cls, sum(c for c, _ in chains), sum(d for c, d in chains)


def parse_formula(f: str) -> dict:
    out = {}
    for el, count in re.findall(r"([A-Z][a-z]?)(\d*)", f or ""):
        if not el:
            continue
        out[el] = out.get(el, 0) + (int(count) if count else 1)
    return out


def formula_mass(f: dict) -> float:
    return sum(MASS.get(el, 0.0) * n for el, n in f.items())


def main():
    df = pd.read_csv(RAW, sep="\t", encoding="utf-8-sig")
    n_raw = len(df)

    # 1. keep only lipid-relevant subclasses
    df = df[df["subclass"].isin(LIPID_SUBCLASSES)].copy()
    n_subclass = len(df)

    # 2. parse names into our shorthand; drop anything we can't map
    parsed = df["Neutral Name"].apply(parse_shorthand)
    df["parsed_class"] = parsed.apply(lambda p: p[0] if p else None)
    df["parsed_carbons"] = parsed.apply(lambda p: p[1] if p else None)
    df["parsed_dbonds"] = parsed.apply(lambda p: p[2] if p else None)
    df = df.dropna(subset=["parsed_class"]).copy()
    n_parsed = len(df)

    # 3a. QA: cross-check the compendium's OWN declared formula's mass against the mass
    #     implied by its declared formula string (internal consistency of the raw file) —
    #     catches transcription errors before they become "real" training labels.
    df["formula_dict"] = df["formula"].apply(parse_formula)
    df["formula_mass_check"] = df["formula_dict"].apply(formula_mass)
    df["mass_col"] = pd.to_numeric(df["mass"], errors="coerce")
    df["mass_delta"] = (df["formula_mass_check"] - df["mass_col"]).abs()
    bad_mass = df[df["mass_delta"] > 0.05]
    df = df[df["mass_delta"] <= 0.05].copy()
    n_qa_internal = len(df)

    # 3b. QA: cross-check against an INDEPENDENT re-derivation of the diacyl formula for
    #     the parsed (class, carbons, dbonds) — catches derivatized/methylated reference
    #     standards (e.g. "PG (16:0/16:0) 4Me") that parse to a valid shorthand but are NOT
    #     chemically equivalent to the plain diacyl species our model computes for it.
    def matches_our_model(row):
        expected = our_formula(row["parsed_class"], int(row["parsed_carbons"]), int(row["parsed_dbonds"]))
        if expected is None:
            return True  # class not in our diacyl model (e.g. BMP, LPS) — no check to run, kept
        our_mass = formula_mass(expected)
        return abs(our_mass - row["mass_col"]) <= 0.05

    keep_mask = df.apply(matches_our_model, axis=1)
    bad_model = df[~keep_mask]
    df = df[keep_mask].copy()
    n_qa = len(df)

    # 4. reshape wide (one column per adduct) into tidy long rows, dropping "N/A"/missing CCS
    rows = []
    for _, r in df.iterrows():
        for val_col, ccs_col, rsd_col, adduct_label in ADDUCTS:
            ccs = pd.to_numeric(r.get(ccs_col), errors="coerce")
            if pd.isna(ccs):
                continue
            rsd = pd.to_numeric(r.get(rsd_col), errors="coerce")
            rows.append({
                "id": f"{r['parsed_class']}-{int(r['parsed_carbons'])}-{int(r['parsed_dbonds'])}",
                "class": r["parsed_class"],
                "carbons": int(r["parsed_carbons"]),
                "dbonds": int(r["parsed_dbonds"]),
                "name": r["Neutral Name"],
                "adduct": adduct_label,
                "ccs_measured": round(float(ccs), 2),
                "rsd": round(float(rsd), 4) if pd.notna(rsd) else None,
                "formula": r["formula"],
                "source": "PNNL Unified CCS Compendium",
            })
    tidy = pd.DataFrame(rows)

    # 5. dedupe: same (id, adduct) measured more than once -> keep the lowest-RSD (most
    #    precise) measurement rather than averaging blindly across possibly-different runs
    tidy = tidy.sort_values("rsd", na_position="last").drop_duplicates(subset=["id", "adduct"], keep="first")
    tidy = tidy.sort_values(["class", "carbons", "dbonds", "adduct"]).reset_index(drop=True)

    os.makedirs(OUT_DIR, exist_ok=True)
    tidy.to_csv(OUT, index=False)

    print(f"raw rows:                     {n_raw}")
    print(f"lipid-relevant subclass:      {n_subclass}")
    print(f"parsed to our shorthand:      {n_parsed}")
    print(f"passed internal formula QA:   {n_qa_internal}  (dropped {n_parsed - n_qa_internal})")
    if len(bad_mass):
        print("  dropped (internal mismatch):", ", ".join(bad_mass["Neutral Name"].tolist()))
    print(f"passed independent model QA:  {n_qa}  (dropped {n_qa_internal - n_qa})")
    if len(bad_model):
        print("  dropped (not our diacyl model — derivatized/ether standard):", ", ".join(bad_model["Neutral Name"].tolist()))
    print(f"tidy (id, adduct) rows:       {len(tidy)}")
    print(f"distinct species:         {tidy['id'].nunique()}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
