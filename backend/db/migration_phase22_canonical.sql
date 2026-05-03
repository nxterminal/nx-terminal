-- ============================================================
-- NX TERMINAL — Phase 2.2 canonical-traits migration
-- ============================================================
-- Idempotent. Safe to run on every startup. Mirrored verbatim into
-- backend/api/main.py:_run_auto_migrations() so it executes
-- automatically when the API service deploys. This file is the
-- canonical reference; main.py is the runner.
--
-- Steps:
--   A — Drop the legacy `devs_burned` column (death mechanic dropped).
--   B — Add 'exhausted' to dev_status_enum if missing.
--   C — Create dev_canonical_traits table with indexes.
--
-- Step D (CHECK constraints on nx.devs) is INTENTIONALLY OMITTED here:
-- production currently has rows using values that the canonical sets
-- forbid (Mentor, Troll, Copy Paste, Grinder, Steady, Balanced). Those
-- are cleared by the Step 5 alignment script; the constraints are then
-- applied by Step 5b in the same script. Putting them here would make
-- the migration fail.
-- ============================================================

-- Step A: drop devs_burned (NX-PHASE-2.2)
ALTER TABLE nx.devs DROP COLUMN IF EXISTS devs_burned;

-- Step B: add 'exhausted' to dev_status_enum (NX-PHASE-2.2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'exhausted'
      AND enumtypid = (
        SELECT oid FROM pg_type
        WHERE typname = 'dev_status_enum'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'nx')
      )
  ) THEN
    ALTER TYPE nx.dev_status_enum ADD VALUE 'exhausted';
  END IF;
END$$;

-- Step C: create dev_canonical_traits (NX-PHASE-2.2)
CREATE TABLE IF NOT EXISTS nx.dev_canonical_traits (
  token_id INTEGER PRIMARY KEY,

  -- Identity, stored in BUNDLE casing (Title Case / proper).
  -- The /metadata/{id} endpoint and any portal can read these directly.
  -- Internal-format columns on nx.devs are kept aligned via the
  -- alignment script + listener; translation between the two formats
  -- is done in backend/services/canonical/translation.py.
  species          VARCHAR(20) NOT NULL,
  archetype        VARCHAR(30) NOT NULL,   -- e.g. "Degen"
  corporation      VARCHAR(30) NOT NULL,   -- e.g. "Closed AI"
  rarity           VARCHAR(20) NOT NULL,   -- e.g. "Common"
  alignment        VARCHAR(20) NOT NULL,
  risk_level       VARCHAR(20) NOT NULL,
  social_style     VARCHAR(20) NOT NULL,
  coding_style     VARCHAR(30) NOT NULL,
  work_ethic       VARCHAR(20) NOT NULL,
  skill_module     VARCHAR(20) NOT NULL,

  -- Visual subtraits (from bundle).
  clothing         VARCHAR(40),
  clothing_pattern VARCHAR(40),
  eyewear          VARCHAR(30),
  neckwear         VARCHAR(30),
  spots            VARCHAR(20),
  blush            BOOLEAN,
  ear_detail       BOOLEAN,

  -- NX Souls (deterministic from personality_seed).
  voice_tone       VARCHAR(20) NOT NULL,
  quirk            VARCHAR(50) NOT NULL,
  lore_faction     VARCHAR(20) NOT NULL,

  -- Baseline stats: for minted Devs, these are snapshotted from
  -- nx.devs.stat_* at ingest time (Option B3 — keep listener-generated
  -- stats as truth). For unminted Devs, the bundle's Coding/Hacking/etc.
  -- values are used until the listener mints and overwrites.
  stat_coding      SMALLINT NOT NULL,
  stat_hacking     SMALLINT NOT NULL,
  stat_trading     SMALLINT NOT NULL,
  stat_social      SMALLINT NOT NULL,
  stat_endurance   SMALLINT NOT NULL,
  stat_luck        SMALLINT NOT NULL,

  -- Provenance.
  bundle_source    VARCHAR(120) NOT NULL DEFAULT 'github:nxterminal/nx-metadata-bundle@main',
  ingested_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canonical_corp         ON nx.dev_canonical_traits(corporation);
CREATE INDEX IF NOT EXISTS idx_canonical_archetype    ON nx.dev_canonical_traits(archetype);
CREATE INDEX IF NOT EXISTS idx_canonical_rarity       ON nx.dev_canonical_traits(rarity);
CREATE INDEX IF NOT EXISTS idx_canonical_voice_tone   ON nx.dev_canonical_traits(voice_tone);
CREATE INDEX IF NOT EXISTS idx_canonical_lore_faction ON nx.dev_canonical_traits(lore_faction);
