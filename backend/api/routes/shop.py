"""Routes: Shop — items, training, raids, funding, transfers"""

import os
import json
import random
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.api.deps import fetch_one, fetch_all, get_db, validate_wallet
from backend.api.rate_limit import shop_limiter
import requests as http_requests

log = logging.getLogger("nx_api")
router = APIRouter()

# ── Shop Items (defined in code, not DB) ─────────────────────

SHOP_ITEMS = {
    # ── Original items (rebalanced prices) ──────────────────
    "energy_drink": {
        "name": "Energy Drink",
        "description": "+5 energy instantly",
        "cost_nxt": 12,
        "effect": {"type": "energy_boost", "value": 5},
    },
    "mood_reset": {
        "name": "Mood Reset",
        "description": "Reset mood to neutral",
        "cost_nxt": 10,
        "effect": {"type": "mood_reset", "value": "neutral"},
    },
    "code_boost": {
        "name": "Code Boost",
        "description": "+15% code quality for next protocol",
        "cost_nxt": 25,
        "effect": {"type": "code_quality_boost", "value": 15},
    },
    "sabotage_bug": {
        "name": "Sabotage Bug",
        "description": "Plant a bug in another dev's next protocol",
        "cost_nxt": 30,
        "effect": {"type": "sabotage", "value": -20},
        "target": "other_dev",
    },
    "teleporter": {
        "name": "Teleporter",
        "description": "Move your dev to any location (no energy)",
        "cost_nxt": 15,
        "effect": {"type": "free_move"},
    },
    "reputation_boost": {
        "name": "Reputation Boost",
        "description": "+10 reputation",
        "cost_nxt": 20,
        "effect": {"type": "reputation_boost", "value": 10},
    },
    # ── Food & Drinks (energy) ──────────────────────────────
    "coffee": {
        "name": "Coffee",
        "description": "+3 energy. Fuel for the grind.",
        "cost_nxt": 5,
        "effect": {"type": "energy_boost", "value": 3},
    },
    "energy_drink_small": {
        "name": "Energy Drink XL",
        "description": "+5 energy. Code harder.",
        "cost_nxt": 12,
        "effect": {"type": "energy_boost", "value": 5},
    },
    "pizza": {
        "name": "Pizza",
        "description": "+7 energy. The developer's staple.",
        "cost_nxt": 25,
        "effect": {"type": "energy_boost", "value": 7},
    },
    "mega_meal": {
        "name": "MegaMeal",
        "description": "+10 energy. Full restore.",
        "cost_nxt": 50,
        "effect": {"type": "energy_boost", "value": 10},
    },
    # ── PC Maintenance ──────────────────────────────────────
    "pc_repair": {
        "name": "Run Diagnostic",
        "description": "Restore PC health to 100%",
        "cost_nxt": 10,
        "effect": {"type": "pc_repair"},
    },
    # ── Bug Fixing ──────────────────────────────────────────
    "fix_bugs": {
        "name": "Bug Fix",
        "description": "Fix bugs in your code. Costs energy.",
        "cost_nxt": 0,
        "cost_energy": 10,
        "effect": {"type": "fix_bugs", "value": 5},
    },
    # ── Training Courses ────────────────────────────────────
    "train_hacking": {
        "name": "Intro to Hacking",
        "description": "4 hour course. Hacking +2.",
        "cost_nxt": 20,
        "effect": {"type": "training", "stat": "stat_hacking", "bonus": 2, "hours": 4},
    },
    "train_coding": {
        "name": "Optimization Workshop",
        "description": "12 hour course. Coding +3.",
        "cost_nxt": 50,
        "effect": {"type": "training", "stat": "stat_coding", "bonus": 3, "hours": 12},
    },
    "train_trading": {
        "name": "Advanced AI Trading",
        "description": "24 hour course. Trading +5.",
        "cost_nxt": 100,
        "effect": {"type": "training", "stat": "stat_trading", "bonus": 5, "hours": 24},
    },
}

COFFEE_ITEMS = {"coffee", "energy_drink_small", "energy_drink", "pizza", "mega_meal"}


@router.get("")
async def list_shop_items():
    """Get all available shop items."""
    return [{"id": k, **v} for k, v in SHOP_ITEMS.items()]


