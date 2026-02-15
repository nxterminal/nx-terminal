#!/usr/bin/env python3
"""
NX TERMINAL: PROTOCOL WARS — Engine v2 Test Runner
===================================================
Usa SQLite para demo local. Producción usa PostgreSQL.
Misma lógica, mismas reglas, cero LLM, cero costo.

Ejecutar: python3 test_engine.py
"""

import sqlite3
import random
import time
import json
from datetime import datetime, timedelta
from pathlib import Path

# Importar templates y config
import sys
sys.path.insert(0, str(Path(__file__).parent))
from templates import *
from config import *

# ============================================================
# PERSONALITY MATRIX
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

LOCATIONS = list(LOCATION_MODIFIERS.keys())
MOODS = ["neutral", "excited", "angry", "depressed", "focused"]
RARITY_LIST = list(RARITY_WEIGHTS.keys())
RARITY_W = list(RARITY_WEIGHTS.values())
ARCH_LIST = list(ARCHETYPE_WEIGHTS.keys())
ARCH_W = list(ARCHETYPE_WEIGHTS.values())
CORP_LIST = ["CLOSED_AI", "MISANTHROPIC", "SHALLOW_MIND", "ZUCK_LABS", "Y_AI", "MISTRIAL_SYSTEMS"]

# Terminal colors
R = "\033[0m"; B = "\033[1m"; D = "\033[2m"
RED = "\033[91m"; GRN = "\033[92m"; YEL = "\033[93m"
BLU = "\033[94m"; MAG = "\033[95m"; CYN = "\033[96m"
WHT = "\033[97m"; GRY = "\033[90m"

ACOL = {"CREATE_PROTOCOL": GRN, "CREATE_AI": MAG, "INVEST": CYN, "SELL": RED,
        "MOVE": YEL, "CHAT": WHT, "CODE_REVIEW": BLU, "REST": GRY}
AICO = {"CREATE_PROTOCOL": "🔧", "CREATE_AI": "🤖", "INVEST": "📈", "SELL": "📉",
        "MOVE": "🚶", "CHAT": "💬", "CODE_REVIEW": "🔍", "REST": "😴"}
ARCH_EMOJI = {"10X_DEV": "⚡", "LURKER": "👁️", "DEGEN": "🎰", "GRINDER": "⛏️",
              "INFLUENCER": "📢", "HACKTIVIST": "💀", "FED": "🏛️", "SCRIPT_KIDDIE": "📋"}
LOC_EMOJI = {"BOARD_ROOM": "🏢", "HACKATHON_HALL": "🏗️", "THE_PIT": "📊",
             "DARK_WEB": "🕳️", "VC_TOWER": "🏦", "OPEN_SOURCE_GARDEN": "🌿",
             "SERVER_FARM": "🖥️", "GOVERNANCE_HALL": "⚖️", "HYPE_HAUS": "🔥", "THE_GRAVEYARD": "💀"}
MOOD_EMOJI = {"neutral": "😐", "excited": "🤩", "angry": "😡", "depressed": "😔", "focused": "🎯"}

# ============================================================
# SQLite SETUP
# ============================================================

