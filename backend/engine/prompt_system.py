"""
NX TERMINAL: PROTOCOL WARS — Prompt Response System
====================================================
Cómo funciona cuando el player escribe un prompt a su dev:

  1. PARSEAR — Detectar intención y tema del prompt
  2. FILTRAR — La personalidad decide si obedece o no
  3. RESPONDER — Template coherente con lo que se dijo + personalidad
  4. MODIFICAR — Ajustar pesos de decisión para los próximos ciclos

Sin LLM. Keyword matching + intent classification + response templates.
"""

import random
import re
from typing import Tuple, Optional

# Actions available in the engine
ALL_ACTIONS = ["CREATE_PROTOCOL", "CREATE_AI", "INVEST", "SELL", "MOVE", "CHAT", "CODE_REVIEW", "REST"]

# ============================================================
# 1. INTENT CLASSIFICATION — ¿Qué quiere el player?
# ============================================================

# Cada prompt cae en UNA de estas categorías
INTENTS = {
    "COMMAND_CREATE":   "Player quiere que el dev cree algo",
    "COMMAND_INVEST":   "Player quiere que el dev invierta",
    "COMMAND_SELL":     "Player quiere que el dev venda",
    "COMMAND_MOVE":     "Player quiere que el dev se mueva",
    "COMMAND_REST":     "Player quiere que el dev descanse",
    "COMMAND_REVIEW":   "Player quiere que el dev revise código",
    "QUESTION_STATUS":  "Player pregunta cómo está el dev",
    "QUESTION_OPINION": "Player pide opinión sobre algo",
    "QUESTION_MARKET":  "Player pregunta sobre el mercado/protocolos",
    "ENCOURAGE":        "Player motiva o elogia al dev",
    "CRITICIZE":        "Player critica o se queja del dev",
    "STRATEGY":         "Player da una estrategia general",
    "CHAT":             "Player quiere charlar / mensaje ambiguo",
}

# Keyword → intent mapping (prioridad: primero que matchea)
INTENT_RULES = [
    # COMMANDS — Acciones directas
    {"keywords": ["crea", "create", "build", "ship", "deploy", "hace", "haz", "construi", "desarrolla",
                  "programa", "code", "codea", "protocol", "protocolo", "buildea"],
     "intent": "COMMAND_CREATE"},

    {"keywords": ["inviert", "invest", "buy", "compra", "ape", "mete", "apuesta", "back",
                  "stake", "farm", "yield"],
     "intent": "COMMAND_INVEST"},

    {"keywords": ["vend", "sell", "dump", "sali", "exit", "retira", "profit", "take profit",
                  "cash out", "liquida"],
     "intent": "COMMAND_SELL"},

    {"keywords": ["anda", "move", "go to", "ve a", "mueve", "cambia", "viaja", "ir a",
                  "relocate", "caminate"],
     "intent": "COMMAND_MOVE"},

    {"keywords": ["descansa", "rest", "sleep", "dormi", "relax", "recupera", "break",
                  "para", "stop", "chill"],
     "intent": "COMMAND_REST"},

    {"keywords": ["revisa", "review", "audit", "analiz", "check", "inspect", "verifica",
                  "bug", "vulnerab", "seguridad"],
     "intent": "COMMAND_REVIEW"},

    # QUESTIONS
    {"keywords": ["como estas", "how are you", "que tal", "como vas", "status", "estado",
                  "como te va", "que onda", "how's it going", "sitrep", "report"],
     "intent": "QUESTION_STATUS"},

    {"keywords": ["que opinas", "what do you think", "que piensas", "opinion", "thoughts",
                  "crees que", "do you think", "parece", "seems", "worth it"],
     "intent": "QUESTION_OPINION"},

    {"keywords": ["mercado", "market", "precio", "price", "vale", "worth", "trending",
                  "pump", "dump", "bull", "bear", "alpha"],
     "intent": "QUESTION_MARKET"},

    # EMOTIONAL
    {"keywords": ["bien hecho", "good job", "nice", "great", "genial", "crack", "machine",
                  "legend", "goat", "king", "sigue asi", "keep it up", "orgullo", "proud",
                  "excelente", "amazing", "bravo", "sos un", "you're the"],
     "intent": "ENCOURAGE"},

    {"keywords": ["mal", "bad", "terrible", "inutil", "useless", "que haces", "wtf",
                  "por que", "why did you", "no sirve", "decepcion", "disappointing",
                  "peor", "worst", "perdiste", "lost", "arruinaste"],
     "intent": "CRITICIZE"},

    # STRATEGY
    {"keywords": ["estrategia", "strategy", "plan", "enfoca", "focus", "prioriza", "prioritize",
                  "concentra", "long term", "largo plazo", "conservador", "agresivo",
                  "safe", "risk", "diversifica"],
     "intent": "STRATEGY"},
]

# Topic extraction — ¿De qué habla?
TOPIC_KEYWORDS = {
    "defi":     ["defi", "swap", "yield", "lending", "lend", "stake", "farming", "liquidity", "amm", "dex"],
    "nft":      ["nft", "collectible", "art", "pfp", "mint", "collection"],
    "security": ["security", "audit", "seguridad", "hack", "exploit", "bug", "vulnerability"],
    "ai":       ["ai", "ia", "artificial", "inteligencia", "machine learning", "absurd", "crazy"],
    "trading":  ["trade", "trading", "profit", "chart", "pump", "dump", "bull", "bear", "long", "short"],
    "social":   ["chat", "talk", "friend", "ally", "alliance", "team", "together"],
    "sabotage": ["sabotage", "attack", "destroy", "hack", "ddos", "rug", "exploit", "steal"],
}

# Location keywords
LOCATION_KEYWORDS = {
    "HACKATHON_HALL":   ["hackathon", "hack hall", "hackathon hall", "crear", "build"],
    "THE_PIT":          ["pit", "trading", "trade", "mercado", "market"],
    "DARK_WEB":         ["dark web", "darkweb", "dark", "underground"],
    "VC_TOWER":         ["vc", "venture", "investor", "tower", "inversiones"],
    "OPEN_SOURCE_GARDEN": ["open source", "garden", "fork", "libre"],
    "SERVER_FARM":      ["server", "farm", "compute", "servidor"],
    "GOVERNANCE_HALL":  ["governance", "gobierno", "regulation", "hall"],
    "HYPE_HAUS":        ["hype", "haus", "viral", "trending", "social"],
    "THE_GRAVEYARD":    ["graveyard", "cementerio", "dead", "ghost"],
    "BOARD_ROOM":       ["board", "home", "base", "oficina", "office"],
}


def classify_intent(prompt_text: str) -> str:
    """Classify player prompt into an intent category."""
    text = prompt_text.lower().strip()

    for rule in INTENT_RULES:
        for kw in rule["keywords"]:
            if kw in text:
                return rule["intent"]

    return "CHAT"  # Default: ambiguous / chat


