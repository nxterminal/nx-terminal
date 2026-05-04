"""Routes: User-scoped views.

Endpoints:

    GET /api/user/{wallet_address}/conversations  (Phase 3.1)
        Every Dev the wallet owns + quota / status / resting flags.
        Feeds the chat-list UI's "all my Devs" view.

    GET /api/user/{wallet_address}/active-chats   (Phase 3.5.1)
        Every Dev the wallet has at least one non-expired message
        with, plus the most-recent message preview. Feeds the chat-
        list UI's "active conversations" view (Phase 3.5.2 split
        layout).

    GET /api/user/{wallet_address}/messages?token_id=N   (Phase 3.5.1)
        Full message history for one (wallet, Dev) chat. Lazy-
        filtered to non-expired rows. Used by the conversation view
        to restore history when the user reopens a chat.

Phase 4 may grow this module with notification feeds, settings, etc.
Kept separate from `players.py` because that one is mounted at
`/api/players` and is heavy with claim history / wallet summaries —
this module stays minimal and chat-list-focused.

Auth model: consistent with the rest of the public API. The endpoints
are unauthenticated, but only data scoped to the path-parameter
wallet is returned, so the wallet acts as the (low-friction)
ownership filter at the data layer. Full SIWE remains roadmap.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from backend.api.deps import fetch_all, validate_wallet
from backend.services.nx_souls.messages import get_chat_history
from backend.services.nx_souls.quota import (
    DEFAULT_QUOTA,
    QUOTAS_BY_RARITY,
    next_utc_midnight,
)

log = logging.getLogger("nx_api")

router = APIRouter()

# Public IPFS gateway used by the frontend (see frontend/src/**/*.jsx
# `IPFS_GW`). We pre-build the full URL server-side under `ipfs_image`
# so the chat list doesn't need a separate constant; raw `ipfs_hash`
# is also surfaced for callers that prefer to build it themselves.
IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"


def _ipfs_image(ipfs_hash: str | None) -> str:
    """Public gateway URL for the Dev's GIF, or empty string when the
    canonical row hasn't been ingested yet."""
    if not ipfs_hash:
        return ""
    return f"{IPFS_GATEWAY}{ipfs_hash}"


@router.get("/{wallet_address}/conversations")
async def list_conversations(wallet_address: str):
    """Return the wallet's Devs with chat-list metadata.

    Read-only. Does NOT mutate `nx_souls_quota` — the chat endpoint
    owns the lazy-reset path via `get_quota_state`. When this endpoint
    sees a row whose `quota_date` is older than today (UTC), it
    surfaces `used=0` so the UI matches what the next chat call will
    produce.

    Devs without a quota row (never chatted) appear with `used=0` and
    `is_resting=false` — confirmed in production where 9/14 of the
    operator wallet's Devs had no row yet. INNER JOIN here would have
    silently dropped them.

    Devs with `status='frozen'` are excluded entirely.
    """
    addr = validate_wallet(wallet_address)
    today_utc = datetime.now(timezone.utc).date()
    resets_at_iso = next_utc_midnight().isoformat()

    rows = fetch_all(
        """
        SELECT
            d.token_id,
            d.name,
            d.archetype,
            d.corporation,
            d.rarity_tier,
            d.ipfs_hash,
            d.status,
            d.energy,
            d.max_energy,
            CASE
                WHEN q.quota_date = %s THEN q.messages_today
                ELSE 0
            END AS messages_today
        FROM devs d
        LEFT JOIN nx_souls_quota q ON q.token_id = d.token_id
        WHERE d.owner_address = %s
          AND d.status <> 'frozen'
        ORDER BY d.token_id ASC
        """,
        (today_utc, addr),
    )

    devs: list[dict] = []
    for r in rows:
        rarity = r.get("rarity_tier")
        limit = QUOTAS_BY_RARITY.get(rarity, DEFAULT_QUOTA)
        # `messages_today` from the SQL CASE is always 0 when the row
        # is missing or stale, so Devs that never chatted (no
        # nx_souls_quota row) end up here with used=0 / remaining=limit
        # / is_resting=false — the LEFT-JOIN guarantee.
        used = int(r.get("messages_today") or 0)
        remaining = max(0, limit - used)
        is_resting = used >= limit
        status = r.get("status") or ""
        devs.append({
            "token_id":      r["token_id"],
            "name":          r["name"],
            "archetype":     r["archetype"],
            "corporation":   r["corporation"],
            "rarity_tier":   rarity,
            "ipfs_hash":     r.get("ipfs_hash"),
            "ipfs_image":    _ipfs_image(r.get("ipfs_hash")),
            "status":        status,
            "energy":        r.get("energy"),
            "max_energy":    r.get("max_energy"),
            "is_resting":    is_resting,
            "is_exhausted":  status == "exhausted",
            "is_on_mission": status == "on_mission",
            "quota": {
                "used":      used,
                "limit":     limit,
                "remaining": remaining,
                "resets_at": resets_at_iso,
            },
        })

    return {"ok": True, "devs": devs}


