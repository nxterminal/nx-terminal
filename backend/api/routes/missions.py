"""Routes: Mission Control — browse, start, claim, abandon missions"""

import json
import logging
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from backend.api.deps import fetch_one, fetch_all, get_db, validate_wallet

log = logging.getLogger("nx_api")

router = APIRouter()

# Stat column mapping
STAT_COLUMNS = {
    'coding': 'stat_coding',
    'hacking': 'stat_hacking',
    'trading': 'stat_trading',
    'social': 'stat_social',
    'endurance': 'stat_endurance',
}

# How many missions to show per difficulty
DIFFICULTY_SLOTS = {
    'easy': 3,
    'medium': 2,
    'hard': 1,
    'extreme': 1,   # only if devCount >= 5
    'legendary': 1, # only if devCount >= 10
}


@router.get("/available")
async def get_available_missions(wallet: str = Query(...)):
    """Get missions available for this player, filtered by dev count and active missions."""
    addr = validate_wallet(wallet)

    with get_db() as conn:
        with conn.cursor() as cur:
            # Player dev count (LOWER for defensive case-insensitive match)
            cur.execute("SELECT COUNT(*) as cnt FROM devs WHERE LOWER(owner_address) = %s", (addr,))
            dev_count = cur.fetchone()["cnt"]

            # Active mission IDs for this wallet (can't start same mission twice)
            cur.execute(
                "SELECT mission_id FROM player_missions WHERE wallet_address = %s AND status = 'in_progress'",
                (addr,)
            )
            active_mission_ids = [r["mission_id"] for r in cur.fetchall()]

            # Devs NOT on mission (available to send)
            cur.execute(
                "SELECT token_id, name, archetype, corporation, rarity_tier, ipfs_hash, "
                "       stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck, "
                "       energy, max_energy, pc_health, balance_nxt "
                "FROM devs WHERE LOWER(owner_address) = %s AND status = 'active'",
                (addr,)
            )
            available_devs = cur.fetchall()

            # All eligible missions
            cur.execute(
                "SELECT * FROM missions WHERE active = true AND min_devs_owned <= %s ORDER BY difficulty, id",
                (dev_count,)
            )
            all_missions = cur.fetchall()

            # Cooldowns: recent claims for this wallet (24h window)
            cur.execute(
                "SELECT dev_token_id, mission_id, claimed_at FROM player_missions "
                "WHERE wallet_address = %s AND status = 'claimed' "
                "AND claimed_at > NOW() - INTERVAL '24 hours'",
                (addr,)
            )
            cooldown_rows = cur.fetchall()

    # Filter out already-active missions
    active_set = set(active_mission_ids)
    missions_pool = [m for m in all_missions if m["id"] not in active_set]

    # Group by difficulty and randomly select per tier
    by_difficulty = {}
    for m in missions_pool:
        by_difficulty.setdefault(m["difficulty"], []).append(m)

    selected = []
    for diff, slots in DIFFICULTY_SLOTS.items():
        # Skip extreme/legendary if not enough devs
        if diff == 'extreme' and dev_count < 5:
            continue
        if diff == 'legendary' and dev_count < 10:
            continue
        pool = by_difficulty.get(diff, [])
        picked = random.sample(pool, min(slots, len(pool)))
        selected.extend(picked)

    return {
        "missions": selected,
        "available_devs": available_devs,
        "dev_count": dev_count,
        "cooldowns": [
            {"dev_token_id": r["dev_token_id"], "mission_id": r["mission_id"],
             "claimed_at": r["claimed_at"].isoformat()}
            for r in cooldown_rows
        ],
    }


@router.get("/active")
async def get_active_missions(wallet: str = Query(...)):
    """Get player's in-progress and completed (unclaimed) missions."""
    addr = validate_wallet(wallet)

    rows = fetch_all(
        "SELECT pm.id as player_mission_id, pm.status, pm.started_at, pm.ends_at, pm.claimed_at, "
        "       pm.dev_token_id, "
        "       m.id as mission_id, m.title, m.description, m.difficulty, m.duration_hours, m.reward_nxt, "
        "       d.name as dev_name, d.archetype as dev_archetype "
        "FROM player_missions pm "
        "JOIN missions m ON pm.mission_id = m.id "
        "LEFT JOIN devs d ON pm.dev_token_id = d.token_id "
        "WHERE pm.wallet_address = %s AND pm.status IN ('in_progress', 'completed') "
        "ORDER BY pm.started_at DESC",
        (addr,)
    )
    return rows