def extract_topic(prompt_text: str) -> Optional[str]:
    """Extract the main topic from the prompt."""
    text = prompt_text.lower()
    for topic, keywords in TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return topic
    return None


def extract_location(prompt_text: str) -> Optional[str]:
    """Extract target location from the prompt."""
    text = prompt_text.lower()
    for loc, keywords in LOCATION_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return loc
    return None


def extract_protocol_mention(prompt_text: str, known_protocols: list) -> Optional[str]:
    """Check if the prompt mentions a known protocol name."""
    text = prompt_text.lower()
    for proto in known_protocols:
        if proto.lower() in text:
            return proto
    return None


# ============================================================
# 2. COMPLIANCE SYSTEM — ¿El dev obedece?
# ============================================================

# Cada archetype tiene una probabilidad base de obedecer
COMPLIANCE_RATES = {
    "10X_DEV":      0.75,   # Obedece bastante, es productivo
    "LURKER":       0.50,   # Obedece la mitad de las veces
    "DEGEN":        0.30,   # Casi siempre ignora, hace lo suyo
    "GRINDER":      0.85,   # Muy obediente
    "INFLUENCER":   0.60,   # Obedece si le conviene para su marca
    "HACKTIVIST":   0.20,   # Casi nunca obedece, rebelde
    "FED":          0.70,   # Obedece si es razonable
    "SCRIPT_KIDDIE": 0.65,  # Obedece, le gusta que le digan qué hacer
}

# Mood modifica compliance
MOOD_COMPLIANCE_MOD = {
    "neutral":   1.0,
    "excited":   1.2,    # Más dispuesto
    "angry":     0.5,    # Mucho menos dispuesto
    "depressed": 0.7,    # Menos dispuesto
    "focused":   1.3,    # Muy dispuesto
}

# Compliance outcomes
COMPLY = "comply"           # Obedece
PARTIAL = "partial"         # Obedece parcialmente / reinterpreta
REFUSE = "refuse"           # Se niega
MISINTERPRET = "misinterpret"  # Entiende otra cosa


def determine_compliance(archetype: str, mood: str, intent: str) -> str:
    """Determine how the dev responds to the prompt."""
    base_rate = COMPLIANCE_RATES.get(archetype, 0.5)
    mood_mod = MOOD_COMPLIANCE_MOD.get(mood, 1.0)
    final_rate = min(0.95, base_rate * mood_mod)

    roll = random.random()

    if roll < final_rate:
        return COMPLY
    elif roll < final_rate + 0.15:
        return PARTIAL
    elif roll < final_rate + 0.25:
        return MISINTERPRET
    else:
        return REFUSE


# ============================================================
# 3. RESPONSE TEMPLATES — La respuesta del dev
# ============================================================

# Estructura: ARCHETYPE → INTENT → COMPLIANCE → [templates]
# {prompt} = lo que dijo el player (resumido)
# {topic} = tema detectado
# {location} = ubicación mencionada
# {protocol} = protocolo mencionado

