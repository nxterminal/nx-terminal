"""Reserved nicknames blocklist.

Versioned in source rather than in the DB so an emergency takedown is
a one-line PR + redeploy, not a manual UPDATE on production.

Match is case-insensitive: callers MUST normalise the candidate to
lowercase before consulting `is_reserved`. The set itself is stored
lowercase to keep that contract explicit.
"""

from __future__ import annotations


# Three groups confirmed for v1. Anti-squatting / generic lists were
# considered and deliberately deferred — keep the surface small until
# we see what users actually try to claim.
RESERVED_NICKNAMES: frozenset[str] = frozenset({
    # ── SISTEMA ───────────────────────────────────────────────
    "nxterminal", "nx_terminal", "nx",
    "admin", "system", "root",
    "mod", "mods", "support", "staff", "official", "security",
    "mega_sentinel", "sentinel",
    "nxmail", "nx_mail",
    "post", "nx_post", "nxpost",

    # ── CORPS (con y sin underscore) ──────────────────────────
    "closedai", "closed_ai",
    "misanthropic",
    "shallowmind", "shallow_mind",
    "zucklabs", "zuck_labs",
    "yai", "y_ai",
    "mistrial", "mistrialsystems", "mistrial_systems",

    # ── SKILL MODULES ─────────────────────────────────────────
    "deploy", "audit", "bridge", "broadcast", "arbitrage",
    "infiltrate",
})


def is_reserved(nickname: str) -> bool:
    """Return True iff `nickname` (case-insensitive) is on the blocklist."""
    return nickname.lower() in RESERVED_NICKNAMES
