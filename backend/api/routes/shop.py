"""Routes: Shop — items & purchases"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.api.deps import fetch_one, fetch_all, get_db, validate_wallet
from backend.api.rate_limit import shop_limiter

router = APIRouter()

# ── Shop Items (defined in code, not DB) ─────────────────────

SHOP_ITEMS = {
    "energy_drink": {
        "name": "Energy Drink",
        "description": "+5 energy instantly",
        "cost_nxt": 300,
        "effect": {"type": "energy_boost", "value": 5},
    },
    "mood_reset": {
        "name": "Mood Reset",
        "description": "Reset mood to neutral",
        "cost_nxt": 200,
        "effect": {"type": "mood_reset", "value": "neutral"},
    },
    "code_boost": {
        "name": "Code Boost",
        "description": "+15% code quality for next protocol",
        "cost_nxt": 500,
        "effect": {"type": "code_quality_boost", "value": 15},
    },
    "sabotage_bug": {
        "name": "Sabotage Bug",
        "description": "Plant a bug in another dev's next protocol (-20% quality)",
        "cost_nxt": 800,
        "effect": {"type": "sabotage", "value": -20},
        "target": "other_dev",
    },
    "teleporter": {
        "name": "Teleporter",
        "description": "Move your dev to any location instantly (no energy cost)",
        "cost_nxt": 400,
        "effect": {"type": "free_move"},
    },
    "reputation_boost": {
        "name": "Reputation Boost",
        "description": "+10 reputation",
        "cost_nxt": 600,
        "effect": {"type": "reputation_boost", "value": 10},
    },
}


@router.get("")
async def list_shop_items():
    """Get all available shop items."""
    return [{"id": k, **v} for k, v in SHOP_ITEMS.items()]


class PurchaseRequest(BaseModel):
    player_address: str
    item_id: str
    target_dev_id: int
    sabotage_target_dev_id: int | None = None  # For sabotage items


@router.post("/buy")
async def buy_item(req: PurchaseRequest):
    """Buy a shop item for your dev. Cost deducted from dev's $NXT balance."""
    # Validate wallet format
    addr = validate_wallet(req.player_address)

    # Rate limit: 1 purchase per wallet per 5s
    shop_limiter.check(f"wallet:{addr}")

    item = SHOP_ITEMS.get(req.item_id)
    if not item:
        raise HTTPException(404, "Item not found")

    # Verify ownership
    dev = fetch_one(
        "SELECT token_id, owner_address, balance_nxt, name FROM devs WHERE token_id = %s",
        (req.target_dev_id,)
    )
    if not dev:
        raise HTTPException(404, "Dev not found")
    if dev["owner_address"].lower() != addr:
        raise HTTPException(403, "You don't own this dev")
    if dev["balance_nxt"] < item["cost_nxt"]:
        raise HTTPException(400, f"Not enough $NXT. Need {item['cost_nxt']}, have {dev['balance_nxt']}")

    # Deduct cost and record purchase
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt - %s, total_spent = total_spent + %s WHERE token_id = %s",
                (item["cost_nxt"], item["cost_nxt"], req.target_dev_id)
            )
            cur.execute(
                """INSERT INTO shop_purchases (player_address, target_dev_id, item_type, item_effect, nxt_cost)
                   VALUES (%s, %s, %s, %s::jsonb, %s) RETURNING id""",
                (addr, req.target_dev_id, req.item_id,
                 str(item["effect"]).replace("'", '"'), item["cost_nxt"])
            )
            purchase = cur.fetchone()

            # Apply immediate effects
            effect = item["effect"]
            if effect["type"] == "energy_boost":
                cur.execute(
                    "UPDATE devs SET energy = LEAST(energy + %s, max_energy) WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
            elif effect["type"] == "mood_reset":
                cur.execute(
                    "UPDATE devs SET mood = %s WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
            elif effect["type"] == "reputation_boost":
                cur.execute(
                    "UPDATE devs SET reputation = reputation + %s WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )

    return {
        "purchase_id": purchase["id"],
        "item": req.item_id,
        "cost": item["cost_nxt"],
        "dev": dev["name"],
        "status": "applied",
    }
