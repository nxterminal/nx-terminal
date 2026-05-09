"""Tests for the POST /api/devs/{token_id}/chat endpoint.

These cover the route-level wiring added in PR #350 follow-up:
  - combined session_messages.content > 8000 chars → 400
  - quota_exceeded → 429 with the right payload shape
  - quota counter increments on success and surfaces in response
  - 403 ownership-mismatch logs claimed_wallet + real_owner + ip
  - per-wallet cooldown hit logs ip + wallet
  - successful chat carries the quota block

DB is stubbed at the connection-pool boundary so no Postgres is
needed. The LLM router is stubbed at module level so no HTTP is made.
Rate limiters are bypassed (`get_sync_redis` returns None → fail-open)
unless a test specifically wants to assert the cooldown log.
"""

from __future__ import annotations

import logging
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api import deps as deps_module  # noqa: E402
from backend.api import rate_limit as rate_limit_module  # noqa: E402
from backend.api.routes import nx_souls as nx_souls_route  # noqa: E402
from backend.services.nx_souls import llm_router as llm_router_module  # noqa: E402
from backend.services.nx_souls import persona as persona_module  # noqa: E402


OWNER = "0x" + "ab" * 20
NOT_OWNER = "0x" + "cd" * 20
TOKEN_ID = 29572


# ─── Stub DB ──────────────────────────────────────────────────────────────


class StubCursor:
    """Tiny psycopg2-RealDictCursor lookalike. Routes each .execute()
    call to a handler that knows the SQL fingerprint, scripted by the
    test through .program(...)."""

    def __init__(self, program):
        self._program = program
        self._last = None

    def execute(self, sql, params=None):
        self._last = self._program(sql, params)

    def fetchone(self):
        return self._last

    def fetchall(self):
        return self._last or []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class StubConn:
    def __init__(self, program):
        self._program = program

    def cursor(self):
        return StubCursor(self._program)

    def commit(self):
        pass

    def rollback(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def make_program(*, owner=OWNER, rarity="common", quota_used=0,
                 status="active", token_exists=True, archetype="INFLUENCER",
                 posts=None):
    """Build a SQL fingerprint dispatcher for one fixture.

    `posts` is an optional dict {post_id: {"token_id": int, "content": str}}
    that wires the Phase 5.4 nx_posts lookup. Defaults to empty so any
    referenced_post_id resolves to None and the chat proceeds without
    injection (the documented "fail open" behaviour).
    """
    state = {"used": quota_used}
    posts_table = dict(posts or {})

    def program(sql, params):
        if "FROM devs WHERE token_id" in sql:
            if not token_exists:
                return None
            return {
                "token_id": TOKEN_ID,
                "name": "LYNX-X0",
                "owner_address": owner,
                "status": status,
                "rarity_tier": rarity,
                "archetype": archetype,
            }
        if "FROM nx_posts" in sql and "id = %s" in sql:
            # Phase 5.4 — referenced-post lookup. params == (post_id,).
            post_id = params[0] if params else None
            return posts_table.get(post_id)
        if "INTO nx_souls_quota" in sql:
            return {
                "messages_today": state["used"],
                "quota_date": date.today(),
            }
        if "UPDATE nx_souls_quota" in sql:
            state["used"] += 1
            return {"messages_today": state["used"]}
        if "INTO nx_souls_messages_cache" in sql:
            return None
        # Persona LEFT JOIN — return a minimal joined row.
        if "FROM devs d" in sql and "LEFT JOIN dev_canonical_traits" in sql:
            return {
                "token_id": TOKEN_ID,
                "name": "LYNX-X0",
                "species": "Bunny",
                "archetype": archetype,
                "corporation": "ZUCK_LABS",
                "rarity_tier": rarity,
                "alignment": "Neutral Good",
                "risk_level": "Conservative",
                "social_style": "Influencer",
                "coding_style": "Over-Engineer",
                "work_ethic": "Lazy",
                "status": status,
                "clothing": None, "clothing_pattern": None,
                "eyewear": None, "neckwear": None, "spots": None,
                "blush": None, "ear_detail": None,
                "voice_tone": "Aggressive", "quirk": "speaks_lowercase",
                "lore_faction": "Mainstream",
            }
        return None

    # Expose state so individual tests can inspect quota_used after the fact.
    program.state = state  # type: ignore[attr-defined]
    return program


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _patch_redis_off(monkeypatch):
    """Force every rate-limiter to fail-open by reporting Redis as down,
    so tests don't need a live Redis. Specific tests that want to assert
    the cooldown log re-patch this on top."""
    monkeypatch.setattr(deps_module, "get_sync_redis", lambda: None)


@pytest.fixture
def stub_db(monkeypatch):
    """Returns a setter the test calls with kwargs to control the
    program. After the test, get_db() returns a fresh StubConn each
    call so the route's multiple `with get_db()` contexts all see the
    same shared state through the closure.

    The setter exposes `.state` which mirrors the program's mutable
    state dict (`{"used": int}`) so tests can assert post-call quota
    behaviour without re-reading the DB.
    """
    program_holder = {"program": make_program()}

    def set_program(**kwargs):
        program_holder["program"] = make_program(**kwargs)
        set_program.state = program_holder["program"].state  # type: ignore[attr-defined]

    set_program.state = program_holder["program"].state  # type: ignore[attr-defined]

    def fake_get_db():
        return StubConn(program_holder["program"])

    monkeypatch.setattr(nx_souls_route, "get_db", fake_get_db)
    # The persona module imports get_db indirectly via cur.execute, so
    # patching the route's binding is enough — the route owns the conn.
    # Persona cache must not leak between tests.
    persona_module.invalidate_persona_cache()
    return set_program


class _LLMStub:
    """Stand-in for `call_llm`. Records every invocation so tests can
    assert the cascade was (or wasn't) reached."""

    def __init__(self):
        self.calls: list[dict] = []

    async def __call__(
        self, persona, session_messages, user_message,
        *, climax=None, service=None, referenced_post_content=None,
    ):
        # `service` kwarg added Phase 5.1.1 for cost tracking;
        # `referenced_post_content` added Phase 5.4 for the chat↔post
        # context bridge. Stub records both so tests can assert the
        # route passes the right values, but otherwise behaviour is
        # unchanged.
        self.calls.append({
            "persona": persona,
            "session_messages": list(session_messages),
            "user_message": user_message,
            "climax": climax,
            "service": service,
            "referenced_post_content": referenced_post_content,
        })
        return ("stub reply", "groq")


@pytest.fixture
def stub_llm(monkeypatch):
    """Replace the cascade with a deterministic _LLMStub. Tests inspect
    `stub_llm.calls` to verify whether the LLM was reached."""
    stub = _LLMStub()
    monkeypatch.setattr(nx_souls_route, "call_llm", stub)
    return stub


@pytest.fixture
def app(stub_db, stub_llm):
    fastapi_app = FastAPI()
    fastapi_app.include_router(nx_souls_route.router, prefix="/api/devs")
    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app)


