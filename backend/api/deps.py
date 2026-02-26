"""
NX TERMINAL — Shared dependencies (DB pool, Redis, broadcast)
"""

import os
import re
import json
import logging
from urllib.parse import urlparse
from typing import Optional

import psycopg2
import psycopg2.pool
import psycopg2.extras
import redis.asyncio as aioredis

log = logging.getLogger("nx_api")

# ============================================================
# CONFIG
# ============================================================

DB_SCHEMA = os.getenv("NX_DB_SCHEMA", "nx")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Parse DATABASE_URL if provided (Render sets this)
DATABASE_URL = os.getenv("DATABASE_URL", "")

if DATABASE_URL:
    _parsed = urlparse(DATABASE_URL)
    DB_HOST = _parsed.hostname
    DB_PORT = _parsed.port or 5432
    DB_NAME = _parsed.path.lstrip("/")
    DB_USER = _parsed.username
    DB_PASS = _parsed.password
else:
    DB_HOST = os.getenv("NX_DB_HOST", "localhost")
    DB_PORT = int(os.getenv("NX_DB_PORT", "5432"))
    DB_NAME = os.getenv("NX_DB_NAME", "nxterminal")
    DB_USER = os.getenv("NX_DB_USER", "postgres")
    DB_PASS = os.getenv("NX_DB_PASS", "postgres")

# Detect if we need SSL (external Render connections need it)
# Internal hostnames look like: dpg-xxxxx-a
# External hostnames look like: dpg-xxxxx-a.ohio-postgres.render.com
_is_external = DB_HOST and "render.com" in DB_HOST
DB_SSLMODE = "require" if _is_external else "prefer"

log.info(f"DB config: host={DB_HOST} port={DB_PORT} db={DB_NAME} ssl={DB_SSLMODE}")

# ============================================================
# CONNECTION POOL
# ============================================================

_pool = None
_redis = None


def init_db_pool(minconn=2, maxconn=10):
    global _pool
    log.info(f"Connecting to DB: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME} (ssl={DB_SSLMODE})")
    try:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn, maxconn,
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            sslmode=DB_SSLMODE,
            options=f"-c search_path={DB_SCHEMA}",
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        log.info(f"DB pool created OK ({minconn}-{maxconn} conns)")
    except Exception as e:
        log.error(f"DB pool FAILED: {e}")
        raise


def close_db_pool():
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None


async def init_redis():
    global _redis
    try:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        await _redis.ping()
        log.info("Redis connected")
    except Exception as e:
        log.warning(f"Redis not available ({e}), running without cache")
        _redis = None


async def close_redis():
    global _redis
    if _redis:
        await _redis.close()
        _redis = None


def get_redis():
    return _redis


# ============================================================
# DB CONTEXT MANAGER
# ============================================================

class DBConn:
    def __init__(self):
        self.conn = None

    def __enter__(self):
        if not _pool:
            raise RuntimeError("DB pool not initialized")
        self.conn = _pool.getconn()
        self.conn.autocommit = False
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            if exc_type:
                self.conn.rollback()
            else:
                self.conn.commit()
            _pool.putconn(self.conn)
            self.conn = None


def get_db():
    return DBConn()


# ============================================================
# QUERY HELPERS
# ============================================================

def fetch_one(query, params=None):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()


def fetch_all(query, params=None):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()


def execute(query, params=None):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)


# ============================================================
# WEBSOCKET BROADCAST
# ============================================================

ws_clients = set()


# ============================================================
# WALLET VALIDATION
# ============================================================

_WALLET_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def validate_wallet(addr: str) -> str:
    """Validate Ethereum address format and return lowercased. Raises HTTPException on bad input."""
    from fastapi import HTTPException
    if not addr or not _WALLET_RE.match(addr):
        raise HTTPException(400, "Invalid wallet address format (expected 0x + 40 hex chars)")
    return addr.lower()


async def broadcast(event_type, data):
    msg = json.dumps({"type": event_type, "data": data})
    r = get_redis()
    if r:
        try:
            await r.publish("nx:events", msg)
        except Exception:
            pass
    dead = set()
    for ws in ws_clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    ws_clients -= dead
