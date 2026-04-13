-- Migration: pending_fund_txs — on-chain funds awaiting RPC indexing
--
-- Context: the /shop/fund endpoint returns "pending" instead of 400 when the
-- RPC node has not yet indexed a freshly-sent receipt. The pending row is
-- then picked up by the engine worker (process_pending_funds) every ~5 min
-- and credited once the receipt shows up. Dedup is guaranteed by
-- funding_txs.tx_hash UNIQUE, so a pending row can never cause a double credit.
--
-- Run manually on Render. The engine also auto-creates this table on startup
-- (see engine.py auto-migrations).

SET search_path TO nx;

CREATE TABLE IF NOT EXISTS pending_fund_txs (
    id               SERIAL PRIMARY KEY,
    tx_hash          TEXT UNIQUE NOT NULL,
    wallet_address   TEXT NOT NULL,
    dev_token_id     INT NOT NULL,
    amount_nxt       NUMERIC NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved         BOOLEAN NOT NULL DEFAULT false,
    resolved_at      TIMESTAMPTZ,
    attempts         INT NOT NULL DEFAULT 0,
    last_attempt_at  TIMESTAMPTZ,
    last_error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_fund_unresolved
    ON pending_fund_txs(resolved, created_at)
    WHERE resolved = false;