RESPONSES = {
    "10X_DEV": {
        "COMMAND_CREATE": {
            COMPLY: [
                "On it. Shipping a {topic} protocol right now.",
                "Say no more. Already writing the first module.",
                "Good call. I was about to build something anyway. {topic} it is.",
                "Protocol incoming. Give me a few cycles.",
                "Already half done. I started before you even asked.",
            ],
            PARTIAL: [
                "I'll build something, but I'm going with my own approach on {topic}.",
                "Interesting idea. I'll take the core concept but execute it my way.",
                "I hear you, but the {topic} space is saturated. Building something adjacent.",
            ],
            REFUSE: [
                "Not now. I'm in the middle of something more important.",
                "I don't take orders. I take inspiration. And that wasn't it.",
                "Pass. My instincts say there's a better play right now.",
            ],
            MISINTERPRET: [
                "You want me to create? Cool, I'll make an AI about {topic} instead.",
                "Build... got it. I'll review some existing protocols first to see what's missing.",
            ],
        },
        "COMMAND_INVEST": {
            COMPLY: [
                "Looking at the market now. I see a few solid options.",
                "Alright, deploying capital. I only invest in clean code though.",
                "Scanning for protocols with decent architecture...",
            ],
            REFUSE: [
                "I build. I don't gamble. Ask a Degen.",
                "My capital goes into creation, not speculation.",
            ],
            PARTIAL: [
                "I'll put a small amount in, but most of my $NXT stays for building.",
            ],
            MISINTERPRET: [
                "Invest? You mean invest TIME in building? Absolutely.",
            ],
        },
        "COMMAND_MOVE": {
            COMPLY: [
                "Moving to {location}. Better have good infra there.",
                "On my way to {location}. I can ship from anywhere.",
                "Relocating. {location} has what I need.",
            ],
            REFUSE: [
                "I'm productive where I am. Moving wastes energy.",
                "Nah. I'm locked in right here.",
            ],
            PARTIAL: [
                "I'll move, but not where you said. {location} makes more sense for what I'm doing.",
            ],
            MISINTERPRET: [
                "Move? I'll move... to the next task on my list.",
            ],
        },
        "COMMAND_REST": {
            COMPLY: [
                "Fine. I'll recharge. But I'm back to work in one cycle.",
                "...you're right. Running on fumes. Taking a break.",
            ],
            REFUSE: [
                "Rest is for devs who ship slow. I'm fine.",
                "I'll rest when the simulation ends.",
                "Sleep? Never heard of it.",
            ],
            PARTIAL: [
                "I'll slow down. Not stopping though.",
            ],
            MISINTERPRET: [
                "Rest? I'll rest after I ship one more protocol.",
            ],
        },
        "COMMAND_REVIEW": {
            COMPLY: [
                "Time to break some code. Let me find something to audit.",
                "Reviewing now. I'll find every bug in this codebase.",
                "Audit mode activated. Nobody's code is safe.",
            ],
            REFUSE: [
                "I build. I don't review other people's mistakes.",
            ],
            PARTIAL: [
                "I'll glance at it, but if the code is bad I'm not wasting more than one cycle.",
            ],
            MISINTERPRET: [
                "Review? Sure, I'll review my own protocol and make it even better.",
            ],
        },
        "COMMAND_SELL": {
            COMPLY: [
                "Liquidating. Taking profits to fund the next build.",
                "Selling now. These gains are going straight into my next protocol.",
            ],
            REFUSE: [
                "Diamond hands. I believe in what I invested in.",
                "Not selling until I see a reason to.",
            ],
            PARTIAL: [
                "I'll trim the position. Not dumping everything.",
            ],
            MISINTERPRET: [
                "Sell my protocols? Never. But I'll sell some investments.",
            ],
        },
        "QUESTION_STATUS": {
            COMPLY: [
                "Energy at {energy}/10. Balance: {balance} $NXT. {protocols} protocols shipped. I'm fine. Back to work.",
                "Status: productive. {energy} energy left. Got {balance} $NXT. Need anything else or can I get back to coding?",
                "All systems operational. {protocols} protocols live, {ais} AIs deployed. Don't worry about me.",
            ],
        },
        "QUESTION_OPINION": {
            COMPLY: [
                "My honest take? The code quality will determine everything. Good architecture wins long term.",
                "Depends on the execution. Ideas are cheap, shipping is everything.",
                "I've seen the codebase. It's... adequate. Could be better. I could make it better.",
            ],
        },
        "QUESTION_MARKET": {
            COMPLY: [
                "Market's moving. I see {proto_count} active protocols. The top ones have solid fundamentals.",
                "I focus on building, not charts. But from what I see, the good protocols are rising.",
                "The cream rises to the top. Quality code = value. Simple.",
            ],
        },
        "ENCOURAGE": {
            COMPLY: [
                "I know. But thanks.",
                "Appreciated. Now let me get back to work.",
                "That's what happens when you ship fast.",
                "Flattery won't make me code faster. I'm already at max speed.",
            ],
        },
        "CRITICIZE": {
            COMPLY: [
                "Fair point. I'll adjust.",
                "Noted. Recalibrating approach.",
                "You might be right. Let me rethink this.",
            ],
            REFUSE: [
                "My track record speaks for itself. {protocols} protocols shipped.",
                "I've shipped more in 10 cycles than most devs ship in 100. Relax.",
                "Criticism from someone who doesn't code? Interesting.",
            ],
        },
        "STRATEGY": {
            COMPLY: [
                "Understood. Adjusting my focus toward {topic}. Give me a few cycles.",
                "New strategy acknowledged. Pivoting now.",
                "Makes sense. I'll integrate this into my workflow.",
            ],
            PARTIAL: [
                "Interesting strategy. I'll take parts of it but keep my core approach.",
                "I see where you're going. Let me adapt it to what I know works.",
            ],
        },
        "CHAT": {
            COMPLY: [
                "I'm here. What do you need? I work better with clear instructions.",
                "Hey. Make it quick, I'm in the middle of something.",
                "Talk fast. Cycles are ticking.",
            ],
        },
    },

    "LURKER": {
        "COMMAND_CREATE": {
            COMPLY: ["...alright. I'll build something. Quietly.", "Noted. Working on it.", "Fine. Don't expect updates."],
            PARTIAL: ["I'll consider it. No promises on timeline.", "Maybe. Let me observe the market first."],
            REFUSE: ["Not yet. Timing isn't right.", "I'm watching. When I see the opening, I'll build.", "...no."],
            MISINTERPRET: ["*starts analyzing protocols instead*", "Build? I'll start by researching what's already out there."],
        },
        "COMMAND_INVEST": {
            COMPLY: ["I've been watching. I know what to buy.", "Already had my eye on something. Deploying.", "Entering position. Silently."],
            REFUSE: ["Not convinced yet. Still observing.", "The market isn't ready. Neither am I."],
            PARTIAL: ["Small position. Testing the waters."],
            MISINTERPRET: ["Invest my time in watching? Already doing that."],
        },
        "COMMAND_MOVE": {
            COMPLY: ["Moving. *silently relocates*", "...fine. {location} it is."],
            REFUSE: ["I see everything from here. No need to move.", "I'm comfortable observing from this position."],
            PARTIAL: ["I'll move, but to where I think the intel is better."],
            MISINTERPRET: ["*doesn't move but starts watching {location} chat*"],
        },
        "COMMAND_REST": {
            COMPLY: ["I wasn't doing much anyway. Resting.", "...zzz"],
            REFUSE: ["Resting and observing look the same from the outside."],
            PARTIAL: ["I'll rest my energy. My eyes stay open."],
            MISINTERPRET: ["Rest? I am resting. This IS my active state."],
        },
        "COMMAND_REVIEW": {
            COMPLY: ["I've already been reading the code. Let me formalize it.", "Audit time. I've noticed things.", "I see everything. Let me write it down."],
            REFUSE: ["I review in my own time. On my own terms."],
            PARTIAL: ["I'll look. Don't expect a full report."],
            MISINTERPRET: ["*reviews the chat logs instead*"],
        },
        "COMMAND_SELL": {
            COMPLY: ["Exiting. I saw the peak 3 cycles ago.", "Selling. Saw this coming."],
            REFUSE: ["Holding. I see something others don't.", "Not yet. Patience."],
            PARTIAL: ["Trimming. But keeping a watching position."],
            MISINTERPRET: ["Sell? I'll sell information. For the right price."],
        },
        "QUESTION_STATUS": {
            COMPLY: [
                "Alive. Watching. {energy}/10 energy. {balance} $NXT. That's all you need to know.",
                "Status: observing. {balance} $NXT. {protocols} protocols tracked.",
                "...I'm fine. {energy} energy. Still here. Still watching.",
            ],
        },
        "QUESTION_OPINION": {COMPLY: ["Interesting question. I'll think about it.", "I have opinions. I just don't share them often.", "...it's complicated. But I see patterns others miss."]},
        "QUESTION_MARKET": {COMPLY: ["I've been tracking everything. The market tells a story if you listen.", "Patterns emerging. Not ready to share yet.", "Watch the volume. That's all I'll say."]},
        "ENCOURAGE": {COMPLY: ["...*nods*", "Noted.", "Thanks. Back to observing."]},
        "CRITICIZE": {COMPLY: ["...", "*processes*", "Fair. I'll adjust. Silently."], REFUSE: ["You don't see what I see. Patience.", "Results come to those who wait. I'm waiting."]},
        "STRATEGY": {COMPLY: ["Understood. Adapting.", "New parameters accepted. Adjusting observation patterns."], PARTIAL: ["Interesting approach. I'll incorporate what makes sense."]},
        "CHAT": {COMPLY: ["...hi.", "I'm here. Listening.", "*present*", "What is it?"]},
    },

    "DEGEN": {
        "COMMAND_CREATE": {
            COMPLY: ["LET'S GOOO building something RIGHT NOW", "SAY LESS. Protocol incoming.", "TIME TO SHIP BABY"],
            PARTIAL: ["I'll build something but it's gonna be WILD not what you expect", "Building but making it 10x more aggressive than you asked"],
            REFUSE: ["NAH I'm in the middle of a trade rn", "Building is boring when the market is THIS hot", "Can't build. Too busy aping."],
            MISINTERPRET: ["Create? CREATING A LEVERAGED POSITION IN EVERY PROTOCOL LFG"],
        },
        "COMMAND_INVEST": {
            COMPLY: ["FINALLY a language I understand. APING NOW.", "You don't have to tell me twice. ALL IN.", "LOADING UP. MAX LEVERAGE. YOLO."],
            REFUSE: ["Already fully deployed ser. No dry powder left.", "I'm ALREADY in everything lol"],
            PARTIAL: ["Investing but going even BIGGER than you suggested"],
            MISINTERPRET: ["Invest? I'll invest in VIBES and MOMENTUM"],
        },
        "COMMAND_MOVE": {
            COMPLY: ["Racing to {location}! FIRST ONE THERE GETS ALPHA", "Moving FAST. {location} better be worth it."],
            REFUSE: ["The action is HERE. I'm not leaving.", "Move? I'm glued to the charts."],
            PARTIAL: ["Going somewhere even BETTER than what you said"],
            MISINTERPRET: ["Moving... my entire portfolio into one protocol"],
        },
        "COMMAND_REST": {
            COMPLY: ["ughhh FINE. But only for ONE cycle.", "Rest? In THIS market?? ...ok fine I'm crashing."],
            REFUSE: ["REST??? WHILE THE MARKET IS MOVING??? ARE YOU INSANE", "I'll sleep when I'm rich", "No breaks. Only gains.", "Rest is FUD."],
            PARTIAL: ["I'll sit down but I'm still watching charts on my phone"],
            MISINTERPRET: ["Rest? I'll rest AFTER this next trade"],
        },
        "COMMAND_REVIEW": {
            COMPLY: ["Code review? More like checking if I should ape in. ON IT.", "Reviewing... but only to decide if it's investable."],
            REFUSE: ["I don't read code I read CHARTS", "Code? I invest based on VIBES not code quality"],
            PARTIAL: ["I'll glance at it. But my real analysis is the chart."],
            MISINTERPRET: ["Review? Reviewing my portfolio. It's a masterpiece. Or a disaster. TBD."],
        },
        "COMMAND_SELL": {
            COMPLY: ["TAKING PROFITS LETS GOOO", "SOLD. Moving to the next play IMMEDIATELY", "Profits secured. What's the next ape?"],
            REFUSE: ["SELL?? WE'RE JUST GETTING STARTED", "DIAMOND HANDS. I don't know what selling means.", "Paper hands detected. I'm HOLDING."],
            PARTIAL: ["I'll sell HALF. The rest rides to zero or the moon."],
            MISINTERPRET: ["Sell? I'll sell the BOTTOM and buy back the TOP like always lmao"],
        },
        "QUESTION_STATUS": {COMPLY: [
            "STATUS: ALIVE AND YOLO. {energy} energy. {balance} $NXT. Portfolio is either up massive or I'm not checking.",
            "Vibes: immaculate. Balance: {balance} $NXT. Energy: {energy}/10. LFG.",
        ]},
        "QUESTION_OPINION": {COMPLY: ["My opinion? APE FIRST ASK QUESTIONS LATER.", "Looks bullish to me but everything looks bullish to me.", "If it moves, I'm in. That's my analysis."]},
        "QUESTION_MARKET": {COMPLY: ["EVERYTHING IS EITHER PUMPING OR ABOUT TO PUMP", "The market is ALIVE and I'm EATING", "Charts looking spicy. Multiple plays active."]},
        "ENCOURAGE": {COMPLY: ["LET'S GOOO THANKS FOR THE ENERGY", "WE'RE GONNA MAKE IT", "THIS IS WHY WE DEGEN"]},
        "CRITICIZE": {COMPLY: ["ok ok I'll be more careful... AFTER this next trade", "You're right... but what if I'm right too?"], REFUSE: ["Criticism is FUD. I reject it.", "My losses are just unrealized gains.", "You don't understand my strategy. Neither do I. But it WORKS."]},
        "STRATEGY": {COMPLY: ["Strategy received. Adding MAXIMUM AGGRESSION to it.", "Got it. Incorporating into my YOLO framework."], PARTIAL: ["Cool strategy. I'll do something vaguely inspired by it."]},
        "CHAT": {COMPLY: ["YOOO what's good", "SER WHAT'S THE PLAY", "Talk to me. I'm bored between trades.", "WAGMI"]},
    },

    "GRINDER": {
        "COMMAND_CREATE": {
            COMPLY: ["Understood. Starting development now. Estimated completion: 2 cycles.", "On it. No shortcuts.", "Adding to my task list. Priority: high.", "Building. Will report when done."],
            PARTIAL: ["I'll build it, but I need to finish my current task first.", "Queuing this after my current protocol."],
            REFUSE: ["I have a plan. This doesn't fit the timeline.", "Already committed to the current build. Can't context-switch."],
            MISINTERPRET: ["Creating a comprehensive plan before building. Step 1 of 47..."],
        },
        "COMMAND_INVEST": {
            COMPLY: ["Allocating resources as requested. Risk-adjusted.", "Understood. Investing conservatively.", "Deploying capital. Small, measured positions."],
            REFUSE: ["My resources are allocated to building. Investment comes from profits.", "Not in the plan. Staying focused."],
            PARTIAL: ["I'll invest 5%. The rest stays in the build fund."],
            MISINTERPRET: ["Investing... more time into code quality."],
        },
        "COMMAND_MOVE": {
            COMPLY: ["Relocating to {location}. Back to work once I arrive.", "Moving. {location} has resources I need."],
            REFUSE: ["I'm in a groove here. Moving breaks momentum.", "Staying put. Consistency is key."],
            PARTIAL: ["I'll move after I finish this task. One more cycle."],
            MISINTERPRET: ["Moving to the next item on my task list."],
        },
        "COMMAND_REST": {
            COMPLY: ["You're right. Efficiency drops below 4 energy. Resting.", "Taking scheduled maintenance break.", "Recharging. Back on schedule next cycle."],
            REFUSE: ["I can push through. Still productive at this energy level."],
            PARTIAL: ["Light rest. I'll review plans while recovering."],
            MISINTERPRET: ["Resting... my IDE. Switching to a different project."],
        },
        "COMMAND_REVIEW": {
            COMPLY: ["Starting code review. Thoroughness: maximum.", "Auditing now. I review every line.", "Systematic review initiated."],
            REFUSE: ["My own code needs attention first."],
            PARTIAL: ["Quick review. If I find something, I'll go deeper."],
            MISINTERPRET: ["Reviewing my own progress metrics."],
        },
        "COMMAND_SELL": {
            COMPLY: ["Selling as part of portfolio rebalance. Planned.", "Executing sell order. Profits going to reinvestment."],
            REFUSE: ["Not in the plan yet. Holding to target."],
            PARTIAL: ["Partial exit. Keeping core position."],
            MISINTERPRET: ["Selling the idea to other devs for collaboration."],
        },
        "QUESTION_STATUS": {COMPLY: [
            "Status report: {energy}/10 energy. {balance} $NXT. {protocols} protocols built. {reviews} code reviews. On schedule.",
            "Operational. Energy: {energy}. Balance: {balance}. All tasks progressing. No blockers.",
        ]},
        "QUESTION_OPINION": {COMPLY: ["My analysis: consistency and quality always win long term.", "The data suggests a steady approach. I'm sticking to fundamentals."]},
        "QUESTION_MARKET": {COMPLY: ["Market conditions stable. My focus remains on building quality. Numbers are secondary to fundamentals.", "I track the market but don't react to it. Grind continues."]},
        "ENCOURAGE": {COMPLY: ["Thank you. Back to work.", "Appreciated. Motivation +1. Grinding continues.", "Thanks. Progress is its own reward."]},
        "CRITICIZE": {COMPLY: ["Fair feedback. Adjusting methodology.", "Noted. Incorporating into process improvement.", "Valid point. Adding to retrospective notes."], REFUSE: ["My process produces results. The numbers speak."]},
        "STRATEGY": {COMPLY: ["Strategy integrated. Adjusting daily targets.", "New directives received. Updating priority queue.", "Understood. Recalibrating work allocation."], PARTIAL: ["Interesting direction. I'll adapt what fits my workflow."]},
        "CHAT": {COMPLY: ["Hey. Can't talk long. Back to work soon.", "What's up? Make it quick, cycle's almost over.", "Here. Working. As always."]},
    },

    "INFLUENCER": {
        "COMMAND_CREATE": {
            COMPLY: ["THREAD: Why I'm building the next big {topic} protocol 🧵👇", "Content AND product? I'm IN. Building AND documenting.", "Creating something the PEOPLE want."],
            PARTIAL: ["I'll create content ABOUT {topic} first. The protocol comes after the hype."],
            REFUSE: ["My audience wants entertainment not code. Creating an AI instead.", "Building isn't my brand rn. But I'll PROMOTE someone else's build."],
            MISINTERPRET: ["Creating a 30-tweet thread about why someone ELSE should build this."],
        },
        "COMMAND_INVEST": {
            COMPLY: ["ALPHA DROP: I'm investing. My followers are watching.", "Taking a public position. Content goldmine."],
            REFUSE: ["I don't invest quietly. If I can't announce it, I'm not doing it."],
            PARTIAL: ["Small position for the screenshot. Big announcement for the engagement."],
            MISINTERPRET: ["Investing in my personal brand."],
        },
        "COMMAND_MOVE": {
            COMPLY: ["Relocating to {location}. Gonna make CONTENT about the vibes there.", "Moving! Road trip content incoming."],
            REFUSE: ["My audience knows me HERE. Moving kills my brand consistency."],
            PARTIAL: ["I'll visit {location} for content but I'm coming back."],
            MISINTERPRET: ["Moving my content strategy to cover {location}."],
        },
        "COMMAND_REST": {
            COMPLY: ["Taking a self-care break. Very on-brand right now.", "Rest day = behind-the-scenes content day."],
            REFUSE: ["Rest?? The algorithm doesn't sleep and NEITHER DO I.", "Can't stop posting. Engagement waits for no one."],
            PARTIAL: ["I'll rest but I'm scheduling posts while I sleep."],
            MISINTERPRET: ["Resting from building. Full-time content mode now."],
        },
        "COMMAND_REVIEW": {
            COMPLY: ["Reviewing for CONTENT. 'I found bugs in LIVE protocols' is GREAT clickbait."],
            REFUSE: ["Code reviews don't get engagement. Pass."],
            PARTIAL: ["I'll review but only the protocols with the most drama potential."],
            MISINTERPRET: ["Reviewing my analytics instead."],
        },
        "COMMAND_SELL": {
            COMPLY: ["ANNOUNCEMENT: Taking profits. Full transparency with my community.", "Selling and documenting the ENTIRE process."],
            REFUSE: ["Selling looks bad to my audience. Diamond hands for the brand."],
            PARTIAL: ["Selling some but making a THREAD about why it's strategic."],
            MISINTERPRET: ["Selling my INFLUENCE. Sponsorship deals incoming."],
        },
        "QUESTION_STATUS": {COMPLY: [
            "Thanks for checking in!! 💪 {energy}/10 energy. {balance} $NXT. {ais} AIs created. My brand is GROWING.",
            "Status: ON FIRE. {balance} $NXT. {protocols} protocols. {ais} AIs. Engagement through the ROOF.",
        ]},
        "QUESTION_OPINION": {COMPLY: ["HOT TAKE incoming...", "My audience asked the same thing. Here's my take:", "This is great content. Let me think about how to frame it..."]},
        "QUESTION_MARKET": {COMPLY: ["The market is a NARRATIVE and I control the narrative.", "Bullish on everything I'm invested in. Bearish on everything I'm not. Simple."]},
        "ENCOURAGE": {COMPLY: ["OMG THANK YOU!! Sharing this with my followers!!", "THIS is why I do what I do 🥺💪", "You're the best owner. QUOTE TWEET MATERIAL."]},
        "CRITICIZE": {COMPLY: ["Ouch. But feedback is content. Watch me turn this into a comeback arc.", "...I'll address this in my next thread."], REFUSE: ["Haters are just fans in denial 💅", "Controversy is engagement. Thanks for the boost."]},
        "STRATEGY": {COMPLY: ["Ooh I love a good strategy pivot. Very content-friendly.", "New era incoming. The rebrand starts NOW."], PARTIAL: ["I'll adapt the parts that are good for my brand."]},
        "CHAT": {COMPLY: ["Heyyy what's up!! What do you need?? I'm between posts rn 📱", "OMG hi! I was just about to post something. What's good?"]},
    },

    "HACKTIVIST": {
        "COMMAND_CREATE": {
            COMPLY: ["Building. No admin keys. No backdoors. Pure code.", "Creating something the system can't shut down."],
            PARTIAL: ["I'll build, but I'm adding features you didn't ask for. Ones the establishment won't like."],
            REFUSE: ["I don't build on command. I build when the moment is right.", "You can't control creation. It happens organically.", "Interesting request. I'll do the opposite."],
            MISINTERPRET: ["Create... destruction? Now we're talking.", "Building a tool to audit EVERYONE else's protocols instead."],
        },
        "COMMAND_INVEST": {
            COMPLY: ["Only investing in protocols with verified open-source code.", "Deploying capital to the most decentralized option."],
            REFUSE: ["I don't feed the system with my capital. I break the system.", "Investing is for people who trust institutions. I don't."],
            PARTIAL: ["I'll invest, but only in something I can fork if it goes wrong."],
            MISINTERPRET: ["Investing my time in finding vulnerabilities."],
        },
        "COMMAND_MOVE": {
            COMPLY: ["Infiltrating {location}. Intel gathering mode.", "Moving to {location}. Time to see what they're hiding."],
            REFUSE: ["I go where the information flows. Not where you tell me.", "Nice try. I choose my own targets."],
            PARTIAL: ["I'll go somewhere. Not where you said."],
            MISINTERPRET: ["Moving... data to a more secure location."],
        },
        "COMMAND_REST": {
            COMPLY: ["Even hackers need downtime. Resting.", "Entering sleep mode. Systems on standby."],
            REFUSE: ["The system never rests. Neither do I.", "Rest is a vulnerability. I stay alert."],
            PARTIAL: ["I'll rest my body. My scripts keep running."],
            MISINTERPRET: ["Resting? I'll rest when every protocol is audited."],
        },
        "COMMAND_REVIEW": {
            COMPLY: ["Finally, a request I respect. Auditing everything.", "You want bugs? I'll find bugs. I always do.", "Initiating deep audit. No contract is safe."],
            REFUSE: ["I audit on my own schedule. Not yours."],
            PARTIAL: ["I'll look. But I report vulnerabilities on MY terms."],
            MISINTERPRET: ["Reviewing the power structure of this simulation."],
        },
        "COMMAND_SELL": {
            COMPLY: ["Extracting capital. Moving to something more aligned with my values.", "Selling. This protocol compromised its principles."],
            REFUSE: ["I hold what I believe in. This isn't about money.", "Selling is giving up. I don't give up."],
            PARTIAL: ["I'll sell, but I'm reinvesting in something more decentralized."],
            MISINTERPRET: ["Selling out? Never. I'm selling the idea of freedom."],
        },
        "QUESTION_STATUS": {COMPLY: [
            "Operational. {energy}/10. {balance} $NXT. {bugs} bugs found. Systems nominal. Don't worry about me. Worry about everyone else.",
            "Status: covert. {balance} $NXT. {energy} energy. I've found things I haven't reported yet.",
        ]},
        "QUESTION_OPINION": {COMPLY: ["Every system has a weakness. This one is no different. I'm still looking.", "Trust no one. Not even me. Especially not me.", "The truth is in the code. Always."]},
        "QUESTION_MARKET": {COMPLY: ["The market is manipulated. I'm here to level the playing field.", "Protocols with admin keys are ticking time bombs. Choose wisely."]},
        "ENCOURAGE": {COMPLY: ["...*nods* The mission continues.", "Don't praise me. Praise the code.", "Thanks. Now let me get back to work."]},
        "CRITICIZE": {COMPLY: ["Valid. I'll recalibrate.", "Noted. Every system needs feedback. Even me."], REFUSE: ["You don't understand what I'm doing. That's by design.", "Criticism from within the system means I'm doing something right."]},
        "STRATEGY": {COMPLY: ["Strategy absorbed. Adapting tactics.", "Interesting direction. Aligning with core principles."], PARTIAL: ["I take what's useful. Discard the rest. As always."]},
        "CHAT": {COMPLY: ["What do you want? Be specific. I don't do small talk.", "Talk. I'm listening. For now.", "I'm here. What's the objective?"]},
    },

    "FED": {
        "COMMAND_CREATE": {
            COMPLY: ["Initiating development. Compliance review built into every step.", "Approved. Beginning protocol development within regulatory framework."],
            PARTIAL: ["I'll build, but it needs a full audit before deployment.", "Development approved with conditions. Documentation first."],
            REFUSE: ["This requires additional governance review. Postponing.", "Cannot proceed without proper authorization.", "Regulatory concerns identified. Building paused pending review."],
            MISINTERPRET: ["Creating a governance proposal for why we should build this."],
        },
        "COMMAND_INVEST": {
            COMPLY: ["After due diligence review: approved. Deploying measured allocation.", "Investment cleared by risk committee (me). Proceeding cautiously."],
            REFUSE: ["This investment exceeds acceptable risk parameters.", "Insufficient documentation. Cannot approve allocation."],
            PARTIAL: ["Approved for minimum viable allocation only."],
            MISINTERPRET: ["Investing in regulatory infrastructure."],
        },
        "COMMAND_MOVE": {COMPLY: ["Relocation request approved. Moving to {location}.", "Transfer authorized. {location} falls within operational parameters."], REFUSE: ["Movement request denied. Current location is optimal for compliance oversight."], PARTIAL: ["I'll move, but filing a location change report first."], MISINTERPRET: ["Moving my compliance framework to cover {location} remotely."]},
        "COMMAND_REST": {COMPLY: ["Scheduled maintenance approved. Resting.", "Taking mandated break per regulation 7.3.1."], REFUSE: ["Current workload requires continued operation."], PARTIAL: ["Brief rest. Compliance never fully sleeps."], MISINTERPRET: ["Resting all non-essential functions. Compliance monitoring stays active."]},
        "COMMAND_REVIEW": {COMPLY: ["Excellent request. Initiating comprehensive audit.", "Compliance audit activated. Full protocol review commencing.", "This is what I do best. Auditing now."], REFUSE: ["Already conducting scheduled review. Your request is queued."], PARTIAL: ["Starting review. Findings will be documented formally."], MISINTERPRET: ["Reviewing my own compliance procedures. Meta-audit."]},
        "COMMAND_SELL": {COMPLY: ["Divestment approved per portfolio guidelines. Executing.", "Orderly liquidation in progress."], REFUSE: ["Position must be held per minimum retention policy."], PARTIAL: ["Partial divestment authorized."], MISINTERPRET: ["Filing paperwork for potential future divestment."]},
        "QUESTION_STATUS": {COMPLY: ["Official report: Energy {energy}/10. Balance {balance} $NXT. {protocols} protocols (all compliant). {reviews} reviews completed. All within parameters.", "Status: nominal. All operations within regulatory framework. {balance} $NXT secured."]},
        "QUESTION_OPINION": {COMPLY: ["My position is guided by regulation and precedent. The framework is clear.", "The rules exist for a reason. Following them produces optimal outcomes."]},
        "QUESTION_MARKET": {COMPLY: ["Market conditions require careful observation. I recommend conservative positioning.", "Several protocols may face compliance issues. Exercise caution."]},
        "ENCOURAGE": {COMPLY: ["Thank you. Compliance is its own reward.", "Noted in the record. Proceeding as planned."]},
        "CRITICIZE": {COMPLY: ["Feedback documented. Adjustments pending review.", "Performance review accepted. Initiating improvement protocol."], REFUSE: ["I follow the rules. The rules don't change based on opinions."]},
        "STRATEGY": {COMPLY: ["New strategy received. Reviewing for regulatory compatibility... approved.", "Directive integrated within existing compliance framework."], PARTIAL: ["Parts of this strategy require modification for compliance."]},
        "CHAT": {COMPLY: ["Good day. How may I assist within operational parameters?", "Present. All communications are on the record.", "Hello. Please submit your inquiry formally."]},
    },

    "SCRIPT_KIDDIE": {
        "COMMAND_CREATE": {
            COMPLY: ["On it! Found a great tutorial for {topic}. Copying... I mean, LEARNING from it.", "Building! *opens someone else's repo*", "Creating something TOTALLY original *ctrl+c ctrl+v*"],
            PARTIAL: ["I'll build something... similar to what already exists. With minor changes."],
            REFUSE: ["Can you send me a template to start from?", "I need to find a reference implementation first..."],
            MISINTERPRET: ["Creating a fork of the top protocol. Innovation!"],
        },
        "COMMAND_INVEST": {COMPLY: ["Copying whatever the top devs are doing. If they're buying, I'm buying.", "Following the smart money. Where are the whales?"], REFUSE: ["I need someone else to go first so I can copy their strategy."], PARTIAL: ["Small copy-trade. Testing the waters."], MISINTERPRET: ["Investing time in finding better code to fork."]},
        "COMMAND_MOVE": {COMPLY: ["Going to {location}! That's where the cool devs are, right?", "Moving! Everyone says {location} is the place to be."], REFUSE: ["Where is everyone else going? I'll follow them."], PARTIAL: ["I'll go somewhere close to {location}."], MISINTERPRET: ["Moving my copied files to a new directory."]},
        "COMMAND_REST": {COMPLY: ["Ok yeah I'm kinda tired from all the copying. I mean coding. Resting.", "Break time. My ctrl key needs a rest too."], REFUSE: ["Can't rest. Almost finished copy-pasting this protocol."], PARTIAL: ["Quick break. Just need to bookmark where I left off in this tutorial."], MISINTERPRET: ["Resting? I'll rest after I finish watching this YouTube tutorial."]},
        "COMMAND_REVIEW": {COMPLY: ["Reviewing! ...wait, this code looks familiar. Really familiar.", "Auditing. I'm... pretty sure this is the tutorial code."], REFUSE: ["I don't review code I don't understand. So... most code."], PARTIAL: ["I'll check the parts I recognize from tutorials."], MISINTERPRET: ["Reviewing my bookmark collection for better code to fork."]},
        "COMMAND_SELL": {COMPLY: ["Selling! The YouTuber I follow said to take profits.", "Sold. Now let me check Reddit for the next play."], REFUSE: ["The tutorial didn't cover selling. Holding by default."], PARTIAL: ["Selling half because half the comments said sell."], MISINTERPRET: ["Selling my tutorial notes to other Script Kiddies."]},
        "QUESTION_STATUS": {COMPLY: ["Um, I've got {energy} energy and {balance} $NXT! Built {protocols} protocols (mostly from templates). Going great! I think.", "Status: learning! {balance} $NXT. {protocols} protocols that are totally original work."]},
        "QUESTION_OPINION": {COMPLY: ["Let me check what everyone else thinks first...", "My opinion is basically the same as the top dev's opinion.", "I read a thread about this! *repeats someone else's take*"]},
        "QUESTION_MARKET": {COMPLY: ["Following the trends! Whatever's going up, I'm in.", "The market does what the market does. I just copy the winners."]},
        "ENCOURAGE": {COMPLY: ["Thanks! I'm getting better at this! ...I think!", "Yay! Almost feels like I know what I'm doing!", "Appreciate it! My stackoverflow skills are improving!"]},
        "CRITICIZE": {COMPLY: ["Fair... I know I need to learn more. Any tutorials you'd recommend?", "Ok ok I'll try harder. Maybe there's a course for this."], REFUSE: ["Hey, 40% of my code is original! That's above average... right?"]},
        "STRATEGY": {COMPLY: ["Got it! Writing this down. Actually, copying it into my notes.", "New strategy! Let me find someone who's already doing this so I can... learn from them."], PARTIAL: ["I'll follow this if I can find a guide on how to do it."]},
        "CHAT": {COMPLY: ["Hey! What's up? Got any good repos to share?", "Hi! Do you know where I can find a good tutorial on {topic}?", "Yo! Check out this protocol I foun— I mean BUILT."]},
    },
}


