"""NX Souls — full-content message store (Phase 3.5.1).

Distinct from `nx_souls_messages_cache` (Phase 1 — lengths-only
observability log). This module owns:

  - inserting user / assistant / system messages with a 24h TTL
  - sliding-window TTL refresh on every new message in a chat (so an
    active conversation never expires mid-session)
  - reading active chat history for one Dev
  - listing every chat the wallet still has active messages in
  - manual cleanup of expired rows (no cron in this phase; ops can
    call cleanup_expired_messages() directly when needed)

The `expires_at` value is computed at insert time as
`created_at + MESSAGE_TTL_HOURS`. Sliding-window logic in
`insert_message_and_refresh_chat` updates the expires_at of every
not-yet-expired message in the same (wallet, token) pair to match
the new row's expires_at, so a long thread keeps refreshing the TTL
on every send.

Postgres cursor convention: deps.init_db_pool uses
`psycopg2.extras.RealDictCursor`, so `cur.fetchone()` returns a
dict, not a tuple. Helpers below use dict access (`row["id"]`).

Persistence is best-effort. The chat endpoint must not break if a
DB transient kills these inserts — the user still gets their
LLM reply.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from backend.api.deps import fetch_all, get_db

# 24 hours sliding window. Keeping the constant module-scope so tests
# can monkeypatch a shorter TTL when exercising expiry behaviour.
MESSAGE_TTL_HOURS = 24


def calculate_expires_at(base_time: datetime | None = None) -> datetime:
    """Return `base_time + MESSAGE_TTL_HOURS`.

    Always tz-aware UTC. Naive inputs are treated as UTC for safety —
    the schema column is TIMESTAMPTZ so any drift would surface
    immediately on insert."""
    if base_time is None:
        base_time = datetime.now(timezone.utc)
    elif base_time.tzinfo is None:
        base_time = base_time.replace(tzinfo=timezone.utc)
    return base_time + timedelta(hours=MESSAGE_TTL_HOURS)


def insert_message_and_refresh_chat(
    wallet_address: str,
    token_id: int,
    role: str,
    content: str,
    *,
    is_climax: bool = False,
    is_resting: bool = False,
    provider_used: str | None = None,
) -> int:
    """Insert one message + refresh the TTL on the rest of the chat.

    Both the INSERT and the sliding-window UPDATE run in the same
    transaction (single `with get_db()` block) so a partial failure
    leaves no orphan row with a stale expires_at relative to its
    siblings.

    Returns the new message's id.

    Args:
        wallet_address: caller wallet (lowercased before insert).
        token_id: Dev token_id (int).
        role: one of 'user' | 'assistant' | 'system_error' |
            'system_resting'. The CHECK constraint on the column
            rejects anything else; passing an invalid value raises a
            psycopg2 error (caller's best-effort wrapper swallows it).
        content: message text.
        is_climax / is_resting: flags carried from the chat handler.
        provider_used: provider name from the LLM router for assistant
            rows; None for user / system rows.
    """
    addr = wallet_address.lower()
    now = datetime.now(timezone.utc)
    expires_at = calculate_expires_at(now)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nx_souls_messages
                  (token_id, wallet_address, role, content,
                   is_climax, is_resting, provider_used,
                   created_at, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    token_id, addr, role, content,
                    is_climax, is_resting, provider_used,
                    now, expires_at,
                ),
            )
            row = cur.fetchone()
            new_id = row["id"]

            # Sliding window: every still-active message in this chat
            # gets the fresh expires_at. Excluding our own row by id
            # is technically redundant (it already has expires_at) but
            # cheap and clarifies intent. Filter `expires_at > now`
            # ensures we don't accidentally resurrect a row that
            # expired between two sends in the same request — a
            # narrow case but the semantic ("don't bring the dead
            # back") matters for the lazy-cleanup model.
            cur.execute(
                """
                UPDATE nx_souls_messages
                SET expires_at = %s
                WHERE wallet_address = %s
                  AND token_id = %s
                  AND expires_at > %s
                  AND id <> %s
                """,
                (expires_at, addr, token_id, now, new_id),
            )

    return int(new_id)


def get_chat_history(
    wallet_address: str, token_id: int, limit: int = 100
) -> list[dict[str, Any]]:
    """Active messages for one (wallet, token) chat, oldest first.

    Lazy filter on `expires_at > NOW()` — expired rows stay in the
    table until cleanup_expired_messages() runs. Bounded by `limit`
    so a runaway chat doesn't blow up the response payload.
    """
    return fetch_all(
        """
        SELECT id, role, content, is_climax, is_resting,
               provider_used, created_at, expires_at
        FROM nx_souls_messages
        WHERE wallet_address = %s
          AND token_id = %s
          AND expires_at > NOW()
        ORDER BY created_at ASC
        LIMIT %s
        """,
        (wallet_address.lower(), token_id, limit),
    )


def get_active_chats(wallet_address: str) -> list[dict[str, Any]]:
    """One row per chat with the most-recent message preview, sorted
    by recent activity desc. Excludes chats whose messages have all
    expired.

    Window-function variant (ROW_NUMBER OVER PARTITION BY) is the
    cleanest "last row per group" pattern in Postgres and uses the
    `(wallet, token, created_at DESC)` index for the ordering.
    """
    return fetch_all(
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
        SELECT token_id, role, content, created_at, expires_at
        FROM ranked
        WHERE rn = 1
        ORDER BY created_at DESC
        """,
        (wallet_address.lower(),),
    )


def cleanup_expired_messages() -> int:
    """Delete rows where `expires_at <= NOW()`. Returns the number of
    rows removed.

    Manual call only in this phase — ops can run it on demand.
    Phase 4+ may wire this to pg_cron or a Render cron job. The
    `idx_nx_souls_messages_expires_at` index makes the WHERE filter
    cheap even on a fat table.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM nx_souls_messages WHERE expires_at <= NOW()"
            )
            return cur.rowcount or 0
