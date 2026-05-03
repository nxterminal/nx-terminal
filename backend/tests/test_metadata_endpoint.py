"""Tests for the Phase 3 metadata-endpoint composer.

Targets `backend.services.canonical.metadata.compose_metadata` — a pure
function extracted from the route handler so it can be unit-tested
without psycopg2 / fastapi / starlette in the import chain.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest  # noqa: E402

from backend.services.canonical.metadata import (  # noqa: E402
    compose_metadata,
    emit_optional_visual as _emit_optional_visual,
)


# ── Sample dev row built from token #29572's known DB state ───────────────


def _row_29572(**overrides) -> dict:
    base = {
        "token_id":          29572,
        "name":              "LYNX-X0",
        # Identity in DB-internal format (post Phase 2.2 alignment)
        "species":           "Bunny",
        "archetype":         "INFLUENCER",     # → "Influencer"
        "corporation":       "ZUCK_LABS",      # → "Zuck Labs"
        "rarity_tier":       "common",         # → "Common"
        "alignment":         "Neutral Good",
        "risk_level":        "Conservative",
        "social_style":      "Influencer",
        "coding_style":      "Over-Engineer",
        "work_ethic":        "Lazy",
        # Stats
        "stat_coding":       95,
        "stat_hacking":      82,
        "stat_trading":      33,
        "stat_social":       64,
        "stat_endurance":    28,
        "stat_luck":         53,
        # Live state
        "status":            "active",
        "mood":              "excited",
        "location":          "DARK_WEB",
        "energy":            60,
        "reputation":        2256,
        "balance_nxt":       9,
        # Activity
        "coffee_count":      61,
        "lines_of_code":     74155,
        # Volatile noise — present in DB, must NOT appear in output.
        "day":               14,
        "bugs_shipped":      8,
        "hours_since_sleep": 33,
        "protocols_created": 3,
        "protocols_failed":  1,
        "biggest_win":       "Hacked the mainframe at day 17",
        "total_earned":      99999,
        # Image
        "ipfs_hash":         "bafy.../29572.gif",
        # Joined from dev_canonical_traits
        "clothing":          "Sweater V2",
        "clothing_pattern":  "H Stripes",
        "eyewear":           "None",   # ← must be filtered out
        "neckwear":          "None",
        "spots":             "Heavy",
        "blush":             False,    # bool → "No" but only emitted if not omitted
        "ear_detail":        True,
        "voice_tone":        "Aggressive",
        "quirk":             "speaks_lowercase",
        "lore_faction":      "Mainstream",
    }
    base.update(overrides)
    return base


def _attrs_by_type(meta: dict) -> dict:
    return {a["trait_type"]: a for a in meta["attributes"]}


# ── 1. Translation correctness ────────────────────────────────────────────


def test_archetype_translated_to_title_case():
    meta = compose_metadata(_row_29572(), 29572)
    by = _attrs_by_type(meta)
    assert by["Archetype"]["value"] == "Influencer"
    assert "INFLUENCER" not in [a.get("value") for a in meta["attributes"]]


def test_corporation_translated_to_title_case_with_dot_for_y_ai():
    meta = compose_metadata(_row_29572(corporation="Y_AI"), 29572)
    assert _attrs_by_type(meta)["Corporation"]["value"] == "Y.AI"


def test_rarity_translated_to_title_case():
    for db, public in [("common", "Common"), ("uncommon", "Uncommon"),
                       ("rare", "Rare"), ("legendary", "Legendary"),
                       ("mythic", "Mythic")]:
        meta = compose_metadata(_row_29572(rarity_tier=db), 29572)
        assert _attrs_by_type(meta)["Rarity"]["value"] == public


def test_unknown_internal_value_falls_back_to_raw_with_warning(caplog):
    """Defensive: an enum value the translator doesn't know should NOT
    crash the endpoint — emit raw + log a warning."""
    meta = compose_metadata(_row_29572(archetype="WEIRD_NEW_TYPE"), 29572)
    assert _attrs_by_type(meta)["Archetype"]["value"] == "WEIRD_NEW_TYPE"


# ── 2. NX Souls axes present ──────────────────────────────────────────────


def test_nx_souls_three_axes_emitted():
    meta = compose_metadata(_row_29572(), 29572)
    by = _attrs_by_type(meta)
    assert by["Voice Tone"]["value"] == "Aggressive"
    assert by["Quirk"]["value"] == "Speaks Lowercase"  # snake → Title
    assert by["Lore Faction"]["value"] == "Mainstream"


def test_nx_souls_axes_omitted_when_canonical_join_missing():
    meta = compose_metadata(
        _row_29572(voice_tone=None, quirk=None, lore_faction=None),
        29572,
    )
    by = _attrs_by_type(meta)
    assert "Voice Tone" not in by
    assert "Quirk" not in by
    assert "Lore Faction" not in by


# ── 3. Visual subtraits filtering ─────────────────────────────────────────


def test_visual_clothing_emitted_when_real_value():
    by = _attrs_by_type(compose_metadata(_row_29572(), 29572))
    assert by["Clothing"]["value"] == "Sweater V2"
    assert by["Clothing Pattern"]["value"] == "H Stripes"
    assert by["Spots"]["value"] == "Heavy"


def test_visual_eyewear_omitted_when_value_is_none_string():
    by = _attrs_by_type(compose_metadata(_row_29572(), 29572))
    assert "Eyewear" not in by
    assert "Neckwear" not in by


def test_visual_emitted_when_python_None_or_empty():
    """Python None and "" both skip — only "real" values appear."""
    row = _row_29572(clothing=None, clothing_pattern="", spots="None")
    by = _attrs_by_type(compose_metadata(row, 29572))
    assert "Clothing" not in by
    assert "Clothing Pattern" not in by
    assert "Spots" not in by


def test_visual_bool_renders_yes_no():
    """blush / ear_detail come back as Python bool from the join;
    they render as 'Yes' / 'No' (mirroring the bundle)."""
    by = _attrs_by_type(compose_metadata(_row_29572(blush=True), 29572))
    assert by["Blush"]["value"] == "Yes"
    by = _attrs_by_type(compose_metadata(_row_29572(ear_detail=False), 29572))
    assert by["Ear Detail"]["value"] == "No"


# ── 4. Removed fields not present ─────────────────────────────────────────


REMOVED_TRAITS = {
    "Day", "Bugs Shipped", "Hours Since Sleep",
    "Protocols Created", "Protocols Failed",
    "Biggest Win", "Total Earned",
    "Skill Module",
    # Legacy null fields the pre-Phase-3 endpoint emitted
    "Skin", "Vibe", "Screen Glow", "Hair Style", "Hair Color",
    "Facial Hair", "Headgear", "Extra",
}


def test_volatile_noise_traits_not_present():
    meta = compose_metadata(_row_29572(), 29572)
    present = set(_attrs_by_type(meta).keys())
    leaked = REMOVED_TRAITS & present
    assert not leaked, f"Removed traits leaked into output: {leaked}"


# ── 5. Display types ──────────────────────────────────────────────────────


STAT_TRAITS_WITH_DISPLAY_TYPE = {
    "Coding", "Hacking", "Trading", "Social", "Endurance", "Luck",
    "Energy", "Reputation", "Balance ($NXT)",
    "Coffee Count", "Lines of Code",
}
IDENTITY_TRAITS_WITHOUT_DISPLAY_TYPE = {
    "Species", "Archetype", "Corporation", "Rarity", "Alignment",
    "Risk Level", "Social Style", "Coding Style", "Work Ethic",
    "Voice Tone", "Quirk", "Lore Faction",
    "Clothing", "Clothing Pattern", "Spots",
    "Status", "Mood", "Location",
}


def test_stat_traits_have_number_display_type():
    by = _attrs_by_type(compose_metadata(_row_29572(), 29572))
    for t in STAT_TRAITS_WITH_DISPLAY_TYPE:
        assert by[t].get("display_type") == "number", (
            f"{t} missing display_type=number, got: {by[t]}"
        )


def test_identity_traits_have_no_display_type():
    by = _attrs_by_type(compose_metadata(_row_29572(), 29572))
    for t in IDENTITY_TRAITS_WITHOUT_DISPLAY_TYPE:
        if t in by:  # some are conditional (visual subtraits)
            assert "display_type" not in by[t], (
                f"{t} should not have display_type, got: {by[t]}"
            )


def test_core_stats_carry_max_value_100():
    by = _attrs_by_type(compose_metadata(_row_29572(), 29572))
    for t in ("Coding", "Hacking", "Trading", "Social", "Endurance", "Luck", "Energy"):
        assert by[t].get("max_value") == 100


def test_uncapped_numerics_have_no_max_value():
    by = _attrs_by_type(compose_metadata(_row_29572(), 29572))
    for t in ("Reputation", "Balance ($NXT)", "Coffee Count", "Lines of Code"):
        assert "max_value" not in by[t], (
            f"{t} should be uncapped, got: {by[t]}"
        )


# ── 6. Description format ─────────────────────────────────────────────────


def test_description_uses_title_case_translations():
    meta = compose_metadata(_row_29572(), 29572)
    desc = meta["description"]
    # Title Case identity
    assert "Common" in desc
    assert "Influencer" in desc
    assert "Zuck Labs" in desc
    # Internal-format never appears
    assert "INFLUENCER" not in desc
    assert "ZUCK_LABS" not in desc
    assert "common Influencer" not in desc  # rarity isn't lowercase
    # Mood is lower-cased (matches old style)
    assert "Currently excited in DARK_WEB" in desc


def test_description_a_an_article():
    """Vowel-initial rarity uses 'an'."""
    by = compose_metadata(_row_29572(rarity_tier="uncommon"), 29572)
    assert "— an Uncommon " in by["description"]
    by = compose_metadata(_row_29572(rarity_tier="common"), 29572)
    assert "— a Common " in by["description"]


# ── 7. Defensive species fallback ─────────────────────────────────────────


def test_null_species_falls_back_to_bunny():
    meta = compose_metadata(_row_29572(species=None), 29572)
    assert _attrs_by_type(meta)["Species"]["value"] == "Bunny"


def test_empty_species_falls_back_to_bunny():
    meta = compose_metadata(_row_29572(species=""), 29572)
    assert _attrs_by_type(meta)["Species"]["value"] == "Bunny"


# ── 8. Quirk translation ──────────────────────────────────────────────────


def test_quirk_snake_case_translated_to_title_case():
    meta = compose_metadata(_row_29572(quirk="speaks_lowercase"), 29572)
    assert _attrs_by_type(meta)["Quirk"]["value"] == "Speaks Lowercase"


def test_quirk_long_phrase_translated():
    meta = compose_metadata(_row_29572(quirk="always_says_one_more_thing"), 29572)
    assert _attrs_by_type(meta)["Quirk"]["value"] == "Always Says One More Thing"


# ── 9. Pinned snapshot for token #29572 ───────────────────────────────────


def test_token_29572_full_snapshot():
    meta = compose_metadata(_row_29572(), 29572)
    assert meta["name"] == "LYNX-X0"
    assert meta["external_url"] == "https://nxterminal.xyz/dev/29572"
    assert meta["image"] == "ipfs://bafy.../29572.gif"
    assert meta["animation_url"] == "ipfs://bafy.../29572.gif"
    assert meta["description"] == (
        "LYNX-X0 — a Common Influencer at Zuck Labs. "
        "Neutral Good. Currently excited in DARK_WEB."
    )

    by = _attrs_by_type(meta)
    # Identity (Title Case)
    assert by["Species"]["value"]      == "Bunny"
    assert by["Archetype"]["value"]    == "Influencer"
    assert by["Corporation"]["value"]  == "Zuck Labs"
    assert by["Rarity"]["value"]       == "Common"
    assert by["Alignment"]["value"]    == "Neutral Good"
    assert by["Risk Level"]["value"]   == "Conservative"
    assert by["Social Style"]["value"] == "Influencer"
    assert by["Coding Style"]["value"] == "Over-Engineer"
    assert by["Work Ethic"]["value"]   == "Lazy"
    # NX Souls (translated)
    assert by["Voice Tone"]["value"]   == "Aggressive"
    assert by["Quirk"]["value"]        == "Speaks Lowercase"
    assert by["Lore Faction"]["value"] == "Mainstream"
    # Visual (only present when ≠ "None")
    assert by["Clothing"]["value"]         == "Sweater V2"
    assert by["Clothing Pattern"]["value"] == "H Stripes"
    assert by["Spots"]["value"]            == "Heavy"
    assert by["Blush"]["value"]            == "No"   # bool False
    assert by["Ear Detail"]["value"]       == "Yes"  # bool True
    assert "Eyewear" not in by                       # was "None"
    assert "Neckwear" not in by                      # was "None"
    # Stats
    assert by["Coding"]    == {"trait_type": "Coding",    "value": 95, "display_type": "number", "max_value": 100}
    assert by["Hacking"]   == {"trait_type": "Hacking",   "value": 82, "display_type": "number", "max_value": 100}
    assert by["Trading"]   == {"trait_type": "Trading",   "value": 33, "display_type": "number", "max_value": 100}
    assert by["Social"]    == {"trait_type": "Social",    "value": 64, "display_type": "number", "max_value": 100}
    assert by["Endurance"] == {"trait_type": "Endurance", "value": 28, "display_type": "number", "max_value": 100}
    assert by["Luck"]      == {"trait_type": "Luck",      "value": 53, "display_type": "number", "max_value": 100}
    # Live state
    assert by["Status"]   == {"trait_type": "Status",   "value": "active"}
    assert by["Mood"]     == {"trait_type": "Mood",     "value": "excited"}
    assert by["Location"] == {"trait_type": "Location", "value": "DARK_WEB"}
    assert by["Energy"]   == {"trait_type": "Energy",   "value": 60, "display_type": "number", "max_value": 100}
    # Economic
    assert by["Reputation"]     == {"trait_type": "Reputation",     "value": 2256, "display_type": "number"}
    assert by["Balance ($NXT)"] == {"trait_type": "Balance ($NXT)", "value": 9,    "display_type": "number"}
    # Activity
    assert by["Coffee Count"]  == {"trait_type": "Coffee Count",  "value": 61,    "display_type": "number"}
    assert by["Lines of Code"] == {"trait_type": "Lines of Code", "value": 74155, "display_type": "number"}
    # Removed
    leaked = REMOVED_TRAITS & set(by.keys())
    assert not leaked


# ── _emit_optional_visual unit tests ──────────────────────────────────────


def test_emit_optional_visual_skips_none_string():
    assert _emit_optional_visual("Clothing", "None") is None


def test_emit_optional_visual_skips_python_none():
    assert _emit_optional_visual("Clothing", None) is None


def test_emit_optional_visual_skips_empty_string():
    assert _emit_optional_visual("Clothing", "") is None


def test_emit_optional_visual_emits_real_string():
    assert _emit_optional_visual("Clothing", "Sweater V2") == {
        "trait_type": "Clothing", "value": "Sweater V2",
    }


def test_emit_optional_visual_renders_bool_as_yes_no():
    assert _emit_optional_visual("Blush", True) == {"trait_type": "Blush", "value": "Yes"}
    assert _emit_optional_visual("Blush", False) == {"trait_type": "Blush", "value": "No"}
