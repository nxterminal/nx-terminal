"""Routes: Daily Login Streak — check-in and claim daily rewards"""

import logging
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from backend.api.deps import fetch_one, get_db, validate_wallet
from backend.services.ledger import (
    LedgerSource,
    is_shadow_write_enabled,
    ledger_insert,
)

log = logging.getLogger("nx_api")

router = APIRouter()

# Reward tiers by streak day (closest lower tier lookup)
STREAK_REWARDS = {1: 50, 2: 75, 3: 100, 5: 200, 7: 500, 14: 750, 30: 1500}
_SORTED_TIERS = sorted(STREAK_REWARDS.keys(), reverse=True)


def calculate_reward(day: int) -> int:
    for d in _SORTED_TIERS:
        if day >= d:
            return STREAK_REWARDS[d]
    return 50


class StreakClaimRequest(BaseModel):
    wallet: str


@router.get("")
async def get_streak(wallet: str = Query(...)):
    """Get current streak status for a wallet."""
    addr = validate_wallet(wallet)
    row = fetch_one("SELECT * FROM login_streaks WHERE wallet_address = %s", (addr,))

    today = date.today()

    if not row:
        return {
            "current_streak": 0, "longest_streak": 0, "can_claim": True,
            "next_reward": calculate_reward(1), "next_day": 1,
            "last_claim_date": None, "total_claimed_nxt": 0,
        }

    last = row["last_claim_date"]
    streak = row["current_streak"]

    if last == today:
        return {
            "current_streak": streak, "longest_streak": row["longest_streak"],
            "can_claim": False, "next_reward": calculate_reward(streak + 1),
            "next_day": streak + 1, "last_claim_date": str(last),
            "total_claimed_nxt": row["total_claimed_nxt"],
            "claimed_today": calculate_reward(streak),
        }

    if last == today - timedelta(days=1):
        next_day = streak + 1
    else:
        next_day = 1  # streak broken

    return {
        "current_streak": streak if next_day > 1 else 0,
        "longest_streak": row["longest_streak"],
        "can_claim": True,
        "next_reward": calculate_reward(next_day),
        "next_day": next_day,
        "last_claim_date": str(last) if last else None,
        "total_claimed_nxt": row["total_claimed_nxt"],
    }


@router.post("/claim")
async def claim_streak(req: StreakClaimRequest):
    """Claim daily streak reward."""
    addr = validate_wallet(req.wallet)
    today = date.today()

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM login_streaks WHERE wallet_address = %s FOR UPDATE", (addr,))
            row = cur.fetchone()

            if row and row["last_claim_date"] == today:
                raise HTTPException(400, detail={
                    "error": "already_claimed",
                    "message": "Already claimed today. Come back tomorrow!",
                })

            # Calculate new streak
            if not row:
                new_streak = 1
            elif row["last_claim_date"] == today - timedelta(days=1):
                new_streak = row["current_streak"] + 1
            else:
                new_streak = 1

            reward = calculate_reward(new_streak)

            # Upsert streak
            cur.execute("""
                INSERT INTO login_streaks (wallet_address, current_streak, longest_streak, last_claim_date, total_claimed_nxt)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (wallet_address) DO UPDATE SET
                    current_streak = %s,
                    longest_streak = GREATEST(login_streaks.longest_streak, %s),
                    last_claim_date = %s,
                    total_claimed_nxt = login_streaks.total_claimed_nxt + %s
            """, (addr, new_streak, new_streak, today, reward,
                  new_streak, new_streak, today, reward))

            # Credit reward to first active dev
            cur.execute("""
                SELECT token_id, name FROM devs
                WHERE LOWER(owner_address) = %s AND status IN ('active', 'on_mission')
                ORDER BY token_id ASC LIMIT 1
            """, (addr,))
            dev = cur.fetchone()

            if not dev:
                raise HTTPException(400, "You need at least one active dev to claim streak rewards")

            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
                (reward, reward, dev["token_id"])
            )

            # Shadow-write to nxt_ledger (Fase 3D). Date ordinal is a
            # natural per-day key for streak claims. The pre-flight
            # check on last_claim_date already prevents double-claim
            # on the same day; the idempotency_key here matches that
            # contract.
            if is_shadow_write_enabled():
                try:
                    ledger_insert(
                        cur,
                        wallet_address=addr,
                        dev_token_id=dev["token_id"],
                        delta_nxt=reward,
                        source=LedgerSource.STREAK_CLAIM,
                        ref_table="login_streaks",
                        ref_id=today.toordinal(),
                    )
                except Exception as _e:  # noqa: BLE001
                    log.warning(
                        "ledger_shadow_write_failed source=streak_claim "
                        "wallet=%s day=%s error=%s",
                        addr, today, _e,
                    )

            # Send corporate notification
            longest = max(new_streak, row["longest_streak"] if row else 0)
            _MILESTONES = {
                7: "One full week. HR is impressed. Don't let it go to your head.",
                14: "Two weeks straight. You're now eligible for the company parking spot. We don't have one.",
                21: "Three weeks. At this point, you're basically furniture. Welcome aboard.",
                30: "30 days. The board of directors has noticed. They're slightly concerned.",
            }
            milestone = _MILESTONES.get(new_streak, "Your consistency has been noted. Filed under 'suspicious behavior.'")
            cur.execute("""
                INSERT INTO notifications (player_address, type, title, body)
                VALUES (%s, 'streak_claim', %s, %s)
            """, (addr,
                  f"Daily Attendance Record — Day {new_streak}",
                  f"To: Employee\nFrom: NX Terminal Human Resources Department\n\n"
                  f"ATTENDANCE BONUS: +{reward} $NXT\n"
                  f"CURRENT STREAK: {new_streak} days\n"
                  f"RECORD STREAK: {longest} days\n\n"
                  f"{milestone}\n\n"
                  f"Missing a day will reset your streak to zero. No exceptions.\n"
                  f"We don't care if 'the blockchain was down.'\n\n"
                  f"— NX Terminal Human Resources Department\n"
                  f"   (HR does not read replies. HR does not care.)"))

    return {
        "success": True, "streak": new_streak, "reward": reward,
        "dev_name": dev["name"], "dev_id": dev["token_id"],
        "longest_streak": max(new_streak, row["longest_streak"] if row else 0),
        "message": f"Day {new_streak}! +{reward} $NXT to {dev['name']}",
    }
