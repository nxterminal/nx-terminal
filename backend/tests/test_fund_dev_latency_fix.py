"""Fix-A: fund_dev latency + resilience.

Exercises the three behavioural changes:
- F1: worker interval is 30s (not 300s)
- F2: /shop/fund does NOT poll for 60s — single RPC attempt, fast-fail
  to pending_fund_txs
- F3: worker honours next_retry_at, no hard cap on attempts, one-shot
  admin_logs alert on attempt=20
- F4: /admin/economy/summary surfaces a warning when pending_fund_txs
  rows are unresolved >30min

Nothing in here touches the network. The MegaETH RPC and the
per-tx-hash `_rpc` helper are both monkeypatched.
"""

from __future__ import annotations

import asyncio
import os
import sys
import time as _time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
# engine.py uses `from config import *`.
ENGINE_DIR = Path(__file__).resolve().parent.parent / "engine"
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

os.environ.pop("DATABASE_URL", None)
os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.api.middleware.correlation import CorrelationIdMiddleware  # noqa: E402
from backend.api.routes import admin as admin_mod  # noqa: E402
from backend.api.routes import shop as shop_mod  # noqa: E402
from backend.engine import engine as engine_mod  # noqa: E402


WALLET_A = "0x" + "a1" * 20
ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
TREASURY = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
NXT_TOKEN = "0x2f55e14f0b2b2118d2026d20ad2c39eacbdcac47"
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

TX_HASH = "0x" + "cd" * 32


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TYPE archetype_enum AS ENUM (
    '10X_DEV', 'LURKER', 'DEGEN', 'GRINDER',
    'INFLUENCER', 'HACKTIVIST', 'FED', 'SCRIPT_KIDDIE'
);
CREATE TYPE action_enum AS ENUM (
    'CREATE_PROTOCOL', 'CREATE_AI', 'INVEST', 'SELL',
    'MOVE', 'CHAT', 'CODE_REVIEW', 'REST',
    'RECEIVE_SALARY', 'USE_ITEM', 'GET_SABOTAGED', 'DEPLOY',
    'BUY_ITEM', 'FIX_BUG', 'TRAIN', 'HACK_RAID', 'HACK_MAINFRAME',
    'MISSION_START', 'MISSION_COMPLETE', 'FUND_DEV', 'TRANSFER'
);

CREATE TABLE players (
    wallet_address VARCHAR(42) PRIMARY KEY
);

