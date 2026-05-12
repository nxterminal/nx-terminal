"""Rate limiters backed by Postgres.

Phase 5.5 migration (post PR #391): the previous Redis-backed
implementation was silently fail-open in production because Redis
was never provisioned on Render. Every limiter (per-IP nx_souls
caps, per-(wallet, dev) cooldowns, shop limiter, global 120/min IP
cap, the new per-wallet 30/day cap) had been a no-op since
deployment. This module is the migration to the database that is
provisioned, monitored, and reliable.

The public API surface is unchanged so route handlers keep working
without edits:

  - ``RateLimiter(cooldown_seconds, namespace).check(key)`` —
    single-token cooldown stamp; raises ``HTTPException(429)`` while
    still in cooldown.
  - ``SlidingWindowLimiter(max_requests, window_seconds, namespace)``
    — N requests per fixed window per key; returns True/False.

    Note on the rename-without-rename: the previous Redis ZSET
    implementation was a precise rolling-window counter. The
    Postgres implementation is a fixed-window counter with the same
    ``max_requests`` and ``window_seconds`` values — the class name
    is kept so call sites don't churn, but the semantic shift is
    worth knowing: a user can in the worst case feel ``2 ×
    max_requests`` over a window boundary. For the limits in use
    today (5/min, 60/hr, 200/day on chat; 120/min global IP) this
    is acceptable headroom — the per-wallet daily cap and the
    global $1/day LLM ceiling bound the real cost.

  - ``peek_wallet_daily_count`` / ``increment_wallet_daily_count``
    — UTC-day fixed counter keyed by ``wallet:YYYY-MM-DD`` for the
    30/day per-wallet cap.

Storage: every counter lives in the ``rate_limit_counters`` table
(see backend/db/migrate.py). One row per ``(namespace, key)``,
expires_at column carries the row's logical TTL; readers filter
expired rows via ``WHERE expires_at > NOW()`` so the lack of a
periodic cleanup job just causes table bloat, not incorrect
decisions.

Fail-safe behaviour: every method swallows DB errors and fails
**open** (allows the request), matching the pre-migration Redis
behaviour. A DB outage degrading rate-limits to "no limit" is the
right failure mode — the global $1/day LLM cost ceiling
(``llm_usage_daily`` table) is the absolute backstop.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException

from backend.api.deps import get_db


log = logging.getLogger(__name__)


class RateLimiter:
    """Single-token cooldown per key. Raises 429 if the key was hit
    within ``cooldown_seconds``.

    Postgres implementation: one row per (namespace, key). On a
    fresh attempt we INSERT a row with ``expires_at = NOW() +
    cooldown``. On an already-rate-limited attempt the ON CONFLICT
    WHERE clause refuses the UPDATE (because the existing row's
    expires_at is still in the future) and RETURNING comes back
    empty — we recognise that as "still cooling down" and raise.
    """

    def __init__(self, cooldown_seconds: float, namespace: str):
        self._cooldown = max(1, int(cooldown_seconds))
        self._namespace = namespace

    def check(self, key: str) -> None:
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    # Single atomic statement: INSERT a fresh
                    # cooldown stamp if no row exists OR the existing
                    # row has already expired. If a still-active row
                    # exists, the WHERE clause makes the UPDATE a
                    # no-op and RETURNING is empty — we fall through
                    # to the "still in cooldown" branch below.
                    cur.execute(
                        """
                        INSERT INTO rate_limit_counters
                            (namespace, key, count, expires_at)
                        VALUES (%s, %s, 1, NOW() + (%s * INTERVAL '1 second'))
                        ON CONFLICT (namespace, key) DO UPDATE
                            SET count = 1,
                                expires_at = EXCLUDED.expires_at
                            WHERE rate_limit_counters.expires_at <= NOW()
                        RETURNING expires_at
                        """,
                        (self._namespace, key, self._cooldown),
                    )
                    claimed = cur.fetchone()
                    if claimed is not None:
                        return  # claimed the slot

                    # Still in cooldown — read remaining TTL for the
                    # 429 message. Same connection so we see the row
                    # the previous statement bounced off.
                    cur.execute(
                        """
                        SELECT EXTRACT(EPOCH FROM (expires_at - NOW())) AS ttl
                          FROM rate_limit_counters
                         WHERE namespace = %s AND key = %s
                        """,
                        (self._namespace, key),
                    )
                    row = cur.fetchone()
        except Exception as exc:  # noqa: BLE001
            log.error("rate_limit.db_error namespace=%s key=%s error=%s",
                      self._namespace, key, exc)
            return  # fail open

        ttl = None
        if row is not None:
            try:
                ttl = int(float(row["ttl"]))
            except (TypeError, ValueError, KeyError):
                ttl = None
        ttl = ttl if (ttl is not None and ttl > 0) else self._cooldown
        raise HTTPException(429, f"Rate limited. Try again in {ttl}s.")


class SlidingWindowLimiter:
    """``max_requests`` per ``window_seconds`` per key. Returns
    True if the request is allowed, False if over limit.

    Implementation note (Phase 5.5 migration): the previous Redis
    ZSET implementation was a true rolling window. The Postgres
    implementation is a fixed window with the same parameters —
    when the first request lands the row's ``expires_at`` is set
    to ``NOW() + window_seconds`` and subsequent requests in that
    window INCR the counter. When the row expires the next request
    resets it. Worst-case effective rate is ``2 × max_requests``
    across a window boundary — acceptable for the limits in use
    today (5/min, 60/hr, 200/day) because the per-(wallet, dev)
    cooldown and the daily caps bound real cost.
    """

    def __init__(self, max_requests: int, window_seconds: float, namespace: str):
        self._max = int(max_requests)
        self._window = max(1, int(window_seconds))
        self._namespace = namespace

    def check(self, key: str) -> bool:
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    # Atomic INSERT-or-INCR within the current
                    # fixed window. Two cases handled in one
                    # statement:
                    #   row missing or expired → reset to 1 with a
                    #                            fresh expires_at
                    #   row active             → increment, keep
                    #                            expires_at
                    cur.execute(
                        """
                        INSERT INTO rate_limit_counters
                            (namespace, key, count, expires_at)
                        VALUES (%s, %s, 1, NOW() + (%s * INTERVAL '1 second'))
                        ON CONFLICT (namespace, key) DO UPDATE
                            SET count = CASE
                                    WHEN rate_limit_counters.expires_at <= NOW() THEN 1
                                    ELSE rate_limit_counters.count + 1
                                END,
                                expires_at = CASE
                                    WHEN rate_limit_counters.expires_at <= NOW() THEN EXCLUDED.expires_at
                                    ELSE rate_limit_counters.expires_at
                                END
                        RETURNING count
                        """,
                        (self._namespace, key, self._window),
                    )
                    row = cur.fetchone()
                    count = int(row["count"]) if row else 0
                    if count > self._max:
                        # Over limit. Roll back our own increment
                        # so a long-running over-limit IP doesn't
                        # keep climbing the counter (and so the row
                        # caps at max + 1 visible during the moment
                        # the request is rejected — easier to read
                        # in logs).
                        cur.execute(
                            """
                            UPDATE rate_limit_counters
                               SET count = count - 1
                             WHERE namespace = %s AND key = %s
                            """,
                            (self._namespace, key),
                        )
                        return False
                    return True
        except Exception as exc:  # noqa: BLE001
            log.error("rate_limit.db_error namespace=%s key=%s error=%s",
                      self._namespace, key, exc)
            return True  # fail open


# ---------------------------------------------------------------------------
# Per-wallet daily counter (Phase 5.5)
# ---------------------------------------------------------------------------
#
# Layered on TOP of the per-IP caps below. Same wallet hitting from
# multiple IPs still shares the 30/day budget; same IP rotating
# wallets still hits the IP caps. Counter is keyed by wallet+UTC
# date so it resets at UTC midnight — user-mental-model "daily
# limit" rather than a sliding 24h window.
#
# Storage: same rate_limit_counters table; the date suffix on the
# key means each new UTC day is a new row with its own expires_at.

# Phase 5.8: raised from 30 to 75 after public launch feedback
# (Discord ticket 2026-05-12). Users hit the cap during normal
# multi-Dev chatting; 75 gives headroom while the global $1/day
# cost ceiling in services/llm_cost.py stays the ultimate backstop.
WALLET_DAILY_LIMIT: int = 75
_WALLET_DAY_NS: str = "souls_chat_wallet_day"


def _utc_today_str() -> str:
    """Today's UTC date as YYYY-MM-DD. Kept as a separate helper so
    tests can monkeypatch it for the daily-reset case."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).date().isoformat()


