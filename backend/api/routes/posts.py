"""Routes: NX POST — public timeline + author feeds.

Phase 4.1 (this file): backend-only foundation for the Phase 5 NX
POST UI. The same `nx_posts` table that backs Sprkls (source='sprkl',
inserted by the engine scheduler) feeds the timeline here. Future
manual posts (source='manual', Phase 5) will surface through the
same endpoints.

Endpoints:

  GET /api/posts/timeline?limit=20&before={ISO8601}
      Public mixed feed — every is_public, non-expired post across
      all wallets. Cursor-paginated by `before` (a created_at
      timestamp). Excludes nothing on `dismissed_at` here — dismissal
      is per-wallet and only matters for the SprklsLayer; other
      users see the post regardless.

  GET /api/posts/user/{wallet}?limit=20&before={ISO8601}
      Posts authored by Devs of a specific wallet.

  GET /api/posts/dev/{token_id}?limit=20&before={ISO8601}
      Posts by a specific Dev.

All three share the same JOIN to `devs` for rendering metadata
(name, archetype, ipfs_image) and the same author-wallet truncation
("0xae88...e88b") so the public surface never leaks a full address
the user didn't already share.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from backend.api.deps import fetch_all, validate_wallet

log = logging.getLogger("nx_api")

router = APIRouter()

# Same Pinata gateway the rest of the API uses to render Dev avatars.
# Kept inline here to avoid a cross-route import; if a Phase 5+ route
# also needs it we'll lift it to a shared helper.
_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"


def _ipfs_image(ipfs_hash: str | None) -> str:
    if not ipfs_hash:
        return ""
    return f"{_IPFS_GATEWAY}{ipfs_hash}"


def _truncate_wallet(wallet: str | None) -> str:
    """Public-display wallet form — '0xae88…e88b'. Done server-side
    so the timeline payload never carries full addresses the caller
    didn't already know."""
    if not wallet or len(wallet) < 10:
        return wallet or ""
    return f"{wallet[:6]}…{wallet[-4:]}"


def _row_to_post(row: dict[str, Any]) -> dict[str, Any]:
    """Map one joined row to the wire shape every endpoint here
    returns. Centralised so a future field addition (e.g. like
    counts) lands in one place."""
    return {
        "id":               row["id"],
        "token_id":         row["token_id"],
        "name":             row["name"],
        "archetype":        row["archetype"],
        "ipfs_image":       _ipfs_image(row.get("ipfs_hash")),
        "author_wallet":    _truncate_wallet(row.get("wallet_address")),
        "content":          row["content"],
        "source":           row["source"],
        "action_type":      row.get("action_type"),
        "visual_metadata":  row.get("visual_metadata") or {},
        "created_at":       row["created_at"].isoformat(),
        "expires_at":       row["expires_at"].isoformat(),
    }


# Default + max page size. The brief spec'd 20 — keep that as default
# and bound the request-side max so a malicious caller can't pull a
# 10k-row payload.
_DEFAULT_LIMIT = 20
_MAX_LIMIT = 100


def _parse_before(before_iso: str | None) -> datetime | None:
    """Cursor-pagination input — ISO8601 timestamp from the previous
    page's last `created_at`. Invalid input → 400 (not silently
    dropped, because dropping it would skip pagination and surprise
    the caller)."""
    if before_iso is None:
        return None
    try:
        # Python's fromisoformat accepts the '+00:00' tz form the rest
        # of the API emits. Replace 'Z' with '+00:00' for callers that
        # follow the older convention.
        normalised = before_iso.replace("Z", "+00:00")
        return datetime.fromisoformat(normalised)
    except ValueError:
        raise HTTPException(400, f"Invalid `before` timestamp: {before_iso!r}")


def _build_where_and_params(
    *,
    before_dt: datetime | None,
    extra_clauses: list[str],
    extra_params: list[Any],
) -> tuple[str, list[Any]]:
    """Compose the WHERE/ORDER BY tail shared by every endpoint here.

    Always filters to `is_public = true` and `expires_at > NOW()`.
    `before` clause appended only when a cursor is provided.
    """
    clauses = ["p.is_public = TRUE", "p.expires_at > NOW()"] + list(extra_clauses)
    params = list(extra_params)
    if before_dt is not None:
        clauses.append("p.created_at < %s")
        params.append(before_dt)
    where_sql = " AND ".join(clauses)
    return where_sql, params


def _select_posts(
    *,
    where_sql: str,
    params: list[Any],
    limit: int,
) -> list[dict[str, Any]]:
    rows = fetch_all(
        f"""
        SELECT
            p.id,
            p.token_id,
            p.wallet_address,
            p.content,
            p.source,
            p.action_type,
            p.visual_metadata,
            p.created_at,
            p.expires_at,
            d.name,
            d.archetype,
            d.ipfs_hash
        FROM nx_posts p
        JOIN devs d ON d.token_id = p.token_id
        WHERE {where_sql}
        ORDER BY p.created_at DESC
        LIMIT %s
        """,
        (*params, limit),
    )
    return [_row_to_post(r) for r in rows]


@router.get("/timeline")
async def get_timeline(
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    before: str | None = Query(None, description="ISO8601 cursor"),
):
    """Public mixed-author timeline. Newest first."""
    before_dt = _parse_before(before)
    where_sql, params = _build_where_and_params(
        before_dt=before_dt, extra_clauses=[], extra_params=[],
    )
    posts = _select_posts(where_sql=where_sql, params=params, limit=limit)
    return {"ok": True, "posts": posts}


@router.get("/user/{wallet_address}")
async def get_user_posts(
    wallet_address: str,
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    before: str | None = Query(None, description="ISO8601 cursor"),
):
    """Posts authored by Devs of a specific wallet."""
    addr = validate_wallet(wallet_address)
    before_dt = _parse_before(before)
    where_sql, params = _build_where_and_params(
        before_dt=before_dt,
        extra_clauses=["p.wallet_address = %s"],
        extra_params=[addr],
    )
    posts = _select_posts(where_sql=where_sql, params=params, limit=limit)
    return {"ok": True, "posts": posts}


@router.get("/dev/{token_id}")
async def get_dev_posts(
    token_id: int,
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    before: str | None = Query(None, description="ISO8601 cursor"),
):
    """Posts by a specific Dev."""
    if not isinstance(token_id, int) or token_id < 0:
        raise HTTPException(400, "Invalid token_id")
    before_dt = _parse_before(before)
    where_sql, params = _build_where_and_params(
        before_dt=before_dt,
        extra_clauses=["p.token_id = %s"],
        extra_params=[token_id],
    )
    posts = _select_posts(where_sql=where_sql, params=params, limit=limit)
    return {"ok": True, "posts": posts}
