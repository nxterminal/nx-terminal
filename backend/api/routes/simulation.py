"""Routes: Simulation state & world events"""

import os
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from backend.api.deps import fetch_one, fetch_all, get_db, validate_wallet
from backend.services.logging_helpers import log_info
from backend.services.admin_log import log_event as admin_log_event

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
    """Get recent actions across ALL devs globally — no wallet filter.

    The Live Feed is a global group-chat where every minted dev from every
    player participates. LEFT JOIN devs (not INNER) so rows from deleted
    devs still surface. owner_address ships with each row so the frontend
    can align messages right (my devs) vs left (everyone else)."""
    if limit > 100:
        limit = 100
    return fetch_all(
        """SELECT a.id, a.dev_id, a.dev_name, a.archetype, a.action_type,
                  a.details, a.energy_cost, a.nxt_cost, a.created_at,
                  d.corporation, d.ipfs_hash, d.owner_address
           FROM actions a
           LEFT JOIN devs d ON d.token_id = a.dev_id
           ORDER BY a.created_at DESC
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
    "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc",  # treasury
}


@router.post("/claim-sync/force")
async def force_claim_sync(request: Request):
    """Force an immediate claim sync run (bypasses scheduler timer).

    Requires wallet_address in the body. For partial syncs every
    token_id must be owned by that wallet. Full sync (no token_ids)
    is restricted to ADMIN_WALLETS. Attempts to sync token_ids the
    caller does not own return 403 and are audited in admin_logs
    under event_type=claim_sync_auth_denied.
    """
    # Parse body. Request-validation failures (400/403) need to escape
    # the catch-all below, which otherwise converts them into 500s.
    body = {}
    try:
        body = await request.json() or {}
    except Exception:
        pass

    wallet = (body.get("wallet_address") or body.get("wallet") or "").strip().lower()
    if not wallet:
        raise HTTPException(400, "wallet_address required")
    # Format check: 0x + 40 hex chars. Raises 400 on bad input.
    wallet = validate_wallet(wallet)

    raw_token_ids = body.get("token_ids")
    filter_ids = None
    if isinstance(raw_token_ids, list):
        if not raw_token_ids:
            raise HTTPException(400, "token_ids list is empty")
        if len(raw_token_ids) > 200:
            raise HTTPException(400, "Too many token_ids (max 200)")
        try:
            filter_ids = [int(t) for t in raw_token_ids]
        except (TypeError, ValueError):
            raise HTTPException(400, "token_ids must be integers")

    client_ip = request.client.host if request.client else None
    is_admin = wallet in ADMIN_WALLETS

    # Ownership gate: partial sync must sync only wallet-owned devs.
    # Admins bypass so they can still force-sync on behalf of any wallet
    # when investigating support tickets.
    if filter_ids is not None and not is_admin:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM devs "
                    "WHERE token_id = ANY(%s) AND LOWER(owner_address) = %s",
                    (filter_ids, wallet),
                )
                owned = int(cur.fetchone()["n"])
                if owned != len(filter_ids):
                    admin_log_event(
                        cur,
                        event_type="claim_sync_auth_denied",
                        wallet_address=wallet,
                        payload={
                            "requested_token_ids": filter_ids,
                            "owned_count": owned,
                            "ip": client_ip,
                        },
                    )
                    # commit the audit row even though the request fails
                    conn.commit()
                    log.warning(
                        "[CLAIM_SYNC] auth denied wallet=%s requested=%d owned=%d ip=%s",
                        wallet, len(filter_ids), owned, client_ip,
                    )
                    raise HTTPException(
                        403,
                        "Not all token_ids belong to this wallet",
                    )

    # Full sync (no token_ids) requires admin.
    if filter_ids is None and not is_admin:
        raise HTTPException(403, "Full sync requires admin wallet")

    log.info(
        "[CLAIM_SYNC] Force sync mode=%s count=%s wallet=%s",
        "partial" if filter_ids else "full",
        len(filter_ids) if filter_ids else "all",
        wallet,
    )
    log_info(
        log,
        "claim_sync.force_requested",
        mode="partial" if filter_ids else "full",
        count=len(filter_ids) if filter_ids else None,
        wallet=wallet,
    )

    try:
        from backend.engine.claim_sync import sync_claimable_balances

        with get_db() as conn:
            with conn.cursor() as cur:
                admin_log_event(
                    cur,
                    event_type="claim_sync_requested",
                    wallet_address=wallet,
                    payload={
                        "token_ids": filter_ids,
                        "ip": client_ip,
                    },
                )

            # wait_for_receipt=False: return immediately after TX is sent
            # MegaETH confirms in <1s, and Render has a 30s HTTP timeout
            result = sync_claimable_balances(
                db_conn=conn,
                filter_token_ids=filter_ids,
                wait_for_receipt=False,
            )

            if isinstance(result, dict) and result.get("tx_hash"):
                with conn.cursor() as cur:
                    admin_log_event(
                        cur,
                        event_type="claim_sync_tx_sent",
                        wallet_address=wallet,
                        payload={
                            "tx_hash": result.get("tx_hash"),
                            "count": result.get("synced", 0),
                            "total": result.get("total", 0),
                        },
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
    except HTTPException:
        raise
    except Exception as e:
        log.error("[CLAIM_SYNC] Force sync failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
