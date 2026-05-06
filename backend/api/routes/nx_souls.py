"""Routes: NX Souls — 1-on-1 chat with a minted Dev.

Phase 1 scope (with early-Phase-2 quota pulled forward per PR #350
review): the `/api/devs/{token_id}/chat` endpoint with per-IP rate
limits, per-(wallet, dev) cool-down, and per-token daily quota. Sleep
state machine, wake endpoint, and the conversations-list endpoint
remain in Phase 2.

Endpoint contract (POST /api/devs/{token_id}/chat):
  Body:
    {
      "message": "<1..1000 chars>",
      "session_messages": [{"role":"user|assistant", "content":"..."}, ...],
      "wallet_address": "0x...",     # caller's wallet, owner check
    }
  Success 200:
    {
      "ok": true,
      "response": "...",
      "provider_used": "groq",
      "quota": {"used": N, "limit": M, "remaining": M-N,
                "resets_at": "<UTC ISO>"}
    }
  Error 400 — input validation (message too long, too many session
              messages, combined session content over 8000 chars).
  Error 403 — wallet doesn't own the Dev, or Dev is admin-frozen.
  Error 404 — Dev doesn't exist.
  Error 429 — IP rate limit hit, per-(wallet, dev) cool-down, or
              per-token daily quota exhausted (payload distinguishes
              which).
  Error 503 — every LLM provider in the cascade failed; Phase 2 turns
              this into an automatic sleep + wake-cost payload.

Auth note: Phase 1 trusts the caller-supplied wallet_address against
the Dev's on-chain owner_address — there is no signed-message proof
that the requester actually controls that wallet. This is consistent
with the rest of the API. Full SIWE / signed-message auth is roadmap
work, not in scope. The IP rate limits + per-token daily quota cap
the worst-case abuse cost while we wait for it.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.api.deps import get_db, validate_wallet
from backend.api.rate_limit import (
    chat_limiter,
    souls_ip_per_day,
    souls_ip_per_hour,
    souls_ip_per_minute,
)
from backend.services.nx_souls.exceptions import NXSoulsAllProvidersFailed
from backend.services.nx_souls.llm_router import call_llm, is_climax_turn
from backend.services.nx_souls.messages import insert_message_and_refresh_chat
from backend.services.nx_souls.persona import build_persona
from backend.services.nx_souls.quota import (
    QuotaState,
    get_quota_state,
    increment_quota,
)
from backend.services.nx_souls.voices import get_resting_message

log = logging.getLogger("nx_api")

router = APIRouter()


MAX_MESSAGE_LEN = 1000
MAX_SESSION_MESSAGES = 20
# Cap the combined size of `session_messages.content` to bound the
# user-controlled portion of the LLM context. Without this an attacker
# could stuff 20 × 1000-char messages = 20 000 chars of crafted
# history, either to burn paid-tier tokens or to coerce the model into
# echoing the system prompt. 8000 chars covers a real long
# conversation while keeping the climb out of the abuse range.
MAX_SESSION_CONTENT_CHARS = 8000


class SessionMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LEN)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LEN)
    session_messages: list[SessionMessage] = Field(default_factory=list)
    wallet_address: str = Field(...)


def _client_ip(request: Request) -> str:
    """Best-effort source IP. Behind Render's proxy `request.client.host`
    is the proxy IP, which is fine for our purposes (fair-share across
    upstream traffic), and we don't need to chase X-Forwarded-For
    here — the abuse vector this defends against runs from a single
    upstream client at the IP we observe."""
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_ip_rate_limits(ip: str, wallet: str, token_id: int) -> None:
    """Three-tier IP cap: 5/min, 60/hr, 200/day. Rejects on the first
    tier that's over budget. Logs a WARNING with IP + wallet so the
    operator can spot abuse patterns post-incident. Order is short →
    long so the most informative tier ends up in the log when a burst
    happens."""
    for limiter, label, retry_seconds in (
        (souls_ip_per_minute, "per_minute", 60),
        (souls_ip_per_hour, "per_hour", 600),
        (souls_ip_per_day, "per_day", 3600),
    ):
        if not limiter.check(ip):
            log.warning(
                "NX Souls chat: IP rate limit hit "
                f"tier={label} ip={ip} wallet={wallet} token_id={token_id}"
            )
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "ip_rate_limited",
                    "tier": label,
                    "retry_in_seconds": retry_seconds,
                    "message": (
                        "Too many chat requests from this address. "
                        "Try again shortly."
                    ),
                },
            )


def _check_owner(
    cur,
    token_id: int,
    wallet: str,
    *,
    request_ip: str = "unknown",
) -> dict[str, Any]:
    """Verify the wallet owns the Dev. Returns the row for downstream
    decisions (status, rarity_tier). Raises 404 / 403 as appropriate.

    On 403 (ownership mismatch) we log a WARNING with claimed_wallet,
    real_owner, and request_ip so abuse patterns are visible in logs
    post-incident. We don't include this in the 403 body — that would
    leak the real owner address to a hostile probe.
    """
    cur.execute(
        "SELECT token_id, name, owner_address, status, rarity_tier, archetype "
        "FROM devs WHERE token_id = %s",
        (token_id,),
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(404, "Dev not found")
    real_owner = (row.get("owner_address") or "").lower()
    if real_owner != wallet:
        log.warning(
            "NX Souls chat: ownership check failed "
            f"token_id={token_id} claimed_wallet={wallet} "
            f"real_owner={real_owner or '<unset>'} ip={request_ip}"
        )
        raise HTTPException(403, "Caller wallet does not own this Dev")
    if row.get("status") == "frozen":
        raise HTTPException(403, "Dev is frozen by admin and cannot chat")
    return row


def _validate_session_size(session_messages: list[SessionMessage]) -> None:
    """Reject when the session exceeds either the message-count cap or
    the combined-content-character cap. Both are hard 400s."""
    if len(session_messages) > MAX_SESSION_MESSAGES:
        raise HTTPException(
            400,
            f"Too many session messages (max {MAX_SESSION_MESSAGES})",
        )
    total_chars = sum(len(m.content) for m in session_messages)
    if total_chars > MAX_SESSION_CONTENT_CHARS:
        raise HTTPException(
            400,
            (
                f"Combined session_messages content too large "
                f"({total_chars} > {MAX_SESSION_CONTENT_CHARS} chars)"
            ),
        )


def _quota_response_payload(state: QuotaState) -> dict[str, Any]:
    return {
        "used": state.used,
        "limit": state.limit,
        "remaining": state.remaining,
        "resets_at": state.resets_at.isoformat(),
    }


def _persist_chat_messages(
    *,
    wallet_address: str,
    token_id: int,
    user_message: str,
    response_text: str,
    response_role: str,
    is_climax: bool,
    is_resting: bool,
    provider_used: str | None,
) -> None:
    """Best-effort write of the user message + assistant response to
    `nx_souls_messages` (Phase 3.5.1 full-content store).

    Wrapped in its own try/except so a transient DB failure here does
    NOT block the chat reply or surface as an error to the user. The
    write happens AFTER the LLM call has resolved + the metadata
    event has been logged + the quota incremented, so a persistence
    failure can't unwind those guaranteed-correct effects.

    Two inserts in two separate transactions — sliding-window TTL
    refresh inside `insert_message_and_refresh_chat` covers both.
    """
    try:
        insert_message_and_refresh_chat(
            wallet_address=wallet_address,
            token_id=token_id,
            role="user",
            content=user_message,
        )
        insert_message_and_refresh_chat(
            wallet_address=wallet_address,
            token_id=token_id,
            role=response_role,
            content=response_text,
            is_climax=is_climax,
            is_resting=is_resting,
            provider_used=provider_used,
        )
    except Exception as e:  # pragma: no cover — best-effort
        log.warning(
            f"NX Souls: persistence failed for token_id={token_id} "
            f"wallet={wallet_address}: {e}"
        )


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
async def chat_with_dev(token_id: int, req: ChatRequest, request: Request):
    """Chat with one of the caller's minted Devs.

    Order of checks (defence-in-depth, cheapest first):
      1. wallet format
      2. session-message shape (count + combined chars)
      3. per-IP rate limits (3 tiers)
      4. per-(wallet, dev) cool-down
      5. ownership / frozen-status
      6. per-token daily quota — EXCEEDED short-circuits to a 200 OK
         with an in-character "resting" reply; the LLM is NOT called
         and the quota counter is NOT incremented (it's already at max)
      7. persona build
      8. LLM cascade
      9. on success → atomic quota increment + metadata event log
    """
    wallet = validate_wallet(req.wallet_address)
    ip = _client_ip(request)

    _validate_session_size(req.session_messages)

    # Per-IP burst caps come before the wallet cool-down so a hostile IP
    # rotating wallets is still constrained.
    _enforce_ip_rate_limits(ip, wallet, token_id)

    # Per-(wallet, dev) cool-down — same RateLimiter the world chat uses.
    try:
        chat_limiter.check(f"souls:{wallet}:{token_id}")
    except HTTPException:
        log.warning(
            "NX Souls chat: per-wallet cooldown hit "
            f"ip={ip} wallet={wallet} token_id={token_id}"
        )
        raise

    # Ownership + quota state come from the same connection so the
    # decision is made against a consistent snapshot.
    with get_db() as conn:
        with conn.cursor() as cur:
            dev_row = _check_owner(cur, token_id, wallet, request_ip=ip)
            quota_state = get_quota_state(
                cur, token_id, dev_row.get("rarity_tier")
            )
            if quota_state.exceeded:
                # Immersion preservation: instead of a 429 the user sees
                # the Dev being tired in their own voice. The LLM is
                # NOT called (saves cost) and the counter is NOT
                # incremented (already at limit). is_resting=true tells
                # the frontend to disable the input + render a
                # "resting until UTC midnight" affordance.
                resting_response = get_resting_message(
                    dev_row.get("archetype") or ""
                )
                log.info(
                    "NX Souls chat: serving rest message "
                    f"token_id={token_id} wallet={wallet} "
                    f"archetype={dev_row.get('archetype')} "
                    f"used={quota_state.used} limit={quota_state.limit}"
                )
                try:
                    _log_message_event(
                        cur,
                        token_id=token_id,
                        wallet_address=wallet,
                        user_message_len=len(req.message),
                        response_len=len(resting_response),
                        provider_used="internal",
                        climax=False,
                        duration_ms=0,
                    )
                except Exception as log_e:  # pragma: no cover — best-effort
                    log.warning(
                        f"NX Souls: failed to log rest event: {log_e}"
                    )
                # Persist the user message + the in-character rest
                # line (role='system_resting'). Best-effort; the
                # response goes out either way.
                _persist_chat_messages(
                    wallet_address=wallet,
                    token_id=token_id,
                    user_message=req.message,
                    response_text=resting_response,
                    response_role="system_resting",
                    is_climax=False,
                    is_resting=True,
                    provider_used="internal",
                )
                return {
                    "ok": True,
                    "response": resting_response,
                    "provider_used": "internal",
                    "quota": _quota_response_payload(quota_state),
                    "is_resting": True,
                }
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
            # Phase 5.1.1: cost tracking. When the daily ceiling is
            # hit the cascade raises NXSoulsAllProvidersFailed
            # ("daily_limit_exceeded"), which the existing handler
            # below catches and turns into the standard "I'm tired"
            # response — same UX as a real cascade outage.
            service="nx_souls",
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

    # Successful reply — increment the quota counter and log the event.
    # Increment + event log share a connection / transaction so we never
    # charge a quota slot but lose the metadata row (or vice versa).
    new_used = quota_state.used + 1  # optimistic; refined from RETURNING
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                new_used = increment_quota(cur, token_id)
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

    final_state = QuotaState(
        used=new_used, limit=quota_state.limit, resets_at=quota_state.resets_at
    )

    # Persist the user message + the assistant response (role='assistant')
    # to the full-content store. Sliding-window TTL inside the helper
    # refreshes every still-active message in this chat. Best-effort;
    # response shape returned to the client is unchanged (Phase 3.5.3
    # will add the load-on-open behaviour).
    _persist_chat_messages(
        wallet_address=wallet,
        token_id=token_id,
        user_message=req.message,
        response_text=response_text,
        response_role="assistant",
        is_climax=climax,
        is_resting=False,
        provider_used=provider_used,
    )

    return {
        "ok": True,
        "response": response_text,
        "provider_used": provider_used,
        "quota": _quota_response_payload(final_state),
    }
