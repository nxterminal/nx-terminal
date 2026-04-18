"""Tests for the on-chain NXTClaimed listener (PR 2.5).

The listener polls ``eth_getLogs`` for ``NXTClaimed`` emitted by
the NXDevNFT contract and backfills ``claim_history``. The tests
monkeypatch the signer's ``_rpc_call`` with a scripted RPC so
nothing touches the network.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

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
from backend.engine import nxt_claimed_listener as listener  # noqa: E402
from backend.services.event_parser import NXT_CLAIMED_TOPIC  # noqa: E402


WALLET = "0x" + "a1" * 20
WEI = 10 ** 18


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TABLE players (
    wallet_address VARCHAR(42) PRIMARY KEY
);

CREATE TABLE claim_history (
    id             BIGSERIAL PRIMARY KEY,
    player_address VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
    amount_gross   BIGINT NOT NULL,
    amount_net     BIGINT NOT NULL,
    fee_amount     BIGINT NOT NULL DEFAULT 0,
    tx_hash        TEXT,
    tx_block       BIGINT,
    status         TEXT DEFAULT 'confirmed',
    claimed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_claim_history_tx_hash_unique
    ON claim_history(tx_hash)
    WHERE tx_hash IS NOT NULL AND tx_hash <> '';

CREATE TABLE simulation_state (
    key        VARCHAR(50) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
            cur.execute("TRUNCATE claim_history, simulation_state, admin_logs, players RESTART IDENTITY CASCADE")
            cur.execute("INSERT INTO players (wallet_address) VALUES (%s)", (WALLET,))


# ---------------------------------------------------------------------------
# Helpers to build scripted RPC responses
# ---------------------------------------------------------------------------


def _encode_data(token_ids: List[int], gross: int, fee: int, net: int) -> str:
    offset_bytes = 4 * 32
    words = [offset_bytes, gross, fee, net, len(token_ids), *token_ids]
    return "0x" + "".join(f"{w:064x}" for w in words)


def _make_log(
    *,
    user: str,
    tx_hash: str,
    block: int,
    token_ids: List[int] = None,
    gross_wei: int = 100 * WEI,
    fee_wei: int = 20 * WEI,
    net_wei: int = 80 * WEI,
    address: Optional[str] = None,
) -> Dict[str, Any]:
    addr = (address or listener.NXDEVNFT_ADDRESS).lower()
    user_topic = "0x" + "00" * 12 + user.lower()[2:]
    return {
        "address": addr,
        "topics": [NXT_CLAIMED_TOPIC, user_topic],
        "data": _encode_data(token_ids or [1], gross_wei, fee_wei, net_wei),
        "blockNumber": hex(block),
        "transactionHash": tx_hash,
    }


class _ScriptedSigner:
    def __init__(self, *, head_block: int, logs: List[Dict[str, Any]], raise_on: Optional[str] = None):
        self.head_block = head_block
        self.logs = logs
        self.raise_on = raise_on
        self.calls: List[tuple] = []

    def _rpc_call(self, method: str, params: list, timeout: float = 15.0):
        self.calls.append((method, params))
        if self.raise_on == method:
            from backend.services.signer import SignerError
            raise SignerError("scripted rpc failure")
        if method == "eth_blockNumber":
            return hex(self.head_block)
        if method == "eth_getLogs":
            criteria = params[0]
            frm = int(criteria["fromBlock"], 16)
            to = int(criteria["toBlock"], 16)
            return [
                log for log in self.logs
                if frm <= int(log["blockNumber"], 16) <= to
            ]
        raise AssertionError(f"unscripted rpc call: {method}")


@pytest.fixture()
def patch_signer(monkeypatch):
    def installer(signer):
        monkeypatch.setattr(listener, "get_signer", lambda: signer)
        return signer
    return installer


def _seed_checkpoint(block: int):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO simulation_state (key, value) VALUES (%s, %s) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                (listener.CHECKPOINT_KEY, json.dumps(block)),
            )


def _checkpoint() -> Optional[int]:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            return listener.get_last_processed_block(cur)


def _claim_rows():
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM claim_history ORDER BY id")
            return cur.fetchall()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_first_run_initialises_checkpoint_at_head(clean, patch_signer):
    # No checkpoint yet → we should jump to head and not scan anything.
    signer = _ScriptedSigner(head_block=1000, logs=[])
    patch_signer(signer)

    with deps.get_db() as conn:
        inserted = listener.run_listener_once(conn, signer)

    assert inserted == 0
    assert _checkpoint() == 1000
    # No eth_getLogs call on the first run.
    assert all(call[0] != "eth_getLogs" for call in signer.calls)


def test_empty_logs_advances_checkpoint(clean, patch_signer):
    _seed_checkpoint(100)
    signer = _ScriptedSigner(head_block=150, logs=[])
    patch_signer(signer)

    with deps.get_db() as conn:
        inserted = listener.run_listener_once(conn, signer)

    assert inserted == 0
    # head=150, confirmations=2 → safe=148. to_block = min(148, 100+500) = 148.
    assert _checkpoint() == 148


def test_new_event_inserts_claim_history(clean, patch_signer):
    _seed_checkpoint(100)
    tx = "0x" + "aa" * 32
    signer = _ScriptedSigner(
        head_block=150,
        logs=[_make_log(user=WALLET, tx_hash=tx, block=120)],
    )
    patch_signer(signer)

    with deps.get_db() as conn:
        inserted = listener.run_listener_once(conn, signer)

    assert inserted == 1
    rows = _claim_rows()
    assert len(rows) == 1
    assert rows[0]["tx_hash"] == tx
    assert rows[0]["amount_gross"] == 100
    assert rows[0]["amount_net"] == 80
    assert rows[0]["tx_block"] == 120


def test_duplicate_event_is_idempotent(clean, patch_signer):
    _seed_checkpoint(100)
    tx = "0x" + "bb" * 32
    # Pre-insert the same claim (as if /record-claim already recorded it).
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO claim_history (player_address, amount_gross, "
                "amount_net, fee_amount, tx_hash, tx_block) "
                "VALUES (%s, 100, 80, 20, %s, 120)",
                (WALLET, tx),
            )
        conn.commit()

    signer = _ScriptedSigner(
        head_block=150,
        logs=[_make_log(user=WALLET, tx_hash=tx, block=120)],
    )
    patch_signer(signer)

    with deps.get_db() as conn:
        inserted = listener.run_listener_once(conn, signer)

    assert inserted == 0
    assert len(_claim_rows()) == 1  # no duplicate


def test_invalid_event_skipped_without_breaking_loop(clean, patch_signer):
    _seed_checkpoint(100)
    good_tx = "0x" + "cc" * 32
    malformed = {
        "address": listener.NXDEVNFT_ADDRESS,
        "topics": [NXT_CLAIMED_TOPIC, "0xbad"],  # truncated user topic
        "data": "0xnotvalid",
        "blockNumber": hex(110),
        "transactionHash": "0x" + "dd" * 32,
    }
    signer = _ScriptedSigner(
        head_block=150,
        logs=[
            malformed,
            _make_log(user=WALLET, tx_hash=good_tx, block=120),
        ],
    )
    patch_signer(signer)

    with deps.get_db() as conn:
        inserted = listener.run_listener_once(conn, signer)

    # The good one goes in; the malformed one is skipped silently.
    assert inserted == 1
    rows = _claim_rows()
    assert len(rows) == 1
    assert rows[0]["tx_hash"] == good_tx


def test_confirmations_gate_prevents_reading_recent_blocks(clean, patch_signer):
    _seed_checkpoint(100)
    # head=101, confirmations=2 → safe_head=99 ≤ last_block=100 → no work.
    signer = _ScriptedSigner(head_block=101, logs=[])
    patch_signer(signer)

    with deps.get_db() as conn:
        inserted = listener.run_listener_once(conn, signer)

    assert inserted == 0
    assert _checkpoint() == 100  # unchanged
    assert all(call[0] != "eth_getLogs" for call in signer.calls)


def test_max_blocks_per_poll_limits_range(clean, patch_signer, monkeypatch):
    _seed_checkpoint(100)
    monkeypatch.setattr(listener, "MAX_BLOCKS_PER_POLL", 50)
    signer = _ScriptedSigner(head_block=1_000_000, logs=[])
    patch_signer(signer)

    with deps.get_db() as conn:
        listener.run_listener_once(conn, signer)

    assert _checkpoint() == 150  # 100 + 50
    get_logs_calls = [c for c in signer.calls if c[0] == "eth_getLogs"]
    assert len(get_logs_calls) == 1
    criteria = get_logs_calls[0][1][0]
    assert int(criteria["fromBlock"], 16) == 101
    assert int(criteria["toBlock"], 16) == 150


def test_rpc_error_on_block_number_does_not_advance_checkpoint(clean, patch_signer):
    _seed_checkpoint(100)
    signer = _ScriptedSigner(head_block=150, logs=[], raise_on="eth_blockNumber")
    patch_signer(signer)

    with deps.get_db() as conn:
        inserted = listener.run_listener_once(conn, signer)

    assert inserted == 0
    assert _checkpoint() == 100  # unchanged — loop is safe to retry


def test_rpc_error_on_get_logs_does_not_advance_checkpoint(clean, patch_signer):
    _seed_checkpoint(100)
    signer = _ScriptedSigner(head_block=150, logs=[], raise_on="eth_getLogs")
    patch_signer(signer)

    with deps.get_db() as conn:
        inserted = listener.run_listener_once(conn, signer)

    assert inserted == 0
    assert _checkpoint() == 100
