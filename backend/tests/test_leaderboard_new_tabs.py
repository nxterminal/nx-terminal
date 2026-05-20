"""Tests for the Phase 5.11 leaderboard endpoints:

  - GET /api/leaderboard/top-hackers
  - GET /api/leaderboard/nxt-holders
  - GET /api/leaderboard/dev-collectors

…and for the snapshot service that populates nxt_holder_snapshot.

The schema bootstrap fixture in conftest already runs the full
migrate, so every table (devs, actions, nxt_holder_snapshot, etc.)
exists by the time these tests run.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import psycopg2
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

from backend.api import deps  # noqa: E402
from backend.api.middleware.correlation import CorrelationIdMiddleware  # noqa: E402
from backend.api.routes import leaderboard as leaderboard_module  # noqa: E402
from backend.services import nxt_snapshot as snap_module  # noqa: E402


WALLET_A = "0x" + "aa" * 20
WALLET_B = "0x" + "bb" * 20
WALLET_C = "0x" + "cc" * 20


@pytest.fixture(scope="module")
def app():
    deps.init_db_pool(minconn=1, maxconn=4)
    fastapi_app = FastAPI()
    fastapi_app.add_middleware(CorrelationIdMiddleware)
    fastapi_app.include_router(
        leaderboard_module.router, prefix="/api/leaderboard"
    )
    try:
        yield fastapi_app
    finally:
        deps.close_db_pool()


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def clean_db(app):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            # Order matters — actions/devs FK into players.
            cur.execute("TRUNCATE actions RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE devs RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE players RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE nxt_holder_snapshot RESTART IDENTITY CASCADE")


def _ensure_player(cur, wallet):
    cur.execute(
        "INSERT INTO players (wallet_address, corporation) "
        "VALUES (%s, 'MISANTHROPIC') "
        "ON CONFLICT DO NOTHING",
        (wallet.lower(),),
    )


def _seed_dev(token_id, owner, *, archetype="DEGEN"):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _ensure_player(cur, owner)
            cur.execute(
                """
                INSERT INTO devs (
                    token_id, name, owner_address, archetype,
                    corporation, status, personality_seed,
                    stat_coding, stat_hacking, stat_trading,
                    stat_social, stat_endurance, stat_luck,
                    balance_nxt
                ) VALUES (%s, %s, %s, %s, 'MISANTHROPIC', 'active', %s,
                          50, 50, 50, 50, 50, 50, 0)
                """,
                (token_id, f"DEV-{token_id}", owner.lower(), archetype,
                 token_id * 1000),
            )


def _seed_action(dev_id, action_type, *, success):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO actions
                    (dev_id, dev_name, archetype, action_type,
                     details, energy_cost, nxt_cost)
                VALUES (%s, %s, %s, %s, %s::jsonb, 0, 0)
                """,
                (dev_id, f"DEV-{dev_id}", "DEGEN", action_type,
                 json.dumps({"success": success})),
            )


# ─── Top Hackers ──────────────────────────────────────────────────────


def test_top_hackers_empty(client, clean_db):
    r = client.get("/api/leaderboard/top-hackers")
    assert r.status_code == 200
    assert r.json() == []


def test_top_hackers_counts_successful_hacks_per_wallet(client, clean_db):
    _seed_dev(1, WALLET_A)
    _seed_dev(2, WALLET_A)
    _seed_dev(3, WALLET_B)

    # WALLET_A: 3 success across 2 devs
    _seed_action(1, "HACK_RAID", success=True)
    _seed_action(1, "HACK_MAINFRAME", success=True)
    _seed_action(2, "HACK_RAID", success=True)
    # WALLET_A also has a FAILED hack — must NOT count.
    _seed_action(2, "HACK_RAID", success=False)
    # WALLET_B: 1 success on 1 dev
    _seed_action(3, "HACK_MAINFRAME", success=True)

    rows = client.get("/api/leaderboard/top-hackers").json()
    assert len(rows) == 2
    assert rows[0]["wallet"] == WALLET_A.lower()
    assert rows[0]["hacks_successful"] == 3
    assert rows[0]["contributing_devs"] == 2
    assert rows[1]["wallet"] == WALLET_B.lower()
    assert rows[1]["hacks_successful"] == 1
    assert rows[1]["contributing_devs"] == 1


