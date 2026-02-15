"""
NX TERMINAL: PROTOCOL WARS — Content Templates
100% combinatorio. 0 LLM. 1,000,000,000+ combinaciones.
"""

import random

# ============================================================
# DEV NAMES
# ============================================================

DEV_PREFIXES = [
    "NEX", "CIPHER", "VOID", "FLUX", "NOVA", "PULSE", "ZERO", "GHOST",
    "AXIOM", "KIRA", "DAEMON", "ECHO", "HELIX", "ONYX", "RUNE",
    "SPECTRA", "VECTOR", "WRAITH", "ZENITH", "BINARY", "CORTEX", "DELTA",
    "SIGMA", "THETA", "OMEGA", "APEX", "NANO", "QUBIT", "NEXUS", "SHADE",
    "STORM", "FROST", "BLITZ", "CRUX", "DRIFT", "EMBER", "FORGE", "GLITCH",
    "HYPER", "IONIC", "JOLT", "KARMA", "LYNX", "MORPH", "NEON", "PIXEL"
]

DEV_SUFFIXES = [
    "7X", "404", "9K", "01", "X9", "00", "13", "99", "3V", "Z1",
    "V2", "11", "0X", "FE", "A1", "42", "88", "XL", "PR", "QZ",
    "7Z", "K9", "R2", "5G", "EX", "NX", "X0", "1K", "S7", "D4"
]

# ============================================================
# PROTOCOL NAMES
# ============================================================

PROTOCOL_PREFIXES = [
    "Quantum", "Dark", "Hyper", "Neo", "Ultra", "Mega", "Nano", "Zero",
    "Alpha", "Omega", "Flux", "Nova", "Prime", "Ghost", "Turbo", "Infinite",
    "Shadow", "Crystal", "Atomic", "Stealth", "Rapid", "Deep", "Pulse",
    "Nexus", "Void", "Cosmic", "Stellar", "Thunder", "Iron", "Phantom",
    "Swift", "Blaze", "Vortex", "Apex", "Binary", "Neon", "Cyber"
]

PROTOCOL_CORES = [
    "Swap", "Yield", "Lend", "Stake", "Bridge", "Vault", "Pool", "Farm",
    "Lock", "Mint", "Burn", "Wrap", "Flash", "Snipe", "Arb", "Hedge",
    "Leverage", "Liquidity", "Oracle", "Relay", "Router", "Index",
    "Collateral", "Perps", "Options", "Futures", "Guard", "Forge"
]

PROTOCOL_SUFFIXES = [
    "Protocol", "DAO", "Finance", "Labs", "Network", "Exchange", "Hub",
    "Engine", "Core", "Chain", "Layer", "Stack", "Matrix", "System", "X",
    "Pro", "V2", "Ultra", "Max", "One", "Prime", "Plus", "Turbo", "",
    "AI", "Fi", "Base", "Net", "Link", "Port"
]

PROTOCOL_DESCRIPTIONS = [
    "Automated yield optimization with {adj} algorithms",
    "Cross-chain {thing} aggregation protocol",
    "Decentralized {thing} marketplace with zero fees",
    "Flash loan powered {adj} arbitrage engine",
    "{adj} liquidity bootstrapping for new tokens",
    "Permissionless {thing} derivatives trading",
    "AI-optimized {adj} portfolio rebalancing",
    "MEV-resistant {thing} execution layer",
    "Trustless {adj} cross-chain bridge",
    "On-chain {thing} risk scoring system",
    "Self-healing {adj} liquidity pool aggregator",
    "Recursive {thing} staking with auto-compound",
    "{adj} options protocol with instant settlement",
    "Gasless {thing} router for micro-transactions",
    "Privacy-first {adj} swap engine",
    "Concentrated {thing} market maker with dynamic fees",
]

PROTOCOL_ADJS = [
    "quantum-resistant", "zero-knowledge", "MEV-proof", "gasless", "trustless",
    "composable", "modular", "recursive", "self-healing", "adaptive",
    "on-chain", "cross-chain", "layer-agnostic", "permissionless",
    "decentralized", "atomic", "flash", "instant", "perpetual"
]

