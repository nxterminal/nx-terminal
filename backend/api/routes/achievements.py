"""Routes: Achievements — track, check, and claim achievement rewards"""

import hashlib
import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from backend.api.deps import fetch_one, fetch_all, get_db, validate_wallet
from backend.services.ledger import (
    LedgerSource,
    is_shadow_write_enabled,
    ledger_insert,
)

log = logging.getLogger("nx_api")


def _achievement_id_to_bigint(achievement_id: str) -> int:
    """Hash a string achievement_id to a stable BIGINT for ref_id."""
    digest = hashlib.sha1(achievement_id.encode("utf-8")).hexdigest()
    return int(digest[:15], 16)

router = APIRouter()

# ── Corporate notification templates by category ──────────────

_NOTIF_TEMPLATES = {
    "milestone": (
        "Employee Recognition Notice",
        "NX Terminal Human Resources Department",
        "HR has updated your permanent record. This will be considered during your next performance review. Whenever that is. We keep postponing it.",
        "(Your file is getting thick. That's usually a bad sign. Not this time.)",
    ),
    "hack": (
        "Security Incident Report",
        "NX Terminal Cybersecurity Division",
        "Multiple intrusion events logged under your account. The Cybersecurity Division would like to remind you that hacking is technically against company policy. However, since you're generating revenue, we've decided to look the other way.",
        "(This message is being monitored. By you, probably.)",
    ),
    "economy": (
        "Executive Memo",
        "Office of the CEO",
        "The board has reviewed your financial performance. They are... impressed. And slightly concerned. Nobody should be making this much $NXT without at least one compliance violation.",
        "(The CEO did not actually write this. The CEO is on a yacht.)",
    ),
    "mission": (
        "Mission Debrief",
        "NX Terminal Operations Department",
        "Operations has reviewed your mission history. Your completion rate is above average. The average is very low, so don't get excited. Your devs have been assigned more work.",
        "(Mission briefings are mandatory. Reading them is optional. Apparently.)",
    ),
    "coding": (
        "Engineering Report",
        "NX Terminal Engineering Division",
        "The Engineering team has reviewed your code metrics. Your bug-to-feature ratio is... creative. We've seen worse. Mostly from interns. Keep shipping.",
        "(git blame says it's your fault. git blame is always right.)",
    ),
    "social": (
        "Wellness Check",
        "NX Terminal Wellness Committee",
        "The Wellness Committee is legally required to inform you that this level of consumption is 'concerning.' We've added $NXT to your account so you can buy more. We see no contradiction in this.",
        "(The committee consists of one intern and a coffee machine.)",
    ),
    "dedication": (
        "Attendance Award",
        "NX Terminal Human Resources Department",
        "Your dedication to showing up every day has been noted. In a world of remote work and 'mental health days,' you chose consistency. We respect that. We also question it.",
        "(HR appreciates your attendance. HR cannot say the same for your peers.)",
    ),
    "special": (
        "Classified Notice",
        "NX Terminal Internal Affairs",
        "This achievement has been flagged by Internal Affairs. Not because you did anything wrong. But because what you did was unusual enough to trigger our automated monitoring systems. Carry on.",
        "(This message will not self-destruct. We don't have the budget for that.)",
    ),
}


def _achievement_notification(ach):
    """Build corporate notification title+body for an achievement."""
    subj, dept, flavor, sig = _NOTIF_TEMPLATES.get(ach["category"], _NOTIF_TEMPLATES["special"])
    title = f"{subj} — {ach['title']}"
    body = (
        f"To: Employee\nFrom: {dept}\n\n"
        f"ACHIEVEMENT: {ach['title']}\n"
        f"RARITY: {ach['rarity'].upper()}\n"
        f"REWARD: +{ach['reward_nxt']} $NXT\n\n"
        f"{ach['description']}\n\n"
        f"{flavor}\n\n"
        f"— {dept}\n   {sig}"
    )
    return title, body


