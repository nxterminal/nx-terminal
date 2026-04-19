"""
Fix 1 — /api/players/{wallet}/activity endpoint.

Replaces the pre-fix ActivityTab path (GET /api/notifications filtered
to 5 hardcoded types, most of which were soft-deleted by the kill-
switch in main.py:299-305). The new endpoint reads every row from
nx.actions joined to nx.devs by owner_address so the UI can finally
show the hundreds of RECEIVE_SALARY / CHAT / MOVE / REST / CODE_REVIEW
events the engine emits per hour.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest
from fastapi import HTTPException

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.api.routes import players as players_route  # noqa: E402


WALLET_A = "0x" + "a" * 40
WALLET_B = "0x" + "b" * 40


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
    wallet_address TEXT PRIMARY KEY,
    corporation corporation_enum NOT NULL DEFAULT 'CLOSED_AI'
);

CREATE TABLE devs (
    token_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    owner_address TEXT NOT NULL REFERENCES players(wallet_address),
    archetype archetype_enum NOT NULL DEFAULT '10X_DEV',
    balance_nxt BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE actions (
    id BIGSERIAL PRIMARY KEY,
    dev_id INT NOT NULL,
    dev_name TEXT NOT NULL,
    archetype archetype_enum NOT NULL,
    action_type action_enum NOT NULL,
    details JSONB,
    energy_cost SMALLINT NOT NULL DEFAULT 0,
    nxt_cost BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def _direct_connect():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=os.environ["NX_DB_PORT"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
        dbname=os.environ["NX_DB_NAME"],
        options="-c search_path=nx",
    )


@pytest.fixture(scope="module", autouse=True)
def schema_and_pool():
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()

    deps.DB_HOST = os.environ["NX_DB_HOST"]
    deps.DB_PORT = int(os.environ["NX_DB_PORT"])
    deps.DB_USER = os.environ["NX_DB_USER"]
    deps.DB_PASS = os.environ["NX_DB_PASS"]
    deps.DB_NAME = os.environ["NX_DB_NAME"]
    deps.DB_SSLMODE = "disable"
    deps.init_db_pool(minconn=1, maxconn=4)
    yield
    deps.close_db_pool()


@pytest.fixture(autouse=True)
def clean():
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("TRUNCATE actions, devs, players RESTART IDENTITY CASCADE")
    conn.close()
    yield


def _seed_player(wallet):
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO players (wallet_address) VALUES (%s) ON CONFLICT DO NOTHING",
            (wallet,),
        )
    conn.close()


def _seed_dev(token_id, wallet, name=None):
    _seed_player(wallet)
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO devs (token_id, name, owner_address) VALUES (%s, %s, %s)",
            (token_id, name or f"dev_{token_id}", wallet),
        )
    conn.close()


def _seed_action(dev_id, action_type, *, dev_name=None, details=None):
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO actions (dev_id, dev_name, archetype, action_type, details)
            VALUES (%s, %s, '10X_DEV', %s, %s::jsonb)
            """,
            (dev_id, dev_name or f"dev_{dev_id}", action_type,
             json.dumps(details) if details else None),
        )
    conn.close()


def _call(wallet, *, limit=100, dev_token_id=None):
    return asyncio.run(
        players_route.get_wallet_activity(
            wallet=wallet, limit=limit, dev_token_id=dev_token_id,
        )
    )


# ---------------------------------------------------------------------------


def test_get_activity_returns_actions_for_wallet():
    _seed_dev(1, WALLET_A, name="KIRA-11")
    _seed_action(1, "CHAT", dev_name="KIRA-11", details={"message": "gm"})
    _seed_action(1, "RECEIVE_SALARY", dev_name="KIRA-11", details={"amount": 9})
    _seed_action(1, "MOVE", dev_name="KIRA-11", details={"to": "HACKATHON_HALL"})

    res = _call(WALLET_A)

    assert res["total"] == 3
    types = {row["action_type"] for row in res["activity"]}
    assert types == {"CHAT", "RECEIVE_SALARY", "MOVE"}
    # dev_name / archetype plumbed through
    assert res["activity"][0]["dev_name"] == "KIRA-11"
    assert res["activity"][0]["archetype"] == "10X_DEV"


def test_get_activity_filters_by_dev_token_id():
    _seed_dev(1, WALLET_A, name="dev_one")
    _seed_dev(2, WALLET_A, name="dev_two")
    _seed_action(1, "CHAT")
    _seed_action(1, "REST")
    _seed_action(2, "CODE_REVIEW")

    res = _call(WALLET_A, dev_token_id=2)
    assert res["total"] == 1
    assert res["activity"][0]["dev_id"] == 2
    assert res["activity"][0]["action_type"] == "CODE_REVIEW"


def test_get_activity_limit_parameter_works():
    _seed_dev(1, WALLET_A)
    for _ in range(5):
        _seed_action(1, "CHAT")

    res = _call(WALLET_A, limit=2)
    assert res["total"] == 2
    assert len(res["activity"]) == 2


def test_get_activity_only_returns_wallet_owned_devs_actions():
    """Must JOIN on owner_address — actions for another wallet's dev
    must never leak into the response, even if an attacker guesses a
    dev_token_id that belongs to someone else."""
    _seed_dev(10, WALLET_A, name="mine")
    _seed_dev(20, WALLET_B, name="theirs")
    _seed_action(10, "CHAT", details={"message": "my chat"})
    _seed_action(20, "CHAT", details={"message": "their chat"})

    res_a = _call(WALLET_A)
    assert res_a["total"] == 1
    assert res_a["activity"][0]["dev_id"] == 10

    # Filtering WALLET_A's activity by a dev that isn't theirs must
    # return zero rows, not leak the other wallet's dev.
    res_a_wrong_dev = _call(WALLET_A, dev_token_id=20)
    assert res_a_wrong_dev["total"] == 0

    res_b = _call(WALLET_B)
    assert res_b["total"] == 1
    assert res_b["activity"][0]["dev_id"] == 20


def test_get_activity_rejects_invalid_wallet():
    with pytest.raises(HTTPException) as exc:
        _call("not-a-wallet")
    assert exc.value.status_code == 400


def test_get_activity_case_insensitive_wallet_match():
    """Engine stores owner_address lowercased; the endpoint must
    accept EIP-55 mixed-case hex and still match. The `0x` prefix
    itself must stay lowercase (enforced by validate_wallet)."""
    _seed_dev(1, WALLET_A)
    _seed_action(1, "CHAT")

    mixed_case = "0x" + WALLET_A[2:].upper()
    res = _call(mixed_case)
    assert res["total"] == 1
