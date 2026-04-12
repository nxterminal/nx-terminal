// ═══ MEGA_SDK — CONSTANTS ═══

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

// ═══ MEGAETH-THEMED RANKS ═══
export const RANKS = [
  { name: 'INITIATE',   xpRequired: 0,    color: '#cfcfcf' },
  { name: 'VALIDATOR',  xpRequired: 150,  color: '#30FF60' },
  { name: 'EXECUTOR',   xpRequired: 350,  color: '#00FFFF' },
  { name: 'PARALLEL',   xpRequired: 600,  color: '#FFD700' },
  { name: 'CONSENSUS',  xpRequired: 900,  color: '#FF6600' },
  { name: 'ARCHITECT',  xpRequired: 1300, color: '#7B2FBE' },
];

// ═══ MEGAETH NETWORK INFO ═══
export const MEGAETH_INFO = {
  CHAIN_NAME: 'MegaETH Testnet',
  CHAIN_ID: 4326,
  RPC_URL: 'https://carrot.megaeth.com/rpc',
  BLOCK_TIME: 'Sub-second',
  CONSENSUS: 'AsyncBFT',
  TPS: '30,000+',
  FINALITY: '~800ms (2 blocks)',
  PARALLEL_LANES: 8,
};

// ═══ BOOT SEQUENCE MESSAGES ═══
export const BOOT_MESSAGES = [
  { text: 'MEGA_SDK v1.0 \u2014 Developer Training Simulator', color: '#7B2FBE', delay: 0 },
  { text: 'MegaETH Training Division', color: '#cfcfcf', delay: 200 },
  { text: '', delay: 400 },
  { text: 'Initializing training environment...', color: '#30FF60', delay: 500 },
  { text: 'Loading mission database...', color: '#30FF60', delay: 900 },
  { text: '  [OK] Track 1: MegaETH Fundamentals (5 missions)', color: '#cfcfcf', delay: 1200 },
  { text: '  [OK] Track 2: Advanced MegaETH (LOCKED)', color: '#a0a0a0', delay: 1400 },
  { text: 'Connecting to MegaETH Testnet...', color: '#30FF60', delay: 1800 },
  { text: '  Chain ID: 4326 \u2014 Connection established', color: '#cfcfcf', delay: 2200 },
  { text: '  Block time: Sub-second \u2014 Parallel execution: ACTIVE', color: '#cfcfcf', delay: 2500 },
  { text: 'Loading compiler modules...', color: '#30FF60', delay: 2800 },
  { text: '  [OK] Solidity 0.8.19', color: '#cfcfcf', delay: 3000 },
  { text: '  [OK] Code validator', color: '#cfcfcf', delay: 3150 },
  { text: '  [OK] Mission verifier', color: '#cfcfcf', delay: 3300 },
  { text: '', delay: 3500 },
  { text: '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557', color: '#7B2FBE', delay: 3700 },
  { text: '\u2551  MEGAETH: WHERE REAL-TIME EXECUTION MEETS         \u2551', color: '#7B2FBE', delay: 3800 },
  { text: '\u2551  DETERMINISTIC STATE. LEARN TO BUILD ON IT.     \u2551', color: '#7B2FBE', delay: 3900 },
  { text: '\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D', color: '#7B2FBE', delay: 4000 },
  { text: '', delay: 4200 },
  { text: 'WARNING: BETA. Progress saved locally.', color: '#ff6600', delay: 4400 },
  { text: 'Full version for NX Terminal NFT holders.', color: '#cfcfcf', delay: 4600 },
  { text: '', delay: 4800 },
  { text: 'Press [ENTER TRAINING] to begin...', color: '#fff', delay: 5000 },
];