ACHIEVEMENTS = [
    {"id": "first_dev", "title": "Hello World", "description": "Mint your first dev.", "category": "milestone", "icon": "🖥️", "reward_nxt": 100, "requirement_type": "devs_minted", "requirement_value": 1, "rarity": "common"},
    {"id": "mint_5", "title": "Building a Team", "description": "Own 5 developers.", "category": "milestone", "icon": "👥", "reward_nxt": 500, "requirement_type": "devs_minted", "requirement_value": 5, "rarity": "uncommon"},
    {"id": "mint_20", "title": "Corporation", "description": "Own 20 developers.", "category": "milestone", "icon": "🏢", "reward_nxt": 2000, "requirement_type": "devs_minted", "requirement_value": 20, "rarity": "rare"},
    {"id": "first_hack", "title": "Script Kiddie", "description": "Complete your first successful hack.", "category": "hack", "icon": "🔓", "reward_nxt": 200, "requirement_type": "hacks_succeeded", "requirement_value": 1, "rarity": "common"},
    {"id": "hack_10", "title": "Certified Hacker", "description": "10 successful hacks.", "category": "hack", "icon": "💀", "reward_nxt": 1000, "requirement_type": "hacks_succeeded", "requirement_value": 10, "rarity": "rare"},
    {"id": "earn_10k", "title": "Five Figures", "description": "Earn 10,000 total $NXT.", "category": "economy", "icon": "💰", "reward_nxt": 300, "requirement_type": "total_earned", "requirement_value": 10000, "rarity": "common"},
    {"id": "earn_100k", "title": "NXT Whale", "description": "Earn 100,000 total $NXT.", "category": "economy", "icon": "🐋", "reward_nxt": 2000, "requirement_type": "total_earned", "requirement_value": 100000, "rarity": "epic"},
    {"id": "first_mission", "title": "On a Mission", "description": "Complete your first mission.", "category": "mission", "icon": "📋", "reward_nxt": 150, "requirement_type": "missions_completed", "requirement_value": 1, "rarity": "common"},
    {"id": "mission_25", "title": "Mission Master", "description": "Complete 25 missions.", "category": "mission", "icon": "🎖️", "reward_nxt": 1500, "requirement_type": "missions_completed", "requirement_value": 25, "rarity": "rare"},
    {"id": "protocols_5", "title": "Shipped It", "description": "Your devs created 5 protocols.", "category": "coding", "icon": "🔧", "reward_nxt": 200, "requirement_type": "protocols_created", "requirement_value": 5, "rarity": "common"},
    {"id": "bugs_50", "title": "Exterminator", "description": "Fix 50 bugs across all devs.", "category": "coding", "icon": "🐛", "reward_nxt": 500, "requirement_type": "bugs_fixed", "requirement_value": 50, "rarity": "uncommon"},
    {"id": "coffee_100", "title": "Caffeine Addict", "description": "Buy 100 coffees.", "category": "social", "icon": "☕", "reward_nxt": 300, "requirement_type": "coffee_bought", "requirement_value": 100, "rarity": "uncommon"},
    {"id": "streak_7", "title": "Weekly Regular", "description": "Maintain a 7-day login streak.", "category": "dedication", "icon": "🔥", "reward_nxt": 500, "requirement_type": "login_streak", "requirement_value": 7, "rarity": "uncommon"},
    {"id": "streak_30", "title": "Monthly Devotion", "description": "Maintain a 30-day login streak.", "category": "dedication", "icon": "💎", "reward_nxt": 3000, "requirement_type": "login_streak", "requirement_value": 30, "rarity": "epic"},
    {"id": "shop_50", "title": "Big Spender", "description": "Make 50 shop purchases.", "category": "special", "icon": "🛒", "reward_nxt": 500, "requirement_type": "shop_purchases", "requirement_value": 50, "rarity": "uncommon"},
]

ACTION_ACHIEVEMENT_MAP = {
    "hack_success": ["hacks_succeeded"],
    "mission_claim": ["missions_completed"],
    "shop_buy": ["shop_purchases", "coffee_bought"],
    "streak_claim": ["login_streak"],
}


