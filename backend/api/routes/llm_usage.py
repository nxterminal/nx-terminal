"""Routes: LLM usage admin — Phase 5.1.1.

Two read-only endpoints exposing the cost-tracking counters that
the router populates on every successful LLM call. Mounted under
/api/admin/llm-usage; no auth gate in the MVP because the data
is operational rather than sensitive (call counts and dollar
amounts, no message contents or PII). A future Phase 5.x can wrap
these in the admin-wallet check that other /api/admin routes use.

Endpoints:

  GET /api/admin/llm-usage?days=7
      Per-row usage for the last N days (max 30, default 7),
      newest first. Each row carries date / service / model /
      calls / tokens / cost / last_call_at.

  GET /api/admin/llm-usage/today
      Today-only summary grouped by service. Includes the
      configured daily ceiling and an `under_limit` flag the
      admin UI can colour-code without re-deriving the threshold
      math client-side.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from backend.api.deps import get_db
from backend.services import llm_cost

log = logging.getLogger("nx_api")

router = APIRouter()


@router.get("")
async def get_llm_usage(
    days: int = Query(7, ge=1, le=30, description="how many days of history"),
):
    """Per-row usage for the last N days. Useful for spotting cost
    spikes or model migrations. Internally backed by `get_recent_usage`
    which orders DESC by date so the newest day is first."""
    try:
        with get_db() as conn:
            rows = llm_cost.get_recent_usage(conn, days=days)
    except Exception as e:
        log.error("[llm-usage] read failed: %s", e)
        raise HTTPException(503, "llm-usage unavailable")
    return {"ok": True, "usage": rows}


@router.get("/today")
async def get_llm_usage_today():
    """Today-only summary grouped by service. The response always
    contains every configured service (even ones with zero calls)
    so the admin UI can render a stable row-set."""
    try:
        with get_db() as conn:
            summary = llm_cost.get_today_summary(conn)
    except Exception as e:
        log.error("[llm-usage] today failed: %s", e)
        raise HTTPException(503, "llm-usage unavailable")
    return {"ok": True, "today": summary}
