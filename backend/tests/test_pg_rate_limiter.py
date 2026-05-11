"""Tests for the Postgres-backed rate limiters in backend.api.rate_limit.

Phase 5.5 migration — the previous Redis-backed implementation was
silently fail-open in production (Redis was never provisioned). This
suite covers the Postgres replacement.

Each test uses its own unique namespace so rows don't collide with
concurrent tests or stale state from previous runs. The session-
scoped schema fixture in conftest.py ensures the
``rate_limit_counters`` table exists before any test runs.
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

os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")

from backend.api import deps  # noqa: E402
from backend.api import rate_limit  # noqa: E402
from fastapi import HTTPException  # noqa: E402


# The session-scoped schema bootstrap in conftest.py runs migrations
# before any test executes, so rate_limit_counters exists. We just
# need a connection pool open for direct rate-limit calls.
@pytest.fixture(scope="module", autouse=True)
def _ensure_pool():
    # maxconn=24 because the concurrency test fires 20 threads at
    # the same row and each one grabs a connection for the duration
    # of its check(). A maxconn of 4 (the default for most other
    # test modules) would have them race the pool itself, not the
    # row, and 15 would silently fail-open on pool exhaustion — the
    # exact thing the test is trying to falsify.
    if deps._pool is None:
        deps.init_db_pool(minconn=1, maxconn=24)
    yield


@pytest.fixture(autouse=True)
def _unique_namespace(request):
    """Hand every test a unique namespace suffix so its rows can't
    collide with rows from other tests in the same DB. Equivalent to
    the Redis suite's KEY_PREFIX monkeypatch — but here the limiter
    constructors are local to each test, so the namespace argument
    is the natural carrier."""
    request.node.ns_suffix = uuid.uuid4().hex[:8]
    yield


def _ns(request, label: str) -> str:
    return f"{label}_{request.node.ns_suffix}"


# ---------------------------------------------------------------------------
# RateLimiter (single-token cooldown)
# ---------------------------------------------------------------------------


def test_ratelimiter_first_call_allowed(request):
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace=_ns(request, "cooldown"))
    lim.check("wallet:abc")  # should not raise


def test_ratelimiter_second_call_blocked(request):
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace=_ns(request, "cooldown"))
    lim.check("wallet:xyz")
    with pytest.raises(HTTPException) as excinfo:
        lim.check("wallet:xyz")
    assert excinfo.value.status_code == 429
    assert "Try again" in excinfo.value.detail


def test_ratelimiter_different_keys_independent(request):
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace=_ns(request, "cooldown"))
    lim.check("wallet:A")
    lim.check("wallet:B")  # different key — must not raise


def test_ratelimiter_namespaces_are_isolated(request):
    # Same key, two different namespaces — must not collide.
    a = rate_limit.RateLimiter(cooldown_seconds=60, namespace=_ns(request, "ns_a"))
    b = rate_limit.RateLimiter(cooldown_seconds=60, namespace=_ns(request, "ns_b"))
    a.check("shared-key")
    b.check("shared-key")  # different namespace — must not raise


def test_ratelimiter_expiry_allows_after_window(request):
    # Use the shortest cooldown the limiter rounds up to (1s), then wait it out.
    lim = rate_limit.RateLimiter(cooldown_seconds=1, namespace=_ns(request, "expiry"))
    lim.check("wallet:tick")
    with pytest.raises(HTTPException):
        lim.check("wallet:tick")
    time.sleep(1.1)
    lim.check("wallet:tick")  # cooldown elapsed — allowed again


# ---------------------------------------------------------------------------
# SlidingWindowLimiter — now fixed-window in the Postgres impl, but the
# class name + API are preserved. Same parameters, same allow/block
# semantics within a window.
# ---------------------------------------------------------------------------


def test_window_allows_up_to_max(request):
    lim = rate_limit.SlidingWindowLimiter(
        max_requests=3, window_seconds=60, namespace=_ns(request, "win"),
    )
    assert lim.check("ip:1.2.3.4") is True
    assert lim.check("ip:1.2.3.4") is True
    assert lim.check("ip:1.2.3.4") is True


def test_window_blocks_over_max(request):
    lim = rate_limit.SlidingWindowLimiter(
        max_requests=3, window_seconds=60, namespace=_ns(request, "win"),
    )
    for _ in range(3):
        assert lim.check("ip:5.6.7.8") is True
    assert lim.check("ip:5.6.7.8") is False


def test_window_different_keys_independent(request):
    lim = rate_limit.SlidingWindowLimiter(
        max_requests=2, window_seconds=60, namespace=_ns(request, "win"),
    )
    assert lim.check("ip:A") is True
    assert lim.check("ip:A") is True
    # Separate key — fresh budget.
    assert lim.check("ip:B") is True


def test_window_expiry_restores_budget(request):
    lim = rate_limit.SlidingWindowLimiter(
        max_requests=2, window_seconds=1, namespace=_ns(request, "win"),
    )
    assert lim.check("ip:roll") is True
    assert lim.check("ip:roll") is True
    assert lim.check("ip:roll") is False
    time.sleep(1.2)
    # Window rolled — counter reset.
    assert lim.check("ip:roll") is True


# ---------------------------------------------------------------------------
# Fail-open on DB outage — preserved from the pre-migration Redis behaviour
# ---------------------------------------------------------------------------


class _ExplodingDB:
    """Drop-in for get_db() that always raises on `__enter__`. Simulates
    a DB outage so the fail-open branch can be exercised without taking
    down the real pool."""

    def __enter__(self):
        raise RuntimeError("DB down")

    def __exit__(self, *a):
        return False


def test_ratelimiter_fails_open_when_db_unavailable(request, monkeypatch):
    monkeypatch.setattr(rate_limit, "get_db", lambda: _ExplodingDB())
    lim = rate_limit.RateLimiter(cooldown_seconds=60, namespace=_ns(request, "failopen"))
    # Call repeatedly — all should pass because the DB is "down".
    for _ in range(5):
        lim.check("wallet:any")


def test_window_fails_open_when_db_unavailable(request, monkeypatch):
    monkeypatch.setattr(rate_limit, "get_db", lambda: _ExplodingDB())
    lim = rate_limit.SlidingWindowLimiter(
        max_requests=1, window_seconds=60, namespace=_ns(request, "failopen"),
    )
    for _ in range(5):
        assert lim.check("ip:unreachable") is True


# ---------------------------------------------------------------------------
# Cross-instance / cross-worker semantics — the whole point of moving to
# Postgres is that all uvicorn workers see the same state.
# ---------------------------------------------------------------------------


def test_ratelimiter_is_shared_across_instances(request):
    """Two limiter instances with the same namespace share the
    Postgres state — that's what makes it cross-worker safe."""
    ns = _ns(request, "shared")
    a = rate_limit.RateLimiter(cooldown_seconds=60, namespace=ns)
    b = rate_limit.RateLimiter(cooldown_seconds=60, namespace=ns)
    a.check("wallet:shared")
    with pytest.raises(HTTPException):
        b.check("wallet:shared")  # b sees a's hit via the shared row


def test_concurrent_checks_respect_window_limit(request):
    """20 threads hammer the limiter, max=5. Exactly 5 must pass.

    The atomic ``INSERT ... ON CONFLICT DO UPDATE ... RETURNING count``
    statement plus the post-increment over-limit rollback guarantee
    the count is consistent under concurrent access — no double-count
    even when 20 threads race the same row."""
    lim = rate_limit.SlidingWindowLimiter(
        max_requests=5, window_seconds=60, namespace=_ns(request, "race"),
    )

    results: list = []
    results_lock = threading.Lock()
    barrier = threading.Barrier(20, timeout=5)

    def worker():
        try:
            barrier.wait()
        except threading.BrokenBarrierError:
            pass
        ok = lim.check("ip:shared")
        with results_lock:
            results.append(ok)

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    allowed = sum(1 for r in results if r is True)
    blocked = sum(1 for r in results if r is False)
    assert allowed == 5, f"expected exactly 5 allowed, got {allowed} ({blocked} blocked)"
    assert blocked == 15
