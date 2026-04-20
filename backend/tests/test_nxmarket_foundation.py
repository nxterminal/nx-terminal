"""Tests for the NXMARKET foundation (PR 1).

Covers:
- LMSR pricing + cost/value math (pure functions, 5 tests).
- Greedy wallet-level debit across devs (4 tests).
- POST create official / user market (4 tests).
- GET list / detail endpoints (3 tests).
- Validation: liquidity_b clamp + close_at lead time (3 tests).

Mirrors the fixture pattern used by ``test_admin_summary.py``.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict

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
from backend.services import lmsr  # noqa: E402
from backend.services import wallet_balance  # noqa: E402
from backend.services.ledger import LedgerSource  # noqa: E402


ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
USER_WALLET = "0x" + "11" * 20
OTHER_WALLET = "0x" + "22" * 20


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
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nxmarket_price_history (
    id                BIGSERIAL PRIMARY KEY,
    market_id         BIGINT NOT NULL REFERENCES nxmarket_markets(id) ON DELETE CASCADE,
    price_yes         NUMERIC(10,6) NOT NULL,
    price_no          NUMERIC(10,6) NOT NULL,
    total_volume_nxt  NUMERIC(20,2) NOT NULL DEFAULT 0,
    snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    fastapi_app.include_router(
        nxmarket_module.admin_router, prefix="/api/admin/nxmarket"
    )

    try:
        yield fastapi_app
    finally:
        deps.close_db_pool()


@pytest.fixture(autouse=True)
def _force_shadow_write_on(monkeypatch):
    """Other test files (test_fix_c_antiorphan, test_orphan_scanner_disambig)
    set ``LEDGER_SHADOW_WRITE=false`` at import time and never restore it.
    NXMARKET's debit helper relies on the shadow write to emit the
    ``nxmarket_creation_fee`` rows we assert on — force it back to on."""
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
                "nxmarket_price_history, nxmarket_trades, "
                "nxmarket_positions, nxmarket_markets "
                "RESTART IDENTITY CASCADE"
            )


def _seed_devs(rows):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for tid, owner, bal in rows:
                cur.execute(
                    "INSERT INTO devs (token_id, owner_address, balance_nxt) "
                    "VALUES (%s, %s, %s)",
                    (tid, owner, bal),
                )


def _future(hours: int = 48) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


# ---------------------------------------------------------------------------
# LMSR unit tests
# ---------------------------------------------------------------------------


def test_lmsr_initial_prices_equal_50_50():
    prices = lmsr.calculate_price(Decimal(0), Decimal(0), Decimal(100))
    assert prices["price_yes"] == Decimal("0.5")
    assert prices["price_no"] == Decimal("0.5")


def test_lmsr_price_moves_when_buying_yes():
    result = lmsr.calculate_cost_to_buy(
        Decimal(0), Decimal(0), Decimal(100), "YES", Decimal(50)
    )
    new_prices = lmsr.calculate_price(
        result["new_shares_yes"], result["new_shares_no"], Decimal(100)
    )
    assert new_prices["price_yes"] > Decimal("0.5")
    assert new_prices["price_no"] < Decimal("0.5")
    # And the purchased-side average price should beat the starting
    # marginal price (slippage makes it strictly > 0.5).
    assert result["average_price"] > Decimal("0.5")


def test_lmsr_price_moves_proportional_to_b():
    small_b = lmsr.calculate_cost_to_buy(
        Decimal(0), Decimal(0), Decimal(100), "YES", Decimal(50)
    )
    large_b = lmsr.calculate_cost_to_buy(
        Decimal(0), Decimal(0), Decimal(1000), "YES", Decimal(50)
    )
    p_small = lmsr.calculate_price(
        small_b["new_shares_yes"], small_b["new_shares_no"], Decimal(100)
    )["price_yes"]
    p_large = lmsr.calculate_price(
        large_b["new_shares_yes"], large_b["new_shares_no"], Decimal(1000)
    )["price_yes"]
    # Deeper pool (larger b) = less price impact for the same NXT spend.
    assert (p_small - Decimal("0.5")) > (p_large - Decimal("0.5"))


def test_lmsr_logsumexp_handles_large_amounts():
    # b=100, spend 100_000 NXT — naive exp(q/b) would overflow.
    result = lmsr.calculate_cost_to_buy(
        Decimal(0), Decimal(0), Decimal(100), "YES", Decimal(100_000)
    )
    assert result["shares_received"] > Decimal(0)
    # And prices stay in range.
    prices = lmsr.calculate_price(
        result["new_shares_yes"], result["new_shares_no"], Decimal(100)
    )
    assert Decimal(0) <= prices["price_yes"] <= Decimal(1)


def test_lmsr_sell_returns_less_than_cost_due_to_slippage():
    buy_amount = Decimal(100)
    buy = lmsr.calculate_cost_to_buy(
        Decimal(250), Decimal(250), Decimal(100), "YES", buy_amount
    )
    sell = lmsr.calculate_value_to_sell(
        buy["new_shares_yes"], buy["new_shares_no"], Decimal(100),
        "YES", buy["shares_received"],
    )
    assert sell["value_after_penalty"] < buy_amount
    assert sell["penalty_nxt"] > Decimal(0)


# ---------------------------------------------------------------------------
# Greedy wallet-level debit tests
# ---------------------------------------------------------------------------


def _debit(wallet, amount, ref_id=1):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            result = wallet_balance.debit_wallet_balance(
                cur,
                wallet_address=wallet,
                amount_nxt=amount,
                ledger_source=LedgerSource.NXMARKET_CREATION_FEE,
                ref_table="nxmarket_markets",
                ref_id=ref_id,
            )
            return result


def _balance_sum(wallet: str) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(SUM(balance_nxt), 0) AS s FROM devs "
                "WHERE LOWER(owner_address) = %s",
                (wallet.lower(),),
            )
            r = cur.fetchone()
            return int(r["s"] if isinstance(r, dict) else r[0])


def _ledger_rows(wallet: str, source: str):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT dev_token_id, delta_nxt FROM nxt_ledger "
                "WHERE LOWER(wallet_address) = %s AND source = %s "
                "ORDER BY id",
                (wallet.lower(), source),
            )
            return cur.fetchall()


def test_debit_single_dev_with_sufficient_balance(clean_db):
    _seed_devs([(1, USER_WALLET, 1000)])
    debited = _debit(USER_WALLET, 300, ref_id=42)
    assert debited == [{"dev_token_id": 1, "amount": 300}]
    assert _balance_sum(USER_WALLET) == 700
    rows = _ledger_rows(USER_WALLET, "nxmarket_creation_fee")
    assert len(rows) == 1
    r = rows[0]
    assert int(r["dev_token_id"]) == 1
    assert int(r["delta_nxt"]) == -300


def test_debit_spreads_across_multiple_devs(clean_db):
    # Devs with balances {100, 250, 400}; debit 500 drains the 400-row
    # first (desc order), then 100 from the 250-row.
    _seed_devs([(1, USER_WALLET, 100), (2, USER_WALLET, 250), (3, USER_WALLET, 400)])
    debited = _debit(USER_WALLET, 500, ref_id=7)
    assert debited == [
        {"dev_token_id": 3, "amount": 400},
        {"dev_token_id": 2, "amount": 100},
    ]
    assert _balance_sum(USER_WALLET) == 750 - 500
    rows = _ledger_rows(USER_WALLET, "nxmarket_creation_fee")
    assert [(int(r["dev_token_id"]), int(r["delta_nxt"])) for r in rows] == [
        (3, -400),
        (2, -100),
    ]


def test_debit_fails_on_insufficient_total_balance(clean_db):
    _seed_devs([(1, USER_WALLET, 100), (2, USER_WALLET, 150)])
    with pytest.raises(wallet_balance.InsufficientBalanceError):
        _debit(USER_WALLET, 500)
    # Nothing persisted.
    assert _balance_sum(USER_WALLET) == 250
    assert _ledger_rows(USER_WALLET, "nxmarket_creation_fee") == []


def test_debit_preserves_zero_balance_devs_untouched(clean_db):
    # Two zero-balance devs and one with plenty — debit must not UPDATE
    # the zero ones (the WHERE clause filters balance_nxt > 0).
    _seed_devs(
        [(1, USER_WALLET, 0), (2, USER_WALLET, 1000), (3, USER_WALLET, 0)]
    )
    debited = _debit(USER_WALLET, 250, ref_id=9)
    assert debited == [{"dev_token_id": 2, "amount": 250}]
    # Zero-balance rows must remain at 0 (no negative balance).
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT token_id, balance_nxt FROM devs "
                "WHERE LOWER(owner_address) = %s ORDER BY token_id",
                (USER_WALLET.lower(),),
            )
            rows = cur.fetchall()
    balances = {int(r["token_id"]): int(r["balance_nxt"]) for r in rows}
    assert balances == {1: 0, 2: 750, 3: 0}


# ---------------------------------------------------------------------------
# POST creation endpoints
# ---------------------------------------------------------------------------


def _market_row(market_id: int) -> dict:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM nxmarket_markets WHERE id = %s", (market_id,)
            )
            return cur.fetchone()


def test_create_official_market_requires_admin(client, clean_db):
    # Missing header.
    resp = client.post(
        "/api/admin/nxmarket/markets",
        json={
            "question": "Will it rain tomorrow?",
            "close_at": _future(),
            "liquidity_b": 100,
            "seed_nxt": 1000,
        },
    )
    assert resp.status_code == 403
    # Non-admin wallet.
    resp = client.post(
        "/api/admin/nxmarket/markets",
        json={
            "question": "Will it rain tomorrow?",
            "close_at": _future(),
            "liquidity_b": 100,
            "seed_nxt": 1000,
        },
        headers={"X-Admin-Wallet": "0x" + "ab" * 20},
    )
    assert resp.status_code == 403


def test_create_official_market_auto_mints_seed_no_debit(client, clean_db):
    # Seed the admin with some devs — we assert their balances are
    # untouched (the official seed is auto-minted into the AMM pool).
    _seed_devs([(1, ADMIN_WALLET, 999_000)])
    pre_balance = _balance_sum(ADMIN_WALLET)
    resp = client.post(
        "/api/admin/nxmarket/markets",
        json={
            "question": "Will Bitcoin pass 200k USD in 2026?",
            "category": "crypto",
            "close_at": _future(),
            "liquidity_b": 100,
            "seed_nxt": 5000,
        },
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    market_id = payload["market_id"]
    assert payload["status"] == "active"

    row = _market_row(market_id)
    assert row["market_type"] == "official"
    assert row["creator_fee_percent"] == Decimal("0")
    assert row["seed_nxt"] == Decimal("5000")
    # Symmetric pool → 0.5/0.5 start.
    assert row["shares_yes"] == row["shares_no"]
    assert row["shares_yes"] == Decimal("2500")
    assert row["liquidity_b"] == Decimal("100")

    # Admin balance unchanged — no debit.
    assert _balance_sum(ADMIN_WALLET) == pre_balance

    # Initial price snapshot exists.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT price_yes, price_no FROM nxmarket_price_history "
                "WHERE market_id = %s",
                (market_id,),
            )
            snap = cur.fetchone()
    assert snap["price_yes"] == Decimal("0.5")
    assert snap["price_no"] == Decimal("0.5")


def test_create_user_market_debits_500_nxt_from_wallet(client, clean_db):
    _seed_devs([(10, USER_WALLET, 300), (11, USER_WALLET, 400)])
    pre_total = _balance_sum(USER_WALLET)
    assert pre_total == 700

    resp = client.post(
        "/api/nxmarket/markets",
        json={
            "wallet": USER_WALLET,
            "question": "Will the team ship on time?",
            "category": "meta",
            "close_at": _future(),
            "liquidity_b": 100,
        },
    )
    assert resp.status_code == 200, resp.text
    market_id = resp.json()["market_id"]

    row = _market_row(market_id)
    assert row["market_type"] == "user"
    assert row["created_by"] == USER_WALLET
    assert row["creator_fee_percent"] == Decimal("5")
    assert row["seed_nxt"] == Decimal("500")
    assert row["shares_yes"] == row["shares_no"] == Decimal("250")

    # Exactly 500 NXT drained from the wallet's devs.
    assert _balance_sum(USER_WALLET) == pre_total - 500

    # Ledger shows the debit, tagged with the correct source.
    rows = _ledger_rows(USER_WALLET, "nxmarket_creation_fee")
    assert len(rows) >= 1
    total_delta = sum(int(r["delta_nxt"]) for r in rows)
    assert total_delta == -500


def test_create_user_market_fails_if_insufficient_balance(client, clean_db):
    _seed_devs([(20, USER_WALLET, 400)])
    resp = client.post(
        "/api/nxmarket/markets",
        json={
            "wallet": USER_WALLET,
            "question": "Will the team ship on time?",
            "close_at": _future(),
            "liquidity_b": 100,
        },
    )
    assert resp.status_code == 400
    # No market row was created.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM nxmarket_markets")
            r = cur.fetchone()
    assert int(r["c"] if isinstance(r, dict) else r[0]) == 0
    # No ledger row either.
    assert _ledger_rows(USER_WALLET, "nxmarket_creation_fee") == []
    # Balance unchanged.
    assert _balance_sum(USER_WALLET) == 400


# ---------------------------------------------------------------------------
# GET list / detail endpoints
# ---------------------------------------------------------------------------


def _insert_market(
    *, market_type: str, status: str = "active", category: str = "crypto",
    shares_yes: Decimal = Decimal("250"),
    shares_no: Decimal = Decimal("250"),
    liquidity_b: Decimal = Decimal("100"),
    creator: str = USER_WALLET,
) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_markets (
                    question, category, market_type, created_by,
                    creator_fee_percent, seed_nxt, shares_yes, shares_no,
                    liquidity_b, status, close_at
                ) VALUES (
                    'Q?', %s, %s, %s, 0, 500, %s, %s, %s, %s,
                    NOW() + INTERVAL '48 hours'
                ) RETURNING id
                """,
                (category, market_type, creator, shares_yes, shares_no,
                 liquidity_b, status),
            )
            r = cur.fetchone()
            return int(r["id"] if isinstance(r, dict) else r[0])