def test_top_hackers_ignores_non_hack_actions(client, clean_db):
    _seed_dev(1, WALLET_A)
    _seed_action(1, "CHAT", success=True)
    _seed_action(1, "CREATE_PROTOCOL", success=True)
    assert client.get("/api/leaderboard/top-hackers").json() == []


def test_top_hackers_respects_limit(client, clean_db):
    for i in range(5):
        w = "0x" + (f"{i:02d}" * 20)
        _seed_dev(i + 1, w)
        for _ in range(5 - i):
            _seed_action(i + 1, "HACK_RAID", success=True)

    rows = client.get("/api/leaderboard/top-hackers?limit=3").json()
    assert len(rows) == 3
    counts = [r["hacks_successful"] for r in rows]
    assert counts == sorted(counts, reverse=True)


# ─── Dev Collectors ───────────────────────────────────────────────────


def test_dev_collectors_empty(client, clean_db):
    r = client.get("/api/leaderboard/dev-collectors")
    assert r.status_code == 200
    assert r.json() == []


def test_dev_collectors_ranks_by_count(client, clean_db):
    for tid in (1, 2, 3):
        _seed_dev(tid, WALLET_A)
    for tid in (4, 5):
        _seed_dev(tid, WALLET_B)
    _seed_dev(6, WALLET_C)

    rows = client.get("/api/leaderboard/dev-collectors").json()
    assert rows == [
        {"wallet": WALLET_A.lower(), "dev_count": 3},
        {"wallet": WALLET_B.lower(), "dev_count": 2},
        {"wallet": WALLET_C.lower(), "dev_count": 1},
    ]


# ─── NXT Holders ──────────────────────────────────────────────────────


