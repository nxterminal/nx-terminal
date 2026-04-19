"""Tests for the 2-phase commit sync flow (PR 2.4).

Exercises both the in-line sync path in
``backend.engine.claim_sync.sync_claimable_balances`` and the
out-of-band reconciler in ``backend.engine.sync_reconciler``. Nothing
here touches MegaETH — the broadcast + receipt paths are mocked so we
can drive each DB transition deterministically.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

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
from backend.engine import claim_sync  # noqa: E402
from backend.engine import sync_reconciler  # noqa: E402


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TABLE devs (
    token_id        INTEGER PRIMARY KEY,
    owner_address   VARCHAR(42) NOT NULL,
    balance_nxt     BIGINT NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    sync_status     TEXT,
    sync_tx_hash    VARCHAR(66),
    sync_started_at TIMESTAMPTZ
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
def clean_db(db_pool):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE devs, admin_logs RESTART IDENTITY")


def _seed(rows: Iterable[tuple]):
    """Each row: (token_id, balance_nxt, sync_status, sync_tx_hash, started_offset_seconds)"""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for row in rows:
                if len(row) == 2:
                    tid, bal = row
                    cur.execute(
                        "INSERT INTO devs (token_id, owner_address, balance_nxt) "
                        "VALUES (%s, %s, %s)",
                        (tid, "0x" + "aa" * 20, bal),
                    )
                else:
                    tid, bal, sstatus, stx, offset_s = row
                    cur.execute(
                        "INSERT INTO devs (token_id, owner_address, balance_nxt, "
                        "sync_status, sync_tx_hash, sync_started_at) "
                        "VALUES (%s, %s, %s, %s, %s, NOW() - make_interval(secs => %s))",
                        (tid, "0x" + "aa" * 20, bal, sstatus, stx, offset_s),
                    )


def _rows() -> List[Dict[str, Any]]:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM devs ORDER BY token_id")
            return list(cur.fetchall())


@pytest.fixture()
def patch_sync_env(monkeypatch):
    """Put claim_sync into LIVE mode with a stub signer."""
    monkeypatch.setattr(claim_sync, "DRY_RUN", False)
    monkeypatch.setattr(claim_sync, "SIGNER_PRIVATE_KEY", "0x" + "11" * 32)

    class FakeSigner:
        address = "0x" + "ab" * 20

        def get_eth_balance_wei(self):
            return 10 ** 18

    monkeypatch.setattr(claim_sync, "get_signer", lambda: FakeSigner())


def _install_broadcast(monkeypatch, tx_hash: str = "0x" + "ee" * 32):
    """Default: broadcast succeeds and returns tx_hash."""
    captured = {"called": 0, "ids": None, "amounts": None}

    def fake_broadcast(ids, amounts):
        captured["called"] += 1
        captured["ids"] = list(ids)
        captured["amounts"] = list(amounts)
        return tx_hash

    monkeypatch.setattr(claim_sync, "_broadcast_batch", fake_broadcast)
    return captured


# ---------------------------------------------------------------------------
# Phase helpers (unit-level)
# ---------------------------------------------------------------------------


def test_mark_syncing_claims_eligible_rows_only(clean_db):
    _seed([
        (1, 100, None, None, 0),
        (2, 200, "failed", None, 0),
        (3, 300, "syncing", "0xprev", 5),  # in-flight
        (4, 400, "synced", "0xold", 100),
    ])
    with deps.get_db() as conn:
        claimed = claim_sync._mark_syncing(conn, [1, 2, 3, 4])

    assert sorted(claimed) == [1, 2, 4]
    rows = {r["token_id"]: r for r in _rows()}
    assert rows[1]["sync_status"] == "syncing"
    assert rows[2]["sync_status"] == "syncing"
    assert rows[4]["sync_status"] == "syncing"
    assert rows[3]["sync_status"] == "syncing"  # already in-flight, untouched
    assert rows[3]["sync_tx_hash"] == "0xprev"


def test_finalize_success_zeros_balance(clean_db):
    _seed([(1, 100, "syncing", "0xabc", 5)])
    with deps.get_db() as conn:
        claim_sync._finalize_success(conn, [1], "0xabc")

    row = _rows()[0]
    assert row["balance_nxt"] == 0
    assert row["sync_status"] == "synced"


def test_finalize_failed_preserves_balance(clean_db):
    _seed([(1, 100, "syncing", "0xabc", 5)])
    with deps.get_db() as conn:
        claim_sync._finalize_failed(conn, [1], "0xabc", reason="reverted")

    row = _rows()[0]
    assert row["balance_nxt"] == 100  # untouched
    assert row["sync_status"] == "failed"


def test_get_pending_claims_excludes_syncing(clean_db):
    _seed([
        (1, 100, None, None, 0),
        (2, 200, "failed", None, 0),  # eligible (retry)
        (3, 300, "syncing", "0xabc", 5),  # in-flight, skip
        (4, 400, "synced", None, 0),  # eligible (balance still > 0)
    ])
    with deps.get_db() as conn:
        pending = claim_sync.get_pending_claims(conn)

    ids = sorted(p["token_id"] for p in pending)
    assert ids == [1, 2, 4]


# ---------------------------------------------------------------------------
# End-to-end sync_claimable_balances
# ---------------------------------------------------------------------------


def test_successful_sync_sets_synced_and_zero_balance(clean_db, patch_sync_env, monkeypatch):
    _seed([(1, 100, None, None, 0), (2, 200, None, None, 0)])
    _install_broadcast(monkeypatch)
    monkeypatch.setattr(
        claim_sync, "_wait_for_receipt",
        lambda tx_hash, timeout_seconds=30: {"status": "0x1", "blockNumber": "0x1", "gasUsed": "0x5208"},
    )

    with deps.get_db() as conn:
        result = claim_sync.sync_claimable_balances(
            db_conn=conn, wait_for_receipt=True
        )

    assert isinstance(result, dict)
    assert result["status"] == "ok"
    assert result["synced"] == 2
    rows = {r["token_id"]: r for r in _rows()}
    assert rows[1]["balance_nxt"] == 0
    assert rows[1]["sync_status"] == "synced"
    assert rows[1]["sync_tx_hash"] is not None
    assert rows[2]["balance_nxt"] == 0


def test_reverted_tx_preserves_balance(clean_db, patch_sync_env, monkeypatch):
    _seed([(1, 100, None, None, 0), (2, 200, None, None, 0)])
    _install_broadcast(monkeypatch)
    monkeypatch.setattr(
        claim_sync, "_wait_for_receipt",
        lambda tx_hash, timeout_seconds=30: {"status": "0x0", "blockNumber": "0x1", "gasUsed": "0x5208"},
    )

    with deps.get_db() as conn:
        result = claim_sync.sync_claimable_balances(
            db_conn=conn, wait_for_receipt=True
        )

    assert isinstance(result, dict)
    assert result["synced"] == 0
    assert result["failed"] == 2
    rows = {r["token_id"]: r for r in _rows()}
    assert rows[1]["balance_nxt"] == 100  # preserved
    assert rows[2]["balance_nxt"] == 200
    assert rows[1]["sync_status"] == "failed"


def test_receipt_timeout_leaves_syncing_for_reconciler(clean_db, patch_sync_env, monkeypatch):
    _seed([(1, 100, None, None, 0)])
    _install_broadcast(monkeypatch)
    monkeypatch.setattr(
        claim_sync, "_wait_for_receipt",
        lambda tx_hash, timeout_seconds=30: None,  # timeout
    )

    with deps.get_db() as conn:
        result = claim_sync.sync_claimable_balances(
            db_conn=conn, wait_for_receipt=True
        )

    assert result["synced"] == 0
    assert result["pending"] == 1
    row = _rows()[0]
    assert row["balance_nxt"] == 100  # preserved
    assert row["sync_status"] == "syncing"  # reconciler will finish
    assert row["sync_tx_hash"] is not None


def test_broadcast_failure_rolls_back_syncing(clean_db, patch_sync_env, monkeypatch):
    _seed([(1, 100, None, None, 0)])
    monkeypatch.setattr(claim_sync, "_broadcast_batch", lambda ids, amounts: None)

    with deps.get_db() as conn:
        result = claim_sync.sync_claimable_balances(
            db_conn=conn, wait_for_receipt=True
        )

    assert result["failed"] == 1
    row = _rows()[0]
    assert row["balance_nxt"] == 100  # preserved
    assert row["sync_status"] == "failed"
    assert row["sync_tx_hash"] is None  # rolled back before attach


def test_async_mode_leaves_syncing_without_polling(clean_db, patch_sync_env, monkeypatch):
    _seed([(1, 100, None, None, 0)])
    _install_broadcast(monkeypatch)
    # _wait_for_receipt must NOT be called in async mode.
    wait_called = {"n": 0}

    def _should_not_be_called(*a, **kw):
        wait_called["n"] += 1
        return None

    monkeypatch.setattr(claim_sync, "_wait_for_receipt", _should_not_be_called)

    with deps.get_db() as conn:
        result = claim_sync.sync_claimable_balances(
            db_conn=conn, wait_for_receipt=False
        )

    assert wait_called["n"] == 0
    assert result["pending"] == 1
    row = _rows()[0]
    assert row["sync_status"] == "syncing"
    assert row["sync_tx_hash"] is not None


def test_currently_syncing_dev_not_picked_up_again(clean_db, patch_sync_env, monkeypatch):
    _seed([
        (1, 100, "syncing", "0xold", 5),  # in-flight — must be skipped
        (2, 200, None, None, 0),          # fresh candidate
    ])
    captured = _install_broadcast(monkeypatch)
    monkeypatch.setattr(
        claim_sync, "_wait_for_receipt",
        lambda tx_hash, timeout_seconds=30: {"status": "0x1", "blockNumber": "0x1", "gasUsed": "0x5208"},
    )

    with deps.get_db() as conn:
        result = claim_sync.sync_claimable_balances(
            db_conn=conn, wait_for_receipt=True
        )

    assert result["synced"] == 1
    assert captured["ids"] == [2]  # only the eligible dev made it into calldata
    rows = {r["token_id"]: r for r in _rows()}
    assert rows[1]["sync_status"] == "syncing"  # untouched
    assert rows[1]["sync_tx_hash"] == "0xold"
    assert rows[2]["sync_status"] == "synced"


def test_previously_failed_dev_eligible_for_retry(clean_db, patch_sync_env, monkeypatch):
    _seed([(1, 150, "failed", "0xbad", 5)])
    _install_broadcast(monkeypatch)
    monkeypatch.setattr(
        claim_sync, "_wait_for_receipt",
        lambda tx_hash, timeout_seconds=30: {"status": "0x1", "blockNumber": "0x1", "gasUsed": "0x5208"},
    )

    with deps.get_db() as conn:
        result = claim_sync.sync_claimable_balances(
            db_conn=conn, wait_for_receipt=True
        )

    assert result["synced"] == 1
    row = _rows()[0]
    assert row["balance_nxt"] == 0
    assert row["sync_status"] == "synced"


# ---------------------------------------------------------------------------
# Reconciler
# ---------------------------------------------------------------------------


class _FakeSigner:
    def __init__(self, receipts):
        self._receipts = receipts  # tx_hash -> receipt | None | Exception

    def _rpc_call(self, method, params, timeout=15.0):
        assert method == "eth_getTransactionReceipt"
        key = params[0]
        val = self._receipts.get(key)
        if isinstance(val, BaseException):
            raise val
        return val


def _patch_reconciler_signer(monkeypatch, receipts):
    monkeypatch.setattr(sync_reconciler, "get_signer", lambda: _FakeSigner(receipts))


def test_reconciler_promotes_syncing_to_synced(clean_db, monkeypatch):
    _seed([(1, 100, "syncing", "0xdead", 120)])  # stuck for 2 minutes
    _patch_reconciler_signer(monkeypatch, {
        "0xdead": {"status": "0x1", "blockNumber": "0x1"},
    })

    with deps.get_db() as conn:
        resolved = sync_reconciler.reconcile_pending_syncs(conn)

    assert resolved == 1
    row = _rows()[0]
    assert row["balance_nxt"] == 0
    assert row["sync_status"] == "synced"


def test_reconciler_promotes_syncing_to_failed(clean_db, monkeypatch):
    _seed([(1, 100, "syncing", "0xdead", 120)])
    _patch_reconciler_signer(monkeypatch, {
        "0xdead": {"status": "0x0", "blockNumber": "0x1"},
    })

    with deps.get_db() as conn:
        resolved = sync_reconciler.reconcile_pending_syncs(conn)

    assert resolved == 1
    row = _rows()[0]
    assert row["balance_nxt"] == 100  # preserved
    assert row["sync_status"] == "failed"


def test_reconciler_skips_pending_txs(clean_db, monkeypatch):
    _seed([(1, 100, "syncing", "0xdead", 120)])
    _patch_reconciler_signer(monkeypatch, {"0xdead": None})  # still mempool

    with deps.get_db() as conn:
        resolved = sync_reconciler.reconcile_pending_syncs(conn)

    assert resolved == 0
    row = _rows()[0]
    assert row["sync_status"] == "syncing"  # unchanged


def test_reconciler_skips_recent_syncing(clean_db, monkeypatch):
    # Only 10s old — below the 30s stuck threshold. Main path may still
    # be polling; stay out of its way.
    _seed([(1, 100, "syncing", "0xdead", 10)])
    _patch_reconciler_signer(monkeypatch, {
        "0xdead": {"status": "0x1", "blockNumber": "0x1"},
    })

    with deps.get_db() as conn:
        resolved = sync_reconciler.reconcile_pending_syncs(conn)

    assert resolved == 0
    row = _rows()[0]
    assert row["sync_status"] == "syncing"


def test_reconciler_survives_rpc_error(clean_db, monkeypatch):
    _seed([(1, 100, "syncing", "0xbad", 120)])
    from backend.services.signer import SignerError
    _patch_reconciler_signer(monkeypatch, {"0xbad": SignerError("rpc down")})

    with deps.get_db() as conn:
        resolved = sync_reconciler.reconcile_pending_syncs(conn)

    assert resolved == 0
    row = _rows()[0]
    assert row["sync_status"] == "syncing"  # left for next tick
