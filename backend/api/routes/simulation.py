"""Routes: Simulation state & world events"""

from fastapi import APIRouter, HTTPException
from backend.api.deps import fetch_one, fetch_all

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
