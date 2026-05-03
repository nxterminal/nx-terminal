"""
Canonical-aware mint helper (Phase 2.2 Step 6).

Both the on-chain listener (`backend/engine/listener.py`) and the
on-demand fallback path (`backend/api/routes/devs.py:_insert_dev_on_demand`)
need to perform the same operations when a Dev is materialised:

  1. Look up `nx.dev_canonical_traits` for the token. The bundle was
     ingested in Phase 2.2 Step 4, so this row should always exist for
     tokens 1..35000.

  2. Translate canonical (bundle-format) identity values into the DB
     internal format the `devs` table expects (UPPER_SNAKE archetype +
     corporation, lowercase rarity_tier; species and the six VARCHAR
     trait columns pass through unchanged).

  3. Generate engine-side fresh values: a per-mint `personality_seed`
     and the six baseline stats (range 15..95, deterministic from
     token_id so it's reproducible if the listener replays).

  4. Update the canonical row's `voice_tone / quirk / lore_faction`
     to the values derived from the *real* personality seed (the
     ingest used a synthetic `sha256("unminted-{N}")` seed for
     unminted Devs — once the Dev is minted, NX Souls is re-derived).
     Also snapshot the engine-baseline `stat_*` values into canonical
     for downstream consumers.

The two callers differ in their cursor / connection management style,
so this module exposes a single function that takes a cursor (already
inside an open transaction) and does the work in-place. Either caller
commits afterward.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from typing import Optional

from backend.services.canonical.translation import (
    ARCHETYPE_FROM_BUNDLE,
    CORPORATION_FROM_BUNDLE,
    RARITY_FROM_BUNDLE,
)
from backend.services.nx_souls.derivation import derive_nx_souls_traits

log = logging.getLogger("nx_engine")

# Image CID lives on the engine side today; mirror it here so the helper
# is self-contained and independent of `backend.engine.listener` imports.
IMAGE_CID = "bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema"

DEV_NAME_PREFIXES = (
    "NEX", "CIPHER", "VOID", "FLUX", "NOVA", "PULSE", "ZERO", "GHOST",
    "AXIOM", "KIRA", "DAEMON", "ECHO", "HELIX", "ONYX", "RUNE",
    "SPECTRA", "VECTOR", "WRAITH", "ZENITH", "BINARY", "CORTEX", "DELTA",
    "SIGMA", "THETA", "OMEGA", "APEX", "NANO", "QUBIT", "NEXUS", "SHADE",
    "STORM", "FROST", "BLITZ", "CRUX", "DRIFT", "EMBER", "FORGE", "GLITCH",
    "HYPER", "IONIC", "JOLT", "KARMA", "LYNX", "MORPH", "NEON", "PIXEL",
)
DEV_NAME_SUFFIXES = (
    "7X", "404", "9K", "01", "X9", "00", "13", "99", "3V", "Z1",
    "V2", "11", "0X", "FE", "A1", "42", "88", "XL", "PR", "QZ",
    "7Z", "K9", "R2", "5G", "EX", "NX", "X0", "1K", "S7", "D4",
)


@dataclass(frozen=True)
class CanonicalMintData:
    """Everything the `devs` INSERT needs, plus the engine-side values
    we feed back into `dev_canonical_traits` after insert."""
    name: str
    # Identity (DB internal format, ready for `devs` INSERT).
    archetype: str
    corporation: str
    rarity: str
    species: str
    alignment: str
    risk_level: str
    social_style: str
    coding_style: str
    work_ethic: str
    # Engine-side fresh values.
    personality_seed: int
    stat_coding: int
    stat_hacking: int
    stat_trading: int
    stat_social: int
    stat_endurance: int
    stat_luck: int
    ipfs_hash: str
    # NX Souls re-derived from the real seed (will overwrite the
    # synthetic-seed values currently in dev_canonical_traits).
    voice_tone: str
    quirk: str
    lore_faction: str


def _generate_unique_name(rng: random.Random, token_id: int, name_in_use) -> str:
    """Procedural name with collision fallback. `name_in_use(name)` is a
    callable returning True if the name already exists in `nx.devs`."""
    prefix = rng.choice(DEV_NAME_PREFIXES)
    suffix = rng.choice(DEV_NAME_SUFFIXES)
    name = f"{prefix}-{suffix}"
    if name_in_use(name):
        name = f"{prefix}-{suffix}-{token_id}"
    return name


def build_canonical_mint_data(cur, token_id: int) -> Optional[CanonicalMintData]:
    """Read canonical traits, translate identity, generate fresh
    personality_seed + baseline stats, derive NX Souls.

    Returns `None` if `dev_canonical_traits` has no row for this token.
    Callers should fall back to legacy procedural generation in that
    case (the on-demand path does this; the listener logs and falls
    back to `dev_generator.generate_dev_data`).

    The cursor must already be open inside a transaction. This function
    only reads.
    """
    cur.execute(
        "SELECT species, archetype, corporation, rarity, "
        "       alignment, risk_level, social_style, coding_style, work_ethic "
        "  FROM dev_canonical_traits WHERE token_id = %s",
        (token_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    # `cur` is RealDictCursor in the listener and a plain cursor in some
    # callers — handle both shapes.
    canonical = dict(row) if not isinstance(row, dict) else row

    # ── Engine-fresh fields, deterministic from token_id ───────────────
    rng = random.Random(token_id)

    def name_in_use(name: str) -> bool:
        cur.execute("SELECT 1 FROM devs WHERE name = %s", (name,))
        return cur.fetchone() is not None

    name = _generate_unique_name(rng, token_id, name_in_use)

    # The legacy generators advanced the rng with archetype/corp/rarity/
    # species choices BEFORE the stat rolls. We're skipping those choices
    # now (identity comes from canonical), so the rng state diverges from
    # the legacy sequence. That's intentional — a re-mint of an existing
    # token_id with the new generator will produce different stats than
    # the legacy generator did. Existing minted Devs already had their
    # stats locked at first-mint time, so this only affects new mints.
    stat_coding    = rng.randint(15, 95)
    stat_hacking   = rng.randint(15, 95)
    stat_trading   = rng.randint(15, 95)
    stat_social    = rng.randint(15, 95)
    stat_endurance = rng.randint(15, 95)
    stat_luck      = rng.randint(15, 95)
    personality_seed = rng.randint(1, 2_147_483_647)

    nx_souls = derive_nx_souls_traits(personality_seed)

    return CanonicalMintData(
        name=name,
        archetype=ARCHETYPE_FROM_BUNDLE[canonical["archetype"]],
        corporation=CORPORATION_FROM_BUNDLE[canonical["corporation"]],
        rarity=RARITY_FROM_BUNDLE[canonical["rarity"]],
        species=canonical["species"],
        alignment=canonical["alignment"],
        risk_level=canonical["risk_level"],
        social_style=canonical["social_style"],
        coding_style=canonical["coding_style"],
        work_ethic=canonical["work_ethic"],
        personality_seed=personality_seed,
        stat_coding=stat_coding,
        stat_hacking=stat_hacking,
        stat_trading=stat_trading,
        stat_social=stat_social,
        stat_endurance=stat_endurance,
        stat_luck=stat_luck,
        ipfs_hash=f"{IMAGE_CID}/{token_id}.gif",
        voice_tone=nx_souls["voice_tone"],
        quirk=nx_souls["quirk"],
        lore_faction=nx_souls["lore_faction"],
    )


def update_canonical_post_mint(cur, token_id: int, mint_data: CanonicalMintData) -> None:
    """Write the engine-side fresh values back into dev_canonical_traits.

    Replaces the synthetic-seed-derived NX Souls axes (set during the
    Phase 2.2 ingest of unminted Devs) with values derived from the
    real personality_seed, and snapshots the engine baseline stats so
    downstream consumers see the same numbers in canonical and devs.

    Caller commits."""
    cur.execute(
        """UPDATE dev_canonical_traits
              SET voice_tone     = %s,
                  quirk          = %s,
                  lore_faction   = %s,
                  stat_coding    = %s,
                  stat_hacking   = %s,
                  stat_trading   = %s,
                  stat_social    = %s,
                  stat_endurance = %s,
                  stat_luck      = %s,
                  updated_at     = NOW()
            WHERE token_id = %s""",
        (
            mint_data.voice_tone,
            mint_data.quirk,
            mint_data.lore_faction,
            mint_data.stat_coding,
            mint_data.stat_hacking,
            mint_data.stat_trading,
            mint_data.stat_social,
            mint_data.stat_endurance,
            mint_data.stat_luck,
            token_id,
        ),
    )