# Truncated preview length for the chat-list "last message" snippet.
# 100 chars covers a couple of reasonable sentences without dragging
# the active-chats payload out to many KB on a wallet with many
# conversations.
_PREVIEW_MAX_LEN = 100


def _truncate_preview(text: str | None, max_len: int = _PREVIEW_MAX_LEN) -> str:
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[:max_len].rstrip() + "..."


@router.get("/{wallet_address}/messages")
async def list_messages(
    wallet_address: str,
    token_id: int = Query(..., ge=0, description="Dev token id"),
):
    """Full message history for one chat.

    Lazy-filtered to messages where `expires_at > NOW()` (the 24h
    sliding-window TTL set on every send). Sorted oldest-first so
    the frontend can append directly to its render order.

    Phase 3.5.3 wires the modal's conversation view to call this
    endpoint on open; for now it's frontend-unaware.
    """
    addr = validate_wallet(wallet_address)
    rows = get_chat_history(addr, token_id)

    messages: list[dict] = []
    for r in rows:
        messages.append({
            "id":            r["id"],
            "role":          r["role"],
            "content":       r["content"],
            "is_climax":     bool(r.get("is_climax")),
            "is_resting":    bool(r.get("is_resting")),
            "provider_used": r.get("provider_used"),
            "created_at":    r["created_at"].isoformat(),
            "expires_at":    r["expires_at"].isoformat(),
        })

    return {"ok": True, "messages": messages}


@router.get("/{wallet_address}/active-chats")
async def list_active_chats(wallet_address: str):
    """One row per chat the wallet still has unexpired messages in.

    Joins to `nx.devs` (for the avatar / name / archetype / status)
    and `nx_souls_quota` (for the resting badge), so the chat list's
    "active conversations" pane has every cell it needs in one
    request.

    Excludes:
      - chats whose Dev was admin-frozen (status='frozen')
      - chats whose Dev is no longer owned by this wallet
        (covers the rare case of mid-conversation transfers)

    Sorted by `last_message_at` DESC — most recently active first.

    Quota stale-date handling mirrors the /conversations endpoint:
    if `quota_date != today_utc`, surface `used=0` so the UI matches
    what the next chat call will produce after the lazy reset.
    """
    addr = validate_wallet(wallet_address)
    today_utc = datetime.now(timezone.utc).date()

    rows = fetch_all(
        """
        WITH ranked AS (
          SELECT
            m.token_id,
            m.role,
            m.content,
            m.created_at,
            m.expires_at,
            ROW_NUMBER() OVER (
              PARTITION BY m.token_id
              ORDER BY m.created_at DESC
            ) AS rn
          FROM nx_souls_messages m
          WHERE m.wallet_address = %s
            AND m.expires_at > NOW()
        )
        SELECT
          r.token_id,
          r.role           AS last_role,
          r.content        AS last_content,
          r.created_at     AS last_message_at,
          r.expires_at,
          d.name,
          d.archetype,
          d.corporation,
          d.rarity_tier,
          d.ipfs_hash,
          d.status,
          d.energy,
          d.max_energy,
          q.messages_today,
          q.quota_date
        FROM ranked r
        JOIN devs d ON d.token_id = r.token_id
        LEFT JOIN nx_souls_quota q ON q.token_id = r.token_id
        WHERE r.rn = 1
          AND d.owner_address = %s
          AND d.status <> 'frozen'
        ORDER BY r.created_at DESC
        """,
        (addr, addr),
    )

    active_chats: list[dict] = []
    for r in rows:
        rarity = r.get("rarity_tier") or "common"
        quota_limit = QUOTAS_BY_RARITY.get(rarity, DEFAULT_QUOTA)

        # Stale-date handling: only honour messages_today when the row
        # is for today's UTC date, otherwise treat as 0 (the next chat
        # call will lazy-reset via get_quota_state).
        used = int(r.get("messages_today") or 0)
        if r.get("quota_date") != today_utc:
            used = 0

        status = r.get("status") or ""
        active_chats.append({
            "token_id":      r["token_id"],
            "name":          r["name"],
            "archetype":     r["archetype"],
            "corporation":   r["corporation"],
            "rarity_tier":   rarity,
            "ipfs_image":    _ipfs_image(r.get("ipfs_hash")),
            "status":        status,
            "energy":        r.get("energy"),
            "max_energy":    r.get("max_energy"),
            "is_resting":    used >= quota_limit,
            "is_exhausted":  status == "exhausted",
            "is_on_mission": status == "on_mission",
            "quota": {
                "used":      used,
                "limit":     quota_limit,
                "remaining": max(0, quota_limit - used),
            },
            "last_message": {
                "role":             r["last_role"],
                "content_preview":  _truncate_preview(r["last_content"]),
                "created_at":       r["last_message_at"].isoformat(),
            },
            "expires_at":    r["expires_at"].isoformat(),
        })

    return {"ok": True, "active_chats": active_chats}
