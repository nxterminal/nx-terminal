"""Tests for POST /api/players/{wallet}/record-claim.

Fixes audit finding STEP_4 §4.4.3: the endpoint used to trust the
amounts in the request body. Now it fetches the tx receipt on-chain,
parses the NXDevNFT ``NXTClaimed`` event, and writes the event values
to ``claim_history``. The request body is still accepted for shape
compatibility but its amount fields are ignored.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


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
from backend.api.middleware.correlation import CorrelationIdMiddleware  # noqa: E402
from backend.api.routes import players as players_module  # noqa: E402
from backend.services.event_parser import NXT_CLAIMED_TOPIC  # noqa: E402


WALLET = "0x" + "a1" * 20
OTHER_WALLET = "0x" + "b2" * 20
NXDEVNFT = players_module.NXDEVNFT_ADDRESS
TX_HASH = "0x" + "cd" * 32  # valid 66-char hash
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


def _encode_data(token_ids: List[int], gross: int, fee: int, net: int) -> str:
    """ABI-encode NXTClaimed data: (uint256[] tokenIds, uint256 gross,
    uint256 fee, uint256 net). Address is indexed so lives in topics."""
    offset_bytes = 4 * 32  # gross, fee, net, offset itself take first 4 words
    words = [offset_bytes, gross, fee, net, len(token_ids), *token_ids]
    return "0x" + "".join(f"{w:064x}" for w in words)


def _make_log(
    *,
    user: str,
    token_ids: List[int],
    gross_wei: int,
    fee_wei: int,
    net_wei: int,
    address: Optional[str] = None,
    block: int = 4242,
) -> Dict[str, Any]:
    addr = (address or NXDEVNFT).lower()
    user_topic = "0x" + "00" * 12 + user.lower()[2:]
    return {
        "address": addr,
        "topics": [NXT_CLAIMED_TOPIC, user_topic],
        "data": _encode_data(token_ids, gross_wei, fee_wei, net_wei),
        "blockNumber": hex(block),
    }


def _receipt(*, status: str = "0x1", logs: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    return {"status": status, "logs": logs or []}


@pytest.fixture(scope="module")
def app():
    conn = _raw_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()

    deps.init_db_pool(minconn=1, maxconn=4)
    fastapi_app = FastAPI()
    fastapi_app.add_middleware(CorrelationIdMiddleware)
    fastapi_app.include_router(players_module.router, prefix="/api/players")
    try:
        yield fastapi_app
    finally:
        deps.close_db_pool()


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def clean(app):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE claim_history, admin_logs RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE players CASCADE")
            cur.execute("INSERT INTO players (wallet_address) VALUES (%s), (%s)",
                        (WALLET, OTHER_WALLET))


@pytest.fixture()
def patch_rpc(monkeypatch):
    """Stub _rpc_call_sync to return a controllable receipt."""
    state = {"receipt": None, "raise": None}

    def fake_rpc(method, params):
        if state["raise"]:
            raise state["raise"]
        if method == "eth_getTransactionReceipt":
            return state["receipt"]
        raise AssertionError(f"unexpected RPC call: {method}")

    monkeypatch.setattr(players_module, "_rpc_call_sync", fake_rpc)
    return state


def _count_events(event_type: str) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM admin_logs WHERE event_type = %s",
                (event_type,),
            )
            return int(cur.fetchone()["n"])


def _claim_rows():
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM claim_history ORDER BY id")
            return cur.fetchall()


def _post(client, wallet: str, body: Dict[str, Any]):
    return client.post(f"/api/players/{wallet}/record-claim", json=body)


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


def test_invalid_tx_hash_format_returns_400(client, clean):
    resp = _post(client, WALLET, {"tx_hash": "not-a-hash"})
    assert resp.status_code == 400
    assert "tx_hash" in resp.json()["detail"].lower()


def test_missing_tx_hash_returns_400(client, clean):
    resp = _post(client, WALLET, {})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# On-chain verification
# ---------------------------------------------------------------------------


def test_nonexistent_tx_hash_returns_400(client, clean, patch_rpc):
    patch_rpc["receipt"] = None  # receipt unavailable == tx not found / not mined
    resp = _post(client, WALLET, {"tx_hash": TX_HASH})
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"].lower() or "not yet" in resp.json()["detail"].lower()


def test_reverted_tx_returns_400(client, clean, patch_rpc):
    patch_rpc["receipt"] = _receipt(status="0x0", logs=[])
    resp = _post(client, WALLET, {"tx_hash": TX_HASH})
    assert resp.status_code == 400
    assert "reverted" in resp.json()["detail"].lower()


def test_tx_without_nxt_claimed_event_returns_400(client, clean, patch_rpc):
    # Receipt has status=1 but no matching log.
    patch_rpc["receipt"] = _receipt(logs=[])
    resp = _post(client, WALLET, {"tx_hash": TX_HASH})
    assert resp.status_code == 400
    assert "NXTClaimed" in resp.json()["detail"]


def test_event_from_other_contract_returns_400(client, clean, patch_rpc):
    # Correct topic + data but emitted by a different contract.
    rogue = "0x" + "ee" * 20
    patch_rpc["receipt"] = _receipt(logs=[
        _make_log(
            user=WALLET,
            token_ids=[1],
            gross_wei=100 * WEI,
            fee_wei=20 * WEI,
            net_wei=80 * WEI,
            address=rogue,
        ),
    ])
    resp = _post(client, WALLET, {"tx_hash": TX_HASH})
    assert resp.status_code == 400
    assert "NXTClaimed" in resp.json()["detail"]


def test_wallet_mismatch_returns_403_and_audits(client, clean, patch_rpc):
    # Event user is OTHER_WALLET but path targets WALLET.
    patch_rpc["receipt"] = _receipt(logs=[
        _make_log(
            user=OTHER_WALLET,
            token_ids=[7],
            gross_wei=10 * WEI,
            fee_wei=2 * WEI,
            net_wei=8 * WEI,
        ),
    ])
    resp = _post(client, WALLET, {"tx_hash": TX_HASH})
    assert resp.status_code == 403
    assert _count_events("record_claim_wallet_mismatch") == 1
    assert _claim_rows() == []


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_successful_claim_records_event_amounts(client, clean, patch_rpc):
    patch_rpc["receipt"] = _receipt(logs=[
        _make_log(
            user=WALLET,
            token_ids=[1, 2, 3],
            gross_wei=100 * WEI,
            fee_wei=20 * WEI,
            net_wei=80 * WEI,
            block=12345,
        ),
    ])

    resp = _post(client, WALLET, {"tx_hash": TX_HASH})

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "recorded"
    assert body["verified_amounts"] == {"gross": 100, "net": 80, "fee": 20}

    rows = _claim_rows()
    assert len(rows) == 1
    row = rows[0]
    assert row["player_address"] == WALLET
    assert row["amount_gross"] == 100
    assert row["amount_net"] == 80
    assert row["fee_amount"] == 20
    assert row["tx_hash"] == TX_HASH
    assert row["tx_block"] == 12345
    assert row["status"] == "confirmed"

    assert _count_events("record_claim_received") == 1
    assert _count_events("record_claim_verified") == 1


def test_request_amounts_are_ignored(client, clean, patch_rpc):
    """If the client lies about gross/net/fee, the DB reflects the event."""
    patch_rpc["receipt"] = _receipt(logs=[
        _make_log(
            user=WALLET,
            token_ids=[1],
            gross_wei=100 * WEI,
            fee_wei=20 * WEI,
            net_wei=80 * WEI,
        ),
    ])

    resp = _post(client, WALLET, {
        "tx_hash": TX_HASH,
        "amount_gross": 9_999_999,
        "amount_net": 9_999_999,
        "fee_amount": 0,
    })
    assert resp.status_code == 200

    rows = _claim_rows()
    assert rows[0]["amount_gross"] == 100
    assert rows[0]["amount_net"] == 80
    assert rows[0]["fee_amount"] == 20


def test_duplicate_tx_hash_returns_already_recorded(client, clean, patch_rpc):
    patch_rpc["receipt"] = _receipt(logs=[
        _make_log(
            user=WALLET,
            token_ids=[1],
            gross_wei=50 * WEI,
            fee_wei=10 * WEI,
            net_wei=40 * WEI,
        ),
    ])

    first = _post(client, WALLET, {"tx_hash": TX_HASH})
    assert first.status_code == 200
    assert first.json()["status"] == "recorded"

    second = _post(client, WALLET, {"tx_hash": TX_HASH})
    assert second.status_code == 200
    assert second.json()["status"] == "already_recorded"
    assert len(_claim_rows()) == 1
