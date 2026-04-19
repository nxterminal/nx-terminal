"""
Fix 2 — orphan scanner multi-dev disambiguation.

Verifies that scan_orphaned_funds picks the most-recently-active dev
(last_action_at DESC, tie-broken by token_id ASC) when a sender wallet
owns more than one dev, and persists a row in nx.admin_logs so the
disambiguation is auditable by ops.

These tests require a running local PostgreSQL with a `nx` schema
reachable via the env vars NX_DB_HOST/NX_DB_PORT/NX_DB_USER/NX_DB_PASS/
NX_DB_NAME. The minimal schema is created per-module and torn down
between tests via TRUNCATE.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import psycopg2
import psycopg2.extras
import pytest

# Make `from config import *` / `from templates import *` work because
# engine.py does flat imports relative to backend/engine.
_ENGINE_DIR = Path(__file__).resolve().parents[1] / "engine"
if str(_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ENGINE_DIR))

os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
# Disable ledger shadow writes — the minimal schema doesn't carry nxt_ledger
# and this test only cares about the disambiguation + admin_logs contract.
os.environ["LEDGER_SHADOW_WRITE"] = "false"

import engine  # noqa: E402
from engine import scan_orphaned_funds  # noqa: E402


WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
TREASURY = engine._FUND_TREASURY  # already lowercased
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
    resolved        BOOLEAN NOT NULL DEFAULT false
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
"""


def _connect():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=os.environ["NX_DB_PORT"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
        dbname=os.environ["NX_DB_NAME"],
        options="-c search_path=nx",
    )


@pytest.fixture(scope="module", autouse=True)
def schema():
    conn = _connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()
    yield


@pytest.fixture(autouse=True)
def clean():
    conn = _connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "TRUNCATE admin_logs, actions, pending_fund_txs, funding_txs, "
            "devs, players RESTART IDENTITY CASCADE"
        )
    conn.close()
    yield


def _seed_player(conn, wallet):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO players (wallet_address) VALUES (%s) "
            "ON CONFLICT DO NOTHING",
            (wallet,),
        )


def _seed_dev(conn, token_id, wallet, *, name=None, last_action_at=None):
    _seed_player(conn, wallet)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO devs (token_id, name, owner_address, last_action_at) "
            "VALUES (%s, %s, %s, %s)",
            (token_id, name or f"dev_{token_id}", wallet, last_action_at),
        )


def _transfer_event(sender_wallet, amount_nxt, tx_hash):
    pad = lambda addr: "0x" + "0" * 24 + addr[2:]
    amount_wei = amount_nxt * (10 ** 18)
    return {
        "transactionHash": tx_hash,
        "topics": [TRANSFER_TOPIC, pad(sender_wallet), pad(TREASURY)],
        "data": hex(amount_wei),
    }


def _fake_rpc_factory(events):
    """Build an _fund_rpc stub that returns a chain head and the given events."""

    def _rpc(method, params):
        if method == "eth_blockNumber":
            return hex(500)
        if method == "eth_getLogs":
            return events
        return None

    return _rpc


def _run_scan(events):
    conn = _connect()
    conn.autocommit = False
    with patch.object(engine, "_fund_rpc", side_effect=_fake_rpc_factory(events)):
        try:
            scan_orphaned_funds(conn)
        finally:
            conn.close()


def _query(sql, params=()):
    conn = _connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params)
    rows = cur.fetchall()
    conn.close()
    return rows


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_orphan_scanner_picks_most_recent_action_dev():
    """With two devs, the one with a newer last_action_at wins."""
    setup = _connect()
    setup.autocommit = True
    now = datetime.now(timezone.utc)
    _seed_dev(setup, 10, WALLET_A, last_action_at=now - timedelta(days=5))
    _seed_dev(setup, 11, WALLET_A, last_action_at=now - timedelta(minutes=2))
    _seed_dev(setup, 12, WALLET_A, last_action_at=now - timedelta(hours=3))
    setup.close()

    tx = "0x" + "e1" * 32
    _run_scan([_transfer_event(WALLET_A, 123, tx)])

    rows = _query("SELECT dev_token_id, amount_nxt FROM funding_txs")
    assert len(rows) == 1
    assert rows[0]["dev_token_id"] == 11
    assert int(rows[0]["amount_nxt"]) == 123

    dev11 = _query("SELECT balance_nxt, total_earned FROM devs WHERE token_id = 11")[0]
    assert int(dev11["balance_nxt"]) == 123
    assert int(dev11["total_earned"]) == 123

    other = _query("SELECT balance_nxt FROM devs WHERE token_id IN (10, 12)")
    assert all(int(r["balance_nxt"]) == 0 for r in other)


