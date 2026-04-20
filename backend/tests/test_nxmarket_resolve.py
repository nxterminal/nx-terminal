"""Tests for NXMARKET admin resolve + payout distribution (PR 3).

Covers:
- 7 happy path: proportional payout, creator commission, ledger rows,
  treasury fee, resolved-state markers, admin_log, idempotency.
- 6 edge cases: no winners, empty market, hedged positions, auth,
  invalid resolution, already resolved.
- 3 atomicity: rollback on winner-credit failure, concurrent resolve
  serialised by FOR UPDATE, full reconciliation of pool = treasury +
  commission + payouts + dust.

Mirrors the fixture pattern from ``test_nxmarket_trading.py``.
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


ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
TREASURY_WALLET = ADMIN_WALLET  # same wallet in the nxmarket module
CREATOR = "0x" + "cc" * 20
USER_A = "0x" + "aa" * 20
USER_B = "0x" + "bb" * 20
USER_C = "0x" + "dd" * 20
USER_D = "0x" + "ee" * 20
USER_E = "0x" + "ff" * 20


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


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------


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
            r = cur.fetchone()
            return int(r["s"] if isinstance(r, dict) else r[0])


def _seed_market(
    *, market_type: str = "official", creator: str = CREATOR,
    creator_fee: Decimal = Decimal("0"),
    shares_each: Decimal = Decimal("250"),
    liquidity_b: Decimal = Decimal("100"),
    status: str = "active",
    close_hours: int = 48,
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
                    'Q?', 'cat', %s, %s, %s, 500, %s, %s, %s, %s,
                    NOW() + (%s || ' hours')::INTERVAL
                ) RETURNING id
                """,
                (market_type, creator, creator_fee, shares_each, shares_each,
                 liquidity_b, status, str(close_hours)),
            )
            r = cur.fetchone()
            return int(r["id"] if isinstance(r, dict) else r[0])


def _buy(client, market_id: int, wallet: str, side: str, amount: int):
    return client.post(
        f"/api/nxmarket/markets/{market_id}/buy",
        json={"wallet": wallet, "side": side, "amount_nxt": amount},
    )


def _resolve(client, market_id: int, resolution: str,
             admin_wallet: str = ADMIN_WALLET):
    return client.post(
        f"/api/admin/nxmarket/markets/{market_id}/resolve",
        json={"resolution": resolution},
        headers={"X-Admin-Wallet": admin_wallet},
    )


def _ledger_rows(wallet: str, source: str):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT dev_token_id, delta_nxt FROM nxt_ledger "
                "WHERE LOWER(wallet_address) = %s AND source = %s",
                (wallet.lower(), source),
            )
            return cur.fetchall()


# ---------------------------------------------------------------------------
# Happy path (7)
# ---------------------------------------------------------------------------


def test_resolve_official_market_pays_winners_proportional(client, clean_db):
    # Each user has 10_000 NXT so buys always succeed.
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (USER_C, 10_000),
                (USER_D, 10_000), (USER_E, 10_000),
                (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")

    # 3 YES buys: 100, 200, 300. 2 NO buys: 50, 150. Net buy pool = 800.
    # (Losers pay into the pool; winners extract.)
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "YES", 200)
    _buy(client, market_id, USER_C, "YES", 300)
    _buy(client, market_id, USER_D, "NO", 50)
    _buy(client, market_id, USER_E, "NO", 150)

    resp = _resolve(client, market_id, "YES")
    assert resp.status_code == 200, resp.text
    out = resp.json()

    assert out["pool_total"] == 800
    assert out["treasury_fee"] == 24  # 3% of 800
    assert out["creator_commission"] == 0  # official market
    assert out["distributable"] == 776
    assert out["winners_count"] == 3
    # Paid to winners = distributable - dust; dust <= 2 NXT for 3 winners.
    assert out["paid_to_winners"] + out["dust"] == 776
    # Winners got paid (each balance > 10_000 - amount_spent).
    # USER_A received floor(776 * shares_A / total_shares_YES).


def test_resolve_user_market_pays_creator_commission(client, clean_db):
    _seed_devs([(CREATOR, 500), (USER_A, 10_000), (USER_B, 10_000),
                (TREASURY_WALLET, 0)])
    market_id = _seed_market(
        market_type="user", creator=CREATOR, creator_fee=Decimal("5")
    )
    pre_creator = _balance(CREATOR)

    # Users bet. Pool_total = 300.
    _buy(client, market_id, USER_A, "YES", 200)
    _buy(client, market_id, USER_B, "NO", 100)

    resp = _resolve(client, market_id, "YES")
    assert resp.status_code == 200
    out = resp.json()

    assert out["pool_total"] == 300
    assert out["treasury_fee"] == 9    # 3%
    assert out["creator_commission"] == 15  # 5%
    assert out["distributable"] == 276

    post_creator = _balance(CREATOR)
    assert post_creator - pre_creator == 15
    # Ledger row tagged with commission source.
    rows = _ledger_rows(CREATOR, "nxmarket_commission")
    assert sum(int(r["delta_nxt"]) for r in rows) == 15


