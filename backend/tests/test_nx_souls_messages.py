"""Tests for the Phase 3.5.1 message-persistence layer.

Two surfaces under test:

  1. backend.services.nx_souls.messages
       - calculate_expires_at: TTL math
       - insert_message_and_refresh_chat: SQL contract for the
         INSERT + sliding-window UPDATE pair
       - get_chat_history / get_active_chats: SQL pinning
       - cleanup_expired_messages: deletion contract

  2. The new endpoints in backend.api.routes.user:
       - GET /api/user/{wallet}/messages
       - GET /api/user/{wallet}/active-chats
     Plus the persistence side-effect baked into
     POST /api/devs/{token_id}/chat.

Helpers are exercised through stubbed psycopg2-style cursors so the
SQL contract is pinned without needing a live Postgres. The
endpoints use the existing TestClient + monkeypatched fetch_all
pattern from test_nx_souls_conversations.py.
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api.routes import user as user_route  # noqa: E402
from backend.services.nx_souls import messages as messages_module  # noqa: E402


OWNER = "0x" + "ab" * 20
TOKEN_ID = 29572


# ─── Stub cursor / connection ────────────────────────────────────────────


class StubCursor:
    """Minimal cursor stub. Records every (sql, params) tuple in
    `.calls`; replies to `.fetchone()` / `.fetchall()` from the
    `.script` queue. `rowcount` is set per call."""

    def __init__(self, script=None):
        self.calls: list[tuple[str, tuple]] = []
        self._script = list(script or [])
        self.rowcount = 0

    def execute(self, sql, params=None):
        self.calls.append((sql, tuple(params) if params else ()))
        # Default rowcount; tests can override via `.rowcount` after.
        self.rowcount = 1

    def fetchone(self):
        if not self._script:
            return None
        return self._script.pop(0)

    def fetchall(self):
        return self._script

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class StubConn:
    def __init__(self, cur):
        self.cur = cur

    def cursor(self):
        return self.cur

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


@pytest.fixture
def patch_get_db(monkeypatch):
    """Patch `messages.get_db` to return a StubConn with a scripted
    cursor. Returns the cursor so the test can inspect `.calls`."""

    def _patch(script=None):
        cur = StubCursor(script=script)
        monkeypatch.setattr(messages_module, "get_db", lambda: StubConn(cur))
        return cur

    return _patch


# ─── calculate_expires_at ────────────────────────────────────────────────


def test_calculate_expires_at_adds_24h():
    base = datetime(2026, 5, 4, 12, 0, 0, tzinfo=timezone.utc)
    assert messages_module.calculate_expires_at(base) == datetime(
        2026, 5, 5, 12, 0, 0, tzinfo=timezone.utc
    )


def test_calculate_expires_at_handles_naive_input():
    """Naive datetime is treated as UTC so an accidental naive value
    upstream doesn't write timezone-shifted expiry into the schema's
    TIMESTAMPTZ column."""
    base = datetime(2026, 5, 4, 12, 0, 0)  # naive
    out = messages_module.calculate_expires_at(base)
    assert out.tzinfo is timezone.utc
    assert out == datetime(2026, 5, 5, 12, 0, 0, tzinfo=timezone.utc)


def test_calculate_expires_at_default_uses_now(monkeypatch):
    """Default branch uses datetime.now(tz=UTC); pin that the result
    is always 24h ahead of the current wall clock."""
    out = messages_module.calculate_expires_at()
    delta = out - datetime.now(timezone.utc)
    assert timedelta(hours=23, minutes=59) < delta <= timedelta(hours=24)


# ─── insert_message_and_refresh_chat ─────────────────────────────────────


def test_insert_writes_lowercased_wallet(patch_get_db):
    cur = patch_get_db(script=[{"id": 42}])
    new_id = messages_module.insert_message_and_refresh_chat(
        wallet_address="0xABCDEF" + "11" * 17,
        token_id=TOKEN_ID,
        role="user",
        content="hi",
    )
    assert new_id == 42
    insert_sql, insert_params = cur.calls[0]
    assert "INSERT INTO nx_souls_messages" in insert_sql
    # token_id, wallet, role, content, climax, resting, provider,
    # created_at, expires_at — wallet is the second positional.
    assert insert_params[0] == TOKEN_ID
    assert insert_params[1] == ("0xabcdef" + "11" * 17)
    assert insert_params[2] == "user"
    assert insert_params[3] == "hi"


def test_insert_passes_flags_through(patch_get_db):
    cur = patch_get_db(script=[{"id": 7}])
    messages_module.insert_message_and_refresh_chat(
        wallet_address=OWNER,
        token_id=TOKEN_ID,
        role="assistant",
        content="hello back",
        is_climax=True,
        is_resting=False,
        provider_used="openrouter-sonnet",
    )
    _, insert_params = cur.calls[0]
    # Positional layout from messages.py:
    #   (token_id, wallet, role, content,
    #    is_climax, is_resting, provider_used,
    #    created_at, expires_at)
    assert insert_params[4] is True   # is_climax
    assert insert_params[5] is False  # is_resting
    assert insert_params[6] == "openrouter-sonnet"


def test_insert_runs_sliding_window_update(patch_get_db):
    """Second SQL call must be the UPDATE that refreshes every other
    not-yet-expired message in the SAME (wallet, token) chat to the
    new row's expires_at, excluding the row we just inserted."""
    cur = patch_get_db(script=[{"id": 99}])
    messages_module.insert_message_and_refresh_chat(
        wallet_address=OWNER, token_id=TOKEN_ID, role="user", content="x"
    )
    assert len(cur.calls) == 2
    update_sql, update_params = cur.calls[1]
    assert "UPDATE nx_souls_messages" in update_sql
    assert "SET expires_at = %s" in update_sql
    assert "wallet_address = %s" in update_sql
    assert "token_id = %s" in update_sql
    assert "expires_at > %s" in update_sql
    assert "id <> %s" in update_sql
    # Params: (expires_at, wallet, token_id, now, new_id)
    assert update_params[1] == OWNER.lower()
    assert update_params[2] == TOKEN_ID
    assert update_params[4] == 99