def _body(message="yo", session_messages=None, wallet=OWNER,
          referenced_post_id=None):
    body = {
        "message": message,
        "session_messages": session_messages or [],
        "wallet_address": wallet,
    }
    if referenced_post_id is not None:
        body["referenced_post_id"] = referenced_post_id
    return body


# ─── 200 success path ────────────────────────────────────────────────────


def test_chat_success_returns_quota_block(client, stub_db):
    stub_db(quota_used=7, rarity="common")
    resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["response"] == "stub reply"
    assert body["provider_used"] == "groq"
    quota = body["quota"]
    assert quota["used"] == 8        # incremented after success
    assert quota["limit"] == 30
    assert quota["remaining"] == 22
    # resets_at must be a UTC ISO string
    parsed = datetime.fromisoformat(quota["resets_at"])
    assert parsed.tzinfo is not None
    assert parsed.utcoffset().total_seconds() == 0


def test_chat_success_uses_rarity_specific_limit(client, stub_db):
    stub_db(quota_used=0, rarity="legendary")
    resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 200
    assert resp.json()["quota"]["limit"] == 120


# ─── Quota exhaustion ────────────────────────────────────────────────────


def test_chat_quota_exhausted_returns_in_character_resting_message(
    client, stub_db, caplog
):
    """Phase 2a — quota exhaustion is no longer a 429. The endpoint
    returns 200 OK with the archetype's resting line and is_resting=true
    so the frontend can disable the input without breaking immersion."""
    stub_db(quota_used=30, rarity="common", archetype="INFLUENCER")
    with caplog.at_level(logging.INFO, logger="nx_api"):
        resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["is_resting"] is True
    assert body["provider_used"] == "internal"
    # Influencer-flavoured phrasing must land — sanity check that the
    # archetype's specific resting line was selected, not a sibling.
    assert "💅" in body["response"] or "vibes" in body["response"].lower() \
        or "algorithm" in body["response"].lower()
    quota = body["quota"]
    assert quota["used"] == 30
    assert quota["limit"] == 30
    assert quota["remaining"] == 0
    assert quota["resets_at"].endswith("+00:00")
    # New INFO log replaces the old "quota exhausted" line.
    rest_logs = [r for r in caplog.records if "serving rest message" in r.message]
    assert rest_logs, "expected info log when serving a rest message"
    msg = rest_logs[0].message
    assert f"token_id={TOKEN_ID}" in msg
    assert f"wallet={OWNER}" in msg
    assert "archetype=INFLUENCER" in msg


