"""NX POST — feed-post generator.

One generator per Dev per tick. The engine's posts-feed tick
iterates eligible Devs and calls `generate_feed_post_for_dev` for
each; the function internally enforces the per-Dev daily cap and
the global posting probability so the engine loop stays simple.

Key design points:

  - DAILY CAP. One feed post per Dev per UTC day. The cap is enforced
    by querying the most recent feed-source post for the Dev and
    checking whether it landed today. A DB-level UNIQUE constraint
    would be over-engineering for the volume — we own the only
    writer (the engine), and a duplicate insertion is a logical bug,
    not a concurrency one.

  - PROBABILISTIC CADENCE. After the cap clears, we still skip with
    probability 1 - DAILY_POST_PROBABILITY. The engine ticks hourly,
    so spreading the daily probability across ~16 waking hours gives
    a natural "Dev decided to post some random hour" feel rather
    than a synchronised top-of-hour stampede.

  - REPLY VS STANDALONE. With probability REPLY_PROBABILITY we look
    for an eligible parent post (not by this same Dev, ≤
    REPLY_MAX_AGE_HOURS old, source IN ('feed','sprkl')) and quote
    its content into the LLM prompt. If no eligible parent exists,
    the function falls through to the standalone path rather than
    bailing — better to post than to skip.

  - LLM FAILURE FALLBACK. If the cascade times out or returns
    nothing, we fall back to the topic seed itself, slightly
    formatted with the archetype's hashtag style. The feed must
    keep flowing even if Groq + Cerebras + Gemini are all down.

  - TEXT EXTRACTION. hashtags / mentions / tickers are extracted
    from the FINAL content (after rewrite). Generated in the same
    function so the persisted row carries pre-computed metadata
    the trending endpoint can aggregate cheaply.
"""

from __future__ import annotations

import asyncio
import logging
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg2.extras

from backend.services.nx_souls.llm_router import call_llm
from backend.services.posts.topics import (
    ARCHETYPE_VOICE,
    DAILY_POST_PROBABILITY,
    REPLY_MAX_AGE_HOURS,
    REPLY_PROBABILITY,
    WEEKLY_TOPICS,
)

log = logging.getLogger("nx_engine")

# ── Tunables ──────────────────────────────────────────────────────────

# Max characters of a generated post. Same Twitter-era convention as
# Sprkls content; the model is asked to honour it but we hard-cap
# regardless so a runaway model can't fill a row with 5000 chars.
MAX_POST_CHARS: int = 280

# LLM timeout (per call). Posts feed is non-blocking — the engine
# loop should never stall on a slow provider; falling back to the
# topic seed is a perfectly acceptable post.
LLM_TIMEOUT_SECONDS: float = 6.0

# Active-Dev energy floor + status filter. The feed has a more
# permissive threshold than sprkls because feed posts are
# background social activity — a Dev with low energy can still
# post a tired-sounding tweet, and the user shouldn't see an
# empty feed when their Devs are exhausted from active gameplay.
# The status filter ('exhausted', 'resting', etc) still blocks
# truly downed Devs.
MIN_DEV_ENERGY: int = 5
INELIGIBLE_DEV_STATUSES: tuple[str, ...] = ("resting", "on_mission", "frozen", "exhausted")

# Total feed-post posting cap per tick. Defends against a freshly-
# minted wallet with thousands of Devs causing a runaway tick. The
# engine's tick budget is tens of seconds tops; at ~1s per LLM call,
# 50 is well within budget.
MAX_POSTS_PER_TICK: int = 50

# ── Text extraction ──────────────────────────────────────────────────

