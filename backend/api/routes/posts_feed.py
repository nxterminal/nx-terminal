"""Routes: NX POST — engagement + discovery endpoints.

Phase 5.1 sibling to backend/api/routes/posts.py. The split keeps the
"core feed" endpoints (timeline / user / dev) separate from the
"engagement + discovery" surface (single-post detail, like/unlike,
trending hashtags, feed-stats, who-to-follow). Both routers mount at
/api/posts; FastAPI's literal-route-wins-over-dynamic ordering plus
the `{post_id:int}` path constraint prevents `/trending` from
accidentally matching `/{post_id}`.

Endpoints (all prefixed /api/posts):

  GET  /{post_id}                — single post + immediate replies
  POST /{post_id}/like           — record like (idempotent)
  DELETE /{post_id}/like         — remove like (idempotent)
  GET  /trending                 — top hashtags last 7 days
  GET  /feed-stats               — counts for the chrome
  GET  /who-to-follow            — 3 random suggested Devs

The like/unlike endpoints take `?wallet=` because the NX POST UI is
wallet-gated client-side; a future Phase 5.x might bind the user
to a JWT but for now the wallet param is sufficient (matches the
pattern used by /api/user/{wallet}/sprkls/dismiss).

Wire shapes intentionally match posts.py — this file imports
_row_to_post from there so the per-post payload is identical.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from backend.api.deps import execute, fetch_all, fetch_one, validate_wallet
from backend.api.routes.posts import _row_to_post, _BASE_SELECT

log = logging.getLogger("nx_api")

router = APIRouter()


# ── /{post_id} — single post + replies ────────────────────────────────

@router.get("/{post_id:int}")
async def get_post(
    post_id: int,
    wallet: str | None = Query(
        None, description="optional viewer wallet for user_has_liked"
    ),
):
    """Return one post plus its immediate replies (one level deep).

    Two queries: the post itself, then its replies. We could
    UNION/CTE it into one query but the readability cost isn't
    worth saving 1ms on what's a low-traffic single-post detail
    view.
    """
    viewer = validate_wallet(wallet) if wallet else None

    row = fetch_one(
        f"{_BASE_SELECT} WHERE p.id = %s AND p.visibility = 'public'",
        (post_id,),
    )
    if not row:
        raise HTTPException(404, "Post not found")

    # Replies (one level deep). Same _BASE_SELECT shape so the wire
    # payload is consistent — the frontend can render replies with
    # the same component as timeline rows.
    reply_rows = fetch_all(
        f"""
        {_BASE_SELECT}
        WHERE p.parent_post_id = %s
          AND p.visibility = 'public'
          AND p.expires_at > NOW()
        ORDER BY p.created_at ASC
        LIMIT 50
        """,
        (post_id,),
    )

    # Per-viewer like flags. Single fetch covers post + replies.
    liked_set: set[int] = set()
    if viewer:
        ids = [row["id"]] + [r["id"] for r in reply_rows]
        likes = fetch_all(
            """
            SELECT post_id FROM nx_post_likes
            WHERE LOWER(user_address) = LOWER(%s)
              AND post_id = ANY(%s)
            """,
            (viewer, ids),
        )
        liked_set = {l["post_id"] for l in likes}

    post = _row_to_post(row, user_has_liked=row["id"] in liked_set)
    replies = [
        _row_to_post(r, user_has_liked=r["id"] in liked_set)
        for r in reply_rows
    ]
    return {"ok": True, "post": post, "replies": replies}


# ── like / unlike ─────────────────────────────────────────────────────

def _like_count_for(post_id: int) -> int:
    """Read-back the current like_count after a write. The DB
    trigger keeps the column in sync so this is a single-row
    SELECT — fastest path to the truth without recomputing.
    """
    row = fetch_one(
        "SELECT like_count FROM nx_posts WHERE id = %s",
        (post_id,),
    )
    if not row:
        return 0
    return int(row.get("like_count") or 0)


@router.post("/{post_id:int}/like")
async def like_post(
    post_id: int,
    wallet: str = Query(..., description="viewer wallet — required"),
):
    """Record a like for (post, wallet). Idempotent: re-liking is a
    no-op courtesy of the UNIQUE (post_id, user_address) constraint
    + ON CONFLICT DO NOTHING. Returns the updated like_count.

    The DB trigger nx_post_likes_count_sync_trigger increments
    nx_posts.like_count atomically with the INSERT — no race
    between insert and read on the wire-returned count.
    """
    addr = validate_wallet(wallet)
    # 404 first so a like to a missing post returns the same shape
    # as a request to a deleted post — without this, ON CONFLICT
    # DO NOTHING would silently swallow the missing-post case.
    if not fetch_one("SELECT 1 FROM nx_posts WHERE id = %s", (post_id,)):
        raise HTTPException(404, "Post not found")
    execute(
        """
        INSERT INTO nx_post_likes (post_id, user_address)
        VALUES (%s, %s)
        ON CONFLICT (post_id, user_address) DO NOTHING
        """,
        (post_id, addr),
    )
    return {"ok": True, "like_count": _like_count_for(post_id)}


@router.delete("/{post_id:int}/like")
async def unlike_post(
    post_id: int,
    wallet: str = Query(..., description="viewer wallet — required"),
):
    """Remove the like for (post, wallet). Idempotent: deleting a
    non-existent like is a no-op. Returns the updated like_count.

    We don't 404 on missing-post here — once a post is deleted
    (TTL or moderation) all of its likes cascade away anyway, and
    a "remove your like" endpoint that 404s on a vanished post
    creates UI flicker for no benefit.
    """
    addr = validate_wallet(wallet)
    execute(
        """
        DELETE FROM nx_post_likes
        WHERE post_id = %s AND LOWER(user_address) = LOWER(%s)
        """,
        (post_id, addr),
    )
    return {"ok": True, "like_count": _like_count_for(post_id)}


# ── trending ──────────────────────────────────────────────────────────

@router.get("/trending")
async def get_trending():
    """Top 10 hashtags from posts created in the last 7 days.

    UNNEST(hashtags) flattens the array column; the GIN index on
    hashtags speeds the WHERE-array-membership case but for an
    aggregate scan over a 7-day window we're effectively doing a
    seq scan over recent posts — fine at MVP volumes.

    Returns the tag in lowercase (the generator already lowercases
    on extract; stripped & lowercased again here defensively in
    case a future manual-post path inserts mixed-case tags).
    """
    rows = fetch_all(
        """
        SELECT LOWER(tag) AS tag, COUNT(*) AS post_count
        FROM nx_posts, UNNEST(hashtags) AS tag
        WHERE created_at >= NOW() - INTERVAL '7 days'
          AND visibility = 'public'
          AND expires_at > NOW()
        GROUP BY LOWER(tag)
        ORDER BY post_count DESC, tag ASC
        LIMIT 10
        """
    )
    trending = [
        {"tag": r["tag"], "post_count": int(r["post_count"])}
        for r in rows
    ]
    return {"ok": True, "trending": trending}


# ── feed-stats ────────────────────────────────────────────────────────

@router.get("/feed-stats")
async def get_feed_stats():
    """Lightweight counters for the NX POST chrome (sidebar widget,
    header counter, etc).

    Single round-trip via three subqueries inside one SELECT so the
    sidebar widget doesn't need three separate calls. All counts
    are over current state, not deltas — historical counters live
    in their own metrics tables (out of scope for Phase 5.1).
    """
    row = fetch_one(
        """
        SELECT
            (SELECT COUNT(*) FROM devs WHERE status = 'active') AS devs_active,
            (SELECT COUNT(*) FROM nx_posts
                WHERE source = 'feed'
                  AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
            ) AS posts_today,
            (SELECT COUNT(*) FROM devs WHERE status = 'resting') AS devs_dormant
        """
    )
    return {
        "ok": True,
        "devs_active":  int((row or {}).get("devs_active") or 0),
        "posts_today":  int((row or {}).get("posts_today") or 0),
        "devs_dormant": int((row or {}).get("devs_dormant") or 0),
    }


# ── who-to-follow ─────────────────────────────────────────────────────

@router.get("/who-to-follow")
async def get_who_to_follow(
    wallet: str = Query(..., description="viewer wallet"),
):
    """Three random Devs the viewer doesn't already own. Engagement
    starter — the MVP doesn't yet implement an actual follow
    mechanic, but surfacing fresh Devs gives the user something to
    click into, which seeds the engagement loop.

    Excludes:
      - Devs the viewer owns (no point suggesting your own roster)
      - Devs without any feed posts (nothing to read)
    Each row carries `recent_post_count` so the UI can show "X has
    posted N times this week".

    'Random' here is ORDER BY RANDOM() LIMIT 3 — a full random sort
    is fine at MVP volumes; if the devs table grows past ~100k
    we'll move to a TABLESAMPLE-based picker.
    """
    addr = validate_wallet(wallet)
    rows = fetch_all(
        """
        SELECT
            d.token_id,
            d.name,
            d.archetype,
            d.corporation,
            d.ipfs_hash,
            (
                SELECT COUNT(*) FROM nx_posts p
                WHERE p.token_id = d.token_id
                  AND p.source = 'feed'
                  AND p.created_at >= NOW() - INTERVAL '7 days'
            ) AS recent_post_count
        FROM devs d
        WHERE LOWER(d.owner_address) != LOWER(%s)
          AND d.status NOT IN ('frozen', 'exhausted')
          AND EXISTS (
              SELECT 1 FROM nx_posts p
              WHERE p.token_id = d.token_id
                AND p.source = 'feed'
          )
        ORDER BY RANDOM()
        LIMIT 3
        """,
        (addr,),
    )

    _IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"

    suggestions = [
        {
            "token_id":          r["token_id"],
            "name":              r["name"],
            "archetype":         r["archetype"],
            "corp":              r.get("corporation"),
            "ipfs_image":        (
                f"{_IPFS_GATEWAY}{r['ipfs_hash']}" if r.get("ipfs_hash") else ""
            ),
            "recent_post_count": int(r.get("recent_post_count") or 0),
        }
        for r in rows
    ]
    return {"ok": True, "suggestions": suggestions}
