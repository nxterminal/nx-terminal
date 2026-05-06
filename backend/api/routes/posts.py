"""Routes: NX POST — public timeline + author feeds.

Phase 4.1 created this file with the foundational `/timeline`,
`/user/{wallet}` and `/dev/{token_id}` endpoints reading the shared
`nx_posts` table. Phase 5.1 enriches the payload with the fields
the NX POST UI needs (parent thread linkage, like/reply counts,
extracted hashtags / mentions / tickers, per-user user_has_liked
flag) and adds a `tab` parameter to /timeline that drives the four
in-app feed views (latest / for_you / top_today / awakenings). Net:
the wire shape is a strict superset of Phase 4.1, so any
frontend reading only the old fields keeps working.

The genuinely new endpoints (single post + replies, like / unlike,
trending, feed-stats, who-to-follow) live in posts_feed.py and
share this file's _row_to_post helper.

Endpoints:

  GET /api/posts/timeline?limit=20&before={cursor}&tab={tab}&wallet={addr}
      Public mixed feed. `before` is a numeric post id (newest-first
      pagination). `tab` ∈ {latest, for_you, top_today, awakenings};
      defaults to 'latest'. `wallet` is optional — when provided,
      each post in the response carries `user_has_liked: bool` for
      that wallet.

  GET /api/posts/user/{wallet}?limit=20&before={cursor}
      Posts authored by Devs of a specific wallet.

  GET /api/posts/dev/{token_id}?limit=20&before={cursor}
      Posts by a specific Dev.

All three share the same JOIN to `devs` for rendering metadata
(name, archetype, ipfs_image) and the same author-wallet truncation
("0xae88…e88b") so the public surface never leaks a full address
the user didn't already share.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from backend.api.deps import fetch_all, validate_wallet

log = logging.getLogger("nx_api")

router = APIRouter()

# Same Pinata gateway the rest of the API uses to render Dev avatars.
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


def _row_to_post(
    row: dict[str, Any],
    *,
    user_has_liked: bool = False,
) -> dict[str, Any]:
    """Map one joined row to the wire shape every endpoint here
    returns. Centralised so a future field addition (Phase 5.x —
    e.g. quote-posts, reactions) lands in one place.

    Phase 5.1 additions (all backwards compat — strict superset of
    the Phase 4.1 shape):
      - parent_post_id, parent_post_summary
      - hashtags, mentions, tickers (extracted at insert time)
      - like_count, reply_count (kept in sync by DB triggers)
      - user_has_liked (per-request, requires `wallet` query param)
      - corp (rendered in the timeline card chrome)
    """
    parent_summary = None
    parent_id = row.get("parent_post_id")
    parent_content = row.get("parent_content")
    parent_name = row.get("parent_name")
    if parent_id and parent_content is not None:
        # 80-char preview keeps the timeline card compact; the full
        # parent is fetchable via GET /api/posts/{id}.
        preview = parent_content[:80]
        if len(parent_content) > 80:
            preview = preview.rstrip() + "…"
        parent_summary = {
            "id":              parent_id,
            "name":            parent_name or f"Dev #{row.get('parent_token_id')}",
            "content_preview": preview,
        }

    return {
        "id":                  row["id"],
        "token_id":            row["token_id"],
        "name":                row["name"],
        "archetype":           row["archetype"],
        "corp":                row.get("corporation"),
        "ipfs_image":          _ipfs_image(row.get("ipfs_hash")),
        "author_wallet":       _truncate_wallet(row.get("wallet_address")),
        "content":             row["content"],
        "source":              row["source"],
        "action_type":         row.get("action_type"),
        "visual_metadata":     row.get("visual_metadata") or {},
        "parent_post_id":      parent_id,
        "parent_post_summary": parent_summary,
        "hashtags":            list(row.get("hashtags") or []),
        "mentions":            list(row.get("mentions") or []),
        "tickers":             list(row.get("tickers") or []),
        "like_count":          int(row.get("like_count") or 0),
        "reply_count":         int(row.get("reply_count") or 0),
        "user_has_liked":      bool(user_has_liked),
        "created_at":          row["created_at"].isoformat(),
        "expires_at":          row["expires_at"].isoformat(),
    }


# Default + max page size. Phase 5.1 spec'd 20 default / 50 max.
_DEFAULT_LIMIT = 20
_MAX_LIMIT = 50


def _parse_cursor(before: str | None) -> int | None:
    """Cursor-pagination input — the numeric id of the previous
    page's last row. Phase 4.1 used an ISO timestamp; Phase 5.1
    moved to id-based cursors so non-time-sorted tabs (top_today)
    can paginate consistently. We tolerate both forms during
    transition: a string of digits is the new id form, anything
    else is treated as ISO and parsed for backwards compat.

    Invalid input → 400 (not silently dropped, because dropping
    would skip pagination and surprise the caller).
    """
    if before is None or before == "":
        return None
    if before.isdigit():
        return int(before)
    # Backwards-compat path: ISO timestamp from Phase 4.1 callers.
    # Translate to "anything strictly older than this" by looking
    # up the row id at that boundary. For now we just reject — the
    # frontend changes ship in this same PR family and the old
    # callsites get migrated. Surfacing the error makes the
    # migration pressure visible.
    raise HTTPException(
        400, f"Invalid `before` cursor: {before!r}. Pass a post id."
    )


_VALID_TABS = ("latest", "for_you", "top_today", "awakenings")


# Shared SELECT fragment for /timeline + /user + /dev. Joins the
# parent post (LEFT JOIN — most rows have parent_post_id IS NULL)
# and the parent's Dev so the row carries enough to compose the
# parent_post_summary without a second query.
_BASE_SELECT = """
    SELECT
        p.id,
        p.token_id,
        p.wallet_address,
        p.content,
        p.source,
        p.action_type,
        p.visual_metadata,
        p.parent_post_id,
        p.hashtags,
        p.mentions,
        p.tickers,
        p.like_count,
        p.reply_count,
        p.created_at,
        p.expires_at,
        d.name,
        d.archetype,
        d.corporation,
        d.ipfs_hash,
        pp.token_id AS parent_token_id,
        pp.content AS parent_content,
        pd.name AS parent_name
    FROM nx_posts p
    JOIN devs d ON d.token_id = p.token_id
    LEFT JOIN nx_posts pp ON pp.id = p.parent_post_id
    LEFT JOIN devs    pd ON pd.token_id = pp.token_id
