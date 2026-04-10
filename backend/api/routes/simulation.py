"""Routes: Simulation state & world events"""

import os
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from backend.api.deps import fetch_one, fetch_all, get_db

log = logging.getLogger("nx_api")

router = APIRouter()


@router.get("/state")
async def get_simulation_state():
    """Get current simulation state (all key-value pairs)."""
    rows = fetch_all("SELECT key, value FROM simulation_state")
    return {row["key"]: row["value"] for row in rows}


@router.get("/stats")
async def get_simulation_stats():
    """Get aggregate simulation statistics."""
    stats = fetch_one("""
        SELECT
            COUNT(*) as total_devs,
            COUNT(*) FILTER (WHERE status = 'active') as active_devs,
            COALESCE(SUM(balance_nxt), 0) as total_nxt_in_wallets,
            COALESCE(SUM(protocols_created), 0) as total_protocols,
            COALESCE(SUM(ais_created), 0) as total_ais,
            COALESCE(AVG(energy), 0) as avg_energy,
            COALESCE(AVG(reputation), 0) as avg_reputation
        FROM devs
    """)
    protocol_count = fetch_one("SELECT COUNT(*) as c FROM protocols WHERE status = 'active'")
    ai_count = fetch_one("SELECT COUNT(*) as c FROM absurd_ais")

    return {
        **stats,
        "active_protocols": protocol_count["c"],
        "total_absurd_ais": ai_count["c"],
    }


@router.get("/events")
async def get_world_events(active_only: bool = True):
    """Get world events."""
    if active_only:
        return fetch_all(
            "SELECT * FROM world_events WHERE is_active = TRUE ORDER BY starts_at DESC"
        )
    return fetch_all("SELECT * FROM world_events ORDER BY starts_at DESC LIMIT 50")


@router.get("/feed")
async def get_action_feed(limit: int = 50, offset: int = 0):
    """Get recent actions across all devs."""
    if limit > 100:
        limit = 100
    return fetch_all(
        """SELECT id, dev_id, dev_name, archetype, action_type, details,
                  energy_cost, nxt_cost, created_at
           FROM actions
           ORDER BY created_at DESC
           LIMIT %s OFFSET %s""",
        (limit, offset)
    )


@router.get("/claim-sync-status")
async def get_claim_sync_status():
    """Health check for the claim sync pipeline."""
    pending = fetch_one(
        "SELECT COUNT(*) as count, COALESCE(SUM(balance_nxt), 0) as total_nxt FROM devs WHERE status = 'active' AND balance_nxt > 0"
    )
    signer_configured = bool(os.getenv("BACKEND_SIGNER_PRIVATE_KEY", ""))
    dry_run = os.getenv("DRY_RUN", "true").lower() != "false"

    # Get last sync info from engine (if running in same process)
    last_sync_at = None
    last_result = None
    try:
        from backend.engine.engine import get_claim_sync_status
        status = get_claim_sync_status()
        last_sync_at = status.get("last_sync_at")
        last_result = status.get("last_result")
    except (ImportError, Exception):
        pass

    return {
        "signer_configured": signer_configured,
        "dry_run": dry_run,
        "last_sync_at": last_sync_at,
        "last_result": last_result,
        "pending_claims": pending["count"],
        "pending_nxt": pending["total_nxt"],
    }


ADMIN_WALLETS = {
    "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b",  # admin
}


@router.post("/claim-sync/force")
async def force_claim_sync(request: Request):
    """Force an immediate claim sync run (bypasses scheduler timer).

    Accepts optional { token_ids: [29572, 13535, ...] } to sync only
    specific devs (for partial claims).  Returns structured result with
    tx_hash when available.
    """
    try:
        from backend.engine.claim_sync import sync_claimable_balances

        # Parse body
        body = {}
        try:
            body = await request.json() or {}
        except Exception:
            pass

        # Auth: require admin wallet
        wallet = (body.get("wallet_address") or body.get("wallet") or "").strip().lower()
        if wallet not in ADMIN_WALLETS:
            raise HTTPException(403, "Unauthorized: admin wallet required")

        filter_ids = None
        if isinstance(body.get("token_ids"), list):
            filter_ids = [int(t) for t in body["token_ids"]]
            log.info("[CLAIM_SYNC] Admin force sync for %d specific devs", len(filter_ids))
        else:
            log.info("[CLAIM_SYNC] Admin force sync triggered via API (all devs)")

        with get_db() as conn:
            # wait_for_receipt=False: return immediately after TX is sent
            # MegaETH confirms in <1s, and Render has a 30s HTTP timeout
            result = sync_claimable_balances(
                db_conn=conn,
                filter_token_ids=filter_ids,
                wait_for_receipt=False,
            )

        # Result is a dict when TX was sent, or a string for dry_run/no_pending/errors
        if isinstance(result, dict):
            ok = result.get("status") == "ok"
            return {
                "success": ok,
                "synced": result.get("synced", 0),
                "total": result.get("total", 0),
                "tx_hash": result.get("tx_hash"),
                "result": result.get("status", "unknown"),
            }

        # String results (dry_run, no_pending, error_*)
        is_error = isinstance(result, str) and result.startswith("error")
        return {
            "success": not is_error,
            "result": result or "ok",
            "tx_hash": None,
        }
    except Exception as e:
        log.error("[CLAIM_SYNC] Force sync failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
