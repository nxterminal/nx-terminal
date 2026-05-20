"""Tests for the server-side energy gate (defense in depth).

The dev-card UI disables HACK, REPAIR and ECONOMY when a dev has 0
energy. These tests cover the matching server-side guards, so a stale
or tampered client cannot act on an exhausted dev:

  - POST /api/shop/hack-mainframe  energy=0 -> 400 insufficient_energy
  - POST /api/shop/hack-player     energy=0 -> 400 insufficient_energy
  - POST /api/shop/buy pc_repair   energy=0 -> 400 insufficient_energy
  - POST /api/shop/fund            energy=0 -> 400 insufficient_energy
  - POST /api/shop/transfer        energy=0 on the caller -> 400

/transfer serves both TRANSFER (caller = from_dev) and REQUEST
(caller = to_dev); the gate hits the caller, identified by the request
`mode`. A transfer INTO an exhausted dev is still allowed — the gate
must not block that rescue path.

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


def test_fund_rejects_zero_energy(client, clean, no_limits):
    """A dev with 0 energy cannot be funded (ECONOMY > FUND)."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            seed_player(cur, ATTACKER, display_name="owner",
                        corporation="CLOSED_AI")
            seed_dev(cur, token_id=1, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=2000, energy=0)

    resp = client.post("/api/shop/fund", json={
        "player_address": ATTACKER,
        "dev_token_id": 1,
        "amount": 100,
        "tx_hash": "0x" + "1" * 64,
    })
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"]["error"] == "insufficient_energy"


def test_transfer_rejects_zero_energy_sender(client, clean, no_limits):
    """TRANSFER mode: the caller is from_dev — 0 energy there is rejected."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            seed_player(cur, ATTACKER, display_name="owner",
                        corporation="CLOSED_AI")
            seed_dev(cur, token_id=1, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=500, energy=0)
            seed_dev(cur, token_id=2, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=0, energy=10)

    resp = client.post("/api/shop/transfer", json={
        "player_address": ATTACKER,
        "from_dev_token_id": 1,
        "to_dev_token_id": 2,
        "amount": 100,
        "mode": "transfer",
    })
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"]["error"] == "insufficient_energy"


def test_request_rejects_zero_energy_requester(client, clean, no_limits):
    """REQUEST mode: the caller is to_dev — 0 energy there is rejected.

    The funds source (from_dev) is healthy, so this proves the gate
    targets the caller and not from_dev."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            seed_player(cur, ATTACKER, display_name="owner",
                        corporation="CLOSED_AI")
            seed_dev(cur, token_id=1, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=0, energy=0)
            seed_dev(cur, token_id=2, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=500, energy=10)

    # REQUEST: dev 1 (the exhausted caller) pulls funds from dev 2.
    resp = client.post("/api/shop/transfer", json={
        "player_address": ATTACKER,
        "from_dev_token_id": 2,
        "to_dev_token_id": 1,
        "amount": 100,
        "mode": "request",
    })
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"]["error"] == "insufficient_energy"


def test_transfer_to_exhausted_recipient_allowed(client, clean, no_limits):
    """A healthy dev can still transfer INTO an exhausted dev — the gate
    hits the caller (from_dev), not the recipient. Guards the rescue path
    so the energy gate doesn't introduce a false positive."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            seed_player(cur, ATTACKER, display_name="owner",
                        corporation="CLOSED_AI")
            seed_dev(cur, token_id=1, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=500, energy=10)
            seed_dev(cur, token_id=2, owner_address=ATTACKER,
                     corporation="CLOSED_AI", balance_nxt=0, energy=0)

    resp = client.post("/api/shop/transfer", json={
        "player_address": ATTACKER,
        "from_dev_token_id": 1,
        "to_dev_token_id": 2,
        "amount": 100,
        "mode": "transfer",
    })
    assert resp.status_code == 200, resp.text
