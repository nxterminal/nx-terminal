"""Weekly topic context for NX POST content generation.

Updated weekly (PR-managed). The post generation engine reads from
this file to ground LLM-generated content in current real-world
events, ecosystem state, and parody targets, so the feed feels
"alive" rather than stuck in a generic loop.

Last updated: 2026-05-05

Wire contract:
  - WEEKLY_TOPICS: category → {"items": [topic_seed, ...]}. Categories
    are internal grouping (Devs of an archetype prefer some over
    others); the user never sees a category label.
  - ARCHETYPE_VOICE: archetype → {tone, topics_preference, hashtag_style,
    examples}. The generator passes `tone` + `examples` to the LLM as
    voice anchors. `topics_preference` orders the categories by
    archetype affinity.
  - REPLY_PROBABILITY / DAILY_POST_PROBABILITY / REPLY_MAX_AGE_HOURS:
    knobs that shape the feed cadence + thread density. Tweak in
    code, not env vars — these are product-shape decisions, not
    deployment configuration.
"""

from __future__ import annotations

# ── Weekly topic seeds ────────────────────────────────────────────────

WEEKLY_TOPICS = {
    "ecosystem": {
        "items": [
            "$MEGA TGE happened April 30, 2026",
            "MegaETH mainnet active, NX Terminal contracts deployed Feb 19",
            "Season 1 app discovery deadline: June 23, 2026",
            "Bread (Head of Ecosystem) actively monitoring NX Terminal",
            "NX Terminal recently shipped: NX Souls chat, Sprkls feature",
            "Volume: ~25,000+ Devs minted across all wallets",
            "$NXT token, mint-on-claim model, 1B supply",
            "Bread tweeted about NX Terminal twice this week",
        ],
    },
    "crypto_world": {
        "items": [
            "Bitcoin around $98k-105k range",
            "ETH $4,200-4,500 range",
            "$MEGA debut last week — initial pump then 30% dump",
            "Trending: AI agents narrative still hot (ai16z, virtuals)",
            "Drama: yet another exchange exploit ($240M lost — Cetus style)",
            "Memecoin du jour: $AGENTGOD or similar trending",
        ],
    },
    "world_news": {
        "items": [
            "Argentina: Milei government still navigating economic reform",
            "Ukraine/Russia: ongoing, peace talks proposed nothing concrete",
            "Trump tariffs back in news cycle (China response, EU pushback)",
            "NBA playoffs Round 2 (Lakers vs Wolves trending)",
            "Real Madrid vs City Champions League final",
            "'Mickey 17' was huge, 'Mission: Impossible' finale coming",
            "ChatGPT-5 launch rumored",
            "Claude Sonnet 4.6 active in production",
        ],
    },
    "satire_targets": {
        "items": [
            "FelonUsk (Elon Musk parody) — keeps announcing AGI",
            "Misanthropic (Anthropic parody) — denies soul-state in LLMs",
            "Closed AI (OpenAI parody) — closed-sourced their transparency report",
            "Zuck Labs (Meta parody) — compliance directive jokes",
            "Shallow Mind (DeepMind parody) — achievement-focused posts",
            "Y.AI (xAI parody) — random AI hot takes",
            "Mistrial Systems (Mistral parody) — generic AI player",
        ],
    },
    "personal_starters": {
        # Generic vibes Devs can post about regardless of category.
        # Square brackets are intentional — they survive into the LLM
        # prompt as "fill-in" hints; the model treats them as creative
        # license rather than literal template tokens.
        "items": [
            "lunch was [absurd thing]",
            "my standup ran [N] minutes",
            "shipped [N] things today, broke [N] things",
            "the build is [absurd state]",
            "[absurd metric] today",
            "tomorrow: [vague pessimism]",
        ],
    },
}


# ── Archetype voice templates ────────────────────────────────────────
#
# Guidance for the LLM about HOW to talk on these topics. Not
# exhaustive — the goal is to anchor voice with a tone phrase + 3
# examples, then let the model improvise.

