// ═══ PHAROS TESTNET CONFIGURATION ═══
export const MONAD_RPC = 'https://atlantic.dplabs-internal.com';
export const CHAIN_ID = 688689;
export const BLOCK_TIME_MS = 400;
export const TARGET_TPS = 30000;
export const POLL_INTERVAL = 400;
export const MAX_TX_DISPLAY = 200;
export const TPS_HISTORY_LENGTH = 30;

export const COLORS = {
  primary: '#7B2FBE',
  primaryLight: '#9B59B6',
  primaryDim: 'rgba(123,47,190,0.3)',
  green: '#30FF60',
  greenDim: 'rgba(48,255,96,0.15)',
  cyan: '#00FFFF',
  red: '#FF3333',
  yellow: '#FFD700',
  text: '#E0E0E0',
  bg: '#0a0a0a',
  panelBg: '#0d0d0d',
  border: 'rgba(123,47,190,0.2)',
};

// Monanimals easter egg words for BlockRain
export const MONANIMAL_WORDS = ['CHOG', 'MOYAKI', 'MOLANDAK', 'SALMONAD', 'NAD', 'PHAROS', 'MOUCH'];

// Extended character set for BlockRain
export const RAIN_CHARS = '0123456789ABCDEFabcdef{}[]<>:;/\\|=+*&^%$#@!~ΣΩπ∆アイウエオカキクケコ';
export const RAIN_FONT_SIZE = 13;

// Transaction types
export const TX_TYPES = {
  transfer: { label: 'TRANSFER', color: '#30FF60' },
  contract: { label: 'CONTRACT', color: '#7B2FBE' },
  mint: { label: 'MINT', color: '#FFD700' },
  swap: { label: 'SWAP', color: '#00FFFF' },
  stake: { label: 'STAKE', color: '#9B59B6' },
  unknown: { label: 'TX', color: '#666666' },
};

// Transaction method signatures (same as NETWATCH but rebranded)
export const TX_METHOD_SIGNATURES = {
  '0xa9059cbb': { name: 'Transfer', color: '#30FF60' },
  '0x095ea7b3': { name: 'Approve', color: '#888888' },
  '0x23b872dd': { name: 'TransferFrom', color: '#30FF60' },
  '0x38ed1739': { name: 'Swap', color: '#00FFFF' },
  '0x7ff36ab5': { name: 'SwapMON', color: '#00FFFF' },
  '0x18160ddd': { name: 'Supply', color: '#9B59B6' },
  '0x40c10f19': { name: 'Mint', color: '#FFD700' },
  '0x42966c68': { name: 'Burn', color: '#FF3333' },
  '0xa694fc3a': { name: 'Stake', color: '#9B59B6' },
  '0x2e1a7d4d': { name: 'Withdraw', color: '#FFD700' },
  '0x3593564c': { name: 'Execute', color: '#00FFFF' },
  '0x': { name: 'Transfer', color: '#30FF60' },
  default: { name: 'Contract', color: '#7B2FBE' },
};

export const CORPS = [
  { name: 'Closed AI', color: '#7B2FBE' },
  { name: 'Misanthropic', color: '#9B59B6' },
  { name: 'ChadGPT', color: '#30FF60' },
  { name: 'Y.AI', color: '#FF4444' },
  { name: 'MISTRIAL', color: '#00FFFF' },
  { name: 'Scam Altwoman', color: '#FFD700' },
];

// Boot sequence messages
export const BOOT_MESSAGES = [
  { text: 'NADWATCH v1.0 — PHAROS NETWORK SURVEILLANCE TERMINAL', color: '#7B2FBE', delay: 0 },
  { text: '(C) 2026 NX TERMINAL CORP — FOR THE NADS', color: '#888', delay: 200 },
  { text: '', color: '', delay: 400 },
  { text: 'ESTABLISHING PHAROS RPC CONNECTION...', color: '#30FF60', delay: 500 },
  { text: 'CHAIN ID: 688689............................ OK', color: '#888', delay: 900 },
  { text: 'BLOCK TIME: sub-second...................... OK', color: '#888', delay: 1200 },
  { text: 'TARGET TPS: 30,000+......................... OK', color: '#888', delay: 1500 },
  { text: '', color: '', delay: 1700 },
  { text: 'INITIALIZING BLOCK RAIN ENGINE.............. OK', color: '#30FF60', delay: 1900 },
  { text: '  > COLOR MODE: PURPLE/GREEN BICOLOR', color: '#9B59B6', delay: 2100 },
  { text: '  > MONANIMAL EASTER EGGS: ENABLED', color: '#9B59B6', delay: 2300 },
  { text: 'LOADING TRANSACTION DECODER................. OK', color: '#30FF60', delay: 2500 },
  { text: '  > HIGH-SPEED MODE: ACTIVE (30K+ TPS READY)', color: '#9B59B6', delay: 2700 },
  { text: 'PARALLEL EXECUTION MONITOR.................. OK', color: '#30FF60', delay: 2900 },
  { text: 'CONSENSUS PIPELINE TRACKER.................. OK', color: '#30FF60', delay: 3100 },
  { text: '', color: '', delay: 3300 },
  { text: 'PHAROS. THE NADS ARE WATCHING.', color: '#7B2FBE', delay: 3500 },
  { text: '', color: '', delay: 3800 },
  { text: 'ENTERING SURVEILLANCE MODE...', color: '#fff', delay: 4000 },
];
