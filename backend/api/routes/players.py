"""Routes: Players — registration, profile, devs, wallet"""

from datetime import date, timedelta
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
    total_spent = sum(d["total_spent"] for d in devs)
    total_earned = sum(d["total_earned"] for d in devs)
    total_devs = len(devs)
    salary_per_day = total_devs * 200  # net amount player receives

    return {
        "wallet_address": player["wallet_address"],
        "balance_claimable": total_claimable,
        "balance_claimed": total_spent,
        "balance_total_earned": total_earned,
        "total_devs": total_devs,
        "salary_per_day": salary_per_day,
        "devs": devs,
    }


@router.get("/{wallet}/balance-history")
async def get_balance_history(wallet: str, days: int = Query(default=30, le=90)):
    """Get daily balance snapshots for chart. Returns last N days.

    When fewer than 7 real snapshots exist, reconstructs history from
    the current balance and recorded movements (actions, claims, shop).
    """
    addr = wallet.lower()
    player = fetch_one(
        "SELECT wallet_address FROM players WHERE wallet_address = %s",
        (addr,)
    )
    if not player:
        raise HTTPException(404, "Player not found")

    snapshots = fetch_all(
        """SELECT snapshot_date, balance_claimable, balance_claimed, balance_total_earned
           FROM balance_snapshots
           WHERE wallet_address = %s
           ORDER BY snapshot_date DESC
           LIMIT %s""",
        (addr, days)
    )

    if len(snapshots) >= 7:
        snapshots.reverse()
        return snapshots

    # Not enough snapshots — reconstruct from current balance + movements
    return _reconstruct_balance_history(addr, days)


_SALARY_PER_DAY = 200  # per dev — must match engine config
_STARTING_BALANCE = {
    "common": 2000, "uncommon": 2500, "rare": 3000,
    "legendary": 5000, "mythic": 10000,
}


def _reconstruct_balance_history(addr: str, days: int):
    """Rebuild daily balance history by walking FORWARD from first mint.

    Starting from balance=0 on the day before the first dev was minted,
    accumulates daily salary income, starting-balance bonuses on mint
    days, and spend/sell/claim/shop deltas to produce a natural curve.
    """
    # Dev mint dates + rarity (for starting-balance bonus on mint day)
    devs = fetch_all(
        "SELECT minted_at::date AS mint_date, rarity_tier FROM devs WHERE owner_address = %s",
        (addr,)
    )
    if not devs:
        return []

    today = date.today()
    first_mint = min(d["mint_date"] for d in devs)
    # Start one day before first mint (balance = 0) so the chart shows
    # the jump on mint day.  Never go further back than `days` though.
    history_start = max(first_mint - timedelta(days=1), today - timedelta(days=days))

    # ── Aggregate daily non-salary balance deltas ────────────
    daily_delta = {}
    dev_ids_rows = fetch_all(
        "SELECT token_id FROM devs WHERE owner_address = %s", (addr,)
    )
    dev_ids = [d["token_id"] for d in dev_ids_rows]

    if dev_ids:
        ph = ",".join(["%s"] * len(dev_ids))
        # Spend / sell actions
        rows = fetch_all(f"""
            SELECT created_at::date AS day,
                   SUM(CASE
                       WHEN action_type = 'SELL'
                           THEN COALESCE((details->>'sold_for')::bigint, nxt_cost)
                       ELSE -nxt_cost
                   END) AS net
            FROM actions
            WHERE dev_id IN ({ph})
              AND action_type IN ('CREATE_PROTOCOL','CREATE_AI','INVEST','SELL')
              AND created_at >= %s
            GROUP BY created_at::date
        """, (*dev_ids, history_start))
        for r in rows:
            daily_delta[r["day"]] = daily_delta.get(r["day"], 0) + int(r["net"])

    # Claims (withdrawn from game balance)
    rows = fetch_all("""
        SELECT claimed_at::date AS day, -SUM(amount_net) AS net
        FROM claim_history
        WHERE player_address = %s AND claimed_at >= %s
        GROUP BY claimed_at::date
    """, (addr, history_start))
    for r in rows:
        daily_delta[r["day"]] = daily_delta.get(r["day"], 0) + int(r["net"])

    # Shop purchases
    rows = fetch_all("""
        SELECT purchased_at::date AS day, -SUM(nxt_cost) AS net
        FROM shop_purchases
        WHERE player_address = %s AND purchased_at >= %s
        GROUP BY purchased_at::date
    """, (addr, history_start))
    for r in rows:
        daily_delta[r["day"]] = daily_delta.get(r["day"], 0) + int(r["net"])

    # ── Walk FORWARD from history_start ──────────────────────
    bal = 0
    total_days = (today - history_start).days
    result = []

    for offset in range(total_days + 1):
        day = history_start + timedelta(days=offset)

        # Starting balance for devs minted on this day
        mint_bonus = sum(
            _STARTING_BALANCE.get(d["rarity_tier"], 2000)
            for d in devs if d["mint_date"] == day
        )

        # Salary: count devs active on this day (minted on or before)
        active_devs = sum(1 for d in devs if d["mint_date"] <= day)
        salary = active_devs * _SALARY_PER_DAY

        # Non-salary movements (spends negative, sells positive)
        delta = daily_delta.get(day, 0)

        bal = bal + mint_bonus + salary + delta
        result.append({
            "snapshot_date": str(day),
            "balance_claimable": max(0, int(bal)),
            "balance_claimed": 0,
            "balance_total_earned": 0,
        })

    return result


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
