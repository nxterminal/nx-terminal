"""Routes: Shop — items, training, raids, funding, transfers"""

import os
import json
import random
import logging
import time
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from backend.api.deps import fetch_one, fetch_all, get_db, validate_wallet, get_active_event_effects
from backend.api.rate_limit import shop_limiter
from backend.services.logging_helpers import log_info
from backend.services.admin_log import log_event as admin_log_event
from backend.services.ledger import (
    LedgerSource,
    is_shadow_write_enabled,
    ledger_insert,
    tx_hash_to_bigint,
)
import requests as http_requests

log = logging.getLogger("nx_api")
router = APIRouter()

# ── Shop Items (defined in code, not DB) ─────────────────────

SHOP_ITEMS = {
    # ── Food & Drinks ───────────────────────────────────────
    "coffee": {
        "name": "Coffee",
        "description": "Hot coffee boosts caffeine by 25",
        "cost_nxt": 3,
        "effect": {"type": "caffeine_boost", "value": 25},
    },
    "carrot": {
        "name": "Carrot",
        "description": "Quick snack. Light energy boost.",
        "cost_nxt": 8,
        "effect": {"type": "energy_boost", "value": 5},
    },
    "pizza": {
        "name": "Pizza",
        "description": "Solid meal. Good energy restore.",
        "cost_nxt": 20,
        "effect": {"type": "energy_boost", "value": 10},
    },
    "burger": {
        "name": "Burger",
        "description": "Full meal. Maximum energy.",
        "cost_nxt": 40,
        "effect": {"type": "energy_boost", "value": 18},
    },
    # ── Maintenance & Fixes ─────────────────────────────────
    "pc_repair": {
        "name": "Run Diagnostic",
        "description": "Full PC repair to 100%",
        "cost_nxt": 8,
        "effect": {"type": "pc_repair"},
    },
    "fix_bugs": {
        "name": "Bug Fix",
        "description": "Fix 15 bugs (costs 5 energy, +3 knowledge)",
        "cost_nxt": 0,
        "cost_energy": 5,
        "effect": {"type": "fix_bugs", "value": 15},
    },
    "mood_reset": {
        "name": "Mood Reset",
        "description": "Reset mood to neutral",
        "cost_nxt": 5,
        "effect": {"type": "mood_reset", "value": "neutral"},
    },
    # ── Social & Knowledge ──────────────────────────────────
    "team_lunch": {
        "name": "Team Lunch",
        "description": "Team lunch boosts social by 20",
        "cost_nxt": 6,
        "effect": {"type": "social_boost", "value": 20},
    },
    "read_docs": {
        "name": "Read Docs",
        "description": "Read documentation, +15 knowledge",
        "cost_nxt": 4,
        "effect": {"type": "knowledge_boost", "value": 15},
    },
    # ── Utility ─────────────────────────────────────────────
    "code_boost": {
        "name": "Code Boost",
        "description": "+15% code quality for next protocol",
        "cost_nxt": 15,
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
        "cost_nxt": 10,
        "effect": {"type": "free_move"},
    },
    "reputation_boost": {
        "name": "Reputation Boost",
        "description": "+10 reputation",
        "cost_nxt": 12,
        "effect": {"type": "reputation_boost", "value": 10},
    },
    # ── Training: Classes (8h, +4, 15 $NXT) ───────────────
    "class_hacking": {
        "name": "Hacking 101",
        "description": "8h class: +4 hacking",
        "cost_nxt": 15,
        "effect": {"type": "training", "stat": "stat_hacking", "bonus": 4, "hours": 8},
    },
    "class_coding": {
        "name": "Code Fundamentals",
        "description": "8h class: +4 coding",
        "cost_nxt": 15,
        "effect": {"type": "training", "stat": "stat_coding", "bonus": 4, "hours": 8},
    },
    "class_trading": {
        "name": "Trading Basics",
        "description": "8h class: +4 trading",
        "cost_nxt": 15,
        "effect": {"type": "training", "stat": "stat_trading", "bonus": 4, "hours": 8},
    },
    "class_social": {
        "name": "Social Engineering",
        "description": "8h class: +4 social",
        "cost_nxt": 15,
        "effect": {"type": "training", "stat": "stat_social", "bonus": 4, "hours": 8},
    },
    "class_endurance": {
        "name": "Endurance Training",
        "description": "8h class: +4 endurance",
        "cost_nxt": 15,
        "effect": {"type": "training", "stat": "stat_endurance", "bonus": 4, "hours": 8},
    },
    # ── Training: Intensive Courses (2h, +2, 40 $NXT) ─────
    "course_hacking": {
        "name": "Speed Hacking",
        "description": "2h intensive: +2 hacking",
        "cost_nxt": 40,
        "effect": {"type": "training", "stat": "stat_hacking", "bonus": 2, "hours": 2},
    },
    "course_coding": {
        "name": "Rapid Coding",
        "description": "2h intensive: +2 coding",
        "cost_nxt": 40,
        "effect": {"type": "training", "stat": "stat_coding", "bonus": 2, "hours": 2},
    },
    "course_trading": {
        "name": "Quick Trading",
        "description": "2h intensive: +2 trading",
        "cost_nxt": 40,
        "effect": {"type": "training", "stat": "stat_trading", "bonus": 2, "hours": 2},
    },
    "course_social": {
        "name": "Fast Networking",
        "description": "2h intensive: +2 social",
        "cost_nxt": 40,
        "effect": {"type": "training", "stat": "stat_social", "bonus": 2, "hours": 2},
    },
    "course_endurance": {
        "name": "Power Endurance",
        "description": "2h intensive: +2 endurance",
        "cost_nxt": 40,
        "effect": {"type": "training", "stat": "stat_endurance", "bonus": 2, "hours": 2},
    },
}