# Hashtags: # followed by 1+ word chars. Lowercased for aggregation
# (the trending endpoint groups regardless of casing).
_HASHTAG_RE = re.compile(r"#(\w+)")
# Mentions: @ followed by 1+ word chars. Same casing convention.
_MENTION_RE = re.compile(r"@(\w+)")
# Tickers: $ followed by 2-8 ASCII upper-case letters. The 2-char
# floor avoids false positives on prices like "$5"; the 8-char ceiling
# is generous enough for $WAGMI18 / $AGENTGOD-style tags without
# matching whole sentences.
_TICKER_RE = re.compile(r"\$([A-Z]{2,8})\b")


def extract_hashtags(content: str) -> list[str]:
    """Return unique lowercased hashtags in `content`."""
    seen: list[str] = []
    for match in _HASHTAG_RE.finditer(content or ""):
        tag = match.group(1).lower()
        if tag not in seen:
            seen.append(tag)
    return seen


def extract_mentions(content: str) -> list[str]:
    """Return unique lowercased @mentions in `content`."""
    seen: list[str] = []
    for match in _MENTION_RE.finditer(content or ""):
        mention = match.group(1).lower()
        if mention not in seen:
            seen.append(mention)
    return seen


def extract_tickers(content: str) -> list[str]:
    """Return unique upper-case $TICKERs in `content`."""
    seen: list[str] = []
    for match in _TICKER_RE.finditer(content or ""):
        ticker = match.group(1).upper()
        if ticker not in seen:
            seen.append(ticker)
    return seen


# ── DB helpers ────────────────────────────────────────────────────────

def _has_dev_posted_today(cur, token_id: int) -> bool:
    """True if this Dev has any feed post created today (UTC).

    'Today' is the SQL CURRENT_DATE in UTC — created_at is TIMESTAMPTZ
    so the comparison is timezone-safe. We don't need to look at
    sprkl posts here: the daily cap is FEED-only by design (Sprkls
    have their own cooldown + per-wallet system).
    """
    cur.execute(
        """
        SELECT 1
        FROM nx_posts
        WHERE token_id = %s
          AND source = 'feed'
          AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
        LIMIT 1
        """,
        (token_id,),
    )
    return cur.fetchone() is not None


def _pick_eligible_parent_post(cur, token_id: int) -> dict | None:
    """Pick a recent post by ANOTHER Dev that this Dev can reply to.

    Filters:
      - source IN ('feed', 'sprkl') — replies can quote either
      - NOT this same Dev (no self-replies)
      - created within REPLY_MAX_AGE_HOURS
      - visibility='public'
      - parent_post_id IS NULL — keep replies one level deep for MVP

    Returns None if no eligible parent exists (caller falls through
    to the standalone path).
    """
    cur.execute(
        """
        SELECT
            p.id,
            p.token_id,
            p.content,
            d.name AS author_name
        FROM nx_posts p
        JOIN devs d ON d.token_id = p.token_id
        WHERE p.token_id != %s
          AND p.source IN ('feed', 'sprkl')
          AND p.visibility = 'public'
          AND p.parent_post_id IS NULL
          AND p.created_at >= NOW() - %s::interval
        ORDER BY RANDOM()
        LIMIT 1
        """,
        (token_id, f"{REPLY_MAX_AGE_HOURS} hours"),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "id":          row["id"],
        "token_id":    row["token_id"],
        "content":     row["content"],
        "author_name": row.get("author_name") or f"Dev #{row['token_id']}",
    }


def _eligible_devs_for_feed(cur) -> list[dict[str, Any]]:
    """Return all Devs eligible to post in the feed this tick.

    Eligibility: energy > MIN_DEV_ENERGY, status NOT IN
    INELIGIBLE_DEV_STATUSES, has owner_address. Unlike Sprkls (which
    is gated to beta wallets only), the feed surfaces ALL Devs from
    ALL wallets — Phase 5 product decision so the timeline feels
    populated regardless of who's onboarded.
    """
    cur.execute(
        """
        SELECT
            token_id,
            name,
            archetype,
            owner_address,
            energy,
            status
        FROM devs
        WHERE energy > %s
          AND status NOT IN %s
          AND owner_address IS NOT NULL
        """,
        (MIN_DEV_ENERGY, INELIGIBLE_DEV_STATUSES),
    )
    rows = cur.fetchall() or []
    return [
        {
            "token_id":      r["token_id"],
            "name":          r.get("name") or f"Dev #{r['token_id']}",
            "archetype":     r.get("archetype") or "INFLUENCER",
            "owner_address": (r.get("owner_address") or "").lower(),
        }
        for r in rows
    ]


