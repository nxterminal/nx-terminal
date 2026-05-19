"""Tests for the Phase 5.12 viewer-position feature on the three
new leaderboard endpoints:

  - GET /api/leaderboard/top-hackers
  - GET /api/leaderboard/nxt-holders
  - GET /api/leaderboard/dev-collectors

Each endpoint now accepts an optional `viewer_wallet` query param. When
present, the response carries an extra `viewer` object describing where
that wallet sits in the ranking (with competition ranking — ties share
the same rank).

Spec cases covered for each endpoint:
  a) no viewer_wallet                 → back-compat shape, no viewer object
  b) viewer is in the top-N           → viewer.in_top == True
  c) viewer is outside top-N, metric>0→ viewer.rank > limit, is_virtual=False
  d) viewer has metric == 0           → viewer.rank == N+1, is_virtual=True

Plus a handful of input-normalisation tests (empty string, malformed
address, mixed-case input) shared across the three endpoints.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

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


def _w(n: int) -> str:
    """Deterministic wallet generator. WALLET 1 → 0x0101...0101, etc.
    Keeps assertions readable while still being valid EVM addresses."""
    h = f"{n:02x}" * 20
    return "0x" + h


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


# ═════════════════════════════════════════════════════════════════════
# Top Hackers — viewer position
# ═════════════════════════════════════════════════════════════════════


def test_top_hackers_case_a_no_viewer(client, clean_db):
    """Case (a): no viewer_wallet → list shape, no viewer object."""
    _seed_dev(1, _w(1))
    _seed_action(1, "HACK_RAID", success=True)

    r = client.get("/api/leaderboard/top-hackers?limit=10").json()
    # Back-compat: when there's no viewer, response is the bare list.
    assert isinstance(r, list)
    assert r[0]["wallet"] == _w(1)


def test_top_hackers_case_b_viewer_in_top(client, clean_db):
    """Case (b): viewer is in the top-N → viewer.in_top is True."""
    # 3 hackers: A=3 hacks, B=2 hacks, C=1 hack. Viewer = C, in top 10.
    _seed_dev(1, _w(1)); _seed_dev(2, _w(2)); _seed_dev(3, _w(3))
    _seed_action(1, "HACK_RAID", success=True)
    _seed_action(1, "HACK_RAID", success=True)
    _seed_action(1, "HACK_MAINFRAME", success=True)
    _seed_action(2, "HACK_RAID", success=True)
    _seed_action(2, "HACK_RAID", success=True)
    _seed_action(3, "HACK_RAID", success=True)

    r = client.get(
        f"/api/leaderboard/top-hackers?limit=10&viewer_wallet={_w(3)}"
    ).json()
    assert "top" in r and "viewer" in r
    assert r["viewer"]["wallet"] == _w(3)
    assert r["viewer"]["rank"] == 3
    assert r["viewer"]["value"] == 1
    assert r["viewer"]["secondary_value"] == 1
    assert r["viewer"]["in_top"] is True
    assert r["viewer"]["is_virtual_rank"] is False


def test_top_hackers_case_c_viewer_outside_top_with_activity(client, clean_db):
    """Case (c): 12 wallets, viewer is #12 → outside top 10."""
    for i in range(1, 13):
        _seed_dev(i, _w(i))
        # Wallet i gets (13 - i) hacks: rank order is _w(1)>_w(2)>...
        for _ in range(13 - i):
            _seed_action(i, "HACK_RAID", success=True)

    # Viewer _w(12) has 1 hack — the fewest. There are 11 wallets with
    # MORE hacks (12 wallets total minus the viewer itself).
    r = client.get(
        f"/api/leaderboard/top-hackers?limit=10&viewer_wallet={_w(12)}"
    ).json()
    assert len(r["top"]) == 10
    assert r["viewer"]["rank"] == 12
    assert r["viewer"]["value"] == 1
    assert r["viewer"]["in_top"] is False
    assert r["viewer"]["is_virtual_rank"] is False


def test_top_hackers_case_d_viewer_zero_metric(client, clean_db):
    """Case (d): viewer has no hacks → virtual rank = N+1."""
    # 5 wallets with 1 hack each; viewer has nothing.
    for i in range(1, 6):
        _seed_dev(i, _w(i))
        _seed_action(i, "HACK_RAID", success=True)
    # Viewer is _w(99) — never seeded, has 0 hacks.
    viewer = _w(99)
    r = client.get(
        f"/api/leaderboard/top-hackers?limit=10&viewer_wallet={viewer}"
    ).json()
    assert r["viewer"]["rank"] == 6           # 5 wallets with >=1 hack + 1
    assert r["viewer"]["value"] == 0
    assert r["viewer"]["secondary_value"] == 0
    assert r["viewer"]["in_top"] is False
    assert r["viewer"]["is_virtual_rank"] is True


