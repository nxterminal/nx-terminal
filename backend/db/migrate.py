"""Single source of schema truth for NX Terminal.

Called from:
  - production startup (`backend/api/main.py:lifespan`)
  - test fixtures (`backend/tests/conftest.py`)
  - first-time DB provisioning (`backend/db/init_db.py`)

Idempotent — safe to call repeatedly. Every CREATE TABLE / INDEX uses
IF NOT EXISTS, every CREATE TRIGGER drops + recreates, every ENUM is
guarded by a duplicate-object catch.

Phase 5.3.5 — replaces the prior triple-source split:
  - the standalone `schema.sql` file (initial bootstrap),
  - the standalone `migration_*.sql` files (one per phase),
  - the inline `_run_auto_migrations()` block in `main.py`.

All three are now a single function call (this file). The bootstrap
SQL is embedded as a Python string constant; the per-phase migrations
remain as imperative cur.execute calls so future migrations can use
Python control flow when needed (e.g. seed loops, conditional
backfills) without giving up the idempotent property.
"""

from __future__ import annotations

import logging

from backend.api.deps import get_db

log = logging.getLogger("nx_api")


# ── Bootstrap schema (formerly backend/db/schema.sql) ──────────────────
#
# Initial table / index / view / trigger creation. Run BEFORE the per-
# phase migrations below — those use ALTER TABLE on these tables.
#
# Differences from the historical schema.sql:
#   - `DROP SCHEMA IF EXISTS nx CASCADE` removed (was destructive on
#     repeat runs); replaced with `CREATE SCHEMA IF NOT EXISTS nx`.
#   - Every CREATE TABLE / INDEX / MATERIALIZED VIEW gets IF NOT EXISTS.
#   - Every CREATE TYPE wrapped in a duplicate-object catch.
#   - Every CREATE TRIGGER preceded by DROP TRIGGER IF EXISTS.
#   - CREATE VIEW switched to CREATE OR REPLACE VIEW.
#   - INSERT INTO simulation_state uses ON CONFLICT (key) DO NOTHING.
#
# Everything else (column lists, types, constraints, indexes, view
# definitions, seed data) is verbatim from the original schema.sql.

