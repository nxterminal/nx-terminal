"""Routes: Mission Control — browse, start, claim, abandon missions"""

import json
import logging
import random
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from backend.api.deps import fetch_one, fetch_all, get_db, validate_wallet
from backend.services.logging_helpers import log_info
from backend.services.admin_log import log_event as admin_log_event

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
    'easy': 2,
    'medium': 2,
    'hard': 1,
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
        # Skip legendary if not enough devs
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
        "       pm.dev_token_id, pm.group_id, "
        "       m.id as mission_id, m.title, m.description, m.difficulty, m.duration_hours, m.reward_nxt, "
        "       d.name as dev_name, d.archetype as dev_archetype, d.ipfs_hash as dev_ipfs_hash "
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
        "       d.name as dev_name, d.archetype as dev_archetype, d.ipfs_hash as dev_ipfs_hash "
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
    dev_token_ids: list[int]  # multi-dev support


@router.post("/start")
async def start_mission(req: MissionStartRequest):
    """Send devs on a mission."""
    addr = validate_wallet(req.wallet)

    with get_db() as conn:
        with conn.cursor() as cur:
            # Get mission
            cur.execute("SELECT * FROM missions WHERE id = %s AND active = true", (req.mission_id,))
            mission = cur.fetchone()
            if not mission:
                raise HTTPException(404, "Mission not found")

            required_devs = mission.get("required_devs", 1)
            if len(req.dev_token_ids) != required_devs:
                raise HTTPException(400,
                    f"This mission requires exactly {required_devs} dev(s). You selected {len(req.dev_token_ids)}.")

            # Check for duplicates in selection
            if len(set(req.dev_token_ids)) != len(req.dev_token_ids):
                raise HTTPException(400, "Duplicate devs in selection")

            # Check player dev count for min_devs_owned
            cur.execute("SELECT COUNT(*) as cnt FROM devs WHERE LOWER(owner_address) = %s", (addr,))
            dev_count = cur.fetchone()["cnt"]
            if dev_count < mission["min_devs_owned"]:
                raise HTTPException(400, f"Need at least {mission['min_devs_owned']} devs for this mission")

            # Check mission not already active for this wallet
            cur.execute(
                "SELECT id FROM player_missions WHERE wallet_address = %s AND mission_id = %s AND status = 'in_progress'",
                (addr, req.mission_id)
            )
            if cur.fetchone():
                raise HTTPException(400, "You already have this mission active")

            # Validate each dev
            devs = []
            for dev_id in req.dev_token_ids:
                cur.execute(
                    "SELECT token_id, owner_address, name, archetype, status, "
                    "       stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance "
                    "FROM devs WHERE token_id = %s FOR UPDATE",
                    (dev_id,)
                )
                dev = cur.fetchone()
                if not dev:
                    raise HTTPException(404, f"Dev #{dev_id} not found")
                if dev["owner_address"].lower() != addr:
                    raise HTTPException(403, f"You don't own dev #{dev_id}")
                if dev["status"] != 'active':
                    raise HTTPException(400, f"{dev['name']} is not available (status: {dev['status']})")

                # Check not already on mission in player_missions
                cur.execute(
                    "SELECT id FROM player_missions WHERE dev_token_id = %s AND status = 'in_progress'",
                    (dev_id,)
                )
                if cur.fetchone():
                    raise HTTPException(400, f"{dev['name']} is already on a mission")

                # Check stat requirement
                if mission["min_stat"] and mission["min_stat_value"] > 0:
                    stat_col = STAT_COLUMNS.get(mission["min_stat"])
                    if stat_col and dev.get(stat_col, 0) < mission["min_stat_value"]:
                        raise HTTPException(400,
                            f"{dev['name']} needs {mission['min_stat']} >= {mission['min_stat_value']} "
                            f"(has {dev.get(stat_col, 0)})")

                # Check 24h cooldown
                cur.execute(
                    "SELECT claimed_at FROM player_missions "
                    "WHERE dev_token_id = %s AND mission_id = %s AND status = 'claimed' "
                    "AND claimed_at > NOW() - INTERVAL '24 hours' "
                    "ORDER BY claimed_at DESC LIMIT 1",
                    (dev_id, req.mission_id)
                )
                cooldown_row = cur.fetchone()
                if cooldown_row:
                    from datetime import timezone as tz
                    remaining = cooldown_row['claimed_at'] + timedelta(hours=24) - datetime.now(cooldown_row['claimed_at'].tzinfo)
                    hours_left = max(1, int(remaining.total_seconds() / 3600))
                    raise HTTPException(400,
                        f"{dev['name']} completed this mission recently. Available again in ~{hours_left}h.")

                devs.append(dev)

            # All validations passed — create mission entries
            group_id = str(uuid.uuid4())

            first_pm = None
            for dev in devs:
                cur.execute(
                    "INSERT INTO player_missions (wallet_address, mission_id, dev_token_id, group_id, ends_at) "
                    "VALUES (%s, %s, %s, %s, NOW() + INTERVAL '%s hours') RETURNING id, ends_at",
                    (addr, req.mission_id, dev["token_id"], group_id, mission["duration_hours"])
                )
                pm = cur.fetchone()
                if not first_pm:
                    first_pm = pm

                # Set dev on mission
                cur.execute("UPDATE devs SET status = 'on_mission' WHERE token_id = %s", (dev["token_id"],))

                # Record action
                cur.execute(
                    "INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost) "
                    "VALUES (%s, %s, %s::archetype_enum, 'MISSION_START'::action_enum, %s, 0, 0)",
                    (dev["token_id"], dev["name"], dev["archetype"],
                     json.dumps({"mission_id": req.mission_id, "title": mission["title"],
                                 "duration_hours": mission["duration_hours"], "group_id": group_id}))
                )

    dev_names = ", ".join(d["name"] for d in devs)
    return {
        "success": True,
        "group_id": group_id,
        "player_mission_id": first_pm["id"],
        "ends_at": first_pm["ends_at"].isoformat(),
        "message": f"{dev_names} sent on mission: {mission['title']}"
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
            # Get the specific player_mission
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

            # Find all entries in this group
            group_id = pm.get("group_id")
            if group_id:
                cur.execute(
                    "SELECT pm2.id, pm2.dev_token_id, pm2.status FROM player_missions pm2 "
                    "WHERE pm2.group_id = %s AND pm2.status = 'in_progress' FOR UPDATE",
                    (group_id,)
                )
                group_rows = cur.fetchall()
            else:
                group_rows = [{"id": pm["id"], "dev_token_id": pm["dev_token_id"], "status": pm["status"]}]

            reward = pm["reward_nxt"]
            num_devs = len(group_rows)
            reward_per_dev = reward // num_devs
            remainder = reward % num_devs

            claimed_devs = []
            for i, row in enumerate(group_rows):
                dev_reward = reward_per_dev + (1 if i < remainder else 0)

                # Credit reward to dev and return to active
                cur.execute(
                    "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s, status = 'active' "
                    "WHERE token_id = %s RETURNING name, archetype",
                    (dev_reward, dev_reward, row["dev_token_id"])
                )
                dev = cur.fetchone()
                claimed_devs.append({"token_id": row["dev_token_id"], "name": dev["name"] if dev else "?", "reward": dev_reward})

                # Update mission status
                cur.execute(
                    "UPDATE player_missions SET status = 'claimed', claimed_at = NOW() WHERE id = %s",
                    (row["id"],)
                )

                # Record action
                if dev:
                    cur.execute(
                        "INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost) "
                        "VALUES (%s, %s, %s::archetype_enum, 'MISSION_COMPLETE'::action_enum, %s, 0, %s)",
                        (row["dev_token_id"], dev["name"], dev["archetype"],
                         json.dumps({"mission_id": pm["mission_id"], "title": pm["title"],
                                     "reward_nxt": dev_reward, "difficulty": pm["difficulty"],
                                     "group_id": group_id}),
                         -dev_reward)
                    )

            admin_log_event(
                cur,
                event_type="mission_claimed",
                wallet_address=pm["wallet_address"],
                payload={
                    "mission_id": pm["mission_id"],
                    "reward_nxt": reward,
                    "num_devs": num_devs,
                    "player_mission_id": req.player_mission_id,
                },
            )

    log_info(
        log,
        "mission.claimed",
        wallet=addr,
        mission_id=pm["mission_id"],
        player_mission_id=req.player_mission_id,
        reward_nxt=reward,
        count=num_devs,
    )
    return {
        "success": True,
        "reward_nxt": reward,
        "reward_per_dev": reward_per_dev,
        "devs_returned": num_devs,
        "claimed_devs": claimed_devs,
        "message": f"Mission complete! +{reward} $NXT split among {num_devs} dev(s). Withdraw anytime from NXT Wallet."
    }


class MissionAbandonRequest(BaseModel):
    wallet: str
    player_mission_id: int


@router.post("/abandon")
async def abandon_mission(req: MissionAbandonRequest):
    """Abandon a mission. All devs return with no reward."""
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

            # Find all entries in this group
            group_id = pm.get("group_id")
            if group_id:
                cur.execute(
                    "SELECT id, dev_token_id FROM player_missions WHERE group_id = %s AND status = 'in_progress'",
                    (group_id,)
                )
                group_rows = cur.fetchall()
            else:
                group_rows = [{"id": pm["id"], "dev_token_id": pm["dev_token_id"]}]

            for row in group_rows:
                cur.execute("UPDATE player_missions SET status = 'abandoned' WHERE id = %s", (row["id"],))
                cur.execute("UPDATE devs SET status = 'active' WHERE token_id = %s", (row["dev_token_id"],))

    return {"success": True, "message": f"Mission abandoned. {len(group_rows)} dev(s) returned.", "devs_returned": len(group_rows)}
