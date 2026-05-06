"""LLM cost tracking and daily spend limits.

Defense-in-depth on top of Anthropic's hard spend cap. Every
successful LLM call increments a row in `llm_usage_daily`; before
the next call the router checks today's accumulated cost for the
calling service and falls through to template fallback if the
configured ceiling is hit.

Architecture:

  - Pure helpers (`estimate_cost`, `get_today_spend`,
    `is_under_daily_limit`, `record_llm_call`) take a `conn` so
    they're trivially testable with stub connections.
  - "Safe" wrappers (`is_under_daily_limit_safe`,
    `record_llm_call_safe`) open their own short-lived connection
    via DATABASE_URL — works in both API and engine contexts
    without needing to thread a conn through async code, and
    catches every exception so a cost-tracking outage can never
    take down LLM functionality.

Pricing keys: We use the model strings exactly as the providers
report them (OpenRouter prefixes with the org slug, e.g.
`anthropic/claude-haiku-4.5`; free providers use their public
model names). Free providers are listed at $0 so they're recorded
for observability without contributing to the cost ceiling — the
admin endpoint can show total call volume across the cascade.

Tunables:

  MODEL_PRICING — update when Anthropic / OpenRouter changes
                  pricing. Per million tokens, USD.
  DAILY_LIMITS_USD — soft cutoff per service. Anthropic console
                  hard cap is the absolute backstop.
"""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Any
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras

log = logging.getLogger("nx_api")


# ── Pricing & limits ─────────────────────────────────────────────────

# Pricing per million tokens (USD). Update when providers change
# their published rates. Keys are the EXACT model strings the
# router emits — OpenRouter prefixes with the org slug, free
# providers use their public model names.
MODEL_PRICING: dict[str, dict[str, float]] = {
    # Anthropic (via OpenRouter today; same pricing as direct API).
    "anthropic/claude-haiku-4.5":    {"input_per_mtok": 0.25, "output_per_mtok": 1.25},
    "anthropic/claude-sonnet-4.6":   {"input_per_mtok": 3.00, "output_per_mtok": 15.00},
    # Direct Anthropic SDK names (future-proofing — same prices).
    "claude-haiku-4-5-20251001":     {"input_per_mtok": 0.25, "output_per_mtok": 1.25},
    "claude-sonnet-4-6":             {"input_per_mtok": 3.00, "output_per_mtok": 15.00},
    # Free-tier providers — tracked for observability at $0/mtok.
    "llama-3.3-70b-versatile":       {"input_per_mtok": 0.0, "output_per_mtok": 0.0},
    "llama-3.3-70b":                 {"input_per_mtok": 0.0, "output_per_mtok": 0.0},
    "gemini-2.0-flash-exp":          {"input_per_mtok": 0.0, "output_per_mtok": 0.0},
}

# Daily spend ceiling per service in USD. When today's recorded
# spend for a service exceeds this, the router skips the LLM and
# the caller takes its template fallback path. Tune based on
# observed usage — the Anthropic console hard cap is the backstop.
DAILY_LIMITS_USD: dict[str, float] = {
    "sprkls":     0.50,
    "posts_feed": 0.50,
    "nx_souls":   1.00,
}

# Default fallback used when an unknown service or model arrives —
# better to bill against a default than drop the call silently.
_DEFAULT_LIMIT_USD: float = 0.50
_DEFAULT_PRICING_KEY: str = "anthropic/claude-haiku-4.5"


# ── Pure helpers (conn-passed; testable) ─────────────────────────────

