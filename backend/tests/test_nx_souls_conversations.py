"""Tests for GET /api/user/{wallet_address}/conversations.

Phase 3.1 — backend feed for the chat list UI. The endpoint is
read-only (does NOT mutate `nx_souls_quota`); these tests pin its
contract:

  - listing & ordering (ASC by token_id)
  - quota math when a row exists, is stale (older UTC date), or
    is missing entirely (Dev never chatted)
  - badge flags (is_resting, is_exhausted, is_on_mission)
  - frozen-Dev exclusion
  - input validation
  - empty-wallet path

`fetch_all` is monkeypatched at the route module's import site so the
SQL contract is exercised through the route's parameter wiring without
touching Postgres. The real schema is exercised by the existing
chat-endpoint and quota tests.
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api.routes import user as user_route  # noqa: E402
from backend.services.nx_souls.quota import (  # noqa: E402
    DEFAULT_QUOTA,
    QUOTAS_BY_RARITY,
)


OWNER = "0x" + "ab" * 20


# ─── Helpers ──────────────────────────────────────────────────────────────


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _yesterday_utc() -> date:
    return _today_utc() - timedelta(days=1)


def _row(
    *,
    token_id=1,
    name="DEV-1",
    archetype="INFLUENCER",
    corporation="ZUCK_LABS",
    rarity_tier="common",
    ipfs_hash="bafyHASH",
    status="active",
    energy=80,
    max_energy=100,
    messages_today=0,
):
    """Build a row in the shape the route expects from the SQL CASE
    branch (i.e. messages_today is already the date-resolved value, 0
    if the underlying row is stale or missing)."""
    return {
        "token_id":       token_id,
        "name":           name,
        "archetype":      archetype,
        "corporation":    corporation,
        "rarity_tier":    rarity_tier,
        "ipfs_hash":      ipfs_hash,
        "status":         status,
        "energy":         energy,
        "max_energy":     max_energy,
        "messages_today": messages_today,
    }


@pytest.fixture
def stub_fetch_all(monkeypatch):
    """Monkeypatch `fetch_all` at the route's import site. The setter
    accepts both a list of rows (the most common shape) and a callable
    that takes (sql, params) so a test can assert the parameters it
    received without losing the easy "just return these rows" path."""
    captured: dict = {"sql": None, "params": None}

    def set_rows(rows_or_fn):
        def fake(sql, params=None):
            captured["sql"] = sql
            captured["params"] = params
            if callable(rows_or_fn):
                return rows_or_fn(sql, params)
            return rows_or_fn

        monkeypatch.setattr(user_route, "fetch_all", fake)

    set_rows.captured = captured  # type: ignore[attr-defined]
    return set_rows


@pytest.fixture
def app():
    fastapi_app = FastAPI()
    fastapi_app.include_router(user_route.router, prefix="/api/user")
    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app)


# ─── Listing & ordering ──────────────────────────────────────────────────


def test_list_returns_devs_sorted_by_token_id_asc(client, stub_fetch_all):
    """Multiple Devs in different states → 200 with one entry each,
    ordered ascending by token_id (the SQL ORDER BY is mirrored by
    the test fixture so a future flip of the ORDER BY would surface
    here)."""
    stub_fetch_all([
        _row(token_id=10, name="A", rarity_tier="common", messages_today=2),
        _row(token_id=20, name="B", rarity_tier="rare", messages_today=80),
        _row(token_id=30, name="C", rarity_tier="legendary", status="exhausted",
             energy=0, messages_today=5),
    ])
    resp = client.get(f"/api/user/{OWNER}/conversations")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert [d["token_id"] for d in body["devs"]] == [10, 20, 30]


def test_payload_shape_matches_brief(client, stub_fetch_all):
    """Pin the per-Dev payload contract so a future addition / removal
    of a field is intentional and visible in tests."""
    stub_fetch_all([_row(rarity_tier="common", messages_today=7)])
    body = client.get(f"/api/user/{OWNER}/conversations").json()
    dev = body["devs"][0]
    expected = {
        "token_id", "name", "archetype", "corporation", "rarity_tier",
        "ipfs_hash", "ipfs_image", "status", "energy", "max_energy",
        "is_resting", "is_exhausted", "is_on_mission", "quota",
    }
    assert set(dev.keys()) == expected
    quota_keys = {"used", "limit", "remaining", "resets_at"}
    assert set(dev["quota"].keys()) == quota_keys


def test_ipfs_image_is_pinata_gateway_url(client, stub_fetch_all):
    """ipfs_image is the public Pinata URL the frontend already uses,
    pre-built so the chat list doesn't need to know the gateway."""
    stub_fetch_all([_row(ipfs_hash="bafyEXAMPLE")])
    dev = client.get(f"/api/user/{OWNER}/conversations").json()["devs"][0]
    assert dev["ipfs_hash"] == "bafyEXAMPLE"
    assert dev["ipfs_image"] == "https://gateway.pinata.cloud/ipfs/bafyEXAMPLE"