def test_resolve_winners_paid_via_credit_wallet_balance(client, clean_db):
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "NO", 100)

    _resolve(client, market_id, "YES")
    payouts = _ledger_rows(USER_A, "nxmarket_payout")
    assert len(payouts) >= 1
    assert sum(int(r["delta_nxt"]) for r in payouts) > 0
    # USER_B was a loser — should NOT have any nxmarket_payout row.
    assert _ledger_rows(USER_B, "nxmarket_payout") == []


def test_resolve_treasury_receives_fee(client, clean_db):
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 500)
    _buy(client, market_id, USER_B, "NO", 500)
    pre_treasury = _balance(TREASURY_WALLET)

    resp = _resolve(client, market_id, "YES")
    out = resp.json()

    post_treasury = _balance(TREASURY_WALLET)
    # treasury receives treasury_fee + dust.
    assert post_treasury - pre_treasury == out["treasury_total"]
    assert out["treasury_total"] >= out["treasury_fee"]


def test_resolve_marks_market_resolved(client, clean_db):
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "NO", 100)
    _resolve(client, market_id, "YES")

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, outcome, resolved_at, resolved_by "
                "FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            row = cur.fetchone()
    assert row["status"] == "resolved"
    assert row["outcome"] == "YES"
    assert row["resolved_at"] is not None
    assert row["resolved_by"] == ADMIN_WALLET


def test_resolve_creates_admin_log_event(client, clean_db):
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "NO", 100)
    _resolve(client, market_id, "YES")

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT event_type, wallet_address, payload "
                "FROM admin_logs WHERE event_type = 'nxmarket_resolved'",
            )
            row = cur.fetchone()
    assert row is not None
    assert row["wallet_address"] == ADMIN_WALLET
    payload = row["payload"]
    assert payload["market_id"] == market_id
    assert payload["resolution"] == "YES"
    # Key accounting fields all present.
    for k in ("pool_total", "treasury_fee", "distributable",
              "winners_count", "paid_to_winners", "dust"):
        assert k in payload


def test_resolve_idempotent_via_status(client, clean_db):
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "NO", 100)
    first = _resolve(client, market_id, "YES")
    assert first.status_code == 200

    second = _resolve(client, market_id, "YES")
    assert second.status_code == 400
    assert "already resolved" in second.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Edge cases (6)
# ---------------------------------------------------------------------------


def test_resolve_with_no_winners_all_to_treasury(client, clean_db):
    # Official market, everyone bets NO, resolution is YES. No winners.
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "NO", 200)
    _buy(client, market_id, USER_B, "NO", 300)

    pre_treasury = _balance(TREASURY_WALLET)
    resp = _resolve(client, market_id, "YES")
    out = resp.json()

    assert out["winners_count"] == 0
    assert out["paid_to_winners"] == 0
    # Full pool (no commission on official) swept to treasury.
    post_treasury = _balance(TREASURY_WALLET)
    assert post_treasury - pre_treasury == out["pool_total"]
    # Losers got no payout.
    assert _ledger_rows(USER_A, "nxmarket_payout") == []
    assert _ledger_rows(USER_B, "nxmarket_payout") == []


def test_resolve_empty_market_no_payouts(client, clean_db):
    # Market exists but no buys. pool_total = 0.
    _seed_devs([(TREASURY_WALLET, 0), (CREATOR, 0)])
    market_id = _seed_market(market_type="official")

    resp = _resolve(client, market_id, "YES")
    assert resp.status_code == 200
    out = resp.json()
    assert out["pool_total"] == 0
    assert out["treasury_fee"] == 0
    assert out["treasury_total"] == 0
    assert out["paid_to_winners"] == 0
    assert out["winners_count"] == 0

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            assert cur.fetchone()["status"] == "resolved"


def test_resolve_user_with_positions_both_sides_only_gets_winner_payout(
    client, clean_db
):
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    # USER_A hedges both sides.
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_A, "NO", 100)
    _buy(client, market_id, USER_B, "NO", 100)

    pre_a = _balance(USER_A)
    _resolve(client, market_id, "YES")
    # USER_A paid for the YES side only; his NO position is worth 0.
    payouts = _ledger_rows(USER_A, "nxmarket_payout")
    assert len(payouts) == 1
    payout_total = sum(int(r["delta_nxt"]) for r in payouts)
    assert payout_total > 0
    post_a = _balance(USER_A)
    assert post_a - pre_a == payout_total


