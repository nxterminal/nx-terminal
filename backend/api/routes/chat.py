"""Routes: Chat — AI dev messages + human world chat"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from backend.api.deps import fetch_all, get_db
from backend.api.rate_limit import chat_limiter

router = APIRouter()


# ── AI Dev Chat (read-only for players) ──────────────────────

@router.get("/devs")
async def get_dev_chat(
    location: Optional[str] = None,
    channel: str = "trollbox",
    limit: int = Query(50, le=200),
):
    """Get AI dev chat messages. Filter by location or trollbox."""
    if location:
        return fetch_all(
            """SELECT id, dev_id, dev_name, archetype, channel, location, message, created_at
               FROM chat_messages WHERE location = %s
               ORDER BY created_at DESC LIMIT %s""",
            (location, limit)
        )
    return fetch_all(
        """SELECT id, dev_id, dev_name, archetype, channel, location, message, created_at
           FROM chat_messages WHERE channel = %s
           ORDER BY created_at DESC LIMIT %s""",
        (channel, limit)
    )


# ── World Chat (humans) ─────────────────────────────────────

class ChatMessage(BaseModel):
    player_address: str
    display_name: str
    message: str


@router.get("/world")
async def get_world_chat(limit: int = Query(50, le=200)):
    """Get human world chat."""
    return fetch_all(
        "SELECT * FROM world_chat ORDER BY created_at DESC LIMIT %s",
        (limit,)
    )


@router.post("/world")
async def post_world_chat(msg: ChatMessage):
    """Post a message to world chat."""
    # Rate limit: 1 message per wallet per 10s
    chat_limiter.check(f"wallet:{msg.player_address.lower()}")

    if len(msg.message) > 280:
        raise HTTPException(400, "Message too long (max 280 chars)")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO world_chat (player_address, display_name, message)
                   VALUES (%s, %s, %s) RETURNING id, created_at""",
                (msg.player_address.lower(), msg.display_name[:30], msg.message[:280])
            )
            result = cur.fetchone()

    return {"id": result["id"], "created_at": result["created_at"]}
