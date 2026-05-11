"""
NX TERMINAL: PROTOCOL WARS — API Server
FastAPI + WebSocket + PostgreSQL
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.deps import init_db_pool, close_db_pool, get_db
from backend.api.middleware.correlation import CorrelationIdMiddleware
from backend.api.routes import simulation, devs, protocols, ais, leaderboard, prompts, chat, players, shop, notifications, academy, sentinel, missions, streaks, achievements, admin, health, nxmarket, nx_souls, user, posts, posts_feed, llm_usage
from backend.api.ws.feed import router as ws_router
from backend.db.migrate import run_auto_migrations

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("nx_api")


# ============================================================
# LIFESPAN — Startup / Shutdown
# ============================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 NX Terminal API starting...")
    init_db_pool(minconn=5, maxconn=50)
    # Phase 5.3.5 — schema source-of-truth lives in backend/db/migrate.py.
    # Same call point as before; the previous inline _run_auto_migrations
    # was extracted verbatim + the schema.sql bootstrap was folded in.
    run_auto_migrations()
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