def test_insert_expires_at_consistent_between_insert_and_update(patch_get_db):
    """The expires_at written to the new row must equal the
    expires_at applied to siblings — otherwise the sliding window
    creates a row with a different TTL than its peers."""
    cur = patch_get_db(script=[{"id": 1}])
    messages_module.insert_message_and_refresh_chat(
        wallet_address=OWNER, token_id=TOKEN_ID, role="user", content="hi"
    )
    insert_expires = cur.calls[0][1][8]  # 9th positional in INSERT
    update_expires = cur.calls[1][1][0]  # 1st positional in UPDATE
    assert insert_expires == update_expires
    # Sanity: 24h ahead of now
    assert (insert_expires - datetime.now(timezone.utc)) <= timedelta(hours=24)


# ─── get_chat_history ────────────────────────────────────────────────────


def test_get_chat_history_pins_sql_contract(monkeypatch):
    captured: dict = {}

    def fake_fetch_all(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return [{"id": 1, "role": "user", "content": "hi",
                 "is_climax": False, "is_resting": False,
                 "provider_used": None, "created_at": datetime.now(timezone.utc),
                 "expires_at": datetime.now(timezone.utc) + timedelta(hours=23)}]

    monkeypatch.setattr(messages_module, "fetch_all", fake_fetch_all)
    rows = messages_module.get_chat_history(OWNER, TOKEN_ID, limit=50)

    assert len(rows) == 1
    sql, params = captured["sql"], captured["params"]
    assert "FROM nx_souls_messages" in sql
    # Lazy filter — expired rows must never reach the response.
    assert "expires_at > NOW()" in sql
    # Oldest first so the frontend can render in chat order.
    assert "ORDER BY created_at ASC" in sql
    # LIMIT bound passed through to prevent runaway payloads.
    assert "LIMIT %s" in sql
    assert params == (OWNER.lower(), TOKEN_ID, 50)


# ─── get_active_chats ────────────────────────────────────────────────────


def test_get_active_chats_pins_sql_contract(monkeypatch):
    captured: dict = {}

    def fake_fetch_all(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return []

    monkeypatch.setattr(messages_module, "fetch_all", fake_fetch_all)
    messages_module.get_active_chats(OWNER)

    sql, params = captured["sql"], captured["params"]
    # ROW_NUMBER OVER PARTITION BY token_id is the "last per group"
    # pattern; pin its presence so a future refactor doesn't silently
    # change one-row-per-chat semantics.
    assert "ROW_NUMBER() OVER" in sql
    assert "PARTITION BY m.token_id" in sql
    assert "ORDER BY m.created_at DESC" in sql
    # Must filter by lowercased wallet.
    assert params == (OWNER.lower(),)


# ─── cleanup_expired_messages ────────────────────────────────────────────


def test_cleanup_returns_deleted_count(patch_get_db):
    cur = patch_get_db()
    cur.rowcount = 7  # post-DELETE rowcount
    # The helper assigns rowcount AFTER execute() completes; our stub
    # sets rowcount=1 inside execute(). Override via a patched
    # execute that preserves the test-set value.
    original_execute = cur.execute

    def execute_keep_rowcount(sql, params=None):
        original_execute(sql, params)
        cur.rowcount = 7

    cur.execute = execute_keep_rowcount
    deleted = messages_module.cleanup_expired_messages()
    assert deleted == 7
    sql, _ = cur.calls[0]
    assert "DELETE FROM nx_souls_messages" in sql
    assert "WHERE expires_at <= NOW()" in sql


def test_cleanup_returns_zero_when_nothing_expired(patch_get_db):
    cur = patch_get_db()
    cur.rowcount = 0
    original_execute = cur.execute

    def execute_keep_rowcount(sql, params=None):
        original_execute(sql, params)
        cur.rowcount = 0

    cur.execute = execute_keep_rowcount
    assert messages_module.cleanup_expired_messages() == 0


# ─── Endpoint: GET /api/user/{wallet}/messages ───────────────────────────


@pytest.fixture
def user_app(monkeypatch):
    """Mount the user router with fetch_all + get_chat_history stubbed."""
    fastapi_app = FastAPI()
    fastapi_app.include_router(user_route.router, prefix="/api/user")
    return TestClient(fastapi_app)


def test_messages_endpoint_returns_history(user_app, monkeypatch):
    now = datetime.now(timezone.utc)

    def fake_history(addr, token_id, limit=100):
        return [
            {"id": 1, "role": "user", "content": "yo",
             "is_climax": False, "is_resting": False,
             "provider_used": None,
             "created_at": now, "expires_at": now + timedelta(hours=23)},
            {"id": 2, "role": "assistant", "content": "ngmi ser",
             "is_climax": False, "is_resting": False,
             "provider_used": "groq",
             "created_at": now, "expires_at": now + timedelta(hours=23)},
        ]

    monkeypatch.setattr(user_route, "get_chat_history", fake_history)
    resp = user_app.get(f"/api/user/{OWNER}/messages?token_id={TOKEN_ID}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert len(body["messages"]) == 2
    assert body["messages"][0]["role"] == "user"
    assert body["messages"][1]["role"] == "assistant"
    assert body["messages"][1]["provider_used"] == "groq"
    # Timestamps must be ISO strings, not datetime objects.
    assert isinstance(body["messages"][0]["created_at"], str)
    assert body["messages"][0]["created_at"].endswith("+00:00")


def test_messages_endpoint_rejects_missing_token_id(user_app):
    resp = user_app.get(f"/api/user/{OWNER}/messages")
    assert resp.status_code == 422  # FastAPI validation error


def test_messages_endpoint_rejects_invalid_wallet(user_app, monkeypatch):
    """The validate_wallet helper handles the 400. Confirm get_chat_history
    is NOT reached."""
    called = {"hit": False}

    def fake_history(*a, **kw):
        called["hit"] = True
        return []

    monkeypatch.setattr(user_route, "get_chat_history", fake_history)
    resp = user_app.get(f"/api/user/not-a-wallet/messages?token_id={TOKEN_ID}")
    assert resp.status_code == 400
    assert called["hit"] is False


def test_messages_endpoint_empty_history(user_app, monkeypatch):
    monkeypatch.setattr(user_route, "get_chat_history", lambda *a, **kw: [])
    resp = user_app.get(f"/api/user/{OWNER}/messages?token_id={TOKEN_ID}")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "messages": []}


# ─── Endpoint: GET /api/user/{wallet}/active-chats ───────────────────────


def _active_row(**overrides):
    """One row in the shape the active-chats SQL returns. Defaults
    represent a healthy active-chat with a recent user message."""
    now = datetime.now(timezone.utc)
    base = {
        "token_id":        TOKEN_ID,
        "last_role":       "assistant",
        "last_content":    "this is the last message preview text",
        "last_message_at": now,
        "expires_at":      now + timedelta(hours=23),
        "name":            "LYNX-X0",
        "archetype":       "INFLUENCER",
        "corporation":     "ZUCK_LABS",
        "rarity_tier":     "common",
        "ipfs_hash":       "bafyHASH",
        "status":          "active",
        "energy":          80,
        "max_energy":      100,
        "messages_today":  3,
        "quota_date":      datetime.now(timezone.utc).date(),
    }
    base.update(overrides)
    return base


def test_active_chats_returns_payload(user_app, monkeypatch):
    monkeypatch.setattr(user_route, "fetch_all", lambda sql, params: [_active_row()])
    resp = user_app.get(f"/api/user/{OWNER}/active-chats")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert len(body["active_chats"]) == 1
    chat = body["active_chats"][0]
    assert chat["token_id"] == TOKEN_ID
    assert chat["name"] == "LYNX-X0"
    assert chat["archetype"] == "INFLUENCER"
    assert chat["ipfs_image"] == "https://gateway.pinata.cloud/ipfs/bafyHASH"
    assert chat["last_message"]["role"] == "assistant"
    assert chat["last_message"]["content_preview"].startswith("this is the last")
    assert chat["quota"]["limit"] == 30  # common
    assert chat["quota"]["used"] == 3
    assert chat["is_resting"] is False


def test_active_chats_truncates_long_preview(user_app, monkeypatch):
    long_text = "x" * 250
    monkeypatch.setattr(
        user_route, "fetch_all",
        lambda sql, params: [_active_row(last_content=long_text)]
    )
    resp = user_app.get(f"/api/user/{OWNER}/active-chats")
    preview = resp.json()["active_chats"][0]["last_message"]["content_preview"]
    assert len(preview) <= 103  # 100 + "..."
    assert preview.endswith("...")


def test_active_chats_stale_quota_displays_zero(user_app, monkeypatch):
    """Same lazy-reset semantics as /conversations: if quota_date is
    older than today_utc, show used=0 even though the row says
    otherwise. The next chat call performs the real reset."""
    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    monkeypatch.setattr(
        user_route, "fetch_all",
        lambda sql, params: [_active_row(messages_today=29, quota_date=yesterday)]
    )
    resp = user_app.get(f"/api/user/{OWNER}/active-chats")
    chat = resp.json()["active_chats"][0]
    assert chat["quota"]["used"] == 0
    assert chat["is_resting"] is False


def test_active_chats_marks_resting_when_at_limit(user_app, monkeypatch):
    today = datetime.now(timezone.utc).date()
    monkeypatch.setattr(
        user_route, "fetch_all",
        lambda sql, params: [_active_row(messages_today=30, quota_date=today)]
    )
    resp = user_app.get(f"/api/user/{OWNER}/active-chats")
    chat = resp.json()["active_chats"][0]
    assert chat["is_resting"] is True
    assert chat["quota"]["remaining"] == 0


def test_active_chats_empty_when_no_active_chats(user_app, monkeypatch):
    monkeypatch.setattr(user_route, "fetch_all", lambda sql, params: [])
    resp = user_app.get(f"/api/user/{OWNER}/active-chats")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "active_chats": []}


def test_active_chats_sql_filters_frozen_and_owner(user_app, monkeypatch):
    """Pin the SQL clauses that protect against admin-frozen Devs and
    against showing chats whose Dev was transferred to another wallet
    mid-conversation."""
    captured: dict = {}

    def fake(sql, params):
        captured["sql"] = sql
        return []

    monkeypatch.setattr(user_route, "fetch_all", fake)
    user_app.get(f"/api/user/{OWNER}/active-chats")
    sql = captured["sql"]
    assert "d.owner_address = %s" in sql
    assert "d.status <> 'frozen'" in sql
    # Window function must be present for one-per-chat semantics.
    assert "ROW_NUMBER() OVER" in sql


def test_active_chats_rejects_invalid_wallet(user_app, monkeypatch):
    called = {"hit": False}
    monkeypatch.setattr(
        user_route, "fetch_all",
        lambda *a, **kw: called.update(hit=True) or []
    )
    resp = user_app.get("/api/user/not-a-wallet/active-chats")
    assert resp.status_code == 400
    assert called["hit"] is False


# ─── Persistence side-effect on POST /chat ───────────────────────────────


def test_chat_endpoint_persists_user_and_assistant_on_success(monkeypatch):
    """POST /api/devs/{id}/chat must call insert_message_and_refresh_chat
    twice on success: once for the user message, once for the assistant
    response with role='assistant' and the climax/provider flags
    threaded through."""
    from backend.api.routes import nx_souls as nx_souls_route

    persisted: list[dict] = []

    def fake_insert(**kwargs):
        persisted.append(kwargs)
        return len(persisted)

    monkeypatch.setattr(nx_souls_route, "insert_message_and_refresh_chat", fake_insert)

    # Mock everything else so we can drive the success path without a
    # real DB / LLM.
    async def fake_call_llm(*args, **kwargs):
        return ("groq response", "groq")

    monkeypatch.setattr(nx_souls_route, "call_llm", fake_call_llm)
    monkeypatch.setattr(nx_souls_route, "is_climax_turn", lambda msg, n: True)
    monkeypatch.setattr(nx_souls_route, "build_persona", lambda cur, tid: "PERSONA")
    monkeypatch.setattr(
        nx_souls_route, "get_quota_state",
        lambda cur, tid, rarity: type("Q", (), {
            "exceeded": False, "used": 1, "limit": 30,
            "resets_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "remaining": 29,
        })()
    )
    monkeypatch.setattr(nx_souls_route, "increment_quota", lambda cur, tid: 2)
    monkeypatch.setattr(nx_souls_route, "_check_owner",
                        lambda cur, tid, w, request_ip="x": {
                            "rarity_tier": "common",
                            "archetype": "DEGEN",
                            "status": "active",
                        })
    monkeypatch.setattr(nx_souls_route, "_log_message_event", lambda *a, **kw: None)
    monkeypatch.setattr(nx_souls_route, "_enforce_ip_rate_limits",
                        lambda *a, **kw: None)

    class FakeLimiter:
        def check(self, key):
            return None

    monkeypatch.setattr(nx_souls_route, "chat_limiter", FakeLimiter())

    # get_db is used for the ownership/quota fetch and the post-success
    # increment_quota. A no-op stub conn is enough since the helpers
    # we monkeypatched above don't actually use the cursor.
    class NoopCur:
        def execute(self, *a, **kw): return None
        def fetchone(self): return None
        def __enter__(self): return self
        def __exit__(self, *a): return False

    class NoopConn:
        def cursor(self): return NoopCur()
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(nx_souls_route, "get_db", lambda: NoopConn())
    monkeypatch.setattr(nx_souls_route, "validate_wallet", lambda w: w.lower())

    fastapi_app = FastAPI()
    fastapi_app.include_router(nx_souls_route.router, prefix="/api/devs")
    client = TestClient(fastapi_app)

    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json={
            "message": "are we in a simulation?",
            "session_messages": [],
            "wallet_address": OWNER,
        },
    )
    assert resp.status_code == 200, resp.text
    assert len(persisted) == 2
    user, assistant = persisted
    assert user["role"] == "user"
    assert user["content"] == "are we in a simulation?"
    assert assistant["role"] == "assistant"
    assert assistant["content"] == "groq response"
    assert assistant["is_climax"] is True
    assert assistant["is_resting"] is False
    assert assistant["provider_used"] == "groq"


