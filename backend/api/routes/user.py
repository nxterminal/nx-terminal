"""Routes: User-scoped views.

Phase 3.1 lands a single endpoint here:

    GET /api/user/{wallet_address}/conversations

…which feeds the NX Souls chat list UI (Phase 3.2+) one row per Dev
the wallet owns, including quota state and "resting" / "exhausted" /
"on_mission" badges.

Phase 4 may grow this module with notification feeds, settings, etc.
Kept separate from `players.py` because that one is mounted at
`/api/players` and is heavy with claim history / wallet summaries —
this module stays minimal and chat-list-focused.

Auth model: consistent with the rest of the public API. The endpoint
is unauthenticated, but only Devs whose `owner_address` matches the
path parameter are returned, so the wallet acts as the (low-friction)
ownership filter at the data layer. Full SIWE remains roadmap.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from backend.api.deps import fetch_all, validate_wallet
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
