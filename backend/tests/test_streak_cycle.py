"""
Fix 2 — streak rewards are a repeating 7-day cycle.

Covers the cycle-day + reward math (pure functions, no DB) plus the
shape of the claim response (day_in_cycle, cycle_length, next_reward).
The DB-backed end-to-end flow (INSERT + ledger + notification) already
has wider coverage in other suites; here we just verify that the cycle
math wires up correctly.
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import date
from pathlib import Path

import psycopg2
import pytest

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")

from backend.api import deps  # noqa: E402
from backend.api.routes import streaks as streaks_route  # noqa: E402
from backend.api.routes.streaks import (  # noqa: E402
    CYCLE_LENGTH,
    CYCLE_REWARDS,
    StreakClaimRequest,
    compute_cycle_day,
    compute_reward,
)


# ---------------------------------------------------------------------------
# Pure cycle-math tests — no DB required.
# ---------------------------------------------------------------------------


def test_compute_cycle_day_first_week():
    assert compute_cycle_day(1) == 1
    assert compute_cycle_day(2) == 2
    assert compute_cycle_day(3) == 3
    assert compute_cycle_day(7) == 7


def test_compute_cycle_day_second_week():
    # Day 8 wraps back to day 1 with the small reward.
    assert compute_cycle_day(8) == 1
    assert compute_cycle_day(9) == 2
    assert compute_cycle_day(13) == 6
    assert compute_cycle_day(14) == 7


def test_compute_cycle_day_reset_on_broken_streak():
    # A broken streak is persisted as current_streak = 1 by the claim
    # endpoint, so compute_cycle_day(1) must be 1. Also clamp 0/negative
    # just in case the caller peeks at the reset value.
    assert compute_cycle_day(1) == 1
    assert compute_cycle_day(0) == 1
    assert compute_cycle_day(-5) == 1


def test_reward_cycle_values():
    assert compute_reward(1) == 50
    assert compute_reward(7) == 500
    # And wrap: day 8 pays the day-1 reward again.
    assert compute_reward(8) == compute_reward(1) == 50
    # Every cycle position must be defined.
    assert set(CYCLE_REWARDS.keys()) == set(range(1, CYCLE_LENGTH + 1))


# ---------------------------------------------------------------------------
# Response-shape test — exercises claim_streak against a minimal DB.
# ---------------------------------------------------------------------------


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
CREATE TYPE dev_status_enum AS ENUM ('active','resting','frozen','on_mission');

CREATE TABLE players (
    wallet_address TEXT PRIMARY KEY,
    corporation corporation_enum NOT NULL DEFAULT 'CLOSED_AI'
);

CREATE TABLE devs (
    token_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    owner_address TEXT NOT NULL REFERENCES players(wallet_address),
    archetype archetype_enum NOT NULL DEFAULT '10X_DEV',
    balance_nxt BIGINT NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    status dev_status_enum NOT NULL DEFAULT 'active'
);

CREATE TABLE login_streaks (
    wallet_address VARCHAR(42) PRIMARY KEY,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_claim_date DATE,
    total_claimed_nxt BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    player_address TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    dev_id INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
"""


WALLET = "0x" + "c" * 40


def _connect():
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
    conn = _connect()
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
def clean(monkeypatch):
    conn = _connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "TRUNCATE notifications, login_streaks, devs, players "
            "RESTART IDENTITY CASCADE"
        )
        cur.execute(
            "INSERT INTO players (wallet_address) VALUES (%s)", (WALLET,)
        )
        cur.execute(
            "INSERT INTO devs (token_id, name, owner_address) VALUES (1, 'dev_a', %s)",
            (WALLET,),
        )
    conn.close()
    # Shadow-write path references nxt_ledger which isn't in our minimal schema.
    monkeypatch.setattr(streaks_route, "is_shadow_write_enabled", lambda: False)
    yield


def test_claim_response_includes_day_in_cycle():
    res = asyncio.run(
        streaks_route.claim_streak(StreakClaimRequest(wallet=WALLET))
    )
    assert res["success"] is True
    assert res["streak"] == 1
    # New cycle fields
    assert res["day_in_cycle"] == 1
    assert res["cycle_length"] == CYCLE_LENGTH
    assert res["reward"] == CYCLE_REWARDS[1]
    # next_reward previews tomorrow's tier
    assert res["next_reward"] == CYCLE_REWARDS[2]
    # Message advertises the cycle, not an infinite day counter
    assert "of 7" in res["message"] or f"of {CYCLE_LENGTH}" in res["message"]


def test_longest_streak_stays_monotonic_across_cycles():
    """Simulate a streak of 10 by fast-forwarding the row. longest_streak
    must reflect absolute history, not collapse with day_in_cycle."""
    conn = _connect()
    conn.autocommit = True
    from datetime import timedelta
    yesterday = date.today() - timedelta(days=1)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE login_streaks
               SET current_streak = 9, longest_streak = 9,
                   last_claim_date = %s
             WHERE wallet_address = %s
            """,
            (yesterday, WALLET),
        )
        # Ensure the UPDATE actually hit — login_streaks row may not
        # exist yet, so insert-or-update.
        cur.execute(
            """
            INSERT INTO login_streaks (wallet_address, current_streak,
                                       longest_streak, last_claim_date,
                                       total_claimed_nxt)
            VALUES (%s, 9, 9, %s, 0)
            ON CONFLICT (wallet_address) DO UPDATE
              SET current_streak = 9, longest_streak = 9,
                  last_claim_date = EXCLUDED.last_claim_date
            """,
            (WALLET, yesterday),
        )
    conn.close()

    res = asyncio.run(
        streaks_route.claim_streak(StreakClaimRequest(wallet=WALLET))
    )
    assert res["streak"] == 10
    # Day 10 → cycle position 3, reward 100 (not the day-10 absolute tier)
    assert res["day_in_cycle"] == 3
    assert res["reward"] == CYCLE_REWARDS[3]
    # Longest reflects the absolute number
    assert res["longest_streak"] == 10
