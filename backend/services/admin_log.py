"""Append-only audit log for economic events.

``log_event(cursor, event_type, ...)`` inserts a row into ``admin_logs``
using the caller's cursor so the insert participates in the caller's
transaction. If the endpoint rolls back, the audit row rolls back too.

Never raises: any failure (missing table, serialisation bug, closed
cursor) is swallowed with a warning log so audit persistence can never
take down a real money-moving endpoint.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Mapping, Optional

from backend.api.middleware.correlation import get_correlation_id, NO_CORRELATION

_logger = logging.getLogger(__name__)


def log_event(
    cursor,
    event_type: str,
    wallet_address: Optional[str] = None,
    dev_token_id: Optional[int] = None,
    payload: Optional[Mapping[str, Any]] = None,
) -> None:
    """Insert a row in admin_logs. Caller owns the commit."""
    try:
        cid = get_correlation_id()
        if cid == NO_CORRELATION:
            cid = None

        wallet = wallet_address.lower() if wallet_address else None
        payload_json = json.dumps(dict(payload)) if payload is not None else None

        cursor.execute(
            """
            INSERT INTO admin_logs
              (correlation_id, event_type, wallet_address, dev_token_id, payload)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (cid, event_type, wallet, dev_token_id, payload_json),
        )
    except Exception as exc:  # noqa: BLE001
        _logger.warning(
            "admin_log.insert_failed event=%s error=%s",
            event_type,
            exc,
        )
