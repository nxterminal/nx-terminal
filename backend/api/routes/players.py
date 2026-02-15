"""Routes: Players — registration, profile, devs"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.api.deps import fetch_one, fetch_all, get_db

router = APIRouter()


class RegisterRequest(BaseModel):
    wallet_address: str
    display_name: Optional[str] = None
    corporation: str  # From quiz result


@router.post("/register")
async def register_player(req: RegisterRequest):
    """Register a new player after quiz. Called before first mint."""
    valid_corps = ["CLOSED_AI", "MISANTHROPIC", "SHALLOW_MIND", "ZUCK_LABS", "Y_AI", "MISTRIAL_SYSTEMS"]
    if req.corporation not in valid_corps:
        raise HTTPException(400, f"Invalid corporation. Must be one of: {valid_corps}")

    # Check if already registered
    existing = fetch_one(
        "SELECT wallet_address FROM players WHERE wallet_address = %s",
        (req.wallet_address.lower(),)
    )
    if existing:
        raise HTTPException(409, "Player already registered")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO players (wallet_address, display_name, corporation)
                   VALUES (%s, %s, %s) RETURNING wallet_address, corporation, created_at""",
                (req.wallet_address.lower(), req.display_name, req.corporation)
            )
            result = cur.fetchone()

    return result


@router.get("/{wallet}")
async def get_player(wallet: str):
    """Get player profile."""
    player = fetch_one(
        "SELECT * FROM players WHERE wallet_address = %s",
        (wallet.lower(),)
    )
    if not player:
        raise HTTPException(404, "Player not found")

    devs = fetch_all(
        """SELECT token_id, name, archetype, rarity_tier, energy, mood,
                  location, balance_nxt, reputation, status, last_action_type
           FROM devs WHERE owner_address = %s ORDER BY balance_nxt DESC""",
        (wallet.lower(),)
    )

    return {**player, "devs": devs}


@router.get("/{wallet}/claim-history")
async def get_claim_history(wallet: str):
    """Get $NXT claim history for a player."""
    return fetch_all(
        "SELECT * FROM claim_history WHERE player_address = %s ORDER BY claimed_at DESC",
        (wallet.lower(),)
    )