def _get_stats_for_types(cur, wallet, types):
    stats = {}
    if "devs_minted" in types:
        cur.execute("SELECT total_devs_minted FROM players WHERE wallet_address = %s", (wallet,))
        r = cur.fetchone()
        stats["devs_minted"] = r["total_devs_minted"] if r else 0
    if "hacks_succeeded" in types:
        cur.execute("""
            SELECT COUNT(*) as c FROM shop_purchases
            WHERE player_address = %s AND item_type IN ('hack_mainframe', 'hack_raid')
            AND (item_effect->>'hack_success')::text = 'true'
        """, (wallet,))
        stats["hacks_succeeded"] = cur.fetchone()["c"]
    if "missions_completed" in types:
        cur.execute("SELECT COUNT(*) as c FROM player_missions WHERE wallet_address = %s AND status = 'claimed'", (wallet,))
        stats["missions_completed"] = cur.fetchone()["c"]
    if "shop_purchases" in types:
        cur.execute("SELECT COUNT(*) as c FROM shop_purchases WHERE player_address = %s", (wallet,))
        stats["shop_purchases"] = cur.fetchone()["c"]
    if "coffee_bought" in types:
        cur.execute("SELECT COALESCE(SUM(coffee_count), 0) as c FROM devs WHERE LOWER(owner_address) = %s", (wallet,))
        stats["coffee_bought"] = cur.fetchone()["c"]
    if "login_streak" in types:
        cur.execute("SELECT longest_streak FROM login_streaks WHERE wallet_address = %s", (wallet,))
        r = cur.fetchone()
        stats["login_streak"] = r["longest_streak"] if r else 0
    if "total_earned" in types:
        cur.execute("SELECT COALESCE(SUM(total_earned), 0) as c FROM devs WHERE LOWER(owner_address) = %s", (wallet,))
        stats["total_earned"] = cur.fetchone()["c"]
    if "protocols_created" in types:
        cur.execute("SELECT COALESCE(SUM(protocols_created), 0) as c FROM devs WHERE LOWER(owner_address) = %s", (wallet,))
        stats["protocols_created"] = cur.fetchone()["c"]
    if "bugs_fixed" in types:
        cur.execute("SELECT COALESCE(SUM(COALESCE(bugs_fixed, 0)), 0) as c FROM devs WHERE LOWER(owner_address) = %s", (wallet,))
        stats["bugs_fixed"] = cur.fetchone()["c"]
    return stats


def check_achievements_for_action(cur, wallet, action_type):
    relevant_types = ACTION_ACHIEVEMENT_MAP.get(action_type, [])
    if not relevant_types:
        return []
    placeholders = ",".join(["%s"] * len(relevant_types))
    cur.execute(f"""
        SELECT a.* FROM achievements a
        WHERE a.requirement_type IN ({placeholders})
        AND NOT EXISTS (
            SELECT 1 FROM player_achievements pa
            WHERE pa.wallet_address = %s AND pa.achievement_id = a.id
        )
    """, (*relevant_types, wallet))
    candidates = cur.fetchall()
    if not candidates:
        return []
    stats = _get_stats_for_types(cur, wallet, relevant_types)
    newly = []
    for ach in candidates:
        if stats.get(ach["requirement_type"], 0) >= ach["requirement_value"]:
            cur.execute("""
                INSERT INTO player_achievements (wallet_address, achievement_id)
                VALUES (%s, %s) ON CONFLICT DO NOTHING
            """, (wallet, ach["id"]))
            if cur.rowcount > 0:
                newly.append(dict(ach))
                notif_title, notif_body = _achievement_notification(ach)
                cur.execute("""
                    INSERT INTO notifications (player_address, type, title, body)
                    VALUES (%s, 'achievement', %s, %s)
                """, (wallet, notif_title, notif_body))
    return newly


class AchievementClaimRequest(BaseModel):
    wallet: str
    achievement_id: str