def test_chat_endpoint_persists_resting_role_when_quota_exhausted(monkeypatch):
    """When the quota gate trips, the persisted assistant row must use
    role='system_resting' + is_resting=True + provider_used='internal',
    so the frontend can distinguish rest replies from real ones when
    rendering history."""
    from backend.api.routes import nx_souls as nx_souls_route

    persisted: list[dict] = []
    monkeypatch.setattr(
        nx_souls_route, "insert_message_and_refresh_chat",
        lambda **kw: persisted.append(kw) or len(persisted)
    )

    monkeypatch.setattr(nx_souls_route, "_check_owner",
                        lambda cur, tid, w, request_ip="x": {
                            "rarity_tier": "common",
                            "archetype": "DEGEN",
                            "status": "active",
                        })
    monkeypatch.setattr(
        nx_souls_route, "get_quota_state",
        lambda cur, tid, rarity: type("Q", (), {
            "exceeded": True, "used": 30, "limit": 30,
            "resets_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "remaining": 0,
        })()
    )
    monkeypatch.setattr(nx_souls_route, "_log_message_event", lambda *a, **kw: None)
    monkeypatch.setattr(nx_souls_route, "_enforce_ip_rate_limits",
                        lambda *a, **kw: None)

    class FakeLimiter:
        def check(self, key): return None

    monkeypatch.setattr(nx_souls_route, "chat_limiter", FakeLimiter())
    monkeypatch.setattr(nx_souls_route, "validate_wallet", lambda w: w.lower())

    class NoopCur:
        def execute(self, *a, **kw): return None
        def fetchone(self): return None
        def __enter__(self): return self
        def __exit__(self, *a): return False

    class NoopConn:
        def cursor(self): return NoopCur()
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(nx_souls_route, "get_db", lambda: NoopConn())

    fastapi_app = FastAPI()
    fastapi_app.include_router(nx_souls_route.router, prefix="/api/devs")
    client = TestClient(fastapi_app)

    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json={
            "message": "yo",
            "session_messages": [],
            "wallet_address": OWNER,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_resting"] is True
    assert len(persisted) == 2
    assert persisted[0]["role"] == "user"
    assert persisted[1]["role"] == "system_resting"
    assert persisted[1]["is_resting"] is True
    assert persisted[1]["provider_used"] == "internal"


def test_chat_endpoint_response_unchanged_when_persistence_fails(monkeypatch):
    """Persistence is best-effort. If insert_message_and_refresh_chat
    raises, the chat reply still goes out cleanly with the expected
    200 + response payload — frontend doesn't notice."""
    from backend.api.routes import nx_souls as nx_souls_route

    def boom(**kwargs):
        raise RuntimeError("simulated db down")

    monkeypatch.setattr(nx_souls_route, "insert_message_and_refresh_chat", boom)

    async def fake_call_llm(*args, **kwargs):
        return ("ok ser", "groq")

    monkeypatch.setattr(nx_souls_route, "call_llm", fake_call_llm)
    monkeypatch.setattr(nx_souls_route, "is_climax_turn", lambda msg, n: False)
    monkeypatch.setattr(nx_souls_route, "build_persona", lambda cur, tid: "P")
    monkeypatch.setattr(
        nx_souls_route, "get_quota_state",
        lambda cur, tid, rarity: type("Q", (), {
            "exceeded": False, "used": 0, "limit": 30,
            "resets_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "remaining": 30,
        })()
    )
    monkeypatch.setattr(nx_souls_route, "increment_quota", lambda cur, tid: 1)
    monkeypatch.setattr(nx_souls_route, "_check_owner",
                        lambda cur, tid, w, request_ip="x": {
                            "rarity_tier": "common", "archetype": "DEGEN",
                            "status": "active",
                        })
    monkeypatch.setattr(nx_souls_route, "_log_message_event", lambda *a, **kw: None)
    monkeypatch.setattr(nx_souls_route, "_enforce_ip_rate_limits",
                        lambda *a, **kw: None)

    class FakeLimiter:
        def check(self, key): return None

    monkeypatch.setattr(nx_souls_route, "chat_limiter", FakeLimiter())
    monkeypatch.setattr(nx_souls_route, "validate_wallet", lambda w: w.lower())

    class NoopCur:
        def execute(self, *a, **kw): return None
        def fetchone(self): return None
        def __enter__(self): return self
        def __exit__(self, *a): return False

    class NoopConn:
        def cursor(self): return NoopCur()
        def __enter__(self): return self
        def __exit__(self, *a): return False

    monkeypatch.setattr(nx_souls_route, "get_db", lambda: NoopConn())

    fastapi_app = FastAPI()
    fastapi_app.include_router(nx_souls_route.router, prefix="/api/devs")
    client = TestClient(fastapi_app)

    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json={
            "message": "yo",
            "session_messages": [],
            "wallet_address": OWNER,
        },
    )
    # Response unchanged — 200 + reply, even though every persistence
    # call raised.
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["response"] == "ok ser"
