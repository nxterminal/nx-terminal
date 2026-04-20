"""Tests for NX Market timeout auto-resolution + admin pending endpoint.

4 auto-timeout cases:
- Markets closed >30d are resolved as 'invalid' (refunds applied)
- Recently-closed markets are left alone
- Already-resolved markets are left alone
- Empty-pool markets pass through without errors

3 pending-endpoint cases:
- Returns only status='closed' rows where outcome IS NULL
- YES/NO volume and bettor breakdowns are correct
- Requires admin auth (403 otherwise)
"""

from __future__ import annotations

import os
import sys
from decimal import Decimal
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


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
from backend.api.middleware.correlation import CorrelationIdMiddleware  # noqa: E402
from backend.api.routes import nxmarket as nxmarket_module  # noqa: E402
from backend.services.nxmarket_lifecycle import (  # noqa: E402
    AUTO_TIMEOUT_SENTINEL,
    auto_timeout_invalid_markets,
)


ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
USER_A = "0x" + "aa" * 20
USER_B = "0x" + "bb" * 20
USER_C = "0x" + "cc" * 20


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TABLE devs (
    token_id        INTEGER PRIMARY KEY,
    owner_address   VARCHAR(42) NOT NULL,
    balance_nxt     BIGINT NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE nxt_ledger (
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
);

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
    resolved_by          VARCHAR(42),
    total_volume_nxt     NUMERIC(20,2) NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nxmarket_positions (
    id              BIGSERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES nxmarket_markets(id) ON DELETE CASCADE,
    wallet_address  VARCHAR(42) NOT NULL,
    outcome         VARCHAR(10) NOT NULL CHECK (outcome IN ('YES', 'NO')),
    shares          NUMERIC(30,8) NOT NULL DEFAULT 0,
    cost_basis      NUMERIC(20,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (market_id, wallet_address, outcome)
);

CREATE TABLE nxmarket_trades (
    id              BIGSERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES nxmarket_markets(id) ON DELETE CASCADE,
    wallet_address  VARCHAR(42) NOT NULL,
    side            VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    outcome         VARCHAR(10) NOT NULL CHECK (outcome IN ('YES', 'NO')),
    shares          NUMERIC(30,8) NOT NULL,
    nxt_amount      NUMERIC(20,2) NOT NULL,
    price           NUMERIC(10,6) NOT NULL,
    penalty_nxt     NUMERIC(20,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    fastapi_app = FastAPI()
    fastapi_app.add_middleware(CorrelationIdMiddleware)
    fastapi_app.include_router(
        nxmarket_module.router, prefix="/api/nxmarket"
    )
    try:
        yield fastapi_app
    finally:
        deps.close_db_pool()


@pytest.fixture(autouse=True)
def _shadow_on(monkeypatch):
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "true")


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def clean_db(app):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE devs, nxt_ledger, admin_logs, "
                "nxmarket_trades, nxmarket_positions, nxmarket_markets "
                "RESTART IDENTITY CASCADE"
            )


def _seed_devs(rows):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            tid = 1
            for owner, bal in rows:
                cur.execute(
                    "INSERT INTO devs (token_id, owner_address, balance_nxt) "
                    "VALUES (%s, %s, %s)",
                    (tid, owner, bal),
                )
                tid += 1


def _balance(wallet: str) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(SUM(balance_nxt), 0) AS s FROM devs "
                "WHERE LOWER(owner_address) = %s",
                (wallet.lower(),),
            )
            return int(cur.fetchone()["s"])


def _seed_market(*, status: str = "closed", close_days_ago: int = 31,
                 market_type: str = "official", outcome=None) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_markets (
                    question, category, market_type, created_by,
                    seed_nxt, shares_yes, shares_no, liquidity_b,
                    status, close_at, outcome, resolved_at
                ) VALUES (
                    'Q?', 'crypto', %s, %s,
                    500, 250, 250, 100,
                    %s,
                    NOW() - (%s || ' days')::INTERVAL,
                    %s,
                    CASE WHEN %s IS NULL THEN NULL ELSE NOW() END
                ) RETURNING id
                """,
                (market_type, ADMIN_WALLET, status,
                 str(close_days_ago), outcome, outcome),
            )
            r = cur.fetchone()
            return int(r["id"] if isinstance(r, dict) else r[0])


def _seed_position(market_id: int, wallet: str, side: str,
                   shares: float, cost_basis: int):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_positions
                  (market_id, wallet_address, outcome, shares, cost_basis)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (market_id, wallet, side, shares, cost_basis),
            )


def _seed_trade(market_id: int, wallet: str, side: str, outcome: str,
                nxt_amount: int, shares: float = 1.0):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_trades
                  (market_id, wallet_address, side, outcome, shares,
                   nxt_amount, price)
                VALUES (%s, %s, %s, %s, %s, %s, 0.5)
                """,
                (market_id, wallet, side, outcome, shares, nxt_amount),
            )


