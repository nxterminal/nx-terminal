"""NX Souls — per-Dev daily message quota.

Pulled into Phase 1 (originally Phase 2) per PR #350 review feedback,
because the chat endpoint can drain real money on the OpenRouter paid
tier and per-token daily caps are the strongest mitigation we have
without full SIWE auth.

The state machine:
  - Each Dev gets one row in `nx_souls_quota` keyed by `token_id`.
  - On each chat attempt we read (`messages_today`, `quota_date`) and,
    if `quota_date < CURRENT_DATE` (UTC), reset the counter atomically.
  - If `messages_today >= limit`, reject with 429 and a payload that
    surfaces the limit and the next reset moment.
  - On a *successful* LLM reply, atomically increment the counter.
    Failed cascades do NOT consume quota — see PR #350 review point B.

Limits are derived from `devs.rarity_tier`. Phase 2 will widen this
into a sleep transition when the quota is hit; Phase 1 just rejects
the request and tells the caller when their quota resets.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Final, Mapping

log = logging.getLogger("nx_api")

# Source of truth for daily quotas. Keys MUST match the DB-internal
# rarity values stored in `devs.rarity_tier` (see
# `CANONICAL_RARITY_TO_PUBLIC` in services/canonical/translation.py).
QUOTAS_BY_RARITY: Final[Mapping[str, int]] = {
    "common":    30,
    "uncommon":  50,
    "rare":      80,
    "legendary": 120,
    "mythic":    200,
}

# Fallback when a Dev has a rarity we don't recognise (e.g. legacy row,
# future rarity added without a quota entry). Treat conservatively.
DEFAULT_QUOTA = 30


def get_quota_limit(rarity_tier: str | None) -> int:
    """Return the daily message cap for a DB-internal rarity value.

    Unknown / missing rarity → DEFAULT_QUOTA, with a warning log so the
    operator notices a rarity that needs a quota entry."""
    if not rarity_tier:
        return DEFAULT_QUOTA
    limit = QUOTAS_BY_RARITY.get(rarity_tier)
    if limit is None:
        log.warning(
            f"NX Souls quota: unknown rarity {rarity_tier!r}, "
            f"defaulting to {DEFAULT_QUOTA}"
        )
        return DEFAULT_QUOTA
    return limit


def next_utc_midnight(now: datetime | None = None) -> datetime:
    """The next UTC 00:00:00 strictly after `now`.

    Always returns a tz-aware UTC datetime. Used for the `resets_at`
    field in the 429 quota-exceeded response so the frontend can render
    a countdown without ambiguity."""
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    tomorrow = (now + timedelta(days=1)).date()
    return datetime.combine(tomorrow, time.min, tzinfo=timezone.utc)


@dataclass(frozen=True)
class QuotaState:
    used: int
    limit: int
    resets_at: datetime  # tz-aware UTC

    @property
    def remaining(self) -> int:
        return max(0, self.limit - self.used)

    @property
    def exceeded(self) -> bool:
        return self.used >= self.limit


def get_quota_state(
    cur,
    token_id: int,
    rarity_tier: str | None,
    *,
    today: date | None = None,
) -> QuotaState:
    """Read (and lazily reset) the quota state for `token_id`.

    Atomically:
      - inserts a fresh row if none exists,
      - resets `messages_today=0` and bumps `quota_date` if the stored
        date is older than today (UTC),
      - returns the post-reset (used, limit, resets_at) snapshot.

    Pre-decision: this is the "read state" half of the quota machine.
    Increment happens only after a successful LLM reply, in
    `increment_quota`.
    """
    if today is None:
        today = datetime.now(timezone.utc).date()
    limit = get_quota_limit(rarity_tier)

    # ON CONFLICT DO UPDATE so a stale `quota_date` is reset in a single
    # round-trip; RETURNING surfaces the post-reset count without a
    # second SELECT.
    cur.execute(
        """
        INSERT INTO nx_souls_quota (token_id, quota_date, messages_today, updated_at)
        VALUES (%s, %s, 0, NOW())
        ON CONFLICT (token_id) DO UPDATE
           SET messages_today = CASE
                  WHEN nx_souls_quota.quota_date < EXCLUDED.quota_date THEN 0
                  ELSE nx_souls_quota.messages_today
               END,
               quota_date = GREATEST(nx_souls_quota.quota_date, EXCLUDED.quota_date),
               updated_at = NOW()
        RETURNING messages_today, quota_date
        """,
        (token_id, today),
    )
    row = cur.fetchone()
    used = int(row["messages_today"]) if row else 0
    resets_at = next_utc_midnight()
    return QuotaState(used=used, limit=limit, resets_at=resets_at)


def increment_quota(cur, token_id: int) -> int:
    """Atomically increment `messages_today` and return the new value.

    Called *after* a successful LLM reply only. Assumes the row exists
    (created by `get_quota_state` earlier in the same request).
    """
    cur.execute(
        """
        UPDATE nx_souls_quota
           SET messages_today = messages_today + 1,
               last_message_at = NOW(),
               updated_at = NOW()
         WHERE token_id = %s
        RETURNING messages_today
        """,
        (token_id,),
    )
    row = cur.fetchone()
    return int(row["messages_today"]) if row else 0