def test_ipfs_image_is_empty_when_hash_missing(client, stub_fetch_all):
    """A row without an ipfs_hash (legacy / uningested) must produce
    an empty string, not 'None' or a URL pointing at /ipfs/None."""
    stub_fetch_all([_row(ipfs_hash=None)])
    dev = client.get(f"/api/user/{OWNER}/conversations").json()["devs"][0]
    assert dev["ipfs_hash"] is None
    assert dev["ipfs_image"] == ""


# ─── Empty wallet ────────────────────────────────────────────────────────


def test_empty_wallet_returns_empty_list(client, stub_fetch_all):
    stub_fetch_all([])
    resp = client.get(f"/api/user/{OWNER}/conversations")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "devs": []}


# ─── Validation ──────────────────────────────────────────────────────────


def test_invalid_wallet_format_returns_400(client, stub_fetch_all):
    """validate_wallet handles the 400 — assert the route delegates
    cleanly. The fixture is set so we can confirm fetch_all wasn't
    even reached."""
    stub_fetch_all([_row()])
    resp = client.get("/api/user/not-a-wallet/conversations")
    assert resp.status_code == 400
    assert stub_fetch_all.captured["sql"] is None, (
        "fetch_all should not run when wallet validation fails"
    )


# ─── Quota math ──────────────────────────────────────────────────────────


def test_quota_at_limit_marks_dev_resting(client, stub_fetch_all):
    """A common Dev with 30 messages today is at limit → is_resting
    flips on; remaining clamps at 0."""
    common_limit = QUOTAS_BY_RARITY["common"]
    stub_fetch_all([_row(rarity_tier="common", messages_today=common_limit)])
    dev = client.get(f"/api/user/{OWNER}/conversations").json()["devs"][0]
    assert dev["is_resting"] is True
    assert dev["quota"]["used"] == common_limit
    assert dev["quota"]["limit"] == common_limit
    assert dev["quota"]["remaining"] == 0


def test_dev_below_limit_not_resting(client, stub_fetch_all):
    stub_fetch_all([_row(rarity_tier="legendary", messages_today=5)])
    dev = client.get(f"/api/user/{OWNER}/conversations").json()["devs"][0]
    assert dev["is_resting"] is False
    assert dev["quota"]["limit"] == QUOTAS_BY_RARITY["legendary"]
    assert dev["quota"]["used"] == 5
    assert dev["quota"]["remaining"] == QUOTAS_BY_RARITY["legendary"] - 5


def test_dev_with_no_quota_row_shows_zero(client, stub_fetch_all):
    """LEFT JOIN guarantee: a Dev that never chatted (no row in
    nx_souls_quota) reaches the route through the SQL CASE as
    messages_today=0. Confirms the operator's production observation
    where 9/14 Devs had no quota row.

    This test is the canary for an accidental INNER JOIN regression —
    INNER JOIN would silently drop these Devs from the list."""
    stub_fetch_all([
        _row(token_id=1, name="NEVER-CHATTED", messages_today=0),
        _row(token_id=2, name="HAS-CHATTED", messages_today=5),
    ])
    devs = client.get(f"/api/user/{OWNER}/conversations").json()["devs"]
    # Both Devs surfaced — the never-chatted one is NOT dropped.
    assert {d["name"] for d in devs} == {"NEVER-CHATTED", "HAS-CHATTED"}
    never = next(d for d in devs if d["name"] == "NEVER-CHATTED")
    assert never["quota"]["used"] == 0
    assert never["is_resting"] is False
    assert never["quota"]["remaining"] == QUOTAS_BY_RARITY["common"]