def _status_outcome(mid: int) -> tuple:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, outcome, resolved_by FROM nxmarket_markets "
                "WHERE id = %s", (mid,),
            )
            r = cur.fetchone()
            return (r["status"], r["outcome"], r["resolved_by"])


# ---------------------------------------------------------------------------
# Auto-timeout (4)
# ---------------------------------------------------------------------------


def test_auto_timeout_resolves_markets_closed_over_30_days(clean_db):
    _seed_devs([(USER_A, 1000), (USER_B, 1000)])
    m = _seed_market(close_days_ago=31)
    _seed_position(m, USER_A, "YES", shares=100, cost_basis=60)
    _seed_position(m, USER_B, "NO",  shares=50,  cost_basis=40)

    pre_a, pre_b = _balance(USER_A), _balance(USER_B)
    n = auto_timeout_invalid_markets()
    assert n == 1

    status, outcome, resolved_by = _status_outcome(m)
    assert status == "resolved"
    assert outcome == "invalid"
    assert resolved_by == AUTO_TIMEOUT_SENTINEL

    # Refunds credited.
    assert _balance(USER_A) - pre_a == 60
    assert _balance(USER_B) - pre_b == 40

    # admin_log has the timeout event.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT payload FROM admin_logs "
                "WHERE event_type = 'nxmarket_auto_timeout'",
            )
            rows = cur.fetchall()
    assert len(rows) == 1
    assert int(rows[0]["payload"]["market_id"]) == m
    assert rows[0]["payload"]["timeout_days"] == 30


def test_auto_timeout_ignores_recently_closed(clean_db):
    _seed_devs([(USER_A, 1000)])
    m = _seed_market(close_days_ago=5)
    _seed_position(m, USER_A, "YES", shares=100, cost_basis=100)

    n = auto_timeout_invalid_markets()
    assert n == 0
    status, outcome, _ = _status_outcome(m)
    assert status == "closed"
    assert outcome is None


def test_auto_timeout_ignores_already_resolved(clean_db):
    _seed_devs([(USER_A, 1000)])
    m = _seed_market(close_days_ago=40, status="resolved", outcome="YES")

    n = auto_timeout_invalid_markets()
    assert n == 0
    status, outcome, _ = _status_outcome(m)
    assert status == "resolved"
    assert outcome == "YES"


def test_auto_timeout_handles_empty_pool(clean_db):
    # No positions → no refunds, but the market still transitions.
    m = _seed_market(close_days_ago=31)
    n = auto_timeout_invalid_markets()
    assert n == 1
    status, outcome, _ = _status_outcome(m)
    assert status == "resolved"
    assert outcome == "invalid"


# ---------------------------------------------------------------------------
# Pending endpoint (3)
# ---------------------------------------------------------------------------


def _get_pending(client, admin_wallet: str = ADMIN_WALLET):
    return client.get(
        "/api/nxmarket/markets/pending",
        headers={"X-Admin-Wallet": admin_wallet},
    )


def test_pending_endpoint_returns_closed_unresolved_markets(client, clean_db):
    m_closed = _seed_market(close_days_ago=5, status="closed")
    _seed_market(close_days_ago=40, status="resolved", outcome="YES")
    _seed_market(close_days_ago=-5, status="active")  # still open (future)

    r = _get_pending(client)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_pending"] == 1
    assert len(body["markets"]) == 1
    assert body["markets"][0]["id"] == m_closed
    assert body["markets"][0]["closed_since_days"] == 5
    assert body["markets"][0]["days_until_timeout"] == 25


def test_pending_endpoint_returns_breakdown_by_side(client, clean_db):
    m = _seed_market(close_days_ago=3, status="closed")
    # 3 wallets buy YES (total 600), 2 buy NO (total 300)
    _seed_trade(m, USER_A, "buy", "YES", 200)
    _seed_trade(m, USER_B, "buy", "YES", 150)
    _seed_trade(m, USER_C, "buy", "YES", 250)
    _seed_trade(m, USER_A, "buy", "NO",  100)  # USER_A hedged
    _seed_trade(m, USER_B, "buy", "NO",  200)

    body = _get_pending(client).json()
    entry = body["markets"][0]
    assert entry["pool_total"] == 900
    assert entry["yes_volume"] == 600
    assert entry["no_volume"] == 300
    # USER_A appears on both sides → bettors_count counts DISTINCT wallets.
    assert entry["bettors_count"] == 3
    assert entry["yes_bettors"] == 3
    assert entry["no_bettors"] == 2


def test_pending_endpoint_requires_admin(client, clean_db):
    _seed_market(close_days_ago=3, status="closed")

    # Non-admin wallet.
    r = client.get(
        "/api/nxmarket/markets/pending",
        headers={"X-Admin-Wallet": USER_A},
    )
    assert r.status_code == 403

    # Missing header.
    r2 = client.get("/api/nxmarket/markets/pending")
    assert r2.status_code == 403
