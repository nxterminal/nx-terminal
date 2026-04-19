"""Tests for GET /api/admin/economy/summary.

Covers:
- Missing / non-admin X-Admin-Wallet header → 403.
- Admin header → 200 with the documented top-level schema.
- Salary batches logged in admin_logs surface in the response.
- DRY_RUN=true adds an info alert.
- Multiple salary batches in one hour trigger the restart alert.
- A low signer ETH balance triggers a critical alert.

Signer RPC lookups are monkeypatched so the tests don't touch the
network.
"""

from __future__ import annotations

import json
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
from backend.api.routes import admin as admin_module  # noqa: E402


ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
RANDOM_WALLET = "0x" + "99" * 20


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

CREATE TABLE claim_history (
    id              BIGSERIAL PRIMARY KEY,
    player_address  VARCHAR(42) NOT NULL,
    amount_gross    BIGINT NOT NULL,
    amount_net      BIGINT NOT NULL,
    fee_amount      BIGINT NOT NULL DEFAULT 0,
    tx_hash         TEXT,
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
"""


def _raw_connect():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=int(os.environ["NX_DB_PORT"]),
        dbname=os.environ["NX_DB_NAME"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
    )


def _default_signer_state() -> Dict[str, Any]:
    return {
        "address": "0x000000000000000000000000000000000000dEaD",
        "eth_balance_wei": 5 * 10**16,  # 0.05 ETH, well above alert threshold
        "nonce_latest": 10,
        "nonce_pending": 10,
        "error": None,
    }


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
    fastapi_app.include_router(admin_module.router, prefix="/api/admin")

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
            cur.execute(
                "TRUNCATE devs, claim_history, admin_logs RESTART IDENTITY"
            )


@pytest.fixture()
def mock_signer(monkeypatch):
    """Default signer state that triggers no alerts by itself."""
    monkeypatch.setattr(
        admin_module,
        "_fetch_signer_state",
        lambda: _default_signer_state(),
    )


@pytest.fixture()
def dry_run_disabled(monkeypatch):
    """Silence the DRY_RUN info alert for scenarios that want a clean list."""
    monkeypatch.setenv("DRY_RUN", "false")


def _seed_devs(rows):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for tid, owner, bal, status in rows:
                cur.execute(
                    "INSERT INTO devs (token_id, owner_address, balance_nxt, status) "
                    "VALUES (%s, %s, %s, %s)",
                    (tid, owner, bal, status),
                )


def _seed_admin_log(
    event_type: str,
    *,
    created_at: str = "NOW()",
    payload: dict | None = None,
    wallet: str | None = None,
):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO admin_logs (event_type, wallet_address, payload, created_at) "
                f"VALUES (%s, %s, %s::jsonb, {created_at})",
                (event_type, wallet, json.dumps(payload) if payload else None),
            )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_missing_admin_header_returns_403(client, clean_db, mock_signer):
    resp = client.get("/api/admin/economy/summary")
    assert resp.status_code == 403
    assert resp.json() == {"detail": "Admin only"}


def test_non_admin_wallet_returns_403(client, clean_db, mock_signer):
    resp = client.get(
        "/api/admin/economy/summary",
        headers={"X-Admin-Wallet": RANDOM_WALLET},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Happy path + schema
# ---------------------------------------------------------------------------


def test_admin_wallet_returns_documented_schema(
    client, clean_db, mock_signer, dry_run_disabled
):
    _seed_devs([
        (1, RANDOM_WALLET, 500, "active"),
        (2, "0x" + "55" * 20, 0, "active"),
        (3, "0x" + "77" * 20, 250, "on_mission"),
    ])

    resp = client.get(
        "/api/admin/economy/summary",
        headers={"X-Admin-Wallet": ADMIN_WALLET.upper()},
    )
    assert resp.status_code == 200
    body = resp.json()

    assert set(body.keys()) == {
        "circulation",
        "signer",
        "recent_activity",
        "config",
        "alerts",
    }

    circ = body["circulation"]
    assert circ["db_balance_nxt_total"] == 750
    assert circ["active_players"] == 2
    assert circ["pending_sync_count"] == 2
    assert circ["pending_sync_nxt"] == 750

    signer = body["signer"]
    assert signer["address"] == "0x000000000000000000000000000000000000dEaD"
    assert signer["eth_balance_wei"] == 5 * 10**16
    assert signer["nonce_gap"] == 0

    assert body["config"] == {"dry_run": False}
    assert body["recent_activity"]["events_24h"] == []
    assert body["recent_activity"]["salary_batches_7d"] == []
    assert body["alerts"] == []


def test_salary_batches_surface_in_response(
    client, clean_db, mock_signer, dry_run_disabled
):
    _seed_admin_log(
        "salary_batch_paid",
        payload={"count": 40, "total_emitted": 8000},
    )
    _seed_admin_log(
        "record_claim_received",
        payload={"amount_gross": 1000},
    )

    resp = client.get(
        "/api/admin/economy/summary",
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    assert resp.status_code == 200
    body = resp.json()

    events = {e["event_type"]: e["count"] for e in body["recent_activity"]["events_24h"]}
    assert events["salary_batch_paid"] == 1
    assert events["record_claim_received"] == 1

    hours = body["recent_activity"]["salary_batches_7d"]
    assert len(hours) == 1
    assert hours[0]["batches"] == 1
    assert hours[0]["devs_paid"] == 40
    assert hours[0]["nxt_emitted"] == 8000


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------


def test_dry_run_info_alert(client, clean_db, mock_signer, monkeypatch):
    monkeypatch.setenv("DRY_RUN", "true")

    resp = client.get(
        "/api/admin/economy/summary",
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    assert resp.status_code == 200
    alerts = resp.json()["alerts"]
    assert any(
        a["severity"] == "info" and "DRY_RUN" in a["message"]
        for a in alerts
    )


def test_low_signer_eth_raises_critical_alert(
    client, clean_db, dry_run_disabled, monkeypatch
):
    low_state = _default_signer_state()
    low_state["eth_balance_wei"] = 10**12  # 0.000001 ETH, below 10**15 threshold
    monkeypatch.setattr(admin_module, "_fetch_signer_state", lambda: low_state)

    resp = client.get(
        "/api/admin/economy/summary",
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    alerts = resp.json()["alerts"]
    assert any(
        a["severity"] == "critical" and "low ETH" in a["message"]
        for a in alerts
    )


def test_multiple_salary_batches_same_hour_trigger_warning(
    client, clean_db, mock_signer, dry_run_disabled
):
    # Two salary batches at the same wall-clock hour — a sign the engine
    # restarted mid-hour and paid twice.
    _seed_admin_log(
        "salary_batch_paid",
        payload={"count": 40, "total_emitted": 8000},
        created_at="NOW() - INTERVAL '2 minutes'",
    )
    _seed_admin_log(
        "salary_batch_paid",
        payload={"count": 40, "total_emitted": 8000},
        created_at="NOW()",
    )

    resp = client.get(
        "/api/admin/economy/summary",
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    alerts = resp.json()["alerts"]
    assert any(
        a["severity"] == "warning" and "multiple salary batches" in a["message"]
        for a in alerts
    )
