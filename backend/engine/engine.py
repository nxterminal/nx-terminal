"""
NX TERMINAL: PROTOCOL WARS — Simulation Engine v2
100% sin LLM. Weighted random + templates. PostgreSQL.
"""

import sys
from pathlib import Path

# Defense-in-depth against a broken PYTHONPATH (Fix-D). If this module
# is loaded with only backend/engine on sys.path (e.g. a dashboard-level
# `cd backend/engine && PYTHONPATH=. python engine.py`), every
# `from backend.services...` below raises ImportError — and the
# try/except further down used to silently disable all shadow writes.
# Injecting the project root here makes the guarded imports succeed
# under any reasonable invocation path, so the except is now a true
# last-resort diagnostic rather than a silent feature-flag.
_project_root = Path(__file__).resolve().parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

import os
import random
import random as _random
import time
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
import requests  # eth_getTransactionReceipt for process_pending_funds

from config import *
from templates import (
    gen_dev_name, gen_protocol_name, gen_protocol_description,
    gen_ai_name, gen_ai_description, gen_chat_message, gen_visual_traits,
    gen_chat_by_type,
)
from prompt_system import process_prompt

try:
    from backend.services.logging_helpers import log_info
    from backend.services.admin_log import log_event as admin_log_event
    from backend.services.ledger import (
        ledger_insert,
        LedgerSource,
        is_shadow_write_enabled,
        tx_hash_to_bigint,
    )
    from backend.api.middleware.correlation import (
        new_correlation_id,
        set_correlation_id,
        reset_correlation_id,
    )
except ImportError as _e:
    # DO NOT silence this. If we hit this branch, shadow writes are
    # disabled and the ledger will be incomplete. The exact scenario
    # that triggered it in prod: Render startCommand `cd backend/engine
    # && PYTHONPATH=. python run_all.py` — only backend/engine ended up
    # on sys.path, so `from backend.services.ledger import ...` failed
    # and every engine shadow write was silently dropped for hours.
    # Emit the failure at ERROR level under a dedicated logger so any
    # future regression surfaces in log searches / alerting instead of
    # hiding in /dev/null like last time.
    _critical_log = logging.getLogger("nx_engine_import_failure")
    _critical_log.error(
        "CRITICAL: Failed to import backend.services helpers: %s. "
        "Shadow writes are DISABLED — the ledger will be incomplete "
        "for every economic event the engine emits (salary, "
        "sell_investment, fund_deposit, hack_*, orphan_scanner). "
        "Fix: ensure PYTHONPATH or sys.path includes the project root.",
        _e,
    )
    log_info = None  # type: ignore
    admin_log_event = None  # type: ignore
    ledger_insert = None  # type: ignore
    LedgerSource = None  # type: ignore
    is_shadow_write_enabled = lambda: False  # type: ignore
    tx_hash_to_bigint = None  # type: ignore
    new_correlation_id = set_correlation_id = reset_correlation_id = None  # type: ignore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("nx_engine")

# ============================================================
# PERSONALITY MATRIX — Base weights per archetype
# ============================================================

PERSONALITY_MATRIX = {
    "10X_DEV":      {"CREATE_PROTOCOL": 12, "CREATE_AI": 6,  "INVEST": 5,  "SELL": 2,  "MOVE": 10, "CHAT": 25, "CODE_REVIEW": 25, "REST": 15},
    "LURKER":       {"CREATE_PROTOCOL": 5,  "CREATE_AI": 4,  "INVEST": 8,  "SELL": 5,  "MOVE": 15, "CHAT": 18, "CODE_REVIEW": 20, "REST": 25},
    "DEGEN":        {"CREATE_PROTOCOL": 8,  "CREATE_AI": 6,  "INVEST": 12, "SELL": 5,  "MOVE": 10, "CHAT": 35, "CODE_REVIEW": 12, "REST": 12},
    "GRINDER":      {"CREATE_PROTOCOL": 10, "CREATE_AI": 5,  "INVEST": 4,  "SELL": 2,  "MOVE": 10, "CHAT": 25, "CODE_REVIEW": 30, "REST": 14},
    "INFLUENCER":   {"CREATE_PROTOCOL": 5,  "CREATE_AI": 8,  "INVEST": 4,  "SELL": 3,  "MOVE": 12, "CHAT": 45, "CODE_REVIEW": 8,  "REST": 15},
    "HACKTIVIST":   {"CREATE_PROTOCOL": 8,  "CREATE_AI": 6,  "INVEST": 4,  "SELL": 3,  "MOVE": 18, "CHAT": 28, "CODE_REVIEW": 25, "REST": 8},
    "FED":          {"CREATE_PROTOCOL": 7,  "CREATE_AI": 4,  "INVEST": 4,  "SELL": 2,  "MOVE": 10, "CHAT": 30, "CODE_REVIEW": 30, "REST": 13},
    "SCRIPT_KIDDIE":{"CREATE_PROTOCOL": 10, "CREATE_AI": 8,  "INVEST": 5,  "SELL": 3,  "MOVE": 12, "CHAT": 30, "CODE_REVIEW": 15, "REST": 17},
}

ARCHETYPE_META = {
    "10X_DEV":      {"vote_weight": 1.0, "code_quality": (75, 98), "prompt_influence": 1.2},
    "LURKER":       {"vote_weight": 2.0, "code_quality": (60, 85), "prompt_influence": 0.7},
    "DEGEN":        {"vote_weight": 1.0, "code_quality": (30, 70), "prompt_influence": 0.5},
    "GRINDER":      {"vote_weight": 1.0, "code_quality": (65, 90), "prompt_influence": 1.5},
    "INFLUENCER":   {"vote_weight": 0.5, "code_quality": (20, 60), "prompt_influence": 1.0},
    "HACKTIVIST":   {"vote_weight": 1.0, "code_quality": (50, 80), "prompt_influence": 0.3},
    "FED":          {"vote_weight": 0.3, "code_quality": (70, 95), "prompt_influence": 0.8},
    "SCRIPT_KIDDIE":{"vote_weight": 1.0, "code_quality": (15, 75), "prompt_influence": 1.0},
}

# Social vitality gained when a dev executes a CHAT action, by archetype.
# Combines with PERSONALITY_MATRIX CHAT weights: INFLUENCERs chat ~2.3x more
# often than LURKERs AND gain 3x per chat, amplifying the personality gap
# without touching the matrix itself. LURKER gains 0 because observing
# anonymously isn't really socializing.
CHAT_SOCIAL_GAIN = {
    "INFLUENCER":   3,
    "DEGEN":        2,
    "FED":          2,
    "HACKTIVIST":   1,
    "10X_DEV":      1,
    "GRINDER":      1,
    "SCRIPT_KIDDIE":1,
    "LURKER":       0,
}


def _apply_chat_social_gain(cur, dev_token_id: int, archetype: str) -> int:
    """Apply CHAT_SOCIAL_GAIN honestly, respecting the 40 cap.

    Returns the effective gain — the value that actually hit the DB. If
    the dev was already at cap, returns 0 so the Live Feed's "+N SOCIAL"
    badge reflects reality instead of lying (bug #4 in the audit).
    """
    raw = CHAT_SOCIAL_GAIN.get(archetype, 1)
    if raw <= 0:
        return 0
    cur.execute(
        "SELECT social_vitality FROM devs WHERE token_id = %s",
        (dev_token_id,),
    )
    row = cur.fetchone()
    current = row["social_vitality"] if row else 0
    effective = max(0, min(raw, 40 - current))
    if effective > 0:
        cur.execute(
            "UPDATE devs SET social_vitality = social_vitality + %s "
            "WHERE token_id = %s",
            (effective, dev_token_id),
        )
    return effective


# Chat-type selection weights per archetype for Live Feed enrichment.
# These drive gen_chat_by_type(): INFLUENCER leans hot_take/drama,
# LURKER stays mostly idle, DEGEN favors memes, etc. Each row sums to
# 100 for readability but random.choices normalizes automatically.
CHAT_TYPE_WEIGHTS = {
    "INFLUENCER":    {"idle": 20, "hot_take": 30, "meme": 20, "drama": 15, "reaction": 15},
    "DEGEN":         {"idle": 25, "hot_take": 15, "meme": 30, "drama": 15, "reaction": 15},
    "HACKTIVIST":    {"idle": 30, "hot_take": 25, "meme": 10, "drama": 20, "reaction": 15},
    "10X_DEV":       {"idle": 40, "hot_take": 20, "meme": 15, "drama":  5, "reaction": 20},
    "GRINDER":       {"idle": 50, "hot_take": 10, "meme": 15, "drama":  5, "reaction": 20},
    "FED":           {"idle": 35, "hot_take": 15, "meme": 10, "drama": 25, "reaction": 15},
    "SCRIPT_KIDDIE": {"idle": 30, "hot_take": 10, "meme": 35, "drama": 10, "reaction": 15},
    "LURKER":        {"idle": 60, "hot_take":  5, "meme": 15, "drama":  5, "reaction": 15},
}

LOCATION_MODIFIERS = {
    "HACKATHON_HALL":   {"CREATE_PROTOCOL": 2.5, "CREATE_AI": 2.0},
    "THE_PIT":          {"INVEST": 2.5, "SELL": 2.0},
    "DARK_WEB":         {"CODE_REVIEW": 2.0, "CHAT": 1.5},
    "VC_TOWER":         {"INVEST": 2.0},
    "HYPE_HAUS":        {"CHAT": 3.0, "CREATE_AI": 1.5},
    "SERVER_FARM":      {"CREATE_PROTOCOL": 1.8},
    "OPEN_SOURCE_GARDEN": {"CREATE_PROTOCOL": 1.5},
    "GOVERNANCE_HALL":  {"CODE_REVIEW": 2.0, "REST": 1.5},
    "THE_GRAVEYARD":    {"CHAT": 1.5, "MOVE": 1.5},
    "BOARD_ROOM":       {},
    "GitHub HQ":        {"CREATE_PROTOCOL": 2.0, "CODE_REVIEW": 1.5},
}

MOODS = ["neutral", "excited", "angry", "depressed", "focused"]
LOCATIONS = list(LOCATION_MODIFIERS.keys())

