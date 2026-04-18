-- ============================================================
-- NX TERMINAL: pending_fund_txs backoff column
-- Run manually on Render DB:
--   psql $DATABASE_URL -f backend/db/migration_pending_funds_backoff.sql
--
-- Safe to run multiple times (IF NOT EXISTS everywhere). Also
-- auto-applied on API startup by _run_auto_migrations and on
-- engine startup by its auto-migrate block.
--
-- New column: next_retry_at TIMESTAMPTZ NULL.
--   NULL          → eligible immediately (legacy / just-inserted rows)
--   > NOW()       → skipped by the worker (still in backoff)
--   <= NOW()      → eligible for retry
-- ============================================================

SET search_path TO nx;

ALTER TABLE pending_fund_txs
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pending_funds_next_retry
    ON pending_fund_txs(next_retry_at)
    WHERE resolved = false;