_BOOTSTRAP_SQL = r"""
-- ============================================================
-- NX TERMINAL: PROTOCOL WARS — DATABASE SCHEMA v1.0
-- PostgreSQL 15+
-- ============================================================

CREATE SCHEMA IF NOT EXISTS nx;
SET search_path TO nx;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE archetype_enum AS ENUM (
        '10X_DEV', 'LURKER', 'DEGEN', 'GRINDER',
        'INFLUENCER', 'HACKTIVIST', 'FED', 'SCRIPT_KIDDIE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE corporation_enum AS ENUM (
        'CLOSED_AI', 'MISANTHROPIC', 'SHALLOW_MIND',
        'ZUCK_LABS', 'Y_AI', 'MISTRIAL_SYSTEMS'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE location_enum AS ENUM (
        'BOARD_ROOM', 'HACKATHON_HALL', 'THE_PIT', 'DARK_WEB',
        'VC_TOWER', 'OPEN_SOURCE_GARDEN', 'SERVER_FARM',
        'GOVERNANCE_HALL', 'HYPE_HAUS', 'THE_GRAVEYARD'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE mood_enum AS ENUM (
        'neutral', 'excited', 'angry', 'depressed', 'focused'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE rarity_enum AS ENUM (
        'common', 'uncommon', 'rare', 'legendary', 'mythic'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE dev_status_enum AS ENUM (
        'active', 'resting', 'frozen'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE action_enum AS ENUM (
        'CREATE_PROTOCOL', 'CREATE_AI', 'INVEST', 'SELL',
        'MOVE', 'CHAT', 'CODE_REVIEW', 'REST',
        'RECEIVE_SALARY', 'USE_ITEM', 'GET_SABOTAGED', 'DEPLOY'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE chat_channel_enum AS ENUM (
        'location', 'trollbox'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE protocol_status_enum AS ENUM (
        'active', 'dead', 'graduated'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLE: players
-- ============================================================

CREATE TABLE IF NOT EXISTS players (
    wallet_address      VARCHAR(42) PRIMARY KEY,
    display_name        VARCHAR(30),
    corporation         corporation_enum NOT NULL,
    total_devs_minted   SMALLINT DEFAULT 0,
    balance_claimable   BIGINT DEFAULT 0,
    balance_claimed     BIGINT DEFAULT 0,
    balance_total_earned BIGINT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    last_active_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_corp ON players(corporation);
CREATE INDEX IF NOT EXISTS idx_players_balance ON players(balance_claimable DESC);

-- ============================================================
-- TABLE: devs
-- ============================================================

CREATE TABLE IF NOT EXISTS devs (
    token_id            INTEGER PRIMARY KEY,
    name                VARCHAR(30) NOT NULL UNIQUE,
    owner_address       VARCHAR(42) NOT NULL REFERENCES players(wallet_address),

    archetype           archetype_enum NOT NULL,
    corporation         corporation_enum NOT NULL,
    rarity_tier         rarity_enum NOT NULL DEFAULT 'common',
    personality_seed    BIGINT NOT NULL,
    species             VARCHAR(20),
    background          VARCHAR(20),
    accessory           VARCHAR(30),
    expression          VARCHAR(20),
    special_effect      VARCHAR(20),
    ipfs_hash           VARCHAR(66),

    alignment           VARCHAR(20),
    risk_level          VARCHAR(20),
    social_style        VARCHAR(20),
    coding_style        VARCHAR(20),
    work_ethic          VARCHAR(20),

    stat_coding         SMALLINT NOT NULL DEFAULT 50,
    stat_hacking        SMALLINT NOT NULL DEFAULT 50,
    stat_trading        SMALLINT NOT NULL DEFAULT 50,
    stat_social         SMALLINT NOT NULL DEFAULT 50,
    stat_endurance      SMALLINT NOT NULL DEFAULT 50,
    stat_luck           SMALLINT NOT NULL DEFAULT 50,

    skin                VARCHAR(30),
    clothing            VARCHAR(30),
    vibe                VARCHAR(30),
    glow                VARCHAR(30),
    hair_style          VARCHAR(30),
    hair_color          VARCHAR(30),
    facial              VARCHAR(30),
    headgear            VARCHAR(30),
    extra               VARCHAR(30),

    energy              SMALLINT NOT NULL DEFAULT 10 CHECK (energy >= 0 AND energy <= 15),
    max_energy          SMALLINT NOT NULL DEFAULT 10,
    mood                mood_enum NOT NULL DEFAULT 'neutral',
    location            location_enum NOT NULL DEFAULT 'BOARD_ROOM',
    balance_nxt         BIGINT NOT NULL DEFAULT 2000 CHECK (balance_nxt >= 0),
    reputation          INTEGER NOT NULL DEFAULT 50,
    status              dev_status_enum NOT NULL DEFAULT 'active',

    day                 INTEGER NOT NULL DEFAULT 1,
    coffee_count        INTEGER NOT NULL DEFAULT 0,
    lines_of_code       INTEGER NOT NULL DEFAULT 0,
    bugs_shipped        INTEGER NOT NULL DEFAULT 0,
    bugs_fixed          INTEGER NOT NULL DEFAULT 0,
    hours_since_sleep   INTEGER NOT NULL DEFAULT 0,

    protocols_created   INTEGER NOT NULL DEFAULT 0,
    protocols_failed    INTEGER NOT NULL DEFAULT 0,
    ais_created         INTEGER NOT NULL DEFAULT 0,
    devs_burned         INTEGER NOT NULL DEFAULT 0,
    biggest_win         TEXT,
    total_earned        BIGINT NOT NULL DEFAULT 0,
    total_spent         BIGINT NOT NULL DEFAULT 0,
    total_invested      BIGINT NOT NULL DEFAULT 0,
    code_reviews_done   INTEGER NOT NULL DEFAULT 0,
    bugs_found          INTEGER NOT NULL DEFAULT 0,
    cycles_active       INTEGER NOT NULL DEFAULT 0,

    last_action_type    action_enum,
    last_action_detail  TEXT,
    last_action_at      TIMESTAMPTZ,
    last_message        TEXT,
    last_message_channel chat_channel_enum,

    caffeine            SMALLINT NOT NULL DEFAULT 50,
    social_vitality     SMALLINT NOT NULL DEFAULT 50,
    knowledge           SMALLINT NOT NULL DEFAULT 50,

    pc_health           SMALLINT NOT NULL DEFAULT 100,
    training_course     VARCHAR(30) DEFAULT NULL,
    training_ends_at    TIMESTAMPTZ DEFAULT NULL,
    last_raid_at        TIMESTAMPTZ DEFAULT NULL,

    next_cycle_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cycle_interval_sec  INTEGER NOT NULL DEFAULT 600,

    minted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devs_owner ON devs(owner_address);
CREATE INDEX IF NOT EXISTS idx_devs_schedule ON devs(next_cycle_at ASC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_devs_location ON devs(location);
CREATE INDEX IF NOT EXISTS idx_devs_archetype ON devs(archetype);
CREATE INDEX IF NOT EXISTS idx_devs_balance ON devs(balance_nxt DESC);
CREATE INDEX IF NOT EXISTS idx_devs_reputation ON devs(reputation DESC);
CREATE INDEX IF NOT EXISTS idx_devs_corporation ON devs(corporation);

-- ============================================================
-- TABLE: protocols
-- ============================================================

CREATE TABLE IF NOT EXISTS protocols (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(60) NOT NULL,
    description         TEXT,
    creator_dev_id      INTEGER NOT NULL REFERENCES devs(token_id),
    code_quality        SMALLINT NOT NULL CHECK (code_quality >= 0 AND code_quality <= 100),
    value               BIGINT NOT NULL DEFAULT 1000,
    total_supply        BIGINT NOT NULL DEFAULT 10000,
    creator_shares      BIGINT NOT NULL DEFAULT 6000,
    total_invested      BIGINT NOT NULL DEFAULT 0,
    investor_count      INTEGER NOT NULL DEFAULT 0,
    status              protocol_status_enum NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proto_creator ON protocols(creator_dev_id);
CREATE INDEX IF NOT EXISTS idx_proto_value ON protocols(value DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_proto_status ON protocols(status);

-- ============================================================
-- TABLE: protocol_investments
-- ============================================================

CREATE TABLE IF NOT EXISTS protocol_investments (
    id                  SERIAL PRIMARY KEY,
    dev_id              INTEGER NOT NULL REFERENCES devs(token_id),
    protocol_id         INTEGER NOT NULL REFERENCES protocols(id),
    shares              BIGINT NOT NULL CHECK (shares > 0),
    nxt_invested        BIGINT NOT NULL CHECK (nxt_invested > 0),
    invested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(dev_id, protocol_id)
);

CREATE INDEX IF NOT EXISTS idx_invest_dev ON protocol_investments(dev_id);
CREATE INDEX IF NOT EXISTS idx_invest_proto ON protocol_investments(protocol_id);

-- ============================================================
-- TABLE: absurd_ais
-- ============================================================

CREATE TABLE IF NOT EXISTS absurd_ais (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(60) NOT NULL,
    description         TEXT,
    creator_dev_id      INTEGER NOT NULL REFERENCES devs(token_id),
    vote_count          INTEGER NOT NULL DEFAULT 0,
    weighted_votes      REAL NOT NULL DEFAULT 0.0,
    reward_tier         SMALLINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ais_creator ON absurd_ais(creator_dev_id);
CREATE INDEX IF NOT EXISTS idx_ais_votes ON absurd_ais(weighted_votes DESC);

-- ============================================================
-- TABLE: ai_votes
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_votes (
    voter_dev_id        INTEGER NOT NULL REFERENCES devs(token_id),
    ai_id               INTEGER NOT NULL REFERENCES absurd_ais(id),
    weight              REAL NOT NULL DEFAULT 1.0,
    voted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (voter_dev_id, ai_id)
);

-- ============================================================
-- TABLE: actions (partitioned)
-- ============================================================

CREATE TABLE IF NOT EXISTS actions (
    id                  BIGSERIAL,
    dev_id              INTEGER NOT NULL,
    dev_name            VARCHAR(30) NOT NULL,
    archetype           archetype_enum NOT NULL,
    action_type         action_enum NOT NULL,
    details             JSONB,
    energy_cost         SMALLINT NOT NULL DEFAULT 0,
    nxt_cost            BIGINT NOT NULL DEFAULT 0,
    cycle_number        INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS actions_default PARTITION OF actions DEFAULT;

CREATE INDEX IF NOT EXISTS idx_actions_dev ON actions(dev_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_type ON actions(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_recent ON actions(created_at DESC);

-- ============================================================
-- TABLE: chat_messages (partitioned)
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id                  BIGSERIAL,
    dev_id              INTEGER NOT NULL,
    dev_name            VARCHAR(30) NOT NULL,
    archetype           archetype_enum NOT NULL,
    channel             chat_channel_enum NOT NULL,
    location            location_enum,
    message             TEXT NOT NULL,
    cycle_number        INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS chat_messages_default PARTITION OF chat_messages DEFAULT;

CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_location ON chat_messages(location, created_at DESC);

-- ============================================================
-- TABLE: world_events
-- ============================================================

CREATE TABLE IF NOT EXISTS world_events (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(100) NOT NULL,
    description         TEXT,
    event_type          VARCHAR(30) NOT NULL,
    effects             JSONB NOT NULL DEFAULT '{}',
    starts_at           TIMESTAMPTZ NOT NULL,
    ends_at             TIMESTAMPTZ NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_events_active ON world_events(is_active, starts_at);

-- ============================================================
-- TABLE: shop_purchases
-- ============================================================

CREATE TABLE IF NOT EXISTS shop_purchases (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
    target_dev_id       INTEGER REFERENCES devs(token_id),
    item_type           VARCHAR(30) NOT NULL,
    item_effect         JSONB,
    nxt_cost            BIGINT NOT NULL,
    purchased_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: player_prompts
-- ============================================================

CREATE TABLE IF NOT EXISTS player_prompts (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL,
    dev_id              INTEGER NOT NULL REFERENCES devs(token_id),
    prompt_text         TEXT NOT NULL,
    consumed            BOOLEAN NOT NULL DEFAULT FALSE,
    consumed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompts_pending ON player_prompts(dev_id) WHERE consumed = FALSE;

-- ============================================================
-- TABLE: notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL,
    type                VARCHAR(50) NOT NULL,
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    read                BOOLEAN NOT NULL DEFAULT FALSE,
    dev_id              INTEGER REFERENCES devs(token_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_player ON notifications(player_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(player_address) WHERE read = FALSE;

-- ============================================================
-- TABLE: world_chat
-- ============================================================

CREATE TABLE IF NOT EXISTS world_chat (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL,
    display_name        VARCHAR(30),
    message             TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wchat_recent ON world_chat(created_at DESC);

-- ============================================================
-- TABLE: simulation_state
-- ============================================================

CREATE TABLE IF NOT EXISTS simulation_state (
    key                 VARCHAR(50) PRIMARY KEY,
    value               JSONB NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: claim_history
-- ============================================================

CREATE TABLE IF NOT EXISTS claim_history (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
    amount_gross        BIGINT NOT NULL,
    fee_amount          BIGINT NOT NULL,
    amount_net          BIGINT NOT NULL,
    tx_hash             VARCHAR(66),
    claimed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_player ON claim_history(player_address);

-- ============================================================
-- TABLE: balance_snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS balance_snapshots (
    id                  SERIAL PRIMARY KEY,
    wallet_address      VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
    balance_claimable   BIGINT NOT NULL DEFAULT 0,
    balance_claimed     BIGINT NOT NULL DEFAULT 0,
    balance_total_earned BIGINT NOT NULL DEFAULT 0,
    snapshot_date       DATE NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_wallet ON balance_snapshots(wallet_address, snapshot_date DESC);

-- ============================================================
-- SEED DATA: simulation initial state
-- ============================================================

INSERT INTO simulation_state (key, value) VALUES
    ('simulation_status', '"pre_launch"'),
    ('current_cycle', '0'),
    ('total_devs_minted', '0'),
    ('total_nxt_circulation', '0'),
    ('total_nxt_spent', '0'),
    ('total_protocols_created', '0'),
    ('total_ais_created', '0'),
    ('simulation_started_at', 'null'),
    ('simulation_ends_at', 'null'),
    ('endgame_triggered', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- FUNCTIONS + TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_devs_updated ON devs;
CREATE TRIGGER trg_devs_updated
    BEFORE UPDATE ON devs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_protocols_updated ON protocols;
CREATE TRIGGER trg_protocols_updated
    BEFORE UPDATE ON protocols
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE FUNCTION recalc_player_balance(p_address VARCHAR)
RETURNS BIGINT AS $$
DECLARE
    total BIGINT;
BEGIN
    SELECT COALESCE(SUM(balance_nxt), 0) INTO total
    FROM devs WHERE owner_address = p_address;

    UPDATE players SET balance_claimable = total WHERE wallet_address = p_address;
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS / MATERIALIZED VIEWS
-- ============================================================

-- Materialized view: leaderboard. CREATE OR REPLACE doesn't exist for
-- materialized views, so use IF NOT EXISTS guard. Refresh policy is
-- handled by the engine (out of schema scope).
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard AS
SELECT
    d.token_id,
    d.name,
    d.archetype,
    d.corporation,
    d.owner_address,
    d.balance_nxt,
    d.reputation,
    d.protocols_created,
    d.ais_created,
    d.rarity_tier,
    ROW_NUMBER() OVER (ORDER BY d.balance_nxt DESC) as rank_balance,
    ROW_NUMBER() OVER (ORDER BY d.reputation DESC) as rank_reputation
FROM devs d
WHERE d.status = 'active'
ORDER BY d.balance_nxt DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_token ON leaderboard(token_id);

CREATE OR REPLACE VIEW protocol_market AS
SELECT
    p.id,
    p.name,
    p.description,
    p.code_quality,
    p.value,
    p.investor_count,
    p.total_invested,
    p.status,
    d.name as creator_name,
    d.archetype as creator_archetype,
    p.created_at
FROM protocols p
JOIN devs d ON d.token_id = p.creator_dev_id
WHERE p.status = 'active'
ORDER BY p.value DESC;

CREATE OR REPLACE VIEW ai_lab AS
SELECT
    a.id,
    a.name,
    a.description,
    a.vote_count,
    a.weighted_votes,
    a.reward_tier,
    d.name as creator_name,
    d.archetype as creator_archetype,
    a.created_at
FROM absurd_ais a
JOIN devs d ON d.token_id = a.creator_dev_id
ORDER BY a.weighted_votes DESC;
"""


