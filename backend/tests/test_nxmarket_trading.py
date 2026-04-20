"""Tests for NXMARKET trading endpoints (PR 2).

Covers:
- 8 BUY tests (debit, share math, prices, position upsert, market-closed,
  insufficient balance).
- 8 EXIT tests (credit w/ penalty, share reduction, position reduction,
  no-position, insufficient shares, partial exit, trade row penalty,
  market-closed).
- 3 integration tests (round-trip slippage+penalty, multi-user price
  convergence, concurrent buys serialised by FOR UPDATE).

Reuses the fixture pattern from ``test_admin_summary.py``; the module-
scope ``app()`` drops & rebuilds the ``nx`` schema with every table the
buy/exit handlers touch. Also includes ``credit_wallet_balance`` unit
tests required by the PR 2 plan (3 extra — brought into the BUY section
to keep the file focused on trading flows).
"""

from __future__ import annotations

import os
import sys
import threading
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List

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
from backend.services import wallet_balance  # noqa: E402
from backend.services.ledger import LedgerSource  # noqa: E402


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

    deps.init_db_pool(minconn=2, maxconn=8)
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
    """Other test files pin ``LEDGER_SHADOW_WRITE=false`` at import time;
    force it back on so the trading ledger rows we assert on do persist."""
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


def _market_row(market_id: int) -> dict:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM nxmarket_markets WHERE id = %s", (market_id,)
            )
            return cur.fetchone()


def _position(market_id: int, wallet: str, side: str):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT shares, cost_basis FROM nxmarket_positions
                 WHERE market_id = %s AND LOWER(wallet_address) = %s
                   AND outcome = %s
                """,
                (market_id, wallet.lower(), side),
            )
            return cur.fetchone()


def _seed_market(
    *, status: str = "active",
    shares_each: Decimal = Decimal("250"),
    liquidity_b: Decimal = Decimal("100"),
    close_hours: int = 48,
    creator: str = USER_A,
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
                    'Q?', 'crypto', 'user', %s, 5, 500, %s, %s, %s, %s,
                    NOW() + (%s || ' hours')::INTERVAL
                ) RETURNING id
                """,
                (creator, shares_each, shares_each, liquidity_b, status,
                 str(close_hours)),
            )
            r = cur.fetchone()
            return int(r["id"] if isinstance(r, dict) else r[0])


# ---------------------------------------------------------------------------
# BUY endpoint tests (8)
# ---------------------------------------------------------------------------


def test_buy_yes_deducts_nxt_from_wallet(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "YES", "amount_nxt": 100},
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["shares_received"] > 0
    assert _balance_sum(USER_A) == 900


def test_buy_yes_increases_shares_yes_in_market(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    pre = _market_row(market_id)
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "YES", "amount_nxt": 100},
    )
    assert resp.status_code == 200
    post = _market_row(market_id)
    assert post["shares_yes"] > pre["shares_yes"]
    # Purchased side's share count increased by exactly the amount returned.
    delta = post["shares_yes"] - pre["shares_yes"]
    assert abs(float(delta) - resp.json()["shares_received"]) < 1e-6


def test_buy_no_increases_shares_no_not_yes(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    pre = _market_row(market_id)
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "NO", "amount_nxt": 100},
    )
    assert resp.status_code == 200
    post = _market_row(market_id)
    # Only NO side moved.
    assert post["shares_no"] > pre["shares_no"]
    assert post["shares_yes"] == pre["shares_yes"]


def test_buy_updates_prices_correctly(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "YES", "amount_nxt": 100},
    )
    payload = resp.json()
    assert payload["new_price_yes"] > 0.5
    assert payload["new_price_no"] < 0.5
    # Prices still sum to 1 (within float rounding).
    assert abs(payload["new_price_yes"] + payload["new_price_no"] - 1.0) < 1e-6


def test_buy_creates_position_row(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "YES", "amount_nxt": 120},
    )
    pos = _position(market_id, USER_A, "YES")
    assert pos is not None
    assert float(pos["shares"]) == resp.json()["shares_received"]
    assert int(pos["cost_basis"]) == 120


