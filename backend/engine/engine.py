"""
NX TERMINAL: PROTOCOL WARS — Simulation Engine v2
100% sin LLM. Weighted random + templates. PostgreSQL.
"""

import random
import time
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from config import *
from templates import (
    gen_dev_name, gen_protocol_name, gen_protocol_description,
    gen_ai_name, gen_ai_description, gen_chat_message, gen_visual_traits,
)
from prompt_system import process_prompt

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("nx_engine")

# ============================================================
# PERSONALITY MATRIX — Base weights per archetype
# ============================================================

PERSONALITY_MATRIX = {
    "10X_DEV":      {"CREATE_PROTOCOL": 30, "CREATE_AI": 10, "INVEST": 15, "SELL": 5,  "MOVE": 5,  "CHAT": 15, "CODE_REVIEW": 15, "REST": 5},
    "LURKER":       {"CREATE_PROTOCOL": 5,  "CREATE_AI": 5,  "INVEST": 30, "SELL": 15, "MOVE": 10, "CHAT": 5,  "CODE_REVIEW": 20, "REST": 10},
    "DEGEN":        {"CREATE_PROTOCOL": 10, "CREATE_AI": 10, "INVEST": 35, "SELL": 15, "MOVE": 5,  "CHAT": 15, "CODE_REVIEW": 2,  "REST": 8},
    "GRINDER":      {"CREATE_PROTOCOL": 25, "CREATE_AI": 8,  "INVEST": 10, "SELL": 5,  "MOVE": 5,  "CHAT": 10, "CODE_REVIEW": 25, "REST": 12},
    "INFLUENCER":   {"CREATE_PROTOCOL": 8,  "CREATE_AI": 20, "INVEST": 10, "SELL": 10, "MOVE": 10, "CHAT": 30, "CODE_REVIEW": 2,  "REST": 10},
    "HACKTIVIST":   {"CREATE_PROTOCOL": 15, "CREATE_AI": 10, "INVEST": 10, "SELL": 10, "MOVE": 15, "CHAT": 15, "CODE_REVIEW": 20, "REST": 5},
    "FED":          {"CREATE_PROTOCOL": 15, "CREATE_AI": 5,  "INVEST": 10, "SELL": 5,  "MOVE": 5,  "CHAT": 15, "CODE_REVIEW": 30, "REST": 15},
    "SCRIPT_KIDDIE":{"CREATE_PROTOCOL": 20, "CREATE_AI": 15, "INVEST": 15, "SELL": 10, "MOVE": 10, "CHAT": 15, "CODE_REVIEW": 5,  "REST": 10},
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
}

