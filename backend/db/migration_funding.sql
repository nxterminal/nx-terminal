-- Migration: Add FUND_DEV and TRANSFER action types + funding_txs table
-- Run manually on Render. DO NOT auto-execute.

SET search_path TO nx;

-- Add new action enum values
DO $$ BEGIN
  ALTER TYPE action_enum ADD VALUE IF NOT EXISTS 'FUND_DEV';
  ALTER TYPE action_enum ADD VALUE IF NOT EXISTS 'TRANSFER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table to track used funding TX hashes (prevents double-spend)
CREATE TABLE IF NOT EXISTS funding_txs (
    id              SERIAL PRIMARY KEY,
    wallet_address  TEXT NOT NULL,
    dev_token_id    INT NOT NULL,
    amount_nxt      NUMERIC NOT NULL,
    tx_hash         TEXT UNIQUE NOT NULL,
    verified        BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funding_tx_hash ON funding_txs(tx_hash);
