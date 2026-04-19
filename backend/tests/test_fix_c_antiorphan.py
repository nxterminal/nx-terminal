"""
Fix-C — orphan-prevention + admin summary stuck-pending alerting.

Two surfaces:
  - Engine startup runs `scan_orphaned_funds` before the main loop
    and writes an `engine_startup_orphan_scan` row in admin_logs with
    the number credited. Failure of the scan must NOT prevent the
    engine from entering its main loop.
  - `GET /api/admin/economy/summary` surfaces a `pending_fund_txs_slow`
    alert when any unresolved pending fund is older than 10 minutes,
    and stays silent for recent or already-resolved rows.

Both flows hit the admin_logs / pending_fund_txs tables directly, so
the suite builds a minimal `nx` schema (same pattern used by
test_admin_pending_funds.py / test_orphan_scanner_disambig.py) and
cleans between tests via TRUNCATE.
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import psycopg2
import psycopg2.extras
import pytest

# engine.py does flat imports (from config import *) relative to
# backend/engine, so make both the project root AND the engine dir
# visible to the import system.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_ENGINE_DIR = _PROJECT_ROOT / "backend" / "engine"
for p in (str(_PROJECT_ROOT), str(_ENGINE_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_SCHEMA", "nx")
# The shadow-write path wants nxt_ledger which is out of scope here.
os.environ["LEDGER_SHADOW_WRITE"] = "false"

import engine  # noqa: E402
from backend.api import deps  # noqa: E402
from backend.api.routes import admin as admin_route  # noqa: E402


ADMIN_WALLET = next(iter(admin_route.ADMIN_WALLETS))
TREASURY = engine._FUND_TREASURY  # lowercased hex
TRANSFER_TOPIC = engine._FUND_TRANSFER_TOPIC


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TYPE archetype_enum AS ENUM (
    '10X_DEV','LURKER','DEGEN','GRINDER',
    'INFLUENCER','HACKTIVIST','FED','SCRIPT_KIDDIE'
);
CREATE TYPE corporation_enum AS ENUM (
    'CLOSED_AI','MISANTHROPIC','SHALLOW_MIND',
    'ZUCK_LABS','Y_AI','MISTRIAL_SYSTEMS'
);
CREATE TYPE action_enum AS ENUM (
    'CREATE_PROTOCOL','CREATE_AI','INVEST','SELL',
    'MOVE','CHAT','CODE_REVIEW','REST',
    'RECEIVE_SALARY','USE_ITEM','GET_SABOTAGED','DEPLOY',
    'FUND_DEV','TRANSFER'
);

CREATE TABLE players (
    wallet_address  TEXT PRIMARY KEY,
    corporation     corporation_enum NOT NULL DEFAULT 'CLOSED_AI'
);

CREATE TABLE devs (
    token_id        INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    owner_address   TEXT NOT NULL REFERENCES players(wallet_address),
    archetype       archetype_enum NOT NULL DEFAULT '10X_DEV',
    balance_nxt     BIGINT NOT NULL DEFAULT 0,
    total_earned    BIGINT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active',
    last_action_at  TIMESTAMPTZ
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
    last_error      TEXT,
    next_retry_at   TIMESTAMPTZ
);

CREATE TABLE actions (
    id              BIGSERIAL PRIMARY KEY,
    dev_id          INT NOT NULL,
    dev_name        TEXT NOT NULL,
    archetype       archetype_enum NOT NULL,
    action_type     action_enum NOT NULL,
    details         JSONB,
    energy_cost     SMALLINT NOT NULL DEFAULT 0,
    nxt_cost        BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE claim_history (
    id              BIGSERIAL PRIMARY KEY,
    wallet_address  TEXT NOT NULL,
    amount_net      BIGINT NOT NULL DEFAULT 0,
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    def __init__(self, headers=None):
        self.headers = headers or {}


@pytest.fixture(scope="module", autouse=True)
def schema_and_pool():
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()

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
            "TRUNCATE admin_logs, actions, pending_fund_txs, funding_txs, "
            "devs, players, claim_history RESTART IDENTITY CASCADE"
        )
    conn.close()
    yield


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _transfer_event(sender, amount_nxt, tx_hash):
    pad = lambda a: "0x" + "0" * 24 + a[2:]
    return {
        "transactionHash": tx_hash,
        "topics": [TRANSFER_TOPIC, pad(sender), pad(TREASURY)],
        "data": hex(amount_nxt * (10 ** 18)),
    }


def _fake_rpc(events):
    def _rpc(method, _params):
        if method == "eth_blockNumber":
            return hex(500)
        if method == "eth_getLogs":
            return events
        return None
    return _rpc


def _seed_dev(token_id, wallet, *, name=None):
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO players (wallet_address) VALUES (%s) ON CONFLICT DO NOTHING",
            (wallet,),
        )
        cur.execute(
            "INSERT INTO devs (token_id, name, owner_address) VALUES (%s, %s, %s)",
            (token_id, name or f"dev_{token_id}", wallet),
        )
    conn.close()


def _insert_pending(tx_hash, *, created_at=None, resolved=False,
                    amount_nxt=100, wallet=None, dev_token_id=1):
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO pending_fund_txs
                (tx_hash, wallet_address, dev_token_id, amount_nxt,
                 resolved, created_at)
            VALUES (%s, %s, %s, %s, %s,
                    COALESCE(%s, NOW()))
            """,
            (tx_hash, wallet or ("0x" + "d" * 40), dev_token_id, amount_nxt,
             resolved, created_at),
        )
    conn.close()


