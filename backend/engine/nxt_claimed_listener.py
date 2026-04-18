"""Polling listener for the NXDevNFT ``NXTClaimed`` event.

Without this worker, claims made directly against the contract
(bypassing the frontend's ``POST /record-claim`` call) are invisible
to the backend. This listener fetches ``eth_getLogs`` on a schedule,
parses each matching event with the shared parser from PR 2.2, and
inserts missing rows into ``claim_history``. The UNIQUE index on
``tx_hash`` (also PR 2.2) makes the insert idempotent — duplicates
from either source are silently dropped.

Runs as a daemon thread inside ``backend.engine.run_all`` alongside
the existing on-chain Transfer listener and the sync reconciler.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


try:
    from backend.services.signer import SignerError, get_signer
    from backend.services.event_parser import (
        NXT_CLAIMED_TOPIC,
        parse_nxt_claimed_event,
    )
    from backend.services.admin_log import log_event as admin_log_event
    from backend.services.logging_helpers import log_info, log_warning, log_error
except ImportError:  # engine may run with backend.services stripped
    SignerError = Exception  # type: ignore
    get_signer = None  # type: ignore
    NXT_CLAIMED_TOPIC = None  # type: ignore
    parse_nxt_claimed_event = None  # type: ignore
    admin_log_event = None  # type: ignore
    log_info = log_warning = log_error = None  # type: ignore


NXDEVNFT_ADDRESS = os.getenv(
    "NXDEVNFT_ADDRESS",
    "0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7",
).lower()

POLL_INTERVAL_SECONDS = int(os.getenv("NXT_LISTENER_POLL_INTERVAL", "15"))
# MegaETH hits 100M gas/s; batching >500 blocks per poll risks RPC timeouts.
MAX_BLOCKS_PER_POLL = int(os.getenv("NXT_LISTENER_MAX_BLOCKS", "500"))
# Skip the latest few blocks so we're only reading from a (mostly) settled state.
CONFIRMATIONS_REQUIRED = int(os.getenv("NXT_LISTENER_CONFIRMATIONS", "2"))
CHECKPOINT_KEY = "nxt_claimed_listener_last_block"


# ----------------------------------------------------------------------
# Checkpoint helpers — piggyback on the existing simulation_state table
# ----------------------------------------------------------------------


def get_last_processed_block(cursor) -> Optional[int]:
    cursor.execute(
        "SELECT value FROM simulation_state WHERE key = %s",
        (CHECKPOINT_KEY,),
    )
    row = cursor.fetchone()
    if not row:
        return None
    value = row[0] if not isinstance(row, dict) else row.get("value")
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(json.loads(value))
        except Exception:
            return None
    return None


def save_last_processed_block(cursor, block_number: int) -> None:
    cursor.execute(
        """
        INSERT INTO simulation_state (key, value) VALUES (%s, %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """,
        (CHECKPOINT_KEY, json.dumps(block_number)),
    )


# ----------------------------------------------------------------------
# Ingestion
# ----------------------------------------------------------------------


def process_nxt_claimed_event(conn, event: Dict[str, Any], tx_hash: str) -> bool:
    """Insert ``event`` into ``claim_history`` if absent. Returns True on insert."""
    wallet = (event.get("user") or "").lower()
    if not wallet:
        return False

    wei = 10 ** 18
    gross_nxt = int(event.get("gross", 0)) // wei
    net_nxt = int(event.get("net", 0)) // wei
    fee_nxt = int(event.get("fee", 0)) // wei
    block = int(event.get("block_number", 0))

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO claim_history
                (player_address, amount_gross, amount_net, fee_amount,
                 tx_hash, tx_block, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'confirmed')
            ON CONFLICT (tx_hash)
                WHERE tx_hash IS NOT NULL AND tx_hash <> ''
                DO NOTHING
            RETURNING id
            """,
            (wallet, gross_nxt, net_nxt, fee_nxt, tx_hash, block),
        )
        inserted = cur.fetchone() is not None

        if inserted and admin_log_event:
            admin_log_event(
                cur,
                event_type="claim_history_backfilled_by_listener",
                wallet_address=wallet,
                payload={
                    "tx_hash": tx_hash,
                    "tx_block": block,
                    "amount_net": net_nxt,
                    "source": "nxt_claimed_listener",
                },
            )
        conn.commit()
        return inserted


