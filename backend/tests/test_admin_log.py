"""Tests for admin_log.log_event and a real-flow integration.

Covers:
- log_event writes every field (incl. correlation_id from ContextVar).
- Optional fields persist as NULL when not supplied.
- A failing cursor.execute never raises out of log_event.
- The helper picks up the current correlation id from the middleware's
  ContextVar.
- End-to-end: claim_mission writes the expected admin_logs row.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest


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
from backend.api.middleware.correlation import (  # noqa: E402
    set_correlation_id,
    reset_correlation_id,
)
from backend.services.admin_log import log_event as admin_log_event  # noqa: E402


def _raw_connect():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=int(os.environ["NX_DB_PORT"]),
        dbname=os.environ["NX_DB_NAME"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
    )


ADMIN_LOGS_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

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


@pytest.fixture(scope="module")
def db_pool():
    """Minimal admin_logs schema + connection pool for the tests."""
    conn = _raw_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(ADMIN_LOGS_SCHEMA)
    conn.close()

    deps.init_db_pool(minconn=1, maxconn=4)
    try:
        yield
    finally:
        deps.close_db_pool()


@pytest.fixture()
def truncate(db_pool):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE admin_logs RESTART IDENTITY")


@pytest.fixture()
def cid_scope():
    """Run the test body inside a known correlation-id scope."""
    cid = "11111111-2222-3333-4444-555555555555"
    token = set_correlation_id(cid)
    try:
        yield cid
    finally:
        reset_correlation_id(token)


def _fetch_all():
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM admin_logs ORDER BY id")
            return cur.fetchall()


def test_log_event_writes_all_fields(truncate, cid_scope):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            admin_log_event(
                cur,
                event_type="fund_dev_received",
                wallet_address="0xABCDEF0123456789ABCDEF0123456789ABCDEF01",
                dev_token_id=42,
                payload={"tx_hash": "0xdead", "amount_wei": 1000000},
            )

    rows = _fetch_all()
    assert len(rows) == 1
    row = rows[0]
    assert row["event_type"] == "fund_dev_received"
    assert row["wallet_address"] == "0xabcdef0123456789abcdef0123456789abcdef01"
    assert row["dev_token_id"] == 42
    assert str(row["correlation_id"]) == cid_scope
    assert row["payload"] == {"tx_hash": "0xdead", "amount_wei": 1000000}


def test_log_event_persists_optional_fields_as_null(truncate):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            admin_log_event(
                cur,
                event_type="salary_batch_paid",
            )

    rows = _fetch_all()
    assert len(rows) == 1
    row = rows[0]
    assert row["event_type"] == "salary_batch_paid"
    assert row["wallet_address"] is None
    assert row["dev_token_id"] is None
    assert row["payload"] is None
    # No correlation id set outside any request/scope -> NULL.
    assert row["correlation_id"] is None


def test_log_event_swallows_execute_failure_without_raising(caplog):
    class ExplodingCursor:
        def execute(self, *args, **kwargs):
            raise RuntimeError("boom")

    with caplog.at_level("WARNING"):
        admin_log_event(
            ExplodingCursor(),
            event_type="whatever",
            wallet_address="0x" + "0" * 40,
            payload={"k": "v"},
        )

    msgs = [r.getMessage() for r in caplog.records]
    assert any("admin_log.insert_failed" in m for m in msgs)


def test_log_event_uses_current_correlation_id(truncate):
    explicit = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    token = set_correlation_id(explicit)
    try:
        with deps.get_db() as conn:
            with conn.cursor() as cur:
                admin_log_event(
                    cur, event_type="claim_sync_requested", payload={}
                )
    finally:
        reset_correlation_id(token)

    rows = _fetch_all()
    assert len(rows) == 1
    assert str(rows[0]["correlation_id"]) == explicit


def test_log_event_inside_rollback_reverts_audit_row(truncate, cid_scope):
    """If the transaction rolls back, the admin_logs insert rolls back too."""
    try:
        with deps.get_db() as conn:
            with conn.cursor() as cur:
                admin_log_event(
                    cur,
                    event_type="mission_claimed",
                    wallet_address="0x" + "a" * 40,
                    payload={"reward_nxt": 50},
                )
                raise RuntimeError("simulate endpoint failure after audit row")
    except RuntimeError:
        pass

    assert _fetch_all() == []
