-- Dev Academy schema
-- Run this migration to add academy tables

-- Progress tracking
CREATE TABLE IF NOT EXISTS dev_academy_progress (
    id SERIAL PRIMARY KEY,
    user_key VARCHAR(100) NOT NULL,       -- wallet address or session ID for demo
    dev_id INTEGER DEFAULT 0,             -- NFT dev ID (0 for demo)
    lesson_id VARCHAR(20) NOT NULL,
    path_id VARCHAR(20) NOT NULL,
    completed_at TIMESTAMP DEFAULT NOW(),
    is_correct BOOLEAN DEFAULT TRUE,
    UNIQUE(user_key, lesson_id)
);

-- XP tracking
CREATE TABLE IF NOT EXISTS dev_academy_xp (
    id SERIAL PRIMARY KEY,
    user_key VARCHAR(100) NOT NULL,
    dev_id INTEGER DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 1,
    last_activity DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_da_progress_key ON dev_academy_progress(user_key);
CREATE INDEX IF NOT EXISTS idx_da_xp_key ON dev_academy_xp(user_key);