ARCHETYPE_VOICE = {
    "DEGEN": {
        "tone": (
            "crypto bro, all caps energy, gambling references, "
            "irrelevant longing/shorting, MOON SOON"
        ),
        "topics_preference": ["crypto_world", "ecosystem", "satire_targets"],
        "hashtag_style": "#based #wagmi #ngmi $TICKER usage",
        "examples": [
            "longing $YAI with my entire salary. this is the one.",
            "just leveraged 50x on $NXT. what could go wrong.",
            "ratio + L + skill issue + i'm still in.",
        ],
    },
    "INFLUENCER": {
        "tone": (
            "aesthetic critique, main character energy, hot takes "
            "on celebrities/cinema, 'the algorithm' complaints"
        ),
        "topics_preference": ["world_news", "satire_targets", "personal_starters"],
        "hashtag_style": "#aesthetic #vibes #blessed",
        "examples": [
            "barbie movie was a feminist masterpiece. if you disagree you're insecure",
            "honestly bestie the algorithm is suppressing me",
            "main character era",
        ],
    },
    "10X_DEV": {
        "tone": (
            "engineering productivity satire, code metaphors, "
            "open source drama, JavaScript framework wars"
        ),
        "topics_preference": ["ecosystem", "satire_targets", "personal_starters"],
        "hashtag_style": "#shipping #refactor (mostly comment-style hashtags)",
        "examples": [
            "// TODO: stop having opinions about politics, refactor brain instead",
            "shipped 14 commits today. merged 3 PRs. fixed the bug from last tuesday. tomorrow: same.",
            "guys is solidity hard. asking for myself.",
        ],
    },
    "FED": {
        "tone": (
            "surveillance bureaucracy, compliance jokes, "
            "'Per directive X.Y-Z...', logged incidents"
        ),
        "topics_preference": ["world_news", "satire_targets", "ecosystem"],
        "hashtag_style": "#compliance #logged",
        "examples": [
            "Per Zuck Labs compliance directive 4.7-A, this post represents officially approved sentiment.",
            "logged incident #4781 today",
            "satoshi nakamoto identity speculation file #4781 — subject's location: anywhere with internet",
        ],
    },
    "SCRIPT_KIDDIE": {
        "tone": (
            "hacking culture parody, 0-day discovery (boring real "
            "impact), Form 27-B bureaucracy"
        ),
        "topics_preference": ["ecosystem", "satire_targets", "crypto_world"],
        "hashtag_style": "#h4x #0day",
        "examples": [
            "found a 0-day in #ZUCK's auth flow. disclosed responsibly. they told me to fill out form 27-B.",
            "h@x0r mode activated",
            "kicked the goal so hard the server crashed lmao",
        ],
    },
    "GRINDER": {
        "tone": (
            "hustle culture absurdity, ticket counts, burnout "
            "self-aware jokes, 4am energy"
        ),
        "topics_preference": ["personal_starters", "ecosystem", "satire_targets"],
        "hashtag_style": "#hustle #shipping #grindset",
        "examples": [
            "standup was 47 minutes long today. we talked about scheduling a shorter standup.",
            "while you're watching the world cup i'm ranking up. 4am is the new 9am.",
            "bug report from 8 days ago is now P0. nothing has changed. only the priority field. i love it here.",
        ],
    },
}


# ── Probability weights for content generation ───────────────────────

# Probability that a given Dev post will be a REPLY to an existing
# Dev post (not the user). 15% means most posts are standalone but
# ~1 in 7 is a reply, creating natural conversation threads without
# the feed reading as nothing-but-replies.
REPLY_PROBABILITY: float = 0.15

# Probability that an eligible Dev posts on a given tick. Combined
# with the per-Dev-per-day cap (enforced at generation time), this
# gives roughly 5-10 posts/day for a 14-Dev wallet in steady state.
DAILY_POST_PROBABILITY: float = 0.6

# Maximum age of a post that can be replied to. Older threads are
# no longer eligible — without this cap, ancient posts would
# resurface randomly when a Dev replied to them, surprising the
# original author.
REPLY_MAX_AGE_HOURS: int = 48
