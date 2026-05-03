"""
NX TERMINAL — Blockchain Listener
Watches DevMinted events on MegaETH and inserts new devs into the
database automatically.

Identity (species, archetype, corp, rarity, alignment, risk_level,
social_style, coding_style, work_ethic) comes from
`nx.dev_canonical_traits` — populated in Phase 2.2 Step 4 from the
canonical bundle on GitHub. The listener translates bundle-format
values into DB internal format and writes them to `nx.devs`. Engine-
side fresh values (personality_seed + baseline stats) are generated
deterministically from token_id and then written back into
`dev_canonical_traits` (replacing the synthetic-seed-derived NX Souls
axes that the unminted-Dev ingest produced).

Runs alongside the engine in the nx-engine service.

NX-PHASE-2.2 Step 6: see backend/services/canonical/mint.py.
"""
import os
import sys
import time
import json
import random
import logging
import requests
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone
from urllib.parse import urlparse

# Phase 2.2 Step 6 — canonical-aware mint path. Falls back to the legacy
# procedural generator below if `dev_canonical_traits` has no row for a
# given token (which should never happen post-ingest).
try:
    from backend.services.canonical.mint import (
        build_canonical_mint_data,
        update_canonical_post_mint,
    )
except Exception:  # pragma: no cover - defensive: PYTHONPATH issues
    # Re-add the project root and try once more so a relative-PYTHONPATH
    # subshell doesn't silently disable canonical mint.
    _here = os.path.dirname(os.path.abspath(__file__))
    _root = os.path.abspath(os.path.join(_here, "..", ".."))
    if _root not in sys.path:
        sys.path.insert(0, _root)
    from backend.services.canonical.mint import (  # type: ignore
        build_canonical_mint_data,
        update_canonical_post_mint,
    )

# ═══════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════

RPC_URL = os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc")
NFT_CONTRACT = "0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7"
IMAGE_CID = "bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema"

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
# PROCEDURAL GENERATION POOLS (deterministic from tokenId)
# ═══════════════════════════════════════════════════════════

DEV_NAME_PREFIXES = [
    "NEX", "CIPHER", "VOID", "FLUX", "NOVA", "PULSE", "ZERO", "GHOST",
    "AXIOM", "KIRA", "DAEMON", "ECHO", "HELIX", "ONYX", "RUNE",
    "SPECTRA", "VECTOR", "WRAITH", "ZENITH", "BINARY", "CORTEX", "DELTA",
    "SIGMA", "THETA", "OMEGA", "APEX", "NANO", "QUBIT", "NEXUS", "SHADE",
    "STORM", "FROST", "BLITZ", "CRUX", "DRIFT", "EMBER", "FORGE", "GLITCH",
    "HYPER", "IONIC", "JOLT", "KARMA", "LYNX", "MORPH", "NEON", "PIXEL",
]

DEV_NAME_SUFFIXES = [
    "7X", "404", "9K", "01", "X9", "00", "13", "99", "3V", "Z1",
    "V2", "11", "0X", "FE", "A1", "42", "88", "XL", "PR", "QZ",
    "7Z", "K9", "R2", "5G", "EX", "NX", "X0", "1K", "S7", "D4",
]

ARCHETYPE_WEIGHTS = {
    "10X_DEV": 10, "LURKER": 12, "DEGEN": 15, "GRINDER": 15,
    "INFLUENCER": 13, "HACKTIVIST": 10, "FED": 10, "SCRIPT_KIDDIE": 15,
}

RARITY_WEIGHTS = {
    "common": 60, "uncommon": 25, "rare": 10, "legendary": 4, "mythic": 1,
}

CORPORATION_POOL = [
    "CLOSED_AI", "MISANTHROPIC", "SHALLOW_MIND",
    "ZUCK_LABS", "Y_AI", "MISTRIAL_SYSTEMS",
]

SPECIES_POOL = [
    "Wolf", "Cat", "Owl", "Fox", "Bear", "Raven", "Snake", "Shark",
    "Monkey", "Robot", "Alien", "Ghost", "Dragon", "Human",
]

