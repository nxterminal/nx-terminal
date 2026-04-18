-- ============================================================
-- NX TERMINAL: nxt_ledger append-only economic ledger (Fase 3A)
-- Run manually on Render DB:
--   psql $DATABASE_URL -f backend/db/migration_nxt_ledger.sql
--
-- Safe to run multiple times (IF NOT EXISTS on table + indexes).
-- Also auto-applied on API startup by _run_auto_migrations in
-- backend/api/main.py.
--
-- Allowed sources (enforced in code at backend/services/ledger.py
-- via LedgerSource.is_valid):
--   salary, mission_claim, achievement_claim, streak_claim,
--   hack_mainframe_win, hack_raid_attacker_win,
--   hack_raid_target_loss, hack_raid_attacker_loss,
--   hack_raid_target_win, transfer_out, transfer_in,
--   shop_purchase, fund_deposit, sell_investment,
--   claim_onchain, backfill_manual
--
-- Conventions:
--   delta_nxt > 0 = credit (NXT in)
--   delta_nxt < 0 = debit (NXT out)
--   delta_nxt = 0 is rejected by the CHECK constraint
-- ============================================================

SET search_path TO nx;

CREATE TABLE IF NOT EXISTS nxt_ledger (
    id              BIGSERIAL PRIMARY KEY,

    wallet_address  VARCHAR(42) NOT NULL,
    dev_token_id    BIGINT,

    delta_nxt       BIGINT NOT NULL,
    balance_after   BIGINT NOT NULL,

    source          TEXT NOT NULL,
    ref_table       TEXT,
    ref_id          BIGINT,

    idempotency_key TEXT NOT NULL UNIQUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlation_id  UUID,

    CHECK (delta_nxt != 0),
    CHECK (balance_after >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_wallet_time
    ON nxt_ledger(wallet_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_source_time
    ON nxt_ledger(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_dev_time
    ON nxt_ledger(dev_token_id, created_at DESC)
    WHERE dev_token_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_correlation
    ON nxt_ledger(correlation_id)
    WHERE correlation_id IS NOT NULL;
