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
from backend.api.routes import simulation, devs, protocols, ais, leaderboard, prompts, chat, players, shop, notifications, academy, sentinel, missions, streaks, achievements
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
                        last_claim_date DATE,
                        total_claimed_nxt BIGINT NOT NULL DEFAULT 0
                    )
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
                # Seed MEGA TESTER PROGRAM event (permanent, won't be rotated)
                cur.execute("""
                    INSERT INTO world_events (title, description, event_type, effects, starts_at, ends_at, is_active)
                    SELECT 'MEGA TESTER PROGRAM',
                           'NX Terminal is currently running a testing phase. Regular operations continue as normal.',
                           'weekly',
                           '{"salary_multiplier": 1.25, "hack_cost_multiplier": 0.7, "mission_reward_multiplier": 1.25}'::jsonb,
                           NOW(), '2099-12-31'::timestamptz, TRUE
                    WHERE NOT EXISTS (SELECT 1 FROM world_events WHERE title = 'MEGA TESTER PROGRAM')
                """)
                cur.execute("""
                    UPDATE world_events SET description = 'NX Terminal is currently running a testing phase. Regular operations continue as normal.'
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
                ]
                for _w, _n in _VIP_TESTERS:
                    cur.execute("INSERT INTO vip_testers (wallet_address, name) VALUES (%s, %s) ON CONFLICT DO NOTHING", (_w, _n))
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 NX Terminal API starting...")
    init_db_pool(minconn=5, maxconn=50)
    _run_auto_migrations()
    await init_redis()
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
    if path in ("/health", "/ws/feed") or path.startswith("/metadata/"):
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "nx-terminal-api"}


@app.get("/")
async def root():
    return {
        "name": "NX Terminal: Protocol Wars",
        "version": "1.0.0",
        "docs": "/docs",
        "ws": "/ws/feed",
    }
