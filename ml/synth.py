"""Real chemical accessibility (SAScore) for every enumerated species.

Computes the Ertl & Schuffenhauer synthetic accessibility score directly from
each species' SMILES via RDKit — a real structural computation (method:
'calculated'), not a trained-model guess, and a real replacement for the
fabricated linear heuristic previously used for `saScore`.

Run: python ml/synth.py   (after `npm run export:dataset` has written the
`smiles` column into ml/dataset.csv)
"""
import json
import os

import pandas as pd
import rdkit
from rdkit import Chem, RDLogger

import sascorer

RDLogger.DisableLog("rdApp.*")  # silence RDKit's SMILES-parse warnings for the rare template gap

HERE = os.path.dirname(__file__)
ROOT = os.path.dirname(HERE)
MODEL_VERSION = f"rdkit-{rdkit.__version__}-sascorer"


def main():
    df = pd.read_csv(os.path.join(HERE, "dataset.csv"), keep_default_na=False)
    scores = {}
    failed = 0
    for sid, smiles in zip(df["id"], df["smiles"]):
        if not smiles:
            failed += 1
            continue
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            failed += 1
            continue
        scores[sid] = round(float(sascorer.calculateScore(mol)), 2)

    out = {"model_version": MODEL_VERSION, "method": "calculated", "scores": scores}
    dest = os.path.join(ROOT, "src", "data", "synth.json")
    with open(dest, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    print(f"wrote src/data/synth.json ({len(scores)} species scored, {failed} skipped — no/invalid SMILES)")
    print(f"model_version: {MODEL_VERSION}")


if __name__ == "__main__":
    main()
