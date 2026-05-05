"""Tests for the Sprkls + NX POST API endpoints.

Covers:
  - GET  /api/user/{wallet}/sprkls/recent     (wallet-scoped feed)
  - POST /api/user/{wallet}/sprkls/dismiss    (idempotent + scoped)
  - GET  /api/posts/timeline                  (public timeline)
  - GET  /api/posts/user/{wallet}             (wallet-scoped feed)
  - GET  /api/posts/dev/{token_id}            (Dev-scoped feed)

DB is stubbed at the route module's `fetch_all` / `fetch_one` /
`execute` import sites so the SQL contract is pinned without a live
Postgres."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api.routes import posts as posts_route  # noqa: E402
from backend.api.routes import user as user_route  # noqa: E402


OPERATOR = "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b"
TOKEN_ID = 8047


# ─── Shared fixtures ─────────────────────────────────────────────────


@pytest.fixture
def app():
    fastapi_app = FastAPI()
    fastapi_app.include_router(user_route.router, prefix="/api/user")
    fastapi_app.include_router(posts_route.router, prefix="/api/posts")
    return TestClient(fastapi_app)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _post_row(**overrides):
    """One joined row in the shape the route SQL returns."""
    base = {
        "id":              1,
        "token_id":        TOKEN_ID,
        "wallet_address":  OPERATOR,
        "content":         "ser the chart is bullish",
        "source":          "sprkl",
        "action_type":     "toast",
        "visual_metadata": {"duration_ms": 8000},
        "created_at":      _now(),
        "expires_at":      _now() + timedelta(days=7),
        "name":            "STORM-11",
        "archetype":       "DEGEN",
        "ipfs_hash":       "bafyEXAMPLE",
        "status":          "active",
    }
    base.update(overrides)
    return base


# ─── /sprkls/recent ──────────────────────────────────────────────────


def test_sprkls_recent_returns_payload(app, monkeypatch):
    monkeypatch.setattr(
        user_route, "fetch_all", lambda sql, params: [_post_row()]
    )
    resp = app.get(f"/api/user/{OPERATOR}/sprkls/recent")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert len(body["sprkls"]) == 1
    s = body["sprkls"][0]
    assert s["token_id"] == TOKEN_ID
    assert s["name"] == "STORM-11"
    assert s["archetype"] == "DEGEN"
    assert s["ipfs_image"] == "https://gateway.pinata.cloud/ipfs/bafyEXAMPLE"
    assert s["action_type"] == "toast"
    assert s["visual_metadata"] == {"duration_ms": 8000}
    assert s["created_at"].endswith("+00:00")


def test_sprkls_recent_sql_pins_invariants(app, monkeypatch):
    """Pin the SQL contract so a future refactor that drops the
    dismissal / TTL / source filters surfaces immediately."""
    captured: dict = {}

    def fake(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return []

    monkeypatch.setattr(user_route, "fetch_all", fake)
    app.get(f"/api/user/{OPERATOR}/sprkls/recent")
    sql = captured["sql"]
    assert "p.source = 'sprkl'" in sql
    assert "p.dismissed_at IS NULL" in sql
    assert "p.expires_at > NOW()" in sql
    assert "p.created_at >= NOW() - INTERVAL %s" in sql
    assert "ORDER BY p.created_at DESC" in sql
    # Wallet bound positionally first.
    assert captured["params"][0] == OPERATOR.lower()


def test_sprkls_recent_empty_returns_ok(app, monkeypatch):
    monkeypatch.setattr(user_route, "fetch_all", lambda sql, params: [])
    resp = app.get(f"/api/user/{OPERATOR}/sprkls/recent")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "sprkls": []}


def test_sprkls_recent_rejects_invalid_wallet(app, monkeypatch):
    called = {"hit": False}
    monkeypatch.setattr(
        user_route, "fetch_all",
        lambda *a, **kw: called.update(hit=True) or []
    )
    resp = app.get("/api/user/not-a-wallet/sprkls/recent")
    assert resp.status_code == 400
    assert called["hit"] is False


# ─── /sprkls/dismiss/{post_id} ───────────────────────────────────────


def test_dismiss_marks_dismissed(app, monkeypatch):
    """Happy path: a not-yet-dismissed sprkl belonging to the wallet
    flips dismissed_at via UPDATE."""
    fetch_calls: list = []

    def fake_fetch_one(sql, params):
        fetch_calls.append((sql, params))
        return {"id": 7, "dismissed_at": None, "source": "sprkl"}

    exec_calls: list = []

    def fake_execute(sql, params):
        exec_calls.append((sql, params))

    monkeypatch.setattr(user_route, "fetch_one", fake_fetch_one)
    monkeypatch.setattr(user_route, "execute", fake_execute)

    resp = app.post(f"/api/user/{OPERATOR}/sprkls/dismiss/7")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"ok": True, "post_id": 7}
    # UPDATE pinned: includes dismissed_at IS NULL guard so a second
    # dismiss is a no-op at the SQL level.
    update_sql, update_params = exec_calls[0]
    assert "UPDATE nx_posts" in update_sql
    assert "dismissed_at IS NULL" in update_sql
    assert update_params == (7, OPERATOR.lower())


def test_dismiss_idempotent_when_already_dismissed(app, monkeypatch):
    """Second dismiss returns ok with already_dismissed=true and
    skips the UPDATE entirely."""
    monkeypatch.setattr(
        user_route, "fetch_one",
        lambda sql, params: {
            "id": 7, "dismissed_at": _now(), "source": "sprkl",
        },
    )
    exec_called = {"hit": False}
    monkeypatch.setattr(
        user_route, "execute",
        lambda *a, **kw: exec_called.update(hit=True),
    )
    resp = app.post(f"/api/user/{OPERATOR}/sprkls/dismiss/7")
    assert resp.status_code == 200
    assert resp.json() == {
        "ok": True, "post_id": 7, "already_dismissed": True,
    }
    assert exec_called["hit"] is False


def test_dismiss_404_when_not_owned(app, monkeypatch):
    """A wallet probing a post id that doesn't exist for it must get
    404, not leak the row's existence under another wallet."""
    monkeypatch.setattr(user_route, "fetch_one", lambda sql, params: None)
    resp = app.post(f"/api/user/{OPERATOR}/sprkls/dismiss/99999")
    assert resp.status_code == 404