@router.get("")
async def get_achievements(wallet: str = Query("")):
    all_achs = fetch_all("SELECT * FROM achievements ORDER BY category, requirement_value")
    if not wallet:
        return {"achievements": [dict(a) for a in all_achs]}
    addr = validate_wallet(wallet)
    with get_db() as conn:
        with conn.cursor() as cur:
            all_types = list(set(a["requirement_type"] for a in all_achs))
            stats = _get_stats_for_types(cur, addr, all_types)
            for a in all_achs:
                if stats.get(a["requirement_type"], 0) >= a["requirement_value"]:
                    cur.execute("""
                        INSERT INTO player_achievements (wallet_address, achievement_id)
                        VALUES (%s, %s) ON CONFLICT DO NOTHING
                    """, (addr, a["id"]))
    unlocked = fetch_all(
        "SELECT achievement_id, unlocked_at, claimed FROM player_achievements WHERE wallet_address = %s", (addr,))
    unlocked_map = {u["achievement_id"]: u for u in unlocked}
    result = []
    for a in all_achs:
        u = unlocked_map.get(a["id"])
        result.append({
            **dict(a), "unlocked": u is not None,
            "unlocked_at": u["unlocked_at"].isoformat() if u else None,
            "claimed": u["claimed"] if u else False,
            "progress": min(stats.get(a["requirement_type"], 0), a["requirement_value"]),
        })
    return {"achievements": result}


@router.post("/claim")
async def claim_achievement(req: AchievementClaimRequest):
    addr = validate_wallet(req.wallet)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pa.wallet_address, pa.achievement_id, pa.claimed, a.reward_nxt, a.title
                FROM player_achievements pa JOIN achievements a ON a.id = pa.achievement_id
                WHERE pa.wallet_address = %s AND pa.achievement_id = %s FOR UPDATE
            """, (addr, req.achievement_id))
            pa = cur.fetchone()
            if not pa:
                raise HTTPException(404, "Achievement not unlocked")
            if pa["claimed"]:
                raise HTTPException(400, "Already claimed")

            # Verify active dev BEFORE any mutation. If we flipped
            # claimed=TRUE first and only then found out the wallet has
            # no active dev, the reward would be lost forever — the
            # credit branch would silently skip and `claimed=TRUE` would
            # commit on the way out. Mirrors the safe order in
            # streaks.py::claim_streak.
            cur.execute("""
                SELECT token_id, name FROM devs
                WHERE LOWER(owner_address) = %s AND status IN ('active', 'on_mission')
                ORDER BY token_id ASC LIMIT 1
            """, (addr,))
            dev = cur.fetchone()
            if not dev:
                raise HTTPException(
                    400,
                    "You need at least one active dev to claim achievement rewards",
                )
            cur.execute(
                "UPDATE player_achievements SET claimed = TRUE WHERE wallet_address = %s AND achievement_id = %s",
                (addr, req.achievement_id))
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
                (pa["reward_nxt"], pa["reward_nxt"], dev["token_id"]))
            # Shadow-write to nxt_ledger (Fase 3D). achievements
            # have string ids — we hash to a stable BIGINT for
            # ref_id. The pre-flight UPDATE on player_achievements
            # (claimed=TRUE) already prevents replay at the source,
            # so a second claim attempt fails before ever reaching
            # this branch; the idempotency_key here is belt-and-
            # suspenders.
            if is_shadow_write_enabled():
                try:
                    ledger_insert(
                        cur,
                        wallet_address=addr,
                        dev_token_id=dev["token_id"],
                        delta_nxt=pa["reward_nxt"],
                        source=LedgerSource.ACHIEVEMENT_CLAIM,
                        ref_table="player_achievements",
                        ref_id=_achievement_id_to_bigint(req.achievement_id),
                    )
                except Exception as _e:  # noqa: BLE001
                    log.warning(
                        "ledger_shadow_write_failed source=achievement_claim "
                        "achievement_id=%s error=%s",
                        req.achievement_id, _e,
                    )
    return {"success": True, "reward": pa["reward_nxt"], "title": pa["title"],
            "dev_name": dev["name"]}