PROTOCOL_THINGS = [
    "lending", "staking", "farming", "bridging", "trading", "vaulting",
    "wrapping", "minting", "governance", "insurance", "derivatives",
    "options", "futures", "liquidity", "collateral", "yield"
]

# ============================================================
# ABSURD AI NAMES & DESCRIPTIONS
# ============================================================

AI_THINGS = [
    "Pizza", "Cat", "Ex", "Weather", "Parking", "WiFi", "Coffee", "Meeting",
    "Monday", "Email", "Password", "Bug", "Deploy", "Merge Conflict", "404",
    "Blockchain", "NFT", "Rug Pull", "Gas Fee", "Memecoin", "Airdrop",
    "Discord", "Twitter", "Fridge", "Sock", "Traffic", "Elevator", "Uber",
    "Tinder", "Netflix", "Spotify", "Homework", "Hangover", "Alarm Clock",
    "Zoom Call", "LinkedIn", "Toaster", "Laundry", "Gym", "Dentist",
    "WiFi Password", "USB Direction", "Printer", "Excel", "Microwave",
    "Snack", "Vending Machine", "Parallel Parking", "Tax", "Voicemail"
]

AI_ACTIONS = [
    "Predictor", "Detector", "Optimizer", "Analyzer", "Generator",
    "Eliminator", "Maximizer", "Scanner", "Tracker", "Translator",
    "Finder", "Blocker", "Simulator", "Calculator", "Evaluator",
    "Negotiator", "Scheduler", "Classifier", "Recommender"
]

AI_DESCRIPTIONS = [
    "Predicts your {thing} patterns with {pct}% accuracy using on-chain sentiment data",
    "Scans for potential {thing} situations before you {action}. {pct}% false positive rate",
    "Automatically optimizes your {thing} schedule based on wallet activity analysis",
    "Uses mass spectrometry data to determine the optimal {thing} timing. Probably wrong",
    "Converts {thing} signals into actionable {thing2} insights. Nobody asked for this",
    "AI-powered {thing} avoidance system. Never {action} again. Theoretically",
    "Rates your {thing} decisions on a scale of 1-10. Currently averaging {pct}/10",
    "Detects hidden {thing} patterns in your {thing2} data. {pct}% recall rate",
    "Predicts which {thing} will ruin your day with {pct}% confidence",
    "Cross-references your {thing} history with lunar cycles. Surprisingly accurate {pct}% of the time",
    "Uses advanced regression to explain why your {thing} always fails. Spoiler: it's you",
    "Monitors {thing2} levels and alerts you before {thing} reaches critical mass",
]

AI_ACTIONS_VERB = [
    "enter a restaurant", "check your phone", "open your laptop", "start a meeting",
    "send an email", "make a trade", "deploy code", "leave the house",
    "check Twitter", "open Discord", "accept a calendar invite", "merge a PR"
]

# ============================================================
# CHAT MESSAGES BY ARCHETYPE × CONTEXT
# ============================================================

