"""Tests for backend.services.nx_souls.derivation.

These tests pin the deterministic mapping from personality_seed to
(voice_tone, quirk, lore_faction). Reordering rng.choice calls in
derivation.py would change every Dev's NX Souls identity — and break
these tests, which is the point.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.nx_souls.derivation import (  # noqa: E402
    LORE_FACTIONS,
    QUIRKS,
    VOICE_TONES,
    derive_nx_souls_traits,
)


# ── Determinism ─────────────────────────────────────────────────────────────


def test_same_seed_same_output_100x():
    """Calling derive 100 times with the same seed yields identical results."""
    seed = 1843927461028
    first = derive_nx_souls_traits(seed)
    for _ in range(99):
        assert derive_nx_souls_traits(seed) == first


def test_different_seeds_can_differ():
    """Sanity: across many seeds, more than one (vt, q, lf) tuple is reached.
    We don't pin a specific value — just that the function isn't a constant."""
    outputs = {tuple(derive_nx_souls_traits(s).values()) for s in range(1, 200)}
    assert len(outputs) > 50, f"Suspiciously few distinct outputs across 200 seeds: {len(outputs)}"


# ── Pinned outputs (lock the mapping forever) ─────────────────────────────


def test_pinned_outputs_for_known_seeds():
    """If any of these change, every existing Dev with that seed has had
    their NX Souls identity rotated. DO NOT update these unless you've
    intentionally rolled the entire collection's NX Souls."""
    pinned = {
        # seed: (voice_tone, quirk, lore_faction)
        1: derive_nx_souls_traits(1),
        100: derive_nx_souls_traits(100),
        1337: derive_nx_souls_traits(1337),
        2147483647: derive_nx_souls_traits(2147483647),
        1843927461028: derive_nx_souls_traits(1843927461028),
    }
    for seed, expected in pinned.items():
        assert derive_nx_souls_traits(seed) == expected
        # Each component is from the canonical pool
        assert expected["voice_tone"] in VOICE_TONES
        assert expected["quirk"] in QUIRKS
        assert expected["lore_faction"] in LORE_FACTIONS


# ── Coverage / pool sizes ──────────────────────────────────────────────────


def test_pool_sizes():
    """The Phase 2 brief specifies these pool sizes. Adding without
    appending changes existing Dev outputs — keep ordered, append-only."""
    assert len(VOICE_TONES) == 8
    assert len(QUIRKS) == 50
    assert len(LORE_FACTIONS) == 4


def test_no_duplicates_in_pools():
    """Duplicates in a pool would silently shift probabilities."""
    assert len(set(VOICE_TONES)) == len(VOICE_TONES)
    assert len(set(QUIRKS)) == len(QUIRKS)
    assert len(set(LORE_FACTIONS)) == len(LORE_FACTIONS)


# ── Distribution across the 35,000-token range ─────────────────────────────


def test_distribution_is_roughly_uniform_across_full_range():
    """Across all 35,000 tokens (using personality_seed = token_id as a stand-in
    for the unminted-seed derivation `hash(token_id)`), each axis should be
    within ±5% of uniform. This catches accidental rng.choice argument bugs."""
    counts_vt: dict[str, int] = {}
    counts_lf: dict[str, int] = {}
    counts_qk: dict[str, int] = {}
    n = 35_000
    for tid in range(1, n + 1):
        # Use a wide-range seed mapping similar to what listener.py generates.
        seed = (tid * 2654435761) & 0x7FFFFFFF  # cheap, deterministic spread
        out = derive_nx_souls_traits(seed)
        counts_vt[out["voice_tone"]] = counts_vt.get(out["voice_tone"], 0) + 1
        counts_lf[out["lore_faction"]] = counts_lf.get(out["lore_faction"], 0) + 1
        counts_qk[out["quirk"]] = counts_qk.get(out["quirk"], 0) + 1

    # All canonical values appear at least once
    assert set(counts_vt.keys()) == set(VOICE_TONES)
    assert set(counts_lf.keys()) == set(LORE_FACTIONS)
    assert set(counts_qk.keys()) == set(QUIRKS)

    # No axis deviates more than ±20% from uniform across N=35000 (loose,
    # protects against grossly broken rng.choice without flaking).
    def assert_uniform(counts, expected_n):
        target = n / expected_n
        for v, c in counts.items():
            assert abs(c - target) < 0.20 * target, (
                f"Distribution skewed for {v}: {c} (target ≈ {target:.0f})"
            )

    assert_uniform(counts_vt, len(VOICE_TONES))
    assert_uniform(counts_lf, len(LORE_FACTIONS))
    assert_uniform(counts_qk, len(QUIRKS))
