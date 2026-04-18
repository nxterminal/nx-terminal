"""Tests for Fase 3C shadow writes in shop.py.

Most callsites live inside large endpoints with heavy external
deps (signed Pydantic models, RPC verification for fund, random
for hack rolls). For each callsite we run a contract test —
calling ``ledger_insert`` with the exact arguments + shape the
production callsite uses — plus one end-to-end test on
``transfer_nxt`` which is the cleanest endpoint to drive.
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path
from typing import Iterable

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
from backend.api.routes import shop as shop_mod  # noqa: E402
from backend.services.ledger import (  # noqa: E402
    LedgerSource,
    ledger_insert,
    tx_hash_to_bigint,
)


WALLET_A = "0x" + "a1" * 20
WALLET_B = "0x" + "b2" * 20


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
    wallet_address VARCHAR(42) PRIMARY KEY,
    balance_claimed BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE devs (
    token_id      INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    archetype     archetype_enum NOT NULL,
    balance_nxt   BIGINT NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
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

CREATE TABLE shop_purchases (
    id              SERIAL PRIMARY KEY,
    player_address  VARCHAR(42) NOT NULL,
    target_dev_id   INTEGER,
    item_type       VARCHAR(30) NOT NULL,
    item_effect     JSONB,
    nxt_cost        BIGINT NOT NULL,
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
                "shop_purchases RESTART IDENTITY CASCADE"
            )
            cur.execute("TRUNCATE players RESTART IDENTITY CASCADE")


def _seed_players_and_devs(rows: Iterable[tuple]):
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
# Contract tests — one per shop callsite
# ---------------------------------------------------------------------------


def test_hack_mainframe_success_writes_ledger(clean):
    _seed_players_and_devs([(1, "alice", WALLET_A, "10X_DEV", 100)])
    raid_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur,
                wallet_address=WALLET_A,
                dev_token_id=1,
                delta_nxt=50,
                source=LedgerSource.HACK_MAINFRAME_WIN,
                ref_table="hack_mainframe",
                ref_id=raid_id,
            )
            conn.commit()
    assert ok is True
    rows = _ledger_rows()
    assert len(rows) == 1
    assert rows[0]["source"] == "hack_mainframe_win"
    assert rows[0]["delta_nxt"] == 50
    assert rows[0]["balance_after"] == 150


def test_hack_raid_success_writes_two_sides_same_ref_id(clean):
    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 200),
        (2, "bob",   WALLET_B, "LURKER",  500),
    ])
    raid_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=80,
                source=LedgerSource.HACK_RAID_ATTACKER_WIN,
                ref_table="hack_raids", ref_id=raid_id,
            )
            ledger_insert(
                cur, wallet_address=WALLET_B, dev_token_id=2, delta_nxt=-80,
                source=LedgerSource.HACK_RAID_TARGET_LOSS,
                ref_table="hack_raids", ref_id=raid_id,
            )
            conn.commit()

    rows = _ledger_rows()
    assert len(rows) == 2
    assert {r["ref_id"] for r in rows} == {raid_id}
    assert {r["source"] for r in rows} == {
        "hack_raid_attacker_win", "hack_raid_target_loss",
    }


def test_hack_raid_success_attacker_positive_target_negative(clean):
    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 0),
        (2, "bob",   WALLET_B, "LURKER",  100),
    ])
    raid_id = 12345
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=80,
                source=LedgerSource.HACK_RAID_ATTACKER_WIN,
                ref_table="hack_raids", ref_id=raid_id,
            )
            ledger_insert(
                cur, wallet_address=WALLET_B, dev_token_id=2, delta_nxt=-80,
                source=LedgerSource.HACK_RAID_TARGET_LOSS,
                ref_table="hack_raids", ref_id=raid_id,
            )
            conn.commit()

    rows = {r["source"]: r for r in _ledger_rows()}
    assert rows["hack_raid_attacker_win"]["delta_nxt"] > 0
    assert rows["hack_raid_target_loss"]["delta_nxt"] < 0


def test_hack_raid_fail_writes_target_win_only(clean):
    """The fail path's only balance UPDATE is the target gaining the
    cost. The attacker's loss is the unconditional cost deduction at
    the start of the raid, which lives outside this callsite (and
    isn't ledgered in 3C — see PR description)."""
    _seed_players_and_devs([(2, "bob", WALLET_B, "LURKER", 0)])
    raid_id = 9999
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_B, dev_token_id=2, delta_nxt=25,
                source=LedgerSource.HACK_RAID_TARGET_WIN,
                ref_table="hack_raids", ref_id=raid_id,
            )
            conn.commit()
    rows = _ledger_rows()
    assert len(rows) == 1
    assert rows[0]["source"] == "hack_raid_target_win"
    assert rows[0]["delta_nxt"] == 25