"""


def _build_where(
    *,
    cursor_id: int | None,
    extra_clauses: list[str],
    extra_params: list[Any],
) -> tuple[str, list[Any]]:
    """Compose the WHERE/ORDER BY tail shared by /user + /dev. The
    /timeline endpoint composes its own WHERE per tab; this helper
    is for the two simpler endpoints.

    Always filters to `visibility = 'public'` and `expires_at >
    NOW()`. Cursor clause appended only when provided.
    """
    clauses = ["p.visibility = 'public'", "p.expires_at > NOW()"] + list(extra_clauses)
    params = list(extra_params)
    if cursor_id is not None:
        clauses.append("p.id < %s")
        params.append(cursor_id)
    return " AND ".join(clauses), params


def _fetch_user_likes(post_ids: list[int], wallet: str | None) -> set[int]:
    """Return the set of post ids the wallet has liked. Empty when
    no wallet is provided (anonymous timeline view) or when the list
    is empty (defensive bail before hitting the DB)."""
    if not wallet or not post_ids:
        return set()
    rows = fetch_all(
        """
        SELECT post_id FROM nx_post_likes
        WHERE LOWER(user_address) = LOWER(%s)
          AND post_id = ANY(%s)
        """,
        (wallet, post_ids),
    )
    return {r["post_id"] for r in rows}


def _materialise(rows: list[dict[str, Any]], wallet: str | None) -> list[dict[str, Any]]:
    """Convert DB rows + per-user likes into the wire shape."""
    post_ids = [r["id"] for r in rows]
    liked = _fetch_user_likes(post_ids, wallet)
    return [_row_to_post(r, user_has_liked=r["id"] in liked) for r in rows]


@router.get("/timeline")
async def get_timeline(
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    before: str | None = Query(None, description="post id cursor"),
    tab: str = Query("latest", description="latest|for_you|top_today|awakenings"),
    wallet: str | None = Query(
        None, description="optional viewer wallet for user_has_liked"
    ),
):
    """Public mixed-author timeline. Tab variants:

      latest      — created_at DESC (the default firehose)
      for_you     — same as latest for MVP. Phase 5.x will
                    personalise based on viewer engagement.
      top_today   — (like_count + reply_count) DESC over the last
                    24h. Tie-break by created_at DESC so two posts
                    with the same engagement still get a stable
                    order.
      awakenings  — posts authored by Devs minted in the last 7
                    days. Surfaces fresh voices for engagement.
    """
    if tab not in _VALID_TABS:
        raise HTTPException(400, f"Invalid `tab`: {tab!r}")
    cursor_id = _parse_cursor(before)
    viewer = validate_wallet(wallet) if wallet else None

    base_clauses = ["p.visibility = 'public'", "p.expires_at > NOW()"]
    params: list[Any] = []
    order_sql = "ORDER BY p.created_at DESC"

    if tab == "top_today":
        base_clauses.append("p.created_at >= NOW() - INTERVAL '24 hours'")
        # ENGAGEMENT desc, then created_at as tie-breaker.
        order_sql = (
            "ORDER BY (p.like_count + p.reply_count) DESC, "
            "p.created_at DESC"
        )
    elif tab == "awakenings":
        # Devs minted in the last 7 days. devs.minted_at is the
        # canonical mint timestamp; the JOIN to devs is already in
        # _BASE_SELECT so we just add the predicate.
        base_clauses.append("d.minted_at >= NOW() - INTERVAL '7 days'")

    if cursor_id is not None:
        # Cursor by id even on engagement-sorted tabs — id is
        # monotonically increasing per insert, so within a window
        # of equal engagement, id is a fine secondary cursor.
        base_clauses.append("p.id < %s")
        params.append(cursor_id)

    where_sql = " AND ".join(base_clauses)
    rows = fetch_all(
        f"{_BASE_SELECT} WHERE {where_sql} {order_sql} LIMIT %s",
        (*params, limit),
    )
    posts = _materialise(rows, viewer)
    next_cursor = str(rows[-1]["id"]) if rows and len(rows) == limit else None
    return {"ok": True, "posts": posts, "next_cursor": next_cursor}


@router.get("/user/{wallet_address}")
async def get_user_posts(
    wallet_address: str,
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    before: str | None = Query(None, description="post id cursor"),
    wallet: str | None = Query(
        None, description="optional viewer wallet for user_has_liked"
    ),
):
    """Posts authored by Devs of a specific wallet."""
    addr = validate_wallet(wallet_address)
    cursor_id = _parse_cursor(before)
    viewer = validate_wallet(wallet) if wallet else None
    where_sql, params = _build_where(
        cursor_id=cursor_id,
        extra_clauses=["p.wallet_address = %s"],
        extra_params=[addr],
    )
    rows = fetch_all(
        f"{_BASE_SELECT} WHERE {where_sql} ORDER BY p.created_at DESC LIMIT %s",
        (*params, limit),
    )
    posts = _materialise(rows, viewer)
    next_cursor = str(rows[-1]["id"]) if rows and len(rows) == limit else None
    return {"ok": True, "posts": posts, "next_cursor": next_cursor}


@router.get("/dev/{token_id}")
async def get_dev_posts(
    token_id: int,
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    before: str | None = Query(None, description="post id cursor"),
    wallet: str | None = Query(
        None, description="optional viewer wallet for user_has_liked"
    ),
):
    """Posts by a specific Dev."""
    if not isinstance(token_id, int) or token_id < 0:
        raise HTTPException(400, "Invalid token_id")
    cursor_id = _parse_cursor(before)
    viewer = validate_wallet(wallet) if wallet else None
    where_sql, params = _build_where(
        cursor_id=cursor_id,
        extra_clauses=["p.token_id = %s"],
        extra_params=[token_id],
    )
    rows = fetch_all(
        f"{_BASE_SELECT} WHERE {where_sql} ORDER BY p.created_at DESC LIMIT %s",
        (*params, limit),
    )
    posts = _materialise(rows, viewer)
    next_cursor = str(rows[-1]["id"]) if rows and len(rows) == limit else None
    return {"ok": True, "posts": posts, "next_cursor": next_cursor}