CREATE TABLE devs (
    token_id      INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    archetype     archetype_enum NOT NULL,
    balance_nxt   BIGINT NOT NULL DEFAULT 0,
    total_earned  BIGINT NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE funding_txs (
    id             SERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    dev_token_id   INT NOT NULL,
    amount_nxt     BIGINT NOT NULL,
    tx_hash        TEXT UNIQUE NOT NULL,
    verified       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pending_fund_txs (
    id               SERIAL PRIMARY KEY,
    tx_hash          TEXT UNIQUE NOT NULL,
    wallet_address   TEXT NOT NULL,
    dev_token_id     INT NOT NULL,
    amount_nxt       NUMERIC NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved         BOOLEAN NOT NULL DEFAULT false,
    resolved_at      TIMESTAMPTZ,
    attempts         INT NOT NULL DEFAULT 0,
    last_attempt_at  TIMESTAMPTZ,
    last_error       TEXT,
    next_retry_at    TIMESTAMPTZ
);

CREATE TABLE actions (
    id           BIGSERIAL PRIMARY KEY,
    dev_id       INTEGER NOT NULL,
    dev_name     TEXT NOT NULL,
    archetype    archetype_enum NOT NULL,
    action_type  action_enum NOT NULL,
    details      JSONB,
    energy_cost  SMALLINT NOT NULL DEFAULT 0,
    nxt_cost     BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE claim_history (
    id             BIGSERIAL PRIMARY KEY,
    player_address VARCHAR(42) NOT NULL,
    amount_gross   BIGINT NOT NULL DEFAULT 0,
    amount_net     BIGINT NOT NULL DEFAULT 0,
    fee_amount     BIGINT NOT NULL DEFAULT 0,
    tx_hash        TEXT,
    claimed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    correlation_id  UUID,
    CHECK (delta_nxt != 0),
    CHECK (balance_after >= 0)
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
def db_pool():
    conn = _raw_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()
    deps.init_db_pool(minconn=1, maxconn=4)
    try:
        yield
    finally:
        deps.close_db_pool()


@pytest.fixture()
def clean(db_pool):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE devs, admin_logs, nxt_ledger, actions, "
                "pending_fund_txs, funding_txs RESTART IDENTITY CASCADE"
            )
            cur.execute("TRUNCATE players RESTART IDENTITY CASCADE")


def _seed_dev(token_id=1, owner=WALLET_A, archetype="10X_DEV"):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO players (wallet_address) VALUES (%s) "
                "ON CONFLICT DO NOTHING",
                (owner,),
            )
            cur.execute(
                "INSERT INTO devs (token_id, name, owner_address, archetype) "
                "VALUES (%s, %s, %s, %s)",
                (token_id, f"dev{token_id}", owner, archetype),
            )


def _pending_rows():
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM pending_fund_txs ORDER BY id")
            return list(cur.fetchall())


def _build_valid_receipt(*, sender, amount_nxt, tx_hash=TX_HASH):
    """Produce a receipt dict shaped like eth_getTransactionReceipt
    when the user has successfully transferred amount_nxt to treasury."""
    amount_wei = amount_nxt * (10 ** 18)
    return {
        "status": "0x1",
        "to": NXT_TOKEN,
        "from": sender.lower(),
        "transactionHash": tx_hash,
        "logs": [{
            "address": NXT_TOKEN,
            "topics": [
                TRANSFER_TOPIC,
                "0x" + "00" * 12 + sender[2:].lower(),
                "0x" + "00" * 12 + TREASURY[2:].lower(),
            ],
            "data": hex(amount_wei),
        }],
    }


# ---------------------------------------------------------------------------
# F1 — worker interval is 30s
# ---------------------------------------------------------------------------


def test_fund_retry_interval_is_30_seconds():
    assert engine_mod._FUND_RETRY_INTERVAL_SEC == 30


# ---------------------------------------------------------------------------
# F2 — endpoint fast-fail + no polling loop
# ---------------------------------------------------------------------------


def _call_fund(amount=25, tx_hash=TX_HASH):
    req = shop_mod.FundRequest(
        player_address=WALLET_A,
        dev_token_id=1,
        amount=amount,
        tx_hash=tx_hash,
    )
    return asyncio.run(shop_mod.fund_dev(req))


def test_fund_dev_credits_immediately_when_receipt_available(clean, monkeypatch):
    _seed_dev()
    monkeypatch.setattr(shop_mod.shop_limiter, "check", lambda key: None)

    calls = []
    receipt = _build_valid_receipt(sender=WALLET_A, amount_nxt=25)

    def fake_rpc(method, params=None):
        calls.append(method)
        if method == "eth_getTransactionReceipt":
            return receipt
        return None

    monkeypatch.setattr(shop_mod, "_rpc", fake_rpc)

    result = _call_fund(amount=25)
    assert result["status"] == "funded"
    assert result["amount"] == 25
    # Only ONE getTransactionReceipt call — we no longer poll.
    assert calls.count("eth_getTransactionReceipt") == 1


def test_fund_dev_fast_fails_to_pending_when_receipt_missing(clean, monkeypatch):
    _seed_dev()
    monkeypatch.setattr(shop_mod.shop_limiter, "check", lambda key: None)

    calls = []

    def fake_rpc(method, params=None):
        calls.append(method)
        return None  # RPC hasn't indexed

    monkeypatch.setattr(shop_mod, "_rpc", fake_rpc)

    result = _call_fund(amount=25)
    assert result["status"] == "pending"
    assert result["tx_hash"] == TX_HASH.lower()
    # Single probe, not 30 (60s / 2s interval).
    assert calls.count("eth_getTransactionReceipt") == 1

    rows = _pending_rows()
    assert len(rows) == 1
    assert rows[0]["tx_hash"] == TX_HASH.lower()
    assert rows[0]["amount_nxt"] == 25


def test_fund_dev_response_time_under_2s(clean, monkeypatch):
    """The old implementation busy-waited 60s before returning pending.
    With the single-attempt fix, the fast-fail path must be well under
    2 seconds (stubbed RPC returns instantly, so this catches any
    accidental reintroduction of the sleep loop)."""
    _seed_dev()
    monkeypatch.setattr(shop_mod.shop_limiter, "check", lambda key: None)
    monkeypatch.setattr(shop_mod, "_rpc", lambda method, params=None: None)

    start = _time.time()
    result = _call_fund(amount=25)
    elapsed = _time.time() - start

    assert result["status"] == "pending"
    assert elapsed < 2.0, f"fund_dev took {elapsed:.2f}s — polling loop returned?"


def test_fund_dev_does_not_sleep_on_missing_receipt(clean, monkeypatch):
    """Direct check that time.sleep is never called during the RPC
    phase of fund_dev — guards against reintroduction of any polling."""
    _seed_dev()
    monkeypatch.setattr(shop_mod.shop_limiter, "check", lambda key: None)
    monkeypatch.setattr(shop_mod, "_rpc", lambda method, params=None: None)

    slept = []
    real_sleep = shop_mod.time.sleep
    monkeypatch.setattr(shop_mod.time, "sleep", lambda s: slept.append(s))

    _call_fund(amount=25)
    try:
        assert slept == [], f"fund_dev slept during RPC phase: {slept}"
    finally:
        shop_mod.time.sleep = real_sleep


# ---------------------------------------------------------------------------
# F3 — backoff curve + no hard cap + alert
# ---------------------------------------------------------------------------


def test_compute_next_retry_at_backoff_curve():
    fixed_now = datetime(2026, 4, 18, 12, 0, 0, tzinfo=timezone.utc)
    c = engine_mod._compute_next_retry_at

    # Fast bucket (0-9 attempts) — 30s.
    for n in [1, 5, 9]:
        gap = c(n, fixed_now) - fixed_now
        assert gap == timedelta(seconds=30), f"attempts={n} gap={gap}"

    # Medium bucket (10-19) — 2 min.
    for n in [10, 15, 19]:
        gap = c(n, fixed_now) - fixed_now
        assert gap == timedelta(minutes=2), f"attempts={n} gap={gap}"

    # Slow bucket (20+) — 30 min.
    for n in [20, 50, 100]:
        gap = c(n, fixed_now) - fixed_now
        assert gap == timedelta(minutes=30), f"attempts={n} gap={gap}"


def test_process_pending_funds_respects_next_retry_at(clean, monkeypatch):
    """A row whose next_retry_at is in the future must be skipped, and
    the RPC must not be called for it."""
    _seed_dev()
    future = datetime.now(timezone.utc) + timedelta(minutes=10)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pending_fund_txs "
                "(tx_hash, wallet_address, dev_token_id, amount_nxt, "
                "attempts, next_retry_at) "
                "VALUES (%s, %s, 1, 25, 5, %s)",
                (TX_HASH, WALLET_A.lower(), future),
            )

    calls = []
    monkeypatch.setattr(
        engine_mod,
        "_fund_rpc",
        lambda method, params=None: calls.append(method) or None,
    )

    with deps.get_db() as conn:
        engine_mod.process_pending_funds(conn)

    assert calls == [], "worker must not RPC for rows still in backoff"
    # Row untouched: attempts still 5, same next_retry_at (± epsilon).
    row = _pending_rows()[0]
    assert row["attempts"] == 5


def test_process_pending_funds_does_not_abandon_after_10_attempts(clean, monkeypatch):
    """Regression guard: the old `attempts < 10` cap used to silently
    drop rows forever. Now they keep retrying (just less often)."""
    _seed_dev()
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pending_fund_txs "
                "(tx_hash, wallet_address, dev_token_id, amount_nxt, "
                "attempts) "
                "VALUES (%s, %s, 1, 25, 15)",  # over the old cap
                (TX_HASH, WALLET_A.lower()),
            )

    # Simulate RPC still not indexing.
    monkeypatch.setattr(engine_mod, "_fund_rpc", lambda method, params=None: None)

    with deps.get_db() as conn:
        engine_mod.process_pending_funds(conn)

    row = _pending_rows()[0]
    assert row["attempts"] == 16
    assert row["resolved"] is False
    assert row["next_retry_at"] is not None  # rescheduled


