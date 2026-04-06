// ═══ MEGAETH NETWORK CONFIGURATION ═══
const ZAN_RPC_URL = typeof import.meta !== "undefined" && import.meta.env?.VITE_ZAN_RPC_URL;

export const MEGAETH_CONFIG = {
  RPC_URL: "https://carrot.megaeth.com/rpc",
  RPC_FALLBACK: ZAN_RPC_URL || "https://carrot.megaeth.com/rpc",
  CHAIN_ID: 4326,
  POLL_INTERVAL: 3000,
  MAX_TX_DISPLAY: 15,
  TPS_HISTORY_LENGTH: 40,
  EXPLORER_URL: "https://mega.etherscan.io",
};
// Backwards compat alias
export const MONAD_CONFIG = MEGAETH_CONFIG;

// ═══ CORPORATION DATA (Protocol Wars lore) ═══
export const CORPORATIONS = {
  ClosedAI: {
    name: "Closed AI",
    color: "#ffaa00",
    icon: "\u25C6",
    tagline: "We promised to be open. Then we got funding.",
  },
  Misanthropic: {
    name: "Misanthropic",
    color: "#33ff33",
    icon: "\u25C8",
    tagline: "Safe AI. We hate everyone equally.",
  },
  ShallowMind: {
    name: "Shallow Mind",
    color: "#4488ff",
    icon: "\u25C9",
    tagline: "Infinite compute. Zero products.",
  },
  ZuckLabs: {
    name: "Zuck Labs",
    color: "#00ffff",
    icon: "\u25CA",
    tagline: "We'll pivot to whatever is trending.",
  },
  YAI: {
    name: "Y.AI",
    color: "#ff4444",
    icon: "\u25CB",
    tagline: "Tweets before building.",
  },
  MistrialSystems: {
    name: "Mistrial Systems",
    color: "#66ddaa",
    icon: "\u25CE",
    tagline: "Open source. When convenient.",
  },
};

// ═══ TRANSACTION TYPE INFERENCE ═══
export const TX_METHOD_SIGNATURES = {
  "0xa9059cbb": { name: "Transfer", color: "#00ff41" },
  "0x095ea7b3": { name: "Approve", color: "#888888" },
  "0x23b872dd": { name: "TransferFrom", color: "#33ff99" },
  "0x38ed1739": { name: "Swap", color: "#ffff00" },
  "0x7ff36ab5": { name: "SwapETH", color: "#ffff00" },
  "0x18160ddd": { name: "Supply", color: "#00bfff" },
  "0x40c10f19": { name: "Mint", color: "#ff00ff" },
  "0x42966c68": { name: "Burn", color: "#ff3333" },
  "0xa694fc3a": { name: "Stake", color: "#ff6600" },
  "0x2e1a7d4d": { name: "Withdraw", color: "#ffff00" },
  "0x3593564c": { name: "Execute", color: "#00bfff" },
  "0x": { name: "Transfer", color: "#00ff41" },
  default: { name: "Contract", color: "#aaaaaa" },
};

// ═══ VISUAL CONFIGURATION ═══
export const VISUAL = {
  RAIN_CHARS: "0123456789ABCDEFabcdef{}[]<>:;/\\|=+*&^%$#@!~\u03A3\u03A9\u03C0\u0394",
  RAIN_FONT_SIZE: 13,
  GREEN: "#00ff41",
  CYAN: "#00ffff",
  YELLOW: "#ffff00",
  RED: "#ff3333",
  DIM: "#555555",
  MUTED: "#888888",
};

// ═══ BOOT SEQUENCE MESSAGES ═══
export const BOOT_MESSAGES = [
  { text: "MEGAWATCH v1.0 \u2014 Protocol Surveillance Division", color: "#00bfff", delay: 0 },
  { text: "NX Terminal Corp\u2122 \u2014 Authorized Personnel Only", color: "#888", delay: 200 },
  { text: "", color: "", delay: 400 },
  { text: "Initializing secure connection...", color: "#00ff41", delay: 500 },
  { text: "Connecting to MEGAETH NETWORK...", color: "#00ff41", delay: 900 },
  { text: "RPC endpoint: " + MEGAETH_CONFIG.RPC_URL, color: "#888", delay: 1200 },
  { text: "Handshake complete. Chain ID: " + MEGAETH_CONFIG.CHAIN_ID, color: "#888", delay: 1600 },
  { text: "", color: "", delay: 1800 },
  { text: "Loading surveillance modules...", color: "#00ff41", delay: 2000 },
  { text: "  [OK] Block monitor", color: "#aaa", delay: 2200 },
  { text: "  [OK] Transaction analyzer", color: "#aaa", delay: 2400 },
  { text: "  [OK] Network vitals", color: "#aaa", delay: 2600 },
  { text: "  [OK] Corp activity tracker", color: "#aaa", delay: 2800 },
  { text: "  [OK] CRT display driver", color: "#aaa", delay: 3000 },
  { text: "", color: "", delay: 3200 },
  { text: "All systems operational.", color: "#00ff41", delay: 3400 },
  { text: "CLEARANCE LEVEL: OBSERVER", color: "#ffff00", delay: 3700 },
  { text: "", color: "", delay: 3900 },
  { text: "WARNING: This is BETA software.", color: "#ff6600", delay: 4100 },
  { text: "Full version available for NX Terminal holders.", color: "#888", delay: 4400 },
  { text: "", color: "", delay: 4600 },
  { text: "Starting surveillance feed...", color: "#fff", delay: 4800 },
];

// ═══ ALERT TYPES (placeholder for full version) ═══
export const ALERT_TYPES = {
  TPS_THRESHOLD: "TPS_THRESHOLD",
  GAS_BELOW: "GAS_BELOW",
  WHALE_TX: "WHALE_TX",
  NEW_CONTRACT: "NEW_CONTRACT",
};
