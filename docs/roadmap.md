# Roadmap

Phased plan of work. Each item below maps to a GitHub issue.

## Phase 1 — make the data real
- **#1 Ingest LIPID MAPS LMSD** and mark real curated species (replace the rule-based
  known/gap demo with a true diff against LMSD).
- **#2 Enumeration engine** — documented, rule-based headgroup × acyl generator;
  produce the gap set as `origin = in_silico`.
- **#3 Property engine v1** — RDKit for formula/mass/logP/TPSA; wire trained CCS & RT
  models (DeepCCS/AllCCS-style) replacing the heuristic placeholders.

## Phase 2 — the differentiators
- **#4 Synthesizability scoring** — biosynthetic (SwissLipids/Rhea pathway match) +
  chemical (SAScore/RAScore + retrosynthesis route).
- **#5 Origin & pathway graph** — real enzyme/reaction links from SwissLipids/Rhea.
- **#6 Extend coverage** — sphingolipids and sterols in the live composition model
  (backbone + N-acyl handling differs from glycerolipids).

## Phase 3 — product surface
- **#7 REST + SPARQL API and bulk export** with stable IDs and cross-refs.
- **#8 Provenance & confidence UI** — surface model version + uncertainty on every value.
- **#9 Accessibility & performance pass** on the Atlas UI; GitHub Pages deploy.

## Prototype follow-ups (small)
- **#10 Improve prototype fidelity** — persist a `data.json` the UI reads instead of
  hardcoded classes; add adduct choice per class; keyboard navigation of the grid.
