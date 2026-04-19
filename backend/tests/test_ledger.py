"""Tests for backend.services.ledger.ledger_insert and reconciler.

Spans both the helper unit tests and a couple of end-to-end checks
for the reconciler. All tests run against a real local Postgres
with a minimal schema seeded per-fixture.
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

os.environ.pop("DATABASE_URL", None)
os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.api.middleware.correlation import (  # noqa: E402
    reset_correlation_id,
    set_correlation_id,
)
from backend.engine import ledger_reconciler  # noqa: E402
from backend.services import ledger  # noqa: E402
from backend.services.ledger import LedgerSource, ledger_insert  # noqa: E402


WALLET_A = "0x" + "a1" * 20
WALLET_B = "0x" + "b2" * 20


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TABLE players (
    wallet_address   VARCHAR(42) PRIMARY KEY,
    balance_claimed  BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE devs (
    token_id      INTEGER PRIMARY KEY,
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
            cur.execute("TRUNCATE nxt_ledger, admin_logs RESTART IDENTITY")
            cur.execute("TRUNCATE devs RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE players RESTART IDENTITY CASCADE")


def _seed_players(rows: Iterable[tuple]):
    """Each row: (wallet, balance_claimed)."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for wallet, claimed in rows:
                cur.execute(
                    "INSERT INTO players (wallet_address, balance_claimed) "
                    "VALUES (%s, %s)",
                    (wallet, claimed),
                )


