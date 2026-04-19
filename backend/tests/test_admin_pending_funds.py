"""
Fix 3 — admin reset endpoint + public fund-status polling.

Covers:
  - POST /api/admin/pending-funds/{id}/reset   (admin-only, audit-logged)
  - GET  /api/shop/pending-funds/status/{tx}   (public polling)

Each test hits the async endpoint function directly via asyncio.run so
we don't need to spin up an HTTP client. The DB pool is initialized
once per module against a local PostgreSQL with a minimal `nx` schema,
and every test runs against a truncated baseline.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest
from fastapi import HTTPException

# Backend imports expect the project root on sys.path.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.api.routes import admin as admin_route  # noqa: E402
from backend.api.routes import shop as shop_route  # noqa: E402


ADMIN_WALLET = next(iter(admin_route.ADMIN_WALLETS))
TX_A = "0x" + "a1" * 32
TX_B = "0x" + "b2" * 32
TX_UNKNOWN = "0x" + "cc" * 32


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TABLE pending_fund_txs (
    id              SERIAL PRIMARY KEY,
    tx_hash         TEXT UNIQUE NOT NULL,
    wallet_address  TEXT NOT NULL,
    dev_token_id    INT NOT NULL,
    amount_nxt      NUMERIC NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved        BOOLEAN NOT NULL DEFAULT false,
    resolved_at     TIMESTAMPTZ,
    attempts        INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    last_error      TEXT
);

CREATE TABLE funding_txs (
    id              SERIAL PRIMARY KEY,
    wallet_address  TEXT NOT NULL,
    dev_token_id    INT NOT NULL,
    amount_nxt      NUMERIC NOT NULL,
    tx_hash         TEXT UNIQUE NOT NULL,
    verified        BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_logs (
    id              BIGSERIAL PRIMARY KEY,
    correlation_id  UUID,
    event_type      TEXT NOT NULL,
    wallet_address  VARCHAR(42),
    dev_token_id    BIGINT,
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def _direct_connect():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=os.environ["NX_DB_PORT"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
        dbname=os.environ["NX_DB_NAME"],
        options="-c search_path=nx",
    )


class _FakeRequest:
    """Minimal stand-in for fastapi.Request — only exposes headers."""

    def __init__(self, headers=None):
        self.headers = headers or {}


@pytest.fixture(scope="module", autouse=True)
def schema_and_pool():
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()

    # Wire the app's connection pool to the test database.
    deps.DB_HOST = os.environ["NX_DB_HOST"]
    deps.DB_PORT = int(os.environ["NX_DB_PORT"])
    deps.DB_USER = os.environ["NX_DB_USER"]
    deps.DB_PASS = os.environ["NX_DB_PASS"]
    deps.DB_NAME = os.environ["NX_DB_NAME"]
    deps.DB_SSLMODE = "disable"
    deps.init_db_pool(minconn=1, maxconn=4)

    yield

    deps.close_db_pool()


@pytest.fixture(autouse=True)
def clean():
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "TRUNCATE admin_logs, funding_txs, pending_fund_txs "
            "RESTART IDENTITY CASCADE"
        )
    conn.close()
    yield


def _insert_pending(tx_hash=TX_A, *, resolved=False, attempts=0,
                    last_error=None, last_attempt_at=None,
                    wallet="0x" + "d" * 40, dev_token_id=1):
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            INSERT INTO pending_fund_txs
                (tx_hash, wallet_address, dev_token_id, amount_nxt,
                 resolved, attempts, last_error, last_attempt_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (tx_hash, wallet, dev_token_id, 100, resolved, attempts,
             last_error, last_attempt_at),
        )
        row = cur.fetchone()
    conn.close()
    return row["id"]


def _insert_funding(tx_hash=TX_A):
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO funding_txs "
            "(wallet_address, dev_token_id, amount_nxt, tx_hash, verified) "
            "VALUES (%s, %s, %s, %s, true)",
            ("0x" + "d" * 40, 1, 100, tx_hash),
        )
    conn.close()


def _row(pending_id):
    conn = _direct_connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM pending_fund_txs WHERE id = %s", (pending_id,))
    row = cur.fetchone()
    conn.close()
    return row


def _audit_rows(event_type):
    conn = _direct_connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT event_type, wallet_address, dev_token_id, payload "
        "FROM admin_logs WHERE event_type = %s ORDER BY id",
        (event_type,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def _call_reset(pending_id, *, wallet=ADMIN_WALLET):
    headers = {"X-Admin-Wallet": wallet} if wallet is not None else {}
    req = _FakeRequest(headers)
    return asyncio.run(
        admin_route.admin_reset_pending_fund(pending_id=pending_id, request=req)
    )


def _call_status(tx_hash):
    return asyncio.run(shop_route.pending_fund_status(tx_hash=tx_hash))


# ---------------------------------------------------------------------------
# Admin reset endpoint
# ---------------------------------------------------------------------------


def test_admin_reset_clears_attempts_and_error():
    pid = _insert_pending(
        attempts=5,
        last_error="RPC timeout",
        last_attempt_at="2026-04-18 12:00:00+00",
        wallet="0x" + "e" * 40,
        dev_token_id=7,
    )

    res = _call_reset(pid)

    assert res == {
        "ok": True, "id": pid, "tx_hash": TX_A, "prev_attempts": 5,
    }
    row = _row(pid)
    assert row["attempts"] == 0
    assert row["last_error"] is None
    assert row["last_attempt_at"] is None
    assert row["resolved"] is False  # must never auto-resolve


def test_admin_reset_persists_audit_row_in_admin_logs():
    pid = _insert_pending(
        attempts=4,
        last_error="boom",
        wallet="0x" + "e" * 40,
        dev_token_id=7,
    )
    _call_reset(pid)

    rows = _audit_rows("admin_pending_fund_reset")
    assert len(rows) == 1
    row = rows[0]
    assert row["wallet_address"] == ADMIN_WALLET
    assert row["dev_token_id"] == 7
    payload = row["payload"]
    assert payload["pending_fund_id"] == pid
    assert payload["tx_hash"] == TX_A
    assert payload["target_wallet"] == "0x" + "e" * 40
    assert payload["prev_attempts"] == 4


def test_admin_reset_missing_header_returns_403():
    pid = _insert_pending()
    with pytest.raises(HTTPException) as exc:
        _call_reset(pid, wallet=None)
    assert exc.value.status_code == 403
    assert _row(pid)["attempts"] == 0
    # No audit row written for a rejected call.
    assert _audit_rows("admin_pending_fund_reset") == []


def test_admin_reset_non_admin_wallet_returns_403():
    pid = _insert_pending(attempts=3)
    with pytest.raises(HTTPException) as exc:
        _call_reset(pid, wallet="0x" + "9" * 40)
    assert exc.value.status_code == 403
    assert _row(pid)["attempts"] == 3  # unchanged
    assert _audit_rows("admin_pending_fund_reset") == []


def test_admin_reset_unknown_id_returns_404():
    with pytest.raises(HTTPException) as exc:
        _call_reset(999999)
    assert exc.value.status_code == 404


def test_admin_reset_rejects_already_resolved():
    pid = _insert_pending(resolved=True, attempts=2)
    with pytest.raises(HTTPException) as exc:
        _call_reset(pid)
    assert exc.value.status_code == 400
    # attempts left untouched, no audit row written
    assert _row(pid)["attempts"] == 2
    assert _audit_rows("admin_pending_fund_reset") == []


def test_admin_reset_accepts_case_insensitive_admin_wallet():
    pid = _insert_pending(attempts=4)
    res = _call_reset(pid, wallet=ADMIN_WALLET.upper())
    assert res["ok"] is True
    assert _row(pid)["attempts"] == 0


# ---------------------------------------------------------------------------
# Public status polling endpoint (lives in shop.py)
# ---------------------------------------------------------------------------


def test_status_returns_credited_when_funding_tx_exists():
    _insert_funding(TX_A)
    res = _call_status(TX_A)
    assert res["status"] == "credited"
    assert res["tx_hash"] == TX_A


def test_status_returns_pending_for_unresolved_pending_row():
    _insert_pending(TX_B, attempts=2, last_error="RPC indexing lag")
    res = _call_status(TX_B)
    assert res["status"] == "pending"
    assert res["tx_hash"] == TX_B
    assert res["attempts"] == 2
    assert res["last_error"] == "RPC indexing lag"


def test_status_returns_unknown_when_tx_never_seen():
    res = _call_status(TX_UNKNOWN)
    assert res["status"] == "unknown"
    assert res["tx_hash"] == TX_UNKNOWN


def test_status_rejects_malformed_tx_hash():
    with pytest.raises(HTTPException) as exc:
        _call_status("not-a-hash")
    assert exc.value.status_code == 400
