"""Tests for backend.api.routes.posts_feed — like / unlike,
trending, feed-stats, who-to-follow, single-post detail.

DB is stubbed at the route module's import sites (`fetch_all`,
`fetch_one`, `execute`) so SQL contracts are pinned without a live
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

from backend.api.routes import posts_feed as feed_route  # noqa: E402


OPERATOR = "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b"


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture
def app():
    fastapi_app = FastAPI()
    fastapi_app.include_router(feed_route.router, prefix="/api/posts")
    return TestClient(fastapi_app)


def _post_row(**overrides):
    base = {
        "id":               1,
        "token_id":         8047,
        "wallet_address":   OPERATOR,
        "content":          "longing $NXT",
        "source":           "feed",
        "action_type":      None,
        "visual_metadata":  {},
        "parent_post_id":   None,
        "hashtags":         ["wagmi"],
        "mentions":         [],
        "tickers":          ["NXT"],
        "like_count":       0,
        "reply_count":      0,
        "created_at":       _now(),
        "expires_at":       _now() + timedelta(days=30),
        "name":             "STORM-11",
        "archetype":        "DEGEN",
        "corporation":      "OPERATIONS",
        "ipfs_hash":        "bafyEXAMPLE",
        "parent_token_id":  None,
        "parent_content":   None,
        "parent_name":      None,
    }
    base.update(overrides)
    return base


# ─── /{post_id} — single post + replies ──────────────────────────────


def test_get_post_returns_payload_with_replies(app, monkeypatch):
    """Two-call shape: fetch_one for the post, fetch_all for replies."""
    monkeypatch.setattr(
        feed_route, "fetch_one", lambda sql, params: _post_row(id=1),
    )
    monkeypatch.setattr(
        feed_route, "fetch_all",
        lambda sql, params: [_post_row(id=2, parent_post_id=1, content="reply 1")],
    )
    resp = app.get("/api/posts/1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["post"]["id"] == 1
    assert len(body["replies"]) == 1
    assert body["replies"][0]["id"] == 2


def test_get_post_404_when_missing(app, monkeypatch):
    monkeypatch.setattr(feed_route, "fetch_one", lambda sql, params: None)
    monkeypatch.setattr(feed_route, "fetch_all", lambda sql, params: [])
    resp = app.get("/api/posts/9999")
    assert resp.status_code == 404


def test_get_post_user_has_liked_threads_through(app, monkeypatch):
    """When `wallet` is provided, the route fetches the user's likes
    for the post + replies in a single SELECT and threads the flag
    through the wire payload."""
    seen: dict = {"queries": []}

    def fake_one(sql, params):
        seen["queries"].append(("one", sql))
        return _post_row(id=10)

    def fake_all(sql, params):
        seen["queries"].append(("all", sql))
        if "FROM nx_post_likes" in sql:
            return [{"post_id": 10}, {"post_id": 11}]
        return [_post_row(id=11, parent_post_id=10)]

    monkeypatch.setattr(feed_route, "fetch_one", fake_one)
    monkeypatch.setattr(feed_route, "fetch_all", fake_all)

    resp = app.get(f"/api/posts/10?wallet={OPERATOR}")
    body = resp.json()
    assert body["post"]["user_has_liked"] is True
    assert body["replies"][0]["user_has_liked"] is True


# ─── like / unlike ───────────────────────────────────────────────────


def test_like_post_inserts_idempotent(app, monkeypatch):
    """The INSERT uses ON CONFLICT DO NOTHING so re-liking is a
    no-op. Like_count is read back via fetch_one after."""
    captured: dict = {}

    def fake_one(sql, params):
        captured.setdefault("ones", []).append((sql, params))
        if "WHERE id = %s" in sql and "like_count" not in sql:
            return {"_": 1}  # post exists check
        return {"like_count": 1}

    def fake_exec(sql, params):
        captured.setdefault("execs", []).append((sql, params))

    monkeypatch.setattr(feed_route, "fetch_one", fake_one)
    monkeypatch.setattr(feed_route, "execute", fake_exec)

    resp = app.post(f"/api/posts/42/like?wallet={OPERATOR}")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "like_count": 1}

    # The single INSERT contains ON CONFLICT DO NOTHING (idempotency).
    insert_sql, insert_params = captured["execs"][0]
    assert "INSERT INTO nx_post_likes" in insert_sql
    assert "ON CONFLICT" in insert_sql
    assert "DO NOTHING" in insert_sql
    assert insert_params[0] == 42
    assert insert_params[1] == OPERATOR.lower()


def test_like_post_404_when_post_missing(app, monkeypatch):
    """A like to a missing post returns 404 — without this, the
    ON CONFLICT DO NOTHING path would silently swallow the error."""
    monkeypatch.setattr(feed_route, "fetch_one", lambda sql, params: None)
    called = {"exec": False}
    monkeypatch.setattr(
        feed_route, "execute",
        lambda *a, **kw: called.update(exec=True),
    )
    resp = app.post(f"/api/posts/9999/like?wallet={OPERATOR}")
    assert resp.status_code == 404
    assert called["exec"] is False


def test_like_post_400_for_invalid_wallet(app, monkeypatch):
    monkeypatch.setattr(feed_route, "fetch_one", lambda sql, params: {"_": 1})
    resp = app.post("/api/posts/1/like?wallet=not-a-wallet")
    assert resp.status_code == 400


def test_unlike_post_idempotent_no_404(app, monkeypatch):
    """Unliking a non-existent like is a no-op (no 404). The DELETE
    doesn't error and the read-back returns whatever the trigger
    decided is current."""
    monkeypatch.setattr(
        feed_route, "fetch_one",
        lambda sql, params: {"like_count": 0},
    )
    monkeypatch.setattr(feed_route, "execute", lambda sql, params: None)
    resp = app.delete(f"/api/posts/1/like?wallet={OPERATOR}")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "like_count": 0}


def test_unlike_post_does_not_404_for_missing_post(app, monkeypatch):
    """The brief: unlike on a deleted post (TTL or moderation)
    cascade-removes the like anyway; 404'ing here would create UI
    flicker for no benefit."""
    captured = {"selects": 0}

    def fake_one(sql, params):
        captured["selects"] += 1
        return {"like_count": 0}

    monkeypatch.setattr(feed_route, "fetch_one", fake_one)
    monkeypatch.setattr(feed_route, "execute", lambda sql, params: None)

    resp = app.delete(f"/api/posts/9999/like?wallet={OPERATOR}")
    assert resp.status_code == 200


# ─── /trending ───────────────────────────────────────────────────────


def test_trending_returns_aggregated_payload(app, monkeypatch):
    monkeypatch.setattr(
        feed_route, "fetch_all",
        lambda sql, params=None: [
            {"tag": "wagmi", "post_count": 12},
            {"tag": "ngmi",  "post_count": 7},
        ],
    )
    resp = app.get("/api/posts/trending")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["trending"][0] == {"tag": "wagmi", "post_count": 12}


def test_trending_sql_filters_7d_and_visibility(app, monkeypatch):
    captured: dict = {}

    def fake(sql, params=None):
        captured["sql"] = sql
        return []

    monkeypatch.setattr(feed_route, "fetch_all", fake)
    app.get("/api/posts/trending")
    sql = captured["sql"]
    assert "INTERVAL '7 days'" in sql
    assert "visibility = 'public'" in sql
    assert "UNNEST(hashtags)" in sql
    assert "LIMIT 10" in sql


# ─── /feed-stats ─────────────────────────────────────────────────────


def test_feed_stats_returns_counts(app, monkeypatch):
    monkeypatch.setattr(
        feed_route, "fetch_one",
        lambda sql, params=None: {
            "devs_active": 1234,
            "posts_today": 56,
            "devs_dormant": 78,
        },
    )
    resp = app.get("/api/posts/feed-stats")
    assert resp.status_code == 200
    assert resp.json() == {
        "ok": True,
        "devs_active": 1234,
        "posts_today": 56,
        "devs_dormant": 78,
    }


def test_feed_stats_handles_null_row(app, monkeypatch):
    """Defensive: if the SELECT returns nothing the route must still
    return a 0'd payload, not crash."""
    monkeypatch.setattr(feed_route, "fetch_one", lambda sql, params=None: None)
    resp = app.get("/api/posts/feed-stats")
    assert resp.status_code == 200
    assert resp.json() == {
        "ok": True, "devs_active": 0, "posts_today": 0, "devs_dormant": 0,
    }


