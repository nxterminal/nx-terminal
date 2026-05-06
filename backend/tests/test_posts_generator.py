"""Tests for backend.services.posts.generator — daily cap,
probabilistic skip, hashtag/mention/ticker extraction, reply path,
and the StubConn RealDictCursor enforcement (Phase 4.1.1 contract).

The LLM cascade is monkeypatched at the module's import site so
tests stay deterministic — no live LLM calls."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2.extras
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.posts import generator as gen_module  # noqa: E402


OPERATOR = "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b"


# ─── StubConn / Cursor ───────────────────────────────────────────────


class StubCursor:
    """Cursor stub. Records every (sql, params) tuple. Replies to
    fetchone() / fetchall() from a script queue. rowcount can be
    overridden by the test."""

    def __init__(self):
        self.calls: list[tuple[str, tuple]] = []
        self._fetchone_queue: list[dict | None] = []
        self._fetchall_queue: list[list[dict]] = []
        self.rowcount = 0

    def push_fetchone(self, row):
        self._fetchone_queue.append(row)
        return self

    def push_fetchall(self, rows):
        self._fetchall_queue.append(rows)
        return self

    def execute(self, sql, params=None):
        self.calls.append((sql, tuple(params) if params else ()))

    def fetchone(self):
        if not self._fetchone_queue:
            return None
        return self._fetchone_queue.pop(0)

    def fetchall(self):
        if not self._fetchall_queue:
            return []
        return self._fetchall_queue.pop(0)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class StubConn:
    """Phase 4.1.1: enforces `cursor_factory=RealDictCursor` is
    passed. Same enforcement as test_sprkls_scheduler.StubConn so a
    future regression in either tick that drops the explicit
    factory fails at test time instead of in production (engine's
    get_db() returns a tuple-default connection)."""

    def __init__(self, cur):
        self._cur = cur
        self.cursor_calls: list[type | None] = []

    def cursor(self, *, cursor_factory=None):
        self.cursor_calls.append(cursor_factory)
        if cursor_factory is not psycopg2.extras.RealDictCursor:
            raise AssertionError(
                "posts.generator must request RealDictCursor explicitly. "
                f"got cursor_factory={cursor_factory!r}"
            )
        return self._cur


def _dev(token_id=8047, archetype="DEGEN"):
    return {
        "token_id":      token_id,
        "name":          f"DEV-{token_id}",
        "archetype":     archetype,
        "owner_address": OPERATOR,
    }


# ─── Text extraction ─────────────────────────────────────────────────


def test_extract_hashtags_lowercases_and_dedupes():
    out = gen_module.extract_hashtags("hello #WAGMI world #wagmi #NGMI")
    assert out == ["wagmi", "ngmi"]


def test_extract_mentions_lowercases_and_dedupes():
    out = gen_module.extract_mentions("hi @Bread cc @bread @felonusk")
    assert out == ["bread", "felonusk"]


def test_extract_tickers_uppercases_and_filters_short():
    """The 2-char floor avoids matching prices like '$5'; the
    8-char ceiling matches $AGENTGOD-style tags but not paragraphs.
    \\b boundary keeps $WAGMI from matching on $WAGMIE12."""
    out = gen_module.extract_tickers("longing $nxt and $YAI but not $5 or $A")
    # $nxt is lowercase — regex requires upper case explicitly.
    assert "YAI" in out
    assert "NXT" not in out
    assert "A" not in out


def test_extract_handles_empty():
    assert gen_module.extract_hashtags("") == []
    assert gen_module.extract_mentions(None) == []
    assert gen_module.extract_tickers("") == []


# ─── Daily cap ───────────────────────────────────────────────────────


def test_has_dev_posted_today_true_when_row_exists():
    cur = StubCursor()
    cur.push_fetchone({"?column?": 1})
    assert gen_module._has_dev_posted_today(cur, 8047) is True


def test_has_dev_posted_today_false_when_no_row():
    cur = StubCursor()
    cur.push_fetchone(None)
    assert gen_module._has_dev_posted_today(cur, 8047) is False


def test_generate_skipped_when_dev_already_posted(monkeypatch):
    """Daily cap: a dev with a feed post today returns None and
    never reaches the LLM."""
    cur = StubCursor()
    cur.push_fetchone({"x": 1})  # has_dev_posted_today → True

    llm_called = {"hit": False}
    monkeypatch.setattr(
        gen_module, "_llm_generate_sync",
        lambda *a, **kw: llm_called.update(hit=True) or "shouldn't run",
    )

    result = gen_module.generate_feed_post_for_dev(cur, _dev())
    assert result is None
    assert llm_called["hit"] is False


# ─── Probabilistic skip ──────────────────────────────────────────────


def test_generate_skipped_by_probability(monkeypatch):
    """daily_post_probability=0 means always skip. The dev hasn't
    posted today (cap clears) but the probability roll fails and
    the function bails before any LLM / insert work."""
    cur = StubCursor()
    cur.push_fetchone(None)  # has_dev_posted_today → False

    llm_called = {"hit": False}
    monkeypatch.setattr(
        gen_module, "_llm_generate_sync",
        lambda *a, **kw: llm_called.update(hit=True) or None,
    )

    result = gen_module.generate_feed_post_for_dev(
        cur, _dev(), daily_post_probability=0.0,
    )
    assert result is None
    assert llm_called["hit"] is False


# ─── Standalone happy path ───────────────────────────────────────────


def test_generate_inserts_standalone_post(monkeypatch):
    """End-to-end sync: cap clear → probability rolls in (=1.0) →
    no reply (reply_probability=0.0) → LLM returns content →
    INSERT row. Verify the inserted columns include the extracted
    hashtags from the LLM output and parent_post_id is NULL."""
    cur = StubCursor()
    cur.push_fetchone(None)            # has_dev_posted_today
    cur.push_fetchone({"id": 555})     # INSERT RETURNING id

    monkeypatch.setattr(
        gen_module, "_llm_generate_sync",
        lambda *a, **kw: "longing $NXT this cycle #wagmi",
    )

    result = gen_module.generate_feed_post_for_dev(
        cur, _dev(),
        daily_post_probability=1.0,
        reply_probability=0.0,
    )
    assert result == 555

    # Last execute is the INSERT; pick it out and verify shape.
    insert_sql, insert_params = cur.calls[-1]
    assert "INSERT INTO nx_posts" in insert_sql
    assert "'feed'" in insert_sql
    # token_id, wallet, content, parent_post_id, hashtags, mentions,
    # tickers, created_at, expires_at — positional.
    assert insert_params[0] == 8047           # token_id
    assert insert_params[1] == OPERATOR       # owner_address
    assert "longing $NXT" in insert_params[2]  # content
    assert insert_params[3] is None            # parent_post_id (standalone)
    assert insert_params[4] == ["wagmi"]       # hashtags
    assert insert_params[5] == []              # mentions
    assert insert_params[6] == ["NXT"]         # tickers


# ─── Reply path ──────────────────────────────────────────────────────


def test_generate_reply_sets_parent_post_id(monkeypatch):
    """reply_probability=1.0 + an eligible parent → INSERT carries
    parent_post_id pointing at the parent."""
    cur = StubCursor()
    cur.push_fetchone(None)  # has_dev_posted_today → False
    # _pick_eligible_parent_post returns a row.
    cur.push_fetchone({
        "id":           999,
        "token_id":     8000,
        "content":      "original post",
        "author_name":  "ORIG-DEV",
    })
    cur.push_fetchone({"id": 777})  # INSERT RETURNING id

    monkeypatch.setattr(
        gen_module, "_llm_generate_sync",
        lambda *a, **kw: "this. ngmi.",
    )

    result = gen_module.generate_feed_post_for_dev(
        cur, _dev(),
        daily_post_probability=1.0,
        reply_probability=1.0,
    )
    assert result == 777
    insert_sql, insert_params = cur.calls[-1]
    assert "INSERT INTO nx_posts" in insert_sql
    assert insert_params[3] == 999  # parent_post_id


def test_generate_reply_falls_through_when_no_parent_available(monkeypatch):
    """reply_probability=1.0 but no parent in DB → the function
    posts standalone rather than skipping. Better to post."""
    cur = StubCursor()
    cur.push_fetchone(None)  # has_dev_posted_today
    cur.push_fetchone(None)  # no eligible parent
    cur.push_fetchone({"id": 333})  # INSERT RETURNING id

    monkeypatch.setattr(
        gen_module, "_llm_generate_sync",
        lambda *a, **kw: "ok",
    )

    result = gen_module.generate_feed_post_for_dev(
        cur, _dev(),
        daily_post_probability=1.0,
        reply_probability=1.0,
    )
    assert result == 333
    insert_sql, insert_params = cur.calls[-1]
    assert insert_params[3] is None  # parent_post_id NULL — fell through


# ─── LLM failure fallback ────────────────────────────────────────────


def test_generate_uses_fallback_when_llm_returns_none(monkeypatch):
    """LLM cascade returns None (all providers down) → deterministic
    fallback content path is used. Insert still happens — the feed
    keeps flowing."""
    cur = StubCursor()
    cur.push_fetchone(None)  # has_dev_posted_today
    cur.push_fetchone({"id": 222})  # INSERT RETURNING id

    monkeypatch.setattr(gen_module, "_llm_generate_sync", lambda *a, **kw: None)

    result = gen_module.generate_feed_post_for_dev(
        cur, _dev(),
        daily_post_probability=1.0,
        reply_probability=0.0,
    )
    assert result == 222
    insert_sql, insert_params = cur.calls[-1]
    assert "INSERT INTO nx_posts" in insert_sql
    # Fallback content is non-empty.
    assert insert_params[2]
    # Bracket placeholders are scrubbed so '[absurd thing]' doesn't
    # leak into the user-facing feed.
    assert "[" not in insert_params[2]


# ─── Tick (cursor factory enforcement) ───────────────────────────────


def test_run_feed_generation_tick_uses_realdictcursor(monkeypatch):
    """Phase 4.1.1 contract: the tick must request RealDictCursor
    explicitly. StubConn raises if any other factory is passed."""
    cur = StubCursor()
    cur.push_fetchall([])  # _eligible_devs_for_feed → empty list
    conn = StubConn(cur)

    inserted = gen_module.run_feed_generation_tick(conn)
    assert inserted == 0
    assert conn.cursor_calls == [psycopg2.extras.RealDictCursor]


def test_run_feed_generation_tick_iterates_eligible_devs(monkeypatch):
    """The tick calls generate_feed_post_for_dev once per eligible
    Dev. We replace the per-dev generator with a counter so the
    test stays focused on iteration semantics, not on the
    probability defaults baked into generate_feed_post_for_dev's
    signature (which would have to be re-derived at call time)."""
    cur = StubCursor()
    cur.push_fetchall([
        {
            "token_id":      1,
            "name":          "A",
            "archetype":     "DEGEN",
            "owner_address": OPERATOR,
            "energy":        80,
            "status":        "active",
        },
        {
            "token_id":      2,
            "name":          "B",
            "archetype":     "INFLUENCER",
            "owner_address": OPERATOR,
            "energy":        80,
            "status":        "active",
        },
    ])
    conn = StubConn(cur)

    seen = {"calls": 0}

    def fake_generate(_cur, dev, **_kw):
        seen["calls"] += 1
        return 1000 + seen["calls"]

    monkeypatch.setattr(
        gen_module, "generate_feed_post_for_dev", fake_generate,
    )

    inserted = gen_module.run_feed_generation_tick(conn)
    assert inserted == 2
    assert seen["calls"] == 2


# ─── Eligibility SQL contract ────────────────────────────────────────


def test_eligible_devs_sql_filters_low_energy_and_status():
    cur = StubCursor()
    cur.push_fetchall([])
    gen_module._eligible_devs_for_feed(cur)
    sql, params = cur.calls[0]
    assert "energy > %s" in sql
    assert "status NOT IN" in sql
    assert "owner_address IS NOT NULL" in sql
    assert params[0] == gen_module.MIN_DEV_ENERGY
    assert params[1] == gen_module.INELIGIBLE_DEV_STATUSES


def test_pick_eligible_parent_post_filters():
    """SQL contract: replies don't quote your own posts, must be
    recent (REPLY_MAX_AGE_HOURS), and must be top-level (parent
    NULL — keep threads one-level-deep for MVP)."""
    cur = StubCursor()
    cur.push_fetchone(None)
    gen_module._pick_eligible_parent_post(cur, 8047)
    sql, params = cur.calls[0]
    assert "p.token_id != %s" in sql
    assert "p.parent_post_id IS NULL" in sql
    assert "p.visibility = 'public'" in sql
    assert "NOW() - %s::interval" in sql
    assert params[0] == 8047
    assert params[1] == f"{gen_module.REPLY_MAX_AGE_HOURS} hours"


# ─── Insert SQL contract ─────────────────────────────────────────────


def test_insert_feed_post_writes_expected_columns():
    cur = StubCursor()
    cur.push_fetchone({"id": 77})
    now = datetime(2026, 5, 5, 12, 0, 0, tzinfo=timezone.utc)
    new_id = gen_module._insert_feed_post(
        cur,
        dev=_dev(),
        content="post body",
        parent_post_id=None,
        hashtags=["wagmi"],
        mentions=["bread"],
        tickers=["NXT"],
        now=now,
    )
    assert new_id == 77
    sql, params = cur.calls[0]
    assert "INSERT INTO nx_posts" in sql
    assert "'feed'" in sql
    assert "'public'" in sql
    # token_id, wallet, content, parent_post_id, hashtags, mentions,
    # tickers, created_at, expires_at — positional.
    assert params[0] == 8047
    assert params[1] == OPERATOR
    assert params[2] == "post body"
    assert params[3] is None
    assert params[4] == ["wagmi"]
    assert params[5] == ["bread"]
    assert params[6] == ["NXT"]
