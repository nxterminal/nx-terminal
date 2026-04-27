"""Routes: Daily Login Streak — check-in and claim daily rewards"""

import logging
from datetime import datetime, timedelta, timezone
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

# Rewards form a 7-day cycle that repeats indefinitely while the user
# keeps their streak alive: day 1 → small, day 7 → milestone, day 8
# wraps back to day 1 with the same small reward. longest_streak is
# still monotonic (bragging rights).
CYCLE_LENGTH = 7
CYCLE_REWARDS = {1: 50, 2: 75, 3: 100, 4: 150, 5: 200, 6: 350, 7: 500}

# Cooldown semantics: a claim is gated on a strict 24h window measured
# from the previous claim's timestamp. The streak breaks when the gap
# between claims reaches 48h.
CLAIM_COOLDOWN = timedelta(hours=24)
STREAK_BREAK = timedelta(hours=48)


def compute_cycle_day(current_streak: int) -> int:
    """Return the 1-indexed day within the 7-day cycle for ``current_streak``.

    Day 1 → 1, day 7 → 7, day 8 → 1, day 14 → 7. For streak <= 0 we
    clamp to 1 so the next-reward preview always resolves cleanly.
    """
    if current_streak < 1:
        return 1
    return ((current_streak - 1) % CYCLE_LENGTH) + 1


def compute_reward(current_streak: int) -> int:
    return CYCLE_REWARDS[compute_cycle_day(current_streak)]


# Back-compat shim: callers used to pass a "day" and expect a reward.
# Semantics now route through the cycle table. Kept so any stray
# imports stay compiling while we transition.
def calculate_reward(day: int) -> int:
    return compute_reward(day)


class StreakClaimRequest(BaseModel):
    wallet: str


@router.get("")
async def get_streak(wallet: str = Query(...)):
    """Get current streak status for a wallet."""
    addr = validate_wallet(wallet)
    row = fetch_one("SELECT * FROM login_streaks WHERE wallet_address = %s", (addr,))

    now = datetime.now(timezone.utc)

    if not row:
        return {
            "current_streak": 0, "longest_streak": 0, "can_claim": True,
            "seconds_until_next_claim": 0,
            "next_reward": compute_reward(1), "next_day": 1,
            "day_in_cycle": 1, "cycle_length": CYCLE_LENGTH,
            "last_claim_at": None, "total_claimed_nxt": 0,
        }

    last = row["last_claim_at"]
    streak = row["current_streak"]

    # Cooldown: under 24h since last claim → blocked
    if last and (now - last) < CLAIM_COOLDOWN:
        seconds_remaining = int((CLAIM_COOLDOWN - (now - last)).total_seconds())
        return {
            "current_streak": streak, "longest_streak": row["longest_streak"],
            "can_claim": False,
            "seconds_until_next_claim": seconds_remaining,
            "next_reward": compute_reward(streak + 1),
            "next_day": streak + 1,
            "day_in_cycle": compute_cycle_day(streak),
            "cycle_length": CYCLE_LENGTH,
            "last_claim_at": last.isoformat(),
            "total_claimed_nxt": row["total_claimed_nxt"],
            "claimed_today": compute_reward(streak),
        }

    # Cooldown elapsed. Streak breaks if gap >= 48h.
    if last and (now - last) >= STREAK_BREAK:
        next_day = 1  # streak broken
    else:
        next_day = streak + 1

    return {
        "current_streak": streak if next_day > 1 else 0,
        "longest_streak": row["longest_streak"],
        "can_claim": True,
        "seconds_until_next_claim": 0,
        "next_reward": compute_reward(next_day),
        "next_day": next_day,
        "day_in_cycle": compute_cycle_day(next_day),
        "cycle_length": CYCLE_LENGTH,
        "last_claim_at": last.isoformat() if last else None,
        "total_claimed_nxt": row["total_claimed_nxt"],
    }


@router.post("/claim")
async def claim_streak(req: StreakClaimRequest):
    """Claim daily streak reward."""
    addr = validate_wallet(req.wallet)
    now = datetime.now(timezone.utc)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM login_streaks WHERE wallet_address = %s FOR UPDATE", (addr,))
            row = cur.fetchone()

            last = row["last_claim_at"] if row else None

            if last and (now - last) < CLAIM_COOLDOWN:
                seconds_remaining = int((CLAIM_COOLDOWN - (now - last)).total_seconds())
                hrs, rem = divmod(seconds_remaining, 3600)
                mins = rem // 60
                raise HTTPException(400, detail={
                    "error": "cooldown_active",
                    "message": f"Next claim available in {hrs}h {mins}m.",
                    "seconds_until_next_claim": seconds_remaining,
                })

            # Calculate new streak
            if not last:
                new_streak = 1
            elif (now - last) >= STREAK_BREAK:
                new_streak = 1  # streak broken
            else:
                new_streak = row["current_streak"] + 1

            reward = compute_reward(new_streak)

            # Upsert streak
            cur.execute("""
                INSERT INTO login_streaks (wallet_address, current_streak, longest_streak, last_claim_at, total_claimed_nxt)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (wallet_address) DO UPDATE SET
                    current_streak = %s,
                    longest_streak = GREATEST(login_streaks.longest_streak, %s),
                    last_claim_at = %s,
                    total_claimed_nxt = login_streaks.total_claimed_nxt + %s
            """, (addr, new_streak, new_streak, now, reward,
                  new_streak, new_streak, now, reward))

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

            # Shadow-write to nxt_ledger (Fase 3D). UTC date ordinal of the
            # claim instant is a natural per-claim key — back-to-back valid
            # claims are 24h apart, so they always land on different UTC
            # dates. The pre-flight cooldown check already prevents
            # double-claim within 24h; the idempotency_key here matches
            # that contract.
            if is_shadow_write_enabled():
                try:
                    ledger_insert(
                        cur,
                        wallet_address=addr,
                        dev_token_id=dev["token_id"],
                        delta_nxt=reward,
                        source=LedgerSource.STREAK_CLAIM,
                        ref_table="login_streaks",
                        ref_id=now.date().toordinal(),
                    )
                except Exception as _e:  # noqa: BLE001
                    log.warning(
                        "ledger_shadow_write_failed source=streak_claim "
                        "wallet=%s ts=%s error=%s",
                        addr, now, _e,
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

    day_in_cycle = compute_cycle_day(new_streak)
    return {
        "success": True, "streak": new_streak, "reward": reward,
        "dev_name": dev["name"], "dev_id": dev["token_id"],
        "longest_streak": max(new_streak, row["longest_streak"] if row else 0),
        "day_in_cycle": day_in_cycle,
        "cycle_length": CYCLE_LENGTH,
        "next_reward": compute_reward(new_streak + 1),
        "seconds_until_next_claim": int(CLAIM_COOLDOWN.total_seconds()),
        "message": (
            f"Day {day_in_cycle} of {CYCLE_LENGTH} — streak {new_streak}! "
            f"+{reward} $NXT to {dev['name']}"
        ),
    }
