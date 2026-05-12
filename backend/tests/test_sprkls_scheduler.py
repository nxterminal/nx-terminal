"""Tests for backend.services.sprkls.scheduler — eligibility,
cooldown, generation, and cleanup. Cursor / connection are stubbed
so the SQL contract is pinned without a live Postgres.

Phase 4.1.1 hardening: the StubConn enforces that the caller passes
`cursor_factory=psycopg2.extras.RealDictCursor` to conn.cursor() —
without this, a future regression that drops the explicit factory
would silently work in tests (mocks return dicts regardless) and
crash in production where engine/engine.py:get_db() returns a
tuple-cursor connection."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import psycopg2.extras
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.sprkls import scheduler as scheduler_module  # noqa: E402


OPERATOR = "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b"
NON_BETA = "0x" + "cd" * 20


# ─── Stub cursor / connection ────────────────────────────────────────


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
    passed.

    The real production bug from Phase 4.1: scheduler called
    `conn.cursor()` with no factory, which on the engine's
    tuple-default connection produced tuples — but then iterated
    over rows as if they were dicts (`r.get(...)`). Tests passed
    because mocks return dicts regardless of cursor_factory.

    By making the stub raise when called without RealDictCursor, a
    future regression that drops the explicit factory now fails at
    test time instead of in production. `cursor_factory` is also
    recorded so a dedicated regression test can read it back."""

    def __init__(self, cur):
        self._cur = cur
        self.cursor_calls: list[type | None] = []

    def cursor(self, *, cursor_factory=None):
        self.cursor_calls.append(cursor_factory)
        if cursor_factory is not psycopg2.extras.RealDictCursor:
            raise AssertionError(
                "scheduler must request RealDictCursor explicitly — "
                f"got cursor_factory={cursor_factory!r}. The engine's "
                "get_db() returns a tuple-default connection; without "
                "the explicit factory, dict accesses (r.get / r[...]) "
                "crash in production while passing in tests."
            )
        return self._cur


# ─── Eligibility / grouping ──────────────────────────────────────────


def _dev_row(token_id, owner, *, energy=80, status="active",
             archetype="INFLUENCER", name="DEV"):
    return {
        "token_id": token_id,
        "owner_address": owner,
        "name": name,
        "archetype": archetype,
        "energy": energy,
        "status": status,
    }


def test_eligible_wallets_excludes_non_beta_when_flag_closed():
    """Phase 5.7 — SPRKLS_BETA_OPEN flipped to True in production, so
    the dormant wallet-allowlist filter in `_eligible_wallets_with_devs`
    no longer excludes anyone. This test patches the flag back to
    False to guard the filtering code path for a hypothetical future
    re-gate. The post-flip live behaviour is asserted separately by
    `test_eligible_wallets_open_flag_includes_all` below."""
    cur = StubCursor()
    cur.push_fetchall([
        _dev_row(1, OPERATOR),
        _dev_row(2, NON_BETA),
    ])
    with patch("backend.services.sprkls.scheduler.is_in_sprkls_beta",
               side_effect=lambda w: (w or "").lower() == OPERATOR):
        out = scheduler_module._eligible_wallets_with_devs(cur)
    wallets = {w for w, _ in out}
    assert OPERATOR in wallets
    assert NON_BETA not in wallets


def test_eligible_wallets_open_flag_includes_all():
    """Phase 5.7 live state — with SPRKLS_BETA_OPEN True (current
    production value), both wallets are eligible for sprkls
    generation. Mirrors the public-launch behaviour the operator
    wants in production."""
    cur = StubCursor()
    cur.push_fetchall([
        _dev_row(1, OPERATOR),
        _dev_row(2, NON_BETA),
    ])
    out = scheduler_module._eligible_wallets_with_devs(cur)
    wallets = {w for w, _ in out}
    assert OPERATOR in wallets
    assert NON_BETA in wallets


def test_eligible_wallets_groups_by_owner():
    cur = StubCursor()
    cur.push_fetchall([
        _dev_row(1, OPERATOR, name="A"),
        _dev_row(2, OPERATOR, name="B"),
    ])
    out = scheduler_module._eligible_wallets_with_devs(cur)
    assert len(out) == 1
    wallet, devs = out[0]
    assert wallet == OPERATOR
    assert {d["name"] for d in devs} == {"A", "B"}


