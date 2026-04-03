-- Mega Sentinel: Deployer history for serial rugger detection
CREATE TABLE IF NOT EXISTS nx.sentinel_deployer_history (
    id SERIAL PRIMARY KEY,
    deployer_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    token_name TEXT,
    token_symbol TEXT,
    chain_id INTEGER DEFAULT 4326,
    status TEXT DEFAULT 'unknown',  -- 'active', 'rugged', 'dead', 'unknown'
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_deployer_addr
    ON nx.sentinel_deployer_history(deployer_address);
CREATE INDEX IF NOT EXISTS idx_sentinel_token_addr
    ON nx.sentinel_deployer_history(token_address);
