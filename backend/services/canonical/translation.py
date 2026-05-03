"""
Canonical-traits translation layer (Phase 2.2 Option B).

Production DB stores trait values in their internal format
(`UPPER_SNAKE` for archetype/corporation, lowercase for rarity). The bundle
on GitHub stores them in OpenSea-friendly Title Case ("10X Dev",
"Closed AI", "Common"). This module provides bidirectional dictionaries
so that:

  - the alignment script and the listener can convert bundle values to
    DB internal values (`from_bundle_to_db`),
  - the metadata-emit boundary can convert DB internal values to public
    bundle-format values (`to_public`),

without any code path needing to know the conventions of the other side.

Three axes need translation: archetype, corporation, rarity. Six other
axes (species, alignment, risk_level, social_style, coding_style,
work_ethic) are stored in DB exactly as they appear in the bundle, so
their translation is the identity function.

NX-PHASE-2.2: see migrations/20260503_phase22_canonical.sql.
"""

from __future__ import annotations

from typing import Final, Mapping

# ── Internal (DB) → Public (bundle / OpenSea) ──────────────────────────────
ARCHETYPE_TO_PUBLIC: Final[Mapping[str, str]] = {
    "10X_DEV":       "10X Dev",
    "DEGEN":         "Degen",
    "GRINDER":       "Grinder",
    "INFLUENCER":    "Influencer",
    "HACKTIVIST":    "Hacktivist",
    "FED":           "Fed",
    "LURKER":        "Lurker",
    "SCRIPT_KIDDIE": "Script Kiddie",
}

CORPORATION_TO_PUBLIC: Final[Mapping[str, str]] = {
    "CLOSED_AI":         "Closed AI",
    "MISANTHROPIC":      "Misanthropic",
    "SHALLOW_MIND":      "Shallow Mind",
    "ZUCK_LABS":         "Zuck Labs",
    "Y_AI":              "Y.AI",
    "MISTRIAL_SYSTEMS":  "Mistrial Systems",
}

RARITY_TO_PUBLIC: Final[Mapping[str, str]] = {
    "common":    "Common",
    "uncommon":  "Uncommon",
    "rare":      "Rare",
    "legendary": "Legendary",
    "mythic":    "Mythic",
}

# ── Inverse (Bundle → Internal) ────────────────────────────────────────────
ARCHETYPE_FROM_BUNDLE: Final[Mapping[str, str]] = {v: k for k, v in ARCHETYPE_TO_PUBLIC.items()}
CORPORATION_FROM_BUNDLE: Final[Mapping[str, str]] = {v: k for k, v in CORPORATION_TO_PUBLIC.items()}
RARITY_FROM_BUNDLE: Final[Mapping[str, str]] = {v: k for k, v in RARITY_TO_PUBLIC.items()}

# Axes that need translation. All other trait axes (species, alignment,
# risk_level, social_style, coding_style, work_ethic) pass through unchanged.
TRANSLATED_AXES: Final[frozenset[str]] = frozenset({"archetype", "corporation", "rarity"})

# Final canonical value sets for the six VARCHAR axes — used by Step 5b
# CHECK constraints and by tests to confirm coverage of the live DB.
CANONICAL_SPECIES: Final[frozenset[str]] = frozenset({"Bunny", "Zombie", "Robot", "Ghost"})
CANONICAL_SOCIAL_STYLE: Final[frozenset[str]] = frozenset({
    "Quiet", "Social", "Loud", "Influencer", "Silent",
})
CANONICAL_CODING_STYLE: Final[frozenset[str]] = frozenset({
    "Chaotic", "Methodical", "Minimalist", "Over-Engineer", "Perfectionist", "Speedrun",
})
CANONICAL_WORK_ETHIC: Final[frozenset[str]] = frozenset({
    "Casual", "Dedicated", "Lazy", "Obsessed",
})
CANONICAL_ALIGNMENT: Final[frozenset[str]] = frozenset({
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil",
})
CANONICAL_RISK_LEVEL: Final[frozenset[str]] = frozenset({
    "Conservative", "Moderate", "Aggressive", "Reckless",
})


# ── Conversion helpers ─────────────────────────────────────────────────────


def from_bundle_to_db(bundle_value: str, axis: str) -> str:
    """Convert a bundle-format value to the DB internal format for `axis`.

    For axes outside `TRANSLATED_AXES`, the value passes through unchanged.

    Raises:
        KeyError: if `axis ∈ TRANSLATED_AXES` and the value isn't recognised.
            The caller should treat this as a hard failure — an unknown
            value means either the bundle has a new entry the code doesn't
            know about, or the input came from somewhere other than the
            bundle.
    """
    if axis == "archetype":
        return ARCHETYPE_FROM_BUNDLE[bundle_value]
    if axis == "corporation":
        return CORPORATION_FROM_BUNDLE[bundle_value]
    if axis == "rarity":
        return RARITY_FROM_BUNDLE[bundle_value]
    return bundle_value


def to_public(db_value: str, axis: str) -> str:
    """Convert a DB-internal value to the public (bundle) format for `axis`.

    For axes outside `TRANSLATED_AXES`, the value passes through unchanged.

    Raises:
        KeyError: if `axis ∈ TRANSLATED_AXES` and the value isn't recognised.
    """
    if axis == "archetype":
        return ARCHETYPE_TO_PUBLIC[db_value]
    if axis == "corporation":
        return CORPORATION_TO_PUBLIC[db_value]
    if axis == "rarity":
        return RARITY_TO_PUBLIC[db_value]
    return db_value


def quirk_to_public(quirk_internal: str | None) -> str:
    """Translate snake_case NX-Souls quirk to Title Case for public metadata.

    Examples:
        "speaks_lowercase"        → "Speaks Lowercase"
        "always_says_one_more_thing" → "Always Says One More Thing"
        ""                         → ""
        None                       → ""

    Mechanical: split on `_`, `str.capitalize()` each token, join with spaces.
    No lookup table — the quirk pool grows by appending and we don't want
    to require a translation-map update for each new value.
    """
    if not quirk_internal:
        return ""
    return " ".join(word.capitalize() for word in quirk_internal.split("_"))
