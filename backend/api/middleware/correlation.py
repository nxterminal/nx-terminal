"""Correlation ID middleware for request tracing.

Every HTTP request gets a UUID correlation_id (or honours an inbound
X-Correlation-ID header) that is stashed in a ContextVar so any log
emitted during that request can pick it up without threading the id
through function signatures. The id is echoed back in the response
X-Correlation-ID header so a caller can link client-side and
server-side logs.

Non-HTTP callers (the engine tick loop, the claim-sync worker) use
set_correlation_id() / reset_correlation_id() directly to scope a
batch of logs to one correlation id.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


HEADER_NAME = "X-Correlation-ID"
NO_CORRELATION = "no-correlation"

correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    """Return the current correlation id, or a sentinel if none is set."""
    return correlation_id_ctx.get() or NO_CORRELATION


def set_correlation_id(cid: Optional[str] = None):
    """Set the current correlation id. Returns the reset token for later cleanup."""
    if not cid:
        cid = str(uuid.uuid4())
    return correlation_id_ctx.set(cid)


def reset_correlation_id(token) -> None:
    """Reset the ContextVar using a token from set_correlation_id()."""
    correlation_id_ctx.reset(token)


def new_correlation_id() -> str:
    """Generate a fresh correlation id without setting it in the ContextVar."""
    return str(uuid.uuid4())


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Populate correlation_id on every HTTP request."""

    async def dispatch(self, request: Request, call_next):
        inbound = request.headers.get(HEADER_NAME)
        cid = inbound if inbound else str(uuid.uuid4())
        token = correlation_id_ctx.set(cid)
        request.state.correlation_id = cid
        try:
            response = await call_next(request)
        finally:
            correlation_id_ctx.reset(token)
        response.headers[HEADER_NAME] = cid
        return response
