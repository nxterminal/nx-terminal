"""Routes: Simulation state & world events"""

import os
import logging
from fastapi import APIRouter, HTTPException
from backend.api.deps import fetch_one, fetch_all

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


@router.post("/claim-sync/force")
async def force_claim_sync():
    """Force an immediate claim sync run (bypasses scheduler timer)."""
    try:
        from backend.engine.claim_sync import sync_claimable_balances
        log.info("[CLAIM_SYNC] Manual force sync triggered via API")
        result = sync_claimable_balances()
        return {"success": True, "result": result or "ok"}
    except Exception as e:
        log.error("[CLAIM_SYNC] Force sync failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
