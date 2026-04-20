"""Tests for NXMARKET leaderboard (PR C2).

Covers 8 scenarios: empty state, ranking order, negative-profit
inclusion, limit param, 30d period filter, all-time period, total_users
counter, and 1-based ranking.
"""

from __future__ import annotations

import os
import sys
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


USER_A = "0x" + "aa" * 20
USER_B = "0x" + "bb" * 20
USER_C = "0x" + "cc" * 20


# nxt_ledger is the only table this endpoint reads from. Minimal schema
# strips the CHECK constraints on source / balance_after so the tests
# can seed arbitrary ledger rows without touching the real money-moving
# helpers.
MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

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
    correlation_id  UUID
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


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def clean_db(app):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE nxt_ledger RESTART IDENTITY")


def _seed_ledger(wallet, delta, source, days_ago=0, key_suffix=""):
    """Insert one nxt_ledger row with created_at = NOW() - days_ago."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxt_ledger (
                    wallet_address, delta_nxt, balance_after, source,
                    idempotency_key, created_at
                ) VALUES (
                    %s, %s, 0, %s, %s,
                    NOW() - (%s || ' days')::INTERVAL
                )
                """,
                (wallet, delta, source,
                 f"{source}:{wallet}:{delta}:{days_ago}:{key_suffix}",
                 str(days_ago)),
            )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_leaderboard_empty_returns_empty_array(client, clean_db):
    r = client.get("/api/nxmarket/leaderboard")
    assert r.status_code == 200
    body = r.json()
    assert body["period"] == "all"
    assert body["leaderboard"] == []
    assert body["total_users"] == 0


def test_leaderboard_ranks_by_net_profit_desc(client, clean_db):
    # USER_A: +1000 payout, -200 invested → net = 800
    _seed_ledger(USER_A, 1000, "nxmarket_payout")
    _seed_ledger(USER_A, -200, "nxmarket_buy_yes")
    # USER_B: +500 payout, -100 invested → net = 400
    _seed_ledger(USER_B, 500, "nxmarket_payout")
    _seed_ledger(USER_B, -100, "nxmarket_buy_no")
    # USER_C: +2000 payout, -500 invested → net = 1500
    _seed_ledger(USER_C, 2000, "nxmarket_payout")
    _seed_ledger(USER_C, -500, "nxmarket_buy_yes")

    r = client.get("/api/nxmarket/leaderboard")
    rows = r.json()["leaderboard"]
    profits = [(row["wallet_address"], row["net_profit"]) for row in rows]
    assert profits == [
        (USER_C.lower(), 1500),
        (USER_A.lower(), 800),
        (USER_B.lower(), 400),
    ]


def test_leaderboard_includes_users_with_negative_profit(client, clean_db):
    # USER_A: only bought, never won — net = -300
    _seed_ledger(USER_A, -300, "nxmarket_buy_yes")
    # USER_B: bought 100, won 500 → net = 400
    _seed_ledger(USER_B, -100, "nxmarket_buy_no")
    _seed_ledger(USER_B, 500, "nxmarket_payout")

    rows = client.get("/api/nxmarket/leaderboard").json()["leaderboard"]
    assert len(rows) == 2
    assert rows[0]["wallet_address"] == USER_B.lower()
    assert rows[0]["net_profit"] == 400
    assert rows[1]["wallet_address"] == USER_A.lower()
    assert rows[1]["net_profit"] == -300


def test_leaderboard_respects_limit_param(client, clean_db):
    for i in range(10):
        w = "0x" + (f"{i:02d}" * 20)
        _seed_ledger(w, 1000 - (i * 50), "nxmarket_payout",
                     key_suffix=str(i))

    r = client.get("/api/nxmarket/leaderboard?limit=5")
    rows = r.json()["leaderboard"]
    assert len(rows) == 5
    # total_users counts ALL active wallets, not just the limited slice.
    assert r.json()["total_users"] == 10


def test_leaderboard_period_30d_filters_old_entries(client, clean_db):
    # 60d-old entry shouldn't count in 30d period.
    _seed_ledger(USER_A, 500, "nxmarket_payout", days_ago=60,
                 key_suffix="old")
    # 5d-old entry counts.
    _seed_ledger(USER_A, 200, "nxmarket_payout", days_ago=5,
                 key_suffix="recent")

    rows = client.get("/api/nxmarket/leaderboard?period=30d").json()["leaderboard"]
    assert len(rows) == 1
    assert rows[0]["net_profit"] == 200


def test_leaderboard_period_all_includes_everything(client, clean_db):
    _seed_ledger(USER_A, 500, "nxmarket_payout", days_ago=60,
                 key_suffix="old")
    _seed_ledger(USER_A, 200, "nxmarket_payout", days_ago=5,
                 key_suffix="recent")

    rows = client.get("/api/nxmarket/leaderboard?period=all").json()["leaderboard"]
    assert len(rows) == 1
    assert rows[0]["net_profit"] == 700


def test_leaderboard_total_users_counts_active_wallets(client, clean_db):
    # 5 active (each has at least one relevant ledger row).
    for i, w in enumerate([USER_A, USER_B, USER_C]):
        _seed_ledger(w, 100 + i, "nxmarket_payout", key_suffix=str(i))
    _seed_ledger("0x" + "dd" * 20, -50, "nxmarket_buy_yes")
    _seed_ledger("0x" + "ee" * 20, -50, "nxmarket_buy_no")

    # 3 wallets with unrelated ledger activity don't count.
    _seed_ledger("0x" + "ff" * 20, 500, "salary", key_suffix="unrelated1")
    _seed_ledger("0x" + "ab" * 20, -100, "shop_purchase", key_suffix="unrelated2")
    _seed_ledger("0x" + "cd" * 20, 50, "streak_claim", key_suffix="unrelated3")

    body = client.get("/api/nxmarket/leaderboard").json()
    assert body["total_users"] == 5
    assert len(body["leaderboard"]) == 5


def test_leaderboard_rank_starts_at_1(client, clean_db):
    _seed_ledger(USER_A, 1000, "nxmarket_payout")
    _seed_ledger(USER_B, 500, "nxmarket_payout")
    _seed_ledger(USER_C, 100, "nxmarket_payout")

    rows = client.get("/api/nxmarket/leaderboard").json()["leaderboard"]
    assert [r["rank"] for r in rows] == [1, 2, 3]
