"""End-to-end tests for Fase 3B shadow writes in engine.py.

Exercises the real ``pay_salaries`` through a minimal schema so we
can verify the ledger rows land. The three other callsites
(sell_investment, pending funds, orphan scanner) are wrapped in
larger functions with external dependencies (RPC, complex tables);
rather than stand them up in full, we test the contract — that the
same arguments the callsite passes to ``ledger_insert`` round-trip
correctly — using the validated helper itself.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Iterable

import psycopg2
import psycopg2.extras
import pytest


BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
# engine.py uses "from config import *" — make its directory importable.
ENGINE_DIR = BACKEND_ROOT / "engine"
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
from backend.engine import engine as engine_mod  # noqa: E402
from backend.services import ledger as ledger_mod  # noqa: E402
from backend.services.ledger import (  # noqa: E402
    LedgerSource,
    is_shadow_write_enabled,
    ledger_insert,
    tx_hash_to_bigint,
)


WALLET_A = "0x" + "a1" * 20
WALLET_B = "0x" + "b2" * 20


# Schema is minimal but needs the enum types `pay_salaries` references.
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
CREATE TYPE rarity_enum AS ENUM (
    'common', 'uncommon', 'rare', 'legendary', 'mythic'
);

CREATE TABLE players (
    wallet_address VARCHAR(42) PRIMARY KEY,
    balance_claimed BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE devs (
    token_id        INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    owner_address   VARCHAR(42) NOT NULL,
    archetype       archetype_enum NOT NULL,
    rarity_tier     rarity_enum NOT NULL DEFAULT 'common',
    balance_nxt     BIGINT NOT NULL DEFAULT 0,
    total_earned    BIGINT NOT NULL DEFAULT 0,
    energy          SMALLINT NOT NULL DEFAULT 10,
    max_energy      SMALLINT NOT NULL DEFAULT 10,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    pc_health       SMALLINT NOT NULL DEFAULT 100,
    caffeine        SMALLINT NOT NULL DEFAULT 50,
    social_vitality SMALLINT NOT NULL DEFAULT 50,
    knowledge       SMALLINT NOT NULL DEFAULT 50,
    bugs_shipped    INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE world_events (
    id          SERIAL PRIMARY KEY,
    event_type  VARCHAR(30) NOT NULL,
    effects     JSONB NOT NULL DEFAULT '{}'::jsonb,
    starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
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
                "world_events RESTART IDENTITY CASCADE"
            )
            cur.execute("TRUNCATE players RESTART IDENTITY CASCADE")


def _seed_devs(rows: Iterable[tuple]):
    """Each row: (token_id, name, owner, archetype, balance_nxt)."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for tid, name, owner, arch, bal in rows:
                cur.execute(
                    "INSERT INTO players (wallet_address) VALUES (%s) "
                    "ON CONFLICT DO NOTHING",
                    (owner,),
                )
                cur.execute(
                    "INSERT INTO devs (token_id, name, owner_address, "
                    "archetype, balance_nxt) VALUES (%s, %s, %s, %s, %s)",
                    (tid, name, owner, arch, bal),
                )


def _ledger_rows():
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM nxt_ledger ORDER BY id")
            return list(cur.fetchall())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def test_tx_hash_to_bigint_handles_common_formats():
    # Sample 32-byte tx hash.
    h = "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
    n = tx_hash_to_bigint(h)
    # First 15 hex chars after 0x → 60 bits max.
    assert isinstance(n, int)
    assert n == int("abcdef0123456789"[:15], 16)
    # Stable: same input → same output.
    assert tx_hash_to_bigint(h) == n
    # Different hash → different value.
    h2 = "0x" + "1" * 64
    assert tx_hash_to_bigint(h2) != n
    # Accepts uppercase.
    assert tx_hash_to_bigint(h.upper()) == n


def test_is_shadow_write_enabled_default_true(monkeypatch):
    monkeypatch.delenv("LEDGER_SHADOW_WRITE", raising=False)
    assert is_shadow_write_enabled() is True


def test_is_shadow_write_enabled_flag_false(monkeypatch):
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "false")
    assert is_shadow_write_enabled() is False


def test_is_shadow_write_enabled_any_other_value_is_true(monkeypatch):
    # Defensive: anything != "false" is considered enabled.
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "yes")
    assert is_shadow_write_enabled() is True


# ---------------------------------------------------------------------------
# Salary (pay_salaries — the real engine function)
# ---------------------------------------------------------------------------


def test_salary_shadow_write_creates_ledger_entry(clean, monkeypatch):
    _seed_devs([
        (1, "alice", WALLET_A, "10X_DEV", 100),
        (2, "bob",   WALLET_B, "LURKER",  200),
    ])
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "true")

    with deps.get_db() as conn:
        engine_mod.pay_salaries(conn)

    rows = _ledger_rows()
    sources = {r["source"] for r in rows}
    assert sources == {"salary"}
    token_ids = sorted(r["dev_token_id"] for r in rows)
    assert token_ids == [1, 2]
    # balance_after snapshots the updated balance.
    by_tid = {r["dev_token_id"]: r for r in rows}
    assert by_tid[1]["balance_after"] > 100
    assert by_tid[2]["balance_after"] > 200