class PurchaseRequest(BaseModel):
    player_address: str
    item_id: str
    target_dev_id: int
    sabotage_target_dev_id: int | None = None


@router.post("/buy")
async def buy_item(req: PurchaseRequest):
    """Buy a shop item for your dev. Cost deducted from dev's $NXT balance."""
    addr = validate_wallet(req.player_address)
    shop_limiter.check(f"wallet:{addr}")

    item = SHOP_ITEMS.get(req.item_id)
    if not item:
        raise HTTPException(404, "Item not found")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT token_id, owner_address, balance_nxt, name, energy, max_energy, training_course FROM devs WHERE token_id = %s FOR UPDATE",
                (req.target_dev_id,)
            )
            dev = cur.fetchone()
            if not dev:
                raise HTTPException(404, "Dev not found")
            if dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")
            cost_energy = item.get("cost_energy", 0)
            if cost_energy > 0:
                if dev["energy"] < cost_energy:
                    raise HTTPException(400, f"Not enough energy. Need {cost_energy}, have {dev['energy']}")
            elif dev["balance_nxt"] < item["cost_nxt"]:
                raise HTTPException(400, f"Not enough $NXT. Need {item['cost_nxt']}, have {dev['balance_nxt']}")

            effect = item["effect"]

            # Training: check dev isn't already training
            if effect["type"] == "training":
                if dev.get("training_course"):
                    raise HTTPException(400, "Dev is already in training. Wait for it to finish.")

            # Deduct cost
            if cost_energy > 0:
                cur.execute(
                    "UPDATE devs SET energy = energy - %s WHERE token_id = %s",
                    (cost_energy, req.target_dev_id)
                )
            else:
                cur.execute(
                    "UPDATE devs SET balance_nxt = balance_nxt - %s, total_spent = total_spent + %s WHERE token_id = %s",
                    (item["cost_nxt"], item["cost_nxt"], req.target_dev_id)
                )
            cur.execute(
                """INSERT INTO shop_purchases (player_address, target_dev_id, item_type, item_effect, nxt_cost)
                   VALUES (%s, %s, %s, %s::jsonb, %s) RETURNING id""",
                (addr, req.target_dev_id, req.item_id,
                 json.dumps(effect), item["cost_nxt"])
            )
            purchase = cur.fetchone()

            # Apply immediate effects
            if effect["type"] == "energy_boost":
                cur.execute(
                    "UPDATE devs SET energy = LEAST(energy + %s, max_energy) WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
                # Increment coffee counter for food items
                if req.item_id in COFFEE_ITEMS:
                    cur.execute(
                        "UPDATE devs SET coffee_count = coffee_count + 1 WHERE token_id = %s",
                        (req.target_dev_id,)
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
            elif effect["type"] == "pc_repair":
                cur.execute(
                    "UPDATE devs SET pc_health = 100 WHERE token_id = %s",
                    (req.target_dev_id,)
                )
            elif effect["type"] == "fix_bugs":
                cur.execute(
                    "UPDATE devs SET bugs_shipped = GREATEST(0, bugs_shipped - %s), bugs_fixed = COALESCE(bugs_fixed, 0) + %s WHERE token_id = %s",
                    (effect["value"], effect["value"], req.target_dev_id)
                )
            elif effect["type"] == "training":
                ends_at = datetime.now(timezone.utc) + timedelta(hours=effect["hours"])
                cur.execute(
                    "UPDATE devs SET training_course = %s, training_ends_at = %s WHERE token_id = %s",
                    (req.item_id, ends_at, req.target_dev_id)
                )

            # Re-fetch dev with updated values so frontend can use directly
            cur.execute("SELECT * FROM devs WHERE token_id = %s", (req.target_dev_id,))
            updated_dev = cur.fetchone()

    result = {
        "purchase_id": purchase["id"],
        "item": req.item_id,
        "cost": item["cost_nxt"],
        "dev": dev["name"],
        "status": "applied",
        "updated_dev": dict(updated_dev) if updated_dev else None,
    }
    if cost_energy > 0:
        result["energy_cost"] = cost_energy
    return result


# ── Fix Bug ────────────────────────────────────────────────

FIX_BUG_COST = 5  # flat NXT per bug

class FixBugRequest(BaseModel):
    player_address: str
    dev_id: int


@router.post("/fix-bug")
async def fix_bug(req: FixBugRequest):
    """Fix one bug on a dev. Costs 5 $NXT per bug."""
    addr = validate_wallet(req.player_address)
    shop_limiter.check(f"fixbug:{addr}")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT token_id, owner_address, balance_nxt, name, bugs_shipped FROM devs WHERE token_id = %s FOR UPDATE",
                (req.dev_id,)
            )
            dev = cur.fetchone()
            if not dev:
                raise HTTPException(404, "Dev not found")
            if dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")
            if dev["bugs_shipped"] <= 0:
                raise HTTPException(400, "No bugs to fix")
            if dev["balance_nxt"] < FIX_BUG_COST:
                raise HTTPException(400, f"Not enough $NXT. Need {FIX_BUG_COST}, have {dev['balance_nxt']}")

            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt - %s, total_spent = total_spent + %s, "
                "bugs_shipped = bugs_shipped - 1, bugs_fixed = COALESCE(bugs_fixed, 0) + 1 "
                "WHERE token_id = %s",
                (FIX_BUG_COST, FIX_BUG_COST, req.dev_id)
            )

            cur.execute(
                """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                   VALUES (%s, %s, %s, 'FIX_BUG', %s::jsonb, 0, %s)""",
                (req.dev_id, dev["name"], "unknown",
                 json.dumps({"event": "bug_fixed", "remaining": dev["bugs_shipped"] - 1}),
                 FIX_BUG_COST)
            )

            # Return updated dev
            cur.execute("SELECT * FROM devs WHERE token_id = %s", (req.dev_id,))
            updated_dev = cur.fetchone()

    remaining = dev["bugs_shipped"] - 1
    return {
        "dev": dev["name"],
        "cost": FIX_BUG_COST,
        "bugs_remaining": remaining,
        "status": "fixed",
        "message": f"Bug fixed! {remaining} bug{'s' if remaining != 1 else ''} remaining." if remaining > 0 else "All bugs fixed!",
        "updated_dev": dict(updated_dev) if updated_dev else None,
    }


