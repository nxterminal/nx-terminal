"""Routes: Dev NFTs — browse, detail, history"""

import os
import json
import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.api.deps import fetch_one, fetch_all, get_db
from backend.engine.dev_generator import generate_dev_data
from backend.services.canonical.mint import (
    build_canonical_mint_data,
    update_canonical_post_mint,
)

log = logging.getLogger("nx_api")

router = APIRouter()

# RPC for on-chain ownership check
_RPC_URL = os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc")
_NFT_CONTRACT = "0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7"


@router.get("")
async def list_devs(
    limit: int = Query(20, le=100),
    offset: int = 0,
    archetype: Optional[str] = None,
    corporation: Optional[str] = None,
    location: Optional[str] = None,
    owner: Optional[str] = None,
    sort: str = Query("balance", pattern="^(balance|reputation|protocols|recent)$"),
):
    """List devs with filtering and sorting."""
    conditions = ["1=1"]
    params = []

    if archetype:
        conditions.append("archetype = %s")
        params.append(archetype)
    if corporation:
        conditions.append("corporation = %s")
        params.append(corporation)
    if location:
        conditions.append("location = %s")
        params.append(location)
    if owner:
        conditions.append("owner_address = %s")
        params.append(owner.lower())

    where = " AND ".join(conditions)

    SORT_MAP = {
        "balance": "balance_nxt DESC",
        "reputation": "reputation DESC",
        "protocols": "protocols_created DESC",
        "recent": "minted_at DESC",
    }
    order = SORT_MAP[sort]  # safe — FastAPI regex guarantees key exists

    params.extend([limit, offset])
    rows = fetch_all(
        "SELECT token_id, name, archetype, corporation, rarity_tier,"
        "       owner_address, energy, max_energy, mood, location,"
        "       balance_nxt, reputation, status,"
        "       protocols_created, ais_created,"
        "       stat_hacking, stat_coding, stat_trading, stat_social, stat_endurance, stat_luck,"
        "       last_action_type, last_action_detail, last_action_at,"
        "       last_message, minted_at,"
        "       pc_health, training_course, training_ends_at, last_raid_at,"
        "       caffeine, social_vitality, knowledge"
        " FROM devs"
        " WHERE " + where +
        " ORDER BY " + order +
        " LIMIT %s OFFSET %s",
        params
    )
    for r in rows:
        r["is_idle"] = (r.get("energy") or 0) <= 0
    return rows


@router.get("/count")
async def count_devs():
    """Get total dev count."""
    row = fetch_one("SELECT COUNT(*) as total FROM devs")
    return {"total": row["total"]}


def _rpc_call(method, params=None):
    """Quick JSON-RPC call for on-chain checks."""
    import requests
    for attempt in range(2):
        try:
            r = requests.post(_RPC_URL, json={
                "jsonrpc": "2.0", "method": method, "params": params or [], "id": 1,
            }, timeout=10)
            data = r.json()
            if data.get("error"):
                log.warning(f"RPC error (attempt {attempt+1}): {data['error']}")
                continue
            return data.get("result")
        except Exception as e:
            log.warning(f"RPC call failed (attempt {attempt+1}): {e}")
    return None


def _check_token_owner(token_id):
    """Check on-chain owner of a token via ownerOf(uint256). Returns address or None."""
    # ownerOf(uint256) selector = 0x6352211e
    data = "0x6352211e" + hex(token_id)[2:].zfill(64)
    result = _rpc_call("eth_call", [{"to": _NFT_CONTRACT, "data": data}, "latest"])
    if result and result != "0x" and len(result) >= 66:
        return "0x" + result[-40:]
    return None


