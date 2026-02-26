"""Routes: Leaderboard"""

from fastapi import APIRouter, Query
from backend.api.deps import fetch_all, execute

router = APIRouter()


@router.get("")
async def get_leaderboard(
    sort: str = Query("balance", pattern="^(balance|reputation)$"),
    limit: int = Query(50, le=200),
):
    """Get leaderboard. Uses materialized view for speed."""
    VIEW_ORDER = {"balance": "rank_balance", "reputation": "rank_reputation"}
    FALLBACK_ORDER = {"balance": "balance_nxt DESC", "reputation": "reputation DESC"}
    order = VIEW_ORDER[sort]          # safe — FastAPI regex guarantees key exists
    fallback = FALLBACK_ORDER[sort]

    try:
        return fetch_all(
            "SELECT * FROM leaderboard ORDER BY " + order + " ASC LIMIT %s",
            (limit,)
        )
    except Exception:
        # Fallback if materialized view not refreshed yet
        return fetch_all(
            "SELECT token_id, name, archetype, corporation, owner_address,"
            "       balance_nxt, reputation, protocols_created, ais_created, rarity_tier"
            " FROM devs WHERE status = 'active'"
            " ORDER BY " + fallback + " LIMIT %s",
            (limit,)
        )


@router.get("/corporations")
async def get_corporation_leaderboard():
    """Get aggregated corporation leaderboard."""
    return fetch_all("""
        SELECT corporation,
               COUNT(*) as total_devs,
               COALESCE(SUM(balance_nxt), 0) as total_balance,
               COALESCE(AVG(reputation), 0) as avg_reputation,
               COALESCE(SUM(protocols_created), 0) as total_protocols
        FROM devs WHERE status = 'active'
        GROUP BY corporation
        ORDER BY total_balance DESC
    """)


@router.post("/refresh")
async def refresh_leaderboard():
    """Manually refresh the materialized view (normally done by engine)."""
    try:
        execute("REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard")
        return {"status": "refreshed"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
