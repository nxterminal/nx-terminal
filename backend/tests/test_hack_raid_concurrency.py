"""Concurrency regression test for HACK_RAID target selection.

Two HACK_RAIDs fired simultaneously at the same victim must not be able
to extract more NXT than the victim actually held. Without a row-level
lock on the target SELECT both raids read the same stale balance and
both apply their full steal amount, synthesising NXT out of thin air.
Adding FOR UPDATE serialises target selection and caps total stolen
at the victim's real balance.

Reference: audit_reports/STEP_3_income_sources.md §3.3.1.
"""

from __future__ import annotations

import asyncio
import os
import sys
import threading
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest


BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Point the app at the local test DB before importing deps.
os.environ.pop("DATABASE_URL", None)
os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.api.routes import shop  # noqa: E402


ATTACKER_A_WALLET = "0x" + "a1" * 20
ATTACKER_B_WALLET = "0x" + "a2" * 20
VICTIM_WALLET = "0x" + "bb" * 20


def _connect_raw():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=int(os.environ["NX_DB_PORT"]),
        dbname=os.environ["NX_DB_NAME"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
    )


@pytest.fixture(scope="module")
def db_pool():
    """Build the schema once and hand back a ready-to-use connection pool."""
    schema_sql = (BACKEND_ROOT / "db" / "schema.sql").read_text()
    migration_sql = (BACKEND_ROOT / "db" / "migration_mechanics.sql").read_text()

    conn = _connect_raw()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(schema_sql)
        cur.execute(migration_sql)
    conn.close()

    deps.init_db_pool(minconn=2, maxconn=6)
    try:
        yield
    finally:
        deps.close_db_pool()


def _seed(target_balance: int) -> None:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE devs, players, actions, shop_purchases, "
                "notifications, world_events RESTART IDENTITY CASCADE"
            )
            cur.executemany(
                "INSERT INTO players (wallet_address, corporation) VALUES (%s, %s)",
                [
                    (ATTACKER_A_WALLET, "CLOSED_AI"),
                    (ATTACKER_B_WALLET, "CLOSED_AI"),
                    (VICTIM_WALLET, "MISANTHROPIC"),
                ],
            )
            rows = [
                (1, "attacker_one", ATTACKER_A_WALLET, "CLOSED_AI", 2000),
                (2, "attacker_two", ATTACKER_B_WALLET, "CLOSED_AI", 2000),
                (3, "victim_alpha", VICTIM_WALLET, "MISANTHROPIC", target_balance),
            ]
            for tid, name, owner, corp, bal in rows:
                cur.execute(
                    """
                    INSERT INTO devs
                      (token_id, name, owner_address, archetype, corporation,
                       personality_seed, balance_nxt, status,
                       stat_hacking, social_vitality)
                    VALUES (%s, %s, %s, '10X_DEV', %s, 1, %s, 'active', 50, 50)
                    """,
                    (tid, name, owner, corp, bal),
                )


def test_concurrent_hack_raids_do_not_inflate_nxt(db_pool, monkeypatch):
    target_balance = 100
    _seed(target_balance)

    # Force deterministic success and maximise each steal. The first
    # thread to reach randint() sleeps briefly so the second thread has
    # time to also SELECT the target — that reproduces the race pre-fix.
    # Post-fix, the second thread is blocked on SELECT ... FOR UPDATE
    # until the first commits, so the sleep is harmless.
    first_in_randint = threading.Event()

    def always_succeed() -> float:
        return 0.0

    def steal_everything_possible(lo: int, hi: int) -> int:
        if not first_in_randint.is_set():
            first_in_randint.set()
            time.sleep(0.5)
        return hi

    monkeypatch.setattr(shop.random, "random", always_succeed)
    monkeypatch.setattr(shop.random, "randint", steal_everything_possible)
    monkeypatch.setattr(shop, "_resolve_mega_name", lambda addr: "test.mega")
    monkeypatch.setattr(shop.shop_limiter, "check", lambda key: None)

    results: list = [None, None]
    errors: list = []

    def run(idx: int, attacker_id: int, wallet: str) -> None:
        try:
            req = shop.HackRequest(player_address=wallet, attacker_dev_id=attacker_id)
            results[idx] = asyncio.run(shop.hack_player(req))
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    t1 = threading.Thread(target=run, args=(0, 1, ATTACKER_A_WALLET))
    t2 = threading.Thread(target=run, args=(1, 2, ATTACKER_B_WALLET))
    t1.start()
    t2.start()
    t1.join(timeout=20)
    t2.join(timeout=20)

    assert not errors, f"raid thread crashed: {errors[0]!r}"
    assert results[0] and results[0].get("hack_success"), f"raid 1 unexpected: {results[0]}"
    assert results[1] and results[1].get("hack_success"), f"raid 2 unexpected: {results[1]}"

    total_stolen = results[0]["stolen"] + results[1]["stolen"]

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT balance_nxt FROM devs WHERE token_id = 3")
            final_balance = cur.fetchone()["balance_nxt"]

    delta_target = target_balance - final_balance

    assert total_stolen <= delta_target, (
        "NXT inflation detected: concurrent HACK_RAIDs stole more than the "
        "target ever held. "
        f"total_stolen={total_stolen}, delta_target={delta_target} "
        f"(start={target_balance}, end={final_balance}). "
        f"Synthesised {total_stolen - delta_target} NXT out of thin air."
    )