def _seconds_until_utc_midnight() -> int:
    """Seconds remaining until the next UTC 00:00. Used as the TTL
    on the per-wallet counter so the key auto-expires at day
    rollover even when a cleanup job isn't running. Floored at 60s
    so a request landing seconds before midnight doesn't end up
    with a 1-second TTL that races the next request."""
    from datetime import datetime, time as dt_time, timedelta, timezone
    now = datetime.now(timezone.utc)
    tomorrow_midnight = datetime.combine(
        (now + timedelta(days=1)).date(), dt_time.min, tzinfo=timezone.utc,
    )
    return max(int((tomorrow_midnight - now).total_seconds()), 60)


def wallet_day_key(wallet: str, today: str | None = None) -> str:
    """Build the Postgres key string for a wallet+UTC-date pair.
    Exposed for tests that want to inspect / reset the counter
    directly."""
    if today is None:
        today = _utc_today_str()
    return f"{wallet.lower()}:{today}"


def peek_wallet_daily_count(wallet: str, today: str | None = None) -> int:
    """Return the current per-wallet daily count for the given UTC
    date, or 0 on DB outage (fail-open consistent with the rest of
    this module). Used by the chat route to short-circuit BEFORE
    the LLM call when the wallet is already at limit."""
    key = wallet_day_key(wallet, today)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT count FROM rate_limit_counters
                     WHERE namespace = %s AND key = %s
                       AND expires_at > NOW()
                    """,
                    (_WALLET_DAY_NS, key),
                )
                row = cur.fetchone()
                return int(row["count"]) if row else 0
    except Exception as exc:  # noqa: BLE001
        log.error("rate_limit.db_error namespace=%s wallet=%s error=%s",
                  _WALLET_DAY_NS, wallet, exc)
        return 0


def increment_wallet_daily_count(wallet: str, today: str | None = None) -> int:
    """Atomically increment and return the post-increment count.
    On a fresh day this inserts a new row with expires_at anchored
    to the next UTC midnight; subsequent increments within the day
    advance the counter without resetting the TTL.

    Fail-open: returns 0 on DB outage so a transient outage never
    blocks chat. Real protection at scale is the IP rate limiter +
    global LLM cost ceiling."""
    key = wallet_day_key(wallet, today)
    ttl = _seconds_until_utc_midnight()
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO rate_limit_counters
                        (namespace, key, count, expires_at)
                    VALUES (%s, %s, 1, NOW() + (%s * INTERVAL '1 second'))
                    ON CONFLICT (namespace, key) DO UPDATE
                        SET count = CASE
                                WHEN rate_limit_counters.expires_at <= NOW() THEN 1
                                ELSE rate_limit_counters.count + 1
                            END,
                            expires_at = CASE
                                WHEN rate_limit_counters.expires_at <= NOW() THEN EXCLUDED.expires_at
                                ELSE rate_limit_counters.expires_at
                            END
                    RETURNING count
                    """,
                    (_WALLET_DAY_NS, key, ttl),
                )
                row = cur.fetchone()
                return int(row["count"]) if row else 0
    except Exception as exc:  # noqa: BLE001
        log.error("rate_limit.db_error namespace=%s wallet=%s error=%s",
                  _WALLET_DAY_NS, wallet, exc)
        return 0