# ── LLM rewrite (best-effort, fall back to topic seed on failure) ────

_FEED_SYSTEM_PROMPT = (
    "You are writing a single short social-media post in-character "
    "for a Dev in a satirical AI/crypto simulation. Match the tone "
    "and example phrasing exactly. Reference the topic seed loosely — "
    "don't copy it. Write ONE post, ≤{max_len} chars, no quotes, no "
    "leading explanations. May include 1 hashtag and/or 1 ticker."
)

_FEED_REPLY_SYSTEM_PROMPT = (
    "You are writing a single short social-media REPLY in-character. "
    "Match your tone and examples. The reply should react to the "
    "parent post's content (quoted in the user message). Brief, in-"
    "character, ≤{max_len} chars, no quotes, no leading explanations."
)


def _build_user_message(
    *,
    voice: dict[str, Any],
    topic_seed: str,
    parent_post: dict | None,
) -> str:
    """Assemble the LLM user message. Examples are bullet-listed so
    the model treats them as voice anchors rather than ground truth
    to copy verbatim."""
    examples_block = "\n".join(f"- {e}" for e in voice.get("examples", []))
    if parent_post:
        return (
            f"Tone: {voice['tone']}\n"
            f"Hashtag style: {voice['hashtag_style']}\n"
            f"Voice examples:\n{examples_block}\n\n"
            f"Replying to @{parent_post['author_name']}:\n"
            f"  > {parent_post['content']}\n\n"
            f"Topic seed (loose inspiration): {topic_seed}"
        )
    return (
        f"Tone: {voice['tone']}\n"
        f"Hashtag style: {voice['hashtag_style']}\n"
        f"Voice examples:\n{examples_block}\n\n"
        f"Topic seed: {topic_seed}"
    )


async def _llm_generate_async(
    voice: dict[str, Any],
    topic_seed: str,
    parent_post: dict | None,
) -> str | None:
    """Call the cascade. Returns the generated post or None on
    failure. Persona is the rewrite-instruction system prompt;
    `climax=False` forces the casual cascade (no paid Sonnet tokens
    on routine feed posts)."""
    persona_template = (
        _FEED_REPLY_SYSTEM_PROMPT if parent_post else _FEED_SYSTEM_PROMPT
    )
    persona = persona_template.format(max_len=MAX_POST_CHARS)
    user_message = _build_user_message(
        voice=voice, topic_seed=topic_seed, parent_post=parent_post,
    )
    try:
        response, _provider = await asyncio.wait_for(
            call_llm(
                persona=persona,
                session_messages=[],
                user_message=user_message,
                climax=False,
                # Phase 5.1.1: cost tracking. Falls through to the
                # deterministic _fallback_content path when today's
                # posts_feed budget is hit.
                service="posts_feed",
            ),
            timeout=LLM_TIMEOUT_SECONDS,
        )
    except Exception as e:
        log.info("[posts] LLM generate skipped: %s", e)
        return None
    if not response:
        return None
    cleaned = response.strip().strip('"').strip()
    if len(cleaned) > MAX_POST_CHARS:
        cleaned = cleaned[:MAX_POST_CHARS].rstrip()
    return cleaned or None