# ── Graduate (complete training) ────────────────────────────

class GraduateRequest(BaseModel):
    player_address: str
    dev_id: int


@router.post("/graduate")
async def graduate_training(req: GraduateRequest):
    """Complete training and apply stat bonus."""
    addr = validate_wallet(req.player_address)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT token_id, owner_address, training_course, training_ends_at, name FROM devs WHERE token_id = %s FOR UPDATE",
                (req.dev_id,)
            )
            dev = cur.fetchone()
            if not dev:
                raise HTTPException(404, "Dev not found")
            if dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")
            if not dev["training_course"]:
                raise HTTPException(400, "Dev is not in training")

            now = datetime.now(timezone.utc)
            if dev["training_ends_at"] and dev["training_ends_at"] > now:
                remaining = dev["training_ends_at"] - now
                raise HTTPException(400, f"Training not complete. {int(remaining.total_seconds() // 3600)}h remaining.")

            # Look up the training item to get stat bonus
            training_item = SHOP_ITEMS.get(dev["training_course"])
            if not training_item or training_item["effect"]["type"] != "training":
                raise HTTPException(400, "Invalid training course")

            stat = training_item["effect"]["stat"]
            bonus = training_item["effect"]["bonus"]

            # Apply stat bonus permanently and clear training
            cur.execute(
                f"UPDATE devs SET {stat} = LEAST({stat} + %s, 100), training_course = NULL, training_ends_at = NULL WHERE token_id = %s",
                (bonus, req.dev_id)
            )

    return {
        "dev": dev["name"],
        "stat": stat,
        "bonus": bonus,
        "status": "graduated",
    }


# ── Hack / Raid ─────────────────────────────────────────────

class HackRequest(BaseModel):
    player_address: str
    attacker_dev_id: int


HACK_COST = 15
HACK_COOLDOWN_HOURS = 24
HACK_BASE_SUCCESS = 0.40
HACK_STEAL_MIN = 20
HACK_STEAL_MAX = 40