def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return the USD cost estimate for a single call.

    Unknown models fall back to the Haiku pricing tier so a future
    model name we haven't catalogued yet still gets BILLED (not
    silently treated as free) — better to over-estimate than to
    under-track during a model transition.
    """
    pricing = MODEL_PRICING.get(model, MODEL_PRICING[_DEFAULT_PRICING_KEY])
    cost = (
        (max(input_tokens, 0)  / 1_000_000) * pricing["input_per_mtok"] +
        (max(output_tokens, 0) / 1_000_000) * pricing["output_per_mtok"]
    )
    # 6 decimals is enough granularity for sub-cent-per-call rounding
    # while leaving headroom for the 4-decimal column to accumulate.
    return round(cost, 6)


def get_today_spend(conn, service: str) -> float:
    """Return total estimated USD spent today by `service`.

    Cursor factory: explicitly RealDictCursor — same Phase 4.1.1
    contract as the rest of the engine-callable helpers (the
    engine's get_db() returns a tuple-default connection)."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
            FROM llm_usage_daily
            WHERE date = CURRENT_DATE AND service = %s
            """,
            (service,),
        )
        row = cur.fetchone()
    if not row:
        return 0.0
    return float(row.get("total") or 0)


def is_under_daily_limit(conn, service: str) -> bool:
    """True if `service` may make another LLM call today.

    The check is a single small SELECT — cheap enough to run
    before every LLM call without measurable latency overhead.
    """
    spent = get_today_spend(conn, service)
    limit = DAILY_LIMITS_USD.get(service, _DEFAULT_LIMIT_USD)
    return spent < limit


def record_llm_call(
    conn,
    service: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> None:
    """Insert/update today's usage row. Idempotent via UPSERT —
    repeated calls for the same (date, service, model) accumulate
    cleanly.

    The trigger-free counter math (`call_count + 1`,
    `input_tokens + EXCLUDED.input_tokens`, etc.) keeps this a
    single round-trip. We don't commit here — the caller decides
    whether it's running inside a wrapping transaction or wants
    autocommit semantics.
    """
    cost = estimate_cost(model, input_tokens, output_tokens)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO llm_usage_daily
                (date, service, model, call_count,
                 input_tokens, output_tokens,
                 estimated_cost_usd, last_call_at)
            VALUES (CURRENT_DATE, %s, %s, 1,
                    %s, %s, %s, NOW())
            ON CONFLICT (date, service, model) DO UPDATE SET
                call_count = llm_usage_daily.call_count + 1,
                input_tokens = llm_usage_daily.input_tokens + EXCLUDED.input_tokens,
                output_tokens = llm_usage_daily.output_tokens + EXCLUDED.output_tokens,
                estimated_cost_usd = llm_usage_daily.estimated_cost_usd
                                     + EXCLUDED.estimated_cost_usd,
                last_call_at = NOW()
            """,
            (service, model, input_tokens, output_tokens, cost),
        )


# ── "Safe" wrappers (own connection; never raise) ────────────────────
#
# These are the entry points the router uses. They handle
# connection lifecycle internally so the LLM cascade doesn't have
# to thread `conn` through async code, and they swallow every
# exception — a cost-tracking outage MUST NOT take down chat or
# feed generation. Worst case: we lose a few hours of usage data
# while the DB recovers.

def _open_fresh_conn():
    """Open a short-lived psycopg2 connection using DATABASE_URL.

    Independent of the API connection pool + the engine's get_db()
    so this works from either context. Matches the engine's
    convention (raw connect with search_path option).
    """
    database_url = os.environ.get("DATABASE_URL")
    db_schema = os.environ.get("NX_DB_SCHEMA", "nx")
    if not database_url:
        # Build from individual env vars if DATABASE_URL isn't set.
        # Mirrors backend/api/deps.py's fallback logic so behaviour
        # is identical in local dev (no DATABASE_URL) and prod.
        host = os.environ.get("NX_DB_HOST", "localhost")
        port = int(os.environ.get("NX_DB_PORT", "5432"))
        name = os.environ.get("NX_DB_NAME", "nxterminal")
        user = os.environ.get("NX_DB_USER", "postgres")
        password = os.environ.get("NX_DB_PASS", "postgres")
        return psycopg2.connect(
            host=host, port=port, dbname=name,
            user=user, password=password,
            options=f"-c search_path={db_schema}",
        )
    return psycopg2.connect(
        database_url, options=f"-c search_path={db_schema}"
    )


