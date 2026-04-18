"""Tests for /api/claim-sync/force auth gating.

Covers the bug fixed in PR 2.1:

  Before: partial-sync accepted any list of token_ids with no wallet
          validation, letting a caller zero another player's
          balance_nxt.
  After:  wallet_address is mandatory, each token must belong to the
          caller (or caller must be admin), full-sync still admin-only.

``sync_claimable_balances`` is monkeypatched so nothing hits MegaETH.
"""

from __future__ import annotations

import os
import sys
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
from backend.api.routes import simulation as simulation_module  # noqa: E402


WALLET_A = "0x" + "a1" * 20
WALLET_B = "0x" + "b2" * 20
ADMIN = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"


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

CREATE TABLE admin_logs (
    id             BIGSERIAL PRIMARY KEY,
    correlation_id UUID,
    event_type     TEXT NOT NULL,
    wallet_address VARCHAR(42),
    dev_token_id   BIGINT,
    payload        JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
        simulation_module.router, prefix="/api/simulation"
    )
    try:
        yield fastapi_app
    finally:
        deps.close_db_pool()


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def clean(app, monkeypatch):
    """Wipe tables + stub sync_claimable_balances to a no-network return."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE devs, admin_logs RESTART IDENTITY")

    def _fake_sync(db_conn=None, filter_token_ids=None, wait_for_receipt=True):
        return {
            "synced": len(filter_token_ids) if filter_token_ids else 0,
            "total": len(filter_token_ids) if filter_token_ids else 0,
            "tx_hash": "0xfeedfacedeadbeef",
            "status": "ok",
        }

    import backend.engine.claim_sync as claim_sync_mod

    monkeypatch.setattr(claim_sync_mod, "sync_claimable_balances", _fake_sync)


def _seed(rows):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for tid, owner, bal in rows:
                cur.execute(
                    "INSERT INTO devs (token_id, owner_address, balance_nxt) "
                    "VALUES (%s, %s, %s)",
                    (tid, owner, bal),
                )


def _count(event_type: str) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM admin_logs WHERE event_type = %s",
                (event_type,),
            )
            return int(cur.fetchone()["n"])


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


def test_missing_wallet_returns_400(client, clean):
    resp = client.post(
        "/api/simulation/claim-sync/force",
        json={"token_ids": [1, 2]},
    )
    assert resp.status_code == 400
    assert "wallet_address required" in resp.json()["detail"]


def test_invalid_wallet_format_returns_400(client, clean):
    resp = client.post(
        "/api/simulation/claim-sync/force",
        json={"wallet_address": "not-a-wallet", "token_ids": [1]},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Ownership bug — the core fix
# ---------------------------------------------------------------------------


def test_partial_sync_foreign_tokens_returns_403_and_audits(client, clean):
    _seed([
        (1, WALLET_A, 100),
        (2, WALLET_A, 100),
        (3, WALLET_B, 100),
        (4, WALLET_B, 100),
    ])

    resp = client.post(
        "/api/simulation/claim-sync/force",
        json={"wallet_address": WALLET_A, "token_ids": [3, 4]},
    )

    assert resp.status_code == 403
    assert "Not all token_ids belong to this wallet" in resp.json()["detail"]
    assert _count("claim_sync_auth_denied") == 1
    assert _count("claim_sync_tx_sent") == 0


def test_partial_sync_mixed_ownership_returns_403(client, clean):
    _seed([
        (1, WALLET_A, 100),
        (2, WALLET_A, 100),
        (3, WALLET_B, 100),
    ])

    resp = client.post(
        "/api/simulation/claim-sync/force",
        json={"wallet_address": WALLET_A, "token_ids": [1, 3]},
    )

    assert resp.status_code == 403
    assert _count("claim_sync_auth_denied") == 1


def test_partial_sync_own_tokens_returns_200(client, clean):
    _seed([
        (1, WALLET_A, 100),
        (2, WALLET_A, 100),
    ])

    resp = client.post(
        "/api/simulation/claim-sync/force",
        json={"wallet_address": WALLET_A, "token_ids": [1, 2]},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["synced"] == 2
    assert _count("claim_sync_auth_denied") == 0
    assert _count("claim_sync_requested") == 1


# ---------------------------------------------------------------------------
# Full sync still admin-only
# ---------------------------------------------------------------------------


def test_full_sync_non_admin_returns_403(client, clean):
    resp = client.post(
        "/api/simulation/claim-sync/force",
        json={"wallet_address": WALLET_A},
    )
    assert resp.status_code == 403
    assert "admin" in resp.json()["detail"].lower()


def test_full_sync_admin_returns_200(client, clean):
    resp = client.post(
        "/api/simulation/claim-sync/force",
        json={"wallet_address": ADMIN},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert _count("claim_sync_requested") == 1
