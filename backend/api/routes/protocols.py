"""Routes: Protocol market"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.api.deps import fetch_one, fetch_all

router = APIRouter()


@router.get("")
async def list_protocols(
    limit: int = Query(20, le=100),
    offset: int = 0,
    status: str = "active",
    sort: str = Query("value", pattern="^(value|investors|recent|quality)$"),
):
    """List protocols from the market."""
    SORT_MAP = {
        "value": "p.value DESC",
        "investors": "p.investor_count DESC",
        "recent": "p.created_at DESC",
        "quality": "p.code_quality DESC",
    }
    order = SORT_MAP[sort]  # safe — FastAPI regex guarantees key exists

    return fetch_all(
        "SELECT p.id, p.name, p.description, p.code_quality, p.value,"
        "       p.investor_count, p.total_invested, p.status,"
        "       d.name as creator_name, d.archetype as creator_archetype,"
        "       p.created_at"
        " FROM protocols p"
        " JOIN devs d ON d.token_id = p.creator_dev_id"
        " WHERE p.status = %s"
        " ORDER BY " + order +
        " LIMIT %s OFFSET %s",
        (status, limit, offset)
    )


@router.get("/{protocol_id}")
async def get_protocol(protocol_id: int):
    """Get protocol detail with investors."""
    proto = fetch_one(
        """SELECT p.*, d.name as creator_name, d.archetype as creator_archetype
           FROM protocols p JOIN devs d ON d.token_id = p.creator_dev_id
           WHERE p.id = %s""",
        (protocol_id,)
    )
    if not proto:
        raise HTTPException(404, "Protocol not found")

    investors = fetch_all(
        """SELECT pi.dev_id, d.name as dev_name, pi.shares, pi.nxt_invested, pi.invested_at
           FROM protocol_investments pi JOIN devs d ON d.token_id = pi.dev_id
           WHERE pi.protocol_id = %s ORDER BY pi.nxt_invested DESC""",
        (protocol_id,)
    )
    return {**proto, "investors": investors}