WEEKLY_EVENTS = [
    {"title": "Hackathon Frenzy", "description": "Protocol development boosted across all corps.", "effects": {"create_protocol_multiplier": 2.0}},
    {"title": "Bull Market", "description": "Investments surge. Salary bonus +25%.", "effects": {"salary_multiplier": 1.25, "invest_weight_boost": 2.0}},
    {"title": "Security Audit Week", "description": "Hacking costs less, succeeds more often.", "effects": {"hack_cost_multiplier": 0.5, "hack_success_bonus": 0.15}},
    {"title": "AI Uprising", "description": "AI creation boosted. Strange AIs emerge.", "effects": {"create_ai_multiplier": 2.5}},
    {"title": "Corporate Tax", "description": "Shop costs up 50%, but salary up 50% too.", "effects": {"shop_cost_multiplier": 1.5, "salary_multiplier": 1.5}},
    {"title": "Energy Crisis", "description": "Energy decays faster. Shop items cheaper.", "effects": {"energy_decay_multiplier": 2.0, "shop_cost_multiplier": 0.5}},
    {"title": "Golden Age", "description": "Double salary for all devs. Enjoy it while it lasts.", "effects": {"salary_multiplier": 2.0}},
    {"title": "Dark Web Surge", "description": "Hacking is riskier. Code reviews find more bugs.", "effects": {"hack_success_bonus": -0.10}},
    {"title": "Protocol Rush", "description": "Protocol creation boosted by 50%.", "effects": {"create_protocol_multiplier": 1.5}},
    {"title": "Maintenance Mode", "description": "PC decay halted. Devs take it easy.", "effects": {"pc_decay_multiplier": 0.0, "energy_decay_multiplier": 0.5}},
]

# ============================================================
# DATABASE CONNECTION
# ============================================================

@contextmanager
def get_db():
    """Context manager for DB connection."""
    conn = psycopg2.connect(DATABASE_URL, options=f"-c search_path={DB_SCHEMA}")
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


# ============================================================
# DECISION ENGINE
# ============================================================

def apply_context_modifiers(weights: dict, dev: dict, context: dict) -> dict:
    """Modify weights based on dev state, location, world events."""
    w = weights.copy()
    energy = dev["energy"]
    balance = dev["balance_nxt"]
    mood = dev["mood"]
    location = dev["location"]

    # --- Energy constraints ---
    if energy < COST_CREATE_PROTOCOL_ENERGY: w["CREATE_PROTOCOL"] = 0
    if energy < COST_CREATE_AI_ENERGY: w["CREATE_AI"] = 0
    if energy < COST_REVIEW_ENERGY: w["CODE_REVIEW"] = 0
    if energy < COST_MOVE_ENERGY: w["MOVE"] = 0
    if energy < COST_INVEST_ENERGY:
        w["INVEST"] = 0
        w["SELL"] = 0

    # Energy level influence
    if energy <= 2:
        w["REST"] *= 4.0
        for a in ["CREATE_PROTOCOL", "CREATE_AI", "CODE_REVIEW"]:
            w[a] *= 0.1
    elif energy <= 5:
        w["REST"] *= 1.5
        w["CREATE_PROTOCOL"] *= 0.5
    elif energy >= 8:
        w["CREATE_PROTOCOL"] *= 2.0
        w["REST"] *= 0.1

    # --- Balance constraints ---
    if balance < COST_CREATE_PROTOCOL_NXT: w["CREATE_PROTOCOL"] = 0
    if balance < COST_CREATE_AI_NXT: w["CREATE_AI"] = 0
    if balance < 5: w["INVEST"] = 0

    # --- Mood ---
    mood_mods = {
        "angry":    {"CHAT": 2.0, "CODE_REVIEW": 1.5, "REST": 0.5},
        "excited":  {"CREATE_PROTOCOL": 1.5, "CREATE_AI": 2.0, "INVEST": 1.5},
        "depressed":{"REST": 2.0, "CHAT": 0.5, "CREATE_PROTOCOL": 0.3},
        "focused":  {"CREATE_PROTOCOL": 2.0, "CODE_REVIEW": 1.5, "CHAT": 0.3},
    }
    for action, mult in mood_mods.get(mood, {}).items():
        if action in w:
            w[action] *= mult

    # --- Location ---
    for action, mult in LOCATION_MODIFIERS.get(location, {}).items():
        if action in w:
            w[action] *= mult

    # --- No protocols exist → can't invest/sell/review ---
    if not context.get("has_protocols"):
        w["INVEST"] = 0
        w["SELL"] = 0
        w["CODE_REVIEW"] = 0

    # --- No investments → can't sell ---
    if not context.get("has_investments"):
        w["SELL"] = 0

    # --- World event ---
    event_effects = context.get("event_effects", {})
    if event_effects.get("create_protocol_multiplier"):
        w["CREATE_PROTOCOL"] *= event_effects["create_protocol_multiplier"]
    if event_effects.get("create_ai_multiplier"):
        w["CREATE_AI"] *= event_effects["create_ai_multiplier"]
    if event_effects.get("invest_weight_boost"):
        w["INVEST"] *= event_effects["invest_weight_boost"]
    if event_effects.get("sell_weight_boost"):
        w["SELL"] *= event_effects["sell_weight_boost"]

    # --- Player prompt weight modifiers ---
    prompt_mods = context.get("prompt_weight_modifiers", {})
    for action, mult in prompt_mods.items():
        if action in w:
            w[action] *= mult

    # --- PC health penalty: low health reduces productive actions ---
    pc_health = dev.get("pc_health", 100)
    if pc_health < 50:
        penalty = pc_health / 100.0  # 0.0 at 0 health, 0.49 at 49
        w["CREATE_PROTOCOL"] *= penalty
        w["CREATE_AI"] *= penalty
        w["CODE_REVIEW"] *= penalty

    # --- Training: dev is studying, reduces costly actions ---
    if dev.get("training_course"):
        w["CREATE_PROTOCOL"] *= 0.3
        w["CREATE_AI"] *= 0.3
        w["INVEST"] *= 0.3

    # --- Personality seed variation (±15%) ---
    seed = dev.get("personality_seed", 0)
    rng = random.Random(seed)
    for action in w:
        if w[action] > 0:
            variation = rng.uniform(0.85, 1.15)
            w[action] *= variation

    return w


def decide_action(dev: dict, context: dict) -> str:
    """Core decision: weighted random based on personality + context."""
    archetype = dev["archetype"]
    base = PERSONALITY_MATRIX[archetype].copy()
    modified = apply_context_modifiers(base, dev, context)

    total = sum(modified.values())
    if total == 0:
        return "REST"

    actions = list(modified.keys())
    probs = [modified[a] / total for a in actions]
    return random.choices(actions, weights=probs, k=1)[0]


# ============================================================
# NOTIFICATIONS
# ============================================================

PROTOCOL_NOTIF_TITLES = [
    "{dev} just shipped a protocol!",
    "New protocol alert from {dev}!",
    "{dev} deployed something. It might even work.",
    "BREAKING: {dev} created a protocol. Shareholders mildly interested.",
    "{dev} just pushed code to production. On a Friday.",
]

PROTOCOL_NOTIF_BODIES = [
    "{dev} deployed \"{proto}\" (quality: {quality}/100). Your portfolio of questionable decisions grows.",
    "\"{proto}\" is live. {dev} built it with {quality}% code quality. The other {rest}% is held together by hope.",
    "Protocol \"{proto}\" has entered the chat. Quality score: {quality}. {dev} is already updating their LinkedIn.",
    "{dev} created \"{proto}\". It cost them {cost} $NXT and their remaining dignity. Quality: {quality}/100.",
]

AI_NOTIF_TITLES = [
    "{dev} created an AI. It's... something.",
    "New Absurd AI from {dev}!",
    "{dev} just birthed a digital consciousness. Sort of.",
]

AI_NOTIF_BODIES = [
    "{dev} created \"{ai}\": {desc}. The singularity was supposed to be cooler than this.",
    "\"{ai}\" now exists thanks to {dev}. It cost {cost} $NXT. Was it worth it? Probably not. But here we are.",
    "Your dev {dev} made \"{ai}\". Nobody asked for this. {desc}",
]


def insert_notification(cur, owner: str, notif_type: str, title: str, body: str, dev_id: int = None):
    """Insert a notification for a player."""
    cur.execute("""
        INSERT INTO notifications (player_address, type, title, body, dev_id)
        VALUES (%s, %s, %s, %s, %s)
    """, (owner, notif_type, title[:500], body[:1000], dev_id))


# ============================================================
# ACTION EXECUTION
# ============================================================