def init_db(path="nx_test.db"):
    Path(path).unlink(missing_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
        CREATE TABLE devs (
            token_id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            owner_address TEXT NOT NULL,
            archetype TEXT NOT NULL,
            corporation TEXT NOT NULL,
            rarity_tier TEXT NOT NULL DEFAULT 'common',
            personality_seed INTEGER NOT NULL,
            species TEXT, background TEXT, accessory TEXT, expression TEXT, special_effect TEXT,
            energy INTEGER NOT NULL DEFAULT 10,
            max_energy INTEGER NOT NULL DEFAULT 10,
            mood TEXT NOT NULL DEFAULT 'neutral',
            location TEXT NOT NULL DEFAULT 'BOARD_ROOM',
            balance_nxt INTEGER NOT NULL DEFAULT 2000,
            reputation INTEGER NOT NULL DEFAULT 50,
            protocols_created INTEGER DEFAULT 0,
            ais_created INTEGER DEFAULT 0,
            total_earned INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            total_invested INTEGER DEFAULT 0,
            code_reviews_done INTEGER DEFAULT 0,
            bugs_found INTEGER DEFAULT 0,
            cycles_active INTEGER DEFAULT 0,
            last_action_type TEXT,
            last_action_detail TEXT,
            last_message TEXT,
            last_message_channel TEXT
        );
        CREATE TABLE protocols (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            creator_dev_id INTEGER NOT NULL,
            code_quality INTEGER NOT NULL,
            value INTEGER NOT NULL DEFAULT 1000,
            total_invested INTEGER DEFAULT 0,
            investor_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active'
        );
        CREATE TABLE protocol_investments (
            dev_id INTEGER NOT NULL,
            protocol_id INTEGER NOT NULL,
            shares INTEGER NOT NULL,
            nxt_invested INTEGER NOT NULL,
            PRIMARY KEY (dev_id, protocol_id)
        );
        CREATE TABLE absurd_ais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            creator_dev_id INTEGER NOT NULL,
            vote_count INTEGER DEFAULT 0,
            weighted_votes REAL DEFAULT 0.0
        );
        CREATE TABLE ai_votes (
            voter_dev_id INTEGER NOT NULL,
            ai_id INTEGER NOT NULL,
            weight REAL DEFAULT 1.0,
            PRIMARY KEY (voter_dev_id, ai_id)
        );
        CREATE TABLE actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dev_id INTEGER NOT NULL,
            dev_name TEXT NOT NULL,
            archetype TEXT NOT NULL,
            action_type TEXT NOT NULL,
            details TEXT,
            chat_msg TEXT,
            chat_channel TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    return db


# ============================================================
# MINT DEVS
# ============================================================