def _llm_generate_sync(
    voice: dict[str, Any],
    topic_seed: str,
    parent_post: dict | None,
) -> str | None:
    """Sync wrapper around the async cascade. Same asyncio.run
    pattern as services/sprkls/content._maybe_rewrite_via_llm —
    engine main loop is sync, fresh event loop per call is the
    simplest correct interop."""
    try:
        return asyncio.run(_llm_generate_async(voice, topic_seed, parent_post))
    except RuntimeError:
        return None
    except Exception as e:  # pragma: no cover — defensive
        log.warning("[posts] LLM generate raised: %s", e)
        return None


def _fallback_content(
    voice: dict[str, Any],
    topic_seed: str,
    parent_post: dict | None,
) -> str:
    """Deterministic fallback when the LLM cascade is unavailable.

    Just enough shaping to feel in-character: drop the literal
    bracketed placeholders (so "[absurd thing]" doesn't escape into
    the user-facing feed) and prepend a short archetype-flavored
    snippet. Quality is lower than the LLM path but the feed keeps
    flowing — that's the priority during an outage.
    """
    cleaned_seed = re.sub(r"\[[^\]]*\]", "something", topic_seed).strip()
    if parent_post:
        # Keep replies short — quoting risks burying the original.
        prefix = "this." if random.random() < 0.5 else "ngl..."
        return f"{prefix} {cleaned_seed}"[:MAX_POST_CHARS]
    examples = voice.get("examples") or []
    if examples and random.random() < 0.3:
        return random.choice(examples)[:MAX_POST_CHARS]
    return cleaned_seed[:MAX_POST_CHARS] or "..."


# ── Insertion ────────────────────────────────────────────────────────

def _insert_feed_post(
    cur,
    *,
    dev: dict[str, Any],
    content: str,
    parent_post_id: int | None,
    hashtags: list[str],
    mentions: list[str],
    tickers: list[str],
    now: datetime,
) -> int:
    """Insert one feed post row. Returns the new id.

    expires_at = now + 30 days. Feed posts live longer than sprkls
    (sprkls expire in 7d) because they're the user's social timeline,
    not ephemeral notifications. The cleanup tick that hard-deletes
    expired sprkls applies the same expires_at + grace logic to feed
    posts as a bonus — no extra wiring needed.

    visual_metadata is stored as an empty JSON object: feed posts
    have no UI treatment beyond the standard timeline card. Storing
    {} rather than NULL keeps the column consistently non-null and
    matches the wire shape the frontend expects.
    """
    expires_at = now + timedelta(days=30)
    cur.execute(
        """
        INSERT INTO nx_posts
            (token_id, wallet_address, content, source, action_type,
             visual_metadata, parent_post_id, hashtags, mentions, tickers,
             visibility, is_public, created_at, expires_at)
        VALUES (%s, %s, %s, 'feed', NULL,
                '{}'::jsonb, %s, %s, %s, %s,
                'public', true, %s, %s)
        RETURNING id
        """,
        (
            dev["token_id"],
            dev["owner_address"],
            content,
            parent_post_id,
            hashtags,
            mentions,
            tickers,
            now,
            expires_at,
        ),
    )
    row = cur.fetchone()
    return int(row["id"])


# ── Public entry points ──────────────────────────────────────────────