@contextmanager
def _safe_conn():
    """Context manager that opens a fresh conn, commits on exit,
    closes always. Errors are caught + logged + re-raised so the
    safe wrappers above can suppress them at the boundary."""
    conn = None
    try:
        conn = _open_fresh_conn()
        conn.autocommit = False
        yield conn
        conn.commit()
    except Exception:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def is_under_daily_limit_safe(service: str) -> bool:
    """Pre-call check used by the router. Returns True (allow) on
    any failure path — failing closed (blocking calls when the
    cost DB is down) would be a worse outage than failing open
    (briefly losing tracking but keeping LLM service alive).

    Anthropic's console hard cap is the backstop — we're not the
    only safety net.
    """
    try:
        with _safe_conn() as conn:
            return is_under_daily_limit(conn, service)
    except Exception as e:
        log.warning("[llm_cost] limit-check failed (allow): %s", e)
        return True


def record_llm_call_safe(
    service: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> None:
    """Post-call recording used by the router. Swallows every
    exception — a tracking failure shouldn't cascade into the
    user-facing call. Logged so the operator can investigate."""
    try:
        with _safe_conn() as conn:
            record_llm_call(conn, service, model, input_tokens, output_tokens)
    except Exception as e:
        log.warning("[llm_cost] record failed: %s", e)


# ── Read helpers for admin endpoints ─────────────────────────────────

def get_today_summary(conn) -> dict[str, dict[str, Any]]:
    """Return today's usage grouped by service. Each entry includes
    call count, total cost, configured limit, and an under_limit
    flag the admin UI can colour-code."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT service,
                   SUM(call_count)         AS calls,
                   SUM(input_tokens)       AS input_tokens,
                   SUM(output_tokens)      AS output_tokens,
                   SUM(estimated_cost_usd) AS cost
            FROM llm_usage_daily
            WHERE date = CURRENT_DATE
            GROUP BY service
            """
        )
        rows = cur.fetchall() or []

    out: dict[str, dict[str, Any]] = {}
    for r in rows:
        service = r["service"]
        cost = float(r.get("cost") or 0)
        limit = DAILY_LIMITS_USD.get(service, _DEFAULT_LIMIT_USD)
        out[service] = {
            "calls":         int(r.get("calls") or 0),
            "input_tokens":  int(r.get("input_tokens") or 0),
            "output_tokens": int(r.get("output_tokens") or 0),
            "cost":          round(cost, 4),
            "limit":         limit,
            "under_limit":   cost < limit,
        }
    # Surface configured services even when they haven't logged any
    # calls today so the admin UI can show "0 / $0.50" zero rows.
    for service, limit in DAILY_LIMITS_USD.items():
        out.setdefault(service, {
            "calls": 0, "input_tokens": 0, "output_tokens": 0,
            "cost": 0.0, "limit": limit, "under_limit": True,
        })
    return out


def get_recent_usage(conn, days: int) -> list[dict[str, Any]]:
    """Return per-row usage for the last N days, newest first."""
    days = max(1, min(int(days), 30))
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT date, service, model, call_count,
                   input_tokens, output_tokens, estimated_cost_usd,
                   last_call_at
            FROM llm_usage_daily
            WHERE date >= CURRENT_DATE - %s::integer
            ORDER BY date DESC, service ASC, model ASC
            """,
            (days - 1,),
        )
        rows = cur.fetchall() or []
    return [
        {
            "date":               r["date"].isoformat() if r.get("date") else None,
            "service":            r["service"],
            "model":              r["model"],
            "calls":              int(r.get("call_count") or 0),
            "input_tokens":       int(r.get("input_tokens") or 0),
            "output_tokens":      int(r.get("output_tokens") or 0),
            "estimated_cost_usd": float(r.get("estimated_cost_usd") or 0),
            "last_call_at":       (
                r["last_call_at"].isoformat() if r.get("last_call_at") else None
            ),
        }
        for r in rows
    ]
