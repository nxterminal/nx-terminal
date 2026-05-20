"""Tests for Phase 5.13 — PvP targeting.

Covers:
  - GET  /api/players/search   (prefix search, privacy, caller exclude)
  - POST /api/shop/hack-player with `target_nickname` (the modal flow)
    plus the legacy no-target random matchmaker still working.

The hack endpoint's RNG is monkeypatched for determinism; the shop
rate limiter and the search rate limiter are stubbed to no-ops so the
1s cooldowns don't interfere with back-to-back test requests.
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
from backend.tests._seed import seed_player, seed_dev  # noqa: E402
from backend.api.middleware.correlation import CorrelationIdMiddleware  # noqa: E402
from backend.api.routes import players as players_module  # noqa: E402
from backend.api.routes import shop as shop_module  # noqa: E402


ATTACKER = "0x" + "a1" * 20
VICTIM = "0x" + "b2" * 20
OTHER = "0x" + "c3" * 20


@pytest.fixture(scope="module")
def app():
    deps.init_db_pool(minconn=1, maxconn=4)
    fastapi_app = FastAPI()
    fastapi_app.add_middleware(CorrelationIdMiddleware)
    fastapi_app.include_router(players_module.router, prefix="/api/players")
    fastapi_app.include_router(shop_module.router, prefix="/api/shop")
    try:
        yield fastapi_app
    finally:
        deps.close_db_pool()


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def clean(app):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE devs, players, actions, shop_purchases, "
                "notifications, admin_logs, nxt_ledger, world_events "
                "RESTART IDENTITY CASCADE"
            )


@pytest.fixture()
def no_limits(monkeypatch):
    """Stub the per-key cooldowns so back-to-back test calls aren't 429'd."""
    monkeypatch.setattr(shop_module.shop_limiter, "check", lambda key: None)
    monkeypatch.setattr(players_module._search_limiter, "check", lambda key: None)


@pytest.fixture()
def deterministic_hack(monkeypatch):
    """Force every PvP hack to succeed with a fixed steal amount."""
    monkeypatch.setattr(shop_module.random, "random", lambda: 0.0)
    monkeypatch.setattr(
        shop_module.random, "randint", lambda lo, hi: lo
    )


def _seed_player_with_dev(
    cur, wallet, nickname, *, token_id, corp="CLOSED_AI",
    balance=500, status="active",
):
    seed_player(cur, wallet, display_name=nickname, corporation=corp)
    seed_dev(
        cur, token_id=token_id, owner_address=wallet, corporation=corp,
        name=f"dev_{token_id}", balance_nxt=balance, status=status,
    )


# ---------------------------------------------------------------------------
# A. Search endpoint
# ---------------------------------------------------------------------------


def test_search_returns_matching_players(client, clean, no_limits):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _seed_player_with_dev(cur, VICTIM, "valentine", token_id=1, balance=500)

    resp = client.get("/api/players/search", params={"q": "val"})
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["nickname"] == "valentine"
    assert rows[0]["has_active_devs"] is True
    assert rows[0]["dev_count"] == 1
    assert rows[0]["corp"] == "CLOSED_AI"


def test_search_prefix_only(client, clean, no_limits):
    """A substring that is NOT a prefix must not match."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _seed_player_with_dev(cur, VICTIM, "valentine", token_id=1)

    # "lentine" is a substring but not a prefix — no match.
    resp = client.get("/api/players/search", params={"q": "lentine"})
    assert resp.status_code == 200
    assert resp.json() == []


def test_search_never_returns_wallet_address(client, clean, no_limits):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _seed_player_with_dev(cur, VICTIM, "valentine", token_id=1)

    resp = client.get("/api/players/search", params={"q": "val"})
    assert resp.status_code == 200
    rows = resp.json()
    assert rows, "expected a result"
    for row in rows:
        assert "wallet_address" not in row
        assert "wallet" not in row
        # Defensive: no value in the row should look like an address.
        for value in row.values():
            assert not (isinstance(value, str) and value.lower().startswith("0x"))


