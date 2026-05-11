"""Rate limiters backed by Redis.

Every uvicorn worker reads and writes the same Redis keys, so
"1 request per wallet per second" is a single system-wide budget —
not a per-worker one multiplied by 8.

Two shapes are preserved from the old in-memory implementation:

- ``RateLimiter.check(key)`` — single-token cooldown, raises
  ``HTTPException(429)`` on limit.
- ``SlidingWindowLimiter.check(key)`` — N requests per window,
  returns ``True``/``False``.

Each limiter is given a ``namespace`` at construction so two
limiters hitting the same ``key`` don't collide in the shared Redis
keyspace.

If Redis is unreachable, both check() methods **fail open** (allow
the request) so a Redis outage never bricks the API.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from backend.api.deps import get_sync_redis


log = logging.getLogger(__name__)

KEY_PREFIX = "ratelimit"


def _key(namespace: str, key: str) -> str:
    return f"{KEY_PREFIX}:{namespace}:{key}"


class RateLimiter:
    """Single-token cooldown per key. Raises 429 if the key was hit
    within ``cooldown_seconds``."""

    def __init__(self, cooldown_seconds: float, namespace: str):
        self._cooldown = max(1, int(cooldown_seconds))
        self._namespace = namespace

    def check(self, key: str) -> None:
        redis_client = get_sync_redis()
        if redis_client is None:
            return  # fail open

        full = _key(self._namespace, key)
        try:
            # SET NX EX is atomic: either we claim the cooldown slot
            # or we bounce off an existing one.
            ok = redis_client.set(full, "1", nx=True, ex=self._cooldown)
        except Exception as exc:  # noqa: BLE001
            log.error("rate_limit.redis_error namespace=%s key=%s error=%s",
                      self._namespace, key, exc)
            return  # fail open

        if ok:
            return

        # Still in the cooldown window.
        try:
            ttl = redis_client.ttl(full)
        except Exception:  # noqa: BLE001
            ttl = self._cooldown
        ttl = ttl if (isinstance(ttl, int) and ttl > 0) else self._cooldown
        raise HTTPException(429, f"Rate limited. Try again in {ttl}s.")


class SlidingWindowLimiter:
    """``max_requests`` per ``window_seconds`` per key. Returns True
    if the request is allowed, False if over limit.

    Implementation: a Redis sorted set scored by timestamp. Each
    request prunes old entries, counts what remains, adds itself,
    and (if the post-add count is over limit) removes its own entry
    as a rollback. The pipeline executes atomically on the Redis
    side since Redis is single-threaded."""

    def __init__(self, max_requests: int, window_seconds: float, namespace: str):
        self._max = int(max_requests)
        self._window = max(1, int(window_seconds))
        self._namespace = namespace

    def check(self, key: str) -> bool:
        redis_client = get_sync_redis()
        if redis_client is None:
            return True  # fail open

        full = _key(self._namespace, key)
        now = time.time()
        cutoff = now - self._window
        member = f"{now:.6f}:{uuid.uuid4().hex[:8]}"

        try:
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(full, 0, cutoff)
            pipe.zcard(full)
            pipe.zadd(full, {member: now})
            pipe.expire(full, self._window + 10)
            results = pipe.execute()
        except Exception as exc:  # noqa: BLE001
            log.error("rate_limit.redis_error namespace=%s key=%s error=%s",
                      self._namespace, key, exc)
            return True  # fail open

        count_before_add = int(results[1])
        if count_before_add >= self._max:
            # Over limit — roll back our add so it doesn't count
            # against future requests.
            try:
                redis_client.zrem(full, member)
            except Exception:  # noqa: BLE001
                pass
            return False
        return True


# ---------------------------------------------------------------------------
# Shared instances — import where needed. Namespaces prevent collisions
# between limiters that happen to receive the same logical key.
# ---------------------------------------------------------------------------

prompt_limiter = RateLimiter(cooldown_seconds=60, namespace="prompt")      # 1 prompt per dev per 60s
chat_limiter = RateLimiter(cooldown_seconds=10, namespace="chat")          # 1 chat msg per wallet per 10s
shop_limiter = RateLimiter(cooldown_seconds=1, namespace="shop")           # 1 purchase per wallet per 1s
comment_limiter = RateLimiter(cooldown_seconds=60, namespace="nxmarket_comment")  # 1 comment per wallet per 60s

# Global per-IP rate limiter: 120 requests per 60 seconds
global_ip_limiter = SlidingWindowLimiter(
    max_requests=120,
    window_seconds=60,
    namespace="global_ip",
)

# ---------------------------------------------------------------------------
# Per-wallet daily counter (Phase 5.5)
# ---------------------------------------------------------------------------
#
# Layered on TOP of the per-IP caps below. Same wallet hitting from
# multiple IPs still shares the 30/day budget; same IP rotating
# wallets still hits the IP caps. Counter is keyed by wallet+UTC date
# so it resets at UTC midnight — the user-mental-model "daily limit"
# rather than a sliding 24h window.
#
# Redis INCR + EXPIRE keeps the bookkeeping in the same store the
# rest of this module uses; no new DB table required (DB-backed
# alternative would mean adding a wallet_quota table, which the
# brief explicitly rejects).
#
# Returns the post-increment count from `increment_and_get`. Callers
# compare against `WALLET_DAILY_LIMIT` themselves so the comparison
# point is visible at the call site — easier to audit than "did this
# function reject us or not".

WALLET_DAILY_LIMIT: int = 30
_WALLET_DAY_NS: str = "souls_chat_wallet_day"


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _seconds_until_utc_midnight(now: datetime | None = None) -> int:
    """Seconds remaining until the next UTC 00:00. Used as the TTL on
    the per-wallet counter so the key auto-expires at day rollover
    (instead of leaking forever per wallet). Adds a small floor of
    60s so a request landing seconds before midnight doesn't end up
    with a 1-second TTL that races the next request."""
    if now is None:
        now = datetime.now(timezone.utc)
    tomorrow_midnight = datetime.combine(
        (now + timedelta(days=1)).date(), dt_time.min, tzinfo=timezone.utc,
    )
    seconds = int((tomorrow_midnight - now).total_seconds())
    return max(seconds, 60)


def wallet_day_key(wallet: str, today: date | None = None) -> str:
    """Build the Redis key for a wallet+UTC-date pair. Exposed for
    tests that want to inspect / reset the counter directly."""
    if today is None:
        today = _utc_today()
    return _key(_WALLET_DAY_NS, f"{wallet.lower()}:{today.isoformat()}")


def peek_wallet_daily_count(wallet: str, today: date | None = None) -> int:
    """Return the current count for the wallet's UTC day, or 0 on
    Redis outage (fail-open consistent with the rest of this module).
    Used by the chat route to short-circuit BEFORE the LLM call when
    the wallet is already at limit."""
    redis_client = get_sync_redis()
    if redis_client is None:
        return 0
    try:
        val = redis_client.get(wallet_day_key(wallet, today))
    except Exception as exc:  # noqa: BLE001
        log.error("rate_limit.redis_error namespace=%s wallet=%s error=%s",
                  _WALLET_DAY_NS, wallet, exc)
        return 0
    try:
        return int(val) if val is not None else 0
    except (TypeError, ValueError):
        return 0


def increment_wallet_daily_count(wallet: str, today: date | None = None) -> int:
    """Atomically increment and return the post-increment count.
    Sets TTL to next-UTC-midnight on the first increment of the day
    via SET-then-INCR pipeline; subsequent INCRs leave TTL alone so
    the key still expires at the original midnight boundary.

    Fail-open: returns 0 on Redis outage so a transient outage never
    blocks chat. Real protection at scale is the IP rate limiter +
    global LLM cost ceiling."""
    redis_client = get_sync_redis()
    if redis_client is None:
        return 0
    key = wallet_day_key(wallet, today)
    ttl = _seconds_until_utc_midnight()
    try:
        # INCR first (atomic). If the key was missing, INCR creates
        # it at 1 with no TTL — so we follow with EXPIRE NX (set TTL
        # only if no TTL exists yet) to anchor it to UTC midnight.
        # EXPIRE NX is Redis 7.0+; if unavailable, fall back to a
        # plain EXPIRE (cheap to call repeatedly within the day —
        # idempotent in effect).
        new_count = int(redis_client.incr(key))
        try:
            redis_client.expire(key, ttl, nx=True)
        except TypeError:
            # Older redis-py without the nx= kwarg — plain EXPIRE is
            # fine; resetting the TTL each day still lands at the
            # same UTC-midnight target because we recompute ttl each
            # request.
            redis_client.expire(key, ttl)
        return new_count
    except Exception as exc:  # noqa: BLE001
        log.error("rate_limit.redis_error namespace=%s wallet=%s error=%s",
                  _WALLET_DAY_NS, wallet, exc)
        return 0


# ---------------------------------------------------------------------------
# Per-IP sliding-window caps on the chat endpoint
# ---------------------------------------------------------------------------

# NX Souls chat endpoint — three layered IP-based caps. The chat
# endpoint can drain real money on the OpenRouter paid tier, so we run
# tighter limits than `global_ip_limiter` here on top of (not instead
# of) the per-(wallet, dev) cool-down. Each window is its own limiter
# so a burst of 5 within a minute followed by 5 more in the next minute
# still trips the hour cap.
souls_ip_per_minute = SlidingWindowLimiter(
    max_requests=5,
    window_seconds=60,
    namespace="souls_chat_ip_min",
)
souls_ip_per_hour = SlidingWindowLimiter(
    max_requests=60,
    window_seconds=3600,
    namespace="souls_chat_ip_hr",
)
souls_ip_per_day = SlidingWindowLimiter(
    max_requests=200,
    window_seconds=86400,
    namespace="souls_chat_ip_day",
)
