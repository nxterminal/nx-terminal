"""Structured-logging helpers for economic flows.

log_event(logger, level, "claim_sync.tx_sent", tx_hash=..., count=3) emits
a single logfmt-style line with the current request correlation_id appended.
The output is still a plain log record, so existing handlers (uvicorn,
Render) continue to work unchanged.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.api.middleware.correlation import get_correlation_id


def _format_value(value: Any) -> str:
    if value is None:
        return "none"
    if isinstance(value, bool):
        return "true" if value else "false"
    text = str(value)
    if any(ch in text for ch in (" ", "\t", "\n", "\"")):
        escaped = text.replace("\\", "\\\\").replace("\"", "\\\"")
        return f"\"{escaped}\""
    return text


def _render(event: str, fields: dict) -> str:
    parts = [event]
    for key, value in fields.items():
        parts.append(f"{key}={_format_value(value)}")
    parts.append(f"correlation_id={_format_value(get_correlation_id())}")
    return " ".join(parts)


def log_event(
    logger: logging.Logger,
    level: str,
    event: str,
    **fields: Any,
) -> None:
    """Emit a structured log record at ``level``.

    ``level`` is the lowercase name of the Logger method to call
    (``info``, ``warning``, ``error``, ``debug``, ``critical``).
    """
    emit = getattr(logger, level, None)
    if emit is None:
        emit = logger.info
    emit(_render(event, fields))


def log_info(logger: logging.Logger, event: str, **fields: Any) -> None:
    log_event(logger, "info", event, **fields)


def log_warning(logger: logging.Logger, event: str, **fields: Any) -> None:
    log_event(logger, "warning", event, **fields)


def log_error(logger: logging.Logger, event: str, **fields: Any) -> None:
    log_event(logger, "error", event, **fields)


def log_debug(logger: logging.Logger, event: str, **fields: Any) -> None:
    log_event(logger, "debug", event, **fields)