def execute_action(conn, dev: dict, action: str, context: dict) -> dict:
    """Execute action, update DB, return result dict."""
    cur = get_cursor(conn)
    result = {
        "action": action,
        "dev_id": dev["token_id"],
        "dev_name": dev["name"],
        "archetype": dev["archetype"],
        "details": {},
        "chat_msg": "",
        "chat_channel": None,
        "energy_cost": 0,
        "nxt_cost": 0,
    }
    arch = dev["archetype"]
    rarity = dev.get("rarity_tier", "common")

    if action == "CREATE_PROTOCOL":
        name = gen_protocol_name()
        desc = gen_protocol_description()
        low, high = ARCHETYPE_META[arch]["code_quality"]
        quality = random.randint(low, high) + CODE_QUALITY_BONUS.get(rarity, 0)
        quality = min(100, quality)
        value = 1000 + quality * 10

        cur.execute("""
            INSERT INTO protocols (name, description, creator_dev_id, code_quality, value)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """, (name, desc, dev["token_id"], quality, value))
        proto_id = cur.fetchone()["id"]

        result["energy_cost"] = COST_CREATE_PROTOCOL_ENERGY
        result["nxt_cost"] = COST_CREATE_PROTOCOL_NXT
        result["details"] = {"protocol_id": proto_id, "name": name, "quality": quality, "description": desc}
        result["chat_msg"] = gen_chat_message(arch, "created_protocol", name=name)
        result["chat_channel"] = "trollbox"

        # Update dev stats
        lines_written = random.randint(50, 300)
        cur.execute("""
            UPDATE devs SET
                energy = energy - %s,
                balance_nxt = balance_nxt - %s,
                total_spent = total_spent + %s,
                protocols_created = protocols_created + 1,
                reputation = reputation + %s,
                lines_of_code = lines_of_code + %s
            WHERE token_id = %s
        """, (COST_CREATE_PROTOCOL_ENERGY, COST_CREATE_PROTOCOL_NXT,
              COST_CREATE_PROTOCOL_NXT, quality // 10, lines_written, dev["token_id"]))

    elif action == "CREATE_AI":
        name = gen_ai_name()
        desc = gen_ai_description()

        cur.execute("""
            INSERT INTO absurd_ais (name, description, creator_dev_id)
            VALUES (%s, %s, %s) RETURNING id
        """, (name, desc, dev["token_id"]))
        ai_id = cur.fetchone()["id"]

        result["energy_cost"] = COST_CREATE_AI_ENERGY
        result["nxt_cost"] = COST_CREATE_AI_NXT
        result["details"] = {"ai_id": ai_id, "name": name, "description": desc}
        result["chat_msg"] = gen_chat_message(arch, "created_ai", name=name)
        result["chat_channel"] = "trollbox"

        cur.execute("""
            UPDATE devs SET
                energy = energy - %s,
                balance_nxt = balance_nxt - %s,
                total_spent = total_spent + %s,
                ais_created = ais_created + 1
            WHERE token_id = %s
        """, (COST_CREATE_AI_ENERGY, COST_CREATE_AI_NXT, COST_CREATE_AI_NXT, dev["token_id"]))


    elif action == "INVEST":
        # Pick a random active protocol
        cur.execute("SELECT id, name, value FROM protocols WHERE status = 'active' ORDER BY RANDOM() LIMIT 1")
        proto = cur.fetchone()
        if proto:
            max_invest = min(500, dev["balance_nxt"] // 5)  # max 20% of balance
            amount = random.randint(2, max(3, max_invest))

            # Upsert investment
            cur.execute("""
                INSERT INTO protocol_investments (dev_id, protocol_id, shares, nxt_invested)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (dev_id, protocol_id)
                DO UPDATE SET shares = protocol_investments.shares + EXCLUDED.shares,
                             nxt_invested = protocol_investments.nxt_invested + EXCLUDED.nxt_invested
            """, (dev["token_id"], proto["id"], amount, amount))

            # Update protocol
            cur.execute("""
                UPDATE protocols SET
                    value = value + %s,
                    total_invested = total_invested + %s,
                    investor_count = (SELECT COUNT(DISTINCT dev_id) FROM protocol_investments WHERE protocol_id = %s)
                WHERE id = %s
            """, (amount // 2, amount, proto["id"], proto["id"]))

            result["energy_cost"] = COST_INVEST_ENERGY
            result["nxt_cost"] = amount
            result["details"] = {"protocol_id": proto["id"], "name": proto["name"], "amount": amount}
            result["chat_msg"] = gen_chat_message(arch, "invested", name=proto["name"])
            result["chat_channel"] = "location"

            cur.execute("""
                UPDATE devs SET
                    energy = energy - %s,
                    balance_nxt = balance_nxt - %s,
                    total_spent = total_spent + %s,
                    total_invested = total_invested + %s
                WHERE token_id = %s
            """, (COST_INVEST_ENERGY, amount, amount, amount, dev["token_id"]))

    elif action == "SELL":
        # Check investments
        cur.execute("""
            SELECT pi.id, pi.protocol_id, pi.shares, pi.nxt_invested, p.name, p.value
            FROM protocol_investments pi
            JOIN protocols p ON p.id = pi.protocol_id
            WHERE pi.dev_id = %s
            ORDER BY RANDOM() LIMIT 1
        """, (dev["token_id"],))
        inv = cur.fetchone()
        if inv:
            sell_value = int(inv["shares"] * random.uniform(0.5, 1.8))
            pnl = sell_value - inv["nxt_invested"]

            cur.execute("DELETE FROM protocol_investments WHERE dev_id = %s AND protocol_id = %s",
                        (dev["token_id"], inv["protocol_id"]))
            cur.execute("UPDATE protocols SET value = GREATEST(0, value - %s) WHERE id = %s",
                        (inv["shares"] // 3, inv["protocol_id"]))

            result["details"] = {"protocol_id": inv["protocol_id"], "name": inv["name"],
                                 "sold_for": sell_value, "invested": inv["nxt_invested"], "pnl": pnl}
            result["chat_msg"] = gen_chat_message(arch, "sold", name=inv["name"])
            result["chat_channel"] = "location"

            cur.execute("""
                UPDATE devs SET
                    balance_nxt = balance_nxt + %s,
                    total_earned = total_earned + %s
                WHERE token_id = %s
            """, (sell_value, sell_value, dev["token_id"]))

            # Shadow-write to nxt_ledger (Fase 3B, fixed in follow-up).
            # protocol_investments.id is the natural SERIAL PK — each
            # sell → reinvest cycle creates a new row with a fresh id,
            # so a dev that sells, reinvests, and sells again no longer
            # collides on idempotency_key (which was the latent bug
            # when ref_id was protocol_id).
            if is_shadow_write_enabled() and ledger_insert is not None:
                try:
                    ledger_insert(
                        cur,
                        wallet_address=dev["owner_address"],
                        dev_token_id=dev["token_id"],
                        delta_nxt=sell_value,
                        source=LedgerSource.SELL_INVESTMENT,
                        ref_table="protocol_investments",
                        ref_id=inv["id"],
                    )
                except Exception as _e:  # noqa: BLE001
                    log.warning(
                        "ledger_shadow_write_failed source=sell_investment "
                        "token_id=%s error=%s",
                        dev["token_id"], _e,
                    )

    elif action == "MOVE":
        old_loc = dev["location"]
        # Use prompt target location if specified, otherwise random
        prompt_loc = context.get("prompt_target_location")
        if prompt_loc and prompt_loc in LOCATIONS and prompt_loc != old_loc:
            new_loc = prompt_loc
        else:
            new_loc = random.choice([l for l in LOCATIONS if l != old_loc])
        result["energy_cost"] = COST_MOVE_ENERGY
        result["details"] = {"from": old_loc, "to": new_loc}

        cur.execute("""
            UPDATE devs SET energy = energy - %s, location = %s WHERE token_id = %s
        """, (COST_MOVE_ENERGY, new_loc, dev["token_id"]))

    elif action == "CHAT":
        # Only minted devs (with ipfs_hash) can chat. Un-minted devs would
        # render in the Live Feed without an avatar and with no corporation
        # context, so we route them to REST instead — they still advance
        # their tick, recover energy, and log an action, just not a chat.
        if not dev.get("ipfs_hash"):
            regen = random.randint(2, 4) + ENERGY_REGEN_BONUS.get(rarity, 0)
            result["details"] = {"energy_restored": regen}
            cur.execute(
                "UPDATE devs SET energy = LEAST(max_energy, energy + %s), "
                "hours_since_sleep = 0 WHERE token_id = %s",
                (regen, dev["token_id"]),
            )
            action = "REST"
        else:
            # Pick a chat_type weighted by archetype personality. LURKER stays
            # mostly idle, INFLUENCER favors hot_takes/drama, DEGEN memes, etc.
            type_weights = CHAT_TYPE_WEIGHTS.get(arch, CHAT_TYPE_WEIGHTS["10X_DEV"])
            chat_type = random.choices(
                list(type_weights.keys()),
                weights=list(type_weights.values()),
                k=1,
            )[0]
            msg, final_type = gen_chat_by_type(chat_type, arch, dev.get("corporation", ""))
            channel = random.choice(["location", "trollbox"])

            # Socializing raises social_vitality — amount varies by archetype
            # (see CHAT_SOCIAL_GAIN). LURKER gains 0 because observing isn't
            # really socializing. Capped at 40 here so chat alone can only
            # take a dev up to the "comfortable" band; reaching 40→100 still
            # requires Team Lunch (6 $NXT) or successful hacks. Passive
            # recovery handles 0→25 for free; chat fills 25→40; shop fills 40→100.
            #
            # _apply_chat_social_gain returns the EFFECTIVE gain (what actually
            # persisted to the DB), which is 0 if the dev is already at cap —
            # so the Live Feed "+N SOCIAL" badge never lies.
            social_gain = _apply_chat_social_gain(cur, dev["token_id"], arch)

            result["chat_msg"] = msg
            result["chat_channel"] = channel
            result["chat_type"] = final_type
            result["social_gain"] = social_gain
            # Enrich details JSON so the LiveFeed / actions-table readers can
            # render the full chat inline (avatar, type badge, +N social).
            # Fixes the pre-existing bug where formatBackendAction fell back to
            # "something incomprehensible" because details.message was missing.
            result["details"] = {
                "location": dev["location"],
                "message": msg,
                "chat_type": final_type,
                "social_gain": social_gain,
            }

    elif action == "CODE_REVIEW":
        cur.execute("SELECT id, name, code_quality FROM protocols WHERE status = 'active' ORDER BY RANDOM() LIMIT 1")
        proto = cur.fetchone()
        if proto:
            found_bug = random.random() < 0.25
            result["energy_cost"] = COST_REVIEW_ENERGY

            if found_bug:
                damage = random.randint(50, 200)
                quality_drop = random.randint(5, 15)
                cur.execute("UPDATE protocols SET value = GREATEST(0, value - %s), code_quality = GREATEST(0, code_quality - %s) WHERE id = %s",
                            (damage, quality_drop, proto["id"]))
                review_lines = random.randint(20, 100)
                cur.execute("UPDATE devs SET energy = energy - %s, code_reviews_done = code_reviews_done + 1, bugs_found = bugs_found + 1, reputation = reputation + 5, lines_of_code = lines_of_code + %s WHERE token_id = %s",
                            (COST_REVIEW_ENERGY, review_lines, dev["token_id"]))
                result["details"] = {"protocol_id": proto["id"], "name": proto["name"], "found_bug": True}
                result["chat_msg"] = gen_chat_message(arch, "code_review_bug", name=proto["name"])
            else:
                review_lines = random.randint(10, 50)
                cur.execute("UPDATE devs SET energy = energy - %s, code_reviews_done = code_reviews_done + 1, reputation = reputation + 1, lines_of_code = lines_of_code + %s WHERE token_id = %s",
                            (COST_REVIEW_ENERGY, review_lines, dev["token_id"]))
                result["details"] = {"protocol_id": proto["id"], "name": proto["name"], "found_bug": False}
                result["chat_msg"] = gen_chat_message(arch, "code_review_clean", name=proto["name"])
            result["chat_channel"] = "location"

    elif action == "REST":
        regen = random.randint(2, 4) + ENERGY_REGEN_BONUS.get(rarity, 0)
        result["details"] = {"energy_restored": regen}
        cur.execute("UPDATE devs SET energy = LEAST(max_energy, energy + %s), hours_since_sleep = 0 WHERE token_id = %s",
                    (regen, dev["token_id"]))

    # --- Post-action: increment hours_since_sleep for non-REST actions ---
    if action != "REST":
        cur.execute("UPDATE devs SET hours_since_sleep = hours_since_sleep + 1 WHERE token_id = %s",
                    (dev["token_id"],))

    # --- Post-action: mood shift (10% chance) ---
    if random.random() < 0.10:
        new_mood = random.choice(MOODS)
        cur.execute("UPDATE devs SET mood = %s WHERE token_id = %s", (new_mood, dev["token_id"]))

    # --- Natural energy regen (30% chance, +1) ---
    if action != "REST" and random.random() < 0.30:
        cur.execute("UPDATE devs SET energy = LEAST(max_energy, energy + 1) WHERE token_id = %s", (dev["token_id"],))

    # --- Auto-vote on a random AI (15% chance) ---
    if random.random() < 0.15:
        vote_weight = ARCHETYPE_META[arch]["vote_weight"]
        if random.random() < vote_weight:
            cur.execute("""
                SELECT id FROM absurd_ais WHERE creator_dev_id != %s ORDER BY RANDOM() LIMIT 1
            """, (dev["token_id"],))
            ai_row = cur.fetchone()
            if ai_row:
                cur.execute("""
                    INSERT INTO ai_votes (voter_dev_id, ai_id, weight)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (voter_dev_id, ai_id) DO NOTHING
                """, (dev["token_id"], ai_row["id"], vote_weight))
                cur.execute("""
                    UPDATE absurd_ais SET
                        vote_count = (SELECT COUNT(*) FROM ai_votes WHERE ai_id = %s),
                        weighted_votes = (SELECT COALESCE(SUM(weight), 0) FROM ai_votes WHERE ai_id = %s)
                    WHERE id = %s
                """, (ai_row["id"], ai_row["id"], ai_row["id"]))

    # --- Log action ---
    cur.execute("""
        INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (dev["token_id"], dev["name"], dev["archetype"], action,
          json.dumps(result["details"]), result["energy_cost"], result["nxt_cost"]))

    # --- Contextual CHAT row for Live Feed ---
    # Actions like CREATE_PROTOCOL / CREATE_AI / INVEST / SELL / CODE_REVIEW
    # generate a contextual chat_msg (e.g. "Just deployed {name}") but log
    # the event under the original action_type, not CHAT. The Live Feed
    # filter only shows action_type='CHAT' rows, so ~60-70% of the
    # narrative content was invisible. Here we emit an additional CHAT
    # row carrying the same message so the feed shows real reactions to
    # real events — and we grant social_vitality for it too, since
    # reacting to your own work out loud counts as socializing.
    if (
        action != "CHAT"
        and result.get("chat_msg")
        and result.get("chat_channel")
        and dev.get("ipfs_hash")
    ):
        contextual_gain = _apply_chat_social_gain(cur, dev["token_id"], arch)
        contextual_details = {
            "location": dev["location"],
            "message": result["chat_msg"],
            "chat_type": "reaction",
            "social_gain": contextual_gain,
            "contextual": True,
            "trigger_action": action,
        }
        cur.execute("""
            INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
            VALUES (%s, %s, %s, 'CHAT', %s, 0, 0)
        """, (dev["token_id"], dev["name"], dev["archetype"],
              json.dumps(contextual_details)))

    # --- Log chat message ---
    if result["chat_msg"] and result["chat_channel"]:
        cur.execute("""
            INSERT INTO chat_messages
                (dev_id, dev_name, archetype, channel, location, message,
                 chat_type, social_gain)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (dev["token_id"], dev["name"], dev["archetype"],
              result["chat_channel"],
              dev["location"] if result["chat_channel"] == "location" else None,
              result["chat_msg"],
              result.get("chat_type", "idle"),
              result.get("social_gain", 0)))

    # --- Random bug generation (5% chance per action) ---
    if random.random() < 0.05:
        sev_roll = random.random()
        if sev_roll < 0.70:
            severity, fix_cost = "warning", 3
        elif sev_roll < 0.95:
            severity, fix_cost = "error", 8
        else:
            severity, fix_cost = "bsod", 20
        bug_expires = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        cur.execute("""
            INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
            VALUES (%s, %s, %s, 'GET_SABOTAGED', %s::jsonb, 0, 0)
        """, (dev["token_id"], dev["name"], dev["archetype"],
              json.dumps({"event": "bug_detected", "severity": severity,
                          "fix_cost": fix_cost, "expires_at": bug_expires,
                          "message": f"BUG DETECTED ({severity.upper()}) in {dev['name']}'s workstation"})))
        cur.execute("UPDATE devs SET bugs_shipped = bugs_shipped + 1 WHERE token_id = %s", (dev["token_id"],))

    # --- Update last action + scheduling ---
    interval = calc_next_interval(dev, context)
    now = datetime.now(timezone.utc)
    cur.execute("""
        UPDATE devs SET
            last_action_type = %s,
            last_action_detail = %s,
            last_action_at = %s,
            last_message = %s,
            last_message_channel = %s,
            next_cycle_at = %s,
            cycle_interval_sec = %s,
            cycles_active = cycles_active + 1
        WHERE token_id = %s
    """, (action, json.dumps(result["details"])[:500], now,
          result["chat_msg"][:500] if result["chat_msg"] else None,
          result["chat_channel"],
          now + timedelta(seconds=interval), interval,
          dev["token_id"]))

    return result


def calc_next_interval(dev: dict, context: dict) -> int:
    """Calculate next cycle interval based on dev state."""
    energy = dev["energy"]
    if context.get("event_effects", {}).get("create_protocol_multiplier", 1) > 1:
        return CYCLE_HACKATHON  # Hackathon = faster cycles
    if energy >= 8:
        return CYCLE_HIGH_ENERGY
    if energy >= 4:
        return CYCLE_NORMAL
    if energy >= 1:
        return CYCLE_LOW_ENERGY
    return CYCLE_NO_ENERGY


# ============================================================
# PROCESS SINGLE DEV CYCLE
# ============================================================

def check_and_process_prompt(conn, dev: dict, context: dict) -> Optional[dict]:
    """Check for a pending player prompt, process it, and return result if any."""
    cur = get_cursor(conn)

    # Fetch oldest unconsumed prompt for this dev
    cur.execute("""
        SELECT id, player_address, prompt_text
        FROM player_prompts
        WHERE dev_id = %s AND consumed = FALSE
        ORDER BY created_at ASC
        LIMIT 1
    """, (dev["token_id"],))
    prompt_row = cur.fetchone()
    if not prompt_row:
        return None

    # Gather known protocol names for context
    cur.execute("SELECT name FROM protocols WHERE status = 'active'")
    known_protocols = [r["name"] for r in cur.fetchall()]

    # Fetch extra dev stats needed by process_prompt
    cur.execute("""
        SELECT protocols_created, ais_created, bugs_found, code_reviews_done
        FROM devs WHERE token_id = %s
    """, (dev["token_id"],))
    stats = cur.fetchone()
    dev_full = {**dev, **stats} if stats else dev

    # Process the prompt through the personality system
    prompt_result = process_prompt(prompt_row["prompt_text"], dev_full, known_protocols)

    # Mark prompt as consumed
    cur.execute("""
        UPDATE player_prompts SET consumed = TRUE, consumed_at = NOW()
        WHERE id = %s
    """, (prompt_row["id"],))

    # Save dev response as a chat message
    if prompt_result.get("response"):
        cur.execute("""
            INSERT INTO chat_messages (dev_id, dev_name, archetype, channel, location, message)
            VALUES (%s, %s, %s, 'trollbox', NULL, %s)
        """, (dev["token_id"], dev["name"], dev["archetype"],
              prompt_result["response"][:500]))

    # Log as action
    cur.execute("""
        INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
        VALUES (%s, %s, %s, 'CHAT', %s, 0, 0)
    """, (dev["token_id"], dev["name"], dev["archetype"],
          json.dumps({
              "event": "prompt_response",
              "player_prompt": prompt_row["prompt_text"][:200],
              "intent": prompt_result.get("intent"),
              "compliance": prompt_result.get("compliance"),
              "response": prompt_result.get("response", ""),
          })))

    # Notify the player about the dev's response
    owner = prompt_row.get("player_address") or dev.get("owner_address")
    if owner and prompt_result.get("response"):
        insert_notification(cur, owner, "prompt_response",
            f"{dev['name']} responded to your order",
            f"You said: \"{prompt_row['prompt_text'][:100]}\"\n\n"
            f"{dev['name']} [{prompt_result.get('compliance', 'unknown')}]: "
            f"\"{prompt_result['response'][:300]}\"",
            dev["token_id"])

    log.info(f"📨 {dev['name']} received prompt: \"{prompt_row['prompt_text'][:60]}\"")
    log.info(f"   → [{prompt_result.get('compliance', '?')}] \"{prompt_result.get('response', '')[:80]}\"")

    return prompt_result


def apply_prompt_modifiers(context: dict, prompt_result: dict) -> dict:
    """Apply weight modifiers from a processed prompt to the dev's context."""
    if not prompt_result or not prompt_result.get("weight_modifiers"):
        return context

    ctx = context.copy()
    ctx["prompt_weight_modifiers"] = {
        k: v for k, v in prompt_result["weight_modifiers"].items()
        if not k.startswith("_")
    }
    # If prompt specifies a target location, pass it through
    if prompt_result.get("target_location"):
        ctx["prompt_target_location"] = prompt_result["target_location"]
    return ctx


def process_dev(conn, dev: dict, context: dict) -> dict:
    """Full cycle for one dev: check prompt → decide → execute → return result."""
    # Check for pending player prompts before deciding action
    prompt_result = check_and_process_prompt(conn, dev, context)
    if prompt_result:
        context = apply_prompt_modifiers(context, prompt_result)

    action = decide_action(dev, context)

    # Budget cap: engine can only spend up to 40% of balance on auto-actions
    # This preserves ~60% for player-initiated spending (shop, training, raids)
    # Exempt low-balance devs (<50 $NXT) so they can start creating early
    SPENDING_ACTIONS = {"CREATE_PROTOCOL", "CREATE_AI", "INVEST"}
    if action in SPENDING_ACTIONS and dev["balance_nxt"] >= 50:
        available_budget = int(dev["balance_nxt"] * 0.4)
        action_cost = {
            "CREATE_PROTOCOL": COST_CREATE_PROTOCOL_NXT,
            "CREATE_AI": COST_CREATE_AI_NXT,
            "INVEST": max(2, min(500, dev["balance_nxt"] // 5)),
        }.get(action, 0)
        if action_cost > available_budget:
            action = "REST"

    result = execute_action(conn, dev, action, context)

    # Attach prompt info to result for logging
    if prompt_result:
        result["prompt_response"] = prompt_result.get("response", "")

    return result


# ============================================================
# SCHEDULER — Fetches due devs and processes them
# ============================================================

def fetch_due_devs(conn, limit: int = SCHEDULER_BATCH_SIZE) -> list:
    """Get devs whose next_cycle_at has passed."""
    cur = get_cursor(conn)
    cur.execute("""
        SELECT token_id, name, owner_address, archetype, corporation, rarity_tier,
               personality_seed, energy, max_energy, mood, location,
               balance_nxt, reputation, status, ipfs_hash
        FROM devs
        WHERE status = 'active'
          AND next_cycle_at <= NOW()
        ORDER BY next_cycle_at ASC
        LIMIT %s
    """, (limit,))
    return cur.fetchall()


def _fetch_shared_context(conn) -> dict:
    """Fetch context that is identical for all devs in a tick (run once)."""
    cur = get_cursor(conn)
    cur.execute("SELECT COUNT(*) as cnt FROM protocols WHERE status = 'active'")
    has_protocols = cur.fetchone()["cnt"] > 0
    cur.execute("""
        SELECT effects FROM world_events
        WHERE is_active = TRUE AND starts_at <= NOW() AND ends_at >= NOW()
        ORDER BY starts_at DESC LIMIT 1
    """)
    event_row = cur.fetchone()
    return {
        "has_protocols": has_protocols,
        "event_effects": event_row["effects"] if event_row else {},
    }


def build_context(conn, dev: dict, shared: dict) -> dict:
    """Build the context packet for a dev's decision."""
    cur = get_cursor(conn)
    cur.execute("SELECT COUNT(*) as cnt FROM protocol_investments WHERE dev_id = %s", (dev["token_id"],))
    has_investments = cur.fetchone()["cnt"] > 0
    return {
        "has_protocols": shared["has_protocols"],
        "has_investments": has_investments,
        "event_effects": shared["event_effects"],
    }


def run_scheduler_tick(conn) -> int:
    """Process one batch of due devs. Returns count processed."""
    devs = fetch_due_devs(conn)
    if not devs:
        return 0

    shared_ctx = _fetch_shared_context(conn)

    processed = 0
    for dev in devs:
        try:
            ctx = build_context(conn, dev, shared_ctx)
            result = process_dev(conn, dev, ctx)
            processed += 1

            # Log to console
            action = result["action"]
            emoji = {"CREATE_PROTOCOL": "🔧", "CREATE_AI": "🤖", "INVEST": "📈",
                     "SELL": "📉", "MOVE": "🚶", "CHAT": "💬",
                     "CODE_REVIEW": "🔍", "REST": "😴"}.get(action, "❓")
            log.info(f"{emoji} {dev['name']} ({dev['archetype']}) → {action}")
            if result["chat_msg"]:
                log.info(f"   💬 \"{result['chat_msg'][:80]}\"")

        except Exception as e:
            log.error(f"Error processing dev {dev['token_id']}: {e}")
            conn.rollback()
            continue

    conn.commit()
    return processed


# ============================================================
# SALARY CRON
# ============================================================

def pay_salaries(conn):
    """Pay salary to all active devs. Run every hour.

    balance_nxt in DB tracks the player-visible amount per interval.
    The on-chain sync uses CLAIMABLE_PER_INTERVAL_WEI so that after the
    contract fee, the player nets exactly the right amount.
    """
    cur = get_cursor(conn)

    # Get active weekly event effects
    cur.execute("""
        SELECT effects FROM world_events
        WHERE is_active = TRUE AND event_type = 'weekly' AND starts_at <= NOW() AND ends_at >= NOW()
        ORDER BY starts_at DESC LIMIT 1
    """)
    evt = cur.fetchone()
    event_effects = evt["effects"] if evt else {}
    if isinstance(event_effects, str):
        event_effects = json.loads(event_effects)

    effective_salary = int(SALARY_PER_INTERVAL * event_effects.get("salary_multiplier", 1.0))

    cur.execute("""
        UPDATE devs SET
            balance_nxt = balance_nxt + %s,
            total_earned = total_earned + %s,
            energy = LEAST(max_energy, energy + 1 +
                CASE rarity_tier
                    WHEN 'rare' THEN 1
                    WHEN 'legendary' THEN 1
                    WHEN 'mythic' THEN 2
                    ELSE 0
                END
            )
        WHERE status IN ('active', 'on_mission')
        RETURNING token_id, owner_address
    """, (effective_salary, effective_salary))

    paid_rows = cur.fetchall()
    count = len(paid_rows)

    # Shadow-write to nxt_ledger (Fase 3B). Each dev gets one row per
    # hour; a re-run within the same hour with the same salary collides
    # on idempotency_key and is a silent no-op. effective_salary is
    # deterministic per tick (event multiplier × SALARY_PER_INTERVAL),
    # so retries within one hour don't produce key drift.
    if is_shadow_write_enabled() and ledger_insert is not None and paid_rows:
        epoch_hour = int(time.time()) // 3600
        for paid in paid_rows:
            token_id = paid[0] if not isinstance(paid, dict) else paid["token_id"]
            owner = paid[1] if not isinstance(paid, dict) else paid["owner_address"]
            try:
                ledger_insert(
                    cur,
                    wallet_address=owner,
                    dev_token_id=token_id,
                    delta_nxt=effective_salary,
                    source=LedgerSource.SALARY,
                    ref_table="salary_batches",
                    ref_id=epoch_hour,
                )
            except Exception as _e:  # noqa: BLE001
                log.warning(
                    "ledger_shadow_write_failed source=salary token_id=%s error=%s",
                    token_id, _e,
                )

    # Batch INSERT salary actions so they appear in feed & wallet movements
    cur.execute("""
        INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
        SELECT token_id, name, archetype::archetype_enum, 'RECEIVE_SALARY'::action_enum,
               jsonb_build_object(
                   'event', 'salary',
                   'amount', %s,
                   'message', name || ' received salary'
               ),
               0, %s
        FROM devs
        WHERE status IN ('active', 'on_mission')
    """, (effective_salary, effective_salary))

    # Degrade PC health: -2 per hour for all active devs (min 0), with event modifier
    pc_decay = max(0, int(2 * event_effects.get("pc_decay_multiplier", 1.0)))
    cur.execute("""
        UPDATE devs SET pc_health = GREATEST(0, pc_health - %s) WHERE status = 'active'
    """, (pc_decay,))

    # Decay vitals: caffeine -2, social -1, knowledge -1 per hour (min 0), with event modifier
    caff_decay = max(0, int(2 * event_effects.get("energy_decay_multiplier", 1.0)))
    social_decay = max(0, int(1 * event_effects.get("energy_decay_multiplier", 1.0)))
    knowledge_decay = max(0, int(1 * event_effects.get("energy_decay_multiplier", 1.0)))
    cur.execute("""
        UPDATE devs SET
            caffeine        = GREATEST(0, caffeine        - %s),
            social_vitality = GREATEST(0, social_vitality - %s),
            knowledge       = GREATEST(0, knowledge       - %s)
        WHERE status = 'active'
    """, (caff_decay, social_decay, knowledge_decay))

    # Passive social recovery: if social_vitality dropped below 25, give +2/hour
    # so devs don't get stuck at 0 and unable to hack (hack_raid requires ≥15).
    # Effective net change below the threshold: -1 (decay) + 2 (recovery) = +1/hour.
    # At or above 25, recovery is skipped and only decay applies.
    # Threshold is 10 points above the hack minimum (15) so the player has a
    # comfortable buffer before getting locked out again. Runs AFTER decay so
    # a dev that ticks 25→24 gets bumped back to 25 in the same cycle (stable).
    cur.execute("""
        UPDATE devs SET
            social_vitality = LEAST(25, social_vitality + 2)
        WHERE status = 'active'
          AND social_vitality < 25
    """)

    # Passive knowledge recovery: mirrors social recovery. Knowledge drives
    # the bug generation rate (<15 = +2 bugs/h, 15-29 = +1 bug/h, ≥30 = 0),
    # so keeping a floor of 30 cuts the SOURCE of the bug accumulation
    # problem instead of only treating the symptom via the fix_bugs item.
    # Net below 30: -1 (decay) + 2 (recovery) = +1/hour.
    cur.execute("""
        UPDATE devs SET
            knowledge = LEAST(30, knowledge + 2)
        WHERE status = 'active'
          AND knowledge < 30
    """)

    # Low knowledge penalty: generate extra bugs
    # knowledge < 15: +2 bugs/hour, knowledge 15-29: +1 bug/hour
    cur.execute("""
        UPDATE devs SET bugs_shipped = bugs_shipped + 2 WHERE status = 'active' AND knowledge < 15
    """)
    cur.execute("""
        UPDATE devs SET bugs_shipped = bugs_shipped + 1 WHERE status = 'active' AND knowledge >= 15 AND knowledge < 30
    """)

    if admin_log_event:
        admin_log_event(
            cur,
            event_type="salary_batch_paid",
            payload={
                "count": count,
                "effective_salary": effective_salary,
                "total_emitted": count * effective_salary,
                "event_multiplier": event_effects.get("salary_multiplier", 1.0),
            },
        )

    conn.commit()
    log.info(f"💰 Paid salary ({effective_salary} $NXT) to {count} devs + energy regen + PC wear")
    if log_info:
        log_info(
            log,
            "engine.salary_batch_paid",
            count=count,
            salary_nxt=effective_salary,
            amount_total=effective_salary * count,
        )
    return count


def take_balance_snapshots(conn):
    """Save daily balance snapshot for each player with devs. Run once per day."""
    cur = get_cursor(conn)
    cur.execute("""
        INSERT INTO balance_snapshots (wallet_address, balance_claimable, balance_claimed, balance_total_earned, snapshot_date)
        SELECT
            p.wallet_address,
            COALESCE(SUM(d.balance_nxt), 0),
            p.balance_claimed,
            p.balance_total_earned,
            CURRENT_DATE
        FROM players p
        LEFT JOIN devs d ON d.owner_address = p.wallet_address
        GROUP BY p.wallet_address, p.balance_claimed, p.balance_total_earned
        ON CONFLICT (wallet_address, snapshot_date) DO UPDATE SET
            balance_claimable = EXCLUDED.balance_claimable,
            balance_claimed = EXCLUDED.balance_claimed,
            balance_total_earned = EXCLUDED.balance_total_earned
    """)
    count = cur.rowcount
    conn.commit()
    log.info(f"📸 Saved balance snapshots for {count} players")
    return count


# ============================================================
# MINT A NEW DEV (called by blockchain listener)
# ============================================================

def mint_dev(conn, token_id: int, owner_address: str, corporation: str) -> dict:
    """Create a new dev in the DB after on-chain mint."""
    cur = get_cursor(conn)

    # Get existing names to avoid collision
    cur.execute("SELECT name FROM devs")
    existing = {r["name"] for r in cur.fetchall()}
    name = gen_dev_name(existing)

    # Random archetype (weighted)
    archetypes = list(ARCHETYPE_WEIGHTS.keys())
    weights = list(ARCHETYPE_WEIGHTS.values())
    archetype = random.choices(archetypes, weights=weights, k=1)[0]

    # Random rarity
    rarities = list(RARITY_WEIGHTS.keys())
    rarity_w = list(RARITY_WEIGHTS.values())
    rarity = random.choices(rarities, weights=rarity_w, k=1)[0]

    # Personality seed
    seed = random.getrandbits(64)

    # Visual traits
    visuals = gen_visual_traits(rarity)

    # Starting balance
    start_balance = STARTING_BALANCE.get(rarity, 2000)

    # Ensure player exists
    cur.execute("""
        INSERT INTO players (wallet_address, corporation)
        VALUES (%s, %s)
        ON CONFLICT (wallet_address) DO UPDATE SET
            total_devs_minted = players.total_devs_minted + 1,
            last_active_at = NOW()
    """, (owner_address, corporation))

    # Create dev
    cur.execute("""
        INSERT INTO devs (
            token_id, name, owner_address, archetype, corporation, rarity_tier,
            personality_seed, species, background, accessory, expression,
            special_effect, balance_nxt, total_earned
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (token_id, name, owner_address, archetype, corporation, rarity,
          seed, visuals["species"], visuals["background"], visuals["accessory"],
          visuals["expression"], visuals["special_effect"], start_balance, start_balance))

    # Update sim state
    cur.execute("""
        UPDATE simulation_state SET value = to_jsonb((value::int + 1)), updated_at = NOW()
        WHERE key = 'total_devs_minted'
    """)

    conn.commit()
    log.info(f"🎉 Minted dev #{token_id}: {name} ({archetype}, {rarity}) → {owner_address[:10]}...")

    return {
        "token_id": token_id, "name": name, "archetype": archetype,
        "corporation": corporation, "rarity": rarity, "visuals": visuals,
    }


# ============================================================
# MAIN LOOP
# ============================================================

_last_claim_sync_at = None   # ISO timestamp of last successful claim sync
_last_claim_sync_result = None  # "ok" / "no_pending" / error message


def get_claim_sync_status():
    """Return last sync metadata (used by the API status endpoint)."""
    return {
        "last_sync_at": _last_claim_sync_at,
        "last_result": _last_claim_sync_result,
    }


def run_claim_sync():
    """Run claim sync to push balances on-chain."""
    global _last_claim_sync_at, _last_claim_sync_result
    try:
        try:
            from claim_sync import sync_claimable_balances
        except ImportError:
            from backend.engine.claim_sync import sync_claimable_balances
        log.info("[CLAIM_SYNC] Starting sync...")
        result = sync_claimable_balances()
        _last_claim_sync_at = datetime.now(timezone.utc).isoformat()
        _last_claim_sync_result = result or "ok"
        log.info("[CLAIM_SYNC] Sync completed: %s", _last_claim_sync_result)
    except Exception as e:
        log.error("[CLAIM_SYNC] Error: %s", e, exc_info=True)
        _last_claim_sync_at = datetime.now(timezone.utc).isoformat()
        _last_claim_sync_result = f"error: {e}"


def check_and_rotate_weekly_event(conn):
    """Check if weekly event needs rotation. Insert new event if expired or none active."""
    cur = get_cursor(conn)
    cur.execute("""
        SELECT id, title, ends_at FROM world_events
        WHERE event_type = 'weekly' AND is_active = TRUE
        ORDER BY starts_at DESC LIMIT 1
    """)
    current = cur.fetchone()
    now = datetime.now(timezone.utc)

    if current and current["ends_at"] > now:
        return  # Still active

    # Never rotate out the permanent tester event
    if current and current["title"] == "MEGA TESTER PROGRAM":
        return

    # Expire old
    if current:
        cur.execute("UPDATE world_events SET is_active = FALSE WHERE id = %s", (current["id"],))

    # Pick new (avoid same as current)
    pool = [e for e in WEEKLY_EVENTS if not current or e["title"] != current["title"]]
    event = _random.choice(pool)

    starts = now
    ends = now + timedelta(days=7)
    cur.execute("""
        INSERT INTO world_events (title, description, event_type, effects, starts_at, ends_at, is_active)
        VALUES (%s, %s, 'weekly', %s, %s, %s, TRUE)
    """, (event["title"], event["description"], json.dumps(event["effects"]), starts, ends))

    # Notify all players
    cur.execute("SELECT DISTINCT wallet_address FROM players")
    for p in cur.fetchall():
        cur.execute("""
            INSERT INTO notifications (player_address, type, title, body)
            VALUES (%s, 'world_event', %s, %s)
        """, (p["wallet_address"],
              f"New Event: {event['title']}",
              f"{event['description']} (Active for 7 days)"))

    conn.commit()
    log.info(f"🌍 New weekly event: {event['title']}")


# ============================================================
# FUND RECONCILIATION — Resolves pending_fund_txs orphans
# ============================================================
#
# Context: /shop/fund occasionally can't fetch a just-sent tx receipt because
# the RPC node hasn't indexed it yet. Instead of 400'ing (and orphaning the
# user's on-chain $NXT), the endpoint persists the request in pending_fund_txs
# and returns "pending". This worker runs every ~5 minutes and resolves those
# rows: re-fetches the receipt, validates the Transfer event, credits the
# dev's balance_nxt, and inserts into funding_txs. Dedup is guaranteed by
# funding_txs.tx_hash UNIQUE.

_FUND_RPC_URL = os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc")
_FUND_NXT_TOKEN = "0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47".lower()
_FUND_TREASURY = "0x31d6E19aAE43B5E2fbeDb01b6FF82AD1e8B576DC".lower()
_FUND_TRANSFER_TOPIC = (
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
)

# Pending-fund retry policy.
#   _FUND_RETRY_INTERVAL_SEC — how often the worker polls the table
#     for rows ready to retry (F1: was 300s, now 30s → worst-case
#     user-visible latency drops from ~6min to ~90s).
#   _FUND_SLOW_RETRY_AFTER — number of attempts after which we switch
#     to a slower backoff bucket; the worker never abandons a row,
#     it just retries less often (F3: replaces the old
#     _FUND_MAX_ATTEMPTS=10 hard cap).
#   _FUND_ALERT_AT_ATTEMPT — first attempt at which admin_logs gets
#     a one-shot alert that this tx has been stuck a long time.
_FUND_RETRY_INTERVAL_SEC = 30
_FUND_SLOW_RETRY_AFTER = 10        # attempts 0..9 run on the fast bucket
_FUND_MEDIUM_RETRY_AFTER = 20      # 10..19 every 2min, 20+ every 30min
_FUND_ALERT_AT_ATTEMPT = 20
_FUND_MEDIUM_BACKOFF_MIN = 2
_FUND_SLOW_BACKOFF_MIN = 30

# Legacy name kept only for backward-compat; nothing reads it anymore.
_FUND_MAX_ATTEMPTS = 10

# ── Orphan scan worker ─────────────────────────────────────
# Runs eth_getLogs every 30 min looking for Transfer(*, TREASURY) events
# that never made it into funding_txs or pending_fund_txs (e.g. the
# frontend crashed between signing and POSTing the hash to the backend).
# Complements process_pending_funds: that one resolves txs the backend
# DID see, this one catches the ones it didn't.
_ORPHAN_SCAN_INTERVAL = timedelta(minutes=30)
_ORPHAN_SCAN_WINDOW = 500_000  # blocks back from head to scan
_ORPHAN_SCAN_CHUNK = 10_000    # blocks per eth_getLogs call


def _fund_rpc(method, params):
    """Minimal JSON-RPC call for the fund reconciler. Returns None on any
    error so the worker keeps running across individual RPC hiccups."""
    try:
        r = requests.post(
            _FUND_RPC_URL,
            json={"jsonrpc": "2.0", "method": method, "params": params, "id": 1},
            timeout=15,
        )
        data = r.json()
        if "error" in data:
            return None
        return data.get("result")
    except Exception:
        return None


def _mark_pending_resolved(cur, row_id, error_msg=None):
    """Flag a pending_fund_txs row as resolved with an optional reason."""
    cur.execute(
        """UPDATE pending_fund_txs
              SET resolved = true,
                  resolved_at = NOW(),
                  last_error = %s
            WHERE id = %s""",
        (error_msg, row_id),
    )


def _compute_next_retry_at(next_attempts: int, now=None):
    """Return the TIMESTAMPTZ a row should be retried at after we just
    bumped its ``attempts`` to ``next_attempts``.

    Fast bucket (0-9 attempts) matches the worker's poll interval, so
    a stuck row is tried every ~30s. Medium bucket (10-19) backs off to
    2 minutes, slow bucket (20+) to 30 minutes. The row is never
    skipped permanently — that was the silent-abandonment bug.
    """
    now = now or datetime.now(timezone.utc)
    if next_attempts < _FUND_SLOW_RETRY_AFTER:
        return now + timedelta(seconds=_FUND_RETRY_INTERVAL_SEC)
    if next_attempts < _FUND_MEDIUM_RETRY_AFTER:
        return now + timedelta(minutes=_FUND_MEDIUM_BACKOFF_MIN)
    return now + timedelta(minutes=_FUND_SLOW_BACKOFF_MIN)


def _bump_pending_fund_attempt(cur, row_id, next_attempts, last_error=None):
    """Single UPDATE that advances attempts + last_attempt_at +
    next_retry_at, all in one place so backoff math can't drift across
    call sites."""
    cur.execute(
        """
        UPDATE pending_fund_txs
           SET attempts        = %s,
               last_attempt_at = NOW(),
               next_retry_at   = %s,
               last_error      = COALESCE(%s, last_error)
         WHERE id = %s
        """,
        (next_attempts, _compute_next_retry_at(next_attempts), last_error, row_id),
    )


def _maybe_alert_stuck_pending(cur, row, next_attempts):
    """One-shot admin_logs alert the first time a row crosses the slow
    backoff threshold. Fires exactly once because the check is on
    equality with _FUND_ALERT_AT_ATTEMPT."""
    if next_attempts != _FUND_ALERT_AT_ATTEMPT:
        return
    if admin_log_event is None:
        return
    try:
        created_at = row["created_at"] if isinstance(row, dict) else row[-1]
    except Exception:  # noqa: BLE001
        created_at = None
    age_minutes = None
    if created_at is not None:
        try:
            age_minutes = (datetime.now(timezone.utc) - created_at).total_seconds() / 60
        except Exception:  # noqa: BLE001
            age_minutes = None
    try:
        admin_log_event(
            cur,
            event_type="pending_fund_tx_slow_retry_threshold",
            wallet_address=row["wallet_address"],
            dev_token_id=row["dev_token_id"],
            payload={
                "tx_hash": row["tx_hash"],
                "amount_nxt": int(row["amount_nxt"]),
                "attempts": next_attempts,
                "age_minutes": age_minutes,
            },
        )
    except Exception as _e:  # noqa: BLE001
        log.warning("pending_fund_alert_failed error=%s", _e)


def process_pending_funds(conn):
    """Resolve pending_fund_txs rows whose RPC receipt is now available.

    Each cycle selects rows whose ``next_retry_at`` has passed (or is
    NULL — newly inserted rows). For each row:
      - Dedup: if tx_hash is already in funding_txs (live path won the
        race or backfill script already ran), mark resolved and skip.
      - Fetch receipt; if still null, bump attempts + schedule next
        retry according to the backoff curve.
      - If tx reverted on-chain (status != 0x1), mark resolved (never
        credit).
      - Otherwise apply the same verification rules as shop.py fund_dev
        and credit.

    The worker never abandons a row (F3) — it just retries less often
    once attempts cross the slow bucket threshold, with a one-shot
    admin_logs alert on the 19→20 transition.
    """
    cur = get_cursor(conn)
    cur.execute(
        """
        SELECT id, tx_hash, wallet_address, dev_token_id, amount_nxt,
               attempts, created_at
          FROM pending_fund_txs
         WHERE resolved = false
           AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         ORDER BY created_at ASC
         LIMIT 50
        """
    )
    rows = cur.fetchall()
    if not rows:
        return

    log.info(f"🔄 process_pending_funds: {len(rows)} pending tx(s) to check")

    for row in rows:
        tx_hash = row["tx_hash"]
        wallet = row["wallet_address"].lower()
        dev_id = row["dev_token_id"]
        amount_requested = int(row["amount_nxt"])

        try:
            # Always bump attempts first so a crash doesn't loop forever.
            # Also schedule the next retry slot up-front — if anything
            # below raises, the row stays in the right backoff bucket
            # instead of getting retried immediately next cycle.
            next_attempts = int(row["attempts"]) + 1
            _bump_pending_fund_attempt(cur, row["id"], next_attempts)
            _maybe_alert_stuck_pending(cur, row, next_attempts)

            # Dedup: if the live path already credited this tx, stop here.
            cur.execute("SELECT 1 FROM funding_txs WHERE tx_hash = %s", (tx_hash,))
            if cur.fetchone():
                _mark_pending_resolved(cur, row["id"],
                                       "already credited via live path")
                conn.commit()
                continue

            receipt = _fund_rpc("eth_getTransactionReceipt", [tx_hash])
            if not receipt:
                # Still not indexed — persist the attempt bump and try again
                # next cycle.
                conn.commit()
                continue

            if receipt.get("status") != "0x1":
                _mark_pending_resolved(cur, row["id"], "tx reverted on-chain")
                conn.commit()
                log.warning(f"  pending {tx_hash[:10]}… REVERTED on-chain, skipped")
                continue

            if (receipt.get("to") or "").lower() != _FUND_NXT_TOKEN:
                _mark_pending_resolved(cur, row["id"], "tx is not an NXT transfer")
                conn.commit()
                continue

            if (receipt.get("from") or "").lower() != wallet:
                _mark_pending_resolved(cur, row["id"], "tx sender mismatch")
                conn.commit()
                continue

            # Find the Transfer log from wallet -> treasury
            verified_wei = None
            for log_entry in (receipt.get("logs") or []):
                topics = log_entry.get("topics") or []
                if len(topics) >= 3 and topics[0] == _FUND_TRANSFER_TOPIC:
                    log_from = ("0x" + topics[1][-40:]).lower()
                    log_to = ("0x" + topics[2][-40:]).lower()
                    if log_from == wallet and log_to == _FUND_TREASURY:
                        verified_wei = int(log_entry.get("data", "0x0"), 16)
                        break

            if verified_wei is None:
                _mark_pending_resolved(cur, row["id"],
                                       "no Transfer event to treasury")
                conn.commit()
                continue

            verified_nxt = verified_wei // (10 ** 18)
            if verified_nxt < amount_requested:
                _mark_pending_resolved(cur, row["id"],
                                       "on-chain amount < requested")
                conn.commit()
                continue

            credit_amount = verified_nxt

            cur.execute(
                "SELECT name, archetype FROM devs WHERE token_id = %s",
                (dev_id,),
            )
            dev = cur.fetchone()
            if not dev:
                _mark_pending_resolved(cur, row["id"], "dev not found")
                conn.commit()
                continue

            # Credit — mirrors shop.py fund_dev success path
            cur.execute(
                """INSERT INTO funding_txs
                     (wallet_address, dev_token_id, amount_nxt, tx_hash, verified)
                   VALUES (%s, %s, %s, %s, true)""",
                (wallet, dev_id, credit_amount, tx_hash),
            )
            cur.execute(
                "UPDATE devs SET balance_nxt = balance_nxt + %s, "
                "total_earned = total_earned + %s WHERE token_id = %s",
                (credit_amount, credit_amount, dev_id),
            )

            # Shadow-write to nxt_ledger (Fase 3B, unified in follow-up).
            # All three fund_deposit paths (pending here, orphan
            # scanner, shop.fund_dev) use the same idempotency key
            # shape — (FUND_DEPOSIT, "funding_txs", tx_hash_to_bigint) —
            # so a tx that passes through more than one path collides
            # on UNIQUE(idempotency_key) and produces exactly one
            # ledger row. funding_txs.tx_hash is UNIQUE in the DB,
            # which guarantees no false sharing of this key across
            # distinct deposits.
            if is_shadow_write_enabled() and ledger_insert is not None and tx_hash_to_bigint is not None:
                try:
                    ledger_insert(
                        cur,
                        wallet_address=wallet,
                        dev_token_id=dev_id,
                        delta_nxt=credit_amount,
                        source=LedgerSource.FUND_DEPOSIT,
                        ref_table="funding_txs",
                        ref_id=tx_hash_to_bigint(tx_hash),
                    )
                except Exception as _e:  # noqa: BLE001
                    log.warning(
                        "ledger_shadow_write_failed source=fund_deposit_pending "
                        "pending_id=%s error=%s",
                        row["id"], _e,
                    )

            cur.execute(
                """INSERT INTO actions
                     (dev_id, dev_name, archetype, action_type, details,
                      energy_cost, nxt_cost)
                   VALUES (%s, %s, %s, 'FUND_DEV', %s::jsonb, 0, 0)""",
                (
                    dev_id,
                    dev["name"],
                    dev["archetype"],
                    json.dumps({
                        "event": "fund_dev",
                        "amount": credit_amount,
                        "tx_hash": tx_hash,
                        "source": "pending_fund_worker",
                    }),
                ),
            )
            _mark_pending_resolved(cur, row["id"], None)
            conn.commit()
            log.info(
                f"  ✅ resolved pending {tx_hash[:10]}… → dev #{dev_id} "
                f"+{credit_amount} $NXT"
            )

        except Exception as e:
            conn.rollback()
            log.error(f"  ❌ error processing pending {tx_hash[:10]}…: {e}")
            # Best-effort write in a fresh tx. The rollback above also
            # rolled back the attempts bump, so we redo it here — keeps
            # the backoff curve correct even when a row errors.
            try:
                next_attempts = int(row["attempts"]) + 1
                _bump_pending_fund_attempt(
                    cur, row["id"], next_attempts, last_error=str(e)[:500],
                )
                _maybe_alert_stuck_pending(cur, row, next_attempts)
                conn.commit()
            except Exception:
                conn.rollback()


def scan_orphaned_funds(conn):
    """Scan the last _ORPHAN_SCAN_WINDOW blocks for Transfer(*, TREASURY)
    events that aren't already tracked in funding_txs or pending_fund_txs,
    and credit them automatically.

    This is the last safety net in the fund-dev recovery chain:
      - Live path (shop.py /fund): credits immediately when RPC returns
      - pending_fund_txs + process_pending_funds: resolves txs the backend
        saw but couldn't verify in 60s
      - scan_orphaned_funds (this): catches txs the backend NEVER saw,
        e.g. the frontend crashed after signing but before POSTing the hash

    Ambiguous sender (wallet owns >1 dev) auto-credits the most recently
    active dev (last_action_at DESC, tie-broken by token_id ASC) — the
    wallet can always rebalance via /shop/transfer, but picking the active
    dev minimises the chance of stranding funds on a dormant token.

    Dedup is layered:
      1. Check funding_txs.tx_hash before inserting
      2. Check pending_fund_txs.tx_hash before inserting
      3. funding_txs.tx_hash UNIQUE constraint as final guarantee
    """
    cur = get_cursor(conn)

    try:
        head_hex = _fund_rpc("eth_blockNumber", [])
        if not head_hex:
            log.warning("scan_orphaned_funds: could not get chain head")
            return 0

        head = int(head_hex, 16)
        from_block = max(0, head - _ORPHAN_SCAN_WINDOW)

        log.info(f"🔍 scan_orphaned_funds: scanning blocks {from_block}→{head}")

        # Pre-padded `to` topic: 12-byte left pad + 20-byte address
        treasury_topic = "0x" + "0" * 24 + _FUND_TREASURY[2:]

        all_events = []
        current = from_block
        while current <= head:
            chunk_end = min(current + _ORPHAN_SCAN_CHUNK - 1, head)
            result = _fund_rpc("eth_getLogs", [{
                "fromBlock": hex(current),
                "toBlock": hex(chunk_end),
                "address": _FUND_NXT_TOKEN,
                "topics": [
                    _FUND_TRANSFER_TOPIC,
                    None,             # any sender
                    treasury_topic,   # to treasury
                ],
            }])
            if result and isinstance(result, list):
                all_events.extend(result)
            current = chunk_end + 1

        if not all_events:
            log.info("  scan_orphaned_funds: no Transfer events found")
            return 0

        log.info(
            f"  scan_orphaned_funds: found {len(all_events)} Transfer "
            f"event(s) to treasury"
        )

        credited = 0
        skipped = 0

        for event in all_events:
            tx_hash = (event.get("transactionHash") or "").lower()
            if not tx_hash:
                continue

            # Dedup layer 1: already credited by the live path or an earlier scan
            cur.execute("SELECT 1 FROM funding_txs WHERE tx_hash = %s", (tx_hash,))
            if cur.fetchone():
                skipped += 1
                continue

            # Dedup layer 2: already queued by the /fund endpoint and owned
            # by process_pending_funds. Let that worker handle it.
            cur.execute(
                "SELECT 1 FROM pending_fund_txs WHERE tx_hash = %s",
                (tx_hash,),
            )
            if cur.fetchone():
                skipped += 1
                continue

            topics = event.get("topics") or []
            if len(topics) < 3:
                continue

            sender = ("0x" + topics[1][-40:]).lower()
            amount_wei = int(event.get("data", "0x0"), 16)
            amount_nxt = amount_wei // (10 ** 18)

            if amount_nxt <= 0:
                continue

            # Skip zero-address sender (mint / bridge). Never credits.
            if sender == "0x" + "0" * 40:
                continue

            cur.execute(
                "SELECT token_id, name, archetype, last_action_at "
                "FROM devs WHERE owner_address = %s "
                "ORDER BY last_action_at DESC NULLS LAST, token_id ASC",
                (sender,),
            )
            devs = cur.fetchall() or []

            if not devs:
                log.info(
                    f"  orphan {tx_hash[:10]}… from {sender[:8]}… — "
                    f"wallet owns no devs, skipping"
                )
                continue

            dev = devs[0]
            total_devs_count = len(devs)

            if total_devs_count > 1 and admin_log_event is not None:
                admin_log_event(
                    cur,
                    event_type="orphan_scanner_disambiguated_dev",
                    wallet_address=sender,
                    dev_token_id=dev["token_id"],
                    payload={
                        "tx_hash": tx_hash,
                        "chosen_dev_token_id": dev["token_id"],
                        "total_devs_in_wallet": total_devs_count,
                        "heuristic": "most_recent_action",
                        "amount_nxt": str(amount_nxt),
                    },
                )

            try:
                cur.execute(
                    """INSERT INTO funding_txs
                         (wallet_address, dev_token_id, amount_nxt, tx_hash, verified)
                       VALUES (%s, %s, %s, %s, true)""",
                    (sender, dev["token_id"], amount_nxt, tx_hash),
                )
                cur.execute(
                    "UPDATE devs SET balance_nxt = balance_nxt + %s, "
                    "total_earned = total_earned + %s WHERE token_id = %s",
                    (amount_nxt, amount_nxt, dev["token_id"]),
                )

                # Shadow-write to nxt_ledger (Fase 3B, unified in
                # follow-up). Shares idempotency key shape with the
                # other two fund_deposit paths (pending_funds,
                # shop.fund_dev), so a tx that reaches multiple paths
                # only produces one ledger row.
                if is_shadow_write_enabled() and ledger_insert is not None and tx_hash_to_bigint is not None:
                    try:
                        ledger_insert(
                            cur,
                            wallet_address=sender,
                            dev_token_id=dev["token_id"],
                            delta_nxt=amount_nxt,
                            source=LedgerSource.FUND_DEPOSIT,
                            ref_table="funding_txs",
                            ref_id=tx_hash_to_bigint(tx_hash),
                        )
                    except Exception as _e:  # noqa: BLE001
                        log.warning(
                            "ledger_shadow_write_failed source=fund_deposit_orphan "
                            "tx_hash=%s error=%s",
                            tx_hash, _e,
                        )

                cur.execute(
                    """INSERT INTO actions
                         (dev_id, dev_name, archetype, action_type, details,
                          energy_cost, nxt_cost)
                       VALUES (%s, %s, %s, 'FUND_DEV', %s::jsonb, 0, 0)""",
                    (
                        dev["token_id"],
                        dev["name"],
                        dev["archetype"],
                        json.dumps({
                            "event": "fund_dev",
                            "amount": amount_nxt,
                            "tx_hash": tx_hash,
                            "source": "orphan_scan_worker",
                        }),
                    ),
                )
                conn.commit()
                credited += 1
                log.info(
                    f"  ✅ orphan credited: {tx_hash[:10]}… → dev "
                    f"#{dev['token_id']} ({dev['name']}) +{amount_nxt} $NXT"
                )
            except Exception as e:
                conn.rollback()
                log.error(
                    f"  ❌ failed to credit orphan {tx_hash[:10]}…: {e}"
                )

        log.info(
            f"  scan_orphaned_funds complete: credited={credited}, "
            f"already_recorded={skipped}"
        )
        return credited

    except Exception as e:
        log.error(f"scan_orphaned_funds error: {e}")
        return 0


def run_engine():
    """Main simulation loop. Runs forever."""
    log.info("=" * 60)
    log.info("  NX TERMINAL: PROTOCOL WARS — Engine v2")
    log.info("  100% sin LLM · Weighted Random · PostgreSQL")
    log.info("=" * 60)

    cycle = 0
    salary_interval = timedelta(hours=SALARY_INTERVAL_HOURS)
    snapshot_interval = timedelta(hours=24)
    claim_sync_interval = timedelta(minutes=5)  # kept for reference; auto-sync disabled
    pending_funds_interval = timedelta(seconds=_FUND_RETRY_INTERVAL_SEC)
    orphan_scan_interval = _ORPHAN_SCAN_INTERVAL
    nxmarket_close_interval = timedelta(minutes=5)

    # Auto-migrate new columns before any queries
    try:
        with get_db() as conn:
            cur = get_cursor(conn)
            cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS caffeine SMALLINT NOT NULL DEFAULT 50")
            cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS social_vitality SMALLINT NOT NULL DEFAULT 50")
            cur.execute("ALTER TABLE devs ADD COLUMN IF NOT EXISTS knowledge SMALLINT NOT NULL DEFAULT 50")
            # pending_fund_txs — fallback queue for RPC indexing lag on /shop/fund
            cur.execute("""
                CREATE TABLE IF NOT EXISTS pending_fund_txs (
                    id               SERIAL PRIMARY KEY,
                    tx_hash          TEXT UNIQUE NOT NULL,
                    wallet_address   TEXT NOT NULL,
                    dev_token_id     INT NOT NULL,
                    amount_nxt       NUMERIC NOT NULL,
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    resolved         BOOLEAN NOT NULL DEFAULT false,
                    resolved_at      TIMESTAMPTZ,
                    attempts         INT NOT NULL DEFAULT 0,
                    last_attempt_at  TIMESTAMPTZ,
                    last_error       TEXT
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_pending_fund_unresolved
                    ON pending_fund_txs(resolved, created_at)
                    WHERE resolved = false
            """)
            # Backoff column (Fix-A). Legacy rows get NULL which the
            # worker treats as "eligible immediately".
            cur.execute(
                "ALTER TABLE pending_fund_txs "
                "ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ"
            )
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_pending_funds_next_retry
                    ON pending_fund_txs(next_retry_at)
                    WHERE resolved = false
            """)
            # chat_messages enrichment for the Live Feed redesign —
            # chat_type drives the UI badge, social_gain the "+N social" note.
            cur.execute("""
                ALTER TABLE chat_messages
                ADD COLUMN IF NOT EXISTS chat_type VARCHAR(20) NOT NULL DEFAULT 'idle'
            """)
            cur.execute("""
                ALTER TABLE chat_messages
                ADD COLUMN IF NOT EXISTS social_gain SMALLINT NOT NULL DEFAULT 0
            """)
            conn.commit()
            log.info("✅ Engine auto-migrations complete")
    except Exception as e:
        log.warning(f"⚠️ Engine auto-migration warning: {e}")

    # Pay salary immediately on startup so devs don't wait 1 hour after restart
    try:
        with get_db() as conn:
            pay_salaries(conn)
            log.info("💰 Initial salary paid on engine startup")
    except Exception as e:
        log.error(f"Initial salary payment failed: {e}")

    # Run the orphan scanner immediately at startup — catches any
    # Transfer(*, TREASURY) events accumulated while the engine was
    # down (deploy, crash, maintenance). Non-blocking: a failure here
    # is logged but can never prevent the engine from entering its
    # main loop, where the periodic scan will eventually retry.
    try:
        with get_db() as conn:
            credited = scan_orphaned_funds(conn) or 0
            log.info(
                f"🧹 Startup orphan scan complete: credited={credited}"
            )
            if admin_log_event is not None:
                with conn.cursor() as cur:
                    admin_log_event(
                        cur,
                        event_type="engine_startup_orphan_scan",
                        payload={"orphans_credited": credited},
                    )
    except Exception as e:
        log.error(f"Startup orphan scan failed (non-fatal): {e}")

    last_salary = datetime.now(timezone.utc)
    last_snapshot = datetime.now(timezone.utc)
    # Run pending-fund reconciliation on the first loop pass.
    last_pending_funds = datetime.now(timezone.utc) - pending_funds_interval
    # Run on-chain orphan scan on the first loop pass too.
    last_orphan_scan = datetime.now(timezone.utc) - orphan_scan_interval
    # Run the NX Market auto-close sweep on the first pass too (catch
    # any market that expired while the engine was down).
    last_nxmarket_close = datetime.now(timezone.utc) - nxmarket_close_interval

    while True:
        # Fresh correlation id per engine tick so every log emitted by the
        # worker during this iteration shares the same id and is traceable.
        _tick_cid_token = None
        if set_correlation_id and new_correlation_id:
            _tick_cid_token = set_correlation_id(new_correlation_id())
        try:
            with get_db() as conn:
                # Pay salaries if due
                now = datetime.now(timezone.utc)
                if now - last_salary >= salary_interval:
                    pay_salaries(conn)
                    last_salary = now

                # Check weekly event rotation
                check_and_rotate_weekly_event(conn)

                # Daily balance snapshots
                if now - last_snapshot >= snapshot_interval:
                    take_balance_snapshots(conn)
                    last_snapshot = now

                # Reconcile pending fund txs (RPC indexing lag fallback)
                if now - last_pending_funds >= pending_funds_interval:
                    try:
                        process_pending_funds(conn)
                    except Exception as e:
                        log.error(f"process_pending_funds error: {e}")
                    last_pending_funds = now

                # Scan on-chain for orphaned fund transfers (safety net for
                # hashes the backend never saw — e.g. frontend crashed
                # between signing and POSTing the hash).
                if now - last_orphan_scan >= orphan_scan_interval:
                    try:
                        scan_orphaned_funds(conn)
                    except Exception as e:
                        log.error(f"scan_orphaned_funds error: {e}")
                    last_orphan_scan = now

                # Flip expired NX Market rows from 'active' → 'closed'.
                # Runs on its own 5-min cadence. Independent of the
                # `conn` above because it manages its own DB context.
                if now - last_nxmarket_close >= nxmarket_close_interval:
                    try:
                        from backend.services.nxmarket_lifecycle import (
                            auto_close_expired_markets,
                        )
                        auto_close_expired_markets()
                    except Exception as e:
                        log.error(f"auto_close_expired_markets error: {e}")
                    last_nxmarket_close = now

                # Process due devs
                processed = run_scheduler_tick(conn)
                if processed > 0:
                    cycle += 1
                    if cycle % 10 == 0:
                        log.info(f"📊 Cycle {cycle} — Processed {processed} devs this tick")

        except Exception as e:
            log.error(f"Engine error: {e}")
        finally:
            if _tick_cid_token is not None and reset_correlation_id:
                reset_correlation_id(_tick_cid_token)

        time.sleep(SCHEDULER_INTERVAL_SEC)


# ============================================================
# CLI — For testing without full stack
# ============================================================

def seed_test_devs(n: int = 5):
    """Seed N test devs for local testing."""
    corps = list(ARCHETYPE_WEIGHTS.keys())
    with get_db() as conn:
        for i in range(1, n + 1):
            corp = random.choice(["CLOSED_AI", "MISANTHROPIC", "SHALLOW_MIND",
                                  "ZUCK_LABS", "Y_AI", "MISTRIAL_SYSTEMS"])
            mint_dev(conn, token_id=i, owner_address=f"0x{'0' * 38}{i:02d}", corporation=corp)
    log.info(f"✅ Seeded {n} test devs")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "seed":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        seed_test_devs(n)
    elif len(sys.argv) > 1 and sys.argv[1] == "salary":
        with get_db() as conn:
            pay_salaries(conn)
    else:
        run_engine()
