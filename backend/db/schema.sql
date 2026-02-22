-- ============================================================
-- NX TERMINAL: PROTOCOL WARS — DATABASE SCHEMA v1.0
-- PostgreSQL 15+
-- ============================================================

-- Limpiar si existe
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE archetype_enum AS ENUM (
    '10X_DEV', 'LURKER', 'DEGEN', 'GRINDER',
    'INFLUENCER', 'HACKTIVIST', 'FED', 'SCRIPT_KIDDIE'
);

CREATE TYPE corporation_enum AS ENUM (
    'CLOSED_AI', 'MISANTHROPIC', 'SHALLOW_MIND',
    'ZUCK_LABS', 'Y_AI', 'MISTRIAL_SYSTEMS'
);

CREATE TYPE location_enum AS ENUM (
    'BOARD_ROOM', 'HACKATHON_HALL', 'THE_PIT', 'DARK_WEB',
    'VC_TOWER', 'OPEN_SOURCE_GARDEN', 'SERVER_FARM',
    'GOVERNANCE_HALL', 'HYPE_HAUS', 'THE_GRAVEYARD'
);

CREATE TYPE mood_enum AS ENUM (
    'neutral', 'excited', 'angry', 'depressed', 'focused'
);

CREATE TYPE rarity_enum AS ENUM (
    'common', 'uncommon', 'rare', 'legendary', 'mythic'
);

CREATE TYPE dev_status_enum AS ENUM (
    'active', 'resting', 'frozen'
);

CREATE TYPE action_enum AS ENUM (
    'CREATE_PROTOCOL', 'CREATE_AI', 'INVEST', 'SELL',
    'MOVE', 'CHAT', 'CODE_REVIEW', 'REST',
    'RECEIVE_SALARY', 'USE_ITEM', 'GET_SABOTAGED'
);

CREATE TYPE chat_channel_enum AS ENUM (
    'location', 'trollbox'
);

CREATE TYPE protocol_status_enum AS ENUM (
    'active', 'dead', 'graduated'
);

-- ============================================================
-- TABLA: players
-- ============================================================