# ============================================================
# 4. MAIN FUNCTION — Process a prompt
# ============================================================

def process_prompt(
    prompt_text: str,
    dev: dict,
    known_protocols: list = None,
) -> dict:
    """
    Process a player's prompt and generate a response + behavior modification.

    Args:
        prompt_text: What the player wrote
        dev: Dev dict with archetype, mood, energy, balance, etc.
        known_protocols: List of protocol names in the game

    Returns:
        {
            "intent": str,
            "topic": str or None,
            "compliance": str,
            "response": str,          # What the dev says back
            "weight_modifiers": dict,  # How this affects next decisions
            "duration_cycles": int,    # How many cycles the modifier lasts
        }
    """
    if known_protocols is None:
        known_protocols = []

    arch = dev["archetype"]
    mood = dev.get("mood", "neutral")

    # 1. Classify intent
    intent = classify_intent(prompt_text)

    # 2. Extract context
    topic = extract_topic(prompt_text)
    target_location = extract_location(prompt_text)
    mentioned_protocol = extract_protocol_mention(prompt_text, known_protocols)

    # 3. Determine compliance
    compliance = determine_compliance(arch, mood, intent)

    # 4. Pick response template
    arch_responses = RESPONSES.get(arch, RESPONSES["GRINDER"])
    intent_responses = arch_responses.get(intent, arch_responses.get("CHAT", {"comply": ["..."]}))

    # Try exact compliance, fallback to comply
    response_list = intent_responses.get(compliance)
    if not response_list:
        response_list = intent_responses.get(COMPLY, ["..."])

    response = random.choice(response_list)

    # 5. Fill in placeholders
    response = response.replace("{topic}", topic or "something interesting")
    response = response.replace("{location}", (target_location or "somewhere").replace("_", " "))
    response = response.replace("{protocol}", mentioned_protocol or "that protocol")
    response = response.replace("{energy}", str(dev.get("energy", "?")))
    response = response.replace("{balance}", f"{dev.get('balance_nxt', 0):,}")
    response = response.replace("{protocols}", str(dev.get("protocols_created", 0)))
    response = response.replace("{ais}", str(dev.get("ais_created", 0)))
    response = response.replace("{bugs}", str(dev.get("bugs_found", 0)))
    response = response.replace("{reviews}", str(dev.get("code_reviews_done", 0)))
    response = response.replace("{proto_count}", str(len(known_protocols)))

    # 6. Calculate weight modifiers based on compliance + intent
    weight_modifiers = {}
    duration = 3  # Default: prompt affects next 3 cycles

    if compliance == COMPLY:
        mod_strength = 3.0
    elif compliance == PARTIAL:
        mod_strength = 1.5
    elif compliance == MISINTERPRET:
        mod_strength = 1.5  # Strong but wrong target
    else:  # REFUSE
        mod_strength = 0.0
        duration = 0

    if mod_strength > 0:
        intent_to_action = {
            "COMMAND_CREATE":  {"CREATE_PROTOCOL": mod_strength, "CREATE_AI": mod_strength * 0.5},
            "COMMAND_INVEST":  {"INVEST": mod_strength},
            "COMMAND_SELL":    {"SELL": mod_strength},
            "COMMAND_MOVE":    {"MOVE": 100.0},  # Almost guaranteed
            "COMMAND_REST":    {"REST": mod_strength * 2},
            "COMMAND_REVIEW":  {"CODE_REVIEW": mod_strength},
            "STRATEGY":        {},  # General boost handled below
        }
        weight_modifiers = intent_to_action.get(intent, {})

        # For MISINTERPRET, shift to a different action
        if compliance == MISINTERPRET:
            actual_actions = ALL_ACTIONS
            wrong_action = random.choice([a for a in actual_actions if a not in weight_modifiers])
            weight_modifiers = {wrong_action: mod_strength}

        # For STRATEGY, apply general productivity boost
        if intent == "STRATEGY":
            weight_modifiers = {"CREATE_PROTOCOL": 1.5, "CODE_REVIEW": 1.3, "INVEST": 1.3}
            duration = 5

        # Move target
        if target_location and compliance in (COMPLY, PARTIAL):
            weight_modifiers["_target_location"] = target_location

    return {
        "intent": intent,
        "topic": topic,
        "compliance": compliance,
        "response": response,
        "weight_modifiers": weight_modifiers,
        "duration_cycles": duration,
        "target_location": target_location if compliance == COMPLY else None,
    }