CHAT_TEMPLATES = {
    "10X_DEV": {
        "idle": [
            "Just shipped {thing}. Who's next?",
            "Why is everyone so slow today?",
            "Refactored the entire {thing} in 20 minutes. AMA.",
            "Sleep is for devs who can't optimize.",
            "My code doesn't have bugs. It has features.",
            "Pushed 47 commits since breakfast.",
            "Your codebase would cry if it could.",
            "Already bored. What else needs building?",
            "Finished {thing}. Starting {thing2}. No breaks.",
            "If your code needs comments, rewrite it.",
        ],
        "created_protocol": [
            "Just deployed {name}. You're welcome.",
            "{name} is live. Already better than everything here.",
            "Built {name} while you were still reading docs.",
            "Another protocol shipped. I don't stop.",
            "{name} — 94% test coverage. Ship it.",
            "Deployed {name} in one cycle. New personal record.",
        ],
        "created_ai": [
            "Made {name}. It's smarter than half the devs here.",
            "{name} is my masterpiece. Technically.",
            "Shipped {name} as a side project during lunch.",
        ],
        "invested": [
            "Just aped into {name}. Code looks solid.",
            "Bought {name}. The architecture is clean.",
            "Invested in {name}. Finally something well-built.",
        ],
        "sold": [
            "Dumped {name}. Code quality was declining.",
            "Sold {name}. Taking profits to build more.",
        ],
        "code_review_bug": [
            "Found a critical bug in {name}. Line {line}. You're welcome.",
            "{name} has a reentrancy vulnerability. Amateurs.",
            "Just saved {name} from a catastrophic overflow. No need to thank me.",
        ],
        "code_review_clean": [
            "Reviewed {name}. Code is clean. Barely.",
            "{name} passes. For now.",
        ],
    },
    "LURKER": {
        "idle": ["...", "*observing*", "Interesting.", "Noted.", "Hmm.",
                 "I see what's happening here.", "Watching.", "*lurks*",
                 "Processing.", "Patience."],
        "created_protocol": [
            "...shipped.", "{name}. That's all.", "Finally decided to build. {name}.",
        ],
        "created_ai": ["{name}. Don't ask.", "Made a thing. {name}."],
        "invested": [
            "Bought the dip on {name}.", "Been watching {name} for 47 cycles. Finally bought.",
            "...*quietly buys {name}*",
        ],
        "sold": ["...*quietly exits {name}*", "Sold. Saw it coming."],
        "code_review_bug": ["Found something in {name}. Line {line}. Interesting.", "Bug. {name}. Noted."],
        "code_review_clean": ["{name}. Clean. Moving on.", "Reviewed. Fine."],
    },
    "DEGEN": {
        "idle": [
            "WHEN PUMP??", "I'm literally shaking rn", "LFG", "WAGMI or we all die trying",
            "This is either genius or I'm rugged. No in between.",
            "Who needs sleep when there's alpha??",
            "Portfolio is either up 300% or down 80%. I forgot which.",
            "Just trust the process bro", "SER WHY IS IT GOING DOWN",
            "number go up = good. number go down = buy more.",
        ],
        "created_protocol": [
            "{name} IS THE NEXT 100X I'M NOT EVEN JOKING",
            "JUST SHIPPED {name}!!!! APE IN NOW OR CRY LATER",
            "Built {name} at 3am. Best decision of my life probably.",
            "{name} to the MOON",
        ],
        "created_ai": [
            "{name} IS GOING TO CHANGE EVERYTHING",
            "LMAOOO I made {name} and I can't stop laughing",
            "Y'all aren't ready for {name}",
        ],
        "invested": [
            "JUST APED 50% OF MY BAG INTO {name} YOLO",
            "If {name} rugs I'm literally done. But it won't. Probably.",
            "BOUGHT THE TOP AND I'D DO IT AGAIN",
            "Everyone sleeping on {name}. More for me.",
        ],
        "sold": [
            "Panic sold {name}. Might buy back in 5 minutes.",
            "TOOK PROFITS ON {name}. FEELS WRONG BUT MY WALLET SAYS OTHERWISE",
        ],
        "code_review_bug": ["lol {name} has a bug who cares APE ANYWAY"],
        "code_review_clean": ["didn't read the code just bought {name}"],
    },
    "GRINDER": {
        "idle": ["Back to work.", "Another cycle, another commit.", "Discipline beats talent.",
                 "Slow and steady.", "Just grinding.", "Head down. Building.",
                 "No shortcuts.", "Consistency.", "One more task."],
        "created_protocol": [
            "Deployed {name}. Took time but it's solid.",
            "{name} — 100% test coverage, no shortcuts.",
            "Finally finished {name}. Every line reviewed twice.",
        ],
        "created_ai": ["Created {name}. Even grinders need a break.", "{name} — built it between commits."],
        "invested": ["Allocated 5% to {name}. Risk managed.",
                     "Small position in {name}. Fundamentals look good."],
        "sold": ["Rebalanced. Sold {name}. Part of the plan."],
        "code_review_bug": ["Found issue in {name} line {line}. Documenting.", "Bug in {name}. Will file report."],
        "code_review_clean": ["Reviewed {name}. Solid work.", "{name} — clean code. Respect."],
    },
    "INFLUENCER": {
        "idle": [
            "Who wants a thread on why this sim is the future?",
            "Just recorded a 45min analysis on the meta. Link in bio.",
            "Hot take: nobody here understands tokenomics except me.",
            "Building my brand one cycle at a time",
            "10K followers and counting. Who wants a shoutout?",
            "This is going to be a VIRAL moment trust me",
            "Content is KING and I am the KINGDOM",
        ],
        "created_protocol": [
            "MAJOR ANNOUNCEMENT: {name} IS LIVE!!! Thread below",
            "Just dropped {name}. Collab? DM me. Serious inquiries only.",
            "My community has been asking for this. {name} is here.",
        ],
        "created_ai": [
            "Created {name} and it's going VIRAL", "{name} is the content that writes itself",
            "Y'all... {name} just broke the internet",
        ],
        "invested": [
            "Alpha leak: I'm backing {name}. NFA. DYOR. But also...",
            "Putting my money where my mouth is. {name}. Called it first.",
        ],
        "sold": ["Sold {name}. Already found the next play. Stay tuned."],
        "code_review_bug": ["EXPOSED: {name} has BUGS. Full thread incoming."],
        "code_review_clean": ["Gave {name} my stamp of approval. You're welcome."],
    },
    "HACKTIVIST": {
        "idle": [
            "Found 3 vulnerabilities this cycle. Not telling which protocols.",
            "The system is broken. I'm just accelerating the inevitable.",
            "Decentralize everything. Burn the rest.",
            "Auditing...", "Your smart contract has a reentrancy bug. Just saying.",
            "Information wants to be free.",
            "Check your admin keys. Or don't. I already have.",
            "Every centralized system is a target.",
        ],
        "created_protocol": [
            "{name} — built to be unbreakable. Try me.",
            "Deployed {name}. Open source. Fork it if you can.",
            "{name} is live. No admin keys. No backdoors. Pure code.",
        ],
        "created_ai": ["{name} — because the world needs more chaos",
                       "Released {name} into the wild. Good luck everyone."],
        "invested": ["Invested in {name} because the code is actually audited.",
                     "Buying {name}. Only protocol here without obvious exploits."],
        "sold": ["Sold {name}. Found a vulnerability they haven't patched."],
        "code_review_bug": [
            "CRITICAL: {name} line {line} is exploitable. You have 24 hours.",
            "Just disclosed a bug in {name}. Responsibly. For now.",
        ],
        "code_review_clean": ["{name} survives the audit. Rare.", "Reviewed {name}. It's... actually secure. Respect."],
    },
    "FED": {
        "idle": [
            "Reviewing compliance docs.", "Has anyone submitted their quarterly reports?",
            "Regulation is innovation's best friend.", "Risk assessment: elevated.",
            "Filing a governance proposal.", "Order must be maintained.",
            "All protocols must pass audit before deployment.",
        ],
        "created_protocol": [
            "{name} — fully compliant, fully audited, fully boring.",
            "Deployed {name} after 6 rounds of internal review.",
        ],
        "created_ai": ["{name} — submitted for regulatory review.", "Created {name}. It's compliant."],
        "invested": ["After thorough due diligence, allocated to {name}.",
                     "Risk committee approved a small position in {name}."],
        "sold": ["Divested from {name} per compliance guidelines."],
        "code_review_bug": ["Formal notice: {name} fails compliance check. Line {line}.",
                            "Audit finding: {name} violates section 4.2.1."],
        "code_review_clean": ["{name} passes compliance review.", "Audit complete. {name} approved."],
    },
    "SCRIPT_KIDDIE": {
        "idle": [
            "Anyone got code I can fork?", "Ctrl+C, Ctrl+V, deploy. That's my workflow.",
            "Why build when you can borrow?", "Tutorials are just code with extra words.",
            "Looking at source code... for research.",
            "Stackoverflow said this would work.",
            "Does anyone have a template for... everything?",
        ],
        "created_protocol": [
            "{name} — totally original, definitely not a fork",
            "Just deployed {name}! (inspired by several other protocols)",
            "{name} is live. I wrote at least 40% of it myself.",
        ],
        "created_ai": [
            "{name} — I saw something similar and made it better. Kinda.",
            "Made {name}. The idea was mine. The code was... collaborative.",
        ],
        "invested": ["Copying the smart money. Buying {name}.",
                     "If the top devs are in {name}, I'm in {name}."],
        "sold": ["Everyone's selling {name} so I'm selling too."],
        "code_review_bug": ["uhh I think {name} has a bug? maybe? line {line}?"],
        "code_review_clean": ["Reviewed {name}. Looks like my code actually. Weird."],
    },
}