def test_search_excludes_caller(client, clean, no_limits):
    """The searching wallet must never appear in its own results."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _seed_player_with_dev(cur, ATTACKER, "hunteralpha", token_id=1)
            _seed_player_with_dev(cur, VICTIM, "hunterbeta", token_id=2)

    resp = client.get(
        "/api/players/search", params={"q": "hunter", "caller": ATTACKER}
    )
    assert resp.status_code == 200
    nicknames = {r["nickname"] for r in resp.json()}
    assert "hunterbeta" in nicknames
    assert "hunteralpha" not in nicknames


def test_search_wallet_exact_match(client, clean, no_limits):
    """A full 0x address searches by wallet, not nickname prefix."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _seed_player_with_dev(cur, VICTIM, "valentine", token_id=1)

    resp = client.get("/api/players/search", params={"q": VICTIM})
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["nickname"] == "valentine"


def test_search_flags_target_with_no_hackable_devs(client, clean, no_limits):
    """A player whose only dev is broke → has_active_devs False."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _seed_player_with_dev(cur, VICTIM, "brokeguy", token_id=1, balance=0)

    resp = client.get("/api/players/search", params={"q": "broke"})
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["has_active_devs"] is False
    assert rows[0]["dev_count"] == 1


# ---------------------------------------------------------------------------
# B. hack-player with target_nickname
# ---------------------------------------------------------------------------


def _seed_attacker_and_victim(victim_balance=500, victim_status="active"):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _seed_player_with_dev(
                cur, ATTACKER, "attacker1", token_id=1,
                corp="CLOSED_AI", balance=2000,
            )
            _seed_player_with_dev(
                cur, VICTIM, "victim1", token_id=2,
                corp="MISANTHROPIC", balance=victim_balance,
                status=victim_status,
            )


def test_hack_with_valid_target_nickname(
    client, clean, no_limits, deterministic_hack
):
    _seed_attacker_and_victim()
    resp = client.post("/api/shop/hack-player", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
        "target_nickname": "victim1",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["hack_success"] is True
    assert body["target_name"] == "dev_2"
    assert body["hack_type"] == "player"


def test_hack_target_nickname_not_found(client, clean, no_limits):
    _seed_attacker_and_victim()
    resp = client.post("/api/shop/hack-player", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
        "target_nickname": "ghostzzz",
    })
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"] == "target_not_found"


def test_hack_cannot_hack_self(client, clean, no_limits):
    """Targeting your own nickname is rejected before any state change."""
    _seed_attacker_and_victim()
    resp = client.post("/api/shop/hack-player", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
        "target_nickname": "attacker1",
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "cannot_hack_self"


def test_hack_target_with_no_active_devs(client, clean, no_limits):
    """Target exists but every dev is broke → 400 no_active_devs."""
    _seed_attacker_and_victim(victim_balance=0)
    resp = client.post("/api/shop/hack-player", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
        "target_nickname": "victim1",
    })
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "no_active_devs"


def test_hack_without_target_uses_legacy_random(
    client, clean, no_limits, deterministic_hack
):
    """No target_nickname → the random matchmaker still runs."""
    _seed_attacker_and_victim()
    resp = client.post("/api/shop/hack-player", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["hack_success"] is True
    # The only valid cross-corp, funded target is victim1's dev.
    assert body["target_name"] == "dev_2"


def test_hack_breach_mail_shows_nickname_not_wallet(
    client, clean, no_limits, deterministic_hack
):
    """The hack_received mail identifies the attacker by nickname and
    must never leak the attacker's wallet address."""
    _seed_attacker_and_victim()
    resp = client.post("/api/shop/hack-player", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
        "target_nickname": "victim1",
    })
    assert resp.status_code == 200, resp.text

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT title, body FROM notifications "
                "WHERE player_address = %s AND type = 'hack_received'",
                (VICTIM,),
            )
            row = cur.fetchone()

    assert row is not None, "victim should have received a breach mail"
    body = row["body"]
    assert "attacker1" in body            # nickname present
    assert ATTACKER.lower() not in body.lower()   # wallet absent
    assert "0x" not in body                       # no truncated wallet


def test_hack_failed_mail_shows_target_nickname(client, clean, no_limits, monkeypatch):
    """On a failed raid the attacker gets a counter-intrusion mail that
    names the target by nickname."""
    # Force failure: random() >= success_prob.
    monkeypatch.setattr(shop_module.random, "random", lambda: 0.999)
    _seed_attacker_and_victim()
    resp = client.post("/api/shop/hack-player", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
        "target_nickname": "victim1",
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()["hack_success"] is False

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT body FROM notifications "
                "WHERE player_address = %s AND type = 'hack_failed'",
                (ATTACKER,),
            )
            row = cur.fetchone()

    assert row is not None, "attacker should have received a failure mail"
    assert "victim1" in row["body"]
