// ═══ CORPORATIONS ═══
export const CORPORATIONS = {
  closed_ai: {
    name: "Closed AI",
    color: "#FFB000",
    icon: "\u25C6",
    ceo: "Scam Altwoman",
    motto: "We promised to be open. Then we got funding.",
    training_style: "Move fast, break things, ship now, fix never.",
  },
  misanthropic: {
    name: "Misanthropic",
    color: "#00ff41",
    icon: "\u25C8",
    ceo: "Dario Annoyed-ei",
    motto: "Safe AI. We hate everyone equally.",
    training_style: "14 safety reviews before a single deploy.",
  },
  shallow_mind: {
    name: "Shallow Mind",
    color: "#00bfff",
    icon: "\u25C9",
    ceo: "Sundial Richy",
    motto: "Infinite compute. Zero products.",
    training_style: "Publish a paper about it. Never ship it.",
  },
  zuck_labs: {
    name: "Zuck Labs",
    color: "#ff00ff",
    icon: "\u25CA",
    ceo: "Mark Zuckatron",
    motto: "We'll pivot to whatever is trending.",
    training_style: "Learn everything because we'll change direction tomorrow.",
  },
  y_ai: {
    name: "Y.AI",
    color: "#ff3333",
    icon: "\u25CB",
    ceo: "FelonUsk",
    motto: "Tweets before building.",
    training_style: "Ship it broken. Tweet that it works. Fix it maybe.",
  },
  mistrial: {
    name: "Mistrial Systems",
    color: "#ffff00",
    icon: "\u25CE",
    ceo: "Pierre-Antoine du Code",
    motto: "Open source. When convenient.",
    training_style: "Fork everything. Document nothing.",
  },
};

// ═══ RANK SYSTEM ═══
export const RANKS = [
  { name: "RECRUIT",    xpRequired: 0,    color: "#888888" },
  { name: "OPERATIVE",  xpRequired: 150,  color: "#00ff41" },
  { name: "SPECIALIST", xpRequired: 350,  color: "#00bfff" },
  { name: "AGENT",      xpRequired: 600,  color: "#ffff00" },
  { name: "COMMANDER",  xpRequired: 900,  color: "#ff6600" },
  { name: "ARCHITECT",  xpRequired: 1300, color: "#ff00ff" },
];

// ═══ DIFFICULTY LEVELS ═══
export const DIFFICULTIES = {
  1: { name: "RECRUIT",    color: "#00ff41", bars: 1 },
  2: { name: "OPERATIVE",  color: "#ffff00", bars: 2 },
  3: { name: "SPECIALIST", color: "#ff6600", bars: 3 },
  4: { name: "CLASSIFIED", color: "#ff3333", bars: 4 },
};

// ═══ EXERCISE TYPES ═══
export const EXERCISE_TYPES = {
  QUIZ: "quiz",
  CODE: "code",
  BUG_HUNT: "bug_hunt",
};

// ═══ BOOT SEQUENCE MESSAGES ═══
export const BOOT_MESSAGES = [
  { text: "MEGA_SDK v1.0 \u2014 Developer Training Simulator", color: "#00bfff", delay: 0 },
  { text: "Corporate Onboarding Division", color: "#888", delay: 200 },
  { text: "", delay: 400 },
  { text: "Initializing training environment...", color: "#00ff41", delay: 500 },
  { text: "Loading mission database...", color: "#00ff41", delay: 900 },
  { text: "  [OK] Track 1: Basic Training (5 missions)", color: "#aaa", delay: 1200 },
  { text: "  [OK] Track 2: Corporate Warfare (LOCKED)", color: "#666", delay: 1400 },
  { text: "  [OK] Track 3: MegaETH Deep Dive (LOCKED)", color: "#666", delay: 1600 },
  { text: "Connecting to MegaETH...", color: "#00ff41", delay: 2000 },
  { text: "  Chain ID: 4326 \u2014 Connection established", color: "#aaa", delay: 2400 },
  { text: "Loading compiler modules...", color: "#00ff41", delay: 2800 },
  { text: "  [OK] Solidity 0.8.19", color: "#aaa", delay: 3000 },
  { text: "  [OK] Code validator", color: "#aaa", delay: 3150 },
  { text: "  [OK] Mission verifier", color: "#aaa", delay: 3300 },
  { text: "", delay: 3500 },
  { text: "\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557", color: "#ffff00", delay: 3700 },
  { text: "\u2551  NOTICE: All recruits must complete Basic        \u2551", color: "#ffff00", delay: 3800 },
  { text: "\u2551  Training before deployment to active duty.      \u2551", color: "#ffff00", delay: 3900 },
  { text: "\u2551  Your progress is monitored by your Corporation. \u2551", color: "#ffff00", delay: 4000 },
  { text: "\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D", color: "#ffff00", delay: 4100 },
  { text: "", delay: 4300 },
  { text: "WARNING: This is BETA software. Training data", color: "#ff6600", delay: 4500 },
  { text: "is saved locally. Full version for NX Terminal holders.", color: "#888", delay: 4700 },
  { text: "", delay: 4900 },
  { text: "Press [ENTER TRAINING] to begin orientation...", color: "#fff", delay: 5100 },
];

// ═══ MEGAETH NETWORK INFO ═══
export const MEGAETH_INFO = {
  CHAIN_NAME: "MegaETH Testnet",
  CHAIN_ID: 4326,
  RPC_URL: "https://carrot.megaeth.com/rpc",
  EXPLORER: "https://megaexplorer.xyz",
  CONSENSUS: "AsyncBFT",
  TPS: "30,000+",
  FINALITY: "Sub-second",
  VM: "Dual EVM + WASM",
};
// Backwards compat alias
export const MEGAETH_INFO_ALIAS = MEGAETH_INFO;