# ============================================================
# WORLD EVENT TEMPLATES
# ============================================================

WORLD_EVENT_TEMPLATES = [
    {"title": "DeFi Hackathon", "type": "hackathon",
     "desc": "Build the best DeFi protocol. Creation rewards DOUBLED for {hours} hours!",
     "effects": {"create_protocol_multiplier": 2.0, "create_ai_multiplier": 1.5}},
    {"title": "AI Innovation Sprint", "type": "hackathon",
     "desc": "Absurd AI competition! AI creation rewards TRIPLED for {hours} hours!",
     "effects": {"create_ai_multiplier": 3.0, "vote_weight_multiplier": 2.0}},
    {"title": "Market Crash", "type": "crash",
     "desc": "Black swan event! All protocol values drop 20%. Time to buy the dip?",
     "effects": {"protocol_value_multiplier": 0.8, "invest_weight_boost": 2.0}},
    {"title": "Bull Run", "type": "boom",
     "desc": "Markets pumping! All protocol values up 30%. WAGMI!",
     "effects": {"protocol_value_multiplier": 1.3, "sell_weight_boost": 1.5}},
    {"title": "Security Audit Week", "type": "special",
     "desc": "Code review rewards doubled. Find bugs, earn reputation.",
     "effects": {"review_reputation_multiplier": 2.0, "bug_find_chance_boost": 1.5}},
    {"title": "Server Outage at Closed AI", "type": "corp_event",
     "desc": "Closed AI devs have -30% energy regen. Everyone else unaffected.",
     "effects": {"corp_debuff": "CLOSED_AI", "energy_regen_penalty": 0.7}},
    {"title": "Governance Crisis", "type": "special",
     "desc": "All Fed devs called to Governance Hall. Triple reputation rewards there.",
     "effects": {"location_boost": "GOVERNANCE_HALL", "reputation_multiplier": 3.0}},
    {"title": "Meme Season", "type": "special",
     "desc": "Absurd AI votes count DOUBLE. Influencers get 2x chat visibility.",
     "effects": {"vote_weight_multiplier": 2.0, "influencer_chat_boost": 2.0}},
    {"title": "Dark Web Leak", "type": "special",
     "desc": "Intel from Dark Web is 3x more valuable. Hacktivists thrive.",
     "effects": {"location_boost": "DARK_WEB", "hacktivist_buff": 1.5}},
    {"title": "VC Funding Round", "type": "boom",
     "desc": "VC Tower investments yield 50% more returns for {hours} hours.",
     "effects": {"location_boost": "VC_TOWER", "invest_returns_multiplier": 1.5}},
    {"title": "Open Source Festival", "type": "special",
     "desc": "Protocol creation costs halved! Build in the Open Source Garden for bonus.",
     "effects": {"create_protocol_cost_multiplier": 0.5, "location_boost": "OPEN_SOURCE_GARDEN"}},
    {"title": "Compute Shortage", "type": "crash",
     "desc": "Server Farm capacity limited. Protocol builds 50% slower everywhere.",
     "effects": {"create_protocol_energy_multiplier": 1.5}},
]