def _seed_devs(rows: Iterable[tuple]):
    """Each row: (token_id, owner, balance_nxt)."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            for tid, owner, bal in rows:
                cur.execute(
                    "INSERT INTO devs (token_id, owner_address, balance_nxt) "
                    "VALUES (%s, %s, %s)",
                    (tid, owner, bal),
                )


def _ledger_rows():
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM nxt_ledger ORDER BY id")
            return list(cur.fetchall())


# ---------------------------------------------------------------------------
# Source enum
# ---------------------------------------------------------------------------


def test_ledger_source_is_valid():
    assert LedgerSource.is_valid("salary")
    assert LedgerSource.is_valid("hack_raid_attacker_win")
    assert LedgerSource.is_valid("backfill_manual")
    assert not LedgerSource.is_valid("not_a_real_source")
    assert not LedgerSource.is_valid("")
    # Sanity: every constant is enumerated.
    sources = set(LedgerSource.all_sources())
    assert "salary" in sources
    assert "claim_onchain" in sources
    assert len(sources) >= 16


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_insert_zero_delta_raises_value_error(clean):
    _seed_players([(WALLET_A, 0)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            with pytest.raises(ValueError, match="delta_nxt must not be zero"):
                ledger_insert(
                    cur,
                    wallet_address=WALLET_A,
                    delta_nxt=0,
                    source=LedgerSource.SALARY,
                )


def test_insert_invalid_source_raises(clean):
    _seed_players([(WALLET_A, 0)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            with pytest.raises(ValueError, match="Invalid source"):
                ledger_insert(
                    cur,
                    wallet_address=WALLET_A,
                    delta_nxt=10,
                    source="not_a_source",
                )


def test_insert_invalid_wallet_format_raises(clean):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            with pytest.raises(ValueError, match="wallet_address"):
                ledger_insert(
                    cur,
                    wallet_address="not-a-wallet",
                    delta_nxt=10,
                    source=LedgerSource.SALARY,
                )


def test_insert_rejects_negative_balance_after(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 5)])  # only 5 NXT in the wallet
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            with pytest.raises(ValueError, match="Insufficient balance"):
                ledger_insert(
                    cur,
                    wallet_address=WALLET_A,
                    delta_nxt=-100,  # would put balance_after at -95
                    source=LedgerSource.SHOP_PURCHASE,
                )


# ---------------------------------------------------------------------------
# Happy-path inserts
# ---------------------------------------------------------------------------


def test_insert_credit_returns_true(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 100)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur,
                wallet_address=WALLET_A,
                delta_nxt=50,
                source=LedgerSource.SALARY,
                ref_table="actions",
                ref_id=1234,
            )
            conn.commit()
    assert ok is True
    rows = _ledger_rows()
    assert len(rows) == 1
    assert rows[0]["delta_nxt"] == 50
    assert rows[0]["balance_after"] == 150  # 100 (current sum) + 50
    assert rows[0]["source"] == "salary"
    assert rows[0]["wallet_address"] == WALLET_A.lower()


def test_insert_debit_returns_true(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 100)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ok = ledger_insert(
                cur,
                wallet_address=WALLET_A,
                delta_nxt=-30,
                source=LedgerSource.SHOP_PURCHASE,
                ref_table="shop_purchases",
                ref_id=42,
            )
            conn.commit()
    assert ok is True
    rows = _ledger_rows()
    assert rows[0]["delta_nxt"] == -30
    assert rows[0]["balance_after"] == 70


def test_insert_duplicate_idempotency_returns_false(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 100)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            first = ledger_insert(
                cur, wallet_address=WALLET_A, delta_nxt=50,
                source=LedgerSource.MISSION_CLAIM,
                ref_table="player_missions", ref_id=99,
            )
            second = ledger_insert(
                cur, wallet_address=WALLET_A, delta_nxt=50,
                source=LedgerSource.MISSION_CLAIM,
                ref_table="player_missions", ref_id=99,
            )
            conn.commit()
    assert first is True
    assert second is False
    assert len(_ledger_rows()) == 1


# ---------------------------------------------------------------------------
# balance_after calculation
# ---------------------------------------------------------------------------


def test_insert_calculates_balance_after_with_dev_token_id(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 100), (2, WALLET_A, 500)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, delta_nxt=25,
                source=LedgerSource.SALARY,
                ref_table="actions", ref_id=1,
                dev_token_id=1,  # specific dev — only its balance counts
            )
            conn.commit()
    row = _ledger_rows()[0]
    assert row["dev_token_id"] == 1
    assert row["balance_after"] == 125  # 100 (dev #1) + 25, NOT 600+25


def test_insert_calculates_balance_after_without_dev_token_id(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 100), (2, WALLET_A, 500)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, delta_nxt=25,
                source=LedgerSource.FUND_DEPOSIT,
                ref_table="funding_txs", ref_id=7,
            )
            conn.commit()
    row = _ledger_rows()[0]
    assert row["dev_token_id"] is None
    assert row["balance_after"] == 625  # sum of devs (600) + 25


# ---------------------------------------------------------------------------
# correlation_id propagation
# ---------------------------------------------------------------------------


def test_insert_uses_correlation_id_from_context_if_not_provided(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 100)])
    cid = "11111111-2222-3333-4444-555555555555"
    token = set_correlation_id(cid)
    try:
        with deps.get_db() as conn:
            with conn.cursor() as cur:
                ledger_insert(
                    cur, wallet_address=WALLET_A, delta_nxt=10,
                    source=LedgerSource.SALARY,
                    ref_table="actions", ref_id=1,
                )
                conn.commit()
    finally:
        reset_correlation_id(token)
    row = _ledger_rows()[0]
    assert str(row["correlation_id"]) == cid


def test_insert_prefers_explicit_correlation_id(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 100)])
    ctx_cid = "11111111-1111-1111-1111-111111111111"
    explicit = "22222222-2222-2222-2222-222222222222"
    token = set_correlation_id(ctx_cid)
    try:
        with deps.get_db() as conn:
            with conn.cursor() as cur:
                ledger_insert(
                    cur, wallet_address=WALLET_A, delta_nxt=10,
                    source=LedgerSource.SALARY,
                    ref_table="actions", ref_id=1,
                    correlation_id=explicit,
                )
                conn.commit()
    finally:
        reset_correlation_id(token)
    assert str(_ledger_rows()[0]["correlation_id"]) == explicit


def test_insert_with_no_correlation_id_persists_null(clean):
    _seed_players([(WALLET_A, 0)])
    _seed_devs([(1, WALLET_A, 100)])
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            ledger_insert(
                cur, wallet_address=WALLET_A, delta_nxt=10,
                source=LedgerSource.SALARY,
                ref_table="actions", ref_id=1,
            )
            conn.commit()
    assert _ledger_rows()[0]["correlation_id"] is None


# ---------------------------------------------------------------------------
# Reconciler
# ---------------------------------------------------------------------------


def _seed_ledger_row(
    *,
    wallet: str,
    delta: int,
    balance_after: int,
    source: str = LedgerSource.SALARY,
    ref_table: str = "actions",
    ref_id: int = 1,
):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            idem = f"{source}:{ref_table}:{ref_id}:0:{delta}"
            cur.execute(
                "INSERT INTO nxt_ledger (wallet_address, delta_nxt, "
                "balance_after, source, ref_table, ref_id, idempotency_key) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (wallet.lower(), delta, balance_after, source, ref_table, ref_id, idem),
            )


def test_reconciler_empty_ledger_reports_divergences(clean):
    # Real balances exist but the ledger is empty (shadow-mode steady state).
    _seed_players([(WALLET_A, 100), (WALLET_B, 0)])
    _seed_devs([(1, WALLET_A, 500), (2, WALLET_B, 300)])

    with deps.get_db() as conn:
        result = ledger_reconciler.reconcile_ledger(conn)

    assert result["divergences_found"] == 2  # both wallets diverge
    assert result["total_wallets_checked"] == 2

    # admin_logs row was written
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT payload FROM admin_logs "
                "WHERE event_type = 'ledger_reconciliation_divergences'"
            )
            row = cur.fetchone()
    assert row is not None
    payload = row["payload"]
    assert payload["count"] == 2
    assert payload["total_wallets_checked"] == 2


def test_reconciler_matching_ledger_reports_no_divergences(clean):
    # Wallet A: balance_claimed=100, balance_nxt=500 → actual=600.
    # Ledger sums to 600 too — perfectly reconciled.
    _seed_players([(WALLET_A, 100)])
    _seed_devs([(1, WALLET_A, 500)])
    _seed_ledger_row(
        wallet=WALLET_A, delta=600, balance_after=600,
        source=LedgerSource.SALARY, ref_id=1,
    )

    with deps.get_db() as conn:
        result = ledger_reconciler.reconcile_ledger(conn)

    assert result["divergences_found"] == 0
    # No admin_logs row when the ledger is clean.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM admin_logs "
                "WHERE event_type = 'ledger_reconciliation_divergences'"
            )
            n = cur.fetchone()["n"]
    assert n == 0


def test_reconciler_logs_divergence_payload_top_n(clean):
    # Seed many divergent wallets; the payload caps to top 10.
    rows = []
    for i in range(15):
        wallet = "0x" + f"{i:02x}" * 20
        rows.append((wallet, 100 + i * 10))
    _seed_players(rows)

    with deps.get_db() as conn:
        result = ledger_reconciler.reconcile_ledger(conn)

    assert result["divergences_found"] == 15

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT payload FROM admin_logs "
                "WHERE event_type = 'ledger_reconciliation_divergences' "
                "ORDER BY id DESC LIMIT 1"
            )
            payload = cur.fetchone()["payload"]
    assert payload["count"] == 15
    assert len(payload["top_divergences"]) == 10  # capped