def test_fund_dev_writes_ledger(clean):
    _seed_players_and_devs([(1, "alice", WALLET_A, "10X_DEV", 0)])
    tx_hash = "0x" + "ab" * 32
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur,
                wallet_address=WALLET_A,
                dev_token_id=1,
                delta_nxt=500,
                source=LedgerSource.FUND_DEPOSIT,
                ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            conn.commit()
    assert ok is True
    rows = _ledger_rows()
    assert rows[0]["source"] == "fund_deposit"
    assert rows[0]["ref_table"] == "funding_txs"


def test_fund_dev_idempotent_on_repeat(clean):
    """Same tx_hash through fund_dev twice produces only one row —
    UNIQUE on idempotency_key catches the second attempt."""
    _seed_players_and_devs([(1, "alice", WALLET_A, "10X_DEV", 0)])
    tx_hash = "0x" + "ab" * 32
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            first = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=500,
                source=LedgerSource.FUND_DEPOSIT, ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            second = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=500,
                source=LedgerSource.FUND_DEPOSIT, ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            conn.commit()
    assert first is True
    assert second is False
    assert len(_ledger_rows()) == 1


def test_transfer_writes_two_sides_same_ref_id(clean):
    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 1000),
        (2, "bob",   WALLET_A, "LURKER",  0),  # same owner — common case
    ])
    transfer_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=-300,
                source=LedgerSource.TRANSFER_OUT,
                ref_table="transfers", ref_id=transfer_id,
            )
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=2, delta_nxt=300,
                source=LedgerSource.TRANSFER_IN,
                ref_table="transfers", ref_id=transfer_id,
            )
            conn.commit()

    rows = _ledger_rows()
    assert len(rows) == 2
    assert {r["ref_id"] for r in rows} == {transfer_id}
    assert {r["source"] for r in rows} == {"transfer_out", "transfer_in"}


def test_transfer_sender_negative_receiver_positive(clean):
    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 1000),
        (2, "bob",   WALLET_A, "LURKER",  0),
    ])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=-300,
                source=LedgerSource.TRANSFER_OUT,
                ref_table="transfers", ref_id=1,
            )
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=2, delta_nxt=300,
                source=LedgerSource.TRANSFER_IN,
                ref_table="transfers", ref_id=1,
            )
            conn.commit()
    rows = {r["source"]: r for r in _ledger_rows()}
    assert rows["transfer_out"]["delta_nxt"] == -300
    assert rows["transfer_in"]["delta_nxt"] == 300


# ---------------------------------------------------------------------------
# End-to-end on transfer_nxt — the cleanest endpoint to actually drive
# ---------------------------------------------------------------------------


def _call_transfer(*, from_id: int, to_id: int, amount: int, wallet: str):
    req = shop_mod.TransferRequest(
        player_address=wallet,
        from_dev_token_id=from_id,
        to_dev_token_id=to_id,
        amount=amount,
    )
    return asyncio.run(shop_mod.transfer_nxt(req))


def test_transfer_endpoint_writes_two_ledger_rows(clean, monkeypatch):
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "true")
    monkeypatch.setattr(shop_mod.shop_limiter, "check", lambda key: None)

    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 1000),
        (2, "bob",   WALLET_A, "LURKER",  0),
    ])

    result = _call_transfer(from_id=1, to_id=2, amount=300, wallet=WALLET_A)
    assert result["status"] == "transferred"

    rows = _ledger_rows()
    assert len(rows) == 2
    # Same ref_id on both sides.
    assert len({r["ref_id"] for r in rows}) == 1
    by_src = {r["source"]: r for r in rows}
    assert by_src["transfer_out"]["delta_nxt"] == -300
    assert by_src["transfer_in"]["delta_nxt"] == 300
    assert by_src["transfer_out"]["dev_token_id"] == 1
    assert by_src["transfer_in"]["dev_token_id"] == 2


def test_transfer_shadow_write_disabled_skips_ledger(clean, monkeypatch):
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "false")
    monkeypatch.setattr(shop_mod.shop_limiter, "check", lambda key: None)

    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 1000),
        (2, "bob",   WALLET_A, "LURKER",  0),
    ])

    _call_transfer(from_id=1, to_id=2, amount=300, wallet=WALLET_A)
    assert _ledger_rows() == []

    # Balance UPDATE still happened.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT balance_nxt FROM devs WHERE token_id = 2")
            assert cur.fetchone()["balance_nxt"] == 300


def test_transfer_ledger_failure_does_not_break_endpoint(clean, monkeypatch):
    monkeypatch.setenv("LEDGER_SHADOW_WRITE", "true")
    monkeypatch.setattr(shop_mod.shop_limiter, "check", lambda key: None)

    def exploding_insert(*args, **kwargs):
        raise RuntimeError("ledger on fire")

    monkeypatch.setattr(shop_mod, "ledger_insert", exploding_insert)

    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 1000),
        (2, "bob",   WALLET_A, "LURKER",  0),
    ])

    # Must not raise — best-effort shadow write.
    result = _call_transfer(from_id=1, to_id=2, amount=300, wallet=WALLET_A)
    assert result["status"] == "transferred"

    # Balance UPDATE still committed.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT balance_nxt FROM devs WHERE token_id = 2")
            assert cur.fetchone()["balance_nxt"] == 300
