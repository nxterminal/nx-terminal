"""Tests for backend.services.nx_souls.persona — pure assembly only.

These tests pin the *shape* of the system prompt produced for a known
joined Dev row. They don't exercise the DB cursor / cache layer; that's
tested at the endpoint level in test_nx_souls_chat_endpoint.

Pinning the substrings (not the entire prompt verbatim) keeps the test
robust to whitespace tweaks while catching:
  - identity values being dropped from the prompt
  - voice / corp / quirk modules failing to be inserted
  - cross-talk (e.g. inserting the wrong corp's modulator)
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest  # noqa: E402

from backend.services.nx_souls.persona import _assemble_persona, _visual_description  # noqa: E402


def _row_29572(**overrides) -> dict:
    """Sample row mirroring token #29572's known DB state — same fixture
    shape the metadata-endpoint test uses, plus the chat-only fields
    (status). Visuals chosen to exercise every branch of
    `_visual_description`."""
    base = {
        "token_id":         29572,
        "name":             "LYNX-X0",
        "species":          "Bunny",
        "archetype":        "INFLUENCER",
        "corporation":      "ZUCK_LABS",
        "rarity_tier":      "common",
        "alignment":        "Neutral Good",
        "risk_level":       "Conservative",
        "social_style":     "Influencer",
        "coding_style":     "Over-Engineer",
        "work_ethic":       "Lazy",
        "status":           "active",
        # Canonical visual subtraits
        "clothing":         "Hoodie",
        "clothing_pattern": "Plain",
        "eyewear":          "Sunglasses",
        "neckwear":         "None",
        "spots":            "None",
        "blush":            False,
        "ear_detail":       True,
        # NX Souls axes
        "voice_tone":       "Aggressive",
        "quirk":            "speaks_lowercase",
        "lore_faction":     "Mainstream",
    }
    base.update(overrides)
    return base


# ─── Identity surfaces ────────────────────────────────────────────────────


def test_identity_fields_appear_in_prompt():
    p = _assemble_persona(_row_29572())
    for needle in (
        "LYNX-X0",
        "Bunny",
        "INFLUENCER",
        "ZUCK_LABS",
        "common",
        "Neutral Good",
        "Conservative",
        "Influencer",      # social_style
        "Over-Engineer",   # coding_style
        "Lazy",            # work_ethic
        "Aggressive",      # voice_tone
        "Mainstream",      # lore_faction
    ):
        assert needle in p, f"missing identity field {needle!r}"


def test_quirk_rule_is_inserted():
    """speaks_lowercase has a hand-written rule — the rule text (not the
    snake_case key) must reach the prompt."""
    p = _assemble_persona(_row_29572())
    assert "lowercase" in p.lower()
    assert "Always type in lowercase" in p


def test_corp_modulator_is_zuck_labs_not_closed_ai():
    """Cross-talk regression — the right corp must land, not a sibling."""
    p = _assemble_persona(_row_29572())
    assert "Zuck Labs" in p
    assert "Closed AI" not in p.split("CORPORATION CULTURE")[1].split("YOUR SPECIFIC QUIRK")[0]


def test_archetype_voice_block_is_influencer_not_degen():
    p = _assemble_persona(_row_29572())
    voice_section = p.split("ARCHETYPE VOICE")[1].split("CORPORATION CULTURE")[0]
    # Distinctive INFLUENCER markers
    assert "INFLUENCER" in voice_section
    assert "we love to see it" in voice_section
    # DEGEN markers must NOT bleed in
    assert "wagmi" not in voice_section.lower()
    assert "rekt" not in voice_section.lower()


def test_lore_faction_block_appears():
    p = _assemble_persona(_row_29572())
    assert "Mainstream" in p
    assert "ride the wave" in p  # from LORE_FACTION_BLOCKS["Mainstream"]


# ─── Visual description branches ─────────────────────────────────────────


def test_visual_description_skips_none_sentinels():
    """'None' is a sentinel from the bundle; it must never reach the
    prompt as user-facing text."""
    desc = _visual_description(_row_29572(eyewear="None", clothing="None"))
    assert "None" not in desc


def test_visual_description_handles_blush_and_ear_detail_bools():
    desc_with = _visual_description(_row_29572(blush=True, ear_detail=True))
    assert "blush" in desc_with
    assert "ear detail" in desc_with

    desc_without = _visual_description(_row_29572(blush=False, ear_detail=False))
    assert "blush" not in desc_without
    assert "ear detail" not in desc_without


def test_visual_description_minimal_row_falls_back_to_species():
    """A Dev row with no canonical visuals (LEFT JOIN miss) must still
    produce a non-empty description anchored to species."""
    bare = {
        "species": "Bunny",
        "clothing": None, "clothing_pattern": None,
        "eyewear": None, "neckwear": None, "spots": None,
        "blush": None, "ear_detail": None,
    }
    assert _visual_description(bare) == "a bunny dev avatar"


# ─── Robustness to missing fields ────────────────────────────────────────


def test_assemble_persona_with_no_canonical_traits():
    """If LEFT JOIN missed dev_canonical_traits, every c.* field is None.
    Persona must still assemble (defaults applied) without crashing."""
    row = {
        "token_id": 1, "name": "GHOST", "species": "Ghost",
        "archetype": "LURKER", "corporation": "MISTRIAL_SYSTEMS",
        "rarity_tier": "rare", "alignment": "True Neutral",
        "risk_level": "Moderate", "social_style": "Quiet",
        "coding_style": "Methodical", "work_ethic": "Dedicated",
        "status": "active",
        "clothing": None, "clothing_pattern": None,
        "eyewear": None, "neckwear": None, "spots": None,
        "blush": None, "ear_detail": None,
        "voice_tone": None, "quirk": None, "lore_faction": None,
    }
    p = _assemble_persona(row)
    assert "GHOST" in p
    assert "LURKER" in p
    assert "Mistrial Systems" in p  # corp modulator landed
    # No quirk → the placeholder line, not a stray Python None
    assert "None" not in p.split("YOUR SPECIFIC QUIRK")[1].split("LORE FACTION")[0]


def test_unknown_archetype_does_not_crash():
    """A future archetype that hasn't yet been added to ARCHETYPE_VOICES
    must degrade to a generic block, not raise."""
    row = _row_29572(archetype="QUANTUM_MAGE")
    p = _assemble_persona(row)
    assert "QUANTUM_MAGE" in p
