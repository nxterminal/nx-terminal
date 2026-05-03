"""Tests for backend.services.canonical.translation.

Pins the bidirectional mapping between DB-internal trait values
(UPPER_SNAKE / lowercase) and bundle-format values (Title Case / proper).
Roundtrip tests guarantee the dictionaries stay aligned. Coverage tests
guarantee every value the production DB actually contains has a public
mapping (and vice versa for the bundle).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.canonical.translation import (  # noqa: E402
    ARCHETYPE_FROM_BUNDLE,
    ARCHETYPE_TO_PUBLIC,
    CANONICAL_ALIGNMENT,
    CANONICAL_CODING_STYLE,
    CANONICAL_RISK_LEVEL,
    CANONICAL_SOCIAL_STYLE,
    CANONICAL_SPECIES,
    CANONICAL_WORK_ETHIC,
    CORPORATION_FROM_BUNDLE,
    CORPORATION_TO_PUBLIC,
    RARITY_FROM_BUNDLE,
    RARITY_TO_PUBLIC,
    TRANSLATED_AXES,
    from_bundle_to_db,
    to_public,
)


# ── Roundtrip ──────────────────────────────────────────────────────────────


def test_archetype_roundtrip_db_to_public_to_db():
    for db_value in ARCHETYPE_TO_PUBLIC:
        assert from_bundle_to_db(to_public(db_value, "archetype"), "archetype") == db_value


def test_archetype_roundtrip_public_to_db_to_public():
    for public_value in ARCHETYPE_FROM_BUNDLE:
        assert to_public(from_bundle_to_db(public_value, "archetype"), "archetype") == public_value


def test_corporation_roundtrip_db_to_public_to_db():
    for db_value in CORPORATION_TO_PUBLIC:
        assert from_bundle_to_db(to_public(db_value, "corporation"), "corporation") == db_value


def test_corporation_roundtrip_public_to_db_to_public():
    for public_value in CORPORATION_FROM_BUNDLE:
        assert to_public(from_bundle_to_db(public_value, "corporation"), "corporation") == public_value


def test_rarity_roundtrip_db_to_public_to_db():
    for db_value in RARITY_TO_PUBLIC:
        assert from_bundle_to_db(to_public(db_value, "rarity"), "rarity") == db_value


def test_rarity_roundtrip_public_to_db_to_public():
    for public_value in RARITY_FROM_BUNDLE:
        assert to_public(from_bundle_to_db(public_value, "rarity"), "rarity") == public_value


# ── Coverage / cardinality ─────────────────────────────────────────────────


def test_archetype_dict_sizes_match_brief():
    assert len(ARCHETYPE_TO_PUBLIC) == 8
    assert len(ARCHETYPE_FROM_BUNDLE) == 8


def test_corporation_dict_sizes_match_brief():
    assert len(CORPORATION_TO_PUBLIC) == 6
    assert len(CORPORATION_FROM_BUNDLE) == 6


def test_rarity_dict_sizes_match_brief():
    assert len(RARITY_TO_PUBLIC) == 5
    assert len(RARITY_FROM_BUNDLE) == 5


def test_y_ai_corporation_uses_dot_in_public():
    """Y_AI is a peculiarity — internal underscore, public dot. Pin it
    explicitly so a future refactor can't silently drop the dot."""
    assert CORPORATION_TO_PUBLIC["Y_AI"] == "Y.AI"
    assert CORPORATION_FROM_BUNDLE["Y.AI"] == "Y_AI"


def test_translated_axes_set_is_canonical():
    assert TRANSLATED_AXES == {"archetype", "corporation", "rarity"}


# ── Coverage against the live bundle ──────────────────────────────────────


