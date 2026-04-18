"""Tests for the Redis-backed rate limiters in backend.api.rate_limit.

These hit a real local Redis on 127.0.0.1:6379 (or whatever
``REDIS_URL`` points at). Tests use a unique namespace per run so
they don't step on any other state.

If Redis isn't reachable the whole module is skipped with a clear
message — no point in running a Redis rate limiter test suite
without Redis.
"""

from __future__ import annotations

import os
import sys
import threading
import time
import uuid
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from backend.api import deps  # noqa: E402
from backend.api import rate_limit  # noqa: E402
from fastapi import HTTPException  # noqa: E402


def _redis_available() -> bool:
    try:
        import redis as sync_redis  # noqa: F401
        client = sync_redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
        client.ping()
        return True
    except Exception:
        return False


REDIS_OK = _redis_available()

pytestmark = pytest.mark.skipif(
    not REDIS_OK,
    reason="Redis not reachable on REDIS_URL — skipping redis-rate-limiter tests",
)


@pytest.fixture(autouse=True)
def isolate_namespace(monkeypatch):
    """Force every test to use its own namespace prefix so keys never
    overlap with concurrent tests or stale state from previous runs."""
    run_id = uuid.uuid4().hex[:8]
    monkeypatch.setattr(rate_limit, "KEY_PREFIX", f"ratelimit_test_{run_id}")
    deps.reset_sync_redis()
    yield
    # Best-effort cleanup
    try:
        client = deps.get_sync_redis()
        if client:
            for key in client.scan_iter(f"ratelimit_test_{run_id}:*"):
                client.delete(key)
    except Exception:
        pass
    deps.reset_sync_redis()


# ---------------------------------------------------------------------------
# RateLimiter (single-token cooldown)
# ---------------------------------------------------------------------------


def test_ratelimiter_first_call_allowed():
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace="unit_cooldown")
    lim.check("wallet:abc")  # should not raise


def test_ratelimiter_second_call_blocked():
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace="unit_cooldown")
    lim.check("wallet:xyz")
    with pytest.raises(HTTPException) as excinfo:
        lim.check("wallet:xyz")
    assert excinfo.value.status_code == 429
    assert "Try again" in excinfo.value.detail


def test_ratelimiter_different_keys_independent():
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace="unit_cooldown")
    lim.check("wallet:A")
    lim.check("wallet:B")  # different key — must not raise


def test_ratelimiter_namespaces_are_isolated():
    # Same key, two different namespaces — should not collide.
    a = rate_limit.RateLimiter(cooldown_seconds=60, namespace="ns_a")
    b = rate_limit.RateLimiter(cooldown_seconds=60, namespace="ns_b")
    a.check("shared-key")
    b.check("shared-key")  # different namespace — must not raise


def test_ratelimiter_expiry_allows_after_window(monkeypatch):
    # Use the shortest cooldown the limiter rounds up to (1s), then wait it out.
    lim = rate_limit.RateLimiter(cooldown_seconds=1, namespace="unit_expiry")
    lim.check("wallet:tick")
    with pytest.raises(HTTPException):
        lim.check("wallet:tick")
    time.sleep(1.1)
    lim.check("wallet:tick")  # cooldown elapsed — allowed again


# ---------------------------------------------------------------------------
# SlidingWindowLimiter (N per window)
# ---------------------------------------------------------------------------


def test_slidingwindow_allows_up_to_max():
    lim = rate_limit.SlidingWindowLimiter(max_requests=3, window_seconds=60, namespace="unit_slide")
    assert lim.check("ip:1.2.3.4") is True
    assert lim.check("ip:1.2.3.4") is True
    assert lim.check("ip:1.2.3.4") is True


def test_slidingwindow_blocks_over_max():
    lim = rate_limit.SlidingWindowLimiter(max_requests=3, window_seconds=60, namespace="unit_slide")
    for _ in range(3):
        assert lim.check("ip:5.6.7.8") is True
    assert lim.check("ip:5.6.7.8") is False


def test_slidingwindow_different_keys_independent():
    lim = rate_limit.SlidingWindowLimiter(max_requests=2, window_seconds=60, namespace="unit_slide")
    assert lim.check("ip:A") is True
    assert lim.check("ip:A") is True
    # Separate key — fresh budget.
    assert lim.check("ip:B") is True


def test_slidingwindow_window_expiry_restores_budget():
    lim = rate_limit.SlidingWindowLimiter(max_requests=2, window_seconds=1, namespace="unit_slide")
    assert lim.check("ip:roll") is True
    assert lim.check("ip:roll") is True
    assert lim.check("ip:roll") is False
    time.sleep(1.2)
    # Window rolled — old hits pruned.
    assert lim.check("ip:roll") is True


# ---------------------------------------------------------------------------
# Fail-open on Redis outage
# ---------------------------------------------------------------------------


def test_ratelimiter_fails_open_when_redis_unavailable(monkeypatch):
    monkeypatch.setattr(rate_limit, "get_sync_redis", lambda: None)
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace="unit_failopen")
    # Call repeatedly — all should pass because Redis is "down".
    for _ in range(5):
        lim.check("wallet:any")


def test_slidingwindow_fails_open_when_redis_unavailable(monkeypatch):
    monkeypatch.setattr(rate_limit, "get_sync_redis", lambda: None)
    lim = rate_limit.SlidingWindowLimiter(max_requests=1, window_seconds=60, namespace="unit_failopen")
    for _ in range(5):
        assert lim.check("ip:unreachable") is True


def test_ratelimiter_fails_open_on_redis_exception(monkeypatch):
    class ExplodingClient:
        def set(self, *a, **kw):
            raise RuntimeError("redis exploded")

        def ttl(self, *a, **kw):
            return -1

    monkeypatch.setattr(rate_limit, "get_sync_redis", lambda: ExplodingClient())
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace="unit_failopen2")
    lim.check("wallet:boom")  # must not raise


# ---------------------------------------------------------------------------
# Cross-worker semantics — the whole point of this PR
# ---------------------------------------------------------------------------


def test_ratelimiter_is_shared_across_instances():
    """Two limiter instances with the same namespace share the
    Redis state — that's what makes it cross-worker safe."""
    a = rate_limit.RateLimiter(cooldown_seconds=60, namespace="cross_shared")
    b = rate_limit.RateLimiter(cooldown_seconds=60, namespace="cross_shared")
    a.check("wallet:shared")
    with pytest.raises(HTTPException):
        b.check("wallet:shared")  # b sees a's hit via Redis


def test_concurrent_checks_respect_sliding_window_limit():
    """20 threads hammer the limiter, max=5. Exactly 5 must pass."""
    lim = rate_limit.SlidingWindowLimiter(max_requests=5, window_seconds=60, namespace="cross_race")

    results: list = []
    barrier = threading.Barrier(20, timeout=5)

    def worker():
        try:
            barrier.wait()
        except threading.BrokenBarrierError:
            pass
        results.append(lim.check("ip:shared"))

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    allowed = sum(1 for r in results if r is True)
    blocked = sum(1 for r in results if r is False)
    assert allowed == 5, f"expected exactly 5 allowed, got {allowed} ({blocked} blocked)"
    assert blocked == 15
