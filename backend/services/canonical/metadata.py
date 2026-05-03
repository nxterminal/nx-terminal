"""
NX-PHASE-3 — Pure ERC-721 metadata composer.

Lives in `backend.services.canonical` so the route handler in
`backend/api/routes/devs.py` can stay a thin DB wrapper and the
composition logic can be unit-tested without psycopg2 / fastapi /
starlette in the import chain.

`compose_metadata(dev, token_id)` takes a dict that's the result of
joining `nx.devs` with `nx.dev_canonical_traits` (the route's SELECT
already does that join) and returns the OpenSea-shaped JSON dict.

Filtering decisions (Phase 3 brief):
  - Visual subtraits with value "None" are omitted entirely.
  - Volatile noise (Day, Bugs Shipped, Hours Since Sleep,
    Protocols Created/Failed, Biggest Win, Total Earned) is excluded.
  - Skill Module stays internal (1:1 with Corporation).
  - Dead legacy columns (Skin, Vibe, Glow, Hair*, Facial, Headgear,
    Extra) are removed entirely.
  - Internal-format identity (UPPER_SNAKE archetype + corporation,
    lowercase rarity_tier) is translated to public Title Case at emit.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.services.canonical.translation import (
    ARCHETYPE_TO_PUBLIC,
    CORPORATION_TO_PUBLIC,
    RARITY_TO_PUBLIC,
    quirk_to_public,
)

log = logging.getLogger("nx_api")


def emit_optional_visual(trait_type: str, raw_value: Any) -> dict | None:
    """Return a `{trait_type, value}` dict iff `raw_value` is a real value.

    Bool columns (blush, ear_detail) render as "Yes" / "No" — including
    False, which is a real signal ("this Dev has no blush"), not absent.
    The bool branch must come before the truthiness check; otherwise
    `not raw_value` would skip False.

    Skip rules (return None):
      - Python None
      - empty string
      - the literal string "None" (the bundle's sentinel for absent visuals)
    """
    if isinstance(raw_value, bool):
        return {"trait_type": trait_type, "value": "Yes" if raw_value else "No"}
    if not raw_value:
        return None
    if isinstance(raw_value, str) and raw_value == "None":
        return None
    return {"trait_type": trait_type, "value": raw_value}


def compose_metadata(dev: dict, token_id: int) -> dict:
    """Build the ERC-721 metadata dict from a joined `dev` row."""
    # ── Translate internal-format identity to public Title Case ─────
    archetype_pub = ARCHETYPE_TO_PUBLIC.get(dev["archetype"])
    if archetype_pub is None:
        log.warning(f"unknown archetype {dev['archetype']!r} for token {token_id}")
        archetype_pub = dev["archetype"]
    corporation_pub = CORPORATION_TO_PUBLIC.get(dev["corporation"])
    if corporation_pub is None:
        log.warning(f"unknown corporation {dev['corporation']!r} for token {token_id}")
        corporation_pub = dev["corporation"]
    rarity_pub = RARITY_TO_PUBLIC.get(dev["rarity_tier"])
    if rarity_pub is None:
        log.warning(f"unknown rarity {dev['rarity_tier']!r} for token {token_id}")
        rarity_pub = dev["rarity_tier"]

    # ── Identity (Properties) ───────────────────────────────────────
    # Species fallback: Bunny is the dominant species (87% of bundle);
    # acts as a defensive guard for the impossible mid-INSERT race.
    attrs: list[dict] = [
        {"trait_type": "Species",      "value": dev.get("species") or "Bunny"},
        {"trait_type": "Archetype",    "value": archetype_pub},
        {"trait_type": "Corporation",  "value": corporation_pub},
        {"trait_type": "Rarity",       "value": rarity_pub},
        {"trait_type": "Alignment",    "value": dev.get("alignment") or ""},
        {"trait_type": "Risk Level",   "value": dev.get("risk_level") or ""},
        {"trait_type": "Social Style", "value": dev.get("social_style") or ""},
        {"trait_type": "Coding Style", "value": dev.get("coding_style") or ""},
        {"trait_type": "Work Ethic",   "value": dev.get("work_ethic") or ""},
    ]

    # ── NX Souls (Properties) — public from day 1 ───────────────────
    if dev.get("voice_tone"):
        attrs.append({"trait_type": "Voice Tone", "value": dev["voice_tone"]})
    if dev.get("quirk"):
        attrs.append({"trait_type": "Quirk", "value": quirk_to_public(dev["quirk"])})
    if dev.get("lore_faction"):
        attrs.append({"trait_type": "Lore Faction", "value": dev["lore_faction"]})

    # ── Visual subtraits (Properties) — emit only if ≠ "None" ───────
    for trait_type, key in (
        ("Clothing",         "clothing"),
        ("Clothing Pattern", "clothing_pattern"),
        ("Eyewear",          "eyewear"),
        ("Neckwear",         "neckwear"),
        ("Spots",            "spots"),
        ("Blush",            "blush"),
        ("Ear Detail",       "ear_detail"),
    ):
        emitted = emit_optional_visual(trait_type, dev.get(key))
        if emitted is not None:
            attrs.append(emitted)

    # ── Core stats (Stats / numbered with progress bar) ─────────────
    attrs += [
        {"trait_type": "Coding",    "value": dev["stat_coding"],    "display_type": "number", "max_value": 100},
        {"trait_type": "Hacking",   "value": dev["stat_hacking"],   "display_type": "number", "max_value": 100},
        {"trait_type": "Trading",   "value": dev["stat_trading"],   "display_type": "number", "max_value": 100},
        {"trait_type": "Social",    "value": dev["stat_social"],    "display_type": "number", "max_value": 100},
        {"trait_type": "Endurance", "value": dev["stat_endurance"], "display_type": "number", "max_value": 100},
        {"trait_type": "Luck",      "value": dev["stat_luck"],      "display_type": "number", "max_value": 100},
    ]

    # ── Live state (mix) — narrative ────────────────────────────────
    attrs += [
        {"trait_type": "Status",   "value": dev["status"]},
        {"trait_type": "Mood",     "value": dev["mood"]},
        {"trait_type": "Location", "value": dev["location"]},
        {"trait_type": "Energy",   "value": dev["energy"], "display_type": "number", "max_value": 100},
    ]

    # ── Economic (numeric narrative) ────────────────────────────────
    attrs += [
        {"trait_type": "Reputation",     "value": dev["reputation"],       "display_type": "number"},
        {"trait_type": "Balance ($NXT)", "value": int(dev["balance_nxt"]), "display_type": "number"},
    ]

    # ── Activity narrative ──────────────────────────────────────────
    attrs += [
        {"trait_type": "Coffee Count",  "value": dev["coffee_count"],  "display_type": "number"},
        {"trait_type": "Lines of Code", "value": dev["lines_of_code"], "display_type": "number"},
    ]

    a_an = "an" if rarity_pub[0:1] in "AEIOUaeiou" else "a"
    description = (
        f"{dev['name']} — {a_an} {rarity_pub} {archetype_pub} at {corporation_pub}. "
        f"{dev.get('alignment') or ''}. "
        f"Currently {(dev['mood'] or '').lower()} in {dev['location']}."
    )

    return {
        "name": dev["name"],
        "description": description,
        "image": f"ipfs://{dev['ipfs_hash']}" if dev.get("ipfs_hash") else "",
        "animation_url": f"ipfs://{dev['ipfs_hash']}" if dev.get("ipfs_hash") else "",
        "external_url": f"https://nxterminal.xyz/dev/{token_id}",
        "attributes": attrs,
    }
