-- ============================================================
-- NX TERMINAL: Bug Fix Migration
-- Run manually: psql $DATABASE_URL -f backend/db/migration_bugfix.sql
-- ============================================================

SET search_path TO nx;

ALTER TABLE devs ADD COLUMN IF NOT EXISTS bugs_fixed INTEGER NOT NULL DEFAULT 0;