@router.get("/history")
async def get_mission_history(wallet: str = Query(...), limit: int = Query(50, le=100)):
    """Get player's completed/claimed mission history."""
    addr = validate_wallet(wallet)

    rows = fetch_all(
        "SELECT pm.id as player_mission_id, pm.status, pm.started_at, pm.ends_at, pm.claimed_at, "
        "       pm.dev_token_id, "
        "       m.title, m.difficulty, m.duration_hours, m.reward_nxt, "
        "       d.name as dev_name, d.archetype as dev_archetype "
        "FROM player_missions pm "
        "JOIN missions m ON pm.mission_id = m.id "
        "LEFT JOIN devs d ON pm.dev_token_id = d.token_id "
        "WHERE pm.wallet_address = %s AND pm.status IN ('claimed', 'abandoned') "
        "ORDER BY pm.claimed_at DESC NULLS LAST "
        "LIMIT %s",
        (addr, limit)
    )
    return rows


class MissionStartRequest(BaseModel):
    wallet: str
    mission_id: int
    dev_token_id: int


@router.post("/start")
async def start_mission(req: MissionStartRequest):
    """Send a dev on a mission."""
    addr = validate_wallet(req.wallet)

    with get_db() as conn:
        with conn.cursor() as cur:
            # Get mission
            cur.execute("SELECT * FROM missions WHERE id = %s AND active = true", (req.mission_id,))
            mission = cur.fetchone()
            if not mission:
                raise HTTPException(404, "Mission not found")

            # Get dev (locked)
            cur.execute(
                "SELECT token_id, owner_address, name, archetype, status, "
                "       stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance "
                "FROM devs WHERE token_id = %s FOR UPDATE",
                (req.dev_token_id,)
            )
            dev = cur.fetchone()
            if not dev:
                raise HTTPException(404, "Dev not found")
            if dev["owner_address"].lower() != addr:
                raise HTTPException(403, "You don't own this dev")
            if dev["status"] != 'active':
                raise HTTPException(400, f"Dev is not available (status: {dev['status']})")

            # Belt-and-suspenders: check player_missions table directly
            cur.execute(
                "SELECT id FROM player_missions WHERE dev_token_id = %s AND status = 'in_progress'",
                (req.dev_token_id,)
            )
            if cur.fetchone():
                raise HTTPException(400, "This dev is already on a mission")

            # Check player dev count for min_devs_owned
            cur.execute("SELECT COUNT(*) as cnt FROM devs WHERE LOWER(owner_address) = %s", (addr,))
            dev_count = cur.fetchone()["cnt"]
            if dev_count < mission["min_devs_owned"]:
                raise HTTPException(400, f"Need at least {mission['min_devs_owned']} devs for this mission")

            # Check stat requirement
            if mission["min_stat"] and mission["min_stat_value"] > 0:
                stat_col = STAT_COLUMNS.get(mission["min_stat"])
                if stat_col and dev.get(stat_col, 0) < mission["min_stat_value"]:
                    raise HTTPException(400,
                        f"Dev needs {mission['min_stat']} >= {mission['min_stat_value']} "
                        f"(has {dev.get(stat_col, 0)})")

            # Check mission not already active for this wallet
            cur.execute(
                "SELECT id FROM player_missions WHERE wallet_address = %s AND mission_id = %s AND status = 'in_progress'",
                (addr, req.mission_id)
            )
            if cur.fetchone():
                raise HTTPException(400, "You already have this mission active")

            # Check 24h cooldown — same dev + same mission
            cur.execute(
                "SELECT claimed_at FROM player_missions "
                "WHERE dev_token_id = %s AND mission_id = %s AND status = 'claimed' "
                "AND claimed_at > NOW() - INTERVAL '24 hours' "
                "ORDER BY claimed_at DESC LIMIT 1",
                (req.dev_token_id, req.mission_id)
            )
            cooldown_row = cur.fetchone()
            if cooldown_row:
                remaining = cooldown_row['claimed_at'] + timedelta(hours=24) - datetime.now(cooldown_row['claimed_at'].tzinfo)
                hours_left = max(1, int(remaining.total_seconds() / 3600))
                raise HTTPException(400,
                    f"This dev completed this mission recently. Available again in ~{hours_left}h.")

            # Start mission
            cur.execute(
                "INSERT INTO player_missions (wallet_address, mission_id, dev_token_id, ends_at) "
                "VALUES (%s, %s, %s, NOW() + INTERVAL '%s hours') RETURNING id, ends_at",
                (addr, req.mission_id, req.dev_token_id, mission["duration_hours"])
            )
            pm = cur.fetchone()

            # Set dev on mission
            cur.execute("UPDATE devs SET status = 'on_mission' WHERE token_id = %s", (req.dev_token_id,))

            # Record action
            cur.execute(
                "INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost) "
                "VALUES (%s, %s, %s::archetype_enum, 'MISSION_START'::action_enum, %s, 0, 0)",
                (req.dev_token_id, dev["name"], dev["archetype"],
                 json.dumps({"mission_id": req.mission_id, "title": mission["title"],
                             "duration_hours": mission["duration_hours"]}))
            )

    return {
        "success": True,
        "player_mission_id": pm["id"],
        "ends_at": pm["ends_at"].isoformat(),
        "message": f"{dev['name']} sent on mission: {mission['title']}"
    }