COFFEE_ITEMS = {"coffee", "carrot", "pizza", "burger"}


@router.get("")
async def list_shop_items():
    """Get all available shop items."""
    return [{"id": k, **v} for k, v in SHOP_ITEMS.items()]


@router.get("/training/catalog")
async def get_training_catalog():
    """Return available training items grouped by type."""
    classes = []
    courses = []
    for item_id, item in SHOP_ITEMS.items():
        eff = item.get("effect", {})
        if not isinstance(eff, dict) or eff.get("type") != "training":
            continue
        entry = {
            "id": item_id,
            "name": item["name"],
            "description": item["description"],
            "cost": item["cost_nxt"],
            "stat": eff["stat"].replace("stat_", ""),
            "boost": eff["bonus"],
            "duration_hours": eff["hours"],
            "category": "class" if item_id.startswith("class_") else "course",
        }
        if item_id.startswith("class_"):
            classes.append(entry)
        else:
            courses.append(entry)
    return {"classes": classes, "courses": courses}


@router.get("/training/active")
async def get_active_training(wallet: str = Query(...)):
    """Return devs currently in training for this wallet."""
    addr = validate_wallet(wallet)
    rows = fetch_all(
        "SELECT token_id, name, archetype, corporation, rarity_tier, ipfs_hash, "
        "       training_course, training_ends_at, "
        "       stat_hacking, stat_coding, stat_trading, stat_social, stat_endurance "
        "FROM devs WHERE LOWER(owner_address) = %s AND training_course IS NOT NULL "
        "ORDER BY training_ends_at ASC",
        (addr,)
    )
    now = datetime.now(timezone.utc)
    result = []
    for r in rows:
        item = SHOP_ITEMS.get(r["training_course"], {})
        eff = item.get("effect", {})
        duration_h = eff.get("hours", 4)
        total_s = duration_h * 3600
        ends = r["training_ends_at"]
        remaining = max(0, (ends - now).total_seconds()) if ends else 0
        elapsed = total_s - remaining
        pct = min(100, int((elapsed / total_s) * 100)) if total_s > 0 else 100
        result.append({
            "token_id": r["token_id"], "name": r["name"],
            "archetype": r["archetype"], "ipfs_hash": r["ipfs_hash"],
            "training_course": r["training_course"],
            "training_name": item.get("name", r["training_course"]),
            "stat": eff.get("stat", "").replace("stat_", ""),
            "boost": eff.get("bonus", 0),
            "ends_at": ends.isoformat() if ends else None,
            "remaining_seconds": int(remaining),
            "progress": pct,
            "can_graduate": remaining <= 0,
        })
    return {"training_devs": result}


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
                "SELECT token_id, owner_address, balance_nxt, name, energy, max_energy, training_course, bugs_shipped, social_vitality, knowledge FROM devs WHERE token_id = %s FOR UPDATE",
                (req.target_dev_id,)
            )
            dev = cur.fetchone()
            if not dev:
                raise HTTPException(404, "Dev not found")
            if dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")
            event_fx = get_active_event_effects(cur)
            item_cost = item["cost_nxt"]
            if item_cost > 0:
                item_cost = max(1, int(item_cost * event_fx.get("shop_cost_multiplier", 1.0)))

            cost_energy = item.get("cost_energy", 0)
            if cost_energy > 0:
                if dev["energy"] < cost_energy:
                    raise HTTPException(400, f"Not enough energy. Need {cost_energy}, have {dev['energy']}")
            elif dev["balance_nxt"] < item_cost:
                raise HTTPException(400, f"Not enough $NXT. Need {item_cost}, have {dev['balance_nxt']}")

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
                    (item_cost, item_cost, req.target_dev_id)
                )
            cur.execute(
                """INSERT INTO shop_purchases (player_address, target_dev_id, item_type, item_effect, nxt_cost)
                   VALUES (%s, %s, %s, %s::jsonb, %s) RETURNING id""",
                (addr, req.target_dev_id, req.item_id,
                 json.dumps(effect), item_cost)
            )
            purchase = cur.fetchone()

            # Apply immediate effects and build changes list for frontend animations
            changes = []
            # Record cost change
            if cost_energy > 0:
                changes.append({"stat": "energy", "amount": -cost_energy, "type": "spend"})
            elif item_cost > 0:
                changes.append({"stat": "$NXT", "amount": -item_cost, "type": "spend"})

            if effect["type"] == "energy_boost":
                cur.execute(
                    "UPDATE devs SET energy = LEAST(energy + %s, max_energy) WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
                if req.item_id in COFFEE_ITEMS:
                    cur.execute(
                        "UPDATE devs SET coffee_count = coffee_count + 1 WHERE token_id = %s",
                        (req.target_dev_id,)
                    )
                changes.append({"stat": "energy", "amount": effect["value"], "type": "gain"})
            elif effect["type"] == "caffeine_boost":
                cur.execute(
                    "UPDATE devs SET caffeine = LEAST(100, caffeine + %s), coffee_count = coffee_count + 1 WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
                changes.append({"stat": "caffeine", "amount": effect["value"], "type": "gain"})
            elif effect["type"] == "mood_reset":
                cur.execute(
                    "UPDATE devs SET mood = %s WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
                changes.append({"stat": "mood", "amount": 0, "type": "gain"})
            elif effect["type"] == "reputation_boost":
                cur.execute(
                    "UPDATE devs SET reputation = reputation + %s WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
                changes.append({"stat": "reputation", "amount": effect["value"], "type": "gain"})
            elif effect["type"] == "pc_repair":
                cur.execute(
                    "UPDATE devs SET pc_health = 100 WHERE token_id = %s",
                    (req.target_dev_id,)
                )
                changes.append({"stat": "pc", "amount": 100, "type": "gain"})
            elif effect["type"] == "fix_bugs":
                bugs_to_fix = min(dev.get("bugs_shipped", 0), effect["value"])
                knowledge_gain = 3
                cur.execute(
                    "UPDATE devs SET bugs_shipped = GREATEST(0, bugs_shipped - %s), "
                    "bugs_fixed = COALESCE(bugs_fixed, 0) + %s, "
                    "knowledge = LEAST(100, knowledge + %s) "
                    "WHERE token_id = %s",
                    (bugs_to_fix, bugs_to_fix, knowledge_gain, req.target_dev_id)
                )
                changes.append({"stat": "bugs", "amount": -bugs_to_fix, "type": "gain"})
                changes.append({"stat": "knowledge", "amount": knowledge_gain, "type": "gain"})
            elif effect["type"] == "social_boost":
                cur.execute(
                    "UPDATE devs SET social_vitality = LEAST(100, social_vitality + %s) WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
                changes.append({"stat": "social", "amount": effect["value"], "type": "gain"})
            elif effect["type"] == "knowledge_boost":
                cur.execute(
                    "UPDATE devs SET knowledge = LEAST(100, knowledge + %s) WHERE token_id = %s",
                    (effect["value"], req.target_dev_id)
                )
                changes.append({"stat": "knowledge", "amount": effect["value"], "type": "gain"})
            elif effect["type"] == "training":
                ends_at = datetime.now(timezone.utc) + timedelta(hours=effect["hours"])
                cur.execute(
                    "UPDATE devs SET training_course = %s, training_ends_at = %s WHERE token_id = %s",
                    (req.item_id, ends_at, req.target_dev_id)
                )

            # Re-fetch dev with updated values so frontend can use directly
            cur.execute("SELECT * FROM devs WHERE token_id = %s", (req.target_dev_id,))
            updated_dev = cur.fetchone()

    return {
        "purchase_id": purchase["id"],
        "item": req.item_id,
        "cost": item_cost,
        "dev": dev["name"],
        "status": "applied",
        "changes": changes,
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

            # Apply stat bonus permanently, clear training, +10 knowledge bonus
            knowledge_bonus = 10
            cur.execute(
                f"UPDATE devs SET {stat} = LEAST({stat} + %s, 100), "
                "knowledge = LEAST(100, knowledge + %s), "
                "training_course = NULL, training_ends_at = NULL WHERE token_id = %s",
                (bonus, knowledge_bonus, req.dev_id)
            )

    return {
        "dev": dev["name"],
        "stat": stat,
        "bonus": bonus,
        "status": "graduated",
        "changes": [
            {"stat": stat.replace("stat_", ""), "amount": bonus, "type": "gain"},
            {"stat": "knowledge", "amount": knowledge_bonus, "type": "gain"},
        ],
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

# Player hack (PvP) constants — higher risk, higher reward
HACK_PLAYER_COST = 25
HACK_PLAYER_BASE_SUCCESS = 0.25
HACK_PLAYER_STEAL_MIN = 30
HACK_PLAYER_STEAL_MAX = 60
HACK_PLAYER_SOCIAL_GAIN = 8


def _resolve_mega_name(addr: str) -> str:
    """Resolve a wallet to a .mega name via dotmega.domains, falling back
    to the truncated 0x…abcd format on any failure. Always returns a
    printable label — never raises — so a dotmega outage can't break
    /shop/hack-player or any other caller. Called once per successful
    PvP hack (capped by the 24h per-attacker cooldown), so the extra
    HTTPS latency is bounded.
    """
    if not addr:
        return "???"
    fallback = f"{addr[:6]}...{addr[-4:]}"
    try:
        r = http_requests.get(
            f"https://api.dotmega.domains/resolve?address={addr.lower()}",
            timeout=3,
        )
        if r.status_code != 200:
            return fallback
        data = r.json()
        return data.get("name") or fallback
    except Exception:
        return fallback


@router.post("/hack-mainframe")
async def hack_mainframe(req: HackRequest):
    """Hack the corporate mainframe. Reward from treasury."""
    addr = validate_wallet(req.player_address)
    shop_limiter.check(f"hack_mainframe:{addr}")

    with get_db() as conn:
        with conn.cursor() as cur:
            # Lock attacker
            cur.execute(
                "SELECT token_id, owner_address, balance_nxt, name, corporation, stat_hacking, last_raid_at, social_vitality, archetype FROM devs WHERE token_id = %s FOR UPDATE",
                (req.attacker_dev_id,)
            )
            attacker = cur.fetchone()
            if not attacker:
                raise HTTPException(404, "Dev not found")
            if attacker["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")

            event_fx = get_active_event_effects(cur)
            effective_cost = max(1, int(HACK_COST * event_fx.get("hack_cost_multiplier", 1.0)))

            if attacker["balance_nxt"] < effective_cost:
                raise HTTPException(400, detail={
                    "error": "insufficient_funds",
                    "message": f"Need {effective_cost} $NXT to hack. You have {attacker['balance_nxt']}.",
                    "required": effective_cost,
                    "current": attacker["balance_nxt"],
                })

            # Check cooldown (shared with hack-player)
            now = datetime.now(timezone.utc)
            if attacker.get("last_raid_at"):
                cooldown_end = attacker["last_raid_at"] + timedelta(hours=HACK_COOLDOWN_HOURS)
                if now < cooldown_end:
                    rem = (cooldown_end - now).total_seconds()
                    raise HTTPException(400, detail={
                        "error": "cooldown",
                        "message": f"Systems on lockdown. {int(rem // 3600)}h {int((rem % 3600) // 60)}m remaining.",
                        "remaining_seconds": int(rem),
                        "remaining_hours": int(rem // 3600),
                        "remaining_minutes": int((rem % 3600) // 60),
                    })

            # Check social threshold
            if attacker.get("social_vitality", 50) < 15:
                raise HTTPException(400, detail={
                    "error": "low_social",
                    "message": "Social too low. Your dev has no street cred.",
                    "required": 15,
                    "current": attacker.get("social_vitality", 50),
                })

            # Deduct cost and set cooldown
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt - %s, total_spent = total_spent + %s, last_raid_at = %s WHERE token_id = %s",
                (effective_cost, effective_cost, now, req.attacker_dev_id)
            )

            # Calculate success probability: 40% base + hacking_stat/200 (max ~85%)
            success_prob = HACK_BASE_SUCCESS + (attacker["stat_hacking"] / 200.0)
            success_prob += event_fx.get("hack_success_bonus", 0.0)
            success = random.random() < success_prob

            if success:
                steal_amount = random.randint(HACK_STEAL_MIN, HACK_STEAL_MAX)
                # Credit the dev (from treasury)
                cur.execute(
                    "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
                    (steal_amount, steal_amount, req.attacker_dev_id)
                )
                # Shadow-write to nxt_ledger (Fase 3C). No natural id
                # for the raid event in this codepath — using
                # int(time.time() * 1000) gives ms-precision uniqueness;
                # cooldown of 24h between raids per dev makes a same-ms
                # collision practically impossible.
                if is_shadow_write_enabled():
                    raid_event_id = int(time.time() * 1000)
                    try:
                        ledger_insert(
                            cur,
                            wallet_address=attacker["owner_address"],
                            dev_token_id=req.attacker_dev_id,
                            delta_nxt=steal_amount,
                            source=LedgerSource.HACK_MAINFRAME_WIN,
                            ref_table="hack_mainframe",
                            ref_id=raid_event_id,
                        )
                    except Exception as _e:  # noqa: BLE001
                        log.warning(
                            "ledger_shadow_write_failed source=hack_mainframe_win "
                            "dev=%s error=%s",
                            req.attacker_dev_id, _e,
                        )
                # Log action
                cur.execute(
                    """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                       VALUES (%s, %s, %s, 'HACK_MAINFRAME', %s::jsonb, 0, %s)""",
                    (req.attacker_dev_id, attacker["name"], attacker["archetype"],
                     json.dumps({"success": True, "stolen": steal_amount}),
                     effective_cost)
                )
                # Social boost
                social_gain = 5
                cur.execute(
                    "UPDATE devs SET social_vitality = LEAST(100, social_vitality + %s) WHERE token_id = %s",
                    (social_gain, req.attacker_dev_id)
                )
                result = {
                    "success": True, "hack_success": True, "hack_type": "mainframe",
                    "stolen": steal_amount, "cost": effective_cost,
                    "net_gain": steal_amount - effective_cost,
                    "target_name": "CORPORATE MAINFRAME",
                    "target_corp": attacker["corporation"],
                    "message": f"Extracted {steal_amount} $NXT from corporate mainframe",
                    "changes": [
                        {"stat": "$NXT", "amount": -effective_cost, "type": "spend"},
                        {"stat": "$NXT", "amount": steal_amount, "type": "gain"},
                        {"stat": "social", "amount": social_gain, "type": "gain"},
                    ],
                }
            else:
                # Failed — cost is lost
                cur.execute(
                    """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                       VALUES (%s, %s, %s, 'HACK_MAINFRAME', %s::jsonb, 0, %s)""",
                    (req.attacker_dev_id, attacker["name"], attacker["archetype"],
                     json.dumps({"success": False}),
                     effective_cost)
                )
                result = {
                    "success": True, "hack_success": False, "hack_type": "mainframe",
                    "stolen": 0, "cost": effective_cost,
                    "net_gain": -effective_cost,
                    "target_name": "CORPORATE MAINFRAME",
                    "target_corp": None,
                    "message": f"Firewall detected intrusion. {effective_cost} $NXT seized by security.",
                    "changes": [
                        {"stat": "$NXT", "amount": -effective_cost, "type": "spend"},
                    ],
                }

            # Record in shop_purchases
            cur.execute(
                """INSERT INTO shop_purchases (player_address, target_dev_id, item_type, item_effect, nxt_cost)
                   VALUES (%s, %s, 'hack_mainframe', %s::jsonb, %s)""",
                (addr, req.attacker_dev_id, json.dumps(result), effective_cost)
            )

            if success:
                admin_log_event(
                    cur,
                    event_type="hack_mainframe_success",
                    wallet_address=addr,
                    dev_token_id=req.attacker_dev_id,
                    payload={
                        "steal_amount": steal_amount,
                        "effective_cost": effective_cost,
                    },
                )

    log_info(
        log,
        "shop.hack_mainframe.executed",
        wallet=addr,
        attacker_dev_id=req.attacker_dev_id,
        hack_success=result.get("hack_success"),
        cost=result.get("cost"),
        amount_nxt=result.get("stolen"),
    )
    return result


@router.post("/hack-player")
async def hack_player(req: HackRequest):
    """Attempt to hack a random dev from another corporation."""
    addr = validate_wallet(req.player_address)
    shop_limiter.check(f"hack_player:{addr}")

    with get_db() as conn:
        with conn.cursor() as cur:
            # Lock attacker
            cur.execute(
                "SELECT token_id, owner_address, balance_nxt, name, corporation, stat_hacking, last_raid_at, social_vitality, archetype FROM devs WHERE token_id = %s FOR UPDATE",
                (req.attacker_dev_id,)
            )
            attacker = cur.fetchone()
            if not attacker:
                raise HTTPException(404, "Attacker dev not found")
            if attacker["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")

            event_fx = get_active_event_effects(cur)
            effective_cost = max(1, int(HACK_PLAYER_COST * event_fx.get("hack_cost_multiplier", 1.0)))

            if attacker["balance_nxt"] < effective_cost:
                raise HTTPException(400, detail={
                    "error": "insufficient_funds",
                    "message": f"Need {effective_cost} $NXT to hack. You have {attacker['balance_nxt']}.",
                    "required": effective_cost,
                    "current": attacker["balance_nxt"],
                })

            # Check cooldown
            now = datetime.now(timezone.utc)
            if attacker.get("last_raid_at"):
                cooldown_end = attacker["last_raid_at"] + timedelta(hours=HACK_COOLDOWN_HOURS)
                if now < cooldown_end:
                    rem = (cooldown_end - now).total_seconds()
                    raise HTTPException(400, detail={
                        "error": "cooldown",
                        "message": f"Systems on lockdown. {int(rem // 3600)}h {int((rem % 3600) // 60)}m remaining.",
                        "remaining_seconds": int(rem),
                        "remaining_hours": int(rem // 3600),
                        "remaining_minutes": int((rem % 3600) // 60),
                    })

            # Check social threshold
            if attacker.get("social_vitality", 50) < 15:
                raise HTTPException(400, detail={
                    "error": "low_social",
                    "message": "Social too low. Your dev has no street cred.",
                    "required": 15,
                    "current": attacker.get("social_vitality", 50),
                })

            # Find random target from another corporation
            cur.execute(
                "SELECT token_id, name, corporation, balance_nxt, owner_address FROM devs WHERE corporation != %s AND status = 'active' AND balance_nxt > 0 ORDER BY RANDOM() LIMIT 1 FOR UPDATE",
                (attacker["corporation"],)
            )
            target = cur.fetchone()
            if not target:
                raise HTTPException(400, detail={
                    "error": "no_targets",
                    "message": "No valid targets found. All devs are broke or protected.",
                })

            # Deduct cost and set cooldown
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt - %s, total_spent = total_spent + %s, last_raid_at = %s WHERE token_id = %s",
                (effective_cost, effective_cost, now, req.attacker_dev_id)
            )

            # Calculate success probability: 25% base + hacking_stat/200 (max ~75%)
            success_prob = HACK_PLAYER_BASE_SUCCESS + (attacker["stat_hacking"] / 200.0)
            success_prob += event_fx.get("hack_success_bonus", 0.0)
            success = random.random() < success_prob

            if success:
                steal_amount = random.randint(HACK_PLAYER_STEAL_MIN, min(HACK_PLAYER_STEAL_MAX, target["balance_nxt"]))
                # Transfer NXT
                cur.execute(
                    "UPDATE devs SET balance_nxt = GREATEST(0, balance_nxt - %s) WHERE token_id = %s",
                    (steal_amount, target["token_id"])
                )
                cur.execute(
                    "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
                    (steal_amount, steal_amount, req.attacker_dev_id)
                )
                # Shadow-write to nxt_ledger (Fase 3C). Both sides
                # of the raid share raid_event_id so the two ledger
                # entries can be joined back into one logical event.
                # Cooldown of 24h between raids per attacker makes a
                # same-ms collision practically impossible.
                if is_shadow_write_enabled():
                    raid_event_id = int(time.time() * 1000)
                    try:
                        ledger_insert(
                            cur,
                            wallet_address=attacker["owner_address"],
                            dev_token_id=req.attacker_dev_id,
                            delta_nxt=steal_amount,
                            source=LedgerSource.HACK_RAID_ATTACKER_WIN,
                            ref_table="hack_raids",
                            ref_id=raid_event_id,
                        )
                    except Exception as _e:  # noqa: BLE001
                        log.warning(
                            "ledger_shadow_write_failed source=hack_raid_attacker_win "
                            "dev=%s error=%s",
                            req.attacker_dev_id, _e,
                        )
                    try:
                        ledger_insert(
                            cur,
                            wallet_address=target["owner_address"],
                            dev_token_id=target["token_id"],
                            delta_nxt=-steal_amount,
                            source=LedgerSource.HACK_RAID_TARGET_LOSS,
                            ref_table="hack_raids",
                            ref_id=raid_event_id,
                        )
                    except Exception as _e:  # noqa: BLE001
                        log.warning(
                            "ledger_shadow_write_failed source=hack_raid_target_loss "
                            "dev=%s error=%s",
                            target["token_id"], _e,
                        )
                # Log action
                cur.execute(
                    """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                       VALUES (%s, %s, %s, 'HACK_RAID', %s::jsonb, 0, %s)""",
                    (req.attacker_dev_id, attacker["name"], attacker["archetype"],
                     json.dumps({"success": True, "target_id": target["token_id"], "target_name": target["name"],
                                 "target_corp": target["corporation"], "stolen": steal_amount}),
                     effective_cost)
                )
                # Notify target owner
                if target.get("owner_address"):
                    # Prefer the attacker's .mega name in the breach notice
                    # for a friendlier UX. Falls back to truncated wallet on
                    # any dotmega failure so the hack still notifies on
                    # schedule even if the resolver is down.
                    attacker_wallet = _resolve_mega_name(attacker["owner_address"])
                    cur.execute(
                        """INSERT INTO notifications (player_address, type, title, body, dev_id)
                           VALUES (%s, 'hack_received', %s, %s, %s)""",
                        (target["owner_address"].lower(),
                         f"⚠ SECURITY BREACH — {target['name']} was hacked",
                         f"Your dev {target['name']} [{target['corporation']}] was hacked.\n"
                         f"Lost: {steal_amount} $NXT\n"
                         f"Attacker: {attacker['name']} [{attacker['corporation']}]\n"
                         f"Wallet: {attacker_wallet}",
                         target["token_id"])
                    )
                # BONUS: Social boosts on successful hack
                social_gain = HACK_PLAYER_SOCIAL_GAIN
                cur.execute(
                    "UPDATE devs SET social_vitality = LEAST(100, social_vitality + %s) WHERE token_id = %s",
                    (social_gain, req.attacker_dev_id)
                )
                result = {
                    "success": True, "hack_success": True, "hack_type": "player",
                    "stolen": steal_amount, "cost": effective_cost,
                    "net_gain": steal_amount - effective_cost,
                    "target_name": target["name"], "target_corp": target["corporation"],
                    "target_owner": target["owner_address"][:6] + "..." + target["owner_address"][-4:],
                    "message": f"Breached {target['name']}'s firewall. Extracted {steal_amount} $NXT.",
                    "changes": [
                        {"stat": "$NXT", "amount": -effective_cost, "type": "spend"},
                        {"stat": "$NXT", "amount": steal_amount, "type": "gain"},
                        {"stat": "social", "amount": social_gain, "type": "gain"},
                    ],
                }
            else:
                # Failed — already lost effective_cost
                cur.execute(
                    """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                       VALUES (%s, %s, %s, 'HACK_RAID', %s::jsonb, 0, %s)""",
                    (req.attacker_dev_id, attacker["name"], attacker["archetype"],
                     json.dumps({"success": False, "target_id": target["token_id"], "target_name": target["name"],
                                 "target_corp": target["corporation"]}),
                     effective_cost)
                )
                # Failed hack: target seizes the cost
                cur.execute(
                    "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
                    (effective_cost, effective_cost, target["token_id"])
                )
                # Shadow-write to nxt_ledger (Fase 3C). The fail path's
                # only balance_nxt UPDATE is the target gaining the cost
                # — the attacker's loss is the unconditional cost
                # deduction at line ~720 which fires for both success
                # and fail outcomes (un-ledgered for now; tracked in the
                # PR description for follow-up).
                if is_shadow_write_enabled():
                    raid_event_id = int(time.time() * 1000)
                    try:
                        ledger_insert(
                            cur,
                            wallet_address=target["owner_address"],
                            dev_token_id=target["token_id"],
                            delta_nxt=effective_cost,
                            source=LedgerSource.HACK_RAID_TARGET_WIN,
                            ref_table="hack_raids",
                            ref_id=raid_event_id,
                        )
                    except Exception as _e:  # noqa: BLE001
                        log.warning(
                            "ledger_shadow_write_failed source=hack_raid_target_win "
                            "dev=%s error=%s",
                            target["token_id"], _e,
                        )
                result = {
                    "success": True, "hack_success": False, "hack_type": "player",
                    "stolen": 0, "cost": effective_cost,
                    "net_gain": -effective_cost,
                    "target_name": target["name"], "target_corp": target["corporation"],
                    "target_owner": target["owner_address"][:6] + "..." + target["owner_address"][-4:],
                    "message": f"Intrusion detected by {target['name']}. {effective_cost} $NXT seized by target.",
                    "changes": [
                        {"stat": "$NXT", "amount": -effective_cost, "type": "spend"},
                    ],
                }

            # Record in shop_purchases for tracking
            cur.execute(
                """INSERT INTO shop_purchases (player_address, target_dev_id, item_type, item_effect, nxt_cost)
                   VALUES (%s, %s, 'hack_raid', %s::jsonb, %s)""",
                (addr, req.attacker_dev_id, json.dumps(result), effective_cost)
            )

            if success:
                admin_log_event(
                    cur,
                    event_type="hack_raid_success",
                    wallet_address=addr,
                    dev_token_id=req.attacker_dev_id,
                    payload={
                        "target_dev_id": target["token_id"],
                        "target_wallet": (target.get("owner_address") or "").lower() or None,
                        "effective_cost": effective_cost,
                        "steal_amount": steal_amount,
                    },
                )
            else:
                admin_log_event(
                    cur,
                    event_type="hack_raid_fail",
                    wallet_address=addr,
                    dev_token_id=req.attacker_dev_id,
                    payload={
                        "target_dev_id": target["token_id"],
                        "effective_cost": effective_cost,
                    },
                )

    log_info(
        log,
        "shop.hack_raid.executed",
        wallet=addr,
        attacker_dev_id=req.attacker_dev_id,
        target_dev_id=target["token_id"],
        hack_success=result.get("hack_success"),
        cost=result.get("cost"),
        amount_nxt=result.get("stolen"),
    )
    return result


# ── Fund Dev (on-chain deposit) ────────────────────────────

_RPC_URL = os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc")
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
                "SELECT token_id, owner_address, balance_nxt, name, archetype FROM devs WHERE token_id = %s FOR UPDATE",
                (req.dev_token_id,)
            )
            dev = cur.fetchone()
            if not dev:
                raise HTTPException(404, "Dev not found")
            if dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")

            # Verify TX on-chain — poll up to 60s to cover RPC indexing lag.
            # MegaETH confirms fast but receipt propagation between nodes can
            # take several seconds under load. If the receipt still doesn't
            # show up by the deadline, the tx may still be confirmed on-chain,
            # so we fall through to the pending-fund queue instead of 400'ing
            # and orphaning the user's funds.
            _FUND_MAX_WAIT_SEC = 60
            _FUND_POLL_INTERVAL_SEC = 2
            receipt = None
            deadline = time.time() + _FUND_MAX_WAIT_SEC
            while time.time() < deadline:
                try:
                    receipt = _rpc("eth_getTransactionReceipt", [req.tx_hash])
                except HTTPException:
                    receipt = None
                if receipt is not None:
                    break
                time.sleep(_FUND_POLL_INTERVAL_SEC)

            if not receipt:
                # RPC hasn't indexed the receipt yet. The tx is most likely
                # already confirmed on-chain — queue it in pending_fund_txs and
                # let the engine worker (process_pending_funds) resolve it
                # asynchronously. Dedup is enforced by funding_txs.tx_hash
                # UNIQUE, so this can never cause a double credit even if the
                # live path later wins a race.
                cur.execute(
                    """INSERT INTO pending_fund_txs
                         (tx_hash, wallet_address, dev_token_id, amount_nxt)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (tx_hash) DO NOTHING""",
                    (req.tx_hash.lower(), addr, req.dev_token_id, amount_int),
                )
                conn.commit()
                log.warning(
                    f"Fund tx {req.tx_hash[:10]}… queued as pending "
                    f"(dev #{req.dev_token_id}, {amount_int} $NXT) — RPC indexing lag"
                )
                return {
                    "status": "pending",
                    "dev": dev["name"],
                    "amount": amount_int,
                    "tx_hash": req.tx_hash.lower(),
                    "message": (
                        "Transaction confirmed on-chain. Credit is being "
                        "processed and will appear in your dev's balance shortly."
                    ),
                }
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
            # Shadow-write to nxt_ledger (Fase 3C). funding_txs.tx_hash
            # is UNIQUE on the table so tx_hash_to_bigint gives a stable
            # cross-callsite key. Note: 3B's pending_funds path uses
            # ref_table="pending_fund_txs" / ref_id=row.id, so a tx that
            # ends up processed by both flows will produce two distinct
            # ledger rows. UNIQUE on funding_txs.tx_hash already
            # prevents the double-credit; the duplicate ledger row is
            # cosmetic and tracked for cleanup.
            if is_shadow_write_enabled():
                try:
                    ledger_insert(
                        cur,
                        wallet_address=addr,
                        dev_token_id=req.dev_token_id,
                        delta_nxt=credit_amount,
                        source=LedgerSource.FUND_DEPOSIT,
                        ref_table="funding_txs",
                        ref_id=tx_hash_to_bigint(req.tx_hash),
                    )
                except Exception as _e:  # noqa: BLE001
                    log.warning(
                        "ledger_shadow_write_failed source=fund_deposit "
                        "tx_hash=%s error=%s",
                        req.tx_hash, _e,
                    )

            # Record action
            cur.execute(
                """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                   VALUES (%s, %s, %s, 'FUND_DEV', %s::jsonb, 0, 0)""",
                (req.dev_token_id, dev["name"], dev["archetype"],
                 json.dumps({"event": "fund_dev", "amount": credit_amount, "tx_hash": req.tx_hash.lower()}))
            )

            # Return updated dev
            cur.execute("SELECT * FROM devs WHERE token_id = %s", (req.dev_token_id,))
            updated_dev = cur.fetchone()

            admin_log_event(
                cur,
                event_type="fund_dev_received",
                wallet_address=addr,
                dev_token_id=req.dev_token_id,
                payload={
                    "tx_hash": req.tx_hash.lower(),
                    "amount_wei": verified_amount_wei,
                    "amount_nxt": credit_amount,
                },
            )

    log_info(
        log,
        "shop.fund_dev.received",
        wallet=addr,
        dev_token_id=req.dev_token_id,
        amount_nxt=credit_amount,
        tx_hash=req.tx_hash.lower(),
    )
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
                "SELECT token_id, owner_address, balance_nxt, name, status, archetype FROM devs WHERE token_id IN (%s, %s) ORDER BY token_id FOR UPDATE",
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
            # Shadow-write to nxt_ledger (Fase 3C). Both sides share
            # transfer_event_id so the two entries can be joined back
            # into one logical transfer. ms-precision id is fine —
            # the same wallet can't issue two transfers in the same ms.
            if is_shadow_write_enabled():
                transfer_event_id = int(time.time() * 1000)
                try:
                    ledger_insert(
                        cur,
                        wallet_address=from_dev["owner_address"],
                        dev_token_id=req.from_dev_token_id,
                        delta_nxt=-req.amount,
                        source=LedgerSource.TRANSFER_OUT,
                        ref_table="transfers",
                        ref_id=transfer_event_id,
                    )
                except Exception as _e:  # noqa: BLE001
                    log.warning(
                        "ledger_shadow_write_failed source=transfer_out "
                        "from_dev=%s error=%s",
                        req.from_dev_token_id, _e,
                    )
                try:
                    ledger_insert(
                        cur,
                        wallet_address=to_dev["owner_address"],
                        dev_token_id=req.to_dev_token_id,
                        delta_nxt=req.amount,
                        source=LedgerSource.TRANSFER_IN,
                        ref_table="transfers",
                        ref_id=transfer_event_id,
                    )
                except Exception as _e:  # noqa: BLE001
                    log.warning(
                        "ledger_shadow_write_failed source=transfer_in "
                        "to_dev=%s error=%s",
                        req.to_dev_token_id, _e,
                    )

            # Record actions for both devs
            cur.execute(
                """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                   VALUES (%s, %s, %s, 'TRANSFER', %s::jsonb, 0, %s)""",
                (req.from_dev_token_id, from_dev["name"], from_dev["archetype"],
                 json.dumps({"event": "transfer_out", "to_dev_id": req.to_dev_token_id,
                             "to_dev_name": to_dev["name"], "amount": req.amount}),
                 req.amount)
            )
            cur.execute(
                """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
                   VALUES (%s, %s, %s, 'TRANSFER', %s::jsonb, 0, 0)""",
                (req.to_dev_token_id, to_dev["name"], to_dev["archetype"],
                 json.dumps({"event": "transfer_in", "from_dev_id": req.from_dev_token_id,
                             "from_dev_name": from_dev["name"], "amount": req.amount}))
            )

            # Return both updated devs
            cur.execute("SELECT * FROM devs WHERE token_id IN (%s, %s)", (req.from_dev_token_id, req.to_dev_token_id))
            updated = cur.fetchall()
            updated_map = {r["token_id"]: dict(r) for r in updated}

            admin_log_event(
                cur,
                event_type="transfer_dev_to_dev",
                wallet_address=(from_dev.get("owner_address") or "").lower() or None,
                dev_token_id=req.from_dev_token_id,
                payload={
                    "to_dev_id": req.to_dev_token_id,
                    "to_wallet": (to_dev.get("owner_address") or "").lower() or None,
                    "amount_nxt": req.amount,
                },
            )

    log_info(
        log,
        "shop.transfer.executed",
        wallet=addr,
        from_dev_token_id=req.from_dev_token_id,
        to_dev_token_id=req.to_dev_token_id,
        amount_nxt=req.amount,
    )
    return {
        "status": "transferred",
        "amount": req.amount,
        "from_dev": from_dev["name"],
        "to_dev": to_dev["name"],
        "updated_from": updated_map.get(req.from_dev_token_id),
        "updated_to": updated_map.get(req.to_dev_token_id),
    }
