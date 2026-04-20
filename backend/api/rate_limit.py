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