def test_orphan_scanner_fallback_to_token_id_when_null_last_action():
    """All devs have NULL last_action_at → lowest token_id wins."""
    setup = _connect()
    setup.autocommit = True
    _seed_dev(setup, 77, WALLET_A, last_action_at=None)
    _seed_dev(setup, 42, WALLET_A, last_action_at=None)
    _seed_dev(setup, 99, WALLET_A, last_action_at=None)
    setup.close()

    tx = "0x" + "e2" * 32
    _run_scan([_transfer_event(WALLET_A, 50, tx)])

    rows = _query("SELECT dev_token_id FROM funding_txs")
    assert len(rows) == 1
    assert rows[0]["dev_token_id"] == 42

    # Ensure a dev with NULL last_action_at still loses to any dev that has one.
    setup = _connect()
    setup.autocommit = True
    with setup.cursor() as cur:
        cur.execute(
            "TRUNCATE actions, pending_fund_txs, funding_txs, devs, players "
            "RESTART IDENTITY CASCADE"
        )
    now = datetime.now(timezone.utc)
    _seed_dev(setup, 5, WALLET_B, last_action_at=None)
    _seed_dev(setup, 9, WALLET_B, last_action_at=now - timedelta(days=10))
    setup.close()

    tx2 = "0x" + "e3" * 32
    _run_scan([_transfer_event(WALLET_B, 77, tx2)])
    rows = _query("SELECT dev_token_id FROM funding_txs")
    assert len(rows) == 1
    assert rows[0]["dev_token_id"] == 9


def test_orphan_scanner_logs_disambiguation_when_multiple_devs():
    """An admin_logs row is inserted only when >1 candidate exists."""
    setup = _connect()
    setup.autocommit = True
    now = datetime.now(timezone.utc)
    _seed_dev(setup, 20, WALLET_A, last_action_at=now - timedelta(hours=1))
    _seed_dev(setup, 21, WALLET_A, last_action_at=now - timedelta(days=1))
    setup.close()

    tx = "0x" + "ab" * 32
    _run_scan([_transfer_event(WALLET_A, 42, tx)])

    rows = _query(
        "SELECT event_type, wallet_address, dev_token_id, payload "
        "FROM admin_logs WHERE event_type = 'orphan_scanner_disambiguated_dev'"
    )
    assert len(rows) == 1
    row = rows[0]
    assert row["wallet_address"] == WALLET_A
    assert row["dev_token_id"] == 20
    payload = row["payload"]
    assert payload["tx_hash"] == tx
    assert payload["chosen_dev_token_id"] == 20
    assert payload["total_devs_in_wallet"] == 2
    assert payload["heuristic"] == "most_recent_action"
    assert payload["amount_nxt"] == "42"


def test_orphan_scanner_no_log_when_single_dev():
    """Single-dev wallets must NOT insert a disambiguation audit row."""
    setup = _connect()
    setup.autocommit = True
    _seed_dev(setup, 1, WALLET_A, last_action_at=None)
    setup.close()

    tx = "0x" + "cd" * 32
    _run_scan([_transfer_event(WALLET_A, 10, tx)])

    rows = _query("SELECT dev_token_id FROM funding_txs")
    assert len(rows) == 1 and rows[0]["dev_token_id"] == 1

    audit = _query(
        "SELECT id FROM admin_logs "
        "WHERE event_type = 'orphan_scanner_disambiguated_dev'"
    )
    assert audit == []