def _insert_dev_on_demand(token_id, owner):
    """Insert a Dev when the listener missed it. Identity comes from
    `nx.dev_canonical_traits` (Phase 2.2 Step 6); engine fields are
    generated deterministically from the token_id.

    Falls back to the legacy procedural generator only if no canonical
    row exists. With the bundle ingested, this fallback should never
    run in practice — but if it does, the legacy values won't pass the
    Step 5b CHECK constraints on `nx.devs`, so the INSERT will fail
    loudly rather than silently corrupting the row.
    """
    STARTING_BALANCE = {
        "common": 2000, "uncommon": 2500, "rare": 3000,
        "legendary": 5000, "mythic": 10000,
    }

    with get_db() as conn:
        with conn.cursor() as cur:
            mint = build_canonical_mint_data(cur, token_id)
            if mint is not None:
                # Canonical-aware path (Phase 2.2 Step 6).
                start_balance = STARTING_BALANCE.get(mint.rarity, 2000)
                cur.execute("""
                    INSERT INTO devs (
                        token_id, name, owner_address, archetype, corporation, rarity_tier,
                        personality_seed,
                        alignment, risk_level, social_style, coding_style, work_ethic,
                        species, ipfs_hash,
                        stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck,
                        balance_nxt, total_earned,
                        status, next_cycle_at, minted_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s,
                        %s, %s, %s, %s, %s,
                        %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s,
                        'active', NOW(), NOW()
                    )
                    ON CONFLICT (token_id) DO NOTHING
                """, (
                    token_id,
                    mint.name, owner.lower(),
                    mint.archetype, mint.corporation, mint.rarity,
                    mint.personality_seed,
                    mint.alignment, mint.risk_level, mint.social_style,
                    mint.coding_style, mint.work_ethic,
                    mint.species, mint.ipfs_hash,
                    mint.stat_coding, mint.stat_hacking, mint.stat_trading,
                    mint.stat_social, mint.stat_endurance, mint.stat_luck,
                    start_balance, start_balance,
                ))
                cur.execute("""
                    INSERT INTO players (wallet_address, corporation, total_devs_minted)
                    VALUES (%s, %s, 1)
                    ON CONFLICT (wallet_address) DO UPDATE SET
                        total_devs_minted = players.total_devs_minted + 1,
                        last_active_at = NOW()
                """, (owner.lower(), mint.corporation))
                # Fold real-seed NX Souls + engine baseline stats into canonical.
                update_canonical_post_mint(cur, token_id, mint)
                log.info(
                    f"On-demand generated dev #{token_id} (canonical): "
                    f"{mint.name} ({mint.archetype} @ {mint.corporation})"
                )
                return mint.name

            # Fallback: legacy procedural generator. Should not run post-ingest.
            log.error(
                f"No dev_canonical_traits row for token {token_id} on on-demand "
                f"generation. Falling back to legacy procedural generator — "
                f"INSERT may fail Step 5b CHECK constraints."
            )

            def check_name(name):
                row = fetch_one("SELECT name FROM devs WHERE name = %s", (name,))
                return row is not None
            data = generate_dev_data(token_id, check_name_exists=check_name)
            start_balance = STARTING_BALANCE.get(data["rarity"], 2000)
            cur.execute("""
                INSERT INTO devs (
                    token_id, name, owner_address, archetype, corporation, rarity_tier,
                    personality_seed,
                    alignment, risk_level, social_style, coding_style, work_ethic,
                    species, ipfs_hash,
                    stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck,
                    balance_nxt, total_earned,
                    status, next_cycle_at, minted_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s,
                    %s, %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s,
                    'active', NOW(), NOW()
                )
                ON CONFLICT (token_id) DO NOTHING
            """, (
                token_id,
                data["name"], owner.lower(),
                data["archetype"], data["corporation"], data["rarity"],
                data["personality_seed"],
                data["alignment"], data["risk_level"], data["social_style"],
                data["coding_style"], data["work_ethic"],
                data["species"], data["ipfs_hash"],
                data["stat_coding"], data["stat_hacking"], data["stat_trading"],
                data["stat_social"], data["stat_endurance"], data["stat_luck"],
                start_balance, start_balance,
            ))
            cur.execute("""
                INSERT INTO players (wallet_address, corporation, total_devs_minted)
                VALUES (%s, %s, 1)
                ON CONFLICT (wallet_address) DO UPDATE SET
                    total_devs_minted = players.total_devs_minted + 1,
                    last_active_at = NOW()
            """, (owner.lower(), data["corporation"]))
            log.info(
                f"On-demand generated dev #{token_id} (LEGACY FALLBACK): "
                f"{data['name']} ({data['archetype']})"
            )
            return data["name"]