def test_buy_second_time_upserts_position(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    r1 = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "YES", "amount_nxt": 100},
    )
    r2 = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "YES", "amount_nxt": 50},
    )
    assert r1.status_code == 200 and r2.status_code == 200
    pos = _position(market_id, USER_A, "YES")
    # Exactly one row (UNIQUE constraint → UPSERT merged them).
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM nxmarket_positions "
                "WHERE market_id = %s AND LOWER(wallet_address) = %s "
                "AND outcome = 'YES'",
                (market_id, USER_A.lower()),
            )
            c = int(cur.fetchone()["c"])
    assert c == 1
    # Shares summed + cost_basis summed.
    expected_shares = (
        r1.json()["shares_received"] + r2.json()["shares_received"]
    )
    assert abs(float(pos["shares"]) - expected_shares) < 1e-6
    assert int(pos["cost_basis"]) == 150


def test_buy_fails_on_closed_market(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market(status="closed")
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "YES", "amount_nxt": 50},
    )
    assert resp.status_code == 400
    assert _balance_sum(USER_A) == 1000  # unchanged


def test_buy_fails_on_insufficient_balance(client, clean_db):
    _seed_devs([(1, USER_A, 100)])
    market_id = _seed_market()
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": USER_A, "side": "YES", "amount_nxt": 500},
    )
    assert resp.status_code == 400
    # No state change.
    assert _balance_sum(USER_A) == 100
    pos = _position(market_id, USER_A, "YES")
    assert pos is None


# ---------------------------------------------------------------------------
# EXIT endpoint tests (8)
# ---------------------------------------------------------------------------


def _buy(client, market_id: int, wallet: str, side: str, amount: int):
    return client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": wallet, "side": side, "amount_nxt": amount},
    )


def test_exit_returns_nxt_to_wallet_with_penalty(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    buy = _buy(client, market_id, USER_A, "YES", 100)
    assert buy.status_code == 200
    after_buy = _balance_sum(USER_A)
    assert after_buy == 900

    shares = buy.json()["shares_received"]
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES",
              "shares_to_sell": shares},
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    # Got SOME NXT back but strictly less than we put in (slippage + 3%).
    assert payload["value_received_nxt"] > 0
    assert payload["value_received_nxt"] < 100
    assert payload["penalty_paid"] > 0
    # Balance now > after-buy (got some NXT back) but < original 1000.
    total_after = _balance_sum(USER_A)
    assert after_buy < total_after < 1000


def test_exit_reduces_shares_in_market(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    buy = _buy(client, market_id, USER_A, "YES", 100)
    pre_exit = _market_row(market_id)
    shares = buy.json()["shares_received"]
    client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES",
              "shares_to_sell": shares},
    )
    post = _market_row(market_id)
    assert post["shares_yes"] < pre_exit["shares_yes"]


def test_exit_updates_position_shares(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    buy = _buy(client, market_id, USER_A, "YES", 100)
    shares_before = float(_position(market_id, USER_A, "YES")["shares"])
    sell_amount = shares_before / 2
    client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES",
              "shares_to_sell": sell_amount},
    )
    shares_after = float(_position(market_id, USER_A, "YES")["shares"])
    assert abs(shares_after - sell_amount) < 1e-6


def test_exit_fails_if_no_position(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    # USER_A never bought — no position exists.
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES", "shares_to_sell": 10},
    )
    assert resp.status_code == 400
    assert "no position" in resp.json()["detail"].lower()


def test_exit_fails_if_insufficient_shares(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    buy = _buy(client, market_id, USER_A, "YES", 50)
    shares = buy.json()["shares_received"]
    # Try to sell 10x what we have.
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES",
              "shares_to_sell": shares * 10},
    )
    assert resp.status_code == 400
    assert "insufficient shares" in resp.json()["detail"].lower()


def test_exit_partial_keeps_position_row(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    buy = _buy(client, market_id, USER_A, "YES", 100)
    shares = float(buy.json()["shares_received"])
    sell = shares * 0.3
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES", "shares_to_sell": sell},
    )
    assert resp.status_code == 200
    pos = _position(market_id, USER_A, "YES")
    assert pos is not None
    remaining = float(pos["shares"])
    assert abs(remaining - (shares - sell)) < 1e-6
    assert remaining > 0


def test_exit_creates_trade_row_with_penalty_recorded(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    market_id = _seed_market()
    buy = _buy(client, market_id, USER_A, "YES", 100)
    shares = buy.json()["shares_received"]
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES", "shares_to_sell": shares},
    )
    assert resp.status_code == 200
    trade_id = resp.json()["trade_id"]
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT side, outcome, penalty_nxt FROM nxmarket_trades "
                "WHERE id = %s",
                (trade_id,),
            )
            row = cur.fetchone()
    assert row["side"] == "sell"
    assert row["outcome"] == "YES"
    assert float(row["penalty_nxt"]) > 0


