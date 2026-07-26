# Scope & design notes

What this project is, what it does today, and the design decisions behind it. No
roadmap-as-marketing here — see [`roadmap.md`](roadmap.md) for the phased task list and the
GitHub issues for current work.

## What it is

An interactive atlas over the lipidome that puts three things in one place:

- the **known** lipids from reference databases (LIPID MAPS LMSD),
- the **enumerated but uncatalogued** ones (the gaps), and
- **properties inferred from composition**, each tagged with how it was produced.

It builds on the open reference data (LIPID MAPS is CC BY 4.0) rather than re-curating it. The
useful additions are the reconciliation, the enumerated gap map, and an explicit
measured/calculated/predicted label on every value.

## Architecture

```
Frontend (static SPA)  ── computes client-side, works standalone
   │  REST + MCP
Backend (Hono/Node)    ── SQLite store (Postgres is the later target)
   ▲
ML pipeline (offline)  ── trains models, precomputes predictions into the store
```

Design decision: **ML is an offline pipeline that writes predictions into the store**, not a
model server in the request path. The enumerated space is bounded, so precomputing beats
predicting per request. Online inference is only needed for novel, user-submitted structures.

## Property models

- Formula, exact mass and adduct m/z are computed exactly from composition.
- CCS and RT are trained models (GBM) with calibrated uncertainty intervals.
- logP and SAScore are RDKit calculations.
- Values with no reliable source are reported as **not available** rather than a heuristic
  placeholder — mass/formula are exact, CCS/RT/logP/SAScore are shown only where a real value
  exists, and Tm is not reported at all until a measured or trained source exists.

## Design principles

1. **Reliable numbers only.** A displayed number is exact, a trained-model prediction, or an
   RDKit calculation — each with its source shown. Otherwise it reads "not available".
2. **Predicted ≠ measured, always visible.** Every value is tagged measured / calculated /
   predicted with its model version and, for predictions, an uncertainty interval.
3. **Transparent enumeration.** The rules that define the enumerated space are documented and
   diffable against the curated set.

## Current status

An interactive prototype. See [`../README.md`](../README.md) for the real-vs-target breakdown of
each component and the Methods tab in the app for the same table generated from the live build.
