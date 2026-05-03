"""
NX Souls — deterministic derivation of voice tone, quirk, and lore faction
from a Dev's personality_seed.

Same seed → same output, forever. This is part of the public NFT identity:
once a Dev is minted with seed S, S maps to one (voice_tone, quirk,
lore_faction) tuple and that mapping must never change. Reordering the
rng.choice calls below would silently rotate every existing Dev's NX Souls
identity — DO NOT REORDER.
"""

from __future__ import annotations

import random
from typing import TypedDict

# ── Canonical pools ────────────────────────────────────────────────────────
# Sourced from the Phase 2 brief. Ordered as defined; new values append at
# the end. Removing or reordering any of these breaks every Dev that already
# rolled the affected slot.
VOICE_TONES: tuple[str, ...] = (
    "Sarcastic", "Cynical", "Hopeful", "Aggressive",
    "Mysterious", "Earnest", "Detached", "Manic",
)

QUIRKS: tuple[str, ...] = (
    "speaks_lowercase",
    "uses_too_many_metaphors",
    "obsessed_with_mondays",
    "always_references_their_mom",
    "talks_in_third_person",
    "ends_every_sentence_with_period",
    "never_uses_punctuation",
    "speaks_in_corporate_jargon",
    "quotes_dead_philosophers",
    "compares_everything_to_food",
    "has_strong_opinions_about_typography",
    "names_their_bugs",
    "writes_haiku_apologies",
    "explains_things_via_analogy",
    "rambles_about_old_protocols",
    "fixates_on_round_numbers",
    "uses_archaic_slang",
    "punctuates_with_emoji",
    "speaks_like_a_pirate_when_angry",
    "performs_constant_self_diagnostics",
    "uses_acronyms_excessively",
    "treats_compiler_warnings_as_omens",
    "obsesses_over_keyboard_shortcuts",
    "names_their_caffeine_levels",
    "personifies_their_terminal",
    "calls_everyone_chief",
    "speaks_in_passive_voice",
    "has_a_signature_yawn",
    "narrates_their_own_actions",
    "uses_legal_disclaimers",
    "speaks_only_in_questions_when_tired",
    "references_obscure_papers",
    "compares_self_to_browser_tabs",
    "diagnoses_others_with_imaginary_syndromes",
    "speaks_in_changelog_notes",
    "uses_sport_metaphors_incorrectly",
    "fears_the_letter_z",
    "always_brings_up_the_weather",
    "treats_lunch_as_a_news_event",
    "calls_their_keyboard_their_friend",
    "uses_dashboard_terminology",
    "speaks_in_marketing_copy_when_anxious",
    "rates_things_out_of_ten",
    "narrates_via_imaginary_documentary",
    "uses_loading_metaphors",
    "speaks_in_terms_of_uptime_percentages",
    "treats_naps_as_deployments",
    "uses_compile_errors_as_excuses",
    "speaks_in_imaginary_jira_tickets",
    "always_says_one_more_thing",
)

LORE_FACTIONS: tuple[str, ...] = (
    "Underground", "Mainstream", "Outsider", "Establishment",
)


class NXSoulsTraits(TypedDict):
    voice_tone: str
    quirk: str
    lore_faction: str


def derive_nx_souls_traits(personality_seed: int) -> NXSoulsTraits:
    """Deterministic derivation. Same seed → same (voice_tone, quirk,
    lore_faction) tuple, forever.

    Order of rng.choice calls is fixed and must not change after launch:
    each call advances the RNG state, so reordering would rotate every
    existing Dev's NX Souls identity.
    """
    rng = random.Random(personality_seed)
    return {
        "voice_tone":   rng.choice(VOICE_TONES),
        "quirk":        rng.choice(QUIRKS),
        "lore_faction": rng.choice(LORE_FACTIONS),
    }