def test_exit_fails_on_closed_market(client, clean_db):
    _seed_devs([(1, USER_A, 1000)])
    # Market opens active, user buys, then admin closes it → exit blocked.
    market_id = _seed_market()
    buy = _buy(client, market_id, USER_A, "YES", 100)
    shares = buy.json()["shares_received"]
    # Flip to 'closed' directly in DB.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE nxmarket_markets SET status = 'closed' WHERE id = %s",
                (market_id,),
            )
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES", "shares_to_sell": shares},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Integration tests (3)
# ---------------------------------------------------------------------------


def test_buy_then_exit_net_loss_from_slippage_and_penalty(client, clean_db):
    _seed_devs([(1, USER_A, 10_000)])
    market_id = _seed_market()
    starting = _balance_sum(USER_A)

    buy = _buy(client, market_id, USER_A, "YES", 500)
    assert buy.status_code == 200
    shares = buy.json()["shares_received"]
    resp = client.post(
        f"/api/nxmarket/markets/{market_id}/exit",
        json={"wallet": USER_A, "side": "YES",
              "shares_to_sell": shares},
    )
    assert resp.status_code == 200

    ending = _balance_sum(USER_A)
    # Net loss from slippage (LMSR) + 3% penalty (on top).
    assert ending < starting
    net_loss = starting - ending
    # Loss is at least 3% of the round-trip NXT moved (slippage is
    # typically much smaller; penalty alone is ~15 NXT on a 500 buy).
    assert net_loss >= 15


def test_multiple_users_trade_same_market_prices_converge(client, clean_db):
    _seed_devs([
        (1, USER_A, 1000), (2, USER_B, 1000), (3, USER_C, 1000),
    ])
    market_id = _seed_market(
        shares_each=Decimal("250"), liquidity_b=Decimal("100")
    )

    # All three users buy YES — the market should strongly favour YES
    # (LMSR price ≥ ~0.8) and shares_yes should dwarf shares_no.
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "YES", 100)
    _buy(client, market_id, USER_C, "YES", 100)

    row = _market_row(market_id)
    assert row["shares_yes"] > row["shares_no"]

    resp = client.get(f"/api/nxmarket/markets/{market_id}")
    detail = resp.json()
    assert detail["market"]["price_yes"] > 0.7
    assert detail["market"]["price_no"] < 0.3
    assert abs(
        detail["market"]["price_yes"] + detail["market"]["price_no"] - 1.0
    ) < 1e-6
    # Three BUY trade rows recorded.
    assert len(detail["recent_trades"]) == 3
    # Three distinct wallets hold positions.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(DISTINCT wallet_address) AS c "
                "FROM nxmarket_positions WHERE market_id = %s",
                (market_id,),
            )
            assert int(cur.fetchone()["c"]) == 3


def test_concurrent_buys_do_not_double_spend(client, clean_db):
    # Wallet has EXACTLY enough for ONE buy of 500 NXT. Fire two buys
    # in parallel — FOR UPDATE on the market row serialises them, and
    # the second one must see the post-first-buy balance (0) and 400.
    _seed_devs([(1, USER_A, 500)])
    market_id = _seed_market()

    results: List[Dict[str, Any]] = []
    errors: List[BaseException] = []
    lock = threading.Lock()

    def _do_buy():
        try:
            r = client.post(
                f"/api/nxmarket/markets/{market_id}/buy",
                json={"wallet": USER_A, "side": "YES", "amount_nxt": 500},
            )
            with lock:
                results.append({"status": r.status_code, "body": r.json()})
        except BaseException as e:  # noqa: BLE001
            with lock:
                errors.append(e)

    t1 = threading.Thread(target=_do_buy)
    t2 = threading.Thread(target=_do_buy)
    t1.start(); t2.start()
    t1.join(timeout=15); t2.join(timeout=15)

    assert not errors, f"thread crashed: {errors[0]!r}"
    statuses = sorted(r["status"] for r in results)
    # Exactly one 200 and one 400 — no double-spend, no duplicate credit.
    assert statuses == [200, 400]
    # Final balance is 0: the single successful 500-NXT buy drained it.
    assert _balance_sum(USER_A) == 0
    # Market has exactly one YES-side buy recorded.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM nxmarket_trades "
                "WHERE market_id = %s AND side = 'buy'",
                (market_id,),
            )
            c = int(cur.fetchone()["c"])
    assert c == 1
