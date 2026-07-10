"""Real logP for every enumerated species with a valid SMILES.

Computes logP via RDKit's Crippen atom-contribution method directly from each
species' SMILES — a real structural computation (method: 'calculated'), not
the fabricated linear heuristic (`0.52*c - 0.6*d - headgroup_offset`) still
used as the fallback where no SMILES is available. Same shape as synth.py's
SAScore integration.

Run: python ml/logp.py   (after `npm run export:dataset` has written the
`smiles` column into ml/dataset.csv)
"""
import json
import os

import pandas as pd
import rdkit
from rdkit import Chem, RDLogger
from rdkit.Chem import Crippen

RDLogger.DisableLog("rdApp.*")  # silence RDKit's SMILES-parse warnings for the rare template gap

HERE = os.path.dirname(__file__)
ROOT = os.path.dirname(HERE)
MODEL_VERSION = f"rdkit-{rdkit.__version__}-crippen"


def main():
    df = pd.read_csv(os.path.join(HERE, "dataset.csv"), keep_default_na=False)
    values = {}
    failed = 0
    for sid, smiles in zip(df["id"], df["smiles"]):
        if not smiles:
            failed += 1
            continue
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            failed += 1
            continue
        values[sid] = round(float(Crippen.MolLogP(mol)), 2)

    out = {"model_version": MODEL_VERSION, "method": "calculated", "values": values}
    dest = os.path.join(ROOT, "src", "data", "logp.json")
    with open(dest, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    print(f"wrote src/data/logp.json ({len(values)} species scored, {failed} skipped — no/invalid SMILES)")
    print(f"model_version: {MODEL_VERSION}")


if __name__ == "__main__":
    main()
