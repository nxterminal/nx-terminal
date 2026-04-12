"""
NX TERMINAL — Dev Academy API Routes
Progress tracking and NFT verification
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.api.deps import fetch_one, fetch_all, execute, get_db

log = logging.getLogger("nx_api")

router = APIRouter()


# ============================================================
# MODELS
# ============================================================

class CompleteLessonRequest(BaseModel):
    key: str  # wallet address or session ID
    devId: int = 0
    lessonId: str
    pathId: str
    xp: int = 10


# ============================================================
# PROGRESS ENDPOINTS
# ============================================================

@router.get("/progress")
async def get_progress(key: str = ""):
    """Get user progress and XP."""
    if not key:
        return {"progress": {}, "xp": 0, "streak": 0}

    try:
        rows = fetch_all(
            "SELECT lesson_id FROM dev_academy_progress WHERE user_key = %s AND is_correct = TRUE",
            (key,)
        )
        progress = {r["lesson_id"]: True for r in (rows or [])}

        xp_row = fetch_one(
            "SELECT total_xp, current_streak FROM dev_academy_xp WHERE user_key = %s",
            (key,)
        )
        xp = xp_row["total_xp"] if xp_row else 0
        streak = xp_row["current_streak"] if xp_row else 0

        return {"progress": progress, "xp": xp, "streak": streak}
    except Exception as e:
        log.warning(f"Academy progress fetch error: {e}")
        return {"progress": {}, "xp": 0, "streak": 0}


@router.post("/complete")
async def complete_lesson(req: CompleteLessonRequest):
    """Mark a lesson as completed and update XP."""
    if not req.key or not req.lessonId:
        raise HTTPException(400, "Missing key or lessonId")

    try:
        # Upsert progress
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO dev_academy_progress (user_key, dev_id, lesson_id, path_id, is_correct)
                    VALUES (%s, %s, %s, %s, TRUE)
                    ON CONFLICT (user_key, lesson_id) DO NOTHING
                """, (req.key, req.devId, req.lessonId, req.pathId))

                cur.execute("""
                    INSERT INTO dev_academy_xp (user_key, dev_id, total_xp, current_streak, last_activity)
                    VALUES (%s, %s, %s, 1, CURRENT_DATE)
                    ON CONFLICT (user_key) DO UPDATE SET
                        total_xp = dev_academy_xp.total_xp + %s,
                        current_streak = CASE
                            WHEN dev_academy_xp.last_activity = CURRENT_DATE - INTERVAL '1 day' THEN dev_academy_xp.current_streak + 1
                            WHEN dev_academy_xp.last_activity = CURRENT_DATE THEN dev_academy_xp.current_streak
                            ELSE 1
                        END,
                        last_activity = CURRENT_DATE
                """, (req.key, req.devId, req.xp, req.xp))

        return {"ok": True}
    except Exception as e:
        log.error(f"Academy complete error: {e}")
        raise HTTPException(500, "Failed to save progress")


# ============================================================
# NFT VERIFICATION (stub — uses backend RPC in production)
# ============================================================

@router.get("/verify-nft")
async def verify_nft(devId: int = 0):
    """Verify NFT ownership. Currently returns mock data for testnet."""
    if devId < 1 or devId > 35000:
        raise HTTPException(400, "Invalid Dev ID")

    # In production, query NXDevNFT contract at 0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7
    species_list = ["Frog", "Human", "Robot", "Penguin"]
    return {
        "isOwner": True,
        "species": species_list[devId % len(species_list)],
    }
