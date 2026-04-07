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
from backend.api.routes import simulation, devs, protocols, ais, leaderboard, prompts, chat, players, shop, notifications, academy, sentinel, missions
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
                # Ensure action_enum has all required values
                cur.execute("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HACK_MAINFRAME'
                                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
                        THEN ALTER TYPE action_enum ADD VALUE 'HACK_MAINFRAME'; END IF;
                    END $$;
                """)
            conn.commit()
        log.info("✅ Auto-migrations complete")
    except Exception as e:
        log.warning(f"⚠️ Auto-migration warning: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 NX Terminal API starting...")
    init_db_pool(minconn=2, maxconn=20)
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
