"""Tests for backend.services.llm_cost — pricing math, conn-passed
helpers (estimate_cost / get_today_spend / record_llm_call /
is_under_daily_limit), and the read-helpers behind the admin
endpoints. The "safe" wrappers (own-conn variants) and the live
DB hookups aren't unit-tested here — they're covered by the
admin endpoint tests in test_llm_usage_endpoint.py via stub
fetch_one / fetch_all."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services import llm_cost  # noqa: E402


# ─── StubCursor / StubConn ───────────────────────────────────────────


class StubCursor:
    """Cursor stub. Records every (sql, params) tuple. Replies to
    fetchone() / fetchall() from a script queue."""

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
    """Returns the same cursor regardless of cursor_factory. Records
    factory calls so a test can assert RealDictCursor was requested
    on read paths (where we need dict-shaped rows)."""

    def __init__(self, cur):
        self._cur = cur
        self.cursor_calls: list[type | None] = []

    def cursor(self, *, cursor_factory=None):
        self.cursor_calls.append(cursor_factory)
        return self._cur


# ─── Pricing math ────────────────────────────────────────────────────


def test_estimate_cost_haiku_known_rates():
    """Haiku 4.5 via OpenRouter: 0.25 input / 1.25 output per Mtok.
    1000 input + 500 output = 0.25e-3 + 0.625e-3 ≈ $0.000875."""
    cost = llm_cost.estimate_cost(
        "anthropic/claude-haiku-4.5", 1000, 500,
    )
    assert cost == pytest.approx(0.000875, rel=1e-3)


def test_estimate_cost_sonnet_higher():
    """Sonnet 4.6 is ~12x Haiku; verify ordering rather than exact
    cents (we don't want a future pricing tweak to fail this test
    over a sub-penny rounding shift)."""
    haiku_cost = llm_cost.estimate_cost(
        "anthropic/claude-haiku-4.5", 1000, 1000,
    )
    sonnet_cost = llm_cost.estimate_cost(
        "anthropic/claude-sonnet-4.6", 1000, 1000,
    )
    assert sonnet_cost > haiku_cost * 5


def test_estimate_cost_free_provider_zero():
    """Free providers track at $0 — call counts feed observability
    without inflating the daily ceiling."""
    assert llm_cost.estimate_cost("llama-3.3-70b-versatile", 5000, 5000) == 0.0
    assert llm_cost.estimate_cost("gemini-2.0-flash-exp", 1000, 1000) == 0.0


def test_estimate_cost_unknown_model_falls_back_to_haiku():
    """A model name we haven't catalogued yet still gets BILLED at
    Haiku rates rather than silently treated as free — better to
    over-estimate than to under-track during a model transition."""
    fallback = llm_cost.estimate_cost("anthropic/some-future-model", 1000, 500)
    haiku = llm_cost.estimate_cost("anthropic/claude-haiku-4.5", 1000, 500)
    assert fallback == haiku


def test_estimate_cost_negative_tokens_clamped_to_zero():
    """Defensive: a malformed provider response with a negative
    token count must not produce a negative cost."""
    cost = llm_cost.estimate_cost("anthropic/claude-haiku-4.5", -100, -50)
    assert cost == 0.0


# ─── get_today_spend / is_under_daily_limit ──────────────────────────


def test_get_today_spend_zero_when_no_rows():
    cur = StubCursor()
    cur.push_fetchone({"total": 0})
    conn = StubConn(cur)
    assert llm_cost.get_today_spend(conn, "sprkls") == 0.0


def test_get_today_spend_returns_sum():
    cur = StubCursor()
    cur.push_fetchone({"total": 0.4321})
    conn = StubConn(cur)
    assert llm_cost.get_today_spend(conn, "sprkls") == pytest.approx(0.4321)


def test_get_today_spend_sql_filters_by_date_and_service():
    cur = StubCursor()
    cur.push_fetchone({"total": 0})
    conn = StubConn(cur)
    llm_cost.get_today_spend(conn, "posts_feed")
    sql, params = cur.calls[0]
    assert "date = CURRENT_DATE" in sql
    assert "service = %s" in sql
    assert params[0] == "posts_feed"


def test_is_under_daily_limit_true_when_zero_spend():
    cur = StubCursor()
    cur.push_fetchone({"total": 0})
    conn = StubConn(cur)
    assert llm_cost.is_under_daily_limit(conn, "sprkls") is True


def test_is_under_daily_limit_false_when_at_limit():
    """Service spent exactly the limit → return False (next call
    falls through to template). The boundary check is `<` so
    spending == limit also blocks."""
    cur = StubCursor()
    cur.push_fetchone({"total": llm_cost.DAILY_LIMITS_USD["sprkls"]})
    conn = StubConn(cur)
    assert llm_cost.is_under_daily_limit(conn, "sprkls") is False


def test_is_under_daily_limit_unknown_service_uses_default():
    """An unknown service falls back to the default limit. We
    don't fail open or closed silently — better to bill against
    a default than skip tracking entirely."""
    cur = StubCursor()
    cur.push_fetchone({"total": 0})
    conn = StubConn(cur)
    assert llm_cost.is_under_daily_limit(conn, "unknown_service") is True


# ─── record_llm_call ─────────────────────────────────────────────────


def test_record_llm_call_writes_upsert():
    cur = StubCursor()
    conn = StubConn(cur)
    llm_cost.record_llm_call(
        conn, "sprkls", "anthropic/claude-haiku-4.5", 1000, 500,
    )
    assert len(cur.calls) == 1
    sql, params = cur.calls[0]
    assert "INSERT INTO llm_usage_daily" in sql
    assert "ON CONFLICT (date, service, model) DO UPDATE" in sql
    # Positional layout: service, model, input, output, cost.
    assert params[0] == "sprkls"
    assert params[1] == "anthropic/claude-haiku-4.5"
    assert params[2] == 1000
    assert params[3] == 500
    assert params[4] == pytest.approx(0.000875, rel=1e-3)


def test_record_llm_call_idempotent_via_on_conflict():
    """Two calls for the same (date, service, model) accumulate via
    the UPSERT — the SQL pinning here verifies the increment math
    (counter + 1, tokens + EXCLUDED, etc.) is in the query body."""
    cur = StubCursor()
    conn = StubConn(cur)
    llm_cost.record_llm_call(conn, "sprkls", "anthropic/claude-haiku-4.5", 100, 50)
    llm_cost.record_llm_call(conn, "sprkls", "anthropic/claude-haiku-4.5", 200, 100)
    assert len(cur.calls) == 2
    for sql, _params in cur.calls:
        # Collapse whitespace to make the increment-math assertions
        # robust to multi-line formatting in the SQL string.
        flat = " ".join(sql.split())
        assert "call_count = llm_usage_daily.call_count + 1" in flat
        assert "input_tokens + EXCLUDED.input_tokens" in flat
        assert "estimated_cost_usd + EXCLUDED.estimated_cost_usd" in flat


def test_record_llm_call_free_provider_records_zero_cost():
    """Free providers still record call_count + tokens but cost is
    $0 — observability without contributing to the daily ceiling."""
    cur = StubCursor()
    conn = StubConn(cur)
    llm_cost.record_llm_call(conn, "sprkls", "llama-3.3-70b-versatile", 1000, 1000)
    _sql, params = cur.calls[0]
    assert params[2] == 1000  # input
    assert params[3] == 1000  # output
    assert params[4] == 0.0   # cost


# ─── Read helpers for admin endpoints ────────────────────────────────


def test_get_today_summary_groups_by_service():
    cur = StubCursor()
    cur.push_fetchall([
        {
            "service": "sprkls", "calls": 5,
            "input_tokens": 5000, "output_tokens": 2500,
            "cost": 0.10,
        },
        {
            "service": "nx_souls", "calls": 2,
            "input_tokens": 2000, "output_tokens": 1000,
            "cost": 0.05,
        },
    ])
    conn = StubConn(cur)
    out = llm_cost.get_today_summary(conn)
    assert out["sprkls"]["calls"] == 5
    assert out["sprkls"]["cost"] == 0.10
    assert out["sprkls"]["under_limit"] is True
    assert out["nx_souls"]["calls"] == 2


def test_get_today_summary_includes_zero_rows_for_configured_services():
    """Services with zero calls today still appear in the response so
    the admin UI renders a stable row-set across the day."""
    cur = StubCursor()
    cur.push_fetchall([])
    conn = StubConn(cur)
    out = llm_cost.get_today_summary(conn)
    assert "sprkls" in out
    assert "posts_feed" in out
    assert "nx_souls" in out
    assert all(out[s]["calls"] == 0 for s in out)
    assert all(out[s]["under_limit"] is True for s in out)


def test_get_today_summary_marks_over_limit():
    """A service with cost >= limit is reported under_limit=False
    so the admin UI can colour-code it."""
    cur = StubCursor()
    cur.push_fetchall([
        {
            "service": "sprkls", "calls": 100,
            "input_tokens": 0, "output_tokens": 0,
            "cost": llm_cost.DAILY_LIMITS_USD["sprkls"] + 0.10,
        },
    ])
    conn = StubConn(cur)
    out = llm_cost.get_today_summary(conn)
    assert out["sprkls"]["under_limit"] is False


def test_get_recent_usage_clamps_days_to_30():
    """`days` query param can be tampered with — the helper clamps
    server-side as a backstop on top of the FastAPI Query validator."""
    cur = StubCursor()
    cur.push_fetchall([])
    conn = StubConn(cur)
    llm_cost.get_recent_usage(conn, days=9999)
    _sql, params = cur.calls[0]
    assert params[0] == 29  # 30 - 1


def test_get_recent_usage_minimum_one_day():
    cur = StubCursor()
    cur.push_fetchall([])
    conn = StubConn(cur)
    llm_cost.get_recent_usage(conn, days=0)
    _sql, params = cur.calls[0]
    assert params[0] == 0  # 1 - 1


# ─── Safe wrappers ───────────────────────────────────────────────────


def test_is_under_daily_limit_safe_returns_true_on_db_error(monkeypatch):
    """Cost-tracker DB outage must not block LLM calls — failing
    closed (always blocking) would be a worse outage than failing
    open. Anthropic's console hard cap is the absolute backstop."""
    def boom():
        raise RuntimeError("db down")
    monkeypatch.setattr(llm_cost, "_open_fresh_conn", boom)
    assert llm_cost.is_under_daily_limit_safe("sprkls") is True


def test_record_llm_call_safe_swallows_exceptions(monkeypatch):
    """Tracking failures shouldn't cascade into the user-facing call."""
    def boom():
        raise RuntimeError("db down")
    monkeypatch.setattr(llm_cost, "_open_fresh_conn", boom)
    # Should not raise.
    llm_cost.record_llm_call_safe(
        "sprkls", "anthropic/claude-haiku-4.5", 100, 50,
    )