def _seed_snapshot(wallet, balance):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxt_holder_snapshot (wallet, balance)
                VALUES (%s, %s)
                ON CONFLICT (wallet) DO UPDATE SET balance = EXCLUDED.balance
                """,
                (wallet.lower(), balance),
            )


def test_nxt_holders_empty(client, clean_db):
    body = client.get("/api/leaderboard/nxt-holders").json()
    assert body["holders"] == []
    assert body["snapshot_updated_at"] is None


def test_nxt_holders_ranks_by_balance_desc(client, clean_db):
    _seed_snapshot(WALLET_A, 1_000_000_000_000_000_000)   # 1.0 NXT (1e18)
    _seed_snapshot(WALLET_B, 5_000_000_000_000_000_000)   # 5.0 NXT
    _seed_snapshot(WALLET_C, 2_500_000_000_000_000_000)   # 2.5 NXT

    body = client.get("/api/leaderboard/nxt-holders").json()
    wallets = [h["wallet"] for h in body["holders"]]
    assert wallets == [WALLET_B.lower(), WALLET_C.lower(), WALLET_A.lower()]
    # Balance comes back as string to avoid JS Number precision loss.
    assert body["holders"][0]["balance"] == "5000000000000000000"
    assert body["snapshot_updated_at"] is not None


def test_nxt_holders_ranks_by_numeric_not_lexicographic(client, clean_db):
    """Regression guard for the bug where `SELECT balance::TEXT AS balance
    ... ORDER BY balance DESC` resolved the alias (TEXT) instead of the
    column (NUMERIC), sorting lexicographically.

    The previous test (`test_nxt_holders_ranks_by_balance_desc`) used
    three balances of the SAME digit-count (1.0 / 2.5 / 5.0 NXT — all
    19-char base-unit strings), so lex order accidentally matched
    numeric order and the bug slipped through. This test uses the EXACT
    values that surfaced in production — 979, 67981, 6300, 39127,
    33750 NXT — chosen to have different digit-counts so the two
    orderings diverge.

    Lex order under the bug would be:
        979 (3 dig) → 67981 (5 dig) → 6300 (4 dig) → 39127 → 33750
    Numeric order (correct):
        67981 → 39127 → 33750 → 6300 → 979
    """
    NXT = 10 ** 18  # base unit per 1 NXT
    _seed_snapshot(WALLET_A, 979   * NXT)
    _seed_snapshot(WALLET_B, 67981 * NXT)
    _seed_snapshot(WALLET_C, 6300  * NXT)
    _seed_snapshot("0x" + "dd" * 20, 39127 * NXT)
    _seed_snapshot("0x" + "ee" * 20, 33750 * NXT)

    body = client.get("/api/leaderboard/nxt-holders").json()
    balances_desc = [int(h["balance"]) // NXT for h in body["holders"]]
    assert balances_desc == [67981, 39127, 33750, 6300, 979]


def test_nxt_holders_handles_uint256_max(client, clean_db):
    """Sanity: the column is NUMERIC(78,0). Max uint256 has 78
    digits. Round-trip the maximum through the endpoint."""
    UINT256_MAX = (1 << 256) - 1
    _seed_snapshot(WALLET_A, UINT256_MAX)
    body = client.get("/api/leaderboard/nxt-holders").json()
    assert body["holders"][0]["balance"] == str(UINT256_MAX)


# ─── nxt_snapshot service ─────────────────────────────────────────────


def test_wallets_from_devs_returns_distinct_lowercased(clean_db):
    _seed_dev(1, WALLET_A.upper())
    _seed_dev(2, WALLET_A.lower())
    _seed_dev(3, WALLET_B)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            wallets = snap_module._wallets_from_devs(cur)
    assert set(wallets) == {WALLET_A.lower(), WALLET_B.lower()}


def test_encode_balance_of_calldata_shape():
    w = "0x" + "ab" * 20
    out = snap_module._encode_balance_of_calldata(w)
    # 4-byte selector + 32-byte left-padded address = 4 + 32 = 36 bytes
    # → 72 hex chars + leading "0x" = 74.
    assert out.startswith("0x70a08231")
    assert len(out) == 2 + 8 + 64
    # Address sits in the LOW 20 bytes (24 zeros, then 40 addr chars).
    assert out.endswith("ab" * 20)
    assert out[10:34] == "0" * 24


def test_encode_balance_of_calldata_rejects_bad_input():
    with pytest.raises(ValueError):
        snap_module._encode_balance_of_calldata("0xdeadbeef")


def test_upsert_snapshot_updates_existing_row(clean_db):
    _seed_snapshot(WALLET_A, 100)
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            snap_module._upsert_snapshot(cur, [(WALLET_A.lower(), 999)])
        conn.commit()
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT balance::TEXT AS bal FROM nxt_holder_snapshot WHERE wallet = %s",
                (WALLET_A.lower(),),
            )
            row = cur.fetchone()
    assert row["bal"] == "999"


def test_run_tick_skips_when_no_wallets(monkeypatch, clean_db):
    """No devs in DB → no RPC calls, no rows inserted."""
    called = {"fetch": 0}
    monkeypatch.setattr(
        snap_module, "_fetch_balance",
        lambda w: called.__setitem__("fetch", called["fetch"] + 1) or (w, 0),
    )
    with deps.get_db() as conn:
        n = snap_module.run_nxt_snapshot_tick(conn)
    assert n == 0
    assert called["fetch"] == 0


def test_run_tick_upserts_balances(monkeypatch, clean_db):
    """Stub _fetch_balance with deterministic values and verify the
    upsert path. Skips wallets whose RPC returns None."""
    _seed_dev(1, WALLET_A)
    _seed_dev(2, WALLET_B)
    _seed_dev(3, WALLET_C)

    def fake_fetch(wallet):
        if wallet == WALLET_C.lower():
            return wallet, None  # simulate RPC flake — skip
        return wallet, {WALLET_A.lower(): 1000, WALLET_B.lower(): 2500}[wallet]

    monkeypatch.setattr(snap_module, "_fetch_balance", fake_fetch)

    with deps.get_db() as conn:
        n = snap_module.run_nxt_snapshot_tick(conn)
    assert n == 2

    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT wallet, balance::TEXT AS bal FROM nxt_holder_snapshot "
                "ORDER BY balance DESC"
            )
            rows = cur.fetchall()
    assert [(r["wallet"], r["bal"]) for r in rows] == [
        (WALLET_B.lower(), "2500"),
        (WALLET_A.lower(), "1000"),
    ]


# ─── Corporations ─────────────────────────────────────────────────────


NXT = 10 ** 18  # base units per 1 NXT


def _seed_dev_corp(token_id, owner, corp, *, status='active'):
    """Variant of `_seed_dev` that takes the corporation and status
    explicitly — the original helper hardcodes both for the other
    tabs that don't care about them."""
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            _ensure_player(cur, owner)
            cur.execute(
                """
                INSERT INTO devs (
                    token_id, name, owner_address, archetype,
                    corporation, status, personality_seed,
                    stat_coding, stat_hacking, stat_trading,
                    stat_social, stat_endurance, stat_luck,
                    balance_nxt
                ) VALUES (%s, %s, %s, 'DEGEN', %s, %s, %s,
                          50, 50, 50, 50, 50, 50, 0)
                """,
                (token_id, f"DEV-{token_id}", owner.lower(),
                 corp, status, token_id * 1000),
            )