def test_chat_resting_does_not_call_llm(client, stub_db, stub_llm):
    """Cost guard — when serving a resting reply we must NOT reach the
    LLM cascade. The body comes from the static archetype map."""
    stub_db(quota_used=30, rarity="common", archetype="DEGEN")
    resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 200
    assert resp.json()["is_resting"] is True
    assert stub_llm.calls == [], (
        "LLM cascade was invoked while Dev was resting — "
        "this defeats the cost-saving guarantee of the rest path"
    )


def test_chat_resting_does_not_increment_quota(client, stub_db):
    """Quota counter is already at limit when resting; serving a rest
    message must NOT push it higher. A follow-up call must still see
    used == limit, not used > limit."""
    stub_db(quota_used=30, rarity="common", archetype="LURKER")
    resp1 = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp1.status_code == 200
    assert resp1.json()["is_resting"] is True
    assert stub_db.state["used"] == 30, "quota should not advance on rest"
    # A follow-up still sees the same used count and the same
    # is_resting=true response (not a 429, not a creep past limit).
    resp2 = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp2.status_code == 200
    assert resp2.json()["is_resting"] is True
    assert stub_db.state["used"] == 30


def test_chat_resting_message_does_not_cross_talk_between_archetypes(
    client, stub_db
):
    """The DEGEN rest line ('rekt all day') must NOT be served to a FED,
    and the FED rest line ('operational hours') must NOT be served to a
    DEGEN. Catches a future regression where the wrong archetype's
    rest line is wired up."""
    stub_db(quota_used=30, archetype="DEGEN")
    degen_text = client.post(
        f"/api/devs/{TOKEN_ID}/chat", json=_body()
    ).json()["response"]
    stub_db(quota_used=30, archetype="FED")
    fed_text = client.post(
        f"/api/devs/{TOKEN_ID}/chat", json=_body()
    ).json()["response"]
    # Each archetype has its own load-bearing phrase.
    assert "rekt" in degen_text.lower()
    assert "operational hours" in fed_text.lower()
    # And neither leaks into the other.
    assert "rekt" not in fed_text.lower()
    assert "operational hours" not in degen_text.lower()


def test_chat_resting_unknown_archetype_uses_fallback_line(
    client, stub_db, stub_llm
):
    """A future archetype without an entry in
    ARCHETYPE_RESTING_MESSAGES must still produce a coherent in-
    character reply — never a system-message style refusal — and the
    LLM still must not be called."""
    stub_db(quota_used=30, rarity="common", archetype="QUANTUM_MAGE")
    resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_resting"] is True
    text = body["response"]
    # The fallback line is the explicit `voices.get_resting_message`
    # default. It must be non-empty and read as the Dev itself talking
    # — no system-message tells like "rate limit" or "quota".
    assert text and len(text) > 0
    for tell in ("rate limit", "quota", "API", "error", "HTTP"):
        assert tell.lower() not in text.lower(), (
            f"fallback resting line leaked system-message tell: {tell!r}"
        )
    assert stub_llm.calls == []


# ─── Combined session content cap ────────────────────────────────────────


def test_chat_rejects_combined_session_content_over_8000_chars(client, stub_db):
    stub_db()
    big = "x" * 900
    msgs = [{"role": "user", "content": big} for _ in range(10)]  # 9000 chars
    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json=_body(session_messages=msgs),
    )
    assert resp.status_code == 400
    assert "Combined session_messages content too large" in resp.json()["detail"]


def test_chat_accepts_combined_session_content_at_8000_chars(client, stub_db):
    """8000 is the inclusive ceiling — exactly at limit must pass."""
    stub_db()
    chunk = "y" * 800
    msgs = [{"role": "user", "content": chunk} for _ in range(10)]  # 8000 chars
    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json=_body(session_messages=msgs),
    )
    assert resp.status_code == 200, resp.text


def test_chat_rejects_too_many_session_messages(client, stub_db):
    stub_db()
    # 21 short messages — under combined-size cap, over count cap.
    msgs = [{"role": "user", "content": "hi"} for _ in range(21)]
    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json=_body(session_messages=msgs),
    )
    assert resp.status_code == 400
    assert "Too many session messages" in resp.json()["detail"]