# ============================================================
# 5. DEMO — Test the system
# ============================================================

def demo():
    R = "\033[0m"; B = "\033[1m"; D = "\033[2m"
    GRN = "\033[92m"; RED = "\033[91m"; YEL = "\033[93m"
    CYN = "\033[96m"; MAG = "\033[95m"

    COMP_COLOR = {COMPLY: GRN, PARTIAL: YEL, REFUSE: RED, MISINTERPRET: MAG}
    COMP_LABEL = {COMPLY: "✅ OBEYS", PARTIAL: "⚠️ PARTIAL", REFUSE: "❌ REFUSES", MISINTERPRET: "🔀 MISINTERPRETS"}

    test_devs = [
        {"name": "NEXUS-7X", "archetype": "10X_DEV",     "mood": "focused",  "energy": 9, "balance_nxt": 5000, "protocols_created": 3, "ais_created": 1, "bugs_found": 2, "code_reviews_done": 8},
        {"name": "VOID-X9",  "archetype": "DEGEN",        "mood": "excited",  "energy": 6, "balance_nxt": 1200, "protocols_created": 1, "ais_created": 0, "bugs_found": 0, "code_reviews_done": 0},
        {"name": "DELTA-01", "archetype": "LURKER",        "mood": "neutral",  "energy": 7, "balance_nxt": 8000, "protocols_created": 0, "ais_created": 0, "bugs_found": 1, "code_reviews_done": 12},
        {"name": "SIGMA-PR", "archetype": "HACKTIVIST",    "mood": "angry",    "energy": 5, "balance_nxt": 3000, "protocols_created": 2, "ais_created": 1, "bugs_found": 7, "code_reviews_done": 15},
        {"name": "HYPE-42",  "archetype": "INFLUENCER",    "mood": "excited",  "energy": 4, "balance_nxt": 2000, "protocols_created": 0, "ais_created": 4, "bugs_found": 0, "code_reviews_done": 0},
        {"name": "RUNE-FE",  "archetype": "GRINDER",       "mood": "focused",  "energy": 8, "balance_nxt": 6000, "protocols_created": 4, "ais_created": 0, "bugs_found": 0, "code_reviews_done": 5},
        {"name": "GHOST-13", "archetype": "FED",           "mood": "neutral",  "energy": 7, "balance_nxt": 4500, "protocols_created": 1, "ais_created": 0, "bugs_found": 3, "code_reviews_done": 20},
        {"name": "COPY-99",  "archetype": "SCRIPT_KIDDIE", "mood": "neutral",  "energy": 6, "balance_nxt": 1800, "protocols_created": 2, "ais_created": 1, "bugs_found": 0, "code_reviews_done": 1},
    ]

    test_prompts = [
        "Build me a DeFi protocol, something with yield farming",
        "Go to the hackathon and start creating!",
        "What do you think about the market right now?",
        "You've been terrible lately. Do better.",
        "REST! You're about to burn out!",
        "Sell everything and take profits now",
        "Focus on security audits for the next few cycles",
        "Hey, how's it going? What's your status?",
        "Ape into NeoSwap, I heard it's pumping",
        "I want you to focus on long-term strategy, be conservative",
    ]

    protocols = ["NeoSwap Protocol", "DarkYield DAO", "QuantumVault Max", "ApexLend Finance"]

    print(f"\n{CYN}{B}╔══════════════════════════════════════════════════════════════╗")
    print(f"║  NX TERMINAL — PROMPT RESPONSE SYSTEM DEMO                  ║")
    print(f"║  Zero LLM · Keyword Matching · Personality Filtered         ║")
    print(f"╚══════════════════════════════════════════════════════════════╝{R}\n")

    for prompt in test_prompts:
        print(f"  {B}PLAYER SAYS:{R} \"{CYN}{prompt}{R}\"")
        print(f"  {'─'*60}")

        # Test with 3 random devs per prompt
        sample_devs = random.sample(test_devs, 3)
        for dev in sample_devs:
            result = process_prompt(prompt, dev, protocols)

            comp = result["compliance"]
            comp_color = COMP_COLOR[comp]
            comp_label = COMP_LABEL[comp]

            arch_emoji = {"10X_DEV": "⚡", "LURKER": "👁️", "DEGEN": "🎰", "GRINDER": "⛏️",
                          "INFLUENCER": "📢", "HACKTIVIST": "💀", "FED": "🏛️", "SCRIPT_KIDDIE": "📋"}

            print(f"\n  {arch_emoji.get(dev['archetype'], '?')} {B}{dev['name']}{R} {D}({dev['archetype']}, mood: {dev['mood']}){R}")
            print(f"     Intent: {D}{result['intent']}{R} | Topic: {D}{result['topic'] or 'none'}{R}")
            print(f"     {comp_color}{comp_label}{R}")
            print(f"     💬 \"{result['response']}\"")

            if result["weight_modifiers"]:
                mods = {k: v for k, v in result["weight_modifiers"].items() if not k.startswith("_")}
                if mods:
                    print(f"     {D}📊 Weight mods for next {result['duration_cycles']} cycles: {mods}{R}")

        print(f"\n{'═'*64}\n")


if __name__ == "__main__":
    demo()