@router.get("/{token_id}")
async def get_dev(token_id: int, owner: Optional[str] = None):
    """Get full dev profile. Auto-generates if minted on-chain but not yet in DB.
    Pass ?owner=0x... to skip the on-chain ownerOf check (frontend already verified)."""
    dev = fetch_one("SELECT * FROM devs WHERE token_id = %s", (token_id,))
    if dev:
        dev["is_idle"] = (dev.get("energy") or 0) <= 0
        return dev

    # Not in DB — check if it exists on-chain
    # If frontend passed owner address, trust it (frontend already called tokensOfOwner)
    verified_owner = owner if (owner and owner.startswith("0x") and len(owner) == 42) else None
    if not verified_owner:
        verified_owner = _check_token_owner(token_id)
    if not verified_owner:
        raise HTTPException(404, "Dev not found")

    # Token exists on-chain but listener missed it — generate on-demand
    try:
        _insert_dev_on_demand(token_id, verified_owner)
    except Exception as e:
        log.error(f"On-demand dev generation failed for #{token_id}: {e}")
        raise HTTPException(503, "Dev generation in progress, try again shortly")

    # Fetch the newly created dev
    dev = fetch_one("SELECT * FROM devs WHERE token_id = %s", (token_id,))
    if not dev:
        raise HTTPException(503, "Dev generation in progress, try again shortly")
    dev["is_idle"] = (dev.get("energy") or 0) <= 0
    return dev


@router.get("/{token_id}/history")
async def get_dev_history(token_id: int, limit: int = Query(30, le=100)):
    """Get action history for a specific dev."""
    dev = fetch_one("SELECT token_id FROM devs WHERE token_id = %s", (token_id,))
    if not dev:
        raise HTTPException(404, "Dev not found")

    actions = fetch_all(
        """SELECT id, action_type, details, energy_cost, nxt_cost, created_at
           FROM actions WHERE dev_id = %s
           ORDER BY created_at DESC LIMIT %s""",
        (token_id, limit)
    )
    return actions


@router.get("/{token_id}/protocols")
async def get_dev_protocols(token_id: int):
    """Get protocols created by a dev."""
    return fetch_all(
        """SELECT id, name, description, code_quality, value,
                  investor_count, total_invested, status, created_at
           FROM protocols WHERE creator_dev_id = %s
           ORDER BY created_at DESC LIMIT 100""",
        (token_id,)
    )


@router.get("/{token_id}/investments")
async def get_dev_investments(token_id: int):
    """Get a dev's protocol investments."""
    return fetch_all(
        """SELECT pi.id, pi.shares, pi.nxt_invested, pi.invested_at,
                  p.name as protocol_name, p.value, p.status
           FROM protocol_investments pi
           JOIN protocols p ON p.id = pi.protocol_id
           WHERE pi.dev_id = %s
           ORDER BY pi.invested_at DESC LIMIT 100""",
        (token_id,)
    )


@router.get("/{token_id}/ais")
async def get_dev_ais(token_id: int):
    """Get absurd AIs created by a dev."""
    return fetch_all(
        """SELECT id, name, description, vote_count, weighted_votes, reward_tier, created_at
           FROM absurd_ais WHERE creator_dev_id = %s
           ORDER BY created_at DESC LIMIT 100""",
        (token_id,)
    )


@router.get("/{token_id}/messages")
async def get_dev_messages(token_id: int, limit: int = Query(20, le=50)):
    """Get recent chat messages from a dev."""
    return fetch_all(
        """SELECT id, channel, location, message, created_at
           FROM chat_messages WHERE dev_id = %s
           ORDER BY created_at DESC LIMIT %s""",
        (token_id, limit)
    )


# ============================================================
# METADATA — For NFT tokenURI (called by contract)
# ============================================================
#
# NX-PHASE-3: composes from BOTH nx.devs (live state + identity in DB
# internal format) AND nx.dev_canonical_traits (visual subtraits +
# NX Souls). The pure composer lives in
# backend/services/canonical/metadata.py so it can be unit-tested
# without psycopg2 / fastapi in the import chain.

@router.get("/{token_id}/metadata")
async def get_dev_metadata(token_id: int):
    """ERC-721 metadata endpoint — called by the smart contract's tokenURI.

    Thin wrapper around `compose_metadata`: fetch the joined row, 404
    if missing, otherwise compose. NX-PHASE-3.
    """
    from backend.services.canonical.metadata import compose_metadata

    dev = fetch_one(
        "SELECT d.*, "
        "       c.clothing, c.clothing_pattern, c.eyewear, c.neckwear, "
        "       c.spots, c.blush, c.ear_detail, "
        "       c.voice_tone, c.quirk, c.lore_faction "
        "  FROM devs d "
        "  LEFT JOIN dev_canonical_traits c ON c.token_id = d.token_id "
        " WHERE d.token_id = %s",
        (token_id,),
    )
    if not dev:
        raise HTTPException(404, "Token not found")
    return compose_metadata(dev, token_id)
