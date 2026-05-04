"""Tests for backend.services.nx_souls.quirks.

Pin two invariants:
  1. Every quirk in the canonical pool has a hand-written rule (no Dev
     should ever fall back to the generic line — if a quirk is added
     to the pool, this test fails until the rules table catches up).
  2. The fallback path produces a non-empty, public-format string for
     unknown future quirks, so already-minted Devs don't crash chat.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest  # noqa: E402

from backend.services.nx_souls.derivation import QUIRKS  # noqa: E402
from backend.services.nx_souls.quirks import QUIRK_RULES, get_quirk_rule  # noqa: E402


def test_every_canonical_quirk_has_a_rule():
    missing = [q for q in QUIRKS if q not in QUIRK_RULES]
    assert not missing, f"missing rules for: {missing}"


def test_no_orphan_rules():
    """A rule keyed on a quirk that isn't in the canonical pool is dead
    code and a sign of a typo."""
    orphans = [q for q in QUIRK_RULES if q not in QUIRKS]
    assert not orphans, f"orphan rules (not in canonical pool): {orphans}"


def test_rules_are_non_empty_strings():
    for quirk, rule in QUIRK_RULES.items():
        assert isinstance(rule, str) and rule.strip(), f"empty rule for {quirk}"


def test_falsy_quirk_returns_empty_string():
    """Devs minted before NX Souls have no quirk; the persona generator
    expects an empty string so it can substitute its own placeholder."""
    assert get_quirk_rule(None) == ""
    assert get_quirk_rule("") == ""


def test_unknown_quirk_falls_back_to_public_format():
    rule = get_quirk_rule("performs_arcane_rituals")
    assert "Performs Arcane Rituals" in rule
    assert "Your quirk is" in rule


def test_known_quirk_returns_handwritten_rule():
    rule = get_quirk_rule("speaks_lowercase")
    assert "lowercase" in rule.lower()
    assert "Always type in lowercase" in rule
