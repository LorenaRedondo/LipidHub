-- ── LIPIVERSE reconciled data model ───────────────────────────────────────
-- Portable PostgreSQL DDL. Apply to Postgres (RDKit cartridge recommended for
-- structure search) or Supabase. Provenance is a first-class citizen: every
-- property value knows how it was produced, by which model version, with what
-- uncertainty, and from which source.
--
-- Extensions (optional but recommended):
--   CREATE EXTENSION IF NOT EXISTS rdkit;     -- substructure / similarity search
--   CREATE EXTENSION IF NOT EXISTS vector;    -- lipid embeddings (similarity)
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy name search

-- ── class ontology (LIPID MAPS hierarchy) ──────────────────────────────────
CREATE TABLE lipid_class (
  code         text PRIMARY KEY,               -- 'GP0101' (LIPID MAPS sub-class code)
  abbrev       text NOT NULL,                  -- 'PC'
  name         text NOT NULL,                  -- 'Diacylglycerophosphocholines'
  core         text NOT NULL,                  -- 'Glycerophospholipids [GP]'
  main_class   text,                           -- 'Glycerophosphocholines [GP01]'
  display_group text NOT NULL,                 -- our UI grouping
  n_chains     smallint NOT NULL
);

-- ── species: one row per canonical lipid; identity by structure, not name ───
CREATE TABLE species (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shorthand    text NOT NULL,                  -- 'PC 34:1'
  class_code   text NOT NULL REFERENCES lipid_class(code),
  n_carbon     int  NOT NULL,
  n_dbond      int  NOT NULL,
  formula      text NOT NULL,
  exact_mass   numeric(12,6) NOT NULL,
  smiles       text,                           -- representative structure
  inchikey     text,
  origin       text NOT NULL CHECK (origin IN ('curated','in_silico')),  -- ← is it a gap?
  lm_id        text,                           -- LIPID MAPS id when curated
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_code, n_carbon, n_dbond)
);
CREATE INDEX species_mass_idx      ON species (exact_mass);
CREATE INDEX species_shorthand_idx ON species USING gin (shorthand gin_trgm_ops);
CREATE INDEX species_inchikey_idx  ON species (inchikey);
-- CREATE INDEX species_struct_idx  ON species USING gist (rdkit_mol(smiles));  -- with rdkit ext

-- ── property: every value carries its provenance ────────────────────────────
CREATE TABLE property (
  id            bigserial PRIMARY KEY,
  species_id    uuid NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  key           text NOT NULL,                 -- 'ccs_mh','rt_rp','tm','logp','tpsa'…
  value         numeric NOT NULL,
  unit          text,                          -- 'Å^2','min','°C',…
  method        text NOT NULL CHECK (method IN ('measured','calculated','predicted')),
  model_version text,                          -- 'DeepCCS v2.1' — reproducible
  ci_low        numeric,                       -- calibrated uncertainty interval
  ci_high       numeric,
  source        text,                          -- DOI / DB accession
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_species_key_idx ON property (species_id, key);
-- measured wins over predicted at read time; keep both for provenance.

-- ── biology: enzyme / reaction / pathway links ──────────────────────────────
CREATE TABLE pathway (
  id             bigserial PRIMARY KEY,
  species_id     uuid NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  enzyme_uniprot text,
  rhea_rxn       text,
  direction      text,
  source         text
);

-- ── synthesizability (the novel column) ─────────────────────────────────────
-- bio and chem carry separate provenance: they come from independent pipelines
-- (live UniProt/Rhea pathway verification vs. RDKit SAScore) that can succeed
-- or fall back to a heuristic independently — one shared model_version
-- couldn't express that (see #4).
CREATE TABLE synth (
  species_id         uuid PRIMARY KEY REFERENCES species(id) ON DELETE CASCADE,
  bio_score          numeric,                  -- 0–100: pathway attainability
  bio_method         text CHECK (bio_method IN ('measured','calculated','predicted')),
  bio_model_version  text,                     -- 'pathway-verified-v1' or 'heuristic-v0'
  chem_sascore       numeric,                  -- 1(easy)–10(hard)
  chem_method        text CHECK (chem_method IN ('measured','calculated','predicted')),
  chem_model_version text,                     -- 'rdkit-<ver>-sascorer' or 'heuristic-v0'
  route_json         jsonb                     -- retrosynthesis route; not yet populated (#4)
);

-- ── cross-references & literature ───────────────────────────────────────────
CREATE TABLE xref (
  species_id uuid NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  db         text NOT NULL,                    -- 'LMSD','SwissLipids','HMDB','ChEBI','PubChem'
  accession  text NOT NULL,
  PRIMARY KEY (species_id, db, accession)
);

CREATE TABLE citation (
  id         bigserial PRIMARY KEY,
  species_id uuid REFERENCES species(id) ON DELETE CASCADE,  -- null = class/general
  class_code text REFERENCES lipid_class(code),
  doi        text,
  pmid       text,
  title      text,
  year       int,
  curated    boolean NOT NULL DEFAULT false    -- false = auto (Europe PMC), true = human-verified
);

-- ── community contributions (v2+) ───────────────────────────────────────────
CREATE TABLE contribution (
  id         bigserial PRIMARY KEY,
  species_id uuid REFERENCES species(id),
  kind       text NOT NULL,                    -- 'measured_value','correction','citation'
  payload    jsonb NOT NULL,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  submitted_by text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- ── convenience view: best value per (species,key) — measured > calc > pred ──
CREATE VIEW property_best AS
SELECT DISTINCT ON (species_id, key)
  species_id, key, value, unit, method, model_version, ci_low, ci_high, source
FROM property
ORDER BY species_id, key,
  CASE method WHEN 'measured' THEN 0 WHEN 'calculated' THEN 1 ELSE 2 END;
