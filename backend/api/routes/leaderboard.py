"""Routes: Leaderboard"""

from fastapi import APIRouter, Query
from backend.api.deps import fetch_all, fetch_one, execute

router = APIRouter()


@router.get("")
async def get_leaderboard(
    # 'reputation' kept for back-compat. The Leaderboard window no
    # longer renders a "By Reputation" tab as of Phase 5.11 — if you
    # need to fully retire this path, search for the regex pattern
    # first and confirm no caller depends on it.
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


@router.get("/top-hackers")
async def get_top_hackers(limit: int = Query(50, le=200)):
    """Rank wallets by total successful hacks across all owned devs.

    "Successful hack" = an action row of type HACK_RAID OR
    HACK_MAINFRAME with `details->>'success' = 'true'`. Both
    action_types share the same `{"success": <bool>, ...}` shape so a
    single filter spans them.

    contributing_devs = how many distinct devs owned by the wallet
    landed at least one successful hack. Useful signal to differentiate
    "one prolific dev" from "wide hacker fleet"."""
    return fetch_all(
        """
        SELECT
            LOWER(d.owner_address)                AS wallet,
            COUNT(*)                              AS hacks_successful,
            COUNT(DISTINCT a.dev_id)              AS contributing_devs
        FROM actions a
        JOIN devs d ON d.token_id = a.dev_id
        WHERE a.action_type IN ('HACK_RAID', 'HACK_MAINFRAME')
          AND (a.details->>'success')::boolean = TRUE
          AND d.owner_address IS NOT NULL
          AND d.owner_address <> ''
        GROUP BY LOWER(d.owner_address)
        ORDER BY hacks_successful DESC, contributing_devs DESC
        LIMIT %s
        """,
        (limit,),
    )


@router.get("/nxt-holders")
async def get_nxt_holders(limit: int = Query(50, le=200)):
    """Rank wallets by on-chain $NXT balance.

    Reads from nxt_holder_snapshot, populated every 5min by
    services.nxt_snapshot.run_nxt_snapshot_tick. Returns the snapshot's
    max(updated_at) alongside the rows so the UI can render the
    "Updated Xmin ago" footer without a second round-trip.

    Balances are NUMERIC(78,0) in DB; serialised as strings so
    JavaScript Number imprecision doesn't truncate the high tail.
    """
    holders = fetch_all(
        """
        SELECT wallet,
               balance::TEXT AS balance,
               updated_at
        FROM nxt_holder_snapshot
        ORDER BY balance DESC
        LIMIT %s
        """,
        (limit,),
    )
    snapshot_age = fetch_one(
        "SELECT MAX(updated_at) AS updated_at FROM nxt_holder_snapshot",
        (),
    )
    return {
        "holders": holders,
        "snapshot_updated_at": snapshot_age["updated_at"] if snapshot_age else None,
    }


@router.get("/dev-collectors")
async def get_dev_collectors(limit: int = Query(50, le=200)):
    """Rank wallets by Dev (aNFT) count. Pure DB read — ownership in
    the devs table is the source of truth, no on-chain pull needed."""
    return fetch_all(
        """
        SELECT
            LOWER(owner_address) AS wallet,
            COUNT(*)             AS dev_count
        FROM devs
        WHERE owner_address IS NOT NULL AND owner_address <> ''
        GROUP BY LOWER(owner_address)
        ORDER BY dev_count DESC
        LIMIT %s
        """,
        (limit,),
    )


@router.post("/refresh")
async def refresh_leaderboard():
    """Manually refresh the materialized view (normally done by engine)."""
    try:
        execute("REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard")
        return {"status": "refreshed"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
