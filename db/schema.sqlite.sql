-- ── LipidHub reconciled data model — SQLite dialect ────────────────────────
-- Mirrors db/schema.sql (the Postgres/Supabase target). This is the dev/local
-- store that backs the REST API + MCP server (server/db.ts); the browser
-- bundle never touches it — it keeps computing client-side from src/lib.
-- Regenerate with `npm run db:build`; this file is not hand-edited data.
--
-- Dialect differences from db/schema.sql (kept for the eventual Postgres port):
--   • species.id is the existing deterministic string id ('PC-34-1') as the
--     TEXT primary key — no gen_random_uuid()/surrogate key needed.
--   • no gin/gist/rdkit/pgvector indexes — plain indexes only; text search
--     stays substring/LIKE (current scale doesn't need FTS5).
--   • jsonb → TEXT (JSON-encoded); timestamptz → TEXT (ISO string).
--   • property_best: SQLite has no DISTINCT ON — rewritten with ROW_NUMBER().

PRAGMA foreign_keys = ON;

-- ── class ontology (LIPID MAPS hierarchy) ──────────────────────────────────
CREATE TABLE lipid_class (
  code          TEXT PRIMARY KEY,              -- our class key, e.g. 'PC'
  abbrev        TEXT NOT NULL,
  name          TEXT NOT NULL,
  core          TEXT NOT NULL,                 -- LIPID MAPS category, e.g. 'GP · Glycerophospholipids'
  main_class    TEXT,
  display_group TEXT NOT NULL,                 -- our UI grouping, e.g. 'Glycerophospholipids'
  n_chains      INTEGER NOT NULL
);

-- ── species: one row per canonical lipid; identity by composition ─────────
CREATE TABLE species (
  id           TEXT PRIMARY KEY,               -- 'PC-34-1' (class-carbons-doublebonds)
  shorthand    TEXT NOT NULL,                  -- 'PC 34:1'
  class_code   TEXT NOT NULL REFERENCES lipid_class(code),
  n_carbon     INTEGER NOT NULL,
  n_dbond      INTEGER NOT NULL,
  formula      TEXT NOT NULL,
  exact_mass   REAL NOT NULL,
  smiles       TEXT,                           -- representative structure (real when curated, else generated)
  inchikey     TEXT,
  origin       TEXT NOT NULL CHECK (origin IN ('curated','in_silico')),  -- ← is it a gap?
  status       TEXT NOT NULL CHECK (status IN ('known','gap','rare')),   -- app-specific rarity tier (not in the Postgres canonical schema); 'rare' still counts as origin='in_silico' but is hidden from search by default
  lm_id        TEXT,                           -- LIPID MAPS id when curated
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (class_code, n_carbon, n_dbond)
);
CREATE INDEX species_mass_idx       ON species (exact_mass);
CREATE INDEX species_class_idx      ON species (class_code);
CREATE INDEX species_origin_idx     ON species (origin);
CREATE INDEX species_status_idx     ON species (status);
CREATE INDEX species_shorthand_idx  ON species (shorthand);
CREATE INDEX species_inchikey_idx   ON species (inchikey);

-- ── property: every value carries its provenance ────────────────────────────
CREATE TABLE property (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  species_id    TEXT NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,                 -- 'ccs','rt','tm','logp'…
  value         REAL NOT NULL,
  unit          TEXT,                          -- 'Å^2','min','°C',…
  method        TEXT NOT NULL CHECK (method IN ('measured','calculated','predicted')),
  model_version TEXT,                          -- 'demo-gbm-0.1' / 'heuristic-v0' — reproducible
  ci_low        REAL,                          -- calibrated uncertainty interval
  ci_high       REAL,
  source        TEXT,                          -- DOI / DB accession
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX property_species_key_idx ON property (species_id, key);
-- measured wins over predicted at read time; keep both for provenance.

-- ── biology: enzyme / reaction / pathway links (populated by the live UniProt/Rhea discovery) ──────────
CREATE TABLE pathway (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  species_id     TEXT NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  enzyme_uniprot TEXT,
  rhea_rxn       TEXT,
  direction      TEXT,
  source         TEXT
);

-- ── synthesizability (the novel column) ─────────────────────────────────────
-- bio and chem carry separate provenance: they come from independent pipelines
-- (live UniProt/Rhea pathway verification vs. RDKit SAScore) that can succeed
-- or fall back to the heuristic independently — one shared model_version
-- couldn't express that.
CREATE TABLE synth (
  species_id         TEXT PRIMARY KEY REFERENCES species(id) ON DELETE CASCADE,
  bio_score          REAL,                     -- 0–100: pathway attainability
  bio_method         TEXT CHECK (bio_method IN ('measured','calculated','predicted')),
  bio_model_version  TEXT,                     -- 'pathway-verified-v1' or 'heuristic-v0'
  chem_sascore       REAL,                     -- 1(easy)–10(hard)
  chem_method        TEXT CHECK (chem_method IN ('measured','calculated','predicted')),
  chem_model_version TEXT,                     -- 'rdkit-<ver>-sascorer' or 'heuristic-v0'
  route_json         TEXT                      -- retrosynthesis route (JSON-encoded); not yet populated
);

-- ── cross-references & literature ───────────────────────────────────────────
CREATE TABLE xref (
  species_id TEXT NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  db         TEXT NOT NULL,                    -- 'LMSD','SwissLipids','HMDB','ChEBI','PubChem'
  accession  TEXT NOT NULL,
  PRIMARY KEY (species_id, db, accession)
);

-- populated by #6
CREATE TABLE citation (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  species_id TEXT REFERENCES species(id) ON DELETE CASCADE,  -- null = class/general
  class_code TEXT REFERENCES lipid_class(code),
  doi        TEXT,
  pmid       TEXT,
  title      TEXT,
  year       INTEGER,
  curated    INTEGER NOT NULL DEFAULT 0        -- 0 = auto (Europe PMC), 1 = human-verified
);

-- ── community contributions (v2+) ───────────────────────────────────────────
CREATE TABLE contribution (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  species_id   TEXT REFERENCES species(id),
  kind         TEXT NOT NULL,                  -- 'measured_value','correction','citation'
  payload      TEXT NOT NULL,                  -- JSON-encoded
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  submitted_by TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── convenience view: best value per (species,key) — measured > calc > pred ──
CREATE VIEW property_best AS
SELECT species_id, key, value, unit, method, model_version, ci_low, ci_high, source
FROM (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY species_id, key
      ORDER BY CASE method WHEN 'measured' THEN 0 WHEN 'calculated' THEN 1 ELSE 2 END
    ) AS rn
  FROM property
)
WHERE rn = 1;