def test_eligible_wallets_sql_filters_low_energy_and_busy_status():
    """Pin the SQL contract: the WHERE clause must filter by energy
    and exclude resting / on_mission. We can't see the rows the SQL
    would have skipped (the stub returns whatever we push), but we
    can pin the SQL itself."""
    cur = StubCursor()
    cur.push_fetchall([])
    scheduler_module._eligible_wallets_with_devs(cur)
    sql, params = cur.calls[0]
    assert "energy > %s" in sql
    assert "'resting'" in sql
    assert "'on_mission'" in sql
    assert params[0] == scheduler_module.SPRKLS_MIN_DEV_ENERGY


def test_eligible_wallets_normalises_owner_lowercase():
    """Mixed-case owner_address from a row should still match the
    lowercase beta allowlist."""
    cur = StubCursor()
    cur.push_fetchall([_dev_row(1, OPERATOR.upper())])
    out = scheduler_module._eligible_wallets_with_devs(cur)
    assert len(out) == 1
    assert out[0][0] == OPERATOR  # lowercased


# ─── Due-check semantics ─────────────────────────────────────────────


def test_is_due_first_ever_is_true():
    """A wallet that has never been sprkl'd is immediately due — no
    point making a freshly-onboarded user wait 60min for sprkl #1."""
    now = datetime.now(timezone.utc)
    assert scheduler_module._is_due(now, None) is True


def test_is_due_within_min_interval_is_false():
    now = datetime.now(timezone.utc)
    last = now - timedelta(minutes=5)  # well below MIN_INTERVAL_MIN=20
    assert scheduler_module._is_due(now, last) is False


def test_is_due_after_max_interval_is_true():
    now = datetime.now(timezone.utc)
    last = now - timedelta(minutes=120)  # above MAX_INTERVAL_MIN=60
    assert scheduler_module._is_due(now, last) is True


# ─── Insert path ─────────────────────────────────────────────────────


def test_insert_sprkl_writes_expected_columns():
    cur = StubCursor()
    cur.push_fetchone({"id": 42})
    now = datetime(2026, 5, 5, 12, 0, 0, tzinfo=timezone.utc)
    new_id = scheduler_module._insert_sprkl(
        cur,
        wallet=OPERATOR,
        dev={"token_id": 8047, "name": "STORM-11", "archetype": "DEGEN"},
        action_type="toast",
        content="ser the chart is bullish",
        visual_metadata={"duration_ms": 8000},
        now=now,
    )
    assert new_id == 42
    sql, params = cur.calls[0]
    assert "INSERT INTO nx_posts" in sql
    assert "source = 'sprkl'" not in sql  # source is a hardcoded literal
    assert "'sprkl'" in sql
    # Positional layout: token_id, wallet, content, action_type,
    # visual_metadata, created_at, expires_at.
    assert params[0] == 8047
    assert params[1] == OPERATOR
    assert params[2] == "ser the chart is bullish"
    assert params[3] == "toast"
    # visual_metadata is JSON-serialised before insert.
    assert '"duration_ms"' in params[4]
    # expires_at is created_at + TTL_DAYS.
    expected_expiry = now + timedelta(days=scheduler_module.SPRKLS_POSTS_TTL_DAYS)
    assert params[6] == expected_expiry


# ─── Tick orchestration ──────────────────────────────────────────────


def test_run_sprkls_tick_inserts_when_due(monkeypatch):
    """End-to-end happy path: one beta wallet with one eligible Dev,
    no prior sprkls → tick inserts exactly one row. Random calls are
    seeded to make the test deterministic (random.choice for action,
    template, palette etc. all converge to the first option)."""
    cur = StubCursor()
    # Order of cursor.execute calls during a tick:
    #   1. SELECT ... FROM devs WHERE ... → fetchall (eligible Devs)
    #   2. SELECT created_at FROM nx_posts ... → fetchone (last sprkl)
    #   3. INSERT INTO nx_posts ... → fetchone (new id)
    cur.push_fetchall([_dev_row(8047, OPERATOR, archetype="DEGEN")])
    cur.push_fetchone(None)        # no prior sprkl
    cur.push_fetchone({"id": 1})   # INSERT RETURNING id
    conn = StubConn(cur)

    # Skip the LLM rewrite path so the test stays deterministic.
    monkeypatch.setattr(
        "backend.services.sprkls.content.LLM_REWRITE_PROB", 0.0
    )

    inserted = scheduler_module.run_sprkls_tick(conn)
    assert inserted == 1
    # Last call should be the INSERT.
    insert_sql, insert_params = cur.calls[-1]
    assert "INSERT INTO nx_posts" in insert_sql