def test_dismiss_400_for_manual_post(app, monkeypatch):
    """Manual posts (Phase 5) shouldn't dismiss through this endpoint
    — different semantics."""
    monkeypatch.setattr(
        user_route, "fetch_one",
        lambda sql, params: {
            "id": 9, "dismissed_at": None, "source": "manual",
        },
    )
    resp = app.post(f"/api/user/{OPERATOR}/sprkls/dismiss/9")
    assert resp.status_code == 400


def test_dismiss_400_for_invalid_wallet(app, monkeypatch):
    called = {"hit": False}
    monkeypatch.setattr(
        user_route, "fetch_one",
        lambda *a, **kw: called.update(hit=True) or None,
    )
    resp = app.post("/api/user/not-a-wallet/sprkls/dismiss/1")
    assert resp.status_code == 400
    assert called["hit"] is False


# ─── /api/posts/timeline ─────────────────────────────────────────────


def test_timeline_returns_payload(app, monkeypatch):
    monkeypatch.setattr(
        posts_route, "fetch_all", lambda sql, params: [_post_row()]
    )
    resp = app.get("/api/posts/timeline")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert len(body["posts"]) == 1
    p = body["posts"][0]
    # Author wallet truncated for public display.
    assert p["author_wallet"].startswith("0xae88")
    assert p["author_wallet"].endswith("e88b")
    assert "…" in p["author_wallet"]
    assert p["ipfs_image"] == "https://gateway.pinata.cloud/ipfs/bafyEXAMPLE"
    # Public-facing payload doesn't expose `wallet_address` raw.
    assert "wallet_address" not in p


def test_timeline_filters_invariants(app, monkeypatch):
    captured: dict = {}

    def fake(sql, params):
        captured["sql"] = sql
        return []

    monkeypatch.setattr(posts_route, "fetch_all", fake)
    app.get("/api/posts/timeline")
    sql = captured["sql"]
    assert "p.is_public = TRUE" in sql
    assert "p.expires_at > NOW()" in sql
    assert "ORDER BY p.created_at DESC" in sql


def test_timeline_respects_before_cursor(app, monkeypatch):
    captured: dict = {}

    def fake(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return []

    monkeypatch.setattr(posts_route, "fetch_all", fake)
    # `+00:00` in a URL would be decoded as a space — pass via the
    # `params=` kwarg so httpx URL-encodes the cursor properly. The
    # 'Z' form goes through too; the route normalises.
    app.get(
        "/api/posts/timeline",
        params={"before": "2026-05-04T12:00:00+00:00", "limit": 10},
    )
    sql = captured["sql"]
    assert "p.created_at < %s" in sql
    # before timestamp passed positionally; LIMIT is the last param.
    assert captured["params"][-1] == 10
    assert any(
        isinstance(p, datetime) and p.year == 2026
        for p in captured["params"]
    )


def test_timeline_400_for_invalid_before(app, monkeypatch):
    monkeypatch.setattr(posts_route, "fetch_all", lambda sql, params: [])
    resp = app.get("/api/posts/timeline?before=garbage")
    assert resp.status_code == 400


def test_timeline_caps_limit_via_query_validation(app, monkeypatch):
    """FastAPI's Query(le=100) returns 422 for limit>100. Pin so a
    future tweak to the validator doesn't silently break the cap."""
    monkeypatch.setattr(posts_route, "fetch_all", lambda sql, params: [])
    resp = app.get("/api/posts/timeline?limit=10000")
    assert resp.status_code == 422


# ─── /api/posts/user/{wallet} + /api/posts/dev/{token_id} ────────────


def test_user_posts_filters_wallet(app, monkeypatch):
    captured: dict = {}

    def fake(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return []

    monkeypatch.setattr(posts_route, "fetch_all", fake)
    app.get(f"/api/posts/user/{OPERATOR}")
    sql = captured["sql"]
    assert "p.wallet_address = %s" in sql
    # validate_wallet returns the lowercased form.
    assert OPERATOR.lower() in captured["params"]


def test_user_posts_400_for_invalid_wallet(app, monkeypatch):
    called = {"hit": False}
    monkeypatch.setattr(
        posts_route, "fetch_all",
        lambda *a, **kw: called.update(hit=True) or [],
    )
    resp = app.get("/api/posts/user/not-a-wallet")
    assert resp.status_code == 400
    assert called["hit"] is False


def test_dev_posts_filters_token_id(app, monkeypatch):
    captured: dict = {}

    def fake(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return []

    monkeypatch.setattr(posts_route, "fetch_all", fake)
    app.get(f"/api/posts/dev/{TOKEN_ID}")
    sql = captured["sql"]
    assert "p.token_id = %s" in sql
    assert TOKEN_ID in captured["params"]


def test_dev_posts_422_for_non_int_token():
    """FastAPI path-int validator handles this."""
    fastapi_app = FastAPI()
    fastapi_app.include_router(posts_route.router, prefix="/api/posts")
    client = TestClient(fastapi_app)
    resp = client.get("/api/posts/dev/not-an-int")
    assert resp.status_code == 422