def _corp_row(rows, corp):
    """Pick the row for `corp` from the /corporations response.
    Corps with zero devs don't appear in the GROUP BY output, so
    "not present" means the test setup didn't seed any."""
    matches = [r for r in rows if r["corporation"] == corp]
    assert len(matches) == 1, (
        f"Expected exactly one row for {corp}, got {len(matches)}: {rows}"
    )
    return matches[0]


def test_corporations_counts_all_statuses(client, clean_db):
    """`total_devs` includes every minted dev regardless of status —
    not just 'active'. Regression against the pre-fix
    `WHERE status='active'` filter that dropped ~89% of the roster
    (users saw 26 devs reported vs 242 minted)."""
    # 10 devs in CLOSED_AI, two of each enum value.
    statuses = ['active', 'resting', 'frozen', 'on_mission', 'exhausted']
    for i, status in enumerate(statuses * 2, start=1):
        _seed_dev_corp(i, WALLET_A, 'CLOSED_AI', status=status)

    rows = client.get("/api/leaderboard/corporations").json()
    row = _corp_row(rows, 'CLOSED_AI')
    assert row["total_devs"] == 10


def test_corporations_wallet_counted_once_per_corp(client, clean_db):
    """A wallet owning N devs in one corp contributes its snapshot
    balance ONCE to that corp's total, not N times. Also asserts the
    response shape: `total_balance` round-trips as a JSON integer
    (parseable with JS `Number()`), not as a stringified base-unit
    value."""
    for tid in range(1, 6):  # 5 devs, same wallet, same corp
        _seed_dev_corp(tid, WALLET_A, 'ZUCK_LABS')
    _seed_snapshot(WALLET_A, 10_000 * NXT)

    rows = client.get("/api/leaderboard/corporations").json()
    row = _corp_row(rows, 'ZUCK_LABS')
    assert row["total_devs"] == 5
    assert row["total_balance"] == 10_000
    assert isinstance(row["total_balance"], int)


def test_corporations_wallet_in_two_corps_contributes_to_both(client, clean_db):
    """A wallet with devs in distinct corps appears in EACH corp's
    balance — the intentional 'double counting across corps'
    semantics. (Within a single corp, the wallet still contributes
    once — see the previous test.)"""
    _seed_dev_corp(1, WALLET_A, 'CLOSED_AI')
    _seed_dev_corp(2, WALLET_A, 'ZUCK_LABS')
    _seed_snapshot(WALLET_A, 5_000 * NXT)

    rows = client.get("/api/leaderboard/corporations").json()
    assert _corp_row(rows, 'CLOSED_AI')["total_balance"] == 5_000
    assert _corp_row(rows, 'ZUCK_LABS')["total_balance"] == 5_000