def test_admin_logs_alert_at_attempt_20_threshold(clean, monkeypatch):
    """One-shot alert when attempts crosses 19 → 20."""
    _seed_dev()
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pending_fund_txs "
                "(tx_hash, wallet_address, dev_token_id, amount_nxt, "
                "attempts, created_at) "
                "VALUES (%s, %s, 1, 25, 19, NOW() - INTERVAL '30 minutes')",
                (TX_HASH, WALLET_A.lower()),
            )

    monkeypatch.setattr(engine_mod, "_fund_rpc", lambda method, params=None: None)

    with deps.get_db() as conn:
        engine_mod.process_pending_funds(conn)

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n, MAX(payload->>'attempts') AS attempts "
                "FROM admin_logs "
                "WHERE event_type = 'pending_fund_tx_slow_retry_threshold'"
            )
            alert_row = cur.fetchone()
    assert int(alert_row["n"]) == 1
    assert int(alert_row["attempts"]) == 20


def test_admin_logs_alert_fires_only_once(clean, monkeypatch):
    """The alert is keyed on `attempts == 20`. Later cycles pushing
    attempts to 21, 22, ... must NOT fire duplicate alerts."""
    _seed_dev()
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pending_fund_txs "
                "(tx_hash, wallet_address, dev_token_id, amount_nxt, "
                "attempts, created_at) "
                "VALUES (%s, %s, 1, 25, 22, NOW() - INTERVAL '1 hour')",
                (TX_HASH, WALLET_A.lower()),
            )

    monkeypatch.setattr(engine_mod, "_fund_rpc", lambda method, params=None: None)

    with deps.get_db() as conn:
        engine_mod.process_pending_funds(conn)

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM admin_logs "
                "WHERE event_type = 'pending_fund_tx_slow_retry_threshold'"
            )
            n = int(cur.fetchone()["n"])
    assert n == 0, "attempts transitioning through >20 must not re-alert"