ALIGNMENT_POOL = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil",
]

RISK_LEVEL_POOL = ["Conservative", "Moderate", "Aggressive", "Reckless"]
SOCIAL_STYLE_POOL = ["Quiet", "Social", "Loud", "Troll", "Mentor"]
CODING_STYLE_POOL = ["Methodical", "Chaotic", "Perfectionist", "Speed Runner", "Copy Paste"]
WORK_ETHIC_POOL = ["Grinder", "Lazy", "Balanced", "Obsessed", "Steady"]


# ═══════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    _host = os.getenv("NX_DB_HOST", "localhost")
    _port = os.getenv("NX_DB_PORT", "5432")
    _name = os.getenv("NX_DB_NAME", "nxterminal")
    _user = os.getenv("NX_DB_USER", "postgres")
    _pass = os.getenv("NX_DB_PASS", "postgres")
    DATABASE_URL = f"postgresql://{_user}:{_pass}@{_host}:{_port}/{_name}"


def get_db(autocommit=False):
    parsed = urlparse(DATABASE_URL)
    sslmode = "require" if "render.com" in (parsed.hostname or "") else "prefer"
    conn = psycopg2.connect(DATABASE_URL, sslmode=sslmode)
    conn.autocommit = autocommit
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
    """Insert a DEPLOY action to record the mint in the feed."""
    cur.execute("""
        INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost, cycle_number)
        VALUES (%s, %s, %s, 'DEPLOY', %s, 0, 0, 0)
    """, (
        token_id,
        dev_name,
        archetype,
        json.dumps({"event": "mint", "message": f"{dev_name} has been hired and deployed to the simulation."}),
    ))


# ═══════════════════════════════════════════════════════════
# PROCEDURAL DEV GENERATION
# ═══════════════════════════════════════════════════════════

def _weighted_choice(rng, weights):
    """Weighted random selection using a specific RNG instance."""
    items = list(weights.keys())
    cumulative = []
    total = 0
    for w in weights.values():
        total += w
        cumulative.append(total)
    r = rng.uniform(0, total)
    for item, c in zip(items, cumulative):
        if r <= c:
            return item
    return items[-1]


def generate_dev_data(token_id, cur):
    """Build the dict the legacy `insert_dev` expects, with identity
    sourced from `nx.dev_canonical_traits` and engine-fresh fields
    (name, stats, personality_seed) generated deterministically.

    Returns None if the canonical row is missing — the caller falls
    back to `_generate_dev_data_legacy` (preserved below for safety;
    should not run in practice post-ingest).

    NX-PHASE-2.2 Step 6.
    """
    mint = build_canonical_mint_data(cur, token_id)
    if mint is None:
        log.error(
            f"No dev_canonical_traits row for token {token_id} — falling back "
            f"to legacy procedural generator. Bundle ingest may be incomplete."
        )
        return _generate_dev_data_legacy(token_id, cur)
    return {
        "name": mint.name,
        "archetype": mint.archetype,
        "corporation": mint.corporation,
        "rarity": mint.rarity,
        "species": mint.species,
        "stat_coding": mint.stat_coding,
        "stat_hacking": mint.stat_hacking,
        "stat_trading": mint.stat_trading,
        "stat_social": mint.stat_social,
        "stat_endurance": mint.stat_endurance,
        "stat_luck": mint.stat_luck,
        "alignment": mint.alignment,
        "risk_level": mint.risk_level,
        "social_style": mint.social_style,
        "coding_style": mint.coding_style,
        "work_ethic": mint.work_ethic,
        "ipfs_hash": mint.ipfs_hash,
        "personality_seed": mint.personality_seed,
        # Carried through so run_listener() can update canonical post-mint
        # without re-deriving. Not consumed by insert_dev() — it ignores
        # unknown keys (the INSERT only references the fields it names).
        "_canonical_voice_tone": mint.voice_tone,
        "_canonical_quirk": mint.quirk,
        "_canonical_lore_faction": mint.lore_faction,
    }