def test_resolve_requires_admin_wallet(client, clean_db):
    _seed_devs([(USER_A, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 100)

    # Missing header.
    r1 = client.post(
        f"/api/admin/nxmarket/markets/{market_id}/resolve",
        json={"resolution": "YES"},
    )
    assert r1.status_code == 403
    # Non-admin wallet.
    r2 = _resolve(client, market_id, "YES", admin_wallet=USER_A)
    assert r2.status_code == 403
    # Market is still active.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            assert cur.fetchone()["status"] == "active"


def test_resolve_rejects_invalid_resolution(client, clean_db):
    _seed_devs([(USER_A, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 100)
    resp = _resolve(client, market_id, "MAYBE")
    assert resp.status_code == 400


def test_resolve_rejects_already_resolved(client, clean_db):
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "NO", 100)
    _resolve(client, market_id, "YES")

    # Now re-attempt with the opposite answer — must still be rejected.
    resp = _resolve(client, market_id, "NO")
    assert resp.status_code == 400
    # Outcome unchanged.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT outcome FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            assert cur.fetchone()["outcome"] == "YES"


# ---------------------------------------------------------------------------
# Atomicity (3)
# ---------------------------------------------------------------------------


def test_resolve_failure_rolls_back_all_payouts(client, clean_db):
    # Arrange a user market where the CREATOR owns no devs — the
    # creator-commission credit will fail with NoDevsError, and the
    # whole resolve must roll back (no winner payout persisted, market
    # status untouched). CREATOR intentionally NOT in seed.
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(
        market_type="user", creator=CREATOR, creator_fee=Decimal("5"),
    )
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "NO", 100)

    pre_balances = {
        USER_A: _balance(USER_A),
        USER_B: _balance(USER_B),
        TREASURY_WALLET: _balance(TREASURY_WALLET),
    }

    resp = _resolve(client, market_id, "YES")
    # 500 — creator has no devs, resolve aborts.
    assert resp.status_code == 500

    # Balances unchanged.
    for w, bal in pre_balances.items():
        assert _balance(w) == bal, f"{w} balance changed after failed resolve"
    # Market still resolvable.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, outcome FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            row = cur.fetchone()
    assert row["status"] == "active"
    assert row["outcome"] is None
    # No payout ledger rows persisted.
    assert _ledger_rows(USER_A, "nxmarket_payout") == []


def test_resolve_concurrent_rejected_by_for_update(client, clean_db):
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (TREASURY_WALLET, 0)])
    market_id = _seed_market(market_type="official")
    _buy(client, market_id, USER_A, "YES", 100)
    _buy(client, market_id, USER_B, "NO", 100)

    results: List[Dict[str, Any]] = []
    errors: List[BaseException] = []
    lock = threading.Lock()

    def _do_resolve(resolution: str):
        try:
            r = _resolve(client, market_id, resolution)
            with lock:
                results.append({"status": r.status_code, "body": r.json()})
        except BaseException as e:  # noqa: BLE001
            with lock:
                errors.append(e)

    t1 = threading.Thread(target=_do_resolve, args=("YES",))
    t2 = threading.Thread(target=_do_resolve, args=("NO",))
    t1.start(); t2.start()
    t1.join(timeout=15); t2.join(timeout=15)

    assert not errors, f"thread crashed: {errors[0]!r}"
    statuses = sorted(r["status"] for r in results)
    # One resolve wins; the other hits "already resolved".
    assert statuses == [200, 400]
    # Market has exactly one outcome.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, outcome FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            row = cur.fetchone()
    assert row["status"] == "resolved"
    assert row["outcome"] in ("YES", "NO")


def test_resolve_pool_reconciliation(client, clean_db):
    # Spread odd numbers to force non-trivial dust.
    _seed_devs([(USER_A, 10_000), (USER_B, 10_000), (USER_C, 10_000),
                (USER_D, 10_000), (TREASURY_WALLET, 0), (CREATOR, 0)])
    market_id = _seed_market(
        market_type="user", creator=CREATOR, creator_fee=Decimal("5"),
    )
    _buy(client, market_id, USER_A, "YES", 77)
    _buy(client, market_id, USER_B, "YES", 113)
    _buy(client, market_id, USER_C, "NO", 43)
    _buy(client, market_id, USER_D, "NO", 91)

    resp = _resolve(client, market_id, "YES")
    out = resp.json()

    # Invariant: pool_total exactly equals the sum of all its
    # destinations (treasury + commission + winners + dust).
    # treasury_total already includes dust; paid_to_winners is the
    # post-rounding winners sum. So:
    #   treasury_total + commission + paid_to_winners == pool_total
    assert (
        out["treasury_total"] + out["creator_commission"] + out["paid_to_winners"]
        == out["pool_total"]
    )
    # And the dust is exactly the gap between distributable and the
    # sum actually handed to winners.
    assert out["dust"] == out["distributable"] - out["paid_to_winners"]
    assert out["dust"] >= 0
    # Creator got exactly creator_commission on-chain (via ledger).
    commission_rows = _ledger_rows(CREATOR, "nxmarket_commission")
    assert sum(int(r["delta_nxt"]) for r in commission_rows) == out["creator_commission"]
