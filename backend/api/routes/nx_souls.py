"""Routes: NX Souls — 1-on-1 chat with a minted Dev.

Phase 1 scope: the `/api/devs/{token_id}/chat` endpoint only.
Quota tracking, sleep/wake transitions, and the conversations-list
endpoint land in Phase 2.

Endpoint contract (POST /api/devs/{token_id}/chat):
  Body:
    {
      "message": "<1..1000 chars>",
      "session_messages": [{"role":"user|assistant", "content":"..."}, ...],
      "wallet_address": "0x...",     # caller's wallet, owner check
    }
  Success 200:
    { "ok": true, "response": "...", "provider_used": "groq" }
  503 when every LLM provider in the cascade fails (Phase 2 will turn
  this into automatic sleep + 429 with a wake-cost payload).
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.api.deps import get_db, validate_wallet
from backend.api.rate_limit import chat_limiter
from backend.services.nx_souls.exceptions import NXSoulsAllProvidersFailed
from backend.services.nx_souls.llm_router import call_llm, is_climax_turn
from backend.services.nx_souls.persona import build_persona

log = logging.getLogger("nx_api")

router = APIRouter()


MAX_MESSAGE_LEN = 1000
MAX_SESSION_MESSAGES = 20


class SessionMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LEN)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LEN)
    session_messages: list[SessionMessage] = Field(default_factory=list)
    wallet_address: str = Field(...)


def _check_owner(cur, token_id: int, wallet: str) -> dict[str, Any]:
    """Verify the wallet owns the Dev. Returns the row used for downstream
    decisions (status check). Raises 404 / 403 / 403 as appropriate.
    """
    cur.execute(
        "SELECT token_id, name, owner_address, status "
        "FROM devs WHERE token_id = %s",
        (token_id,),
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(404, "Dev not found")
    owner = (row.get("owner_address") or "").lower()
    if owner != wallet:
        raise HTTPException(403, "Caller wallet does not own this Dev")
    if row.get("status") == "frozen":
        raise HTTPException(403, "Dev is frozen by admin and cannot chat")
    return row


def _log_message_event(
    cur,
    *,
    token_id: int,
    wallet_address: str,
    user_message_len: int,
    response_len: int | None,
    provider_used: str | None,
    climax: bool,
    duration_ms: int,
) -> None:
    """Append a privacy-respecting metadata-only row to nx_souls_messages_cache.
    Never store the actual message text. Failures here must not break the
    chat reply, so the caller wraps this in a try/except.
    """
    cur.execute(
        "INSERT INTO nx_souls_messages_cache "
        "(token_id, wallet_address, user_message_len, response_len, "
        " provider_used, climax, duration_ms) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (
            token_id,
            wallet_address,
            user_message_len,
            response_len,
            provider_used,
            climax,
            duration_ms,
        ),
    )


@router.post("/{token_id}/chat")
async def chat_with_dev(token_id: int, req: ChatRequest):
    """Chat with one of the caller's minted Devs.

    Phase 1: no quota check, no sleep gate. Auth + persona + LLM call
    only. Phase 2 wraps this in the quota / sleep machinery.
    """
    wallet = validate_wallet(req.wallet_address)

    # Per-wallet cool-down on chat — same limiter the world chat uses.
    # Light protection while quota tracking is still Phase 2.
    chat_limiter.check(f"souls:{wallet}:{token_id}")

    if len(req.session_messages) > MAX_SESSION_MESSAGES:
        raise HTTPException(
            400,
            f"Too many session messages (max {MAX_SESSION_MESSAGES})",
        )

    # Build persona + verify ownership in the same connection so the
    # auth check and the persona fetch see a consistent snapshot.
    with get_db() as conn:
        with conn.cursor() as cur:
            _check_owner(cur, token_id, wallet)
            persona = build_persona(cur, token_id)
    if persona is None:
        # Should be unreachable — _check_owner already 404'd if the row
        # was missing — but keep the guard for the (cur, token_id) race
        # where the Dev was burned between check and persona fetch.
        raise HTTPException(404, "Dev not found")

    session_msgs = [m.model_dump() for m in req.session_messages]
    climax = is_climax_turn(req.message, len(session_msgs))

    started = time.monotonic()
    try:
        response_text, provider_used = await call_llm(
            persona=persona,
            session_messages=session_msgs,
            user_message=req.message,
            climax=climax,
        )
    except NXSoulsAllProvidersFailed as e:
        duration_ms = int((time.monotonic() - started) * 1000)
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    _log_message_event(
                        cur,
                        token_id=token_id,
                        wallet_address=wallet,
                        user_message_len=len(req.message),
                        response_len=None,
                        provider_used=None,
                        climax=climax,
                        duration_ms=duration_ms,
                    )
        except Exception as log_e:  # pragma: no cover — best-effort logging
            log.warning(f"NX Souls: failed to log failure event: {log_e}")
        log.warning(f"NX Souls: all providers failed for token {token_id}: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "all_providers_failed",
                "message": "All LLM providers are temporarily unavailable.",
                "retry_in_seconds": 60,
            },
        )

    duration_ms = int((time.monotonic() - started) * 1000)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                _log_message_event(
                    cur,
                    token_id=token_id,
                    wallet_address=wallet,
                    user_message_len=len(req.message),
                    response_len=len(response_text),
                    provider_used=provider_used,
                    climax=climax,
                    duration_ms=duration_ms,
                )
    except Exception as log_e:  # pragma: no cover — best-effort logging
        log.warning(f"NX Souls: failed to log message event: {log_e}")

    return {
        "ok": True,
        "response": response_text,
        "provider_used": provider_used,
    }