def run_listener_once(conn, signer) -> int:
    """One iteration of the poll loop. Returns the number of rows inserted."""
    if parse_nxt_claimed_event is None:
        return 0

    with conn.cursor() as cur:
        last_block = get_last_processed_block(cur)

    # First run: jump straight to the head so we don't scan from genesis.
    try:
        head = int(signer._rpc_call("eth_blockNumber", []), 16)  # noqa: SLF001
    except SignerError as exc:
        if log_warning:
            log_warning(logger, "nxt_listener.rpc_error", error=str(exc))
        return 0

    if last_block is None:
        with conn.cursor() as cur:
            save_last_processed_block(cur, head)
            conn.commit()
        if log_info:
            log_info(
                logger, "nxt_listener.checkpoint_initialised", head=head,
            )
        return 0

    safe_head = head - CONFIRMATIONS_REQUIRED
    if safe_head <= last_block:
        return 0

    to_block = min(safe_head, last_block + MAX_BLOCKS_PER_POLL)
    from_block = last_block + 1

    try:
        logs = signer._rpc_call(  # noqa: SLF001
            "eth_getLogs",
            [{
                "fromBlock": hex(from_block),
                "toBlock": hex(to_block),
                "address": NXDEVNFT_ADDRESS,
                "topics": [NXT_CLAIMED_TOPIC],
            }],
        ) or []
    except SignerError as exc:
        if log_warning:
            log_warning(
                logger, "nxt_listener.getlogs_error",
                from_block=from_block, to_block=to_block, error=str(exc),
            )
        return 0

    inserted = 0
    for entry in logs:
        try:
            event = parse_nxt_claimed_event([entry], NXDEVNFT_ADDRESS)
            if not event:
                continue
            tx_hash = (entry.get("transactionHash") or "").lower()
            if not tx_hash:
                continue
            if process_nxt_claimed_event(conn, event, tx_hash):
                inserted += 1
                if log_info:
                    log_info(
                        logger, "nxt_listener.claim_backfilled",
                        wallet=event["user"],
                        tx_hash=tx_hash,
                        block=event["block_number"],
                    )
        except Exception as exc:  # noqa: BLE001
            if log_error:
                log_error(
                    logger, "nxt_listener.process_error",
                    error=str(exc), log_entry=str(entry)[:200],
                )

    with conn.cursor() as cur:
        save_last_processed_block(cur, to_block)
        conn.commit()

    if inserted and log_info:
        log_info(
            logger, "nxt_listener.batch_processed",
            from_block=from_block, to_block=to_block, count=inserted,
        )
    return inserted


def run_listener_loop(
    get_conn: Callable,
    *,
    interval_seconds: int = POLL_INTERVAL_SECONDS,
    stop_event: Optional[object] = None,
) -> None:
    """Daemon-thread entrypoint. ``get_conn`` yields a psycopg2 connection."""
    if log_info:
        log_info(
            logger, "nxt_listener.loop_started",
            interval=interval_seconds,
            address=NXDEVNFT_ADDRESS,
        )

    if get_signer is None:
        logger.warning("nxt_listener.signer_unavailable — loop will not start")
        return

    signer = get_signer()

    while True:
        try:
            with get_conn() as conn:
                run_listener_once(conn, signer)
        except Exception as exc:  # noqa: BLE001
            logger.error("nxt_listener.loop_error error=%s", exc)
        if stop_event is not None and getattr(stop_event, "is_set", lambda: False)():
            break
        time.sleep(interval_seconds)