def test_top_hackers_competition_ranking_handles_ties(client, clean_db):
    """Three wallets tied at 5 hacks each → all share rank 1. A fourth
    wallet with 2 hacks lands at rank 4 (NOT 2 — that's competition
    ranking, ties skip subsequent ranks)."""
    for i in range(1, 4):
        _seed_dev(i, _w(i))
        for _ in range(5):
            _seed_action(i, "HACK_RAID", success=True)
    _seed_dev(4, _w(4))
    _seed_action(4, "HACK_RAID", success=True)
    _seed_action(4, "HACK_RAID", success=True)

    # _w(4) viewer — 2 hacks, three wallets above it.
    r = client.get(
        f"/api/leaderboard/top-hackers?limit=10&viewer_wallet={_w(4)}"
    ).json()
    assert r["viewer"]["rank"] == 4


# ═════════════════════════════════════════════════════════════════════
# Dev Collectors — viewer position
# ═════════════════════════════════════════════════════════════════════


def test_dev_collectors_case_a_no_viewer(client, clean_db):
    _seed_dev(1, _w(1))
    r = client.get("/api/leaderboard/dev-collectors?limit=10").json()
    assert isinstance(r, list)
    assert r[0]["wallet"] == _w(1)


def test_dev_collectors_case_b_viewer_in_top(client, clean_db):
    # A: 3 devs, B: 2 devs, C: 1 dev. Viewer = B.
    for tid in (1, 2, 3):
        _seed_dev(tid, _w(1))
    for tid in (4, 5):
        _seed_dev(tid, _w(2))
    _seed_dev(6, _w(3))

    r = client.get(
        f"/api/leaderboard/dev-collectors?limit=10&viewer_wallet={_w(2)}"
    ).json()
    assert r["viewer"]["rank"] == 2
    assert r["viewer"]["value"] == 2
    assert r["viewer"]["in_top"] is True
    assert r["viewer"]["is_virtual_rank"] is False


def test_dev_collectors_case_c_viewer_outside_top(client, clean_db):
    # 12 wallets, each with a distinct count. Viewer = _w(12) with 1 dev.
    next_tid = 1
    for owner_idx in range(1, 13):
        for _ in range(13 - owner_idx):
            _seed_dev(next_tid, _w(owner_idx))
            next_tid += 1

    r = client.get(
        f"/api/leaderboard/dev-collectors?limit=10&viewer_wallet={_w(12)}"
    ).json()
    assert len(r["top"]) == 10
    assert r["viewer"]["rank"] == 12
    assert r["viewer"]["value"] == 1
    assert r["viewer"]["in_top"] is False
    assert r["viewer"]["is_virtual_rank"] is False


def test_dev_collectors_case_d_viewer_zero(client, clean_db):
    # 4 wallets each with 1 dev. Viewer never seeded → 0 devs.
    for i in range(1, 5):
        _seed_dev(i, _w(i))
    viewer = _w(99)
    r = client.get(
        f"/api/leaderboard/dev-collectors?limit=10&viewer_wallet={viewer}"
    ).json()
    assert r["viewer"]["rank"] == 5           # 4 wallets with ≥1 dev + 1
    assert r["viewer"]["value"] == 0
    assert r["viewer"]["in_top"] is False
    assert r["viewer"]["is_virtual_rank"] is True


# ═════════════════════════════════════════════════════════════════════
# NXT Holders — viewer position
# ═════════════════════════════════════════════════════════════════════


def test_nxt_holders_case_a_no_viewer(client, clean_db):
    _seed_snapshot(_w(1), 1_000_000_000_000_000_000)
    r = client.get("/api/leaderboard/nxt-holders?limit=10").json()
    # Existing wrapper shape preserved; no `viewer` key when there's no
    # viewer_wallet (NOT viewer=null — the key must be absent).
    assert "holders" in r
    assert "snapshot_updated_at" in r
    assert "viewer" not in r


def test_nxt_holders_case_b_viewer_in_top(client, clean_db):
    # 3 holders, viewer is the middle one.
    _seed_snapshot(_w(1), 5_000_000_000_000_000_000)   # 5 NXT
    _seed_snapshot(_w(2), 2_500_000_000_000_000_000)   # 2.5 NXT
    _seed_snapshot(_w(3), 1_000_000_000_000_000_000)   # 1.0 NXT

    r = client.get(
        f"/api/leaderboard/nxt-holders?limit=10&viewer_wallet={_w(2)}"
    ).json()
    assert "viewer" in r
    assert r["viewer"]["rank"] == 2
    assert r["viewer"]["value"] == "2500000000000000000"
    assert r["viewer"]["in_top"] is True
    assert r["viewer"]["is_virtual_rank"] is False


