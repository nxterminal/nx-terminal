"""Routes: Player prompts to devs"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.api.deps import fetch_one, fetch_all, get_db, validate_wallet
from backend.api.rate_limit import prompt_limiter

router = APIRouter()


class PromptRequest(BaseModel):
    player_address: str
    dev_id: int
    prompt_text: str


@router.post("")
async def send_prompt(req: PromptRequest):
    """
    Send a prompt to your dev. The engine picks it up on the next cycle.
    Validates ownership before accepting.
    """
    # Validate wallet format
    addr = validate_wallet(req.player_address)

    # Rate limit: 1 prompt per dev per 60s
    prompt_limiter.check(f"dev:{req.dev_id}")

    # Verify ownership
    dev = fetch_one(
        "SELECT token_id, owner_address, name FROM devs WHERE token_id = %s",
        (req.dev_id,)
    )
    if not dev:
        raise HTTPException(404, "Dev not found")
    if dev["owner_address"].lower() != addr:
        raise HTTPException(403, "You don't own this dev")

    # Check for pending prompts (max 1 at a time)
    pending = fetch_one(
        "SELECT id FROM player_prompts WHERE dev_id = %s AND consumed = FALSE",
        (req.dev_id,)
    )
    if pending:
        raise HTTPException(429, "Dev already has a pending prompt. Wait for it to be processed.")

    # Insert prompt
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO player_prompts (player_address, dev_id, prompt_text)
                   VALUES (%s, %s, %s) RETURNING id, created_at""",
                (addr, req.dev_id, req.prompt_text[:500])
            )
            result = cur.fetchone()

    return {
        "id": result["id"],
        "dev_id": req.dev_id,
        "dev_name": dev["name"],
        "prompt": req.prompt_text[:500],
        "status": "queued",
        "created_at": result["created_at"],
    }


@router.get("/{dev_id}")
async def get_dev_prompts(dev_id: int, limit: int = 10):
    """Get prompt history for a dev."""
    return fetch_all(
        """SELECT id, prompt_text, consumed, consumed_at, created_at
           FROM player_prompts WHERE dev_id = %s
           ORDER BY created_at DESC LIMIT %s""",
        (dev_id, limit)
    )
