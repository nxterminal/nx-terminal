"""Sprkls — scheduler tick + cleanup.

Public surface:

  run_sprkls_tick(conn) -> int
      Called every SPRKLS_TICK_MINUTES from the engine main loop.
      Returns the number of new sprkls inserted (mostly for logging /
      tests). Idempotent within one tick: a wallet that was just
      sprkl'd doesn't get a second one because the cooldown check
      reads the row we just inserted.

  cleanup_expired_posts(conn) -> int
      Called every SPRKLS_CLEANUP_HOURS from the engine main loop.
      Hard-deletes rows whose expires_at is more than 24h in the past
      (24h grace window after expiry, easier to debug if something
      goes sideways with TTL math).

Eligibility rules per the brief:

  - Wallet must be in the sprkls beta allowlist
    (services/sprkls/beta.is_in_sprkls_beta).
  - Wallet must own at least one Dev with energy > MIN_ENERGY and
    status NOT IN ('resting', 'on_mission'). The eligible Devs become
    the candidate authors.
  - The wallet's "next sprkl due" time is
    `last_sprkl_at + random(MIN_INTERVAL, MAX_INTERVAL)`. If no prior
    sprkls exist, the cooldown anchors at NOW() minus a random offset
    so a freshly-onboarded wallet doesn't have to wait 60min before
    its first sprkl.

Selection & insertion are wrapped in best-effort try/except per
wallet so one bad row doesn't break the whole tick.
"""

from __future__ import annotations

import json
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from backend.services.sprkls.beta import is_in_sprkls_beta
from backend.services.sprkls.content import generate_sprkl_content
from backend.services.sprkls.templates import get_archetype_action_weights
from backend.services.sprkls.visuals import generate_visual_metadata

log = logging.getLogger("nx_engine")

# ── Tunables ──────────────────────────────────────────────────────────
#
# Bumping these doesn't require a migration. The TTL constant is the
# only one that affects existing rows (newly inserted posts will get
# the new TTL; older rows keep theirs).

SPRKLS_TICK_MINUTES: int = 5
SPRKLS_MIN_INTERVAL_MIN: int = 20
SPRKLS_MAX_INTERVAL_MIN: int = 60
SPRKLS_MIN_DEV_ENERGY: int = 30
SPRKLS_POSTS_TTL_DAYS: int = 7
SPRKLS_CLEANUP_GRACE_HOURS: int = 24


def _weighted_choice(weights: dict[str, int]) -> str | None:
    """Pick a key from a weight dict in proportion to its value.

    None when weights are empty / all-zero — caller handles the
    empty-bucket case rather than crashing the tick.
    """
    items = [(k, w) for k, w in weights.items() if w > 0]
    if not items:
        return None
    keys, ws = zip(*items)
    return random.choices(keys, weights=ws, k=1)[0]


def _eligible_wallets_with_devs(cur) -> list[tuple[str, list[dict[str, Any]]]]:
    """Returns one (wallet, devs[]) pair per beta wallet that owns at
    least one eligible Dev.

    Eligible Dev: energy > SPRKLS_MIN_DEV_ENERGY and status NOT IN
    ('resting', 'on_mission'). The ORDER BY at the end keeps the
    per-tick processing order stable across runs (helpful for
    debugging logs).
    """
    cur.execute(
        """
        SELECT
            owner_address,
            token_id,
            name,
            archetype,
            energy,
            status
        FROM devs
        WHERE energy > %s
          AND status NOT IN ('resting', 'on_mission')
          AND owner_address IS NOT NULL
        ORDER BY owner_address, token_id
        """,
        (SPRKLS_MIN_DEV_ENERGY,),
    )
    rows = cur.fetchall() or []

    grouped: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        wallet = (r.get("owner_address") or "").lower()
        if not wallet or not is_in_sprkls_beta(wallet):
            continue
        grouped.setdefault(wallet, []).append({
            "token_id": r["token_id"],
            "name":     r.get("name"),
            "archetype": r.get("archetype") or "INFLUENCER",
            "energy":   r.get("energy"),
            "status":   r.get("status"),
        })
    return list(grouped.items())


