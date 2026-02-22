"""
NX TERMINAL — Blockchain Listener
Watches DevMinted events on MegaETH, fetches metadata from IPFS,
and inserts new devs into the database automatically.

Runs alongside the engine in the nx-engine service.
"""
import os
import sys
import time
import json
import logging
import requests
import psycopg2
import psycopg2.extras
from urllib.parse import urlparse

# ═══════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════

RPC_URL = os.getenv("MEGAETH_RPC_URL", "https://carrot.megaeth.com")
NFT_CONTRACT = "0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7"
IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs"
METADATA_CID = "bafybeifmjiqyzhg5hrebzvz5cg5krz7hkbq4iog3u2rrbxhofp6qcej7bu"
IMAGE_CID = "bafybeidqzkcpcannjtvnasq6ll7nskm2tf5xjb23xhr4wjb3iodxsm6eym"

# DevMinted(address indexed owner, uint256 indexed tokenId)
DEV_MINTED_TOPIC = "0x" + "0" * 24  # Will compute below
# Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
# For mints, from = 0x0
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
ZERO_ADDRESS = "0x" + "0" * 64

POLL_INTERVAL = int(os.getenv("LISTENER_POLL_INTERVAL", "5"))  # seconds
DB_SCHEMA = "nx"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [LISTENER] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("listener")

# ═══════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════

DATABASE_URL = os.getenv("DATABASE_URL", "")


def get_db():
    parsed = urlparse(DATABASE_URL)
    sslmode = "require" if "render.com" in (parsed.hostname or "") else "prefer"
    conn = psycopg2.connect(DATABASE_URL, sslmode=sslmode)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f"SET search_path TO {DB_SCHEMA}")
    return conn, cur


def dev_exists(cur, token_id):
    cur.execute("SELECT token_id FROM devs WHERE token_id = %s", (token_id,))
    return cur.fetchone() is not None


def ensure_player(cur, owner, corporation):
    """Create player record if it doesn't exist (upsert)."""
    cur.execute("""
        INSERT INTO players (wallet_address, corporation, total_devs_minted)
        VALUES (%s, %s, 1)
        ON CONFLICT (wallet_address) DO UPDATE SET
            total_devs_minted = players.total_devs_minted + 1,
            last_active_at = NOW()
    """, (owner.lower(), corporation))


def insert_action_mint(cur, token_id, dev_name, archetype):
    """Insert a RECEIVE_SALARY action to record the mint in the feed."""
    cur.execute("""
        INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost, cycle_number)
        VALUES (%s, %s, %s, 'RECEIVE_SALARY', %s, 0, 0, 0)
    """, (
        token_id,
        dev_name,
        archetype,
        json.dumps({"event": "mint", "message": f"{dev_name} has been hired and deployed to the simulation."}),
    ))