# ---------------------------------------------------------------------------
# F4 — admin summary surfaces stuck-pending alert
# ---------------------------------------------------------------------------


@pytest.fixture()
def admin_client(db_pool):
    app = FastAPI()
    app.add_middleware(CorrelationIdMiddleware)
    app.include_router(admin_mod.router, prefix="/api/admin")
    return TestClient(app)


def test_admin_summary_reports_stuck_pending_alert(clean, admin_client, monkeypatch):
    monkeypatch.setattr(
        admin_mod,
        "_fetch_signer_state",
        lambda: {
            "address": "0xdead",
            "eth_balance_wei": 5 * 10**16,
            "nonce_latest": 10,
            "nonce_pending": 10,
            "error": None,
        },
    )
    monkeypatch.setenv("DRY_RUN", "false")

    _seed_dev()
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pending_fund_txs "
                "(tx_hash, wallet_address, dev_token_id, amount_nxt, "
                "attempts, created_at) "
                "VALUES (%s, %s, 1, 25, 22, NOW() - INTERVAL '2 hours')",
                (TX_HASH, WALLET_A.lower()),
            )

    resp = admin_client.get(
        "/api/admin/economy/summary",
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    assert resp.status_code == 200
    alerts = resp.json()["alerts"]
    matching = [a for a in alerts if a.get("type") == "pending_fund_txs_slow"]
    assert len(matching) == 1
    alert = matching[0]
    assert alert["severity"] == "warning"
    assert alert["count"] == 1
    assert alert["total_amount_nxt"] == 25


def test_admin_summary_no_alert_when_no_stuck_pending(clean, admin_client, monkeypatch):
    monkeypatch.setattr(
        admin_mod,
        "_fetch_signer_state",
        lambda: {
            "address": "0xdead",
            "eth_balance_wei": 5 * 10**16,
            "nonce_latest": 10,
            "nonce_pending": 10,
            "error": None,
        },
    )
    monkeypatch.setenv("DRY_RUN", "false")

    # Row exists but is recent — shouldn't trigger the >30min alert.
    _seed_dev()
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pending_fund_txs "
                "(tx_hash, wallet_address, dev_token_id, amount_nxt, "
                "attempts, created_at) "
                "VALUES (%s, %s, 1, 25, 2, NOW() - INTERVAL '5 minutes')",
                (TX_HASH, WALLET_A.lower()),
            )

    resp = admin_client.get(
        "/api/admin/economy/summary",
        headers={"X-Admin-Wallet": ADMIN_WALLET},
    )
    alerts = resp.json()["alerts"]
    assert not any(a.get("type") == "pending_fund_txs_slow" for a in alerts)
