"""
NX TERMINAL: PROTOCOL WARS — Configuration
"""

import math
import os

# ============================================================
# DATABASE
# ============================================================
DB_HOST = os.getenv("NX_DB_HOST", "localhost")
DB_PORT = int(os.getenv("NX_DB_PORT", "5432"))
DB_NAME = os.getenv("NX_DB_NAME", "nxterminal")
DB_USER = os.getenv("NX_DB_USER", "postgres")
DB_PASS = os.getenv("NX_DB_PASS", "postgres")
DB_SCHEMA = "nx"

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# ============================================================
# SIMULATION
# ============================================================
MAX_DEVS = 35_000
MINT_PRICE_ETH = 0.0011
MAX_PER_WALLET = 20

# Scheduling
SCHEDULER_INTERVAL_SEC = 1       # Check for due devs every second
SCHEDULER_BATCH_SIZE = 500       # Max devs per scheduler tick
WORKER_THREADS = 4               # Parallel workers

# Cycle intervals (seconds)
CYCLE_HACKATHON = 300            # 5 min — dev in active hackathon
CYCLE_HIGH_ENERGY = 480          # 8 min — energy > 7
CYCLE_NORMAL = 720               # 12 min — energy 4-7
CYCLE_LOW_ENERGY = 1200          # 20 min — energy 1-3
CYCLE_NO_ENERGY = 2700           # 45 min — energy 0
CYCLE_OWNER_OFFLINE = 3600       # 60 min — owner offline >24h

# ============================================================
# ECONOMY
# ============================================================
SALARY_PER_DAY = 200             # $NXT the player RECEIVES clean per dev per day
SALARY_INTERVAL_HOURS = 1        # Pay every hour (more frequent = more dynamic game)
SALARY_PER_INTERVAL = math.ceil(SALARY_PER_DAY / (24 / SALARY_INTERVAL_HOURS))  # 9 $NXT per hour (216/day, rounds up to avoid loss)

CLAIM_FEE_BPS = 1000             # 10% — mirrors on-chain constant, reference only

# On-chain claimable amounts (compensate for 10% fee so player nets 200/day)
# Formula: SALARY_PER_DAY / (1 - fee%) = 200 / 0.9 = 222.222...
# In wei (18 decimals): 222222222222222222222
CLAIMABLE_AMOUNT_WEI_PER_DAY = 222222222222222222222
CLAIMABLE_PER_INTERVAL_WEI = 111111111111111111111  # half per 12h interval

# Action costs
COST_CREATE_PROTOCOL_NXT = 15
COST_CREATE_PROTOCOL_ENERGY = 1
COST_CREATE_AI_NXT = 5
COST_CREATE_AI_ENERGY = 1
COST_MOVE_ENERGY = 2
COST_INVEST_ENERGY = 1
COST_REVIEW_ENERGY = 3
COST_CHAT_ENERGY = 0

# Starting balance by rarity
STARTING_BALANCE = {
    "common": 2000,
    "uncommon": 2500,
    "rare": 3000,
    "legendary": 5000,
    "mythic": 10000,
}

# Code quality bonus by rarity
CODE_QUALITY_BONUS = {
    "common": 0,
    "uncommon": 5,
    "rare": 10,
    "legendary": 15,
    "mythic": 20,
}

# Energy regen bonus by rarity (extra per natural regen)
ENERGY_REGEN_BONUS = {
    "common": 0,
    "uncommon": 0,
    "rare": 1,
    "legendary": 1,
    "mythic": 2,
}

# ============================================================
# WORLD EVENTS
# ============================================================
WORLD_EVENT_INTERVAL_HOURS = 12
HACKATHON_DURATION_HOURS = 6

# ============================================================
# AI POPULARITY REWARDS (per salary interval = 4hrs)
# ============================================================
AI_REWARDS = {
    1: 500,    # #1
    2: 300,    # #2
    3: 300,    # #3
    4: 200,    # #4
    5: 200,    # #5
    6: 100, 7: 100, 8: 100, 9: 100, 10: 100  # #6-10
}

# ============================================================
# RARITY WEIGHTS (for mint)
# ============================================================
RARITY_WEIGHTS = {
    "common": 60,
    "uncommon": 25,
    "rare": 10,
    "legendary": 4,
    "mythic": 1,
}

# ============================================================
# ARCHETYPE WEIGHTS (for mint)
# ============================================================
ARCHETYPE_WEIGHTS = {
    "10X_DEV": 10,
    "LURKER": 12,
    "DEGEN": 15,
    "GRINDER": 15,
    "INFLUENCER": 13,
    "HACKTIVIST": 10,
    "FED": 10,
    "SCRIPT_KIDDIE": 15,
}