def _last_sprkl_at(cur, wallet: str) -> datetime | None:
    """Return the most recent sprkl-source post timestamp for a
    wallet, or None if it has never been sprkl'd."""
    cur.execute(
        """
        SELECT created_at
        FROM nx_posts
        WHERE wallet_address = %s AND source = 'sprkl'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (wallet,),
    )
    row = cur.fetchone()
    if not row:
        return None
    ts = row.get("created_at")
    # Defend against drivers that hand back tz-naive datetimes —
    # the column is TIMESTAMPTZ so this should never happen, but
    # callers below treat it as tz-aware.
    if ts is not None and ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts


def _is_due(now: datetime, last_sprkl_at: datetime | None) -> bool:
    """Decide whether THIS wallet is due for a new sprkl.

    First-ever case: last_sprkl_at is None. We DON'T want a freshly-
    onboarded wallet to wait the full MIN_INTERVAL before any sprkl —
    they should see action ~within the first tick. So we treat the
    "anchor" as `now - random(MIN, MAX)`, which means due_at <= now
    on the first check.

    Subsequent case: due_at = last_sprkl_at + random(MIN, MAX).
    The random jitter spreads sprkl arrivals so two wallets onboarded
    at the same time don't sync to the same minute.
    """
    if last_sprkl_at is None:
        return True
    jitter_min = random.randint(SPRKLS_MIN_INTERVAL_MIN, SPRKLS_MAX_INTERVAL_MIN)
    due_at = last_sprkl_at + timedelta(minutes=jitter_min)
    return now >= due_at


def _insert_sprkl(
    cur,
    *,
    wallet: str,
    dev: dict[str, Any],
    action_type: str,
    content: str,
    visual_metadata: dict[str, Any],
    now: datetime,
) -> int:
    """Insert one sprkl row. Returns the new id.

    expires_at = now + SPRKLS_POSTS_TTL_DAYS. visual_metadata is
    serialised as JSON for the JSONB column — psycopg2 accepts a
    plain dict on most adapters, but going through json.dumps avoids
    a corner case where a nested non-serialisable value (e.g. a
    Decimal) would explode at insert time.
    """
    expires_at = now + timedelta(days=SPRKLS_POSTS_TTL_DAYS)
    cur.execute(
        """
        INSERT INTO nx_posts
            (token_id, wallet_address, content, source, action_type,
             visual_metadata, is_public, created_at, expires_at)
        VALUES (%s, %s, %s, 'sprkl', %s, %s::jsonb, true, %s, %s)
        RETURNING id
        """,
        (
            dev["token_id"],
            wallet,
            content,
            action_type,
            json.dumps(visual_metadata or {}),
            now,
            expires_at,
        ),
    )
    row = cur.fetchone()
    return int(row["id"])


def _generate_one_sprkl_for_wallet(
    cur,
    wallet: str,
    devs: list[dict[str, Any]],
    now: datetime,
) -> int | None:
    """Pick a Dev + action + content and insert one row. Returns the
    new post id, or None on any exception (logged + swallowed).
    """
    try:
        dev = random.choice(devs)
        weights = get_archetype_action_weights(dev["archetype"])
        action_type = _weighted_choice(weights)
        if action_type is None:
            log.info(
                "[sprkls] skip wallet=%s — no positive weights for archetype=%s",
                wallet, dev["archetype"],
            )
            return None
        content = generate_sprkl_content(dev, action_type)
        visual_metadata = generate_visual_metadata(action_type, dev["archetype"])
        new_id = _insert_sprkl(
            cur,
            wallet=wallet,
            dev=dev,
            action_type=action_type,
            content=content,
            visual_metadata=visual_metadata,
            now=now,
        )
        log.info(
            "[sprkls] generated id=%s wallet=%s dev=%s archetype=%s action=%s",
            new_id, wallet, dev["token_id"], dev["archetype"], action_type,
        )
        return new_id
    except Exception as e:
        log.warning(
            "[sprkls] generation failed wallet=%s: %s",
            wallet, e,
        )
        return None


def run_sprkls_tick(conn) -> int:
    """Engine-loop entry point. Returns the number of new sprkls
    inserted across all eligible wallets in this tick.

    Wraps each wallet in its own try/except so one bad row doesn't
    abort the whole tick. The transaction commits at the end of the
    `with conn.cursor()` block per the project's connection-pool
    convention.
    """
    now = datetime.now(timezone.utc)
    inserted = 0

    with conn.cursor() as cur:
        wallets = _eligible_wallets_with_devs(cur)
        for wallet, devs in wallets:
            try:
                last_at = _last_sprkl_at(cur, wallet)
                if not _is_due(now, last_at):
                    continue
                new_id = _generate_one_sprkl_for_wallet(cur, wallet, devs, now)
                if new_id is not None:
                    inserted += 1
            except Exception as e:
                log.warning("[sprkls] tick wallet=%s aborted: %s", wallet, e)
                continue

    if inserted > 0:
        log.info("[sprkls] tick complete — %d new sprkl(s)", inserted)
    return inserted


def cleanup_expired_posts(conn) -> int:
    """Hard-delete posts whose expires_at is more than the grace
    window in the past. Returns the number of deleted rows.

    The 24h grace exists because sprkl rows are debugging-friendly
    when something goes wrong with TTL math — better to have them
    around for a day after they should have vanished than to lose
    forensic context.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM nx_posts
            WHERE expires_at < NOW() - INTERVAL %s
            """,
            (f"{SPRKLS_CLEANUP_GRACE_HOURS} hours",),
        )
        deleted = cur.rowcount or 0

    if deleted > 0:
        log.info("[sprkls] cleanup deleted %d expired post(s)", deleted)
    return deleted
