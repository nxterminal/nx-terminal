"""Simple in-memory rate limiter — no Redis required."""

import time
from collections import defaultdict
from fastapi import HTTPException


class RateLimiter:
    """Per-key rate limiter using a dict of timestamps."""

    def __init__(self, cooldown_seconds: float):
        self._cooldown = cooldown_seconds
        self._last_hit: dict[str, float] = defaultdict(float)

    def check(self, key: str) -> None:
        """Raise 429 if the key has been seen within the cooldown window."""
        now = time.monotonic()
        if now - self._last_hit[key] < self._cooldown:
            remaining = self._cooldown - (now - self._last_hit[key])
            raise HTTPException(429, f"Rate limited. Try again in {remaining:.0f}s.")
        self._last_hit[key] = now

    def cleanup(self, max_age: float = 3600) -> None:
        """Remove stale entries older than max_age seconds (call periodically)."""
        now = time.monotonic()
        stale = [k for k, t in self._last_hit.items() if now - t > max_age]
        for k in stale:
            del self._last_hit[k]


# Shared instances — import where needed
prompt_limiter = RateLimiter(cooldown_seconds=60)    # 1 prompt per dev per 60s
chat_limiter = RateLimiter(cooldown_seconds=10)      # 1 chat msg per wallet per 10s
shop_limiter = RateLimiter(cooldown_seconds=5)       # 1 purchase per wallet per 5s