def test_nxt_holders_case_c_viewer_outside_top_with_balance(client, clean_db):
    # 12 holders descending, viewer last with positive balance.
    for i in range(1, 13):
        _seed_snapshot(_w(i), (13 - i) * 10**18)

    r = client.get(
        f"/api/leaderboard/nxt-holders?limit=10&viewer_wallet={_w(12)}"
    ).json()
    assert len(r["holders"]) == 10
    assert r["viewer"]["rank"] == 12
    assert r["viewer"]["value"] == "1000000000000000000"  # 1 NXT
    assert r["viewer"]["in_top"] is False
    assert r["viewer"]["is_virtual_rank"] is False


def test_nxt_holders_case_d_viewer_not_in_snapshot(client, clean_db):
    """Wallet never indexed by the 5-min snapshot job (e.g. just
    connected, owns no dev). COALESCE pins balance to 0; rank is
    N+1 where N is wallets with balance > 0."""
    for i in range(1, 5):
        _seed_snapshot(_w(i), (5 - i) * 10**18)
    viewer = _w(99)  # never seeded
    r = client.get(
        f"/api/leaderboard/nxt-holders?limit=10&viewer_wallet={viewer}"
    ).json()
    assert r["viewer"]["rank"] == 5           # 4 wallets with balance>0 + 1
    assert r["viewer"]["value"] == "0"
    assert r["viewer"]["in_top"] is False
    assert r["viewer"]["is_virtual_rank"] is True


def test_nxt_holders_case_d_viewer_zero_balance_in_snapshot(client, clean_db):
    """Wallet IS in the snapshot but with balance 0 (held NXT in the
    past, sent it all elsewhere). Same virtual-rank behaviour as
    'not in snapshot at all'."""
    for i in range(1, 5):
        _seed_snapshot(_w(i), (5 - i) * 10**18)
    _seed_snapshot(_w(99), 0)  # explicit zero row
    r = client.get(
        f"/api/leaderboard/nxt-holders?limit=10&viewer_wallet={_w(99)}"
    ).json()
    assert r["viewer"]["rank"] == 5
    assert r["viewer"]["value"] == "0"
    assert r["viewer"]["is_virtual_rank"] is True


# ═════════════════════════════════════════════════════════════════════
# Input normalisation (shared across all three endpoints)
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize("path", [
    "/api/leaderboard/top-hackers",
    "/api/leaderboard/dev-collectors",
])
def test_viewer_wallet_empty_string_treated_as_no_viewer(client, clean_db, path):
    """Empty string mirrors the spec: 'null/vacío → comportamiento
    actual'. No 422; just falls back to the back-compat list shape."""
    _seed_dev(1, _w(1))
    if "hacker" in path:
        _seed_action(1, "HACK_RAID", success=True)
    r = client.get(f"{path}?limit=10&viewer_wallet=").json()
    assert isinstance(r, list)


def test_nxt_holders_empty_viewer_omits_viewer_key(client, clean_db):
    _seed_snapshot(_w(1), 10**18)
    r = client.get(
        "/api/leaderboard/nxt-holders?limit=10&viewer_wallet="
    ).json()
    assert "viewer" not in r


@pytest.mark.parametrize("bogus", [
    "0xnothex",              # right prefix, wrong characters
    "0x12",                  # too short
    "0x" + "a" * 41,         # 41 hex chars, one too many
    "deadbeef",              # missing 0x prefix
    "0x" + "g" * 40,         # invalid hex character
])
def test_top_hackers_malformed_viewer_wallet_falls_back(client, clean_db, bogus):
    """Malformed viewer_wallet shouldn't 422 — collapses to no-viewer
    so the leaderboard still renders. Frontend should send valid
    addresses, but the endpoint is permissive."""
    _seed_dev(1, _w(1))
    _seed_action(1, "HACK_RAID", success=True)
    r = client.get(
        f"/api/leaderboard/top-hackers?limit=10&viewer_wallet={bogus}"
    ).json()
    assert isinstance(r, list)  # back-compat shape, no viewer


def test_viewer_wallet_uppercase_normalised_to_lowercase(client, clean_db):
    """Spec: viewer.wallet comes back lowercased. The frontend's
    equality check (`row.wallet === viewer.wallet`) relies on this
    being consistent with the lowercased `wallet` field on every
    leaderboard row."""
    _seed_dev(1, _w(1))
    _seed_action(1, "HACK_RAID", success=True)
    upper = _w(1).upper().replace("0X", "0x")  # 0x + uppercase hex
    r = client.get(
        f"/api/leaderboard/top-hackers?limit=10&viewer_wallet={upper}"
    ).json()
    assert r["viewer"]["wallet"] == _w(1)  # lowercase