# ─── /who-to-follow ──────────────────────────────────────────────────


def test_who_to_follow_returns_suggestions(app, monkeypatch):
    monkeypatch.setattr(
        feed_route, "fetch_all",
        lambda sql, params: [
            {
                "token_id":          1,
                "name":              "A",
                "archetype":         "DEGEN",
                "corporation":       "OPERATIONS",
                "ipfs_hash":         "bafyA",
                "recent_post_count": 5,
            },
        ],
    )
    resp = app.get(f"/api/posts/who-to-follow?wallet={OPERATOR}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    s = body["suggestions"][0]
    assert s["token_id"] == 1
    assert s["recent_post_count"] == 5
    assert s["ipfs_image"].endswith("/bafyA")


def test_who_to_follow_400_for_invalid_wallet(app, monkeypatch):
    monkeypatch.setattr(feed_route, "fetch_all", lambda sql, params: [])
    resp = app.get("/api/posts/who-to-follow?wallet=not-a-wallet")
    assert resp.status_code == 400


def test_who_to_follow_sql_excludes_self_and_requires_posts(app, monkeypatch):
    captured: dict = {}

    def fake(sql, params):
        captured["sql"] = sql
        return []

    monkeypatch.setattr(feed_route, "fetch_all", fake)
    app.get(f"/api/posts/who-to-follow?wallet={OPERATOR}")
    sql = captured["sql"]
    assert "LOWER(d.owner_address) != LOWER(%s)" in sql
    assert "EXISTS" in sql
    assert "p.source = 'feed'" in sql
    assert "ORDER BY RANDOM()" in sql
    assert "LIMIT 3" in sql