def insert_dev(cur, token_id, owner, metadata):
    """Insert a dev into the DB from IPFS metadata."""
    attrs = {}
    for a in metadata.get("attributes", []):
        attrs[a["trait_type"]] = a["value"]

    # Map corporation display name to DB ID
    corp_map = {
        "Closed AI": "CLOSED_AI",
        "Misanthropic": "MISANTHROPIC",
        "Shallow Mind": "SHALLOW_MIND",
        "Zuck Labs": "ZUCK_LABS",
        "Y.AI": "Y_AI",
        "Mistrial Systems": "MISTRIAL_SYSTEMS",
    }

    # Map archetype display name to DB ID
    arch_map = {
        "10X Dev": "10X_DEV",
        "Lurker": "LURKER",
        "Degen": "DEGEN",
        "Grinder": "GRINDER",
        "Influencer": "INFLUENCER",
        "Hacktivist": "HACKTIVIST",
        "Fed": "FED",
        "Script Kiddie": "SCRIPT_KIDDIE",
    }

    # Map rarity display name to DB ID
    rarity_map = {
        "Common": "COMMON",
        "Uncommon": "UNCOMMON",
        "Rare": "RARE",
        "Epic": "EPIC",
        "Legendary": "LEGENDARY",
    }

    corp = corp_map.get(attrs.get("Corporation", ""), attrs.get("Corporation", ""))
    arch = arch_map.get(attrs.get("Archetype", ""), attrs.get("Archetype", ""))
    rarity = rarity_map.get(attrs.get("Rarity", ""), attrs.get("Rarity", ""))

    # Extract image hash from ipfs:// URL
    image_url = metadata.get("image", "")
    ipfs_hash = image_url.replace("ipfs://", "") if image_url.startswith("ipfs://") else ""

    cur.execute("""
        INSERT INTO devs (
            token_id, name, owner_address, archetype, corporation, rarity_tier,
            alignment, risk_level, social_style, coding_style, work_ethic,
            species, skin, clothing, glow, vibe,
            hair_style, hair_color, facial, headgear, extra,
            ipfs_hash,
            stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck,
            status, mood, location, energy,
            coffee_count, lines_of_code, bugs_shipped, hours_since_sleep,
            minted_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            NOW()
        )
    """, (
        token_id,
        metadata.get("name", f"Dev #{token_id}"),
        owner.lower(),
        arch,
        corp,
        rarity,
        attrs.get("Alignment", "True Neutral"),
        attrs.get("Risk Level", "Moderate"),
        attrs.get("Social Style", "Quiet"),
        attrs.get("Coding Style", "Methodical"),
        attrs.get("Work Ethic", "Steady"),
        attrs.get("Species", "Human"),
        attrs.get("Skin", ""),
        attrs.get("Clothing", ""),
        attrs.get("Screen Glow", ""),
        attrs.get("Vibe", ""),
        attrs.get("Hair Style"),
        attrs.get("Hair Color"),
        attrs.get("Facial Hair"),
        attrs.get("Headgear"),
        attrs.get("Extra"),
        ipfs_hash,
        attrs.get("Coding", 0),
        attrs.get("Hacking", 0),
        attrs.get("Trading", 0),
        attrs.get("Social", 0),
        attrs.get("Endurance", 0),
        attrs.get("Luck", 0),
        "active",
        attrs.get("Mood", "Focused"),
        attrs.get("Location", "GitHub HQ"),
        attrs.get("Energy", 100),
        attrs.get("Coffee Count", 0),
        attrs.get("Lines of Code", 0),
        attrs.get("Bugs Shipped", 0),
        attrs.get("Hours Since Sleep", 0),
    ))

    log.info(f"Inserted dev #{token_id}: {metadata.get('name', '?')} ({arch} @ {corp})")


# ═══════════════════════════════════════════════════════════
# BLOCKCHAIN
# ═══════════════════════════════════════════════════════════

def rpc_call(method, params=None):
    """Make a JSON-RPC call to MegaETH."""
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params or [],
        "id": 1,
    }
    try:
        r = requests.post(RPC_URL, json=payload, timeout=10)
        data = r.json()
        if "error" in data:
            log.error(f"RPC error: {data['error']}")
            return None
        return data.get("result")
    except Exception as e:
        log.error(f"RPC request failed: {e}")
        return None


def get_latest_block():
    result = rpc_call("eth_blockNumber")
    if result:
        return int(result, 16)
    return None


def get_mint_events(from_block, to_block):
    """Get Transfer events where from=0x0 (mints) from the NFT contract."""
    result = rpc_call("eth_getLogs", [{
        "address": NFT_CONTRACT,
        "topics": [TRANSFER_TOPIC, ZERO_ADDRESS],
        "fromBlock": hex(from_block),
        "toBlock": hex(to_block),
    }])
    return result or []


def parse_mint_event(event):
    """Parse a Transfer mint event to get owner and tokenId."""
    topics = event.get("topics", [])
    if len(topics) < 4:
        return None, None

    # topics[2] = to address (padded to 32 bytes)
    owner = "0x" + topics[2][-40:]

    # topics[3] = tokenId (uint256)
    token_id = int(topics[3], 16)

    return owner, token_id


# ═══════════════════════════════════════════════════════════
# IPFS
# ═══════════════════════════════════════════════════════════

def fetch_metadata(token_id):
    """Fetch metadata JSON from IPFS for a given token ID."""
    url = f"{IPFS_GATEWAY}/{METADATA_CID}/{token_id}.json"
    try:
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            return r.json()
        log.error(f"IPFS fetch failed for #{token_id}: HTTP {r.status_code}")
    except Exception as e:
        log.error(f"IPFS fetch error for #{token_id}: {e}")
    return None


# ═══════════════════════════════════════════════════════════
# SIMULATION STATE
# ═══════════════════════════════════════════════════════════

def update_simulation_state(cur, total_minted):
    """Update the simulation state with the new mint count."""
    cur.execute(
        "UPDATE simulation_state SET value = %s WHERE key = 'total_devs_minted'",
        (json.dumps(total_minted),)
    )


# ═══════════════════════════════════════════════════════════
# MAIN LOOP
# ═══════════════════════════════════════════════════════════