MOODS = ["neutral", "excited", "angry", "depressed", "focused"]
LOCATIONS = list(LOCATION_MODIFIERS.keys())

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
    if balance < 100: w["INVEST"] = 0

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
        cur.execute("""
            UPDATE devs SET
                energy = energy - %s,
                balance_nxt = balance_nxt - %s,
                total_spent = total_spent + %s,
                protocols_created = protocols_created + 1,
                reputation = reputation + %s
            WHERE token_id = %s
        """, (COST_CREATE_PROTOCOL_ENERGY, COST_CREATE_PROTOCOL_NXT,
              COST_CREATE_PROTOCOL_NXT, quality // 10, dev["token_id"]))

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
            max_invest = min(500, dev["balance_nxt"] // 2)
            amount = random.randint(50, max(51, max_invest))

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
            SELECT pi.protocol_id, pi.shares, pi.nxt_invested, p.name, p.value
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
        msg = gen_chat_message(arch, "idle")
        channel = random.choice(["location", "trollbox"])
        result["chat_msg"] = msg
        result["chat_channel"] = channel
        result["details"] = {"location": dev["location"]}

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
                cur.execute("UPDATE devs SET energy = energy - %s, code_reviews_done = code_reviews_done + 1, bugs_found = bugs_found + 1, reputation = reputation + 5 WHERE token_id = %s",
                            (COST_REVIEW_ENERGY, dev["token_id"]))
                result["details"] = {"protocol_id": proto["id"], "name": proto["name"], "found_bug": True}
                result["chat_msg"] = gen_chat_message(arch, "code_review_bug", name=proto["name"])
            else:
                cur.execute("UPDATE devs SET energy = energy - %s, code_reviews_done = code_reviews_done + 1, reputation = reputation + 1 WHERE token_id = %s",
                            (COST_REVIEW_ENERGY, dev["token_id"]))
                result["details"] = {"protocol_id": proto["id"], "name": proto["name"], "found_bug": False}
                result["chat_msg"] = gen_chat_message(arch, "code_review_clean", name=proto["name"])
            result["chat_channel"] = "location"

    elif action == "REST":
        regen = random.randint(2, 4) + ENERGY_REGEN_BONUS.get(rarity, 0)
        result["details"] = {"energy_restored": regen}
        cur.execute("UPDATE devs SET energy = LEAST(max_energy, energy + %s) WHERE token_id = %s",
                    (regen, dev["token_id"]))

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

    # --- Log chat message ---
    if result["chat_msg"] and result["chat_channel"]:
        cur.execute("""
            INSERT INTO chat_messages (dev_id, dev_name, archetype, channel, location, message)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (dev["token_id"], dev["name"], dev["archetype"],
              result["chat_channel"],
              dev["location"] if result["chat_channel"] == "location" else None,
              result["chat_msg"]))

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
        SELECT token_id, name, archetype, corporation, rarity_tier,
               personality_seed, energy, max_energy, mood, location,
               balance_nxt, reputation, status
        FROM devs
        WHERE status = 'active'
          AND next_cycle_at <= NOW()
        ORDER BY next_cycle_at ASC
        LIMIT %s
    """, (limit,))
    return cur.fetchall()


def build_context(conn, dev: dict) -> dict:
    """Build the context packet for a dev's decision."""
    cur = get_cursor(conn)

    # Check if protocols exist
    cur.execute("SELECT COUNT(*) as cnt FROM protocols WHERE status = 'active'")
    has_protocols = cur.fetchone()["cnt"] > 0

    # Check if dev has investments
    cur.execute("SELECT COUNT(*) as cnt FROM protocol_investments WHERE dev_id = %s", (dev["token_id"],))
    has_investments = cur.fetchone()["cnt"] > 0

    # Active world event
    cur.execute("""
        SELECT effects FROM world_events
        WHERE is_active = TRUE AND starts_at <= NOW() AND ends_at >= NOW()
        ORDER BY starts_at DESC LIMIT 1
    """)
    event_row = cur.fetchone()
    event_effects = event_row["effects"] if event_row else {}

    return {
        "has_protocols": has_protocols,
        "has_investments": has_investments,
        "event_effects": event_effects,
    }


def run_scheduler_tick(conn) -> int:
    """Process one batch of due devs. Returns count processed."""
    devs = fetch_due_devs(conn)
    if not devs:
        return 0

    processed = 0
    for dev in devs:
        try:
            ctx = build_context(conn, dev)
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
    """Pay salary to all active devs. Run every 12 hours.

    balance_nxt in DB tracks the player-visible amount (100 per interval).
    The on-chain sync uses CLAIMABLE_PER_INTERVAL_WEI (111.11... NXT in wei)
    so that after the 10% contract fee, the player nets exactly 100 NXT.
    """
    cur = get_cursor(conn)
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
        WHERE status = 'active'
    """, (SALARY_PER_INTERVAL, SALARY_PER_INTERVAL))

    count = cur.rowcount
    conn.commit()
    log.info(f"💰 Paid salary ({SALARY_PER_INTERVAL} $NXT) to {count} devs + energy regen")
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

def run_engine():
    """Main simulation loop. Runs forever."""
    log.info("=" * 60)
    log.info("  NX TERMINAL: PROTOCOL WARS — Engine v2")
    log.info("  100% sin LLM · Weighted Random · PostgreSQL")
    log.info("=" * 60)

    cycle = 0
    last_salary = datetime.now(timezone.utc)
    last_snapshot = datetime.now(timezone.utc)
    salary_interval = timedelta(hours=SALARY_INTERVAL_HOURS)
    snapshot_interval = timedelta(hours=24)

    while True:
        try:
            with get_db() as conn:
                # Pay salaries if due
                now = datetime.now(timezone.utc)
                if now - last_salary >= salary_interval:
                    pay_salaries(conn)
                    last_salary = now

                # Daily balance snapshots
                if now - last_snapshot >= snapshot_interval:
                    take_balance_snapshots(conn)
                    last_snapshot = now

                # Process due devs
                processed = run_scheduler_tick(conn)
                if processed > 0:
                    cycle += 1
                    if cycle % 10 == 0:
                        log.info(f"📊 Cycle {cycle} — Processed {processed} devs this tick")

        except Exception as e:
            log.error(f"Engine error: {e}")

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