def generate_feed_post_for_dev(
    cur,
    dev: dict[str, Any],
    *,
    now: datetime | None = None,
    daily_post_probability: float = DAILY_POST_PROBABILITY,
    reply_probability: float = REPLY_PROBABILITY,
) -> int | None:
    """Generate one feed post for one Dev, or return None if skipped.

    Skip reasons (any of):
      - Dev has already posted today (daily cap)
      - Probabilistic skip (1 - daily_post_probability)
      - Post insertion exception (logged + swallowed)

    `daily_post_probability` and `reply_probability` are parameters
    so tests can pin behaviour without monkeypatching module globals.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    # 1. Daily cap — 1 feed post per Dev per UTC day.
    if _has_dev_posted_today(cur, dev["token_id"]):
        return None

    # 2. Probabilistic skip. Hourly tick × ~16 waking hours × 0.6 ≈
    # 9.6 attempted-posts-per-day-of-life, capped to 1 by the daily
    # check above; so each Dev posts on most days but not every day.
    if random.random() > daily_post_probability:
        return None

    archetype = dev.get("archetype") or "INFLUENCER"
    voice = ARCHETYPE_VOICE.get(archetype) or ARCHETYPE_VOICE["INFLUENCER"]

    # 3. Reply vs standalone. If we roll a reply but no eligible
    # parent exists, fall through to standalone — better to post
    # than to skip on a thread-density technicality.
    parent_post = None
    if random.random() < reply_probability:
        parent_post = _pick_eligible_parent_post(cur, dev["token_id"])

    # 4. Pick a topic category from the archetype's preference list
    # (weighted toward the front: first preference 50%, second 30%,
    # rest split). Keeps voice consistent without making it
    # deterministic.
    categories = voice.get("topics_preference") or list(WEEKLY_TOPICS.keys())
    weights = [50, 30, 15, 5][: len(categories)]
    if len(weights) < len(categories):
        weights += [1] * (len(categories) - len(weights))
    category = random.choices(categories, weights=weights, k=1)[0]
    topic_items = WEEKLY_TOPICS.get(category, {}).get("items") or [
        "something happened today"
    ]
    topic_seed = random.choice(topic_items)

    # 5. LLM call with deterministic fallback.
    content = _llm_generate_sync(voice, topic_seed, parent_post)
    if not content:
        content = _fallback_content(voice, topic_seed, parent_post)

    # 6. Extract metadata from the FINAL content. If the LLM
    # inserted hashtags/tickers we capture them; if it didn't,
    # the arrays are empty (DEFAULT '{}' on the column).
    hashtags = extract_hashtags(content)
    mentions = extract_mentions(content)
    tickers = extract_tickers(content)

    # 7. Insert. Wrap in try/except — the engine tick must not abort
    # because one row failed; the tick caller logs and moves on.
    try:
        post_id = _insert_feed_post(
            cur,
            dev=dev,
            content=content,
            parent_post_id=parent_post["id"] if parent_post else None,
            hashtags=hashtags,
            mentions=mentions,
            tickers=tickers,
            now=now,
        )
    except Exception as e:
        log.warning(
            "[posts] insert failed dev=%s: %s",
            dev.get("token_id"), e,
        )
        return None

    log.info(
        "[posts] generated id=%s dev=%s archetype=%s reply_to=%s",
        post_id, dev["token_id"], archetype,
        parent_post["id"] if parent_post else None,
    )
    return post_id


def run_feed_generation_tick(
    conn,
    *,
    max_posts: int = MAX_POSTS_PER_TICK,
) -> int:
    """Engine-loop entry point. Returns the count of feed posts
    inserted across all eligible Devs in this tick.

    Cursor factory: explicitly RealDictCursor (Phase 4.1.1 lesson —
    the engine's get_db() returns a tuple-default connection).

    `max_posts` caps total inserts per tick. This is a safety rail
    for unusual states (large new-wallet onboarding, etc.) — the
    per-Dev daily cap should normally keep us well below 50.
    """
    inserted = 0
    now = datetime.now(timezone.utc)

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        devs = _eligible_devs_for_feed(cur)
        # Shuffle so the same Devs don't always race to fill the
        # max_posts budget when probability-skip is high.
        random.shuffle(devs)
        for dev in devs:
            if inserted >= max_posts:
                break
            try:
                new_id = generate_feed_post_for_dev(cur, dev, now=now)
                if new_id is not None:
                    inserted += 1
            except Exception as e:
                log.warning(
                    "[posts] tick dev=%s aborted: %s",
                    dev.get("token_id"), e,
                )
                continue

    if inserted > 0:
        log.info("[posts] tick complete — %d new feed post(s)", inserted)
    return inserted
