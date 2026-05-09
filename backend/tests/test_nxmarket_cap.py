"""Tests for NX Market creation cap escalera (dev→market ladder).

Escalera rules:
  - 0 devs      → 0 markets (cannot create)
  - 1-4 devs    → N markets max
  - 5-19 devs   → 5 markets max
  - 20+ devs    → unlimited

Official markets (admin-created) are exempt — they don't count against
a wallet's cap and admin's own user-mode creations apply the cap
uniformly (no special bypass).
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
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
from backend.tests._seed import seed_player, seed_dev  # noqa: E402
from backend.api.middleware.correlation import CorrelationIdMiddleware  # noqa: E402
from backend.api.routes import nxmarket as nxmarket_module  # noqa: E402


ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
USER_A = "0x" + "aa" * 20
USER_B = "0x" + "bb" * 20




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
                "nxmarket_price_history, nxmarket_markets "
                "RESTART IDENTITY CASCADE"
            )


def _seed_devs(wallet: str, n: int, balance_each: int = 1000):
    # devs.token_id is a plain INTEGER PK (no SERIAL), so we compute an
    # offset from whatever's already present to avoid collisions across
    # wallets within the same test.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(MAX(token_id), 0) AS m FROM devs")
            start = int(cur.fetchone()["m"]) + 1
            for i in range(n):
                seed_dev(cur, token_id=start + i, owner_address=wallet, balance_nxt=balance_each)


def _seed_market(wallet: str, *, status: str = "active",
                 market_type: str = "user") -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_markets (
                    question, category, market_type, created_by,
                    creator_fee_percent, seed_nxt, shares_yes, shares_no,
                    liquidity_b, status, close_at
                ) VALUES (
                    'Q?', 'crypto', %s, %s, 5, 500, 250, 250, 100, %s,
                    NOW() + INTERVAL '48 hours'
                ) RETURNING id
                """,
                (market_type, wallet, status),
            )
            r = cur.fetchone()
            return int(r["id"] if isinstance(r, dict) else r[0])


def _future_iso(hours: int = 48) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def _create_user_market(client, wallet: str):
    return client.post(
        "/api/nxmarket/markets",
        json={
            "wallet": wallet,
            "question": "Will something happen?",
            "category": "crypto",
            "close_at": _future_iso(),
            "liquidity_b": 100,
        },
    )


def _get_cap(client, wallet: str):
    return client.get(f"/api/nxmarket/markets/cap/{wallet}")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_cap_zero_devs_zero_markets(client, clean_db):
    r = _get_cap(client, USER_A)
    assert r.status_code == 200
    body = r.json()
    assert body["dev_count"] == 0
    assert body["max_markets"] == 0
    assert body["remaining"] == 0
    assert body["can_create"] is False


def test_cap_one_dev_one_market(client, clean_db):
    _seed_devs(USER_A, 1, balance_each=1000)
    # Before any creation, can_create=True and remaining=1.
    body = _get_cap(client, USER_A).json()
    assert body["max_markets"] == 1
    assert body["remaining"] == 1
    assert body["can_create"] is True

    r = _create_user_market(client, USER_A)
    assert r.status_code == 200, r.text

    # Second attempt must bounce — already at cap.
    r2 = _create_user_market(client, USER_A)
    assert r2.status_code == 400
    assert "Market cap reached" in r2.json()["detail"]

    body = _get_cap(client, USER_A).json()
    assert body["active_markets"] == 1
    assert body["can_create"] is False
    assert body["remaining"] == 0


def test_cap_escalera_up_to_5(client, clean_db):
    for dev_count, expected_max in [(4, 4), (5, 5), (10, 5), (19, 5)]:
        with deps.get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE devs RESTART IDENTITY CASCADE")
        _seed_devs(USER_A, dev_count)
        body = _get_cap(client, USER_A).json()
        assert body["max_markets"] == expected_max, (
            f"dev_count={dev_count} expected max={expected_max} "
            f"got {body['max_markets']}"
        )


def test_cap_unlimited_at_20_devs(client, clean_db):
    _seed_devs(USER_A, 20)
    # Seed 10 existing active markets (way beyond any capped limit).
    for _ in range(10):
        _seed_market(USER_A, status="active", market_type="user")

    body = _get_cap(client, USER_A).json()
    assert body["dev_count"] == 20
    assert body["max_markets"] is None
    assert body["remaining"] is None
    assert body["can_create"] is True
    assert body["active_markets"] == 10


def test_cap_post_rejects_when_at_cap(client, clean_db):
    _seed_devs(USER_A, 2)
    # Seed 2 active markets already → at cap.
    _seed_market(USER_A)
    _seed_market(USER_A)

    r = _create_user_market(client, USER_A)
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert "Market cap reached" in detail
    assert "2/2" in detail
    assert "2 devs" in detail


def test_cap_resolved_markets_dont_count(client, clean_db):
    _seed_devs(USER_A, 1, balance_each=1000)
    _seed_market(USER_A, status="resolved", market_type="user")

    # 1 dev + 1 resolved market ⇒ still can create (resolved doesn't
    # count). Gets reset regardless of having had one before.
    body = _get_cap(client, USER_A).json()
    assert body["active_markets"] == 0
    assert body["can_create"] is True

    r = _create_user_market(client, USER_A)
    assert r.status_code == 200, r.text


def test_cap_official_markets_dont_count_for_users(client, clean_db):
    _seed_devs(USER_A, 1, balance_each=1000)
    # Admin creates an official market credited to USER_A (unusual but
    # possible in principle via seeds). Cap should still allow USER_A
    # to create their ONE user-market.
    _seed_market(USER_A, status="active", market_type="official")

    body = _get_cap(client, USER_A).json()
    # official doesn't count in active_markets (only user_type does).
    assert body["active_markets"] == 0
    assert body["can_create"] is True

    r = _create_user_market(client, USER_A)
    assert r.status_code == 200, r.text


def test_cap_endpoint_returns_correct_info(client, clean_db):
    _seed_devs(USER_B, 3)
    _seed_market(USER_B, status="active", market_type="user")

    body = _get_cap(client, USER_B).json()
    assert body["wallet"] == USER_B.lower()
    assert body["dev_count"] == 3
    assert body["max_markets"] == 3
    assert body["active_markets"] == 1
    assert body["remaining"] == 2
    assert body["can_create"] is True