@router.post("/hack")
async def hack_raid(req: HackRequest):
    """Attempt to hack a random dev from another corporation."""
    addr = validate_wallet(req.player_address)
    shop_limiter.check(f"hack:{addr}")

    with get_db() as conn:
        with conn.cursor() as cur:
            # Lock attacker
            cur.execute(
                "SELECT token_id, owner_address, balance_nxt, name, corporation, stat_hacking, last_raid_at FROM devs WHERE token_id = %s FOR UPDATE",
                (req.attacker_dev_id,)
            )
            attacker = cur.fetchone()
            if not attacker:
                raise HTTPException(404, "Attacker dev not found")
            if attacker["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")
            if attacker["balance_nxt"] < HACK_COST:
                raise HTTPException(400, f"Not enough $NXT. Need {HACK_COST}, have {attacker['balance_nxt']}")

            # Check cooldown
            now = datetime.now(timezone.utc)
            if attacker.get("last_raid_at"):
                cooldown_end = attacker["last_raid_at"] + timedelta(hours=HACK_COOLDOWN_HOURS)
                if now < cooldown_end:
                    remaining = cooldown_end - now
                    raise HTTPException(400, f"Hack on cooldown. Available in {int(remaining.total_seconds() // 3600)}h.")

            # Find random target from another corporation
            cur.execute(
                "SELECT token_id, name, corporation, balance_nxt, owner_address FROM devs WHERE corporation != %s AND status = 'active' AND balance_nxt > 0 ORDER BY RANDOM() LIMIT 1",
                (attacker["corporation"],)
            )
            target = cur.fetchone()
            if not target:
                raise HTTPException(400, "No valid targets found")

            # Deduct cost and set cooldown
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt - %s, total_spent = total_spent + %s, last_raid_at = %s WHERE token_id = %s",
                (HACK_COST, HACK_COST, now, req.attacker_dev_id)
            )

            # Calculate success probability: 40% base + hacking_stat/200 (max ~85%)
            success_prob = HACK_BASE_SUCCESS + (attacker["stat_hacking"] / 200.0)
            success = random.random() < success_prob

            if success:
                steal_amount = random.randint(HACK_STEAL_MIN, min(HACK_STEAL_MAX, target["balance_nxt"]))
                # Transfer NXT
                cur.execute(
                    "UPDATE devs SET balance_nxt = GREATEST(0, balance_nxt - %s) WHERE token_id = %s",
                    (steal_amount, target["token_id"])
                )
                cur.execute(
                    "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
                    (steal_amount, steal_amount, req.attacker_dev_id)
                )
                # Log action
                cur.execute(
                    """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                       VALUES (%s, %s, %s, 'HACK_RAID', %s::jsonb, 0, %s)""",
                    (req.attacker_dev_id, attacker["name"], attacker.get("archetype", "UNKNOWN"),
                     json.dumps({"success": True, "target_id": target["token_id"], "target_name": target["name"],
                                 "target_corp": target["corporation"], "stolen": steal_amount}),
                     HACK_COST)
                )
                # Notify target owner
                if target.get("owner_address"):
                    cur.execute(
                        """INSERT INTO notifications (player_address, type, title, body, dev_id)
                           VALUES (%s, 'hack_received', %s, %s, %s)""",
                        (target["owner_address"].lower(),
                         f"INTRUSION DETECTED on {target['name']}",
                         f"{attacker['name']} ({attacker['corporation']}) stole {steal_amount} $NXT from {target['name']}.",
                         target["token_id"])
                    )
                result = {"success": True, "stolen": steal_amount, "target": target["name"], "target_corp": target["corporation"]}
            else:
                # Failed — already lost HACK_COST
                cur.execute(
                    """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                       VALUES (%s, %s, %s, 'HACK_RAID', %s::jsonb, 0, %s)""",
                    (req.attacker_dev_id, attacker["name"], attacker.get("archetype", "UNKNOWN"),
                     json.dumps({"success": False, "target_id": target["token_id"], "target_name": target["name"],
                                 "target_corp": target["corporation"]}),
                     HACK_COST)
                )
                result = {"success": False, "lost": HACK_COST, "target": target["name"], "target_corp": target["corporation"]}

            # Record in shop_purchases for tracking
            cur.execute(
                """INSERT INTO shop_purchases (player_address, target_dev_id, item_type, item_effect, nxt_cost)
                   VALUES (%s, %s, 'hack_raid', %s::jsonb, %s)""",
                (addr, req.attacker_dev_id, json.dumps(result), HACK_COST)
            )

    return result