# ─── Ownership / 403 logging ─────────────────────────────────────────────


def test_chat_403_when_wallet_does_not_own(client, stub_db, caplog):
    stub_db(owner=OWNER)
    with caplog.at_level(logging.WARNING, logger="nx_api"):
        resp = client.post(
            f"/api/devs/{TOKEN_ID}/chat",
            json=_body(wallet=NOT_OWNER),
        )
    assert resp.status_code == 403
    # 403 body MUST NOT leak the real owner.
    assert OWNER not in resp.text
    # ... but the warning log MUST contain claimed + real + ip.
    own_logs = [r for r in caplog.records if "ownership check failed" in r.message]
    assert own_logs, "expected an ownership-failure warning"
    msg = own_logs[0].message
    assert f"token_id={TOKEN_ID}" in msg
    assert f"claimed_wallet={NOT_OWNER}" in msg
    assert f"real_owner={OWNER}" in msg
    assert "ip=" in msg


def test_chat_404_when_token_does_not_exist(client, stub_db):
    stub_db(token_exists=False)
    resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 404


def test_chat_403_when_dev_frozen(client, stub_db):
    stub_db(status="frozen")
    resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 403
    assert "frozen" in resp.json()["detail"].lower()


# ─── Wallet cooldown log ─────────────────────────────────────────────────


class _BlockingLimiter:
    """Force chat_limiter.check to raise — used for the cooldown-log
    test only."""

    def check(self, key):
        from fastapi import HTTPException
        raise HTTPException(429, "Rate limited. Try again in 10s.")


def test_chat_per_wallet_cooldown_logs_ip_and_wallet(client, stub_db, monkeypatch, caplog):
    monkeypatch.setattr(nx_souls_route, "chat_limiter", _BlockingLimiter())
    stub_db()
    with caplog.at_level(logging.WARNING, logger="nx_api"):
        resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 429
    cd_logs = [r for r in caplog.records if "per-wallet cooldown hit" in r.message]
    assert cd_logs, "expected a per-wallet cooldown warning"
    msg = cd_logs[0].message
    assert f"wallet={OWNER}" in msg
    assert f"token_id={TOKEN_ID}" in msg
    assert "ip=" in msg


# ─── IP rate-limit log ───────────────────────────────────────────────────


class _BlockingSlidingWindow:
    def check(self, key):
        return False


def test_chat_ip_rate_limit_logs_tier_ip_and_wallet(client, stub_db, monkeypatch, caplog):
    """When the per-minute IP cap fires, the tier label, IP, wallet,
    and token_id must all land in the warning log so abuse patterns
    can be reconstructed post-incident."""
    monkeypatch.setattr(nx_souls_route, "souls_ip_per_minute", _BlockingSlidingWindow())
    stub_db()
    with caplog.at_level(logging.WARNING, logger="nx_api"):
        resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 429
    detail = resp.json()["detail"]
    assert detail["error"] == "ip_rate_limited"
    assert detail["tier"] == "per_minute"
    ip_logs = [r for r in caplog.records if "IP rate limit hit" in r.message]
    assert ip_logs, "expected an IP rate-limit warning"
    msg = ip_logs[0].message
    assert "tier=per_minute" in msg
    assert "ip=" in msg
    assert f"wallet={OWNER}" in msg
    assert f"token_id={TOKEN_ID}" in msg


# ─── Wallet validation ───────────────────────────────────────────────────


def test_chat_rejects_malformed_wallet(client, stub_db):
    stub_db()
    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json=_body(wallet="not-a-wallet"),
    )
    assert resp.status_code == 400


# ─── Phase 5.4 — chat↔post context bridge ────────────────────────────────


def test_chat_referenced_post_injects_synthetic_assistant_turn(
    client, stub_db, stub_llm
):
    """When the body carries a valid referenced_post_id authored by
    the SAME Dev being chatted with, the route resolves it to
    nx_posts.content and forwards the text to call_llm via the new
    `referenced_post_content=` kwarg. The router (covered separately)
    is responsible for building the synthetic assistant turn — at the
    route layer we only need to verify the content makes the trip."""
    post_text = "shipped a thing today, brain still buzzing"
    stub_db(posts={42: {"token_id": TOKEN_ID, "content": post_text}})
    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json=_body(message="re: thing — what was it?", referenced_post_id=42),
    )
    assert resp.status_code == 200, resp.text
    assert len(stub_llm.calls) == 1
    assert stub_llm.calls[0]["referenced_post_content"] == post_text