class MissionClaimRequest(BaseModel):
    wallet: str
    player_mission_id: int


@router.post("/claim")
async def claim_mission(req: MissionClaimRequest):
    """Claim reward from a completed mission."""
    addr = validate_wallet(req.wallet)

    with get_db() as conn:
        with conn.cursor() as cur:
            # Get player mission (locked)
            cur.execute(
                "SELECT pm.*, m.title, m.reward_nxt, m.difficulty "
                "FROM player_missions pm JOIN missions m ON pm.mission_id = m.id "
                "WHERE pm.id = %s FOR UPDATE",
                (req.player_mission_id,)
            )
            pm = cur.fetchone()
            if not pm:
                raise HTTPException(404, "Mission not found")
            if pm["wallet_address"].lower() != addr:
                raise HTTPException(403, "Not your mission")
            if pm["status"] != 'in_progress':
                raise HTTPException(400, f"Mission status is '{pm['status']}', not claimable")
            if pm["ends_at"] > __import__('datetime').datetime.now(pm["ends_at"].tzinfo):
                raise HTTPException(400, "Mission not yet completed")

            reward = pm["reward_nxt"]

            # Credit reward to dev
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s, status = 'active' "
                "WHERE token_id = %s RETURNING name, archetype",
                (reward, reward, pm["dev_token_id"])
            )
            dev = cur.fetchone()

            # Update mission status
            cur.execute(
                "UPDATE player_missions SET status = 'claimed', claimed_at = NOW() WHERE id = %s",
                (req.player_mission_id,)
            )

            # Record action
            if dev:
                cur.execute(
                    "INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost) "
                    "VALUES (%s, %s, %s::archetype_enum, 'MISSION_COMPLETE'::action_enum, %s, 0, %s)",
                    (pm["dev_token_id"], dev["name"], dev["archetype"],
                     json.dumps({"mission_id": pm["mission_id"], "title": pm["title"],
                                 "reward_nxt": reward, "difficulty": pm["difficulty"]}),
                     -reward)  # negative cost = earned
                )

    return {
        "success": True,
        "reward_nxt": reward,
        "message": f"Mission complete! +{reward} $NXT added to {dev['name'] if dev else 'Dev'}'s in-game balance. Withdraw anytime from NXT Wallet."
    }


class MissionAbandonRequest(BaseModel):
    wallet: str
    player_mission_id: int


@router.post("/abandon")
async def abandon_mission(req: MissionAbandonRequest):
    """Abandon a mission. Dev returns with no reward."""
    addr = validate_wallet(req.wallet)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM player_missions WHERE id = %s",
                (req.player_mission_id,)
            )
            pm = cur.fetchone()
            if not pm:
                raise HTTPException(404, "Mission not found")
            if pm["wallet_address"].lower() != addr:
                raise HTTPException(403, "Not your mission")
            if pm["status"] != 'in_progress':
                raise HTTPException(400, "Mission not in progress")

            # Abandon
            cur.execute(
                "UPDATE player_missions SET status = 'abandoned' WHERE id = %s",
                (req.player_mission_id,)
            )

            # Return dev to active
            cur.execute(
                "UPDATE devs SET status = 'active' WHERE token_id = %s",
                (pm["dev_token_id"],)
            )

    return {"success": True, "message": "Mission abandoned. Dev returned."}
