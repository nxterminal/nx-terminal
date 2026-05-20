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
from backend.tests._seed import seed_player, seed_dev  # noqa: E402
from backend.api.routes import shop as shop_mod  # noqa: E402
from backend.services.ledger import (  # noqa: E402
    LedgerSource,
    ledger_insert,
    tx_hash_to_bigint,
)


WALLET_A = "0x" + "a1" * 20
WALLET_B = "0x" + "b2" * 20




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
    """Each row: (token_id, name, owner, archetype, balance_nxt).

    Phase 5.12 — seeds a synthetic display_name per wallet so the
    nickname_required gate added to shop endpoints (transfer_nxt,
    fund_dev, hack_*) doesn't 409 these tests."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for tid, name, owner, arch, bal in rows:
                # Derive nickname from the wallet so identical owners
                # across rows produce identical names (seed_player is
                # ON CONFLICT DO NOTHING, so the first INSERT wins).
                nick = f"u_{owner[2:10]}"
                seed_player(cur, owner, display_name=nick)
                seed_dev(cur, token_id=tid, owner_address=owner, name=name, archetype=arch, balance_nxt=bal)


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


# ---------------------------------------------------------------------------
# Follow-up to 3C — cost deductions
# ---------------------------------------------------------------------------


def test_enum_has_cost_sources():
    from backend.services.ledger import LedgerSource as LS
    sources = set(LS.all_sources())
    assert "hack_mainframe_cost" in sources
    assert "hack_raid_cost" in sources


def test_hack_mainframe_cost_writes_ledger_row_as_debit(clean):
    _seed_players_and_devs([(1, "alice", WALLET_A, "10X_DEV", 100)])
    mainframe_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1,
                delta_nxt=-25,
                source=LedgerSource.HACK_MAINFRAME_COST,
                ref_table="hack_mainframe", ref_id=mainframe_id,
            )
            conn.commit()
    assert ok is True
    row = _ledger_rows()[0]
    assert row["source"] == "hack_mainframe_cost"
    assert row["delta_nxt"] == -25
    assert row["balance_after"] == 75


def test_hack_mainframe_cost_and_win_share_ref_id(clean):
    _seed_players_and_devs([(1, "alice", WALLET_A, "10X_DEV", 100)])
    mainframe_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=-25,
                source=LedgerSource.HACK_MAINFRAME_COST,
                ref_table="hack_mainframe", ref_id=mainframe_id,
            )
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=60,
                source=LedgerSource.HACK_MAINFRAME_WIN,
                ref_table="hack_mainframe", ref_id=mainframe_id,
            )
            conn.commit()
    rows = _ledger_rows()
    assert len(rows) == 2
    assert {r["ref_id"] for r in rows} == {mainframe_id}
    # Two rows, same event, net PnL for attacker = -25 + 60 = +35.
    assert sum(r["delta_nxt"] for r in rows) == 35


def test_hack_raid_cost_writes_ledger_row_as_debit(clean):
    _seed_players_and_devs([(1, "alice", WALLET_A, "10X_DEV", 100)])
    raid_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1,
                delta_nxt=-25,
                source=LedgerSource.HACK_RAID_COST,
                ref_table="hack_raids", ref_id=raid_id,
            )
            conn.commit()
    assert ok is True
    row = _ledger_rows()[0]
    assert row["source"] == "hack_raid_cost"
    assert row["delta_nxt"] == -25
    assert row["balance_after"] == 75


def test_hack_raid_success_cost_plus_outcome_share_ref_id(clean):
    """On success: cost + attacker_win + target_loss all share one
    raid_event_id. Three rows, one event."""
    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 200),
        (2, "bob",   WALLET_B, "LURKER",  500),
    ])
    raid_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=-25,
                source=LedgerSource.HACK_RAID_COST,
                ref_table="hack_raids", ref_id=raid_id,
            )
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
    assert len(rows) == 3
    assert {r["ref_id"] for r in rows} == {raid_id}
    # Attacker PnL on success = cost + win = -25 + 80 = +55
    attacker_rows = [r for r in rows if r["dev_token_id"] == 1]
    assert sum(r["delta_nxt"] for r in attacker_rows) == 55


def test_hack_raid_fail_cost_plus_target_win_share_ref_id(clean):
    """On fail: cost (attacker) + target_win share one raid_event_id.
    Two rows, one event. Attacker net PnL = -cost; target = +cost."""
    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 200),
        (2, "bob",   WALLET_B, "LURKER",  500),
    ])
    raid_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=-25,
                source=LedgerSource.HACK_RAID_COST,
                ref_table="hack_raids", ref_id=raid_id,
            )
            ledger_insert(
                cur, wallet_address=WALLET_B, dev_token_id=2, delta_nxt=25,
                source=LedgerSource.HACK_RAID_TARGET_WIN,
                ref_table="hack_raids", ref_id=raid_id,
            )
            conn.commit()

    rows = _ledger_rows()
    assert len(rows) == 2
    assert {r["ref_id"] for r in rows} == {raid_id}
    assert sum(r["delta_nxt"] for r in rows) == 0  # zero-sum


def test_hack_raid_full_event_sums_to_attacker_pnl(clean):
    """The whole point of tracking cost separately: summing all rows
    by attacker_wallet for a given raid_event_id gives the exact PnL
    the attacker saw. Success path: -cost + steal."""
    _seed_players_and_devs([
        (1, "alice", WALLET_A, "10X_DEV", 200),
        (2, "bob",   WALLET_B, "LURKER",  500),
    ])
    raid_id = int(time.time() * 1000)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, dev_token_id=1, delta_nxt=-25,
                source=LedgerSource.HACK_RAID_COST,
                ref_table="hack_raids", ref_id=raid_id,
            )
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

    # Query: sum deltas per wallet for this raid.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT wallet_address, SUM(delta_nxt) AS pnl "
                "FROM nxt_ledger WHERE ref_id = %s GROUP BY wallet_address",
                (raid_id,),
            )
            pnl_by_wallet = {r["wallet_address"]: int(r["pnl"]) for r in cur.fetchall()}

    assert pnl_by_wallet[WALLET_A.lower()] == 55   # -25 + 80
    assert pnl_by_wallet[WALLET_B.lower()] == -80  # target loss