def test_run_sprkls_tick_skips_when_not_due(monkeypatch):
    """A wallet whose last sprkl is 1 minute ago should not be
    sprkl'd again — well below MIN_INTERVAL_MIN=20."""
    cur = StubCursor()
    cur.push_fetchall([_dev_row(8047, OPERATOR)])
    # Fresh sprkl one minute ago.
    cur.push_fetchone({
        "created_at": datetime.now(timezone.utc) - timedelta(minutes=1),
    })
    conn = StubConn(cur)
    inserted = scheduler_module.run_sprkls_tick(conn)
    assert inserted == 0
    # No INSERT call.
    assert not any("INSERT INTO nx_posts" in c[0] for c in cur.calls)


def test_run_sprkls_tick_swallows_per_wallet_errors(monkeypatch):
    """If one wallet's generation raises, the whole tick must not
    abort. Other wallets keep getting processed."""
    cur = StubCursor()
    cur.push_fetchall([_dev_row(1, OPERATOR)])
    cur.push_fetchone(None)  # no prior

    # Force the insert path to raise.
    def boom(*a, **kw):
        raise RuntimeError("simulated db hiccup")
    monkeypatch.setattr(scheduler_module, "_insert_sprkl", boom)
    monkeypatch.setattr(
        "backend.services.sprkls.content.LLM_REWRITE_PROB", 0.0
    )

    conn = StubConn(cur)
    # Should not raise.
    inserted = scheduler_module.run_sprkls_tick(conn)
    assert inserted == 0


def test_run_sprkls_tick_no_wallets_returns_zero():
    cur = StubCursor()
    cur.push_fetchall([])
    conn = StubConn(cur)
    assert scheduler_module.run_sprkls_tick(conn) == 0


# ─── Cleanup ─────────────────────────────────────────────────────────


def test_cleanup_returns_deleted_count():
    cur = StubCursor()
    # Override execute to set rowcount after the DELETE.
    original = cur.execute

    def execute_with_rowcount(sql, params=None):
        original(sql, params)
        cur.rowcount = 13

    cur.execute = execute_with_rowcount
    conn = StubConn(cur)
    deleted = scheduler_module.cleanup_expired_posts(conn)
    assert deleted == 13
    sql, params = cur.calls[0]
    assert "DELETE FROM nx_posts" in sql
    assert "expires_at < NOW() - INTERVAL %s" in sql
    assert params == (
        f"{scheduler_module.SPRKLS_CLEANUP_GRACE_HOURS} hours",
    )


def test_cleanup_returns_zero_when_nothing_expired():
    cur = StubCursor()
    original = cur.execute

    def execute_with_rowcount(sql, params=None):
        original(sql, params)
        cur.rowcount = 0

    cur.execute = execute_with_rowcount
    conn = StubConn(cur)
    assert scheduler_module.cleanup_expired_posts(conn) == 0


# ─── Phase 4.1.1 regression: cursor factory contract ─────────────────


def test_run_sprkls_tick_requests_real_dict_cursor():
    """Pin that the scheduler asks for RealDictCursor explicitly.

    The original production bug: conn.cursor() with no factory on the
    engine's tuple-default connection returned tuples, but the
    scheduler iterated as if rows were dicts. Tests passed because
    StubCursor returned dicts regardless of factory.

    The reinforced StubConn now raises if cursor_factory isn't
    RealDictCursor; this test exercises run_sprkls_tick in full and
    asserts the factory was recorded — both layers of defence.
    """
    cur = StubCursor()
    cur.push_fetchall([])  # no eligible wallets — short, clean path
    conn = StubConn(cur)

    inserted = scheduler_module.run_sprkls_tick(conn)
    assert inserted == 0
    assert conn.cursor_calls == [psycopg2.extras.RealDictCursor]


def test_cleanup_expired_posts_requests_real_dict_cursor():
    """Same regression contract for the cleanup helper. Even though
    cleanup doesn't read row dicts today, a future SELECT here would
    expose the bug if the factory were dropped — pin the contract
    consistently."""
    cur = StubCursor()
    original = cur.execute

    def execute_with_rowcount(sql, params=None):
        original(sql, params)
        cur.rowcount = 0

    cur.execute = execute_with_rowcount
    conn = StubConn(cur)
    scheduler_module.cleanup_expired_posts(conn)
    assert conn.cursor_calls == [psycopg2.extras.RealDictCursor]


def test_stub_conn_rejects_default_cursor():
    """Self-test: the hardened StubConn must raise when a caller
    passes the wrong (or missing) cursor_factory. If this test ever
    starts passing-by-not-raising, the StubConn's enforcement has
    degraded and the regression catch is gone."""
    conn = StubConn(StubCursor())
    with pytest.raises(AssertionError, match="RealDictCursor"):
        conn.cursor()  # default factory — must reject
    with pytest.raises(AssertionError, match="RealDictCursor"):
        conn.cursor(cursor_factory=tuple)  # wrong type — must reject