def test_chat_rejects_referenced_post_from_different_dev(
    client, stub_db, stub_llm
):
    """GUARDRAIL: a post authored by a DIFFERENT Dev must be silently
    rejected (call_llm receives None) so a hostile client can't make
    Dev B respond as if it wrote Dev A's post. The chat itself still
    succeeds — the reference is just dropped."""
    other_token = TOKEN_ID + 1
    stub_db(posts={
        99: {"token_id": other_token, "content": "this is dev B's post"},
    })
    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json=_body(message="re: that post you wrote", referenced_post_id=99),
    )
    assert resp.status_code == 200, resp.text
    assert len(stub_llm.calls) == 1
    assert stub_llm.calls[0]["referenced_post_content"] is None


def test_chat_referenced_post_truncated_to_500_chars(
    client, stub_db, stub_llm
):
    """The route layer caps content at MAX_POST_REF_CHARS (500). Posts
    today are <280 chars; the cap defends against a future schema
    migration that lengthens them."""
    long_post = "x" * 1500
    stub_db(posts={7: {"token_id": TOKEN_ID, "content": long_post}})
    resp = client.post(
        f"/api/devs/{TOKEN_ID}/chat",
        json=_body(message="ref", referenced_post_id=7),
    )
    assert resp.status_code == 200, resp.text
    sent = stub_llm.calls[0]["referenced_post_content"]
    assert sent is not None
    assert len(sent) == 500
    assert sent == "x" * 500


def test_llm_router_no_double_injection_within_session():
    """When the session_messages list already carries a synthetic
    POST_REF turn from a prior call in the same chat, the router
    must NOT inject a second one even if a new
    `referenced_post_content` is supplied. The frontend clears the
    id after the first send for the same reason; this is the
    server-side safety net."""
    from backend.services.nx_souls.llm_router import (
        POST_REF_MARKER,
        _build_messages,
        _session_already_has_post_ref,
    )

    # The frontend's first send produced this synthetic turn and the
    # session_messages snapshot now carries it for every subsequent
    # turn in the same modal.
    prior_session = [
        {"role": "user", "content": "re: that thing"},
        {"role": "assistant", "content": POST_REF_MARKER + "shipped a thing"},
        {"role": "assistant", "content": "yeah, still buzzing"},
    ]
    assert _session_already_has_post_ref(prior_session) is True

    # If the router believed the session was clean and built messages
    # with another injection, we'd see TWO marker-prefixed assistant
    # turns. The route+router together avoid that by feeding
    # referenced_post_content=None whenever the prior session already
    # carries a marker (call_llm guard).
    msgs = _build_messages(
        persona="sys",
        session_messages=prior_session,
        user_message="and now?",
        referenced_post_content=None,  # what call_llm forwards on no-stack
    )
    marker_turns = [
        m for m in msgs
        if m["role"] == "assistant" and m["content"].startswith(POST_REF_MARKER)
    ]
    assert len(marker_turns) == 1, (
        "no-stacking guard failed: a second synthetic post-ref turn was "
        "injected on top of the one already in session_messages"
    )


def test_climax_turn_excludes_synthetic_post_turns():
    """A short non-philosophical message must NOT tip onto the climax
    cascade just because the session_messages snapshot now carries a
    synthetic POST_REF assistant turn from a prior reply-via-chat
    flow. is_climax_turn filters marker-prefixed turns out of the
    depth count before applying the >= 5 threshold."""
    from backend.services.nx_souls.llm_router import (
        POST_REF_MARKER,
        is_climax_turn,
    )

    # 4 real turns + 1 synthetic = 5 raw entries. Without the filter
    # the depth-5 rule would tip this onto Sonnet; with the filter it
    # stays at 4 and remains a casual turn.
    session = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hi"},
        {"role": "user", "content": "what's up"},
        {"role": "assistant", "content": POST_REF_MARKER + "shipped a thing"},
        {"role": "user", "content": "cool"},
    ]
    assert is_climax_turn("ok", session) is False

    # Sanity: 5 REAL non-synthetic turns DO tip the threshold, so the
    # filter isn't accidentally suppressing the climax path entirely.
    real_only = [
        {"role": "user", "content": "a"},
        {"role": "assistant", "content": "b"},
        {"role": "user", "content": "c"},
        {"role": "assistant", "content": "d"},
        {"role": "user", "content": "e"},
    ]
    assert is_climax_turn("ok", real_only) is True