def _generate_dev_data_legacy(token_id, cur):
    """Legacy fully-procedural generator. Kept as a safety fallback for
    the case where `dev_canonical_traits` is empty or missing a row.
    Pre-Phase-2.2 behaviour. Should not run in production after the
    Step 4 ingest completes.

    NX-PHASE-2.2: deprecated; the canonical-aware path above is the
    primary code path. This function still uses the LEGACY pools below
    (Wolf/Cat/Owl species, Mentor/Troll social, Speed Runner coding,
    Grinder/Steady/Balanced work ethic) — those values would NOT pass
    the Step 5b CHECK constraints on `nx.devs` and the INSERT would
    fail. The fallback is therefore loud-on-failure, not silent.
    """
    rng = random.Random(token_id)

    prefix = rng.choice(DEV_NAME_PREFIXES)
    suffix = rng.choice(DEV_NAME_SUFFIXES)
    name = f"{prefix}-{suffix}"

    cur.execute("SELECT name FROM devs WHERE name = %s", (name,))
    if cur.fetchone():
        name = f"{prefix}-{suffix}-{token_id}"

    archetype = _weighted_choice(rng, ARCHETYPE_WEIGHTS)
    corporation = rng.choice(CORPORATION_POOL)
    rarity = _weighted_choice(rng, RARITY_WEIGHTS)
    species = rng.choice(SPECIES_POOL)

    stat_coding = rng.randint(15, 95)
    stat_hacking = rng.randint(15, 95)
    stat_trading = rng.randint(15, 95)
    stat_social = rng.randint(15, 95)
    stat_endurance = rng.randint(15, 95)
    stat_luck = rng.randint(15, 95)

    alignment = rng.choice(ALIGNMENT_POOL)
    risk_level = rng.choice(RISK_LEVEL_POOL)
    social_style = rng.choice(SOCIAL_STYLE_POOL)
    coding_style = rng.choice(CODING_STYLE_POOL)
    work_ethic = rng.choice(WORK_ETHIC_POOL)

    ipfs_hash = f"{IMAGE_CID}/{token_id}.gif"
    personality_seed = rng.randint(1, 2147483647)

    return {
        "name": name,
        "archetype": archetype,
        "corporation": corporation,
        "rarity": rarity,
        "species": species,
        "stat_coding": stat_coding,
        "stat_hacking": stat_hacking,
        "stat_trading": stat_trading,
        "stat_social": stat_social,
        "stat_endurance": stat_endurance,
        "stat_luck": stat_luck,
        "alignment": alignment,
        "risk_level": risk_level,
        "social_style": social_style,
        "coding_style": coding_style,
        "work_ethic": work_ethic,
        "ipfs_hash": ipfs_hash,
        "personality_seed": personality_seed,
    }


def insert_dev(cur, token_id, owner, data):
    """Insert a procedurally generated dev into the DB."""
    cur.execute("""
        INSERT INTO devs (
            token_id, name, owner_address, archetype, corporation, rarity_tier,
            personality_seed,
            alignment, risk_level, social_style, coding_style, work_ethic,
            species,
            ipfs_hash,
            stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck,
            status,
            next_cycle_at,
            minted_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s,
            %s, %s, %s, %s, %s,
            %s,
            %s,
            %s, %s, %s, %s, %s, %s,
            %s,
            NOW(),
            NOW()
        )
    """, (
        token_id,
        data["name"],
        owner.lower(),
        data["archetype"],
        data["corporation"],
        data["rarity"],
        data["personality_seed"],
        data["alignment"],
        data["risk_level"],
        data["social_style"],
        data["coding_style"],
        data["work_ethic"],
        data["species"],
        data["ipfs_hash"],
        data["stat_coding"],
        data["stat_hacking"],
        data["stat_trading"],
        data["stat_social"],
        data["stat_endurance"],
        data["stat_luck"],
        "active",
    ))

    log.info(f"Inserted dev #{token_id}: {data['name']} ({data['archetype']} @ {data['corporation']})")


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
# SIMULATION STATE
# ═══════════════════════════════════════════════════════════