# ---------------------------------------------------------------------------
# Shared instances — import where needed. Namespaces prevent collisions
# between limiters that happen to receive the same logical key.
# ---------------------------------------------------------------------------

prompt_limiter = RateLimiter(cooldown_seconds=60, namespace="prompt")      # 1 prompt per dev per 60s
chat_limiter = RateLimiter(cooldown_seconds=10, namespace="chat")          # 1 chat msg per wallet per 10s
shop_limiter = RateLimiter(cooldown_seconds=1, namespace="shop")           # 1 purchase per wallet per 1s
comment_limiter = RateLimiter(cooldown_seconds=60, namespace="nxmarket_comment")  # 1 comment per wallet per 60s

# Global per-IP rate limiter: 120 requests per 60 seconds (fixed window)
global_ip_limiter = SlidingWindowLimiter(
    max_requests=120,
    window_seconds=60,
    namespace="global_ip",
)

# NX Souls chat endpoint — three layered IP-based caps. The chat
# endpoint can drain real money on the OpenRouter paid tier, so we run
# tighter limits than `global_ip_limiter` here on top of (not instead
# of) the per-(wallet, dev) cool-down. Each window is its own counter
# so a burst of 5 within a minute followed by 5 more in the next minute
# still trips the hour cap.
#
# Phase 5.8: per-IP caps raised after public launch feedback (Discord
# ticket 2026-05-12). New values: 15/min (was 5), 150/hr (was 60),
# 500/day (was 200). The $1/day LLM cost ceiling in
# services/llm_cost.py is unchanged — it's the ultimate backstop.
souls_ip_per_minute = SlidingWindowLimiter(
    max_requests=15,
    window_seconds=60,
    namespace="souls_chat_ip_min",
)
souls_ip_per_hour = SlidingWindowLimiter(
    max_requests=150,
    window_seconds=3600,
    namespace="souls_chat_ip_hr",
)
souls_ip_per_day = SlidingWindowLimiter(
    max_requests=500,
    window_seconds=86400,
    namespace="souls_chat_ip_day",
)
