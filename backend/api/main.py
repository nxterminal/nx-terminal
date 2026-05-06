"""
NX TERMINAL: PROTOCOL WARS — API Server
FastAPI + WebSocket + PostgreSQL
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.deps import init_db_pool, close_db_pool, init_redis, close_redis, get_db
from backend.api.middleware.correlation import CorrelationIdMiddleware
from backend.api.routes import simulation, devs, protocols, ais, leaderboard, prompts, chat, players, shop, notifications, academy, sentinel, missions, streaks, achievements, admin, health, nxmarket, nx_souls, user, posts, posts_feed, llm_usage
from backend.api.ws.feed import router as ws_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("nx_api")


# ============================================================
# LIFESPAN — Startup / Shutdown
# ============================================================

def _run_auto_migrations():
    """Ensure new columns/enums exist. Safe to run on every startup (IF NOT EXISTS)."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
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
                # Backfill anchors at 12:00 UTC on the recorded date — a fair
                # midpoint that neither hands a near-instant re-claim (00:00
                # anchor) nor punishes the user for the next ~24h (23:59
                # anchor). Only affects the first claim post-deploy; after
                # that, all timestamps are real and the 24h cooldown is
                # strict.
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
                # Ensure location_enum has all values the engine might use
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GitHub HQ'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'location_enum'))
                        THEN ALTER TYPE location_enum ADD VALUE 'GitHub HQ'; END IF;
                    END $$;
                """)
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
                # pending_fund_txs — fallback queue for /shop/fund when the RPC
                # node has not yet indexed a freshly-sent receipt. Resolved by
                # engine worker process_pending_funds() every ~5 min.
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
                # Backoff column: NULL = eligible immediately,
                # > NOW() = still in backoff, <= NOW() = retry.
                cur.execute(
                    "ALTER TABLE pending_fund_txs "
                    "ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ"
                )
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_pending_funds_next_retry
                        ON pending_fund_txs(next_retry_at)
                        WHERE resolved = false
                """)
                # chat_messages enrichment for the Live Feed redesign —
                # chat_type drives the UI badge, social_gain the "+N social" note.
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
                # Seed OFFICIAL LAUNCH event (permanent, won't be rotated)
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
                # Admin-reply fields (PR #310): source of truth is
                # backend/db/migration_tickets_reply.sql.
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
                # admin_logs — append-only audit trail of economic events.
                # Source of truth: backend/db/migration_admin_logs.sql
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
                # claim_history — on-chain verification columns + unique
                # tx_hash guard. Source of truth:
                # backend/db/migration_claim_history_status.sql
                cur.execute("ALTER TABLE claim_history ADD COLUMN IF NOT EXISTS tx_block BIGINT")
                cur.execute("ALTER TABLE claim_history ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed'")
                cur.execute("UPDATE claim_history SET status = 'confirmed' WHERE status IS NULL")
                cur.execute("""
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_history_tx_hash_unique
                        ON claim_history(tx_hash)
                        WHERE tx_hash IS NOT NULL AND tx_hash <> ''
                """)
                # devs — 2-phase commit sync status. Source of truth:
                # backend/db/migration_devs_sync_status.sql
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS sync_status TEXT")
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS sync_tx_hash VARCHAR(66)")
                cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ")
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_devs_sync_status
                        ON devs(sync_status, sync_started_at)
                        WHERE sync_status IS NOT NULL
                """)
                # nxt_ledger — append-only economic ledger (Fase 3A).
                # Source of truth: backend/db/migration_nxt_ledger.sql
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
                # NXMARKET — prediction market foundation (PR 1 of Fase NXMARKET).
                # Source of truth for table shapes lives with this block; buy/sell
                # (PR 2) and admin resolve (PR 3) will reuse them as-is.
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
                # PR 2 — penalty paid on exits (3% LMSR slippage surcharge).
                # Default 0 so buy rows (and any pre-PR-2 rows) stay valid.
                cur.execute(
                    "ALTER TABLE nxmarket_trades "
                    "ADD COLUMN IF NOT EXISTS penalty_nxt NUMERIC(20,2) NOT NULL DEFAULT 0"
                )
                # PR 3 — admin who resolved the market (audit trail). Nullable
                # until a market is resolved.
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
                # PR C1 — comments system. Flat comments (no threads),
                # soft delete (owner or admin), like/dislike voting.
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
                # Soft-delete dev activity spam — rows stay for forensics but
                # are hidden from all SELECT queries (deleted_at IS NULL filter).
                cur.execute("""
                    UPDATE notifications SET deleted_at = NOW()
                    WHERE type IN ('protocol_created', 'ai_created')
                    AND deleted_at IS NULL
                """)
                # ── Phase 2.2: canonical-traits migration ──────────────────
                # See backend/db/migration_phase22_canonical.sql for the
                # canonical reference. CHECK constraints on nx.devs are
                # *intentionally* not added here — they are applied by
                # backend/scripts/align_existing_devs.py after the alignment
                # step clears the legacy values (Mentor, Troll, Copy Paste,
                # Grinder, Steady, Balanced).
                # NX-PHASE-2.2 Step A: drop legacy column.
                cur.execute("ALTER TABLE devs DROP COLUMN IF EXISTS devs_burned")
                # NX-PHASE-2.2 Step B: add 'exhausted' to dev_status_enum.
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'exhausted'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dev_status_enum'))
                        THEN ALTER TYPE dev_status_enum ADD VALUE 'exhausted'; END IF;
                    END $$;
                """)
                # NX-PHASE-2.2 Step C: dev_canonical_traits table.
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
                # ── NX Souls Phase 1: chat infrastructure ─────────────
                # Quota counters land in Phase 2 (this table is created
                # now so the message-cache logger can join against it).
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
                # Sleep state — populated by Phase 2 when quota or
                # provider cascade triggers a sleep transition.
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
                # Metadata-only message log. NEVER store message text;
                # only lengths, provider used, and timing for monitoring
                # and abuse detection. Entries older than 24h are
                # cleaned up by an engine job (Phase 4).
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
                # ── NX Souls Phase 3.5.1: full-content message store ──
                # Different from `nx_souls_messages_cache` (lengths-only
                # observability log from Phase 1). This table stores the
                # actual message text + role + flags so the chat UI can
                # restore conversation history on re-open. 24h sliding-
                # window TTL via `expires_at`; the chat endpoint resets
                # it on every send so an active conversation never
                # vanishes mid-session.
                #
                # Indexes deviate from the brief: the brief asked for
                # partial indexes with `WHERE expires_at > NOW()` /
                # `WHERE expires_at <= NOW()`, but Postgres rejects
                # NOW() in partial-index predicates (must be IMMUTABLE).
                # A plain (expires_at) index serves both the lazy
                # `expires_at > NOW()` filter on reads and the
                # `expires_at <= NOW()` filter on cleanup operations.
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
                # Compound index covers chat-history reads (filter by
                # wallet + token, order by created_at DESC) and the
                # active-chats CTE (PARTITION BY token_id ORDER BY
                # created_at DESC).
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS "
                    "idx_nx_souls_messages_wallet_token_time "
                    "ON nx_souls_messages "
                    "(wallet_address, token_id, created_at DESC)"
                )
                # Single-column index on expires_at — drives both the
                # `expires_at > NOW()` lazy filter at read-time and
                # the `expires_at <= NOW()` cleanup scan.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS "
                    "idx_nx_souls_messages_expires_at "
                    "ON nx_souls_messages (expires_at)"
                )
                # ── Sprkls Phase 4.1: nx_posts table ──────────────────
                # Shared table for Sprkls (auto-generated by the
                # services/sprkls scheduler) and future NX POST manual
                # posts. `source` discriminates; the scheduler only
                # inserts source='sprkl'. Partial-index predicates
                # cannot use NOW() (must be IMMUTABLE), so the indexes
                # below are plain — same lesson as
                # nx_souls_messages_expires_at above. Postgres can
                # still use them efficiently with WHERE expires_at >
                # NOW() filters at query time.
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
                # User-feed lookup: per-wallet most-recent first.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_wallet_time "
                    "ON nx_posts (wallet_address, created_at DESC)"
                )
                # Public timeline: ORDER BY created_at DESC. Plain
                # index serves the WHERE is_public = true AND
                # expires_at > NOW() filter at query time.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_created_desc "
                    "ON nx_posts (created_at DESC)"
                )
                # Cleanup scan: expires_at <= NOW() - 24h.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_expires_at "
                    "ON nx_posts (expires_at)"
                )
                # Dev-profile feed (Phase 5).
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_token_time "
                    "ON nx_posts (token_id, created_at DESC)"
                )
                # Pending-toast lookup for the SprklsLayer (Phase
                # 4.2): per wallet, most-recent sprkls that haven't
                # been dismissed. Partial predicate uses only
                # IMMUTABLE columns (source = 'sprkl' is constant)
                # so this one IS allowed as a partial index.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_pending_sprkls "
                    "ON nx_posts (wallet_address, created_at DESC) "
                    "WHERE source = 'sprkl' AND dismissed_at IS NULL"
                )

                # ── NX POST Phase 5.1: feed-post extensions ───────────
                # Adds the columns needed to render Twitter-style
                # threaded posts (parent_post_id), denormalised counts
                # (like_count / reply_count, kept in sync by triggers
                # below), text-derived metadata (hashtags / mentions /
                # tickers, populated by the generator at insert time),
                # and a richer visibility enum than the legacy boolean
                # is_public — which we keep for backwards compat.
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
                # Allow source='feed' alongside the existing
                # 'sprkl'/'manual'. The CHECK constraint was created
                # without an explicit name, so Postgres named it
                # nx_posts_source_check (table_col_check convention).
                # Drop + re-add so the new value is accepted; guard
                # with a DO block so re-running is idempotent.
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
                # Reply-tree lookup: SELECT … WHERE parent_post_id = X.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_parent "
                    "ON nx_posts (parent_post_id) "
                    "WHERE parent_post_id IS NOT NULL"
                )
                # Hashtag aggregation for the trending endpoint —
                # GIN index on the array enables fast ANY/UNNEST.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS idx_nx_posts_hashtags "
                    "ON nx_posts USING GIN (hashtags)"
                )
                # Public timeline filter: visibility='public' ORDER BY
                # created_at DESC. Composite index pre-orders rows for
                # the common case.
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS "
                    "idx_nx_posts_visibility_created "
                    "ON nx_posts (visibility, created_at DESC)"
                )

                # nx_post_likes — one row per (post, user). UNIQUE
                # makes the like endpoint idempotent (INSERT … ON
                # CONFLICT DO NOTHING) and enforces the "one like per
                # user per post" rule at the DB level. Lowercased-
                # address index supports user-side queries (has-liked
                # checks across a timeline page).
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

                # Count-sync triggers. CREATE OR REPLACE on the
                # function + DROP-then-CREATE on the trigger makes
                # this idempotent across deploys without us having to
                # version-tag the migration. Each trigger fires AFTER
                # the row change so the counter increment / decrement
                # sees the post row in its post-mutation state.
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
                # Reply-count trigger fires on nx_posts itself when a
                # row with parent_post_id is inserted / deleted. The
                # GREATEST guard prevents the counter from going
                # negative if a parent is somehow decremented twice.
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

                # ── Phase 5.1.1: LLM cost tracking table ─────────────
                # Defense-in-depth on top of Anthropic's hard spend
                # cap. Each successful LLM call increments the row
                # for (date, service, model); the engine + API check
                # this table before making the next call and fall
                # through to template fallback if the daily USD
                # ceiling is hit. Free-tier providers (Groq /
                # Cerebras / Gemini) are tracked at $0 cost so the
                # admin endpoint surfaces total call volume across
                # the whole cascade, not just paid calls.
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
                # Backfill: insert welcome notification for existing players who
                # don't have one yet, using their real registration timestamp.
                cur.execute("SELECT 1 FROM system_broadcasts WHERE id = 'welcome_backfill'")
                if not cur.fetchone():
                    cur.execute("CREATE TABLE IF NOT EXISTS system_broadcasts (id VARCHAR(50) PRIMARY KEY, sent_at TIMESTAMPTZ DEFAULT NOW())")
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
                    # Check if notifications actually exist (flag may be stale from rolled-back attempt)
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
                            pass  # skip individual insert failures
                    cur.execute("INSERT INTO system_broadcasts (id) VALUES ('dev_camp_launch')")
                    log.info(f"✅ Broadcast 'dev_camp_launch' sent to {_bcast_count} players")
                else:
                    log.info("ℹ️ Broadcast 'dev_camp_launch' already sent")
    except Exception as e:
        log.warning(f"⚠️ Broadcast warning: {e}")

    # Fund reconciliation notice — targeted to the two testers whose
    # /shop/fund calls orphaned before the retry loop was deployed. Runs
    # once; the flag in system_broadcasts gates re-delivery. Mirrors the
    # dev_camp_launch broadcast structure (stale-flag reset included).
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
                    # Stale-flag detection: if the two notices aren't actually
                    # in the notifications table, reset the flag and re-run.
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
                        "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n"
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
                        "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n"
                        "\u2014 NX Terminal Finance Department\n"
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 NX Terminal API starting...")
    init_db_pool(minconn=5, maxconn=50)
    _run_auto_migrations()
    await init_redis()
    # Surface NX Souls provider availability once at startup so the
    # operator immediately sees which keys (if any) are missing.
    try:
        from backend.services.nx_souls.llm_router import log_router_status
        log_router_status()
    except Exception as e:  # pragma: no cover — never crash startup
        log.warning(f"NX Souls router status check skipped: {e}")
    log.info("✅ NX Terminal API ready")
    yield
    log.info("🛑 NX Terminal API shutting down...")
    close_db_pool()
    await close_redis()


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="NX Terminal: Protocol Wars",
    description="API for the NX Terminal simulation game",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Global per-IP rate limit middleware ──────────────────
