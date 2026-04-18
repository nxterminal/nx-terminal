"""Hourly job that compares ``nxt_ledger`` against the live balances.

During shadow mode (Fase 3A) the ledger is empty, so this job reports
divergences against essentially every wallet — that's expected and
will shrink to zero as Fases 3B/3C/3D land. The reconciler **only
logs** discrepancies; it never adjusts balances. Once divergences are
clean for two weeks (per the roadmap) the ledger graduates to source
of truth.
"""

from __future__ import annotations

import logging
import time
from typing import Callable, Optional

try:
    from backend.services.admin_log import log_event as admin_log_event
    from backend.services.logging_helpers import log_info, log_warning
except ImportError:  # engine may run with backend.services stripped
    admin_log_event = None  # type: ignore
    log_info = log_warning = None  # type: ignore


logger = logging.getLogger(__name__)


RECONCILE_INTERVAL_SECONDS = 3600  # 1 hour
MAX_DIVERGENCES_TO_LOG = 100
TOP_DIVERGENCES_IN_PAYLOAD = 10


def _row_value(row, key, idx):
    if isinstance(row, dict):
        return row.get(key)
    return row[idx]


def reconcile_ledger(conn) -> dict:
    """Compare ``SUM(delta_nxt)`` per wallet vs ``devs.balance_nxt + players.balance_claimed``.

    Returns ``{"divergences_found": N, "total_wallets_checked": N}``.
    Side effect: writes one ``admin_logs`` row when divergences exist.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            WITH ledger_totals AS (
                SELECT wallet_address, SUM(delta_nxt) AS ledger_sum
                FROM nxt_ledger
                GROUP BY wallet_address
            ),
            player_totals AS (
                SELECT
                    LOWER(p.wallet_address) AS wallet_address,
                    COALESCE(SUM(d.balance_nxt), 0)
                        + COALESCE(p.balance_claimed, 0) AS actual_total
                FROM players p
                LEFT JOIN devs d ON LOWER(d.owner_address) = LOWER(p.wallet_address)
                GROUP BY LOWER(p.wallet_address), p.balance_claimed
            )
            SELECT
                COALESCE(l.wallet_address, p.wallet_address) AS wallet,
                COALESCE(l.ledger_sum, 0)                    AS ledger_sum,
                COALESCE(p.actual_total, 0)                  AS actual_total,
                COALESCE(l.ledger_sum, 0) - COALESCE(p.actual_total, 0) AS divergence
            FROM ledger_totals l
            FULL OUTER JOIN player_totals p USING (wallet_address)
            WHERE COALESCE(l.ledger_sum, 0) <> COALESCE(p.actual_total, 0)
            ORDER BY ABS(COALESCE(l.ledger_sum, 0) - COALESCE(p.actual_total, 0)) DESC
            LIMIT %s
            """,
            (MAX_DIVERGENCES_TO_LOG,),
        )
        divergences = cur.fetchall()

        cur.execute(
            """
            SELECT COUNT(DISTINCT wallet_address) AS n FROM (
                SELECT wallet_address FROM nxt_ledger
                UNION
                SELECT LOWER(wallet_address) FROM players
            ) u
            """
        )
        total_row = cur.fetchone()
        total_checked = int(_row_value(total_row, "n", 0) or 0)

    if divergences:
        total_abs = sum(abs(int(_row_value(r, "divergence", 3))) for r in divergences)

        if log_warning:
            log_warning(
                logger, "ledger_reconciler.divergences_found",
                count=len(divergences),
                total_wallets=total_checked,
                total_abs_divergence=total_abs,
            )

        if admin_log_event:
            with conn.cursor() as cur:
                admin_log_event(
                    cur,
                    event_type="ledger_reconciliation_divergences",
                    payload={
                        "count": len(divergences),
                        "total_wallets_checked": total_checked,
                        "total_abs_divergence": total_abs,
                        "top_divergences": [
                            {
                                "wallet": _row_value(r, "wallet", 0),
                                "ledger_sum": int(_row_value(r, "ledger_sum", 1) or 0),
                                "actual_total": int(_row_value(r, "actual_total", 2) or 0),
                                "divergence": int(_row_value(r, "divergence", 3) or 0),
                            }
                            for r in divergences[:TOP_DIVERGENCES_IN_PAYLOAD]
                        ],
                    },
                )
            conn.commit()
    else:
        if log_info:
            log_info(
                logger, "ledger_reconciler.clean",
                total_wallets=total_checked,
            )

    return {
        "divergences_found": len(divergences),
        "total_wallets_checked": total_checked,
    }


def run_reconciler_loop(
    get_conn: Callable,
    *,
    interval_seconds: int = RECONCILE_INTERVAL_SECONDS,
    stop_event: Optional[object] = None,
) -> None:
    """Daemon-thread entrypoint. ``get_conn`` yields a psycopg2 connection."""
    if log_info:
        log_info(
            logger, "ledger_reconciler.loop_started",
            interval=interval_seconds,
        )
    while True:
        try:
            with get_conn() as conn:
                reconcile_ledger(conn)
        except Exception as exc:  # noqa: BLE001
            logger.error("ledger_reconciler.loop_error error=%s", exc)
        if stop_event is not None and getattr(stop_event, "is_set", lambda: False)():
            break
        time.sleep(interval_seconds)