def test_salary_duplicate_same_hour_is_idempotent(clean, monkeypatch):
    _seed_devs([(1, "alice", WALLET_A, "10X_DEV", 100)])
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "true")

    # Freeze time.time() so both runs land in the same epoch_hour.
    frozen = 1_700_000_000
    monkeypatch.setattr(engine_mod.time, "time", lambda: frozen)

    with deps.get_db() as conn:
        engine_mod.pay_salaries(conn)
    with deps.get_db() as conn:
        engine_mod.pay_salaries(conn)

    rows = _ledger_rows()
    assert len(rows) == 1, "second run should collide on idempotency_key"


def test_salary_different_hour_creates_new_entries(clean, monkeypatch):
    _seed_devs([(1, "alice", WALLET_A, "10X_DEV", 100)])
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "true")

    times = iter([1_700_000_000, 1_700_003_600])  # exactly 1h apart

    def next_time():
        return next(times)

    monkeypatch.setattr(engine_mod.time, "time", next_time)

    with deps.get_db() as conn:
        engine_mod.pay_salaries(conn)
    with deps.get_db() as conn:
        engine_mod.pay_salaries(conn)

    rows = _ledger_rows()
    assert len(rows) == 2
    # Different idempotency keys because epoch_hour differs.
    assert rows[0]["idempotency_key"] != rows[1]["idempotency_key"]


def test_shadow_write_disabled_skips_ledger_insert(clean, monkeypatch):
    _seed_devs([(1, "alice", WALLET_A, "10X_DEV", 100)])
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "false")

    with deps.get_db() as conn:
        engine_mod.pay_salaries(conn)

    assert _ledger_rows() == []

    # Balance UPDATE still happened.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT balance_nxt FROM devs WHERE token_id = 1")
            bal = cur.fetchone()["balance_nxt"]
    assert bal > 100


def test_ledger_insert_failure_does_not_break_salary(clean, monkeypatch):
    _seed_devs([(1, "alice", WALLET_A, "10X_DEV", 100)])
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "true")

    def exploding_insert(*args, **kwargs):
        raise RuntimeError("ledger on fire")

    monkeypatch.setattr(engine_mod, "ledger_insert", exploding_insert)

    with deps.get_db() as conn:
        # Must not raise — the shadow write is best-effort.
        engine_mod.pay_salaries(conn)

    # No ledger row (they all threw), but balance was still paid.
    assert _ledger_rows() == []
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT balance_nxt FROM devs WHERE token_id = 1")
            bal = cur.fetchone()["balance_nxt"]
    assert bal > 100


# ---------------------------------------------------------------------------
# The other 3 callsites — contract test
#
# sell_investment / pending_funds / orphan_scanner live inside larger
# routines with heavy external deps (randomness, RPC, complex schemas).
# We exercise the exact ``ledger_insert`` contract the callsite uses,
# with arguments shaped the same way, to lock the wiring.
# ---------------------------------------------------------------------------


def test_sell_investment_shadow_write_contract(clean, monkeypatch):
    _seed_devs([(1, "alice", WALLET_A, "10X_DEV", 500)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur,
                wallet_address=WALLET_A,
                dev_token_id=1,
                delta_nxt=250,
                source=LedgerSource.SELL_INVESTMENT,
                ref_table="protocol_investments",
                ref_id=42,  # protocol_id
            )
            conn.commit()
    assert ok is True
    row = _ledger_rows()[0]
    assert row["source"] == "sell_investment"
    assert row["ref_table"] == "protocol_investments"
    assert row["ref_id"] == 42
    assert row["balance_after"] == 750


def test_pending_funds_shadow_write_contract(clean):
    _seed_devs([(1, "bob", WALLET_B, "LURKER", 0)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur,
                wallet_address=WALLET_B,
                dev_token_id=1,
                delta_nxt=100,
                source=LedgerSource.FUND_DEPOSIT,
                ref_table="pending_fund_txs",
                ref_id=7,  # pending_fund_txs.id
            )
            conn.commit()
    assert ok is True
    row = _ledger_rows()[0]
    assert row["ref_table"] == "pending_fund_txs"


def test_orphan_scanner_shadow_write_contract(clean):
    _seed_devs([(1, "bob", WALLET_B, "LURKER", 0)])
    tx_hash = "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur,
                wallet_address=WALLET_B,
                dev_token_id=1,
                delta_nxt=50,
                source=LedgerSource.FUND_DEPOSIT,
                ref_table="onchain_tx",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            conn.commit()
    assert ok is True
    row = _ledger_rows()[0]
    assert row["ref_table"] == "onchain_tx"
    assert row["ref_id"] == tx_hash_to_bigint(tx_hash)
