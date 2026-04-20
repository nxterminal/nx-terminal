"""Tests for the 'invalid' resolution path — refunds every bettor
their cost basis with no fees."""

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


ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
TREASURY_WALLET = ADMIN_WALLET
CREATOR = "0x" + "cc" * 20
USER_A = "0x" + "aa" * 20
USER_B = "0x" + "bb" * 20
USER_C = "0x" + "dd" * 20


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
        nxmarket_module.admin_router, prefix="/api/admin/nxmarket"
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


def _seed_market(*, market_type: str = "official", creator: str = ADMIN_WALLET,
                 creator_fee: Decimal = Decimal("0")) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_markets (
                    question, category, market_type, created_by,
                    creator_fee_percent, seed_nxt, shares_yes, shares_no,
                    liquidity_b, status, close_at
                ) VALUES (
                    'Q?', 'cat', %s, %s, %s, 500, 250, 250, 100,
                    'active', NOW() + INTERVAL '24 hours'
                ) RETURNING id
                """,
                (market_type, creator, creator_fee),
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


def _resolve(client, market_id: int, resolution: str,
             admin_wallet: str = ADMIN_WALLET):
    return client.post(
        f"/api/admin/nxmarket/markets/{market_id}/resolve",
        json={"resolution": resolution},
        headers={"X-Admin-Wallet": admin_wallet},
    )


def _ledger_sum(wallet: str, source: str) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(SUM(delta_nxt), 0) AS s FROM nxt_ledger "
                "WHERE LOWER(wallet_address) = %s AND source = %s",
                (wallet.lower(), source),
            )
            return int(cur.fetchone()["s"])


# ---------------------------------------------------------------------------


def test_resolve_invalid_refunds_all_bettors(client, clean_db):
    # Alice YES 100, Bob NO 50, Carol YES 30 + NO 30 (hedged).
    _seed_devs([
        (USER_A, 1000), (USER_B, 1000), (USER_C, 1000),
        (TREASURY_WALLET, 0), (CREATOR, 0),
    ])
    m = _seed_market(market_type="official")
    _seed_position(m, USER_A, "YES", shares=150, cost_basis=100)
    _seed_position(m, USER_B, "NO",  shares=80,  cost_basis=50)
    _seed_position(m, USER_C, "YES", shares=40,  cost_basis=30)
    _seed_position(m, USER_C, "NO",  shares=50,  cost_basis=30)

    pre_a, pre_b, pre_c = _balance(USER_A), _balance(USER_B), _balance(USER_C)

    r = _resolve(client, m, "invalid")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["resolution"] == "invalid"
    assert body["refunds_count"] == 3
    # Alice 100 + Bob 50 + Carol (30+30) = 210
    assert body["refunds_total_nxt"] == 210

    assert _balance(USER_A) - pre_a == 100
    assert _balance(USER_B) - pre_b == 50
    assert _balance(USER_C) - pre_c == 60

    # Market is now resolved as invalid.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, outcome, resolved_by FROM nxmarket_markets "
                "WHERE id = %s", (m,),
            )
            row = cur.fetchone()
    assert row["status"] == "resolved"
    assert row["outcome"] == "invalid"
    assert row["resolved_by"] == ADMIN_WALLET

    # Ledger rows recorded with the new source.
    assert _ledger_sum(USER_A, "nxmarket_refund") == 100
    assert _ledger_sum(USER_B, "nxmarket_refund") == 50
    assert _ledger_sum(USER_C, "nxmarket_refund") == 60


def test_resolve_invalid_no_treasury_fee(client, clean_db):
    _seed_devs([(USER_A, 1000), (TREASURY_WALLET, 0)])
    m = _seed_market(market_type="official")
    _seed_position(m, USER_A, "YES", shares=100, cost_basis=100)

    pre_treasury = _balance(TREASURY_WALLET)
    _resolve(client, m, "invalid")

    # Treasury got nothing, and no treasury_fee ledger row was created.
    assert _balance(TREASURY_WALLET) == pre_treasury
    assert _ledger_sum(TREASURY_WALLET, "nxmarket_treasury_fee") == 0


def test_resolve_invalid_no_creator_commission(client, clean_db):
    _seed_devs([(USER_A, 1000), (CREATOR, 500), (TREASURY_WALLET, 0)])
    m = _seed_market(
        market_type="user", creator=CREATOR, creator_fee=Decimal("5"),
    )
    _seed_position(m, USER_A, "YES", shares=100, cost_basis=200)

    pre_creator = _balance(CREATOR)
    _resolve(client, m, "invalid")

    # Creator received no commission.
    assert _balance(CREATOR) == pre_creator
    assert _ledger_sum(CREATOR, "nxmarket_commission") == 0


def test_resolve_invalid_rejects_already_resolved(client, clean_db):
    _seed_devs([(USER_A, 1000), (TREASURY_WALLET, 0)])
    m = _seed_market(market_type="official")
    _seed_position(m, USER_A, "YES", shares=100, cost_basis=100)

    # First resolve as YES succeeds.
    r1 = _resolve(client, m, "YES")
    assert r1.status_code == 200
    # Second attempt as invalid bounces.
    r2 = _resolve(client, m, "invalid")
    assert r2.status_code == 400
    assert "already resolved" in r2.json()["detail"].lower()
