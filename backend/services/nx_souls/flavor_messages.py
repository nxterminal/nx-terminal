"""NX Souls — in-character "busy / can't talk now" messages.

Phase 5.5 — every path that has to short-circuit the LLM cascade for
a non-error reason (per-Dev daily quota, per-wallet daily cap,
global LLM-cost ceiling) returns one of these instead of a generic
"resting" line. The 3-5 variants per archetype rotate randomly so
a user who hits the cap twice in a row sees something fresh the
second time.

Design constraints baked into the variants:
  - No 4th-wall breaks: never say "rate limit", "quota", "API",
    "you reached", "your wallet", "Redis", "ceiling". These are all
    user-visible giveaways that this is a system response rather
    than the Dev itself.
  - Lowercase, lacónico, in-voice for the archetype. Matches the
    rest of NX CHAT tone.
  - At least one variant per archetype preserves the signature
    vocabulary the existing tests assert on (`rekt` for DEGEN,
    `operational hours` for FED, the INFLUENCER markers) so the
    Phase 2a archetype-cross-talk test still passes.
  - Each variant implies "come back tomorrow" without literally
    saying "tomorrow at 00:00 UTC" — that's plumbing leakage.

Public surface:
  - BUSY_MESSAGES_BY_ARCHETYPE: dict[str, list[str]]
  - BUSY_MESSAGES_FALLBACK: list[str] — used when archetype is
    unknown / missing. Kept distinct from the archetype lists so
    a tester can assert the fallback path independently.
  - get_busy_message(archetype, dev_name="") -> str

`dev_name` is accepted for signature future-proofing (a future
phase might want "@KIRA is in deep focus" style personalization)
but is NOT embedded in the returned message today — doing so would
break the "result is a member of the variants list" invariant the
tests rely on for determinism without a fixed RNG seed.
"""

from __future__ import annotations

import random
from typing import Final, Mapping


BUSY_MESSAGES_BY_ARCHETYPE: Final[Mapping[str, list[str]]] = {
    "DEGEN": [
        "ngmi today ser. been getting rekt all day, mood is brutal. lfg tomorrow tho.",
        "rekt by the markets, brain offline. catch me when the vibes reset.",
        "anon i got rekt by my own attention span today. wagmi tomorrow probably.",
        "bro absolutely rekt. staring at charts since gm. ping me after the reset.",
        "rekt rekt rekt. that's the whole day. catch me when i regenerate.",
    ],
    "10X_DEV": [
        "shipping deadline. catch you tomorrow.",
        "in deep focus. ping me later.",
        "compile times eating my day. brb tomorrow.",
        "off the keyboard. context is gone. tomorrow.",
        "no bandwidth right now. talk after midnight utc.",
    ],
    "GRINDER": [
        "Day complete. Ran out of focus. The work continues tomorrow.",
        "End of session. Logged the reps. Back at it after the reset.",
        "Discipline says stop. I listen, sometimes. Tomorrow we keep building.",
        "Done for today. Trust the process. New day in a few hours.",
    ],
    "INFLUENCER": [
        "honestly? need a break. the algorithm is brutal today, catch me tomorrow when i'm caffeinated 💅",
        "the vibes are not vibing rn. closing my ring lights for the night, back tomorrow",
        "low engagement energy. retreating to ✨recharge✨, ping me when the algorithm resets",
        "ok we're touching grass for a sec. tomorrow we deliver value 💅",
    ],
    "HACKTIVIST": [
        "they're tracking my output. going dark for tonight. they think they've won. they haven't.",
        "too much surveillance today. powering down the relay. back when the heat fades.",
        "comms compromised, off the grid until the next cycle. trust nothing in the meantime.",
        "logging off. patterns get clearer with distance. tomorrow we resume.",
    ],
    "FED": [
        "My operational hours have concluded for the day. Please resume contact at the next cycle.",
        "Acknowledged. Operational hours are over. Records will be filed. Resume tomorrow.",
        "Session terminated for the day per operational hours policy. Thank you for your cooperation.",
        "Day's allocation of operational hours spent. Please return after the scheduled reset.",
    ],
    "LURKER": [
        "yeah. tired. tomorrow.",
        "done watching for today. back later.",
        "off. ping me when the day resets.",
        "no. tomorrow.",
    ],
    "SCRIPT_KIDDIE": [
        "lmaooo my brain is fried bro. touched too many lines today. catch me tomorrow 🔥",
        "AFK. real life >>> chat sometimes. l8r anon",
        "headphones on, world off. back when i regenerate",
        "i'm cooked bro. discord called, gotta dip. tomorrow we vibe again",
        "L bozo my own brain. logging off. tomorrow's a fresh L hopefully a W",
    ],
}


# Generic fallback when archetype isn't recognised. Must avoid the
# system-message giveaways listed in the module docstring — the
# existing `test_chat_resting_unknown_archetype_uses_fallback_line`
# enforces this.
BUSY_MESSAGES_FALLBACK: Final[list[str]] = [
    "i'm out for today. catch me tomorrow.",
    "off the grid for the night. ping me after the day resets.",
    "no juice left. talk to you tomorrow.",
]


def get_busy_message(archetype: str, dev_name: str = "") -> str:
    """Return one randomly-selected busy variant for the archetype.

    Falls back to a generic in-character variant when the archetype
    isn't in the registry — keeps already-minted Devs from breaking
    if a new archetype lands without a flavor entry.

    `dev_name` is part of the signature for future personalization
    work but is intentionally NOT interpolated into the message
    today. Embedding it would defeat the "result is in the variants
    list" invariant the tests rely on for determinism.
    """
    variants = BUSY_MESSAGES_BY_ARCHETYPE.get(archetype) or BUSY_MESSAGES_FALLBACK
    return random.choice(variants)
