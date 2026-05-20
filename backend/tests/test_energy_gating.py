"""Tests for the energy gate on HACK and REPAIR (defense in depth).

The dev-card UI disables the HACK and REPAIR buttons when a dev has 0
energy. These tests cover the matching server-side guard, so a stale or
tampered client cannot act on an exhausted dev:

  - POST /api/shop/hack-mainframe  energy=0 -> 400 insufficient_energy
  - POST /api/shop/hack-player     energy=0 -> 400 insufficient_energy
  - POST /api/shop/buy pc_repair   energy=0 -> 400 insufficient_energy

ECONOMY (fund / transfer / request) is intentionally NOT gated — it is
the rescue path for a dev with 0 energy and 0 $NXT — so it has no test
here by design.

The shop rate limiter is stubbed to a no-op so back-to-back requests
aren't 429'd. Devs seeded without an explicit `energy` keep the schema
default (10), so the existing hack tests stay green.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

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
from backend.api.routes import shop as shop_module  # noqa: E402


ATTACKER = "0x" + "a1" * 20
VICTIM = "0x" + "b2" * 20


@pytest.fixture(scope="module")
def app():
    deps.init_db_pool(minconn=1, maxconn=4)
    fastapi_app = FastAPI()
    fastapi_app.add_middleware(CorrelationIdMiddleware)
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
    """Stub the shop rate limiter so back-to-back test calls aren't 429'd."""
    monkeypatch.setattr(shop_module.shop_limiter, "check", lambda key: None)


def test_hack_mainframe_rejects_zero_energy(client, clean, no_limits):
    """A dev with 0 energy cannot hack the mainframe."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            seed_player(cur, ATTACKER, display_name="hacker",
                        corporation="CLOSED_AI")
            seed_dev(cur, token_id=1, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=2000, energy=0)

    resp = client.post("/api/shop/hack-mainframe", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
    })
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"]["error"] == "insufficient_energy"


def test_hack_player_rejects_zero_energy(client, clean, no_limits):
    """A dev with 0 energy cannot hack another player — gated before
    target selection, so an otherwise-valid target is still rejected."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            seed_player(cur, ATTACKER, display_name="hacker",
                        corporation="CLOSED_AI")
            seed_dev(cur, token_id=1, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=2000, energy=0)
            seed_player(cur, VICTIM, display_name="victim",
                        corporation="MISANTHROPIC")
            seed_dev(cur, token_id=2, owner_address=VICTIM,
                     corporation="MISANTHROPIC", balance_nxt=500,
                     status="active", energy=10)

    resp = client.post("/api/shop/hack-player", json={
        "player_address": ATTACKER,
        "attacker_dev_id": 1,
        "target_nickname": "victim",
    })
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"]["error"] == "insufficient_energy"


def test_buy_pc_repair_rejects_zero_energy(client, clean, no_limits):
    """A dev with 0 energy cannot buy pc_repair (REPAIR)."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            seed_player(cur, ATTACKER, display_name="owner",
                        corporation="CLOSED_AI")
            seed_dev(cur, token_id=1, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=2000, energy=0)

    resp = client.post("/api/shop/buy", json={
        "player_address": ATTACKER,
        "item_id": "pc_repair",
        "target_dev_id": 1,
    })
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"]["error"] == "insufficient_energy"