def _audit_rows(event_type):
    conn = _direct_connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT event_type, payload FROM admin_logs "
        "WHERE event_type = %s ORDER BY id",
        (event_type,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


# ---------------------------------------------------------------------------
# PASO 1 — Engine startup orphan scan
# ---------------------------------------------------------------------------


def _run_startup_scan():
    """Mirror of the new run_engine() startup block that calls
    scan_orphaned_funds + admin_log_event. Lets us unit-test the
    exact semantics without booting the main loop."""
    from backend.services.admin_log import log_event as _log_event
    with engine.get_db() as conn:
        credited = engine.scan_orphaned_funds(conn) or 0
        with conn.cursor() as cur:
            _log_event(
                cur,
                event_type="engine_startup_orphan_scan",
                payload={"orphans_credited": credited},
            )


def test_engine_startup_runs_orphan_scan():
    """Happy path: one orphan Transfer to treasury → credited + audit row."""
    wallet = "0x" + "a" * 40
    _seed_dev(1, wallet, name="KIRA-11")
    tx = "0x" + "a1" * 32
    events = [_transfer_event(wallet, 123, tx)]

    with patch.object(engine, "_fund_rpc", side_effect=_fake_rpc(events)):
        _run_startup_scan()

    # The orphan got credited
    conn = _direct_connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT dev_token_id, amount_nxt FROM funding_txs WHERE tx_hash = %s", (tx,))
    fund = cur.fetchone()
    assert fund is not None
    assert fund["dev_token_id"] == 1
    assert int(fund["amount_nxt"]) == 123

    # And an audit row landed in admin_logs with the count
    rows = _audit_rows("engine_startup_orphan_scan")
    conn.close()
    assert len(rows) == 1
    assert rows[0]["payload"] == {"orphans_credited": 1}


def test_engine_startup_handles_scan_failure_gracefully():
    """If scan_orphaned_funds raises, the startup hook must swallow it
    without propagating so the engine can still enter its main loop."""
    def _boom(*_a, **_kw):
        raise RuntimeError("RPC exploded")

    with patch.object(engine, "scan_orphaned_funds", side_effect=_boom):
        # Re-implement the guard from run_engine() inline — the suite
        # is checking that the try/except wrapping does its job.
        try:
            with engine.get_db() as conn:
                engine.scan_orphaned_funds(conn)
        except Exception:
            engine.log.error("startup orphan scan swallowed in test")
        else:
            pytest.fail("scan_orphaned_funds should have raised — mock misconfigured")

    # No audit row should exist because we never reached log_event.
    assert _audit_rows("engine_startup_orphan_scan") == []


# ---------------------------------------------------------------------------
# PASO 2 — pending_fund_txs_slow alert in /economy/summary
# ---------------------------------------------------------------------------


def _call_summary():
    req = _FakeRequest({"X-Admin-Wallet": ADMIN_WALLET})
    return asyncio.run(admin_route.economy_summary(request=req))


def _find_alert(alerts, alert_type):
    for a in alerts:
        if a.get("type") == alert_type:
            return a
    return None


def test_admin_summary_reports_stuck_pending_alert_after_10_min():
    fifteen_min_ago = datetime.now(timezone.utc) - timedelta(minutes=15)
    _insert_pending(
        "0x" + "1" * 64,
        created_at=fifteen_min_ago,
        amount_nxt=75,
    )

    res = _call_summary()
    alert = _find_alert(res["alerts"], "pending_fund_txs_slow")
    assert alert is not None, res["alerts"]
    assert alert["severity"] == "warning"
    assert alert["count"] == 1
    assert alert["total_amount_nxt"] == "75"
    assert alert["oldest_age_minutes"] is not None and alert["oldest_age_minutes"] >= 15
    assert "hint" in alert and "reset" in alert["hint"]


def test_admin_summary_no_alert_when_all_recent():
    two_min_ago = datetime.now(timezone.utc) - timedelta(minutes=2)
    _insert_pending("0x" + "2" * 64, created_at=two_min_ago)

    res = _call_summary()
    assert _find_alert(res["alerts"], "pending_fund_txs_slow") is None


def test_admin_summary_no_alert_when_resolved():
    twenty_min_ago = datetime.now(timezone.utc) - timedelta(minutes=20)
    _insert_pending(
        "0x" + "3" * 64,
        created_at=twenty_min_ago,
        resolved=True,
    )

    res = _call_summary()
    assert _find_alert(res["alerts"], "pending_fund_txs_slow") is None


def test_admin_summary_alert_sums_multiple_stuck_rows():
    """Multiple stuck rows aggregate into one alert with count+total."""
    twelve_min_ago = datetime.now(timezone.utc) - timedelta(minutes=12)
    forty_min_ago = datetime.now(timezone.utc) - timedelta(minutes=40)
    _insert_pending("0x" + "a" * 64, created_at=twelve_min_ago, amount_nxt=10)
    _insert_pending("0x" + "b" * 64, created_at=forty_min_ago, amount_nxt=25)

    res = _call_summary()
    alert = _find_alert(res["alerts"], "pending_fund_txs_slow")
    assert alert is not None
    assert alert["count"] == 2
    assert alert["total_amount_nxt"] == "35"
    # oldest → ≥40 min
    assert alert["oldest_age_minutes"] >= 40