def update_simulation_state(cur, total_minted):
    """Update the simulation state with the new mint count and activate if first dev."""
    cur.execute(
        "UPDATE simulation_state SET value = %s, updated_at = NOW() WHERE key = 'total_devs_minted'",
        (json.dumps(total_minted),)
    )
    # Transition from pre_launch to running on first dev
    if total_minted >= 1:
        cur.execute("""
            UPDATE simulation_state SET value = '"running"', updated_at = NOW()
            WHERE key = 'simulation_status' AND value = '"pre_launch"'
        """)
        cur.execute("""
            UPDATE simulation_state SET value = %s, updated_at = NOW()
            WHERE key = 'simulation_started_at' AND value = 'null'
        """, (json.dumps(datetime.now(timezone.utc).isoformat()),))
    # Ensure all active devs have next_cycle_at set for engine processing
    cur.execute("""
        UPDATE devs SET next_cycle_at = NOW()
        WHERE next_cycle_at IS NULL AND status = 'active'
    """)


# ═══════════════════════════════════════════════════════════
# MAIN LOOP
# ═══════════════════════════════════════════════════════════

def run_listener():
    log.info("=" * 50)
    log.info("NX Terminal — Blockchain Listener starting")
    log.info(f"RPC: {RPC_URL}")
    log.info(f"Contract: {NFT_CONTRACT}")
    log.info(f"Poll interval: {POLL_INTERVAL}s")
    log.info("=" * 50)

    # Ensure DEPLOY action exists in enum (may be missing on older DBs)
    try:
        conn, cur = get_db(autocommit=True)
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'DEPLOY'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum')
                ) THEN
                    ALTER TYPE action_enum ADD VALUE 'DEPLOY';
                END IF;
            END
            $$;
        """)
        conn.close()
        log.info("Verified DEPLOY action enum value exists")
    except Exception as e:
        log.warning(f"Could not verify DEPLOY enum: {e}")

    # Get starting block (with retry loop instead of recursion)
    last_block = None
    while last_block is None:
        conn, cur = get_db(autocommit=True)
        try:
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
                    time.sleep(10)
                    continue

                # Save initial block
                cur.execute(
                    "INSERT INTO simulation_state (key, value) VALUES ('listener_last_block', %s) "
                    "ON CONFLICT (key) DO UPDATE SET value = %s",
                    (json.dumps(last_block), json.dumps(last_block))
                )
                log.info(f"Starting from block {last_block}")
        finally:
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
                try:
                    minted_count = 0

                    for event in events:
                        owner, token_id = parse_mint_event(event)
                        if owner is None or token_id is None:
                            continue

                        if dev_exists(cur, token_id):
                            log.info(f"Dev #{token_id} already exists, skipping")
                            continue

                        # Mint flow (Phase 2.2 Step 6): identity from canonical,
                        # engine state fresh, NX Souls + baseline stats written
                        # back into canonical post-insert.
                        try:
                            dev_data = generate_dev_data(token_id, cur)
                            ensure_player(cur, owner, dev_data["corporation"])
                            insert_dev(cur, token_id, owner, dev_data)
                            insert_action_mint(cur, token_id, dev_data["name"], dev_data["archetype"])

                            # If we took the canonical path, fold the real-seed
                            # NX Souls + engine baseline stats back into
                            # dev_canonical_traits so the metadata endpoint
                            # serves consistent values across both tables.
                            if "_canonical_voice_tone" in dev_data:
                                from backend.services.canonical.mint import CanonicalMintData
                                update_canonical_post_mint(
                                    cur, token_id,
                                    CanonicalMintData(
                                        name=dev_data["name"],
                                        archetype=dev_data["archetype"],
                                        corporation=dev_data["corporation"],
                                        rarity=dev_data["rarity"],
                                        species=dev_data["species"],
                                        alignment=dev_data["alignment"],
                                        risk_level=dev_data["risk_level"],
                                        social_style=dev_data["social_style"],
                                        coding_style=dev_data["coding_style"],
                                        work_ethic=dev_data["work_ethic"],
                                        personality_seed=dev_data["personality_seed"],
                                        stat_coding=dev_data["stat_coding"],
                                        stat_hacking=dev_data["stat_hacking"],
                                        stat_trading=dev_data["stat_trading"],
                                        stat_social=dev_data["stat_social"],
                                        stat_endurance=dev_data["stat_endurance"],
                                        stat_luck=dev_data["stat_luck"],
                                        ipfs_hash=dev_data["ipfs_hash"],
                                        voice_tone=dev_data["_canonical_voice_tone"],
                                        quirk=dev_data["_canonical_quirk"],
                                        lore_faction=dev_data["_canonical_lore_faction"],
                                    ),
                                )

                            # Post-mint email to owner
                            try:
                                cur.execute("""
                                    INSERT INTO notifications (player_address, type, title, body)
                                    VALUES (%s, 'dev_deployed', %s, %s)
                                """, (owner.lower(),
                                      f"Dev Deployed: {dev_data['name']} [{dev_data['archetype']}]",
                                      f"DEPLOYMENT SUCCESSFUL\n\n"
                                      f"Name: {dev_data['name']}\n"
                                      f"Corporation: {dev_data['corporation']}\n"
                                      f"Archetype: {dev_data['archetype']}\n"
                                      f"Rarity: {dev_data['rarity']}\n"
                                      f"Token: #{token_id}\n\n"
                                      f"Your dev is now active and earning ~200 $NXT/day.\n\n"
                                      f"Open My Devs to manage stats. Feed, Coffee, Fix, Repair — "
                                      f"stats decay over time. A well-fed dev is a productive dev.\n\n"
                                      f"— NX Terminal Deployment Division"))
                            except Exception as _ne:
                                log.warning(f"Post-mint notification failed: {_ne}")

                            # Notify Ariel if VIP tester minted
                            try:
                                cur.execute("SELECT name FROM vip_testers WHERE wallet_address = %s", (owner.lower(),))
                                _vip = cur.fetchone()
                                if _vip:
                                    _vip_report = "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b"
                                    cur.execute("SELECT COUNT(*) as cnt FROM devs WHERE LOWER(owner_address) = %s", (owner.lower(),))
                                    _cnt = cur.fetchone()["cnt"]
                                    cur.execute("""
                                        INSERT INTO notifications (player_address, type, title, body)
                                        VALUES (%s, 'vip_mint', %s, %s)
                                    """, (_vip_report,
                                          f"Tester mint: {_vip['name']} minted Dev #{token_id}",
                                          f"TESTER MINT REPORT\n\n"
                                          f"Tester: {_vip['name']}\n"
                                          f"Wallet: {owner.lower()[:6]}...{owner.lower()[-4:]}\n\n"
                                          f"Dev: #{token_id} — {dev_data['name']}\n"
                                          f"Corp: {dev_data['corporation']}\n"
                                          f"Archetype: {dev_data['archetype']}\n"
                                          f"Rarity: {dev_data['rarity']}\n\n"
                                          f"Total devs now: {_cnt}"))
                            except Exception as _e:
                                log.warning(f"VIP mint notification failed: {_e}")

                            conn.commit()
                            minted_count += 1
                            log.info(f"Minted dev #{token_id}: {dev_data['name']} "
                                     f"({dev_data['archetype']} @ {dev_data['corporation']}, "
                                     f"{dev_data['rarity']})")
                        except Exception as e:
                            conn.rollback()
                            log.error(f"Failed to insert dev #{token_id}: {e}")
                            continue

                    if minted_count > 0:
                        # Update simulation state
                        cur.execute("SELECT COUNT(*) as total FROM devs")
                        total = cur.fetchone()["total"]
                        update_simulation_state(cur, total)
                        conn.commit()
                        log.info(f"Processed {minted_count} new mints. Total devs: {total}")
                finally:
                    conn.close()

            # Update last processed block
            last_block = to_block
            conn2, cur2 = get_db(autocommit=True)
            try:
                cur2.execute(
                    "UPDATE simulation_state SET value = %s WHERE key = 'listener_last_block'",
                    (json.dumps(last_block),)
                )
            finally:
                conn2.close()

        except Exception as e:
            log.error(f"Listener error: {e}")
            time.sleep(5)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run_listener()
