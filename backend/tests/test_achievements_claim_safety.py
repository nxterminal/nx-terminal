"""Tests for fix/achievements-claim-order-safety.

The bug the fix prevents: /achievements/claim used to mark
player_achievements.claimed=TRUE and THEN look up an active dev to
credit. If the wallet had no active dev, the credit branch silently
skipped but the UPDATE already committed — the reward was lost and
the achievement couldn't be claimed again.

These tests lock in the safer order (verify dev first, raise 400
before any mutation) and serve as regression guards.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import psycopg2
import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
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
from fastapi import HTTPException  # noqa: E402


WALLET = "0x" + "a1" * 20


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TYPE archetype_enum AS ENUM (
    '10X_DEV', 'LURKER', 'DEGEN', 'GRINDER',
    'INFLUENCER', 'HACKTIVIST', 'FED', 'SCRIPT_KIDDIE'
);

CREATE TABLE players (
    wallet_address VARCHAR(42) PRIMARY KEY
);

CREATE TABLE devs (
    token_id      INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    archetype     archetype_enum NOT NULL,
    balance_nxt   BIGINT NOT NULL DEFAULT 0,
    total_earned  BIGINT NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE achievements (
    id                VARCHAR(40) PRIMARY KEY,
    title             VARCHAR(80) NOT NULL,
    description       TEXT NOT NULL,
    category          VARCHAR(30) NOT NULL,
    icon              VARCHAR(10) NOT NULL DEFAULT '?',
    reward_nxt        INTEGER NOT NULL DEFAULT 0,
    requirement_type  VARCHAR(40) NOT NULL,
    requirement_value INTEGER NOT NULL DEFAULT 1,
    rarity            VARCHAR(20) NOT NULL DEFAULT 'common'
);

CREATE TABLE player_achievements (
    wallet_address  VARCHAR(42) NOT NULL,
    achievement_id  VARCHAR(40) NOT NULL REFERENCES achievements(id),
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed         BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (wallet_address, achievement_id)
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
            cur.execute("TRUNCATE player_achievements RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE devs RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE players RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE achievements RESTART IDENTITY CASCADE")


def _seed_achievement(ach_id="first_mint", reward_nxt=100, title="First Mint"):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO achievements (id, title, description, category, "
                "reward_nxt, requirement_type, requirement_value) "
                "VALUES (%s, %s, 'desc', 'milestone', %s, 'total_devs_minted', 1)",
                (ach_id, title, reward_nxt),
            )


def _seed_player(wallet=WALLET):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO players (wallet_address) VALUES (%s) "
                "ON CONFLICT DO NOTHING",
                (wallet,),
            )


def _seed_dev(token_id=1, owner=WALLET, status="active"):
    _seed_player(owner)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO devs (token_id, name, owner_address, archetype, status) "
                "VALUES (%s, %s, %s, '10X_DEV', %s)",
                (token_id, f"dev{token_id}", owner, status),
            )


def _unlock(wallet=WALLET, ach_id="first_mint", claimed=False):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO player_achievements (wallet_address, achievement_id, claimed) "
                "VALUES (%s, %s, %s)",
                (wallet, ach_id, claimed),
            )


def _claimed_flag(wallet=WALLET, ach_id="first_mint") -> bool:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT claimed FROM player_achievements "
                "WHERE wallet_address = %s AND achievement_id = %s",
                (wallet, ach_id),
            )
            row = cur.fetchone()
            return bool(row["claimed"]) if row else False


def _dev_balance(token_id=1) -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT balance_nxt FROM devs WHERE token_id = %s",
                (token_id,),
            )
            row = cur.fetchone()
            return int(row["balance_nxt"]) if row else 0


def _call_claim(ach_id="first_mint", wallet=WALLET):
    req = achievements_mod.AchievementClaimRequest(
        wallet=wallet, achievement_id=ach_id,
    )
    return asyncio.run(achievements_mod.claim_achievement(req))


# ---------------------------------------------------------------------------
# The fix: order-of-operations
# ---------------------------------------------------------------------------


def test_claim_without_active_dev_raises_400_and_keeps_claimed_false(clean):
    """Wallet with no devs: endpoint must raise 400 and leave
    player_achievements.claimed = FALSE so the user can try again
    after minting."""
    _seed_achievement(reward_nxt=100)
    _seed_player()  # registered but no dev
    _unlock(claimed=False)

    with pytest.raises(HTTPException) as excinfo:
        _call_claim()

    assert excinfo.value.status_code == 400
    assert "active dev" in excinfo.value.detail.lower()
    assert _claimed_flag() is False  # ← the critical assert


def test_claim_with_frozen_devs_only_raises_400(clean):
    """A wallet with devs but all in status='frozen' must behave the
    same way as no-devs: the SELECT filters status IN (active,on_mission)."""
    _seed_achievement(reward_nxt=100)
    _seed_dev(token_id=1, status="frozen")
    _unlock(claimed=False)

    with pytest.raises(HTTPException) as excinfo:
        _call_claim()
    assert excinfo.value.status_code == 400
    assert _claimed_flag() is False


def test_claim_with_active_dev_credits_first_dev_and_marks_claimed(clean):
    """Happy-path regression guard."""
    _seed_achievement(reward_nxt=100)
    _seed_dev(token_id=1, status="active")
    _seed_dev(token_id=2, status="active")
    _unlock(claimed=False)

    result = _call_claim()

    assert result["success"] is True
    assert result["reward"] == 100
    assert result["dev_name"] == "dev1"  # lowest token_id chosen
    assert _claimed_flag() is True
    assert _dev_balance(1) == 100
    assert _dev_balance(2) == 0  # only first active dev is credited


def test_claim_rolls_back_all_mutations_on_no_dev(clean):
    """Even if the UPDATE on player_achievements was attempted
    (pre-fix behaviour), the DBConn context-manager's automatic
    rollback on HTTPException must leave claimed=FALSE. Verifies
    the fix end-to-end: the raise must happen before any mutation."""
    _seed_achievement(reward_nxt=50)
    _seed_player()
    _unlock(claimed=False)

    with pytest.raises(HTTPException):
        _call_claim()

    # claimed stays False, reward is still available.
    assert _claimed_flag() is False


def test_claim_uses_on_mission_dev_if_no_active(clean):
    """The SELECT accepts status IN ('active', 'on_mission'), so a
    dev on mission should still receive the reward (regression guard
    for the SQL filter)."""
    _seed_achievement(reward_nxt=75)
    _seed_dev(token_id=1, status="on_mission")
    _unlock(claimed=False)

    result = _call_claim()
    assert result["success"] is True
    assert _claimed_flag() is True
    assert _dev_balance(1) == 75


def test_already_claimed_achievement_returns_400(clean):
    """Regression: the earlier `if pa["claimed"]: raise 400` still
    fires before we reach the dev lookup."""
    _seed_achievement(reward_nxt=50)
    _seed_dev(token_id=1, status="active")
    _unlock(claimed=True)

    with pytest.raises(HTTPException) as excinfo:
        _call_claim()
    assert excinfo.value.status_code == 400
    assert "already claimed" in excinfo.value.detail.lower()
    # Balance untouched — the second claim didn't double-credit.
    assert _dev_balance(1) == 0


def test_unknown_achievement_returns_404(clean):
    """Regression: 404 for non-existent player_achievement row."""
    _seed_achievement(reward_nxt=50)
    _seed_dev(token_id=1, status="active")
    # No _unlock() — the row doesn't exist.

    with pytest.raises(HTTPException) as excinfo:
        _call_claim()
    assert excinfo.value.status_code == 404