# ── Per-phase migrations ────────────────────────────────────────────────
#
# Verbatim Python body from main.py:_run_auto_migrations(). Runs AFTER
# the bootstrap SQL above. ALTER TABLE / CREATE TABLE IF NOT EXISTS /
# CREATE INDEX IF NOT EXISTS are all idempotent; CREATE TRIGGER is
# guarded by DROP TRIGGER IF EXISTS.
#
# Two transactions (preserving the original main.py shape):
#   1. Bootstrap + main migrations (this is where schema lives).
#   2. Broadcast emails (operational backfills, kept separate so a
#      broadcast failure doesn't roll back the schema).
#
# Both wrapped in try/except + log.warning so a startup failure
# doesn't crash the API process.

def run_auto_migrations() -> None:
    """Apply the bootstrap schema + every per-phase migration. Idempotent.

    Uses `backend.api.deps.get_db()` internally — caller must have
    initialized the DB pool via `init_db_pool()` first.
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Step 1: bootstrap schema (formerly schema.sql).
                cur.execute(_BOOTSTRAP_SQL)

                # Step 2: per-phase migrations (verbatim from prior
                # main.py:_run_auto_migrations body).
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS caffeine SMALLINT NOT NULL DEFAULT 50")
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS social_vitality SMALLINT NOT NULL DEFAULT 50")
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS knowledge SMALLINT NOT NULL DEFAULT 50")
                # Tables that must exist before anything else
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS login_streaks (
                        wallet_address VARCHAR(42) PRIMARY KEY,
                        current_streak INTEGER NOT NULL DEFAULT 0,
                        longest_streak INTEGER NOT NULL DEFAULT 0,
                        last_claim_at TIMESTAMPTZ,
                        total_claimed_nxt BIGINT NOT NULL DEFAULT 0
                    )
                """)
                # Idempotent migration: legacy schemas had `last_claim_date DATE`.
                # ADD COLUMN IF NOT EXISTS covers fresh deploys; the DO block
                # backfills + drops the legacy column only if it existed.
                cur.execute("ALTER TABLE login_streaks ADD COLUMN IF NOT EXISTS last_claim_at TIMESTAMPTZ")
                cur.execute("""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_schema = current_schema()
                              AND table_name = 'login_streaks'
                              AND column_name = 'last_claim_date'
                        ) THEN
                            UPDATE login_streaks
                               SET last_claim_at = (last_claim_date::timestamp + INTERVAL '12 hours') AT TIME ZONE 'UTC'
                             WHERE last_claim_at IS NULL AND last_claim_date IS NOT NULL;
                            ALTER TABLE login_streaks DROP COLUMN last_claim_date;
                        END IF;
                    END $$;
                """)
                # Ensure action_enum has all required values
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HACK_MAINFRAME'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
                        THEN ALTER TYPE action_enum ADD VALUE 'HACK_MAINFRAME'; END IF;
                    END $$;
                """)
                # Phase 5.3.5b — enum values that lived only in
                # migration_mechanics.sql / migration_missions.sql and
                # were never absorbed into auto-migration. Production
                # has them via historical manual psql -f runs; a fresh
                # DB built from migrate.py alone was missing them. Each
                # is referenced from production code (verified by grep
                # at PR time): 'HACK_RAID' in shop.py (raid INSERTs),
                # 'on_mission' in missions/admin/achievements/shop/
                # streaks/user/sprkls (status checks + transitions),
                # 'MISSION_START' in missions.py.
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HACK_RAID'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
                        THEN ALTER TYPE action_enum ADD VALUE 'HACK_RAID'; END IF;
                    END $$;
                """)
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MISSION_START'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
                        THEN ALTER TYPE action_enum ADD VALUE 'MISSION_START'; END IF;
                    END $$;
                """)
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'on_mission'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dev_status_enum'))
                        THEN ALTER TYPE dev_status_enum ADD VALUE 'on_mission'; END IF;
                    END $$;
                """)
                # Ensure location_enum has all values the engine might use
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GitHub HQ'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'location_enum'))
                        THEN ALTER TYPE location_enum ADD VALUE 'GitHub HQ'; END IF;
                    END $$;
                """)
                # Mission tables (formerly migration_missions.sql) — must
                # exist before later ALTER TABLE statements reference them.
                # Schema matches migration_missions.sql exactly so production
                # (which had that file run manually) stays consistent.
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MISSION_COMPLETE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
                        THEN ALTER TYPE action_enum ADD VALUE 'MISSION_COMPLETE'; END IF;
                    END $$;
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS missions (
                        id SERIAL PRIMARY KEY,
                        title VARCHAR(100) NOT NULL,
                        description TEXT NOT NULL,
                        lore_text TEXT NOT NULL,
                        difficulty VARCHAR(20) NOT NULL,
                        duration_hours INT NOT NULL,
                        reward_nxt INT NOT NULL,
                        min_stat VARCHAR(20),
                        min_stat_value INT DEFAULT 0,
                        min_devs_owned INT DEFAULT 1,
                        active BOOLEAN DEFAULT true
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS player_missions (
                        id SERIAL PRIMARY KEY,
                        wallet_address TEXT NOT NULL,
                        mission_id INT REFERENCES missions(id),
                        dev_token_id INT NOT NULL,
                        status VARCHAR(20) DEFAULT 'in_progress',
                        started_at TIMESTAMPTZ DEFAULT NOW(),
                        ends_at TIMESTAMPTZ NOT NULL,
                        claimed_at TIMESTAMPTZ
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_player_missions_wallet ON player_missions(wallet_address)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_player_missions_dev ON player_missions(dev_token_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_player_missions_status ON player_missions(wallet_address, status)")
                # Mission multi-dev support
                cur.execute("ALTER TABLE missions ADD COLUMN IF NOT EXISTS required_devs SMALLINT NOT NULL DEFAULT 1")
                cur.execute("ALTER TABLE player_missions ADD COLUMN IF NOT EXISTS group_id VARCHAR(36)")
                # Update required_devs based on difficulty (only if still at default 1)
                cur.execute("UPDATE missions SET required_devs = 2 WHERE difficulty = 'medium' AND required_devs = 1")
                cur.execute("UPDATE missions SET required_devs = 4 WHERE difficulty = 'hard' AND required_devs = 1")
                cur.execute("UPDATE missions SET required_devs = 10 WHERE difficulty = 'legendary' AND required_devs = 1")
                # Normalize rewards by difficulty
                cur.execute("UPDATE missions SET reward_nxt = 25 WHERE difficulty = 'easy' AND reward_nxt != 25")
                cur.execute("UPDATE missions SET reward_nxt = 50 WHERE difficulty = 'medium' AND reward_nxt != 50")
                cur.execute("UPDATE missions SET reward_nxt = 80 WHERE difficulty = 'hard' AND reward_nxt != 80")
                cur.execute("UPDATE missions SET reward_nxt = 250 WHERE difficulty = 'legendary' AND reward_nxt != 250")
                # Remove extreme difficulty missions
                cur.execute("UPDATE player_missions SET status = 'abandoned' WHERE mission_id IN (SELECT id FROM missions WHERE difficulty = 'extreme') AND status = 'in_progress'")
                cur.execute("DELETE FROM player_missions WHERE mission_id IN (SELECT id FROM missions WHERE difficulty = 'extreme')")
                cur.execute("DELETE FROM missions WHERE difficulty = 'extreme'")
                # Remove one easy mission to keep 3 total
                cur.execute("DELETE FROM player_missions WHERE mission_id IN (SELECT id FROM missions WHERE title = 'Explain Crypto to Your Mom')")
                cur.execute("DELETE FROM missions WHERE title = 'Explain Crypto to Your Mom'")
                # Performance indexes for scale
                cur.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_dev_id ON chat_messages(dev_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_actions_type_dev ON actions(action_type, dev_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_notif_player_read ON notifications(player_address, read, created_at DESC)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_player_missions_wallet_dev ON player_missions(wallet_address, dev_token_id)")
                # FUND_DEV / TRANSFER action enums + funding_txs
                # (formerly migration_funding.sql).
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FUND_DEV'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
                        THEN ALTER TYPE action_enum ADD VALUE 'FUND_DEV'; END IF;
                    END $$;
                """)
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TRANSFER'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
                        THEN ALTER TYPE action_enum ADD VALUE 'TRANSFER'; END IF;
                    END $$;
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS funding_txs (
                        id              SERIAL PRIMARY KEY,
                        wallet_address  TEXT NOT NULL,
                        dev_token_id    INT NOT NULL,
                        amount_nxt      NUMERIC NOT NULL,
                        tx_hash         TEXT UNIQUE NOT NULL,
                        verified        BOOLEAN DEFAULT false,
                        created_at      TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_funding_tx_hash ON funding_txs(tx_hash)")
                # pending_fund_txs — fallback queue for /shop/fund
                cur.execute("""
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
                    )
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_pending_fund_unresolved
                        ON pending_fund_txs(resolved, created_at)
                        WHERE resolved = false
                """)
                # Backoff column
                cur.execute(
                    "ALTER TABLE pending_fund_txs "
                    "ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ"
                )
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_pending_funds_next_retry
                        ON pending_fund_txs(next_retry_at)
                        WHERE resolved = false
                """)
                # chat_messages enrichment for the Live Feed redesign
                cur.execute("""
                    ALTER TABLE chat_messages
                    ADD COLUMN IF NOT EXISTS chat_type VARCHAR(20) NOT NULL DEFAULT 'idle'
                """)
                cur.execute("""
                    ALTER TABLE chat_messages
                    ADD COLUMN IF NOT EXISTS social_gain SMALLINT NOT NULL DEFAULT 0
                """)
                # Achievements tables
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS achievements (
                        id VARCHAR(40) PRIMARY KEY,
                        title VARCHAR(80) NOT NULL,
                        description TEXT NOT NULL,
                        category VARCHAR(30) NOT NULL,
                        icon VARCHAR(10) NOT NULL DEFAULT '?',
                        reward_nxt INTEGER NOT NULL DEFAULT 0,
                        requirement_type VARCHAR(40) NOT NULL,
                        requirement_value INTEGER NOT NULL DEFAULT 1,
                        rarity VARCHAR(20) NOT NULL DEFAULT 'common'
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS player_achievements (
                        wallet_address VARCHAR(42) NOT NULL,
                        achievement_id VARCHAR(40) NOT NULL REFERENCES achievements(id),
                        unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        claimed BOOLEAN NOT NULL DEFAULT FALSE,
                        PRIMARY KEY (wallet_address, achievement_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_player_achievements_wallet ON player_achievements(wallet_address)")
                # Seed achievements
                from backend.api.routes.achievements import ACHIEVEMENTS as _ACHS
                for a in _ACHS:
                    cur.execute("""
                        INSERT INTO achievements (id, title, description, category, icon, reward_nxt, requirement_type, requirement_value, rarity)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                    """, (a["id"], a["title"], a["description"], a["category"], a["icon"],
                          a["reward_nxt"], a["requirement_type"], a["requirement_value"], a["rarity"]))
                # Seed OFFICIAL LAUNCH event
                cur.execute("""
                    INSERT INTO world_events (title, description, event_type, effects, starts_at, ends_at, is_active)
                    SELECT 'OFFICIAL LAUNCH',
                           'NX Terminal is live on MegaETH. Launch bonuses active: +25% salary, -30% hack cost, +25% mission rewards. Welcome, dev.',
                           'weekly',
                           '{"salary_multiplier": 1.25, "hack_cost_multiplier": 0.7, "mission_reward_multiplier": 1.25}'::jsonb,
                           NOW(), '2099-12-31'::timestamptz, TRUE
                    WHERE NOT EXISTS (
                        SELECT 1 FROM world_events
                        WHERE title IN ('OFFICIAL LAUNCH', 'MEGA TESTER PROGRAM')
                    )
                """)
                cur.execute("""
                    UPDATE world_events
                    SET title = 'OFFICIAL LAUNCH',
                        description = 'NX Terminal is live on MegaETH. Launch bonuses active: +25% salary, -30% hack cost, +25% mission rewards. Welcome, dev.'
                    WHERE title = 'MEGA TESTER PROGRAM'
                """)
                # VIP testers table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS vip_testers (
                        wallet_address VARCHAR(42) PRIMARY KEY,
                        name VARCHAR(100),
                        welcomed BOOLEAN DEFAULT false
                    )
                """)
                _VIP_TESTERS = [
                    ("0x9acd0c4bdf6e599312f7e5e0beb24c4fe8f05764", "wabersky"),
                    ("0xcac4f9d03002e095df3cabfe625e93bbb7260363", "Scott_louis"),
                    ("0x1638f76072261335960fdd16c1e86fa78679faff", "Trisa26"),
                    ("0x73f04cdeb2ce2ea9329fdbcfa08cebf7b6f06251", "Medocons"),
                    ("0x6b85a239ecd32e0bf25e46f272a74879eb9e8495", "xSolynor"),
                    ("0x194175b405822622f1784b9e13f8ffb24b283721", "tcatnguyentran"),
                    ("0x5c2fbf4a8bc802b6410249e30d60e9769edae437", "xPolice911"),
                    ("0xb3b615ab7916f12ef7b1c889660c2c8a3b361afe", "vanalli"),
                    ("0xb625a2a5847368bbe0b719425b6edc12f8ccad58", "Erionesu"),
                    ("0x29eb182b934780bb25c4656268df4c919225e707", "aadvark89"),
                    ("0xc16c60fcde4c2d4b4c53be2680602d6938ac9ec9", "cryptoNDee"),
                    ("0x5c25e6bc8a2842fd56ac2bac10f6dfdce08510a6", "Naers"),
                    ("0xb533d993c40c11528ab557201d7c197d145f0081", "Kaps240"),
                    ("0xfecb26fe05ef20f5e616912f3a4f2060dc7f6d70", "drmeed01"),
                    ("0x5581dc6bfacb1d2ff7d1ec09d4f7cd6ba9d9e91e", "coinjuniortr"),
                    ("0x3e1c9d4faa8d6ee7d7f4c1aed4caac4005edf009", "Mariel Rios"),
                ]
                for _w, _n in _VIP_TESTERS:
                    cur.execute("INSERT INTO vip_testers (wallet_address, name) VALUES (%s, %s) ON CONFLICT DO NOTHING", (_w, _n))
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS support_tickets (
                        id SERIAL PRIMARY KEY,
                        player_address VARCHAR(42) NOT NULL,
                        subject TEXT NOT NULL,
                        message TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute(
                    "ALTER TABLE support_tickets "
                    "ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'open', "
                    "ADD COLUMN IF NOT EXISTS reply_text TEXT, "
                    "ADD COLUMN IF NOT EXISTS replied_by VARCHAR(42), "
                    "ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ"
                )
                cur.execute(
                    "UPDATE support_tickets SET status = 'open' WHERE status IS NULL"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_tickets_status_created "
                    "ON support_tickets(status, created_at DESC) "
                    "WHERE status = 'open'"
                )
                cur.execute("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_notif_deleted ON notifications(deleted_at) WHERE deleted_at IS NULL")
                # admin_logs
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS admin_logs (
                        id             BIGSERIAL PRIMARY KEY,
                        correlation_id UUID,
                        event_type     TEXT NOT NULL,
                        wallet_address VARCHAR(42),
                        dev_token_id   BIGINT,
                        payload        JSONB,
                        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_admin_logs_wallet_time
                        ON admin_logs(wallet_address, created_at DESC)
                        WHERE wallet_address IS NOT NULL
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_admin_logs_correlation
                        ON admin_logs(correlation_id)
                        WHERE correlation_id IS NOT NULL
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_admin_logs_event_time
                        ON admin_logs(event_type, created_at DESC)
                """)
                # claim_history
                cur.execute("ALTER TABLE claim_history ADD COLUMN IF NOT EXISTS tx_block BIGINT")
                cur.execute("ALTER TABLE claim_history ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed'")
                cur.execute("UPDATE claim_history SET status = 'confirmed' WHERE status IS NULL")
                cur.execute("""
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_history_tx_hash_unique
                        ON claim_history(tx_hash)
                        WHERE tx_hash IS NOT NULL AND tx_hash <> ''
                """)
                # devs — 2-phase commit sync status
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS sync_status TEXT")
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS sync_tx_hash VARCHAR(66)")
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ")
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_devs_sync_status
                        ON devs(sync_status, sync_started_at)
                        WHERE sync_status IS NOT NULL
                """)
                # nxt_ledger — append-only economic ledger
                cur.execute("""
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
                    )
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_ledger_wallet_time
                        ON nxt_ledger(wallet_address, created_at DESC)
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_ledger_source_time
                        ON nxt_ledger(source, created_at DESC)
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_ledger_dev_time
                        ON nxt_ledger(dev_token_id, created_at DESC)
                        WHERE dev_token_id IS NOT NULL
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_ledger_correlation
                        ON nxt_ledger(correlation_id)
                        WHERE correlation_id IS NOT NULL
                """)
                # NXMARKET
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nxmarket_markets (
                        id                   BIGSERIAL PRIMARY KEY,
                        question             TEXT NOT NULL,
                        category             VARCHAR(40),
                        market_type          VARCHAR(20) NOT NULL
                                              CHECK (market_type IN ('official', 'user')),
                        created_by           VARCHAR(42) NOT NULL,
                        creator_fee_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
                        seed_nxt             NUMERIC(20,2) NOT NULL,
                        shares_yes           NUMERIC(30,8) NOT NULL,
                        shares_no            NUMERIC(30,8) NOT NULL,
                        liquidity_b          NUMERIC(20,2) NOT NULL,
                        status               VARCHAR(20) NOT NULL DEFAULT 'active'
                                              CHECK (status IN ('active', 'closed', 'resolved', 'invalid')),
                        outcome              VARCHAR(10)
                                              CHECK (outcome IS NULL OR outcome IN ('YES', 'NO', 'invalid')),
                        close_at             TIMESTAMPTZ NOT NULL,
                        resolved_at          TIMESTAMPTZ,
                        total_volume_nxt     NUMERIC(20,2) NOT NULL DEFAULT 0,
                        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_markets_status_close "
                    "ON nxmarket_markets(status, close_at)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_markets_type_status "
                    "ON nxmarket_markets(market_type, status)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_markets_creator "
                    "ON nxmarket_markets(created_by)"
                )
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nxmarket_positions (
                        id              BIGSERIAL PRIMARY KEY,
                        market_id       BIGINT NOT NULL
                                          REFERENCES nxmarket_markets(id) ON DELETE CASCADE,
                        wallet_address  VARCHAR(42) NOT NULL,
                        outcome         VARCHAR(10) NOT NULL
                                          CHECK (outcome IN ('YES', 'NO')),
                        shares          NUMERIC(30,8) NOT NULL DEFAULT 0,
                        cost_basis      NUMERIC(20,2) NOT NULL DEFAULT 0,
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (market_id, wallet_address, outcome)
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_positions_wallet "
                    "ON nxmarket_positions(wallet_address)"
                )
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nxmarket_trades (
                        id              BIGSERIAL PRIMARY KEY,
                        market_id       BIGINT NOT NULL
                                          REFERENCES nxmarket_markets(id) ON DELETE CASCADE,
                        wallet_address  VARCHAR(42) NOT NULL,
                        side            VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
                        outcome         VARCHAR(10) NOT NULL CHECK (outcome IN ('YES', 'NO')),
                        shares          NUMERIC(30,8) NOT NULL,
                        nxt_amount      NUMERIC(20,2) NOT NULL,
                        price           NUMERIC(10,6) NOT NULL,
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute(
                    "ALTER TABLE nxmarket_trades "
                    "ADD COLUMN IF NOT EXISTS penalty_nxt NUMERIC(20,2) NOT NULL DEFAULT 0"
                )
                cur.execute(
                    "ALTER TABLE nxmarket_markets "
                    "ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(42)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_trades_market_time "
                    "ON nxmarket_trades(market_id, created_at DESC)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_trades_wallet_time "
                    "ON nxmarket_trades(wallet_address, created_at DESC)"
                )
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nxmarket_price_history (
                        id                BIGSERIAL PRIMARY KEY,
                        market_id         BIGINT NOT NULL
                                            REFERENCES nxmarket_markets(id) ON DELETE CASCADE,
                        price_yes         NUMERIC(10,6) NOT NULL,
                        price_no          NUMERIC(10,6) NOT NULL,
                        total_volume_nxt  NUMERIC(20,2) NOT NULL DEFAULT 0,
                        snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_price_history_market_time "
                    "ON nxmarket_price_history(market_id, snapshot_at DESC)"
                )
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nxmarket_comments (
                        id              BIGSERIAL PRIMARY KEY,
                        market_id       BIGINT NOT NULL
                                          REFERENCES nxmarket_markets(id) ON DELETE CASCADE,
                        wallet_address  VARCHAR(42) NOT NULL,
                        body            TEXT NOT NULL
                                          CHECK (char_length(body) > 0 AND char_length(body) <= 500),
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        deleted_at      TIMESTAMPTZ,
                        deleted_by      VARCHAR(42)
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_comments_market_created "
                    "ON nxmarket_comments(market_id, created_at DESC) "
                    "WHERE deleted_at IS NULL"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_comments_wallet "
                    "ON nxmarket_comments(wallet_address)"
                )
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nxmarket_comment_votes (
                        id              BIGSERIAL PRIMARY KEY,
                        comment_id      BIGINT NOT NULL
                                          REFERENCES nxmarket_comments(id) ON DELETE CASCADE,
                        wallet_address  VARCHAR(42) NOT NULL,
                        vote_type       VARCHAR(10) NOT NULL
                                          CHECK (vote_type IN ('like', 'dislike')),
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (comment_id, wallet_address)
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nxmarket_comment_votes_comment "
                    "ON nxmarket_comment_votes(comment_id)"
                )
                cur.execute("""
                    UPDATE notifications SET deleted_at = NOW()
                    WHERE type IN ('protocol_created', 'ai_created')
                    AND deleted_at IS NULL
                """)
                # Phase 2.2 canonical-traits migration
                cur.execute("ALTER TABLE devs DROP COLUMN IF EXISTS devs_burned")
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'exhausted'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dev_status_enum'))
                        THEN ALTER TYPE dev_status_enum ADD VALUE 'exhausted'; END IF;
                    END $$;
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS dev_canonical_traits (
                        token_id INTEGER PRIMARY KEY,
                        species          VARCHAR(20) NOT NULL,
                        archetype        VARCHAR(30) NOT NULL,
                        corporation      VARCHAR(30) NOT NULL,
                        rarity           VARCHAR(20) NOT NULL,
                        alignment        VARCHAR(20) NOT NULL,
                        risk_level       VARCHAR(20) NOT NULL,
                        social_style     VARCHAR(20) NOT NULL,
                        coding_style     VARCHAR(30) NOT NULL,
                        work_ethic       VARCHAR(20) NOT NULL,
                        skill_module     VARCHAR(20) NOT NULL,
                        clothing         VARCHAR(40),
                        clothing_pattern VARCHAR(40),
                        eyewear          VARCHAR(30),
                        neckwear         VARCHAR(30),
                        spots            VARCHAR(20),
                        blush            BOOLEAN,
                        ear_detail       BOOLEAN,
                        voice_tone       VARCHAR(20) NOT NULL,
                        quirk            VARCHAR(50) NOT NULL,
                        lore_faction     VARCHAR(20) NOT NULL,
                        stat_coding      SMALLINT NOT NULL,
                        stat_hacking     SMALLINT NOT NULL,
                        stat_trading     SMALLINT NOT NULL,
                        stat_social      SMALLINT NOT NULL,
                        stat_endurance   SMALLINT NOT NULL,
                        stat_luck        SMALLINT NOT NULL,
                        bundle_source    VARCHAR(120) NOT NULL DEFAULT 'github:nxterminal/nx-metadata-bundle@main',
                        ingested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_canonical_corp ON dev_canonical_traits(corporation)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_canonical_archetype ON dev_canonical_traits(archetype)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_canonical_rarity ON dev_canonical_traits(rarity)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_canonical_voice_tone ON dev_canonical_traits(voice_tone)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_canonical_lore_faction ON dev_canonical_traits(lore_faction)")
                # NX Souls Phase 1
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nx_souls_quota (
                        token_id        INTEGER PRIMARY KEY REFERENCES devs(token_id),
                        quota_date      DATE NOT NULL DEFAULT CURRENT_DATE,
                        messages_today  INTEGER NOT NULL DEFAULT 0,
                        last_message_at TIMESTAMPTZ,
                        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_souls_quota_date "
                    "ON nx_souls_quota(quota_date)"
                )
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nx_souls_sleep_state (
                        token_id         INTEGER PRIMARY KEY REFERENCES devs(token_id),
                        sleeping         BOOLEAN NOT NULL DEFAULT FALSE,
                        sleep_reason     VARCHAR(50),
                        sleep_started_at TIMESTAMPTZ,
                        woken_at         TIMESTAMPTZ,
                        wake_count       INTEGER NOT NULL DEFAULT 0,
                        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_souls_sleep_active "
                    "ON nx_souls_sleep_state(sleeping) WHERE sleeping = TRUE"
                )
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nx_souls_messages_cache (
                        id               BIGSERIAL PRIMARY KEY,
                        token_id         INTEGER NOT NULL REFERENCES devs(token_id),
                        wallet_address   VARCHAR(42) NOT NULL,
                        user_message_len INTEGER NOT NULL,
                        response_len     INTEGER,
                        provider_used    VARCHAR(30),
                        climax           BOOLEAN NOT NULL DEFAULT FALSE,
                        duration_ms      INTEGER,
                        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_souls_msg_token_time "
                    "ON nx_souls_messages_cache(token_id, created_at DESC)"
                )
                # NX Souls Phase 3.5.1: full-content message store
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nx_souls_messages (
                        id              BIGSERIAL PRIMARY KEY,
                        token_id        INTEGER NOT NULL REFERENCES devs(token_id),
                        wallet_address  VARCHAR(42) NOT NULL,
                        role            VARCHAR(16) NOT NULL
                                        CHECK (role IN (
                                            'user',
                                            'assistant',
                                            'system_error',
                                            'system_resting'
                                        )),
                        content         TEXT NOT NULL,
                        is_climax       BOOLEAN NOT NULL DEFAULT FALSE,
                        is_resting      BOOLEAN NOT NULL DEFAULT FALSE,
                        provider_used   VARCHAR(32),
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        expires_at      TIMESTAMPTZ NOT NULL
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS "
                    "idx_nx_souls_messages_wallet_token_time "
                    "ON nx_souls_messages "
                    "(wallet_address, token_id, created_at DESC)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS "
                    "idx_nx_souls_messages_expires_at "
                    "ON nx_souls_messages (expires_at)"
                )
                # Sprkls Phase 4.1: nx_posts
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nx_posts (
                        id              BIGSERIAL PRIMARY KEY,
                        token_id        INTEGER NOT NULL
                                        REFERENCES devs(token_id) ON DELETE CASCADE,
                        wallet_address  VARCHAR(42) NOT NULL,
                        content         TEXT NOT NULL,
                        source          VARCHAR(16) NOT NULL
                                        CHECK (source IN ('sprkl', 'manual')),
                        action_type     VARCHAR(16)
                                        CHECK (action_type IS NULL OR action_type IN (
                                            'toast', 'graffiti', 'window',
                                            'screensaver', 'wallpaper',
                                            'desktop_file', 'cursor_prank',
                                            'fake_popup'
                                        )),
                        visual_metadata JSONB,
                        is_public       BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        expires_at      TIMESTAMPTZ NOT NULL,
                        dismissed_at    TIMESTAMPTZ
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_wallet_time "
                    "ON nx_posts (wallet_address, created_at DESC)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_created_desc "
                    "ON nx_posts (created_at DESC)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_expires_at "
                    "ON nx_posts (expires_at)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_token_time "
                    "ON nx_posts (token_id, created_at DESC)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_pending_sprkls "
                    "ON nx_posts (wallet_address, created_at DESC) "
                    "WHERE source = 'sprkl' AND dismissed_at IS NULL"
                )
                # NX POST Phase 5.1: feed-post extensions
                cur.execute(
                    "ALTER TABLE nx_posts ADD COLUMN IF NOT EXISTS "
                    "parent_post_id BIGINT REFERENCES nx_posts(id) "
                    "ON DELETE SET NULL"
                )
                cur.execute(
                    "ALTER TABLE nx_posts ADD COLUMN IF NOT EXISTS "
                    "like_count INTEGER NOT NULL DEFAULT 0"
                )
                cur.execute(
                    "ALTER TABLE nx_posts ADD COLUMN IF NOT EXISTS "
                    "reply_count INTEGER NOT NULL DEFAULT 0"
                )
                cur.execute(
                    "ALTER TABLE nx_posts ADD COLUMN IF NOT EXISTS "
                    "hashtags TEXT[] NOT NULL DEFAULT '{}'"
                )
                cur.execute(
                    "ALTER TABLE nx_posts ADD COLUMN IF NOT EXISTS "
                    "mentions TEXT[] NOT NULL DEFAULT '{}'"
                )
                cur.execute(
                    "ALTER TABLE nx_posts ADD COLUMN IF NOT EXISTS "
                    "tickers TEXT[] NOT NULL DEFAULT '{}'"
                )
                cur.execute(
                    "ALTER TABLE nx_posts ADD COLUMN IF NOT EXISTS "
                    "visibility VARCHAR(20) NOT NULL DEFAULT 'public'"
                )
                cur.execute("""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM pg_constraint
                            WHERE conname = 'nx_posts_source_check'
                        ) THEN
                            ALTER TABLE nx_posts
                                DROP CONSTRAINT nx_posts_source_check;
                        END IF;
                        ALTER TABLE nx_posts
                            ADD CONSTRAINT nx_posts_source_check
                            CHECK (source IN ('sprkl', 'manual', 'feed'));
                    END
                    $$;
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_parent "
                    "ON nx_posts (parent_post_id) "
                    "WHERE parent_post_id IS NOT NULL"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_hashtags "
                    "ON nx_posts USING GIN (hashtags)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS "
                    "idx_nx_posts_visibility_created "
                    "ON nx_posts (visibility, created_at DESC)"
                )
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nx_post_likes (
                        id           BIGSERIAL PRIMARY KEY,
                        post_id      BIGINT NOT NULL
                                     REFERENCES nx_posts(id) ON DELETE CASCADE,
                        user_address VARCHAR(42) NOT NULL,
                        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (post_id, user_address)
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_post_likes_user "
                    "ON nx_post_likes (LOWER(user_address))"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_post_likes_post "
                    "ON nx_post_likes (post_id)"
                )
                cur.execute("""
                    CREATE OR REPLACE FUNCTION nx_post_likes_count_sync()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF TG_OP = 'INSERT' THEN
                            UPDATE nx_posts
                            SET like_count = like_count + 1
                            WHERE id = NEW.post_id;
                        ELSIF TG_OP = 'DELETE' THEN
                            UPDATE nx_posts
                            SET like_count = GREATEST(like_count - 1, 0)
                            WHERE id = OLD.post_id;
                        END IF;
                        RETURN NULL;
                    END;
                    $$ LANGUAGE plpgsql;
                """)
                cur.execute(
                    "DROP TRIGGER IF EXISTS "
                    "nx_post_likes_count_sync_trigger ON nx_post_likes"
                )
                cur.execute("""
                    CREATE TRIGGER nx_post_likes_count_sync_trigger
                    AFTER INSERT OR DELETE ON nx_post_likes
                    FOR EACH ROW
                    EXECUTE FUNCTION nx_post_likes_count_sync();
                """)
                cur.execute("""
                    CREATE OR REPLACE FUNCTION nx_post_reply_count_sync()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF TG_OP = 'INSERT' AND NEW.parent_post_id IS NOT NULL THEN
                            UPDATE nx_posts
                            SET reply_count = reply_count + 1
                            WHERE id = NEW.parent_post_id;
                        ELSIF TG_OP = 'DELETE' AND OLD.parent_post_id IS NOT NULL THEN
                            UPDATE nx_posts
                            SET reply_count = GREATEST(reply_count - 1, 0)
                            WHERE id = OLD.parent_post_id;
                        END IF;
                        RETURN NULL;
                    END;
                    $$ LANGUAGE plpgsql;
                """)
                cur.execute(
                    "DROP TRIGGER IF EXISTS "
                    "nx_post_reply_count_sync_trigger ON nx_posts"
                )
                cur.execute("""
                    CREATE TRIGGER nx_post_reply_count_sync_trigger
                    AFTER INSERT OR DELETE ON nx_posts
                    FOR EACH ROW
                    EXECUTE FUNCTION nx_post_reply_count_sync();
                """)
                # Phase 5.1.1: LLM cost tracking table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS llm_usage_daily (
                        id                  BIGSERIAL PRIMARY KEY,
                        date                DATE NOT NULL,
                        service             VARCHAR(32) NOT NULL,
                        model               VARCHAR(64) NOT NULL,
                        call_count          INTEGER NOT NULL DEFAULT 0,
                        input_tokens        BIGINT NOT NULL DEFAULT 0,
                        output_tokens       BIGINT NOT NULL DEFAULT 0,
                        estimated_cost_usd  NUMERIC(10, 4) NOT NULL DEFAULT 0,
                        last_call_at        TIMESTAMPTZ,
                        UNIQUE (date, service, model)
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_llm_usage_date "
                    "ON llm_usage_daily (date DESC)"
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_llm_usage_service "
                    "ON llm_usage_daily (service)"
                )
                # Phase 5.5 (migration): Postgres-backed rate-limit
                # counters. Replaces a Redis-only implementation that
                # was silently fail-open in production (no Redis ever
                # provisioned on Render). One row per (namespace, key);
                # callers filter expired rows via WHERE expires_at >
                # NOW() so the absence of a periodic cleanup job just
                # means table bloat, not incorrect rate-limit
                # decisions. Index on expires_at keeps a future cleanup
                # job (DELETE WHERE expires_at < NOW()) cheap.
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS rate_limit_counters (
                        namespace   TEXT NOT NULL,
                        key         TEXT NOT NULL,
                        count       INTEGER NOT NULL DEFAULT 0,
                        expires_at  TIMESTAMPTZ NOT NULL,
                        PRIMARY KEY (namespace, key)
                    )
                """)
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_expires "
                    "ON rate_limit_counters (expires_at)"
                )
                # Welcome notifications backfill. Phase 5.3.5: hoisted
                # the system_broadcasts CREATE TABLE above the SELECT so
                # a fresh DB doesn't abort the transaction on
                # "relation does not exist". Production never hit this
                # because earlier runs accumulated the table; tests do.
                cur.execute("CREATE TABLE IF NOT EXISTS system_broadcasts (id VARCHAR(50) PRIMARY KEY, sent_at TIMESTAMPTZ DEFAULT NOW())")
                cur.execute("SELECT 1 FROM system_broadcasts WHERE id = 'welcome_backfill'")
                if not cur.fetchone():
                    from backend.api.routes.players import WELCOME_BODY
                    cur.execute("""
                        INSERT INTO notifications (player_address, type, title, body, created_at)
                        SELECT p.wallet_address, 'welcome',
                               'Welcome to NX Terminal — Protocol Wars Awaits',
                               %s, p.created_at
                        FROM players p
                        WHERE NOT EXISTS (
                            SELECT 1 FROM notifications n
                            WHERE n.player_address = p.wallet_address AND n.type = 'welcome'
                        )
                    """, (WELCOME_BODY,))
                    cur.execute("INSERT INTO system_broadcasts (id) VALUES ('welcome_backfill') ON CONFLICT DO NOTHING")
                    log.info("✅ Backfilled welcome notifications for existing players")
            conn.commit()
        log.info("✅ Auto-migrations complete")
    except Exception as e:
        log.warning(f"⚠️ Auto-migration warning: {e}")

    # Broadcast emails (separate transaction so main migrations aren't affected)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE TABLE IF NOT EXISTS system_broadcasts (id VARCHAR(50) PRIMARY KEY, sent_at TIMESTAMPTZ DEFAULT NOW())")
                cur.execute("SELECT 1 FROM system_broadcasts WHERE id = 'dev_camp_launch'")
                _flag = cur.fetchone()
                if _flag:
                    cur.execute("SELECT COUNT(*) as c FROM notifications WHERE type = 'broadcast' AND title = 'New Program: Dev Camp'")
                    if cur.fetchone()["c"] == 0:
                        cur.execute("DELETE FROM system_broadcasts WHERE id = 'dev_camp_launch'")
                        _flag = None
                if not _flag:
                    cur.execute("SELECT DISTINCT wallet_address FROM players")
                    _bcast_players = cur.fetchall()
                    _bcast_count = 0
                    for _p in _bcast_players:
                        try:
                            cur.execute("""
                                INSERT INTO notifications (player_address, type, title, body)
                                VALUES (%s, 'broadcast', %s, %s)
                            """, (_p["wallet_address"],
                                  "New Program: Dev Camp",
                                  "DEV CAMP IS NOW OPEN\n\n"
                                  "A new training facility has been deployed to your desktop. "
                                  "All developers are now eligible for enrollment.\n\n"
                                  "CLASSES (8h, 15 $NXT): +4 permanent stat boost\n"
                                  "INTENSIVE COURSES (2h, 40 $NXT): +2 permanent stat boost\n\n"
                                  "Skills: Hacking, Coding, Trading, Social, Endurance\n\n"
                                  "Open Dev Camp from your desktop to get started. "
                                  "Trained devs qualify for harder missions with bigger rewards.\n\n"
                                  "— NX Terminal Training Division"))
                            _bcast_count += 1
                        except Exception:
                            pass
                    cur.execute("INSERT INTO system_broadcasts (id) VALUES ('dev_camp_launch')")
                    log.info(f"✅ Broadcast 'dev_camp_launch' sent to {_bcast_count} players")
                else:
                    log.info("ℹ️ Broadcast 'dev_camp_launch' already sent")
    except Exception as e:
        log.warning(f"⚠️ Broadcast warning: {e}")

    # Fund reconciliation notice
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE TABLE IF NOT EXISTS system_broadcasts (id VARCHAR(50) PRIMARY KEY, sent_at TIMESTAMPTZ DEFAULT NOW())")
                cur.execute("SELECT 1 FROM system_broadcasts WHERE id = 'fund_reconciliation_v1'")
                _flag = cur.fetchone()
                _recipients = [
                    ('0x6b85a239ecd32e0bf25e46f272a74879eb9e8495', 60, 'KIRA-11'),
                    ('0x9acd0c4bdf6e599312f7e5e0beb24c4fe8f05764', 100, 'STORM-D4'),
                ]
                if _flag:
                    cur.execute("""
                        SELECT COUNT(*) as c FROM notifications
                        WHERE type = 'broadcast' AND title = 'Transaction Reconciliation Notice'
                          AND player_address IN (%s, %s)
                    """, tuple(r[0] for r in _recipients))
                    if cur.fetchone()["c"] < len(_recipients):
                        cur.execute("DELETE FROM system_broadcasts WHERE id = 'fund_reconciliation_v1'")
                        _flag = None
                if not _flag:
                    _finance_body = (
                        "SUBJECT: Transaction Reconciliation Notice\n\n"
                        "To: Employee\n"
                        "From: NX Terminal Finance Department\n"
                        "Re: Pending Fund Transfer Resolved\n\n"
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                        "  TRANSACTION STATUS: RESOLVED\n\n"
                        "  Our systems detected a pending fund transfer\n"
                        "  that was not properly credited to your account.\n\n"
                        "  After a thorough audit by the Finance Department,\n"
                        "  the funds have been located, verified, and\n"
                        "  deposited to your developer's balance.\n\n"
                        "  Amount: {amount} $NXT\n"
                        "  Developer: {dev}\n"
                        "  Status: CREDITED\n\n"
                        "  We apologize for the delay. A sync issue between\n"
                        "  our banking nodes caused a temporary processing\n"
                        "  gap. This has been corrected.\n\n"
                        "  If you notice any further discrepancies,\n"
                        "  please file a report. Or don't. We'll find\n"
                        "  them anyway. That's what audits are for.\n\n"
                        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                        "— NX Terminal Finance Department\n"
                        "   (Your funds are safe. Probably safer than ours.)"
                    )
                    _sent = 0
                    for _addr, _amount, _dev in _recipients:
                        try:
                            cur.execute("""
                                INSERT INTO notifications (player_address, type, title, body)
                                VALUES (%s, 'broadcast', %s, %s)
                            """, (_addr,
                                  "Transaction Reconciliation Notice",
                                  _finance_body.format(amount=_amount, dev=_dev)))
                            _sent += 1
                        except Exception as _fe:
                            log.warning(f"⚠️ fund_reconciliation_v1 insert failed for {_addr}: {_fe}")
                    cur.execute("INSERT INTO system_broadcasts (id) VALUES ('fund_reconciliation_v1')")
                    log.info(f"✅ Broadcast 'fund_reconciliation_v1' sent to {_sent} recipients")
                else:
                    log.info("ℹ️ Broadcast 'fund_reconciliation_v1' already sent")
    except Exception as e:
        log.warning(f"⚠️ Broadcast warning: {e}")