def test_list_markets_filtered_by_status_and_type(client, clean_db):
    # Seed a mix: 2 official (1 active, 1 closed), 2 user (1 active, 1 resolved).
    m_off_active = _insert_market(market_type="official", status="active")
    _insert_market(market_type="official", status="closed")
    m_user_active = _insert_market(market_type="user", status="active")
    _insert_market(market_type="user", status="resolved")

    resp = client.get(
        "/api/nxmarket/markets?status=active&market_type=official"
    )
    assert resp.status_code == 200
    ids = [m["id"] for m in resp.json()["markets"]]
    assert ids == [m_off_active]

    resp = client.get("/api/nxmarket/markets?status=active")
    ids = sorted(m["id"] for m in resp.json()["markets"])
    assert ids == sorted([m_off_active, m_user_active])

    resp = client.get("/api/nxmarket/markets?market_type=user")
    assert len(resp.json()["markets"]) == 2


def test_get_market_detail_includes_trades_and_price_history(client, clean_db):
    market_id = _insert_market(market_type="user", status="active")
    # Insert 3 trades and 2 price history snapshots.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for i in range(3):
                cur.execute(
                    """
                    INSERT INTO nxmarket_trades
                      (market_id, wallet_address, side, outcome,
                       shares, nxt_amount, price)
                    VALUES (%s, %s, 'buy', 'YES', %s, %s, %s)
                    """,
                    (market_id, USER_WALLET, 10 * (i + 1),
                     5 * (i + 1), Decimal("0.52")),
                )
            cur.execute(
                """
                INSERT INTO nxmarket_price_history
                  (market_id, price_yes, price_no, snapshot_at)
                VALUES (%s, 0.5, 0.5, NOW() - INTERVAL '2 hours')
                """,
                (market_id,),
            )
            cur.execute(
                """
                INSERT INTO nxmarket_price_history
                  (market_id, price_yes, price_no, snapshot_at)
                VALUES (%s, 0.55, 0.45, NOW() - INTERVAL '30 minutes')
                """,
                (market_id,),
            )
            # Also a row > 24h old that MUST NOT appear.
            cur.execute(
                """
                INSERT INTO nxmarket_price_history
                  (market_id, price_yes, price_no, snapshot_at)
                VALUES (%s, 0.4, 0.6, NOW() - INTERVAL '48 hours')
                """,
                (market_id,),
            )

    resp = client.get(f"/api/nxmarket/markets/{market_id}")
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["market"]["id"] == market_id
    assert len(payload["recent_trades"]) == 3
    # Price history limited to last 24h — so the 48h-old row is dropped.
    assert len(payload["price_history"]) == 2


