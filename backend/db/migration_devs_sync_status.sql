-- ============================================================
-- NX TERMINAL: 2-phase commit sync status on devs
-- Run manually on Render DB:
--   psql $DATABASE_URL -f backend/db/migration_devs_sync_status.sql
--
-- Safe to run multiple times (IF NOT EXISTS on all DDL). Also
-- auto-applied on API startup by _run_auto_migrations in
-- backend/api/main.py.
-- ============================================================

SET search_path TO nx;

ALTER TABLE devs
    ADD COLUMN IF NOT EXISTS sync_status     TEXT,
    ADD COLUMN IF NOT EXISTS sync_tx_hash    VARCHAR(66),
    ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ;

-- Partial index so the reconciler's "find stuck syncing rows" query
-- is cheap without adding a dead index for the 99.9% null case.
CREATE INDEX IF NOT EXISTS idx_devs_sync_status
    ON devs(sync_status, sync_started_at)
    WHERE sync_status IS NOT NULL;

-- Semantic legend (documented, not enforced by constraint):
--   NULL      — dev is eligible for sync
--   'syncing' — tx broadcast, awaiting confirmation
--   'synced'  — tx confirmed, balance_nxt zeroed
--   'failed'  — tx reverted or timed out, balance preserved for retry
