"""
NX TERMINAL — Shared dependencies (DB pool, Redis, broadcast)
"""

import os
import json
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import psycopg2
import psycopg2.pool
import psycopg2.extras
import redis.asyncio as aioredis

log = logging.getLogger("nx_api")

# ============================================================
# CONFIG
# ============================================================

DB_HOST = os.getenv("NX_DB_HOST", "localhost")
DB_PORT = int(os.getenv("NX_DB_PORT", "5432"))
DB_NAME = os.getenv("NX_DB_NAME", "nxterminal")
DB_USER = os.getenv("NX_DB_USER", "postgres")
DB_PASS = os.getenv("NX_DB_PASS", "postgres")
DB_SCHEMA = os.getenv("NX_DB_SCHEMA", "nx")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Use sslmode=require for external Render PostgreSQL connections
DB_SSLMODE = os.getenv("NX_DB_SSLMODE", "require")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# ============================================================
# CONNECTION POOL
# ============================================================

_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None
_redis: Optional[aioredis.Redis] = None


def init_db_pool(minconn: int = 2, maxconn: int = 10):
    global _pool
    try:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn, maxconn,
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
            user=DB_USER, password=DB_PASS,
            options=f"-c search_path={DB_SCHEMA}",
            sslmode=DB_SSLMODE,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        log.info(f"DB pool created ({minconn}-{maxconn} conns) [host={DB_HOST}]")
    except Exception as e:
        log.error(f"Failed to create DB pool: {e}")
        raise


def close_db_pool():
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None
        log.info("DB pool closed")


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


def get_redis() -> Optional[aioredis.Redis]:
    return _redis


# ============================================================
# DB CONTEXT MANAGER
# ============================================================

class DBConn:
    """Sync DB connection from pool, usable in FastAPI with run_in_executor."""
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
    """Get a DB connection from the pool."""
    return DBConn()


# ============================================================
# QUERY HELPERS
# ============================================================

def fetch_one(query: str, params=None) -> Optional[dict]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()


def fetch_all(query: str, params=None) -> list[dict]:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()


def execute(query: str, params=None):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)


# ============================================================
# WEBSOCKET BROADCAST
# ============================================================

# In-memory set of connected WS clients
ws_clients: set = set()


async def broadcast(event_type: str, data: dict):
    """Broadcast event to all connected WebSocket clients."""
    msg = json.dumps({"type": event_type, "data": data})

    # Also publish to Redis for multi-instance support
    r = get_redis()
    if r:
        try:
            await r.publish("nx:events", msg)
        except Exception:
            pass

    # Direct broadcast to local clients
    dead = set()
    for ws in ws_clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    ws_clients -= dead