def test_list_markets_returns_current_lmsr_prices(client, clean_db):
    # Asymmetric pool → prices no longer 0.5/0.5.
    market_id = _insert_market(
        market_type="official",
        shares_yes=Decimal("400"), shares_no=Decimal("100"),
        liquidity_b=Decimal("100"),
    )
    resp = client.get("/api/nxmarket/markets")
    assert resp.status_code == 200
    markets = resp.json()["markets"]
    assert len(markets) == 1
    m = markets[0]
    assert m["id"] == market_id

    expected = lmsr.calculate_price(
        Decimal("400"), Decimal("100"), Decimal("100")
    )
    assert abs(m["price_yes"] - float(expected["price_yes"])) < 1e-6
    assert abs(m["price_no"] - float(expected["price_no"])) < 1e-6
    assert m["price_yes"] > 0.5  # YES-heavy pool


# ---------------------------------------------------------------------------
# Validation — shared limits on liquidity_b and close_at lead time
# ---------------------------------------------------------------------------


def _market_count() -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM nxmarket_markets")
            r = cur.fetchone()
    return int(r["c"] if isinstance(r, dict) else r[0])


def test_create_market_rejects_liquidity_b_below_10(client, clean_db):
    resp = client.post(
        "/api/admin/nxmarket/markets",
        json={
            "question": "Will it rain?",
            "close_at": _future(),
            "liquidity_b": 9,
            "seed_nxt": 1000,
        },
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    assert resp.status_code == 400
    assert "liquidity_b" in resp.json()["detail"]
    assert _market_count() == 0


def test_create_market_rejects_liquidity_b_above_10000(client, clean_db):
    _seed_devs([(1, USER_WALLET, 1000)])
    resp = client.post(
        "/api/nxmarket/markets",
        json={
            "wallet": USER_WALLET,
            "question": "Will it rain?",
            "close_at": _future(),
            "liquidity_b": 10001,
        },
    )
    assert resp.status_code == 400
    assert "liquidity_b" in resp.json()["detail"]
    assert _market_count() == 0


def test_create_market_rejects_close_at_too_soon(client, clean_db):
    soon = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    resp = client.post(
        "/api/admin/nxmarket/markets",
        json={
            "question": "Too soon?",
            "close_at": soon,
            "liquidity_b": 100,
            "seed_nxt": 1000,
        },
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    assert resp.status_code == 400
    assert "close_at" in resp.json()["detail"]
    assert _market_count() == 0