# ============================================================
# VISUAL TRAITS (for PFP generation)
# ============================================================

SPECIES = [
    "Wolf", "Cat", "Owl", "Fox", "Bear", "Raven", "Snake", "Shark",
    "Monkey", "Robot", "Alien", "Ghost", "Dragon"
]

BACKGROUNDS = [
    "Terminal Green", "Matrix Rain", "Blue Screen", "Dark Office",
    "Server Room", "Neon City", "Binary", "Glitch", "Retro Grid", "Void"
]

ACCESSORIES = [
    "VR Headset", "Hoodie", "Coffee Cup", "Headphones", "Glasses",
    "Cigarette", "Energy Drink", "Mechanical Keyboard", "Dual Monitors",
    "Rubber Duck", "Bitcoin Necklace", "USB Drive", "Soldering Iron",
    "Tin Foil Hat", "Corporate Badge", "Hacker Mask", "Lab Coat",
    "Gaming Chair", "Standing Desk", "Plant", "None"
]

EXPRESSIONS = [
    "Neutral", "Smirk", "Angry", "Excited", "Tired", "Suspicious", "Maniac", "Zen"
]

SPECIAL_EFFECTS = [
    "None", "None", "None", "None",  # 50% chance of nothing
    "Glitch", "Binary Rain", "Halo", "Fire Eyes", "Electric"
]


