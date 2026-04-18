"""Background worker that finalises stuck ``sync_status='syncing'`` rows.

When ``sync_claimable_balances`` runs in async mode (the API path with
``wait_for_receipt=False``) or the receipt poll inside the sync
function times out, the devs stay in the ``'syncing'`` state with
``sync_tx_hash`` populated. This reconciler polls the RPC for those
tx hashes on an interval and calls ``_finalize_success`` /
``_finalize_failed`` once the chain gives an answer.

Runs as a daemon thread inside ``backend.engine.run_all`` so the API
doesn't have to wait for confirmations.
"""

from __future__ import annotations

import logging
import time
from typing import Callable, List, Optional

from backend.engine.claim_sync import (
    _finalize_failed,
    _finalize_success,
)

try:
    from backend.services.signer import SignerError, get_signer
    from backend.services.logging_helpers import log_info, log_warning
except ImportError:  # engine may run with backend.services stripped
    SignerError = Exception  # type: ignore
    get_signer = None  # type: ignore
    log_info = log_warning = None  # type: ignore


logger = logging.getLogger(__name__)


RECONCILE_INTERVAL_SECONDS = 60
# Devs syncing for less than this probably have an in-flight poll on
# the main path — let that finish before stepping in.
STUCK_THRESHOLD_SECONDS = 30


def _find_stuck_txs(db_conn, threshold_seconds: int) -> List[tuple]:
    """Return ``[(tx_hash, [token_ids])]`` for stuck syncing rows."""
    cursor = db_conn.cursor()
    cursor.execute(
        """
        SELECT sync_tx_hash, ARRAY_AGG(token_id) AS token_ids
        FROM nx.devs
        WHERE sync_status = 'syncing'
          AND sync_tx_hash IS NOT NULL
          AND sync_started_at < NOW() - make_interval(secs => %s)
        GROUP BY sync_tx_hash
        """,
        (threshold_seconds,),
    )
    rows = cursor.fetchall()
    out: List[tuple] = []
    for row in rows:
        if isinstance(row, dict):
            out.append((row["sync_tx_hash"], list(row["token_ids"])))
        else:
            out.append((row[0], list(row[1])))
    return out


def reconcile_pending_syncs(
    db_conn,
    *,
    threshold_seconds: int = STUCK_THRESHOLD_SECONDS,
) -> int:
    """Finalise every stuck tx we can confirm from the chain.

    Returns the number of devs transitioned out of 'syncing'.
    """
    if get_signer is None:
        logger.warning("sync_reconciler.signer_unavailable")
        return 0

    stuck = _find_stuck_txs(db_conn, threshold_seconds)
    if not stuck:
        return 0

    if log_info:
        log_info(logger, "sync_reconciler.stuck_txs_found", count=len(stuck))

    signer = get_signer()
    resolved_total = 0

    for tx_hash, token_ids in stuck:
        try:
            receipt = signer._rpc_call(  # noqa: SLF001 — intentional reuse
                "eth_getTransactionReceipt", [tx_hash],
            )
        except SignerError as exc:
            if log_warning:
                log_warning(
                    logger,
                    "sync_reconciler.rpc_error",
                    tx_hash=tx_hash,
                    error=str(exc),
                )
            continue

        if not receipt:
            # Still pending — come back next pass.
            continue

        status = receipt.get("status")
        if status == "0x1":
            _finalize_success(db_conn, token_ids, tx_hash)
            resolved_total += len(token_ids)
            if log_info:
                log_info(
                    logger, "sync_reconciler.confirmed",
                    tx_hash=tx_hash, count=len(token_ids),
                )
        else:
            _finalize_failed(db_conn, token_ids, tx_hash, reason="reverted")
            resolved_total += len(token_ids)
            if log_warning:
                log_warning(
                    logger, "sync_reconciler.reverted",
                    tx_hash=tx_hash, count=len(token_ids),
                )

    return resolved_total


def run_reconciler_loop(
    get_conn: Callable,
    *,
    interval_seconds: int = RECONCILE_INTERVAL_SECONDS,
    stop_event: Optional[object] = None,
) -> None:
    """Daemon-thread entry point.

    ``get_conn`` should be a callable (usually ``engine.get_db``)
    returning a context manager yielding a psycopg2 connection. A
    thread-friendly ``stop_event`` (``threading.Event``-like) can be
    passed by tests to exit the loop cleanly.
    """
    if log_info:
        log_info(
            logger, "sync_reconciler.loop_started",
            interval=interval_seconds,
        )
    while True:
        try:
            with get_conn() as conn:
                reconcile_pending_syncs(conn)
        except Exception as exc:  # noqa: BLE001
            logger.error("sync_reconciler.loop_error error=%s", exc)
        if stop_event is not None and getattr(stop_event, "is_set", lambda: False)():
            break
        time.sleep(interval_seconds)
