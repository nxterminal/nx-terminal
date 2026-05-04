"""Tests for backend.services.nx_souls.quota — pure logic.

These exercise the quota helpers against a stub psycopg2-style cursor
so the SQL contract is pinned (which statement runs, which params, what
shape of row comes back) without needing a real Postgres.

`get_quota_state` is the read-and-reset half of the machine; we cover:
  - first-request path (row absent → INSERT, returns used=0)
  - same-day path     (row exists, date matches → returns existing used)
  - new-day path      (row exists, date older   → counter resets to 0)
  - exceeded path     (used >= limit → state.exceeded is True)

`increment_quota` is the write half; we cover the increment path and
the resets_at semantics through `next_utc_midnight`.

Limit lookup is covered for known + unknown rarities.
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest  # noqa: E402

from backend.services.nx_souls.quota import (  # noqa: E402
    DEFAULT_QUOTA,
    QUOTAS_BY_RARITY,
    QuotaState,
    get_quota_limit,
    get_quota_state,
    increment_quota,
    next_utc_midnight,
)


class StubCursor:
    """Minimal cursor stub: returns scripted results to fetchone() in
    the order rows are pushed via .push_row(...). Records each (sql,
    params) tuple in self.calls for assertions."""

    def __init__(self):
        self.calls: list[tuple[str, tuple]] = []
        self._pending: list[dict | None] = []

    def push_row(self, row: dict | None):
        self._pending.append(row)
        return self

    def execute(self, sql, params=None):
        self.calls.append((sql, params or ()))

    def fetchone(self):
        if not self._pending:
            return None
        return self._pending.pop(0)


# ─── get_quota_limit ─────────────────────────────────────────────────────


def test_quota_limit_known_rarities():
    assert get_quota_limit("common") == 30
    assert get_quota_limit("uncommon") == 50
    assert get_quota_limit("rare") == 80
    assert get_quota_limit("legendary") == 120
    assert get_quota_limit("mythic") == 200


def test_quota_limit_unknown_or_missing_falls_back():
    assert get_quota_limit(None) == DEFAULT_QUOTA
    assert get_quota_limit("") == DEFAULT_QUOTA
    assert get_quota_limit("transcendent") == DEFAULT_QUOTA


def test_quota_table_covers_every_canonical_rarity():
    """Mirror of the canonical-rarity set so a new rarity in
    translation.py without a quota entry trips this test."""
    from backend.services.canonical.translation import RARITY_TO_PUBLIC
    missing = [r for r in RARITY_TO_PUBLIC if r not in QUOTAS_BY_RARITY]
    assert not missing, f"rarities without quotas: {missing}"


# ─── next_utc_midnight ───────────────────────────────────────────────────


def test_next_utc_midnight_strictly_after_now():
    now = datetime(2026, 5, 4, 23, 59, 59, tzinfo=timezone.utc)
    nxt = next_utc_midnight(now)
    assert nxt == datetime(2026, 5, 5, 0, 0, 0, tzinfo=timezone.utc)
    assert nxt > now


def test_next_utc_midnight_at_exact_midnight_returns_following_day():
    """Edge: when called precisely at 00:00:00 UTC, return tomorrow,
    not 'now'. Otherwise the resets_at would be in the past."""
    now = datetime(2026, 5, 4, 0, 0, 0, tzinfo=timezone.utc)
    nxt = next_utc_midnight(now)
    assert nxt == datetime(2026, 5, 5, 0, 0, 0, tzinfo=timezone.utc)


def test_next_utc_midnight_handles_naive_input():
    naive = datetime(2026, 5, 4, 12, 0, 0)
    nxt = next_utc_midnight(naive)
    assert nxt.tzinfo is timezone.utc
    assert nxt == datetime(2026, 5, 5, 0, 0, 0, tzinfo=timezone.utc)


# ─── get_quota_state ─────────────────────────────────────────────────────


def test_get_quota_state_first_request_returns_zero():
    cur = StubCursor().push_row({"messages_today": 0, "quota_date": date(2026, 5, 4)})
    state = get_quota_state(cur, token_id=29572, rarity_tier="common", today=date(2026, 5, 4))
    assert state.used == 0
    assert state.limit == 30
    assert state.remaining == 30
    assert state.exceeded is False


def test_get_quota_state_returns_existing_count_same_day():
    cur = StubCursor().push_row({"messages_today": 7, "quota_date": date(2026, 5, 4)})
    state = get_quota_state(cur, token_id=1, rarity_tier="rare", today=date(2026, 5, 4))
    assert state.used == 7
    assert state.limit == 80
    assert state.remaining == 73


def test_get_quota_state_resets_on_new_day():
    """The UPSERT's CASE clause resets the counter when the stored
    quota_date is older than today; the stub returns the post-reset
    row to verify the surface contract."""
    cur = StubCursor().push_row({"messages_today": 0, "quota_date": date(2026, 5, 5)})
    state = get_quota_state(cur, token_id=1, rarity_tier="common", today=date(2026, 5, 5))
    assert state.used == 0
    sql, params = cur.calls[0]
    # Pin SQL contract: today must be the date passed for the reset
    # comparison, and the CASE clause must reference quota_date.
    assert params == (1, date(2026, 5, 5))
    assert "ON CONFLICT (token_id) DO UPDATE" in sql
    assert "messages_today = CASE" in sql
    assert "quota_date = GREATEST" in sql


def test_get_quota_state_exceeded_when_used_at_limit():
    cur = StubCursor().push_row({"messages_today": 30, "quota_date": date(2026, 5, 4)})
    state = get_quota_state(cur, token_id=1, rarity_tier="common", today=date(2026, 5, 4))
    assert state.exceeded is True
    assert state.remaining == 0


def test_get_quota_state_exceeded_when_used_over_limit():
    """If a stale row has used > limit (rarity downgrade, manual edit),
    treat as exceeded — never let a Dev burn beyond their cap."""
    cur = StubCursor().push_row({"messages_today": 35, "quota_date": date(2026, 5, 4)})
    state = get_quota_state(cur, token_id=1, rarity_tier="common", today=date(2026, 5, 4))
    assert state.exceeded is True
    assert state.remaining == 0


def test_get_quota_state_resets_at_is_today_plus_one_utc_midnight():
    cur = StubCursor().push_row({"messages_today": 0, "quota_date": date(2026, 5, 4)})
    state = get_quota_state(cur, 1, "common", today=date(2026, 5, 4))
    # We don't pin a specific `now` here (function reads wall clock), so
    # only assert that resets_at is in the future and is UTC midnight.
    assert state.resets_at.tzinfo is timezone.utc
    assert state.resets_at.hour == 0
    assert state.resets_at.minute == 0
    assert state.resets_at > datetime.now(timezone.utc)


# ─── increment_quota ─────────────────────────────────────────────────────


def test_increment_quota_returns_new_count():
    cur = StubCursor().push_row({"messages_today": 8})
    result = increment_quota(cur, 29572)
    assert result == 8
    sql, params = cur.calls[0]
    assert params == (29572,)
    assert "messages_today = messages_today + 1" in sql
    assert "RETURNING messages_today" in sql


def test_increment_quota_handles_missing_row_gracefully():
    """Defensive: if the row was deleted between get_quota_state and
    the increment (admin reset, mid-request), return 0 rather than
    crash. This is a soft path; the request still succeeded."""
    cur = StubCursor().push_row(None)
    assert increment_quota(cur, 1) == 0


# ─── QuotaState shape ────────────────────────────────────────────────────


def test_quota_state_remaining_never_negative():
    state = QuotaState(
        used=99, limit=30, resets_at=datetime.now(timezone.utc) + timedelta(hours=1)
    )
    assert state.remaining == 0
    assert state.exceeded is True
