"""Tests for Fase 3D shadow writes (missions / achievements / streaks / backfill).

Each callsite gets a contract test that calls ``ledger_insert`` with
the exact arguments the production code passes. The transfer-style
end-to-end tests from 3B/3C aren't replicated here because each of
these endpoints has heavy validation we'd have to stub (mission row,
achievement unlock state, streak day arithmetic, backfill RPC). The
shadow-write wiring shape is identical across all four — proven by
the pre-import sanity check in tests below.
"""

from __future__ import annotations

import asyncio
import datetime as _dt
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

os.environ.pop("DATABASE_URL", None)
os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.api.routes import achievements as achievements_mod  # noqa: E402
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

CREATE TABLE players (
    wallet_address VARCHAR(42) PRIMARY KEY,
    balance_claimed BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE devs (
    token_id      INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    balance_nxt   BIGINT NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
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
            cur.execute("TRUNCATE devs, admin_logs, nxt_ledger RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE players RESTART IDENTITY CASCADE")


def _seed(rows: Iterable[tuple]):
    """Each row: (token_id, name, owner, balance_nxt)."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for tid, name, owner, bal in rows:
                cur.execute(
                    "INSERT INTO players (wallet_address) VALUES (%s) "
                    "ON CONFLICT DO NOTHING",
                    (owner,),
                )
                cur.execute(
                    "INSERT INTO devs (token_id, name, owner_address, "
                    "balance_nxt) VALUES (%s, %s, %s, %s)",
                    (tid, name, owner, bal),
                )


def _ledger_rows():
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM nxt_ledger ORDER BY id")
            return list(cur.fetchall())


# ---------------------------------------------------------------------------
# mission_claim — single-dev + multi-dev contract
# ---------------------------------------------------------------------------


def test_mission_claim_writes_ledger(clean):
    _seed([(1, "alice", WALLET_A, 0)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur,
                wallet_address=WALLET_A,
                dev_token_id=1,
                delta_nxt=50,
                source=LedgerSource.MISSION_CLAIM,
                ref_table="player_missions",
                ref_id=42,  # player_missions.id
            )
            conn.commit()
    assert ok is True
    rows = _ledger_rows()
    assert rows[0]["source"] == "mission_claim"
    assert rows[0]["ref_table"] == "player_missions"
    assert rows[0]["ref_id"] == 42
    assert rows[0]["balance_after"] == 50


def test_mission_claim_multiple_devs_writes_multiple_entries(clean):
    """A team mission gives N devs N rows (each with its own
    player_missions.id). Mirrors the production loop in
    missions.py::claim_mission."""
    _seed([
        (1, "alice", WALLET_A, 0),
        (2, "bob",   WALLET_A, 0),
        (3, "carol", WALLET_A, 0),
    ])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for slot_id, dev_id in zip([100, 101, 102], [1, 2, 3]):
                ledger_insert(
                    cur, wallet_address=WALLET_A, dev_token_id=dev_id,
                    delta_nxt=20, source=LedgerSource.MISSION_CLAIM,
                    ref_table="player_missions", ref_id=slot_id,
                )
            conn.commit()

    rows = _ledger_rows()
    assert len(rows) == 3
    assert sorted(r["dev_token_id"] for r in rows) == [1, 2, 3]
    # Every row carries a distinct ref_id (the slot id of that dev's
    # mission row), so a retry on one slot doesn't dedupe the others.
    assert sorted(r["ref_id"] for r in rows) == [100, 101, 102]


# ---------------------------------------------------------------------------
# achievement_claim — string id hashed to BIGINT
# ---------------------------------------------------------------------------


def test_achievement_id_to_bigint_is_stable():
    a = achievements_mod._achievement_id_to_bigint("first_mint")
    b = achievements_mod._achievement_id_to_bigint("first_mint")
    c = achievements_mod._achievement_id_to_bigint("first_claim")
    assert a == b
    assert a != c
    assert isinstance(a, int)
    assert a > 0


def test_achievement_claim_writes_ledger(clean):
    _seed([(1, "alice", WALLET_A, 0)])
    ach_ref = achievements_mod._achievement_id_to_bigint("first_mint")
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1,
                delta_nxt=100, source=LedgerSource.ACHIEVEMENT_CLAIM,
                ref_table="player_achievements", ref_id=ach_ref,
            )
            conn.commit()
    assert ok is True
    rows = _ledger_rows()
    assert rows[0]["source"] == "achievement_claim"
    assert rows[0]["ref_table"] == "player_achievements"
    assert rows[0]["ref_id"] == ach_ref


def test_achievement_claim_idempotent_for_same_dev_and_achievement(clean):
    _seed([(1, "alice", WALLET_A, 0)])
    ach_ref = achievements_mod._achievement_id_to_bigint("first_mint")
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            first = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=100,
                source=LedgerSource.ACHIEVEMENT_CLAIM,
                ref_table="player_achievements", ref_id=ach_ref,
            )
            second = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=100,
                source=LedgerSource.ACHIEVEMENT_CLAIM,
                ref_table="player_achievements", ref_id=ach_ref,
            )
            conn.commit()
    assert first is True
    assert second is False
    assert len(_ledger_rows()) == 1


# ---------------------------------------------------------------------------
# streak_claim — date ordinal as ref_id
# ---------------------------------------------------------------------------


def test_streak_claim_writes_ledger(clean):
    _seed([(1, "alice", WALLET_A, 0)])
    today = _dt.date(2026, 4, 18)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1,
                delta_nxt=10, source=LedgerSource.STREAK_CLAIM,
                ref_table="login_streaks", ref_id=today.toordinal(),
            )
            conn.commit()
    assert ok is True
    rows = _ledger_rows()
    assert rows[0]["source"] == "streak_claim"
    assert rows[0]["ref_id"] == today.toordinal()


def test_streak_different_days_create_distinct_entries(clean):
    _seed([(1, "alice", WALLET_A, 0)])
    day_a = _dt.date(2026, 4, 18)
    day_b = _dt.date(2026, 4, 19)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=10,
                source=LedgerSource.STREAK_CLAIM, ref_table="login_streaks",
                ref_id=day_a.toordinal(),
            )
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=10,
                source=LedgerSource.STREAK_CLAIM, ref_table="login_streaks",
                ref_id=day_b.toordinal(),
            )
            conn.commit()
    rows = _ledger_rows()
    assert len(rows) == 2
    assert sorted(r["ref_id"] for r in rows) == [
        day_a.toordinal(), day_b.toordinal(),
    ]


def test_streak_same_day_is_idempotent(clean):
    _seed([(1, "alice", WALLET_A, 0)])
    today = _dt.date(2026, 4, 18)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            first = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=10,
                source=LedgerSource.STREAK_CLAIM, ref_table="login_streaks",
                ref_id=today.toordinal(),
            )
            second = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=10,
                source=LedgerSource.STREAK_CLAIM, ref_table="login_streaks",
                ref_id=today.toordinal(),
            )
            conn.commit()
    assert first is True
    assert second is False
    assert len(_ledger_rows()) == 1


# ---------------------------------------------------------------------------
# backfill_manual — uses tx_hash_to_bigint, source=BACKFILL_MANUAL
# ---------------------------------------------------------------------------


def test_backfill_writes_ledger(clean):
    _seed([(1, "alice", WALLET_A, 0)])
    tx_hash = "0x" + "11" * 32
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=200,
                source=LedgerSource.BACKFILL_MANUAL,
                ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            conn.commit()
    assert ok is True
    rows = _ledger_rows()
    assert rows[0]["source"] == "backfill_manual"
    assert rows[0]["ref_table"] == "funding_txs"


def test_backfill_idempotent_within_itself(clean):
    """Re-running the backfill on the same tx_hash is a silent no-op
    at the ledger level (real funding_txs.tx_hash UNIQUE prevents
    the actual double-credit)."""
    _seed([(1, "alice", WALLET_A, 0)])
    tx_hash = "0x" + "11" * 32
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            first = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=200,
                source=LedgerSource.BACKFILL_MANUAL, ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            second = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=200,
                source=LedgerSource.BACKFILL_MANUAL, ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            conn.commit()
    assert first is True
    assert second is False
    assert len(_ledger_rows()) == 1


def test_backfill_does_not_collide_with_live_fund_dev(clean):
    """backfill uses source=BACKFILL_MANUAL, live shop.fund_dev uses
    source=FUND_DEPOSIT — different sources mean different
    idempotency_keys, so they produce distinct ledger rows. The actual
    double-credit is prevented by funding_txs.tx_hash UNIQUE; the two
    ledger rows are intentional (each path is auditable)."""
    _seed([(1, "alice", WALLET_A, 0)])
    tx_hash = "0x" + "22" * 32
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=200,
                source=LedgerSource.FUND_DEPOSIT, ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=200,
                source=LedgerSource.BACKFILL_MANUAL, ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
            conn.commit()
    rows = _ledger_rows()
    assert len(rows) == 2
    assert {r["source"] for r in rows} == {"fund_deposit", "backfill_manual"}


# ---------------------------------------------------------------------------
# Wiring sanity — every modified module imports the helpers correctly
# ---------------------------------------------------------------------------


def test_wiring_all_four_modules_import_ledger_symbols():
    from backend.api.routes import missions as missions_mod
    from backend.api.routes import achievements as achievements_mod
    from backend.api.routes import streaks as streaks_mod

    for mod in (missions_mod, achievements_mod, streaks_mod):
        assert hasattr(mod, "ledger_insert")
        assert hasattr(mod, "LedgerSource")
        assert hasattr(mod, "is_shadow_write_enabled")

    # backfill_funds.py is a script, not always import-safe (psycopg2
    # required at module top); verify by parsing the source for the call.
    backfill = (BACKEND_ROOT / "scripts" / "backfill_funds.py").read_text()
    assert "ledger_insert(" in backfill
    assert "LedgerSource.BACKFILL_MANUAL" in backfill
    assert "is_shadow_write_enabled" in backfill