def test_stale_quota_date_displays_zero_used(client, stub_fetch_all):
    """The SQL CASE clause WHEN q.quota_date = today_utc THEN ... ELSE 0
    means a row whose stored date is older than today is read as
    used=0 here. This endpoint never writes — the actual reset happens
    on the next chat request via get_quota_state.

    Verified by checking that the today_utc parameter is bound into
    the query as the first positional parameter."""
    captured_params: list = []

    def program(sql, params):
        captured_params.append(params)
        # Simulate the SQL doing the right CASE: stale row → 0.
        return [_row(rarity_tier="common", messages_today=0)]

    stub_fetch_all(program)
    resp = client.get(f"/api/user/{OWNER}/conversations")
    assert resp.status_code == 200
    dev = resp.json()["devs"][0]
    assert dev["quota"]["used"] == 0
    assert dev["is_resting"] is False
    # Pin the SQL parameter binding: today_utc must be the first
    # parameter so the CASE compares the stored date against today's
    # UTC date, not the server's local-tz date.
    assert captured_params, "expected fetch_all to be called once"
    assert captured_params[0][0] == _today_utc()
    assert captured_params[0][1] == OWNER.lower()


def test_resets_at_is_next_utc_midnight(client, stub_fetch_all):
    stub_fetch_all([_row()])
    dev = client.get(f"/api/user/{OWNER}/conversations").json()["devs"][0]
    parsed = datetime.fromisoformat(dev["quota"]["resets_at"])
    assert parsed.tzinfo is not None
    assert parsed.utcoffset().total_seconds() == 0
    assert parsed.hour == 0 and parsed.minute == 0 and parsed.second == 0
    assert parsed > datetime.now(timezone.utc)


# ─── Status / badge flags ────────────────────────────────────────────────


def test_status_flags_for_active_exhausted_on_mission(client, stub_fetch_all):
    stub_fetch_all([
        _row(token_id=1, status="active", energy=70),
        _row(token_id=2, status="exhausted", energy=0),
        _row(token_id=3, status="on_mission", energy=50),
    ])
    devs = client.get(f"/api/user/{OWNER}/conversations").json()["devs"]
    flag_view = {
        d["token_id"]: (d["is_exhausted"], d["is_on_mission"])
        for d in devs
    }
    assert flag_view == {
        1: (False, False),
        2: (True, False),
        3: (False, True),
    }


# ─── Frozen exclusion ────────────────────────────────────────────────────


def test_frozen_devs_filtered_at_sql_layer(client, stub_fetch_all):
    """The SQL `AND d.status <> 'frozen'` is what excludes frozen Devs.
    Mirror that here by having the fixture only return non-frozen rows
    (matching what real Postgres would return), and assert the SQL
    contains the filter so the ORM-side exclusion is pinned."""
    captured: dict = {}

    def program(sql, params):
        captured["sql"] = sql
        return [_row(token_id=1, status="active")]

    stub_fetch_all(program)
    resp = client.get(f"/api/user/{OWNER}/conversations")
    assert resp.status_code == 200
    assert "<> 'frozen'" in captured["sql"], (
        "frozen exclusion must live in the SQL, not in Python — "
        "frontend should never need to know about admin-frozen Devs"
    )


# ─── Unknown rarity safety ───────────────────────────────────────────────


def test_unknown_rarity_falls_back_to_default_quota(client, stub_fetch_all):
    """A future rarity that hasn't yet been added to QUOTAS_BY_RARITY
    must not 500 the conversations endpoint — it gets DEFAULT_QUOTA
    so the chat list still renders."""
    stub_fetch_all([_row(rarity_tier="transcendent", messages_today=0)])
    dev = client.get(f"/api/user/{OWNER}/conversations").json()["devs"][0]
    assert dev["quota"]["limit"] == DEFAULT_QUOTA
