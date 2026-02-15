"""Routes: Dev NFTs — browse, detail, history"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.api.deps import fetch_one, fetch_all

router = APIRouter()


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

    sort_map = {
        "balance": "balance_nxt DESC",
        "reputation": "reputation DESC",
        "protocols": "protocols_created DESC",
        "recent": "minted_at DESC",
    }
    order = sort_map.get(sort, "balance_nxt DESC")

    params.extend([limit, offset])
    rows = fetch_all(
        f"""SELECT token_id, name, archetype, corporation, rarity_tier,
                   owner_address, energy, max_energy, mood, location,
                   balance_nxt, reputation, status,
                   protocols_created, ais_created,
                   last_action_type, last_action_detail, last_action_at,
                   last_message, minted_at
            FROM devs
            WHERE {where}
            ORDER BY {order}
            LIMIT %s OFFSET %s""",
        params
    )
    return rows


@router.get("/count")
async def count_devs():
    """Get total dev count."""
    row = fetch_one("SELECT COUNT(*) as total FROM devs")
    return {"total": row["total"]}


@router.get("/{token_id}")
async def get_dev(token_id: int):
    """Get full dev profile."""
    dev = fetch_one("SELECT * FROM devs WHERE token_id = %s", (token_id,))
    if not dev:
        raise HTTPException(404, "Dev not found")
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
           ORDER BY created_at DESC""",
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
           ORDER BY pi.invested_at DESC""",
        (token_id,)
    )


@router.get("/{token_id}/ais")
async def get_dev_ais(token_id: int):
    """Get absurd AIs created by a dev."""
    return fetch_all(
        """SELECT id, name, description, vote_count, weighted_votes, reward_tier, created_at
           FROM absurd_ais WHERE creator_dev_id = %s
           ORDER BY created_at DESC""",
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

@router.get("/{token_id}/metadata")
async def get_dev_metadata(token_id: int):
    """
    ERC-721 metadata endpoint — called by the smart contract's tokenURI.
    Returns dynamic metadata reflecting the dev's current state.
    """
    dev = fetch_one("SELECT * FROM devs WHERE token_id = %s", (token_id,))
    if not dev:
        raise HTTPException(404, "Token not found")

    # Build OpenSea-compatible metadata
    return {
        "name": dev["name"],
        "description": f"{dev['name']} — a {dev['rarity_tier']} {dev['archetype']} developer in NX Terminal: Protocol Wars",
        "image": f"ipfs://{dev['ipfs_hash']}" if dev.get("ipfs_hash") else f"https://nx-api.onrender.com/api/devs/{token_id}/image",
        "external_url": f"https://nxterminal.gg/dev/{token_id}",
        "attributes": [
            {"trait_type": "Archetype", "value": dev["archetype"]},
            {"trait_type": "Corporation", "value": dev["corporation"]},
            {"trait_type": "Rarity", "value": dev["rarity_tier"]},
            {"trait_type": "Species", "value": dev.get("species", "Human")},
            {"trait_type": "Background", "value": dev.get("background", "Default")},
            {"trait_type": "Accessory", "value": dev.get("accessory", "None")},
            {"trait_type": "Expression", "value": dev.get("expression", "Neutral")},
            {"trait_type": "Special Effect", "value": dev.get("special_effect", "None")},
            # Dynamic attributes (change with gameplay)
            {"display_type": "number", "trait_type": "Energy", "value": dev["energy"]},
            {"display_type": "number", "trait_type": "Balance ($NXT)", "value": int(dev["balance_nxt"])},
            {"display_type": "number", "trait_type": "Reputation", "value": dev["reputation"]},
            {"display_type": "number", "trait_type": "Protocols Created", "value": dev["protocols_created"]},
            {"display_type": "number", "trait_type": "AIs Created", "value": dev["ais_created"]},
            {"trait_type": "Mood", "value": dev["mood"]},
            {"trait_type": "Location", "value": dev["location"]},
            {"trait_type": "Status", "value": dev["status"]},
        ],
    }