CREATE TABLE players (
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

CREATE INDEX idx_players_corp ON players(corporation);
CREATE INDEX idx_players_balance ON players(balance_claimable DESC);

-- ============================================================
-- TABLA: devs (el corazón de todo)
-- ============================================================

CREATE TABLE devs (
    token_id            INTEGER PRIMARY KEY,
    name                VARCHAR(30) NOT NULL UNIQUE,
    owner_address       VARCHAR(42) NOT NULL REFERENCES players(wallet_address),

    -- Atributos estáticos (inmutables post-mint)
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

    -- Estado dinámico (cambia cada ciclo)
    energy              SMALLINT NOT NULL DEFAULT 10 CHECK (energy >= 0 AND energy <= 15),
    max_energy          SMALLINT NOT NULL DEFAULT 10,
    mood                mood_enum NOT NULL DEFAULT 'neutral',
    location            location_enum NOT NULL DEFAULT 'BOARD_ROOM',
    balance_nxt         BIGINT NOT NULL DEFAULT 2000 CHECK (balance_nxt >= 0),
    reputation          INTEGER NOT NULL DEFAULT 50,
    status              dev_status_enum NOT NULL DEFAULT 'active',

    -- Stats acumulados
    protocols_created   INTEGER NOT NULL DEFAULT 0,
    ais_created         INTEGER NOT NULL DEFAULT 0,
    total_earned        BIGINT NOT NULL DEFAULT 0,
    total_spent         BIGINT NOT NULL DEFAULT 0,
    total_invested      BIGINT NOT NULL DEFAULT 0,
    code_reviews_done   INTEGER NOT NULL DEFAULT 0,
    bugs_found          INTEGER NOT NULL DEFAULT 0,
    cycles_active       INTEGER NOT NULL DEFAULT 0,

    -- Última acción (cache para fast reads)
    last_action_type    action_enum,
    last_action_detail  TEXT,
    last_action_at      TIMESTAMPTZ,
    last_message        TEXT,
    last_message_channel chat_channel_enum,

    -- Scheduling
    next_cycle_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cycle_interval_sec  INTEGER NOT NULL DEFAULT 600,

    -- Timestamps
    minted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices críticos para performance
CREATE INDEX idx_devs_owner ON devs(owner_address);
CREATE INDEX idx_devs_schedule ON devs(next_cycle_at ASC) WHERE status = 'active';
CREATE INDEX idx_devs_location ON devs(location);
CREATE INDEX idx_devs_archetype ON devs(archetype);
CREATE INDEX idx_devs_balance ON devs(balance_nxt DESC);
CREATE INDEX idx_devs_reputation ON devs(reputation DESC);
CREATE INDEX idx_devs_corporation ON devs(corporation);

-- ============================================================
-- TABLA: protocols
-- ============================================================

CREATE TABLE protocols (
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

CREATE INDEX idx_proto_creator ON protocols(creator_dev_id);
CREATE INDEX idx_proto_value ON protocols(value DESC) WHERE status = 'active';
CREATE INDEX idx_proto_status ON protocols(status);

-- ============================================================
-- TABLA: protocol_investments
-- ============================================================

CREATE TABLE protocol_investments (
    id                  SERIAL PRIMARY KEY,
    dev_id              INTEGER NOT NULL REFERENCES devs(token_id),
    protocol_id         INTEGER NOT NULL REFERENCES protocols(id),
    shares              BIGINT NOT NULL CHECK (shares > 0),
    nxt_invested        BIGINT NOT NULL CHECK (nxt_invested > 0),
    invested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(dev_id, protocol_id)
);

CREATE INDEX idx_invest_dev ON protocol_investments(dev_id);
CREATE INDEX idx_invest_proto ON protocol_investments(protocol_id);

-- ============================================================
-- TABLA: absurd_ais
-- ============================================================

CREATE TABLE absurd_ais (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(60) NOT NULL,
    description         TEXT,
    creator_dev_id      INTEGER NOT NULL REFERENCES devs(token_id),
    vote_count          INTEGER NOT NULL DEFAULT 0,
    weighted_votes      REAL NOT NULL DEFAULT 0.0,
    reward_tier         SMALLINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ais_creator ON absurd_ais(creator_dev_id);
CREATE INDEX idx_ais_votes ON absurd_ais(weighted_votes DESC);

-- ============================================================
-- TABLA: ai_votes
-- ============================================================

CREATE TABLE ai_votes (
    voter_dev_id        INTEGER NOT NULL REFERENCES devs(token_id),
    ai_id               INTEGER NOT NULL REFERENCES absurd_ais(id),
    weight              REAL NOT NULL DEFAULT 1.0,
    voted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (voter_dev_id, ai_id)
);

-- ============================================================
-- TABLA: actions (log de todo — particionada)
-- ============================================================

CREATE TABLE actions (
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

-- Particiones iniciales (crear más via cron)
CREATE TABLE actions_default PARTITION OF actions DEFAULT;

CREATE INDEX idx_actions_dev ON actions(dev_id, created_at DESC);
CREATE INDEX idx_actions_type ON actions(action_type, created_at DESC);
CREATE INDEX idx_actions_recent ON actions(created_at DESC);

-- ============================================================
-- TABLA: chat_messages (particionada)
-- ============================================================

CREATE TABLE chat_messages (
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

CREATE TABLE chat_messages_default PARTITION OF chat_messages DEFAULT;

CREATE INDEX idx_chat_channel ON chat_messages(channel, created_at DESC);
CREATE INDEX idx_chat_location ON chat_messages(location, created_at DESC);

-- ============================================================
-- TABLA: world_events
-- ============================================================

CREATE TABLE world_events (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(100) NOT NULL,
    description         TEXT,
    event_type          VARCHAR(30) NOT NULL,
    effects             JSONB NOT NULL DEFAULT '{}',
    starts_at           TIMESTAMPTZ NOT NULL,
    ends_at             TIMESTAMPTZ NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_events_active ON world_events(is_active, starts_at);

-- ============================================================
-- TABLA: shop_purchases
-- ============================================================

CREATE TABLE shop_purchases (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
    target_dev_id       INTEGER REFERENCES devs(token_id),
    item_type           VARCHAR(30) NOT NULL,
    item_effect         JSONB,
    nxt_cost            BIGINT NOT NULL,
    purchased_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: player_prompts
-- ============================================================

CREATE TABLE player_prompts (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL,
    dev_id              INTEGER NOT NULL REFERENCES devs(token_id),
    prompt_text         TEXT NOT NULL,
    consumed            BOOLEAN NOT NULL DEFAULT FALSE,
    consumed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompts_pending ON player_prompts(dev_id) WHERE consumed = FALSE;

-- ============================================================
-- TABLA: notifications
-- ============================================================

CREATE TABLE notifications (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL,
    type                VARCHAR(50) NOT NULL,
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    read                BOOLEAN NOT NULL DEFAULT FALSE,
    dev_id              INTEGER REFERENCES devs(token_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_player ON notifications(player_address, created_at DESC);
CREATE INDEX idx_notif_unread ON notifications(player_address) WHERE read = FALSE;

-- ============================================================
-- TABLA: world_chat (humanos)
-- ============================================================

CREATE TABLE world_chat (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL,
    display_name        VARCHAR(30),
    message             TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wchat_recent ON world_chat(created_at DESC);

-- ============================================================
-- TABLA: simulation_state (key-value global)
-- ============================================================

CREATE TABLE simulation_state (
    key                 VARCHAR(50) PRIMARY KEY,
    value               JSONB NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: claim_history
-- ============================================================

CREATE TABLE claim_history (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
    amount_gross        BIGINT NOT NULL,
    fee_amount          BIGINT NOT NULL,
    amount_net          BIGINT NOT NULL,
    tx_hash             VARCHAR(66),
    claimed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_player ON claim_history(player_address);

-- ============================================================
-- TABLA: balance_snapshots (daily wallet balance history)
-- ============================================================

CREATE TABLE balance_snapshots (
    id                  SERIAL PRIMARY KEY,
    wallet_address      VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
    balance_claimable   BIGINT NOT NULL DEFAULT 0,
    balance_claimed     BIGINT NOT NULL DEFAULT 0,
    balance_total_earned BIGINT NOT NULL DEFAULT 0,
    snapshot_date       DATE NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, snapshot_date)
);

CREATE INDEX idx_snapshots_wallet ON balance_snapshots(wallet_address, snapshot_date DESC);

-- ============================================================
-- SEED DATA: Estado inicial de la simulación
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
    ('endgame_triggered', 'false');

-- ============================================================
-- FUNCIONES ÚTILES
-- ============================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_devs_updated
    BEFORE UPDATE ON devs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_protocols_updated
    BEFORE UPDATE ON protocols
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Función para recalcular balance claimable de un player
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

-- Vista materializada: leaderboard (refresh cada 30 seg)
CREATE MATERIALIZED VIEW leaderboard AS
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

CREATE UNIQUE INDEX idx_leaderboard_token ON leaderboard(token_id);

-- Vista: protocol market
CREATE VIEW protocol_market AS
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

-- Vista: AI lab ranking
CREATE VIEW ai_lab AS
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

-- ============================================================
-- GRANT (para el app user)
-- ============================================================
-- CREATE ROLE nx_app LOGIN PASSWORD 'changeme';
-- GRANT USAGE ON SCHEMA nx TO nx_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA nx TO nx_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA nx TO nx_app;
