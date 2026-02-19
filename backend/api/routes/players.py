"""Routes: Players — registration, profile, devs, wallet"""

from fastapi import APIRouter, HTTPException, Query
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


@router.get("/{wallet}/wallet-summary")
async def get_wallet_summary(wallet: str):
    """Get wallet summary: balances + per-dev breakdown.

    IMPORTANT: balance_claimable here is the NET amount (what the player sees).
    The on-chain claimableBalance is inflated by ~11.11% to compensate for
    the 10% contract fee. Frontend must use previewClaim().net, never
    claimableBalance directly.
    """
    player = fetch_one(
        "SELECT wallet_address, balance_claimable, balance_claimed, balance_total_earned FROM players WHERE wallet_address = %s",
        (wallet.lower(),)
    )
    if not player:
        raise HTTPException(404, "Player not found")

    devs = fetch_all(
        """SELECT token_id, name, rarity_tier, balance_nxt, total_earned, total_spent, status
           FROM devs WHERE owner_address = %s ORDER BY balance_nxt DESC""",
        (wallet.lower(),)
    )

    total_claimable = sum(d["balance_nxt"] for d in devs)
    total_devs = len(devs)
    salary_per_day = total_devs * 200  # net amount player receives

    return {
        "wallet_address": player["wallet_address"],
        "balance_claimable": total_claimable,
        "balance_claimed": player["balance_claimed"],
        "balance_total_earned": player["balance_total_earned"],
        "total_devs": total_devs,
        "salary_per_day": salary_per_day,
        "devs": devs,
    }


@router.get("/{wallet}/balance-history")
async def get_balance_history(wallet: str, days: int = Query(default=30, le=90)):
    """Get daily balance snapshots for chart. Returns last N days."""
    player = fetch_one(
        "SELECT wallet_address FROM players WHERE wallet_address = %s",
        (wallet.lower(),)
    )
    if not player:
        raise HTTPException(404, "Player not found")

    snapshots = fetch_all(
        """SELECT snapshot_date, balance_claimable, balance_claimed, balance_total_earned
           FROM balance_snapshots
           WHERE wallet_address = %s
           ORDER BY snapshot_date DESC
           LIMIT %s""",
        (wallet.lower(), days)
    )

    # Return in chronological order for chart
    snapshots.reverse()
    return snapshots


@router.get("/{wallet}/movements")
async def get_movements(wallet: str, limit: int = Query(default=50, le=200), offset: int = 0):
    """Get unified movement log: salaries, actions, claims, shop purchases."""
    player = fetch_one(
        "SELECT wallet_address FROM players WHERE wallet_address = %s",
        (wallet.lower(),)
    )
    if not player:
        raise HTTPException(404, "Player not found")

    # Get dev token_ids for this wallet
    dev_rows = fetch_all(
        "SELECT token_id FROM devs WHERE owner_address = %s",
        (wallet.lower(),)
    )
    dev_ids = [d["token_id"] for d in dev_rows]

    movements = []

    if dev_ids:
        placeholders = ",".join(["%s"] * len(dev_ids))
        actions = fetch_all(
            f"""SELECT dev_id, dev_name, action_type, nxt_cost, details, created_at
                FROM actions
                WHERE dev_id IN ({placeholders})
                  AND action_type IN ('CREATE_PROTOCOL', 'CREATE_AI', 'INVEST', 'SELL', 'RECEIVE_SALARY')
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s""",
            (*dev_ids, limit, offset)
        )
        for a in actions:
            amount = a["nxt_cost"] or 0
            if a["action_type"] == "SELL":
                details = a["details"] if isinstance(a["details"], dict) else {}
                amount = details.get("sold_for", 0)
                movements.append({
                    "type": "sell",
                    "amount": amount,
                    "dev_id": a["dev_id"],
                    "dev_name": a["dev_name"],
                    "description": f"Sold investment in {details.get('name', 'protocol')}",
                    "timestamp": a["created_at"],
                })
            elif a["action_type"] == "RECEIVE_SALARY":
                movements.append({
                    "type": "salary",
                    "amount": amount,
                    "dev_id": a["dev_id"],
                    "dev_name": a["dev_name"],
                    "description": "Salary received",
                    "timestamp": a["created_at"],
                })
            else:
                movements.append({
                    "type": "spend",
                    "amount": -amount,
                    "dev_id": a["dev_id"],
                    "dev_name": a["dev_name"],
                    "description": f"{a['action_type'].replace('_', ' ').title()}",
                    "timestamp": a["created_at"],
                })

    # Claims
    claims = fetch_all(
        """SELECT amount_gross, fee_amount, amount_net, tx_hash, claimed_at
           FROM claim_history
           WHERE player_address = %s
           ORDER BY claimed_at DESC
           LIMIT %s OFFSET %s""",
        (wallet.lower(), limit, offset)
    )
    for c in claims:
        movements.append({
            "type": "claim",
            "amount": -(c["amount_net"]),
            "dev_id": None,
            "dev_name": None,
            "description": f"Claimed {c['amount_net']} $NXT (fee: {c['fee_amount']})",
            "timestamp": c["claimed_at"],
            "tx_hash": c.get("tx_hash"),
        })

    # Shop purchases
    shop = fetch_all(
        """SELECT target_dev_id, item_type, nxt_cost, purchased_at
           FROM shop_purchases
           WHERE player_address = %s
           ORDER BY purchased_at DESC
           LIMIT %s OFFSET %s""",
        (wallet.lower(), limit, offset)
    )
    for s in shop:
        movements.append({
            "type": "shop",
            "amount": -(s["nxt_cost"]),
            "dev_id": s["target_dev_id"],
            "dev_name": None,
            "description": f"Purchased {s['item_type']}",
            "timestamp": s["purchased_at"],
        })

    # Sort all by timestamp descending
    movements.sort(key=lambda m: m["timestamp"], reverse=True)

    return movements[:limit]