def test_corporations_wallet_without_snapshot_balance_zero(client, clean_db):
    """A wallet not yet picked up by the snapshot job (just connected,
    RPC flake) LEFT-JOINs to NULL → COALESCE → 0. The response shows
    an integer 0 — never NULL, never an error."""
    _seed_dev_corp(1, WALLET_A, 'MISANTHROPIC')
    # Deliberately no `_seed_snapshot(WALLET_A, ...)` — wallet has no
    # snapshot row yet.

    rows = client.get("/api/leaderboard/corporations").json()
    row = _corp_row(rows, 'MISANTHROPIC')
    assert row["total_devs"] == 1
    assert row["total_balance"] == 0
    assert isinstance(row["total_balance"], int)


def test_corporations_realistic_dataset(client, clean_db):
    """Prod-shaped scenario: 6 corps × 40 devs × 10 wallets, statuses
    cycled, balances spread 1k–70k NXT. End-to-end sanity that the
    aggregate numbers are in the right order of magnitude (vs the
    26-vs-242 + 2k-vs-67k symptom that triggered this fix)."""
    corps = ['CLOSED_AI', 'MISANTHROPIC', 'SHALLOW_MIND',
             'ZUCK_LABS', 'Y_AI', 'MISTRIAL_SYSTEMS']
    statuses = ['active', 'resting', 'frozen', 'on_mission', 'exhausted']

    token = 0
    for corp_idx, corp in enumerate(corps):
        for wallet_idx in range(10):
            # Wallets are corp-scoped here so each corp's totals are
            # independent — the cross-corp wallet case is covered by
            # the dedicated test above.
            wallet = "0x" + f"{corp_idx:02d}{wallet_idx:02d}".ljust(40, "0")
            balance_nxt = 1_000 + (corp_idx * 10 + wallet_idx) * 1_156
            _seed_snapshot(wallet, balance_nxt * NXT)
            for _ in range(4):
                token += 1
                _seed_dev_corp(token, wallet, corp,
                               status=statuses[token % len(statuses)])

    rows = client.get("/api/leaderboard/corporations").json()
    assert len(rows) == 6
    assert {r["corporation"] for r in rows} == set(corps)

    # Lowest-balance corp is CLOSED_AI (corp_idx=0, wallet_idx 0..9):
    #   sum = 10*1000 + 1156*(0+1+...+9) = 10000 + 52020 = 62020
    # Every other corp is higher (corp_idx pushes the base up).
    for row in rows:
        assert row["total_devs"] == 40
        assert row["total_balance"] >= 62_020, (
            f"{row['corporation']} total_balance={row['total_balance']} "
            f"— below floor 62020 for the smallest seeded corp"
        )
        assert isinstance(row["total_balance"], int)


def test_corporations_cartesian_explosion_regression(client, clean_db):
    """Catches the cartesian-explosion bug from the rejected first
    draft of this fix — a single `FROM devs d LEFT JOIN corp_wallets`
    that multiplied COUNT/SUM by the number of distinct wallets per
    corp.

    Trip wire: CORP_A with 3 devs across 2 distinct wallets — W1
    owning 2, W2 owning 1. Snapshot balances W1=1000, W2=2000.

      Correct: total_devs=3, total_balance=3000.
      Buggy:   total_devs=6 (3 devs × 2 wallets joined), and
               total_balance=6000 (each wallet's balance counted
               3 times, once per dev in the corp).

    The "wallet-counted-once-per-corp" test above (1 wallet, 5 devs)
    does NOT catch this — with a single distinct wallet, the join
    doesn't multiply rows and COUNT comes out right by accident.
    Same failure mode as the NXT-holders digit-count regression:
    you need ≥ 2 wallets to make the buggy and correct outputs
    diverge.
    """
    WALLET_W1 = "0x" + "11" * 20
    WALLET_W2 = "0x" + "22" * 20
    _seed_dev_corp(1, WALLET_W1, 'Y_AI')
    _seed_dev_corp(2, WALLET_W1, 'Y_AI')
    _seed_dev_corp(3, WALLET_W2, 'Y_AI')
    _seed_snapshot(WALLET_W1, 1_000 * NXT)
    _seed_snapshot(WALLET_W2, 2_000 * NXT)

    rows = client.get("/api/leaderboard/corporations").json()
    row = _corp_row(rows, 'Y_AI')
    assert row["total_devs"] == 3
    assert row["total_balance"] == 3_000
