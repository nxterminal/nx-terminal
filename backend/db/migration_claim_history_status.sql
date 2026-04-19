-- ============================================================
-- NX TERMINAL: claim_history tx_block + status + unique tx_hash
-- Run manually on Render DB:
--   psql $DATABASE_URL -f backend/db/migration_claim_history_status.sql
--
-- Safe to run multiple times (IF NOT EXISTS on all DDL). Also
-- auto-applied on API startup by _run_auto_migrations in
-- backend/api/main.py.
-- ============================================================

SET search_path TO nx;

ALTER TABLE claim_history
    ADD COLUMN IF NOT EXISTS tx_block BIGINT;

ALTER TABLE claim_history
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';

-- Existing rows pre-date the on-chain verification gate; mark them
-- confirmed so new reporting surfaces don't show NULL.
UPDATE claim_history SET status = 'confirmed' WHERE status IS NULL;

-- Idempotency: a given tx_hash can only be recorded once.
-- Partial index so historical rows with NULL tx_hash don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_history_tx_hash_unique
    ON claim_history(tx_hash)
    WHERE tx_hash IS NOT NULL AND tx_hash <> '';