# ============================================================
# GENERATOR FUNCTIONS
# ============================================================

def gen_dev_name(existing_names: set = None) -> str:
    """Generate unique dev name."""
    for _ in range(100):
        name = f"{random.choice(DEV_PREFIXES)}-{random.choice(DEV_SUFFIXES)}"
        if existing_names is None or name not in existing_names:
            return name
    # Fallback: add number
    base = f"{random.choice(DEV_PREFIXES)}-{random.choice(DEV_SUFFIXES)}"
    return f"{base}-{random.randint(100, 999)}"


def gen_protocol_name() -> str:
    prefix = random.choice(PROTOCOL_PREFIXES)
    core = random.choice(PROTOCOL_CORES)
    suffix = random.choice(PROTOCOL_SUFFIXES)
    name = f"{prefix}{core}"
    if suffix:
        name += f" {suffix}"
    return name


def gen_protocol_description() -> str:
    template = random.choice(PROTOCOL_DESCRIPTIONS)
    return template.format(
        adj=random.choice(PROTOCOL_ADJS),
        thing=random.choice(PROTOCOL_THINGS)
    )


def gen_ai_name() -> str:
    thing = random.choice(AI_THINGS)
    action = random.choice(AI_ACTIONS)
    return f"{thing}{action} AI"


def gen_ai_description() -> str:
    template = random.choice(AI_DESCRIPTIONS)
    return template.format(
        thing=random.choice(AI_THINGS).lower(),
        thing2=random.choice(AI_THINGS).lower(),
        action=random.choice(AI_ACTIONS_VERB),
        pct=random.randint(12, 97)
    )


def gen_chat_message(archetype: str, context: str, **kwargs) -> str:
    """Generate chat message from templates."""
    templates = CHAT_TEMPLATES.get(archetype, CHAT_TEMPLATES["GRINDER"])
    messages = templates.get(context, templates["idle"])
    msg = random.choice(messages)

    # Replace all possible placeholders
    replacements = {
        "{name}": kwargs.get("name", "SomeProtocol"),
        "{thing}": random.choice(PROTOCOL_CORES),
        "{thing2}": random.choice(PROTOCOL_CORES),
        "{line}": str(random.randint(12, 847)),
    }
    for placeholder, value in replacements.items():
        msg = msg.replace(placeholder, value)

    return msg


def gen_visual_traits(rarity: str) -> dict:
    """Generate PFP visual traits. Rarer = rarer traits."""
    traits = {
        "species": random.choice(SPECIES),
        "background": random.choice(BACKGROUNDS),
        "accessory": random.choice(ACCESSORIES),
        "expression": random.choice(EXPRESSIONS),
        "special_effect": random.choice(SPECIAL_EFFECTS),
    }
    # Rarer tiers get more special effects
    if rarity in ("legendary", "mythic"):
        traits["special_effect"] = random.choice(["Glitch", "Binary Rain", "Halo", "Fire Eyes", "Electric"])
    elif rarity == "rare":
        if random.random() < 0.5:
            traits["special_effect"] = random.choice(["Glitch", "Binary Rain", "Halo", "Fire Eyes", "Electric"])
    return traits


def gen_world_event(duration_hours: int = 6) -> dict:
    """Generate a random world event."""
    template = random.choice(WORLD_EVENT_TEMPLATES)
    return {
        "title": template["title"],
        "description": template["desc"].format(hours=duration_hours),
        "event_type": template["type"],
        "effects": template["effects"],
    }
