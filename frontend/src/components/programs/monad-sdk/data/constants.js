// ═══ MONAD_SDK — CONSTANTS ═══
// Re-export shared game-universe data from PharosSDK
export { CORPORATIONS, DIFFICULTIES, EXERCISE_TYPES } from '../../pharos-sdk/data/constants';

// ═══ MONAD-THEMED RANKS ═══
export const RANKS = [
  { name: 'INITIATE',   xpRequired: 0,    color: '#888888' },
  { name: 'VALIDATOR',  xpRequired: 150,  color: '#30FF60' },
  { name: 'EXECUTOR',   xpRequired: 350,  color: '#00FFFF' },
  { name: 'PARALLEL',   xpRequired: 600,  color: '#FFD700' },
  { name: 'CONSENSUS',  xpRequired: 900,  color: '#FF6600' },
  { name: 'ARCHITECT',  xpRequired: 1300, color: '#7B2FBE' },
];

// ═══ MONAD NETWORK INFO ═══
export const MONAD_INFO = {
  CHAIN_NAME: 'Monad Mainnet',
  CHAIN_ID: 143,
  RPC_URL: 'https://rpc.monad.xyz',
  BLOCK_TIME: '400ms',
  CONSENSUS: 'MonadBFT',
  TPS: '10,000',
  FINALITY: '~800ms (2 blocks)',
  PARALLEL_LANES: 8,
};

// ═══ BOOT SEQUENCE MESSAGES ═══
export const BOOT_MESSAGES = [
  { text: 'MONAD_SDK v1.0 \u2014 Developer Training Simulator', color: '#7B2FBE', delay: 0 },
  { text: 'Parallel Execution Training Division', color: '#888', delay: 200 },
  { text: '', delay: 400 },
  { text: 'Initializing training environment...', color: '#30FF60', delay: 500 },
  { text: 'Loading mission database...', color: '#30FF60', delay: 900 },
  { text: '  [OK] Track 1: Monad Fundamentals (5 missions)', color: '#aaa', delay: 1200 },
  { text: '  [OK] Track 2: Advanced Monad (LOCKED)', color: '#666', delay: 1400 },
  { text: 'Connecting to Monad Mainnet...', color: '#30FF60', delay: 1800 },
  { text: '  Chain ID: 143 \u2014 Connection established', color: '#aaa', delay: 2200 },
  { text: '  Block time: 400ms \u2014 Parallel execution: ACTIVE', color: '#aaa', delay: 2500 },
  { text: 'Loading compiler modules...', color: '#30FF60', delay: 2800 },
  { text: '  [OK] Solidity 0.8.19', color: '#aaa', delay: 3000 },
  { text: '  [OK] Code validator', color: '#aaa', delay: 3150 },
  { text: '  [OK] Mission verifier', color: '#aaa', delay: 3300 },
  { text: '', delay: 3500 },
  { text: '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557', color: '#7B2FBE', delay: 3700 },
  { text: '\u2551  MONAD: WHERE PARALLEL EXECUTION MEETS          \u2551', color: '#7B2FBE', delay: 3800 },
  { text: '\u2551  DETERMINISTIC STATE. LEARN TO BUILD ON IT.     \u2551', color: '#7B2FBE', delay: 3900 },
  { text: '\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D', color: '#7B2FBE', delay: 4000 },
  { text: '', delay: 4200 },
  { text: 'WARNING: BETA. Progress saved locally.', color: '#ff6600', delay: 4400 },
  { text: 'Full version for NX Terminal NFT holders.', color: '#888', delay: 4600 },
  { text: '', delay: 4800 },
  { text: 'Press [ENTER TRAINING] to begin...', color: '#fff', delay: 5000 },
];
