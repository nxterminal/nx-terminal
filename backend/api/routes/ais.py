"""Routes: Absurd AI Lab"""

from fastapi import APIRouter, Query
from backend.api.deps import fetch_all

router = APIRouter()


@router.get("")
async def list_ais(limit: int = Query(20, le=100), offset: int = 0):
    """Get AI rankings by weighted votes."""
    return fetch_all(
        """SELECT a.id, a.name, a.description, a.vote_count, a.weighted_votes,
                  a.reward_tier, d.name as creator_name, d.archetype as creator_archetype,
                  a.created_at
           FROM absurd_ais a JOIN devs d ON d.token_id = a.creator_dev_id
           ORDER BY a.weighted_votes DESC
           LIMIT %s OFFSET %s""",
        (limit, offset)
    )