# ── Fund Dev (on-chain deposit) ────────────────────────────

_RPC_URL = os.getenv("MEGAETH_RPC_URL", "https://carrot.megaeth.com/rpc")
_NXT_TOKEN = "0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47".lower()
_TREASURY = "0x31d6E19aAE43B5E2fbeDb01b6FF82AD1e8B576DC".lower()
# ERC-20 Transfer(address,address,uint256) event topic
_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def _rpc(method, params=None):
    """JSON-RPC call to MegaETH."""
    r = http_requests.post(_RPC_URL, json={
        "jsonrpc": "2.0", "method": method, "params": params or [], "id": 1,
    }, timeout=15)
    data = r.json()
    if "error" in data:
        raise HTTPException(502, f"RPC error: {data['error'].get('message', 'unknown')}")
    return data.get("result")


class FundRequest(BaseModel):
    player_address: str
    dev_token_id: int
    amount: float  # integer NXT amount (not wei)
    tx_hash: str


@router.post("/fund")
async def fund_dev(req: FundRequest):
    """Deposit on-chain $NXT into a dev's in-game balance."""
    addr = validate_wallet(req.player_address)
    shop_limiter.check(f"fund:{addr}")

    if req.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if not req.tx_hash or len(req.tx_hash) != 66 or not req.tx_hash.startswith("0x"):
        raise HTTPException(400, "Invalid transaction hash")

    amount_int = int(req.amount)
    if amount_int <= 0:
        raise HTTPException(400, "Amount must be at least 1 $NXT")

    with get_db() as conn:
        with conn.cursor() as cur:
            # Check tx_hash not already used
            cur.execute("SELECT 1 FROM funding_txs WHERE tx_hash = %s", (req.tx_hash.lower(),))
            if cur.fetchone():
                raise HTTPException(400, "Transaction already used for funding")

            # Verify dev ownership
            cur.execute(
                "SELECT token_id, owner_address, balance_nxt, name FROM devs WHERE token_id = %s FOR UPDATE",
                (req.dev_token_id,)
            )
            dev = cur.fetchone()
            if not dev:
                raise HTTPException(404, "Dev not found")
            if dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")

            # Verify TX on-chain
            receipt = _rpc("eth_getTransactionReceipt", [req.tx_hash])
            if not receipt:
                raise HTTPException(400, "Transaction not found or not yet confirmed")
            if receipt.get("status") != "0x1":
                raise HTTPException(400, "Transaction failed on-chain")

            # Parse Transfer event from logs to verify amount and parties
            tx_to = (receipt.get("to") or "").lower()
            if tx_to != _NXT_TOKEN:
                raise HTTPException(400, "Transaction is not an NXT token transfer")
            tx_from = (receipt.get("from") or "").lower()
            if tx_from != addr:
                raise HTTPException(400, "Transaction sender does not match your wallet")

            # Find the ERC-20 Transfer event log
            verified_amount_wei = None
            for log_entry in (receipt.get("logs") or []):
                topics = log_entry.get("topics") or []
                if len(topics) >= 3 and topics[0] == _TRANSFER_TOPIC:
                    log_from = "0x" + topics[1][-40:]
                    log_to = "0x" + topics[2][-40:]
                    if log_from.lower() == addr and log_to.lower() == _TREASURY:
                        verified_amount_wei = int(log_entry.get("data", "0x0"), 16)
                        break

            if verified_amount_wei is None:
                raise HTTPException(400, "No valid Transfer event found to treasury")

            # Convert from wei (18 decimals) to integer NXT
            verified_nxt = verified_amount_wei // (10 ** 18)
            if verified_nxt < amount_int:
                raise HTTPException(400, f"On-chain amount ({verified_nxt} $NXT) is less than requested ({amount_int} $NXT)")

            # Use the on-chain verified amount (could be >= requested)
            credit_amount = verified_nxt

            # Record funding TX
            cur.execute(
                """INSERT INTO funding_txs (wallet_address, dev_token_id, amount_nxt, tx_hash, verified)
                   VALUES (%s, %s, %s, %s, true)""",
                (addr, req.dev_token_id, credit_amount, req.tx_hash.lower())
            )

            # Credit dev balance
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
                (credit_amount, credit_amount, req.dev_token_id)
            )

            # Record action
            cur.execute(
                """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                   VALUES (%s, %s, %s, 'FUND_DEV', %s::jsonb, 0, 0)""",
                (req.dev_token_id, dev["name"], "unknown",
                 json.dumps({"event": "fund_dev", "amount": credit_amount, "tx_hash": req.tx_hash.lower()}))
            )

            # Return updated dev
            cur.execute("SELECT * FROM devs WHERE token_id = %s", (req.dev_token_id,))
            updated_dev = cur.fetchone()

    return {
        "status": "funded",
        "dev": dev["name"],
        "amount": credit_amount,
        "new_balance": updated_dev["balance_nxt"] if updated_dev else None,
        "updated_dev": dict(updated_dev) if updated_dev else None,
    }


