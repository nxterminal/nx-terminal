"""NX Market lifecycle jobs.

Runs on the engine tick. The single job here, ``auto_close_expired_markets``,
flips markets from 'active' → 'closed' once their ``close_at`` has
passed. It does NOT resolve — admin still has to pick the outcome
manually (including 'invalid' which triggers refunds).

Idempotent: the WHERE clause bounds the update to still-active rows,
so running the job multiple times has no additional effect.
"""

from __future__ import annotations

import logging

from backend.api.deps import get_db
from backend.services.admin_log import log_event as admin_log_event


log = logging.getLogger(__name__)


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