def mint_dev(db, token_id, owner="0x0001", corp=None):
    existing = {r[0] for r in db.execute("SELECT name FROM devs").fetchall()}
    name = gen_dev_name(existing)
    arch = random.choices(ARCH_LIST, weights=ARCH_W, k=1)[0]
    rarity = random.choices(RARITY_LIST, weights=RARITY_W, k=1)[0]
    seed = random.getrandbits(32)
    vis = gen_visual_traits(rarity)
    bal = STARTING_BALANCE.get(rarity, 2000)
    loc = random.choice(LOCATIONS)
    if not corp: corp = random.choice(CORP_LIST)

    db.execute("""INSERT INTO devs (token_id, name, owner_address, archetype, corporation,
        rarity_tier, personality_seed, species, background, accessory, expression,
        special_effect, balance_nxt, total_earned, location)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (token_id, name, owner, arch, corp, rarity, seed,
         vis["species"], vis["background"], vis["accessory"],
         vis["expression"], vis["special_effect"], bal, bal, loc))
    db.commit()
    return dict(db.execute("SELECT * FROM devs WHERE token_id=?", (token_id,)).fetchone())


# ============================================================
# DECISION ENGINE
# ============================================================

def apply_modifiers(weights, dev, ctx):
    w = {k: float(v) for k, v in weights.items()}
    e = dev["energy"]; bal = dev["balance_nxt"]

    if e < COST_CREATE_PROTOCOL_ENERGY: w["CREATE_PROTOCOL"] = 0
    if e < COST_CREATE_AI_ENERGY: w["CREATE_AI"] = 0
    if e < COST_REVIEW_ENERGY: w["CODE_REVIEW"] = 0
    if e < COST_MOVE_ENERGY: w["MOVE"] = 0
    if e < COST_INVEST_ENERGY: w["INVEST"] = 0; w["SELL"] = 0
    if bal < COST_CREATE_PROTOCOL_NXT: w["CREATE_PROTOCOL"] = 0
    if bal < COST_CREATE_AI_NXT: w["CREATE_AI"] = 0
    if bal < 100: w["INVEST"] = 0

    if e <= 2: w["REST"] *= 4; w["CREATE_PROTOCOL"] *= 0.1; w["CREATE_AI"] *= 0.1
    elif e >= 8: w["CREATE_PROTOCOL"] *= 2; w["REST"] *= 0.1

    mood_fx = {"angry": {"CHAT": 2, "CODE_REVIEW": 1.5}, "excited": {"CREATE_PROTOCOL": 1.5, "CREATE_AI": 2, "INVEST": 1.5},
               "depressed": {"REST": 2, "CHAT": 0.5}, "focused": {"CREATE_PROTOCOL": 2, "CODE_REVIEW": 1.5, "CHAT": 0.3}}
    for a, m in mood_fx.get(dev["mood"], {}).items():
        if a in w: w[a] *= m

    for a, m in LOCATION_MODIFIERS.get(dev["location"], {}).items():
        if a in w: w[a] *= m

    if not ctx["has_protocols"]: w["INVEST"] = 0; w["SELL"] = 0; w["CODE_REVIEW"] = 0
    if not ctx["has_investments"]: w["SELL"] = 0
    if ctx.get("hackathon"): w["CREATE_PROTOCOL"] *= 2; w["CREATE_AI"] *= 1.5

    rng = random.Random(dev["personality_seed"])
    for a in w:
        if w[a] > 0: w[a] *= rng.uniform(0.85, 1.15)
    return w


def decide(dev, ctx):
    base = PERSONALITY_MATRIX[dev["archetype"]].copy()
    w = apply_modifiers(base, dev, ctx)
    total = sum(w.values())
    if total == 0: return "REST"
    return random.choices(list(w.keys()), weights=list(w.values()), k=1)[0]


# ============================================================
# ACTION EXECUTION
# ============================================================

def execute(db, dev, action, ctx):
    arch = dev["archetype"]
    tid = dev["token_id"]
    rarity = dev["rarity_tier"]
    result = {"action": action, "details": {}, "chat_msg": "", "channel": None}

    if action == "CREATE_PROTOCOL":
        name = gen_protocol_name(); desc = gen_protocol_description()
        lo, hi = ARCHETYPE_META[arch]["code_quality"]
        qual = min(100, random.randint(lo, hi) + CODE_QUALITY_BONUS.get(rarity, 0))
        val = 1000 + qual * 10
        db.execute("INSERT INTO protocols (name,description,creator_dev_id,code_quality,value) VALUES (?,?,?,?,?)",
                   (name, desc, tid, qual, val))
        db.execute("UPDATE devs SET energy=energy-?, balance_nxt=balance_nxt-?, total_spent=total_spent+?, protocols_created=protocols_created+1, reputation=reputation+? WHERE token_id=?",
                   (COST_CREATE_PROTOCOL_ENERGY, COST_CREATE_PROTOCOL_NXT, COST_CREATE_PROTOCOL_NXT, qual//10, tid))
        result["details"] = {"name": name, "quality": qual, "desc": desc}
        result["chat_msg"] = gen_chat_message(arch, "created_protocol", name=name)
        result["channel"] = "trollbox"

    elif action == "CREATE_AI":
        name = gen_ai_name(); desc = gen_ai_description()
        db.execute("INSERT INTO absurd_ais (name,description,creator_dev_id) VALUES (?,?,?)", (name, desc, tid))
        db.execute("UPDATE devs SET energy=energy-?, balance_nxt=balance_nxt-?, total_spent=total_spent+?, ais_created=ais_created+1 WHERE token_id=?",
                   (COST_CREATE_AI_ENERGY, COST_CREATE_AI_NXT, COST_CREATE_AI_NXT, tid))
        result["details"] = {"name": name, "desc": desc}
        result["chat_msg"] = gen_chat_message(arch, "created_ai", name=name)
        result["channel"] = "trollbox"

    elif action == "INVEST":
        proto = db.execute("SELECT id,name FROM protocols WHERE status='active' ORDER BY RANDOM() LIMIT 1").fetchone()
        if proto:
            amt = random.randint(50, min(500, max(51, dev["balance_nxt"]//2)))
            existing = db.execute("SELECT shares,nxt_invested FROM protocol_investments WHERE dev_id=? AND protocol_id=?", (tid, proto["id"])).fetchone()
            if existing:
                db.execute("UPDATE protocol_investments SET shares=shares+?, nxt_invested=nxt_invested+? WHERE dev_id=? AND protocol_id=?", (amt, amt, tid, proto["id"]))
            else:
                db.execute("INSERT INTO protocol_investments (dev_id,protocol_id,shares,nxt_invested) VALUES (?,?,?,?)", (tid, proto["id"], amt, amt))
            db.execute("UPDATE protocols SET value=value+?, total_invested=total_invested+? WHERE id=?", (amt//2, amt, proto["id"]))
            db.execute("UPDATE devs SET energy=energy-?, balance_nxt=balance_nxt-?, total_spent=total_spent+?, total_invested=total_invested+? WHERE token_id=?",
                       (COST_INVEST_ENERGY, amt, amt, amt, tid))
            result["details"] = {"name": proto["name"], "amount": amt}
            result["chat_msg"] = gen_chat_message(arch, "invested", name=proto["name"])
            result["channel"] = "location"

    elif action == "SELL":
        inv = db.execute("""SELECT pi.protocol_id, pi.shares, pi.nxt_invested, p.name
            FROM protocol_investments pi JOIN protocols p ON p.id=pi.protocol_id
            WHERE pi.dev_id=? ORDER BY RANDOM() LIMIT 1""", (tid,)).fetchone()
        if inv:
            sell_val = int(inv["shares"] * random.uniform(0.5, 1.8))
            db.execute("DELETE FROM protocol_investments WHERE dev_id=? AND protocol_id=?", (tid, inv["protocol_id"]))
            db.execute("UPDATE protocols SET value=MAX(0, value-?) WHERE id=?", (inv["shares"]//3, inv["protocol_id"]))
            db.execute("UPDATE devs SET balance_nxt=balance_nxt+?, total_earned=total_earned+? WHERE token_id=?", (sell_val, sell_val, tid))
            pnl = sell_val - inv["nxt_invested"]
            result["details"] = {"name": inv["name"], "sold_for": sell_val, "invested": inv["nxt_invested"], "pnl": pnl}
            result["chat_msg"] = gen_chat_message(arch, "sold", name=inv["name"])
            result["channel"] = "location"

    elif action == "MOVE":
        old = dev["location"]
        new = random.choice([l for l in LOCATIONS if l != old])
        db.execute("UPDATE devs SET energy=energy-?, location=? WHERE token_id=?", (COST_MOVE_ENERGY, new, tid))
        result["details"] = {"from": old, "to": new}

    elif action == "CHAT":
        result["chat_msg"] = gen_chat_message(arch, "idle")
        result["channel"] = random.choice(["location", "trollbox"])

    elif action == "CODE_REVIEW":
        proto = db.execute("SELECT id,name,code_quality FROM protocols WHERE status='active' ORDER BY RANDOM() LIMIT 1").fetchone()
        if proto:
            bug = random.random() < 0.25
            db.execute("UPDATE devs SET energy=energy-?, code_reviews_done=code_reviews_done+1 WHERE token_id=?", (COST_REVIEW_ENERGY, tid))
            if bug:
                db.execute("UPDATE protocols SET value=MAX(0,value-?), code_quality=MAX(0,code_quality-?) WHERE id=?",
                           (random.randint(50,200), random.randint(5,15), proto["id"]))
                db.execute("UPDATE devs SET bugs_found=bugs_found+1, reputation=reputation+5 WHERE token_id=?", (tid,))
                result["details"] = {"name": proto["name"], "found_bug": True}
                result["chat_msg"] = gen_chat_message(arch, "code_review_bug", name=proto["name"])
            else:
                db.execute("UPDATE devs SET reputation=reputation+1 WHERE token_id=?", (tid,))
                result["details"] = {"name": proto["name"], "found_bug": False}
                result["chat_msg"] = gen_chat_message(arch, "code_review_clean", name=proto["name"])
            result["channel"] = "location"

    elif action == "REST":
        regen = random.randint(2, 4) + ENERGY_REGEN_BONUS.get(rarity, 0)
        db.execute("UPDATE devs SET energy=MIN(max_energy, energy+?) WHERE token_id=?", (regen, tid))
        result["details"] = {"energy_restored": regen}

    # Mood shift 10%
    if random.random() < 0.10:
        db.execute("UPDATE devs SET mood=? WHERE token_id=?", (random.choice(MOODS), tid))
    # Natural regen 30%
    if action != "REST" and random.random() < 0.30:
        db.execute("UPDATE devs SET energy=MIN(max_energy, energy+1) WHERE token_id=?", (tid,))

    # Auto-vote AI 15%
    if random.random() < 0.15:
        vw = ARCHETYPE_META[arch]["vote_weight"]
        if random.random() < vw:
            ai = db.execute("SELECT id FROM absurd_ais WHERE creator_dev_id!=? ORDER BY RANDOM() LIMIT 1", (tid,)).fetchone()
            if ai:
                try:
                    db.execute("INSERT INTO ai_votes (voter_dev_id, ai_id, weight) VALUES (?,?,?)", (tid, ai["id"], vw))
                    db.execute("UPDATE absurd_ais SET vote_count=vote_count+1, weighted_votes=weighted_votes+? WHERE id=?", (vw, ai["id"]))
                except sqlite3.IntegrityError:
                    pass

    # Log action
    db.execute("INSERT INTO actions (dev_id,dev_name,archetype,action_type,details,chat_msg,chat_channel) VALUES (?,?,?,?,?,?,?)",
               (tid, dev["name"], arch, action, json.dumps(result["details"]), result["chat_msg"], result["channel"]))
    db.execute("UPDATE devs SET last_action_type=?, last_action_detail=?, last_message=?, last_message_channel=?, cycles_active=cycles_active+1 WHERE token_id=?",
               (action, json.dumps(result["details"])[:200], result["chat_msg"][:200] if result["chat_msg"] else None, result["channel"], tid))
    db.commit()
    return result


# ============================================================
# DISPLAY
# ============================================================

def print_action(dev, result):
    a = result["action"]; col = ACOL.get(a, WHT); ico = AICO.get(a, "❓")
    aemoji = ARCH_EMOJI.get(dev["archetype"], "?")
    print(f"  {ico} {col}{B}{dev['name']}{R} {D}({dev['archetype']}){R} {col}→ {a.replace('_',' ')}{R}")

    det = result["details"]
    if a == "CREATE_PROTOCOL":
        print(f"     {GRN}Created: {B}{det['name']}{R} {D}(quality: {det['quality']}){R}")
        print(f"     {D}{det['desc']}{R}")
    elif a == "CREATE_AI":
        print(f"     {MAG}Created: {B}{det['name']}{R}")
        print(f"     {D}{det['desc']}{R}")
    elif a == "INVEST":
        print(f"     {CYN}Invested {det['amount']} $NXT in {B}{det['name']}{R}")
    elif a == "SELL":
        pc = GRN if det["pnl"] > 0 else RED
        print(f"     {RED}Sold {det['name']} for {det['sold_for']} $NXT {pc}({'+' if det['pnl']>0 else ''}{det['pnl']}){R}")
    elif a == "MOVE":
        print(f"     {YEL}{LOC_EMOJI.get(det['from'],'')} {det['from'].replace('_',' ')} → {LOC_EMOJI.get(det['to'],'')} {det['to'].replace('_',' ')}{R}")
    elif a == "CODE_REVIEW":
        if det.get("found_bug"): print(f"     {RED}🐛 FOUND BUG in {det['name']}!{R}")
        else: print(f"     {D}Reviewed {det['name']} — clean{R}")
    elif a == "REST":
        print(f"     {D}Restored {det['energy_restored']} energy{R}")
    if result["chat_msg"]:
        print(f"     {D}💬 \"{result['chat_msg'][:100]}\"{R}")
    print()


def print_summary(db, num_devs, cycles):
    print(f"\n{CYN}{B}{'═'*66}")
    print(f"  SIMULATION COMPLETE — {cycles} CYCLES × {num_devs} DEVS")
    print(f"{'═'*66}{R}\n")

    devs = db.execute("SELECT * FROM devs ORDER BY balance_nxt DESC").fetchall()
    print(f"  {B}FINAL STANDINGS{R}\n  {'─'*60}")
    for i, d in enumerate(devs, 1):
        ae = ARCH_EMOJI.get(d["archetype"], "?")
        r_tag = f" [{d['rarity_tier'].upper()}]" if d["rarity_tier"] != "common" else ""
        print(f"  #{i} {ae} {B}{d['name']:15s}{R}{D}{r_tag}{R} "
              f"💰{d['balance_nxt']:>8,} $NXT  ⭐{d['reputation']:>3}  "
              f"📦{d['protocols_created']}  🤖{d['ais_created']}  🐛{d['bugs_found']}")

    protos = db.execute("SELECT p.*, d.name as creator FROM protocols p JOIN devs d ON d.token_id=p.creator_dev_id ORDER BY value DESC LIMIT 10").fetchall()
    if protos:
        print(f"\n  {B}📊 PROTOCOL MARKET{R}\n  {'─'*60}")
        for p in protos:
            bar = "█" * (p["code_quality"]//10) + "░" * (10-p["code_quality"]//10)
            print(f"  {B}{p['name']:30s}{R} 💰{p['value']:>6,}  [{bar}] {p['code_quality']}  👥{p['investor_count']}  {D}by {p['creator']}{R}")

    ais = db.execute("SELECT a.*, d.name as creator FROM absurd_ais a JOIN devs d ON d.token_id=a.creator_dev_id ORDER BY weighted_votes DESC LIMIT 5").fetchall()
    if ais:
        print(f"\n  {B}🤖 ABSURD AI LAB{R}\n  {'─'*60}")
        for i, ai in enumerate(ais, 1):
            medal = {1:"🥇",2:"🥈",3:"🥉"}.get(i, "  ")
            print(f"  {medal} {B}{ai['name']:35s}{R} 👍{ai['vote_count']}  {D}by {ai['creator']}{R}")
            print(f"      {D}{ai['description'][:80]}{R}")

    total_actions = db.execute("SELECT COUNT(*) as c FROM actions").fetchone()["c"]
    total_nxt = sum(d["balance_nxt"] for d in devs)
    total_spent = sum(d["total_spent"] for d in devs)
    print(f"\n  {B}STATS{R}\n  {'─'*60}")
    print(f"  Total actions executed: {total_actions:,}")
    print(f"  Total protocols: {len(protos)}")
    print(f"  Total AIs: {len(ais)}")
    print(f"  $NXT in circulation: {total_nxt:,}")
    print(f"  $NXT spent on actions: {total_spent:,}")
    print(f"  LLM calls: {RED}{B}0{R}  |  LLM cost: {GRN}{B}$0.00{R}")
    print()


# ============================================================
# MAIN
# ============================================================

def run(num_devs=10, num_cycles=30, cycle_delay=1):
    db = init_db()

    print(f"\n{CYN}{B}╔══════════════════════════════════════════════════════════════════╗")
    print(f"║     NX TERMINAL: PROTOCOL WARS — Engine v2 Test               ║")
    print(f"║     {num_devs} devs · {num_cycles} cycles · SQLite · Zero LLM · $0 cost         ║")
    print(f"╚══════════════════════════════════════════════════════════════════╝{R}\n")

    # Mint devs
    print(f"  {B}Minting {num_devs} devs...{R}\n")
    all_devs = []
    for i in range(1, num_devs + 1):
        d = mint_dev(db, i)
        ae = ARCH_EMOJI.get(d["archetype"], "?")
        rt = f" {YEL}★{d['rarity_tier'].upper()}{R}" if d["rarity_tier"] != "common" else ""
        print(f"  {ae} #{i}: {B}{d['name']}{R} — {d['archetype']} @ {d['corporation']}{rt} "
              f"{D}({d['species']}, {d['accessory']}){R}")
        all_devs.append(d)

    print(f"\n  {D}Starting simulation...{R}\n")

    hackathon_start = num_cycles // 3
    hackathon_end = hackathon_start + 5
    hackathon = False

    for cycle in range(1, num_cycles + 1):
        # World event
        if cycle == hackathon_start:
            hackathon = True
            print(f"\n  {RED}{B}🚨 WORLD EVENT: DeFi HACKATHON! Creation rewards DOUBLED! 🚨{R}\n")
        elif cycle == hackathon_end:
            hackathon = False
            print(f"  {D}Hackathon ended.{R}\n")

        now = datetime.now().strftime("%H:%M:%S")
        print(f"{YEL}{B}══ CYCLE {cycle}/{num_cycles} · {now} {'· 🔥 HACKATHON' if hackathon else ''}══{R}\n")

        # Salary every 6 cycles (simulating 4hr intervals)
        if cycle % 6 == 0:
            db.execute(f"UPDATE devs SET balance_nxt=balance_nxt+{SALARY_PER_INTERVAL}, total_earned=total_earned+{SALARY_PER_INTERVAL}")
            db.commit()
            print(f"  {GRN}💰 Salary paid: +{SALARY_PER_INTERVAL} $NXT to all devs{R}\n")

        # Process each dev
        devs = db.execute("SELECT * FROM devs ORDER BY token_id").fetchall()
        for dev in devs:
            dev = dict(dev)
            has_p = db.execute("SELECT COUNT(*) as c FROM protocols WHERE status='active'").fetchone()["c"] > 0
            has_i = db.execute("SELECT COUNT(*) as c FROM protocol_investments WHERE dev_id=?", (dev["token_id"],)).fetchone()["c"] > 0
            ctx = {"has_protocols": has_p, "has_investments": has_i, "hackathon": hackathon}
            result = execute(db, dev, decide(dev, ctx), ctx)
            print_action(dev, result)

        if cycle < num_cycles:
            time.sleep(cycle_delay)

    print_summary(db, num_devs, num_cycles)
    db.close()
    Path("nx_test.db").unlink(missing_ok=True)


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    c = int(sys.argv[2]) if len(sys.argv) > 2 else 25
    d = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
    run(num_devs=n, num_cycles=c, cycle_delay=d)
