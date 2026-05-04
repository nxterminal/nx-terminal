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
                 status="active", token_exists=True):
    """Build a SQL fingerprint dispatcher for one fixture."""
    state = {"used": quota_used}

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
            }
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
                "archetype": "INFLUENCER",
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
    same shared state through the closure."""
    program_holder = {"program": make_program()}

    def set_program(**kwargs):
        program_holder["program"] = make_program(**kwargs)

    def fake_get_db():
        return StubConn(program_holder["program"])

    monkeypatch.setattr(nx_souls_route, "get_db", fake_get_db)
    # The persona module imports get_db indirectly via cur.execute, so
    # patching the route's binding is enough — the route owns the conn.
    # Persona cache must not leak between tests.
    persona_module.invalidate_persona_cache()
    return set_program


@pytest.fixture
def stub_llm(monkeypatch):
    """Replace the cascade with a deterministic stub. Tests can override
    by re-patching `call_llm` after the fixture runs."""

    async def fake_call_llm(persona, session_messages, user_message, *, climax=None):
        return ("stub reply", "groq")

    monkeypatch.setattr(nx_souls_route, "call_llm", fake_call_llm)
    return fake_call_llm


@pytest.fixture
def app(stub_db, stub_llm):
    fastapi_app = FastAPI()
    fastapi_app.include_router(nx_souls_route.router, prefix="/api/devs")
    return fastapi_app


@pytest.fixture
def client(app):
    return TestClient(app)


def _body(message="yo", session_messages=None, wallet=OWNER):
    return {
        "message": message,
        "session_messages": session_messages or [],
        "wallet_address": wallet,
    }


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


def test_chat_quota_exceeded_returns_429_payload(client, stub_db, caplog):
    stub_db(quota_used=30, rarity="common")
    with caplog.at_level(logging.INFO, logger="nx_api"):
        resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 429
    detail = resp.json()["detail"]
    assert detail["error"] == "quota_exceeded"
    assert detail["limit"] == 30
    assert detail["used"] == 30
    assert "resets_at" in detail and detail["resets_at"].endswith("+00:00")
    # Hardened logging — quota exhaustion logs INFO with token + wallet,
    # never the message text.
    quota_logs = [r for r in caplog.records if "quota exhausted" in r.message]
    assert quota_logs, "expected an info log for quota exhaustion"
    assert f"token_id={TOKEN_ID}" in quota_logs[0].message
    assert f"wallet={OWNER}" in quota_logs[0].message


def test_chat_does_not_increment_on_quota_reject(client, stub_db):
    """A quota-rejected request must not advance the counter — that
    would let an attacker push someone past their limit by spamming
    rejected calls (the increment is in the success path only)."""
    stub_db(quota_used=30, rarity="common")
    resp = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp.status_code == 429
    # Then a follow-up request still sees used=30 (program shared via
    # closure, increment only fires on success path)
    resp2 = client.post(f"/api/devs/{TOKEN_ID}/chat", json=_body())
    assert resp2.status_code == 429
    assert resp2.json()["detail"]["used"] == 30


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
