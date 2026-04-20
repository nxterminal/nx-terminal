"""NX Market lifecycle jobs.

Runs on the engine tick. Two sibling jobs:

- ``auto_close_expired_markets`` — flips active → closed when close_at
  has passed. Admin still picks the outcome afterwards.
- ``auto_timeout_invalid_markets`` — after ``TIMEOUT_DAYS`` in the
  closed state without admin action, auto-resolves the market as
  'invalid' (refunds every bettor their cost basis). Prevents orphan
  markets from sitting in closed state forever.

Both are idempotent.
"""

from __future__ import annotations

import logging

from backend.api.deps import get_db
from backend.services.admin_log import log_event as admin_log_event


log = logging.getLogger(__name__)


# Sentinel recorded in nxmarket_markets.resolved_by for auto-timeout
# rows. Fits VARCHAR(42) and makes manual vs system-driven resolves
# distinguishable in queries without a separate enum.
AUTO_TIMEOUT_SENTINEL = "0x0000000000000000000000000000000000000000"

# How many days a market can sit in 'closed' before the job auto-
# resolves it as 'invalid'.
TIMEOUT_DAYS = 30


def auto_close_expired_markets() -> int:
    """Flip active markets whose close_at has passed to 'closed'.

    Returns the number of rows affected. Safe to call from any worker
    on any cadence — the UPDATE is conditional on status='active'.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE nxmarket_markets
                   SET status = 'closed'
                 WHERE status = 'active'
                   AND close_at <= NOW()
                RETURNING id, question, close_at
                """,
            )
            rows = cur.fetchall()

            for row in rows:
                admin_log_event(
                    cur,
                    event_type="nxmarket_auto_closed",
                    payload={
                        "market_id": int(row["id"]),
                        "question": row["question"],
                        "closed_at": row["close_at"].isoformat()
                                     if row["close_at"] else None,
                    },
                )

    if rows:
        log.info(
            "nxmarket.auto_close: closed %s market(s)", len(rows)
        )
    return len(rows)


def auto_timeout_invalid_markets() -> int:
    """Resolve closed-but-unresolved markets as 'invalid' after
    TIMEOUT_DAYS. Refunds all bettors their cost basis; no treasury
    fee, no creator commission (same semantics as manual invalid).

    Runs on its own cadence (hourly — timeouts are 30-day decisions
    so minute-level freshness isn't needed).

    Returns the number of markets timed out this run. Any single
    market's failure (e.g. a bettor owns no devs — NoDevsError) is
    logged and skipped; the job proceeds with the rest of the batch.
    """
    # Local import: _resolve_invalid lives in the routes module and
    # pulling it at module-load time would create an import cycle via
    # backend.api.routes.admin.
    from backend.api.routes.nxmarket import _resolve_invalid

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, question, close_at, market_type, created_by
                  FROM nxmarket_markets
                 WHERE status = 'closed'
                   AND close_at <= NOW() - (%s || ' days')::INTERVAL
                 ORDER BY close_at ASC
                 LIMIT 100
                """,
                (str(TIMEOUT_DAYS),),
            )
            expired = cur.fetchall()

            succeeded = 0
            for market in expired:
                try:
                    _resolve_invalid(cur, market, AUTO_TIMEOUT_SENTINEL)
                    admin_log_event(
                        cur,
                        event_type="nxmarket_auto_timeout",
                        payload={
                            "market_id": int(market["id"]),
                            "question": market["question"],
                            "close_at": market["close_at"].isoformat()
                                        if market["close_at"] else None,
                            "timeout_days": TIMEOUT_DAYS,
                            "market_type": market["market_type"],
                        },
                    )
                    succeeded += 1
                except Exception as exc:  # noqa: BLE001
                    log.error(
                        "nxmarket.auto_timeout: market=%s failed err=%s",
                        market["id"], exc,
                    )
                    # Continue — don't break the batch.

    if succeeded:
        log.info(
            "nxmarket.auto_timeout: resolved %s market(s) as invalid",
            succeeded,
        )
    return succeeded