from backend.api.rate_limit import global_ip_limiter  # noqa: E402

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip health check and WebSocket
    path = request.url.path
    if path in ("/health", "/health/shallow", "/ws/feed") or path.startswith("/metadata/"):
        return await call_next(request)
    client_ip = request.client.host if request.client else "unknown"
    if not global_ip_limiter.check(client_ip):
        return JSONResponse(status_code=429, content={"detail": "Rate limited. Try again shortly."})
    return await call_next(request)


# CORS — allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://nxterminal.onrender.com",
        "https://nx-terminal.onrender.com",
        "https://nx-frontend-5cbf.onrender.com",
        "https://nxterminal.xyz",
        "https://www.nxterminal.xyz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Correlation ID — added last so it sits outermost and every inner
# middleware / handler log picks up the id via ContextVar.
app.add_middleware(CorrelationIdMiddleware)


# ============================================================
# GLOBAL EXCEPTION HANDLER — ensure CORS headers on all errors
# ============================================================

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ============================================================
# ROUTES
# ============================================================

app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(devs.router, prefix="/api/devs", tags=["Devs"])
app.include_router(protocols.router, prefix="/api/protocols", tags=["Protocols"])
app.include_router(ais.router, prefix="/api/ais", tags=["AIs"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard"])
app.include_router(prompts.router, prefix="/api/prompts", tags=["Prompts"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(shop.router, prefix="/api/shop", tags=["Shop"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(academy.router, prefix="/api/academy", tags=["Academy"])
app.include_router(sentinel.router, prefix="/api/sentinel", tags=["Sentinel"])
app.include_router(missions.router, prefix="/api/missions", tags=["Missions"])
app.include_router(streaks.router, prefix="/api/streak", tags=["Streak"])
app.include_router(achievements.router, prefix="/api/achievements", tags=["Achievements"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(nxmarket.router, prefix="/api/nxmarket", tags=["NXMARKET"])
app.include_router(nx_souls.router, prefix="/api/devs", tags=["NX-Souls"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(posts.router, prefix="/api/posts", tags=["NX-POST"])
# Phase 5.1 — engagement + discovery endpoints (likes, trending,
# feed-stats, who-to-follow, single-post detail). Registered AFTER
# posts.router so the literal routes there (/timeline, /user, /dev)
# match before /{post_id:int} on overlapping prefixes; the int
# converter on the dynamic path additionally prevents accidental
# capture of /trending or /feed-stats.
app.include_router(posts_feed.router, prefix="/api/posts", tags=["NX-POST"])
# Phase 5.1.1 — LLM cost tracking admin endpoints. Read-only; sees
# call counts + estimated cost per service. No auth gate in MVP.
app.include_router(llm_usage.router, prefix="/api/admin/llm-usage", tags=["Admin"])
app.include_router(nxmarket.admin_router, prefix="/api/admin/nxmarket", tags=["NXMARKET-Admin"])
app.include_router(health.router, tags=["Health"])
app.include_router(ws_router, tags=["WebSocket"])

# ── NFT Metadata (tokenURI) — baseURI + tokenId ──
@app.get("/metadata/{token_id}")
async def nft_metadata(token_id: int):
    from backend.api.routes.devs import get_dev_metadata
    return await get_dev_metadata(token_id)

# ── Claim Sync Status (alias for /api/simulation/claim-sync-status) ──
@app.get("/api/claim-sync/status")
async def claim_sync_status():
    from backend.api.routes.simulation import get_claim_sync_status
    return await get_claim_sync_status()

@app.post("/api/claim-sync/force")
async def claim_sync_force(request: Request):
    from backend.api.routes.simulation import force_claim_sync
    return await force_claim_sync(request)

# ============================================================
# HEALTH
# ============================================================

# ── TEMPORARY: one-shot broadcast endpoint (DELETE AFTER USE) ──
@app.get("/api/admin/send-devcamp-broadcast")
async def admin_send_devcamp():
    """One-shot: send Dev Camp notification to all players who don't have it yet."""
    from backend.api.deps import get_db
    with get_db() as conn:
        with conn.cursor() as cur:
            body = (
                "DEV CAMP IS NOW OPEN\n\n"
                "A new training facility has been deployed to your desktop. "
                "All developers are now eligible for enrollment.\n\n"
                "CLASSES (8h, 15 $NXT): +4 permanent stat boost\n"
                "INTENSIVE COURSES (2h, 40 $NXT): +2 permanent stat boost\n\n"
                "Skills: Hacking, Coding, Trading, Social, Endurance\n\n"
                "Open Dev Camp from your desktop to get started. "
                "Trained devs qualify for harder missions with bigger rewards.\n\n"
                "— NX Terminal Training Division"
            )
            cur.execute("""
                INSERT INTO notifications (player_address, type, title, body)
                SELECT DISTINCT p.wallet_address, 'broadcast', 'New Program: Dev Camp', %s
                FROM players p
                WHERE NOT EXISTS (
                    SELECT 1 FROM notifications n
                    WHERE n.player_address = p.wallet_address AND n.title = 'New Program: Dev Camp'
                )
            """, (body,))
            sent = cur.rowcount
            cur.execute("CREATE TABLE IF NOT EXISTS system_broadcasts (id VARCHAR(50) PRIMARY KEY, sent_at TIMESTAMPTZ DEFAULT NOW())")
            cur.execute("INSERT INTO system_broadcasts (id) VALUES ('dev_camp_launch') ON CONFLICT DO NOTHING")
    return {"sent": sent, "message": f"Dev Camp broadcast sent to {sent} players"}


@app.get("/")
async def root():
    return {
        "name": "NX Terminal: Protocol Wars",
        "version": "1.0.0",
        "docs": "/docs",
        "ws": "/ws/feed",
    }
