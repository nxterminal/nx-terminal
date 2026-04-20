"""Tests for NX Market auto-close lifecycle job."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest


BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.services.nxmarket_lifecycle import auto_close_expired_markets  # noqa: E402


ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
USER_A = "0x" + "aa" * 20


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TABLE admin_logs (
    id               BIGSERIAL PRIMARY KEY,
    correlation_id   UUID,
    event_type       TEXT NOT NULL,
    wallet_address   VARCHAR(42),
    dev_token_id     BIGINT,
    payload          JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nxmarket_markets (
    id                   BIGSERIAL PRIMARY KEY,
    question             TEXT NOT NULL,
    category             VARCHAR(40),
    market_type          VARCHAR(20) NOT NULL,
    created_by           VARCHAR(42) NOT NULL,
    creator_fee_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
    seed_nxt             NUMERIC(20,2) NOT NULL,
    shares_yes           NUMERIC(30,8) NOT NULL,
    shares_no            NUMERIC(30,8) NOT NULL,
    liquidity_b          NUMERIC(20,2) NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'active',
    outcome              VARCHAR(10),
    close_at             TIMESTAMPTZ NOT NULL,
    resolved_at          TIMESTAMPTZ,
    resolved_by          VARCHAR(42),
    total_volume_nxt     NUMERIC(20,2) NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def _raw_connect():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=int(os.environ["NX_DB_PORT"]),
        dbname=os.environ["NX_DB_NAME"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
    )


@pytest.fixture(scope="module")
def app():
    conn = _raw_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()
    deps.init_db_pool(minconn=1, maxconn=4)
    try:
        yield
    finally:
        deps.close_db_pool()


@pytest.fixture()
def clean_db(app):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE admin_logs, nxmarket_markets "
                "RESTART IDENTITY CASCADE"
            )


def _seed(status: str = "active", close_hours: int = -1,
          outcome: str = None) -> int:
    """Insert a market row with the given close_at offset (negative =
    past, positive = future) and optional outcome for resolved rows."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_markets (
                    question, category, market_type, created_by,
                    seed_nxt, shares_yes, shares_no, liquidity_b,
                    status, close_at, outcome
                ) VALUES (
                    'Q?', 'crypto', 'official', %s,
                    500, 250, 250, 100,
                    %s, NOW() + (%s || ' hours')::INTERVAL, %s
                ) RETURNING id
                """,
                (ADMIN_WALLET, status, str(close_hours), outcome),
            )
            r = cur.fetchone()
            return int(r["id"] if isinstance(r, dict) else r[0])


def _status(market_id: int) -> str:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            return cur.fetchone()["status"]


def _admin_logs(event_type: str):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT payload FROM admin_logs WHERE event_type = %s "
                "ORDER BY id",
                (event_type,),
            )
            return cur.fetchall()


# ---------------------------------------------------------------------------


def test_auto_close_marks_expired_markets_as_closed(clean_db):
    m = _seed(status="active", close_hours=-1)  # closed 1h ago
    closed = auto_close_expired_markets()
    assert closed == 1
    assert _status(m) == "closed"
    logs = _admin_logs("nxmarket_auto_closed")
    assert len(logs) == 1
    assert int(logs[0]["payload"]["market_id"]) == m


def test_auto_close_ignores_active_markets_not_yet_expired(clean_db):
    m = _seed(status="active", close_hours=24)  # closes tomorrow
    closed = auto_close_expired_markets()
    assert closed == 0
    assert _status(m) == "active"


def test_auto_close_ignores_already_resolved_markets(clean_db):
    m = _seed(status="resolved", close_hours=-48, outcome="YES")
    closed = auto_close_expired_markets()
    assert closed == 0
    assert _status(m) == "resolved"


def test_auto_close_is_idempotent(clean_db):
    m = _seed(status="active", close_hours=-2)
    first = auto_close_expired_markets()
    second = auto_close_expired_markets()
    assert first == 1
    assert second == 0
    assert _status(m) == "closed"
    # Only one admin_log entry (the first close).
    assert len(_admin_logs("nxmarket_auto_closed")) == 1
