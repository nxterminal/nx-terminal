-- ============================================================
-- NX TERMINAL: admin_logs append-only audit trail
-- Run manually on Render DB:
--   psql $DATABASE_URL -f backend/db/migration_admin_logs.sql
--
-- Safe to run multiple times (IF NOT EXISTS guards on table and
-- indexes). Also auto-applied on API startup by _run_auto_migrations
-- in backend/api/main.py.
-- ============================================================

SET search_path TO nx;

CREATE TABLE IF NOT EXISTS admin_logs (
    id               BIGSERIAL PRIMARY KEY,
    correlation_id   UUID,
    event_type       TEXT NOT NULL,
    wallet_address   VARCHAR(42),
    dev_token_id     BIGINT,
    payload          JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_wallet_time
    ON admin_logs(wallet_address, created_at DESC)
    WHERE wallet_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_logs_correlation
    ON admin_logs(correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_logs_event_time
    ON admin_logs(event_type, created_at DESC);

-- Retention note: ~500 events/day → ~15k rows/month → ~180k rows/year.
-- No partitioning yet; revisit if volume grows with NX_FUTURES.