def test_translation_covers_every_bundle_value_per_axis():
    """phase2-bundle-value-sets.json is the machine-readable output of the
    Phase 2.1 scan. It contains every distinct value seen across the
    35,000-token bundle. Every translated-axis value in there must have a
    DB internal mapping, or the alignment script will KeyError at runtime."""
    value_sets_path = REPO_ROOT / "phase2-bundle-value-sets.json"
    if not value_sets_path.exists():
        # The scan hasn't been run from this checkout. Skip — CI runs the
        # scan in a separate job and the file is committed in the metadata
        # refactor branch.
        import pytest
        pytest.skip(f"{value_sets_path.name} not present in this checkout")

    sets = json.loads(value_sets_path.read_text())["string_value_sets"]

    bundle_archetypes = set(sets.get("Archetype", []))
    assert bundle_archetypes <= set(ARCHETYPE_FROM_BUNDLE.keys()), (
        f"Bundle has archetype values not in translation map: "
        f"{bundle_archetypes - set(ARCHETYPE_FROM_BUNDLE.keys())}"
    )

    bundle_corps = set(sets.get("Corporation", []))
    assert bundle_corps <= set(CORPORATION_FROM_BUNDLE.keys()), (
        f"Bundle has corporation values not in translation map: "
        f"{bundle_corps - set(CORPORATION_FROM_BUNDLE.keys())}"
    )

    bundle_rarities = set(sets.get("Rarity", []))
    assert bundle_rarities <= set(RARITY_FROM_BUNDLE.keys()), (
        f"Bundle has rarity values not in translation map: "
        f"{bundle_rarities - set(RARITY_FROM_BUNDLE.keys())}"
    )

    # And conversely: every value in the translation map should appear in
    # the bundle (otherwise we have a stale internal value that nothing
    # in the canonical bundle maps to). This is informational rather than
    # strict — print a warning if violated.
    extras = set(ARCHETYPE_FROM_BUNDLE.keys()) - bundle_archetypes
    assert not extras, f"Translation map has archetypes the bundle doesn't: {extras}"
    extras = set(CORPORATION_FROM_BUNDLE.keys()) - bundle_corps
    assert not extras, f"Translation map has corporations the bundle doesn't: {extras}"
    extras = set(RARITY_FROM_BUNDLE.keys()) - bundle_rarities
    assert not extras, f"Translation map has rarities the bundle doesn't: {extras}"


def test_canonical_value_sets_match_bundle_for_passthrough_axes():
    """Species, social_style, coding_style, work_ethic, alignment, risk_level
    pass through unchanged — DB stores bundle's casing directly. The
    CANONICAL_* sets are used by Step 5b CHECK constraints; they must
    match the bundle exactly."""
    value_sets_path = REPO_ROOT / "phase2-bundle-value-sets.json"
    if not value_sets_path.exists():
        import pytest
        pytest.skip(f"{value_sets_path.name} not present in this checkout")

    sets = json.loads(value_sets_path.read_text())["string_value_sets"]

    assert set(sets.get("Species", [])) == CANONICAL_SPECIES
    assert set(sets.get("Social Style", [])) == CANONICAL_SOCIAL_STYLE
    assert set(sets.get("Coding Style", [])) == CANONICAL_CODING_STYLE
    assert set(sets.get("Work Ethic", [])) == CANONICAL_WORK_ETHIC
    assert set(sets.get("Alignment", [])) == CANONICAL_ALIGNMENT
    assert set(sets.get("Risk Level", [])) == CANONICAL_RISK_LEVEL


# ── Pass-through axes ──────────────────────────────────────────────────────


def test_passthrough_axes_are_identity():
    for axis in ("species", "alignment", "risk_level", "social_style",
                 "coding_style", "work_ethic"):
        assert from_bundle_to_db("anything", axis) == "anything"
        assert to_public("anything", axis) == "anything"


# ── Failure modes ─────────────────────────────────────────────────────────


def test_unknown_translated_value_raises_keyerror():
    """The alignment script depends on this — an unknown bundle value must
    blow up loudly rather than silently store the wrong thing."""
    import pytest
    with pytest.raises(KeyError):
        from_bundle_to_db("Not An Archetype", "archetype")
    with pytest.raises(KeyError):
        from_bundle_to_db("Not A Corp", "corporation")
    with pytest.raises(KeyError):
        from_bundle_to_db("not-a-rarity", "rarity")
    with pytest.raises(KeyError):
        to_public("NOT_AN_ARCHETYPE", "archetype")