def run_listener():
    log.info("=" * 50)
    log.info("NX Terminal — Blockchain Listener starting")
    log.info(f"RPC: {RPC_URL}")
    log.info(f"Contract: {NFT_CONTRACT}")
    log.info(f"IPFS Gateway: {IPFS_GATEWAY}")
    log.info(f"Metadata CID: {METADATA_CID}")
    log.info(f"Poll interval: {POLL_INTERVAL}s")
    log.info("=" * 50)

    # Get starting block
    conn, cur = get_db()

    # Check if we have a saved last_block
    cur.execute("SELECT value FROM simulation_state WHERE key = 'listener_last_block'")
    row = cur.fetchone()
    if row and row["value"]:
        try:
            last_block = json.loads(row["value"])
        except (json.JSONDecodeError, TypeError):
            last_block = None
    else:
        last_block = None

    if last_block is None:
        # Start from current block (won't catch past mints)
        last_block = get_latest_block()
        if last_block is None:
            log.error("Cannot get latest block from RPC. Retrying in 10s...")
            conn.close()
            time.sleep(10)
            return run_listener()

        # Save initial block
        cur.execute(
            "INSERT INTO simulation_state (key, value) VALUES ('listener_last_block', %s) "
            "ON CONFLICT (key) DO UPDATE SET value = %s",
            (json.dumps(last_block), json.dumps(last_block))
        )
        log.info(f"Starting from block {last_block}")

    conn.close()

    log.info(f"Listening from block {last_block}")

    while True:
        try:
            current_block = get_latest_block()
            if current_block is None:
                time.sleep(POLL_INTERVAL)
                continue

            if current_block <= last_block:
                time.sleep(POLL_INTERVAL)
                continue

            # Process in chunks of 1000 blocks max
            from_block = last_block + 1
            to_block = min(current_block, from_block + 999)

            events = get_mint_events(from_block, to_block)

            if events:
                conn, cur = get_db()
                minted_count = 0

                for event in events:
                    owner, token_id = parse_mint_event(event)
                    if owner is None or token_id is None:
                        continue

                    if dev_exists(cur, token_id):
                        log.info(f"Dev #{token_id} already exists, skipping")
                        continue

                    # Fetch metadata from IPFS
                    metadata = fetch_metadata(token_id)
                    if metadata is None:
                        log.error(f"Could not fetch metadata for #{token_id}, will retry next cycle")
                        continue

                    # Insert into DB
                    try:
                        # Parse metadata for corp/archetype needed by ensure_player and action
                        mint_attrs = {}
                        for a in metadata.get("attributes", []):
                            mint_attrs[a["trait_type"]] = a["value"]

                        corp_map_local = {
                            "Closed AI": "CLOSED_AI", "Misanthropic": "MISANTHROPIC",
                            "Shallow Mind": "SHALLOW_MIND", "Zuck Labs": "ZUCK_LABS",
                            "Y.AI": "Y_AI", "Mistrial Systems": "MISTRIAL_SYSTEMS",
                        }
                        arch_map_local = {
                            "10X Dev": "10X_DEV", "Lurker": "LURKER", "Degen": "DEGEN",
                            "Grinder": "GRINDER", "Influencer": "INFLUENCER",
                            "Hacktivist": "HACKTIVIST", "Fed": "FED", "Script Kiddie": "SCRIPT_KIDDIE",
                        }
                        mint_corp = corp_map_local.get(mint_attrs.get("Corporation", ""), "CLOSED_AI")
                        mint_arch = arch_map_local.get(mint_attrs.get("Archetype", ""), "LURKER")
                        mint_name = metadata.get("name", f"Dev #{token_id}")

                        ensure_player(cur, owner, mint_corp)
                        insert_dev(cur, token_id, owner, metadata)
                        insert_action_mint(cur, token_id, mint_name, mint_arch)
                        minted_count += 1
                    except Exception as e:
                        log.error(f"Failed to insert dev #{token_id}: {e}")
                        continue

                if minted_count > 0:
                    # Update simulation state
                    cur.execute("SELECT COUNT(*) as total FROM devs")
                    total = cur.fetchone()["total"]
                    update_simulation_state(cur, total)
                    log.info(f"Processed {minted_count} new mints. Total devs: {total}")

                conn.close()

            # Update last processed block
            last_block = to_block
            conn2, cur2 = get_db()
            cur2.execute(
                "UPDATE simulation_state SET value = %s WHERE key = 'listener_last_block'",
                (json.dumps(last_block),)
            )
            conn2.close()

        except Exception as e:
            log.error(f"Listener error: {e}")
            time.sleep(5)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run_listener()
