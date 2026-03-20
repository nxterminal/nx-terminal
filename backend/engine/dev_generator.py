"""
NX TERMINAL — Procedural Dev Generator (shared module)
Used by both the blockchain listener and the API for on-demand generation.
All generation is deterministic based on token_id.
"""

import random

# ═══════════════════════════════════════════════════════════
# GENERATION POOLS
# ═══════════════════════════════════════════════════════════

IMAGE_CID = "bafybeicz5ilcu6i36ljkacix37c4r3qrtrpjhwgylp2buxfea443cxc7i4"

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
# GENERATION LOGIC
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


def generate_dev_name(token_id, rng, check_exists=None):
    """Generate a deterministic dev name. check_exists is an optional callable(name) -> bool."""
    prefix = rng.choice(DEV_NAME_PREFIXES)
    suffix = rng.choice(DEV_NAME_SUFFIXES)
    name = f"{prefix}-{suffix}"

    if check_exists and check_exists(name):
        name = f"{prefix}-{suffix}-{token_id}"

    return name


def generate_dev_data(token_id, check_name_exists=None):
    """Generate all dev traits procedurally using tokenId as deterministic seed.
    No HTTP calls — everything is derived from the tokenId.

    Args:
        token_id: The NFT token ID
        check_name_exists: Optional callable(name) -> bool to check DB for name uniqueness
    """
    rng = random.Random(token_id)

    name = generate_dev_name(token_id, rng, check_name_exists)

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