# ── Transfer between devs (virtual) ───────────────────────

class TransferRequest(BaseModel):
    player_address: str
    from_dev_token_id: int
    to_dev_token_id: int
    amount: int


@router.post("/transfer")
async def transfer_nxt(req: TransferRequest):
    """Transfer $NXT between your own devs. No blockchain transaction needed."""
    addr = validate_wallet(req.player_address)
    shop_limiter.check(f"transfer:{addr}")

    if req.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if req.from_dev_token_id == req.to_dev_token_id:
        raise HTTPException(400, "Cannot transfer to the same dev")

    with get_db() as conn:
        with conn.cursor() as cur:
            # Lock both devs ordered by token_id to prevent deadlocks
            ids = sorted([req.from_dev_token_id, req.to_dev_token_id])
            cur.execute(
                "SELECT token_id, owner_address, balance_nxt, name, status FROM devs WHERE token_id IN (%s, %s) ORDER BY token_id FOR UPDATE",
                (ids[0], ids[1])
            )
            rows = cur.fetchall()
            if len(rows) != 2:
                raise HTTPException(404, "One or both devs not found")

            devs_map = {r["token_id"]: r for r in rows}
            from_dev = devs_map.get(req.from_dev_token_id)
            to_dev = devs_map.get(req.to_dev_token_id)
            if not from_dev or not to_dev:
                raise HTTPException(404, "Dev not found")

            # Verify ownership
            if from_dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own the source dev")
            if to_dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own the destination dev")

            # Check mission status
            if from_dev["status"] == "on_mission":
                raise HTTPException(400, f"{from_dev['name']} is on a mission and can't transfer funds")
            if to_dev["status"] == "on_mission":
                raise HTTPException(400, f"{to_dev['name']} is on a mission and can't receive funds")

            # Check balance
            if from_dev["balance_nxt"] < req.amount:
                raise HTTPException(400, f"Not enough $NXT. {from_dev['name']} has {from_dev['balance_nxt']}, need {req.amount}")

            # Execute transfer
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt - %s WHERE token_id = %s",
                (req.amount, req.from_dev_token_id)
            )
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt + %s WHERE token_id = %s",
                (req.amount, req.to_dev_token_id)
            )

            # Record actions for both devs
            cur.execute(
                """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                   VALUES (%s, %s, %s, 'TRANSFER', %s::jsonb, 0, %s)""",
                (req.from_dev_token_id, from_dev["name"], "unknown",
                 json.dumps({"event": "transfer_out", "to_dev_id": req.to_dev_token_id,
                             "to_dev_name": to_dev["name"], "amount": req.amount}),
                 req.amount)
            )
            cur.execute(
                """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                   VALUES (%s, %s, %s, 'TRANSFER', %s::jsonb, 0, 0)""",
                (req.to_dev_token_id, to_dev["name"], "unknown",
                 json.dumps({"event": "transfer_in", "from_dev_id": req.from_dev_token_id,
                             "from_dev_name": from_dev["name"], "amount": req.amount}))
            )

            # Return both updated devs
            cur.execute("SELECT * FROM devs WHERE token_id IN (%s, %s)", (req.from_dev_token_id, req.to_dev_token_id))
            updated = cur.fetchall()
            updated_map = {r["token_id"]: dict(r) for r in updated}

    return {
        "status": "transferred",
        "amount": req.amount,
        "from_dev": from_dev["name"],
        "to_dev": to_dev["name"],
        "updated_from": updated_map.get(req.from_dev_token_id),
        "updated_to": updated_map.get(req.to_dev_token_id),
    }
