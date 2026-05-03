"""Tests for backend.services.canonical.mint.

These tests use a stub cursor (no real DB) to validate the structural
contract of `build_canonical_mint_data` and `update_canonical_post_mint`:

  - identity is translated bundle-format → DB internal format,
  - engine-side fields (name, stats, personality_seed) are deterministic
    from token_id,
  - NX Souls are derived from the *real* personality_seed (not from
    token_id directly), so re-running ingest with the synthetic seed
    won't match what a real mint produces,
  - update_canonical_post_mint emits exactly the expected SQL columns.

The actual end-to-end mint loop is exercised in the listener; these
tests guard the helper's invariants.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest  # noqa: E402

from backend.services.canonical.mint import (  # noqa: E402
    CanonicalMintData,
    build_canonical_mint_data,
    update_canonical_post_mint,
)
from backend.services.canonical.translation import (  # noqa: E402
    ARCHETYPE_FROM_BUNDLE,
    CORPORATION_FROM_BUNDLE,
    RARITY_FROM_BUNDLE,
)
from backend.services.nx_souls.derivation import (  # noqa: E402
    LORE_FACTIONS,
    QUIRKS,
    VOICE_TONES,
    derive_nx_souls_traits,
)


# ── Stub cursor ────────────────────────────────────────────────────────────


class StubCursor:
    """Minimal cursor that returns canned rows for the two queries
    `build_canonical_mint_data` issues:

      1. SELECT … FROM dev_canonical_traits WHERE token_id = %s
      2. SELECT 1 FROM devs WHERE name = %s   (name uniqueness check)

    Anything else hits `executed` for inspection."""

    def __init__(self, canonical_row: dict | None, taken_names: set[str] | None = None):
        self._canonical_row = canonical_row
        self._taken_names = set(taken_names or ())
        self._last_sql: str = ""
        self._last_params: tuple = ()
        self._next_result = None
        self.executed: list[tuple[str, tuple]] = []

    def execute(self, sql: str, params: tuple = ()):
        self._last_sql = sql
        self._last_params = params
        self.executed.append((sql, params))
        if "FROM dev_canonical_traits" in sql:
            self._next_result = self._canonical_row
        elif "FROM devs WHERE name" in sql:
            name = params[0]
            self._next_result = {"existing": 1} if name in self._taken_names else None
        else:
            self._next_result = None

    def fetchone(self):
        return self._next_result


CANONICAL_29572 = {
    "species":      "Bunny",
    "archetype":    "Influencer",
    "corporation":  "Zuck Labs",
    "rarity":       "Common",
    "alignment":    "Neutral Good",
    "risk_level":   "Conservative",
    "social_style": "Influencer",
    "coding_style": "Over-Engineer",
    "work_ethic":   "Lazy",
}


# ── build_canonical_mint_data: returns None when no canonical row ──────────


def test_returns_none_when_no_canonical_row():
    cur = StubCursor(canonical_row=None)
    assert build_canonical_mint_data(cur, 12345) is None


# ── Identity translation ───────────────────────────────────────────────────


def test_identity_translated_to_db_internal_format():
    cur = StubCursor(canonical_row=CANONICAL_29572)
    out = build_canonical_mint_data(cur, 29572)
    assert out is not None
    # Translated axes
    assert out.archetype == ARCHETYPE_FROM_BUNDLE["Influencer"]      # "INFLUENCER"
    assert out.corporation == CORPORATION_FROM_BUNDLE["Zuck Labs"]   # "ZUCK_LABS"
    assert out.rarity == RARITY_FROM_BUNDLE["Common"]                # "common"
    # Passthrough axes
    assert out.species == "Bunny"
    assert out.alignment == "Neutral Good"
    assert out.risk_level == "Conservative"
    assert out.social_style == "Influencer"
    assert out.coding_style == "Over-Engineer"
    assert out.work_ethic == "Lazy"


def test_unknown_translation_value_raises_keyerror():
    bad = dict(CANONICAL_29572)
    bad["archetype"] = "Not An Archetype"
    cur = StubCursor(canonical_row=bad)
    with pytest.raises(KeyError):
        build_canonical_mint_data(cur, 1)


# ── Engine-fresh fields: deterministic from token_id ──────────────────────


def test_engine_fields_deterministic_from_token_id():
    cur1 = StubCursor(canonical_row=CANONICAL_29572)
    cur2 = StubCursor(canonical_row=CANONICAL_29572)
    a = build_canonical_mint_data(cur1, 29572)
    b = build_canonical_mint_data(cur2, 29572)
    assert a.personality_seed == b.personality_seed
    assert a.stat_coding == b.stat_coding
    assert a.stat_hacking == b.stat_hacking
    assert a.stat_trading == b.stat_trading
    assert a.stat_social == b.stat_social
    assert a.stat_endurance == b.stat_endurance
    assert a.stat_luck == b.stat_luck
    assert a.name == b.name


def test_engine_stats_in_15_to_95_range():
    """Listener floor matches legacy generator (15..95). Stat values
    below 15 would be a regression bumping into the engine's lower
    bound assumptions."""
    for tid in (1, 100, 1337, 29572, 35000):
        cur = StubCursor(canonical_row=CANONICAL_29572)
        out = build_canonical_mint_data(cur, tid)
        for s in (out.stat_coding, out.stat_hacking, out.stat_trading,
                  out.stat_social, out.stat_endurance, out.stat_luck):
            assert 15 <= s <= 95


def test_personality_seed_is_postgres_int_safe():
    """personality_seed is BIGINT NOT NULL in schema but the legacy
    generator constrained it to fit in INT32 (1..2_147_483_647)."""
    cur = StubCursor(canonical_row=CANONICAL_29572)
    out = build_canonical_mint_data(cur, 29572)
    assert 1 <= out.personality_seed <= 2_147_483_647


# ── Name uniqueness ────────────────────────────────────────────────────────


def test_name_collision_falls_back_to_suffixed_name():
    """If the deterministic name is already taken, the helper appends
    `-{token_id}` rather than failing."""
    cur_first = StubCursor(canonical_row=CANONICAL_29572)
    first = build_canonical_mint_data(cur_first, 29572)
    cur_collide = StubCursor(canonical_row=CANONICAL_29572,
                             taken_names={first.name})
    second = build_canonical_mint_data(cur_collide, 29572)
    assert second.name == f"{first.name}-29572"


# ── NX Souls derived from real seed ───────────────────────────────────────


def test_nx_souls_derived_from_real_seed_not_token_id():
    """The synthetic-seed (`sha256("unminted-{N}")`) used during ingest
    yields different NX Souls than the real personality_seed produced
    here. Confirm the helper returns the real-seed values."""
    cur = StubCursor(canonical_row=CANONICAL_29572)
    out = build_canonical_mint_data(cur, 29572)
    expected = derive_nx_souls_traits(out.personality_seed)
    assert out.voice_tone == expected["voice_tone"]
    assert out.quirk == expected["quirk"]
    assert out.lore_faction == expected["lore_faction"]
    assert out.voice_tone in VOICE_TONES
    assert out.quirk in QUIRKS
    assert out.lore_faction in LORE_FACTIONS


# ── update_canonical_post_mint: emits the right SQL ───────────────────────


def test_update_canonical_post_mint_emits_expected_columns():
    cur = StubCursor(canonical_row=None)
    md = CanonicalMintData(
        name="TEST-X9",
        archetype="DEGEN",
        corporation="ZUCK_LABS",
        rarity="common",
        species="Bunny",
        alignment="Neutral Good",
        risk_level="Conservative",
        social_style="Influencer",
        coding_style="Over-Engineer",
        work_ethic="Lazy",
        personality_seed=12345,
        stat_coding=50, stat_hacking=60, stat_trading=70,
        stat_social=80, stat_endurance=90, stat_luck=40,
        ipfs_hash="bafy.../99.gif",
        voice_tone="Sarcastic", quirk="speaks_lowercase",
        lore_faction="Underground",
    )
    update_canonical_post_mint(cur, 99, md)
    assert len(cur.executed) == 1
    sql, params = cur.executed[0]
    assert "UPDATE dev_canonical_traits" in sql
    for col in ("voice_tone", "quirk", "lore_faction",
                "stat_coding", "stat_hacking", "stat_trading",
                "stat_social", "stat_endurance", "stat_luck"):
        assert col in sql, f"missing {col} in UPDATE"
    # token_id is the last positional param
    assert params[-1] == 99
    # NX Souls + 6 stats = 9 values + token_id = 10 params
    assert len(params) == 10
    assert params[0] == "Sarcastic"
    assert params[1] == "speaks_lowercase"
    assert params[2] == "Underground"
    assert params[3:9] == (50, 60, 70, 80, 90, 40)


# ── Real-world #29572 expected output ─────────────────────────────────────


def test_29572_expected_after_alignment():
    """Pin the expected values for token #29572 the user used to validate
    the alignment script. archetype/corp/rarity translate to internal
    format; everything else passes through. Engine fields aren't pinned
    here — they're verified for determinism elsewhere."""
    cur = StubCursor(canonical_row=CANONICAL_29572)
    out = build_canonical_mint_data(cur, 29572)
    assert out.species == "Bunny"
    assert out.archetype == "INFLUENCER"
    assert out.corporation == "ZUCK_LABS"
    assert out.rarity == "common"
    assert out.alignment == "Neutral Good"
    assert out.risk_level == "Conservative"
    assert out.social_style == "Influencer"
    assert out.coding_style == "Over-Engineer"
    assert out.work_ethic == "Lazy"
