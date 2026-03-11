export const PROTOCOLS = {
  kuru:    { name: 'Kuru',    color: '#22C55E', type: 'CLOB',   label: 'CLOB' },
  uniswap: { name: 'Uniswap', color: '#627EEA', type: 'AMM',    label: 'AMM' },
  nadfun:  { name: 'Nad.fun', color: '#F97316', type: 'Launch', label: 'LAUNCH' },
  perpl:   { name: 'Perpl',   color: '#EF4444', type: 'Perps',  label: 'PERPS' },
  curve:   { name: 'Curve',   color: '#0891B2', type: 'AMM',    label: 'AMM' },
  pancakeswap: { name: 'PancakeSwap', color: '#D4A017', type: 'AMM', label: 'AMM' },
  balancer: { name: 'Balancer', color: '#7B68EE', type: 'AMM', label: 'AMM' },
  capricorn: { name: 'Capricorn', color: '#FF6B9D', type: 'AMM', label: 'AMM' },
};

export const TOKENS = [
  'MON', 'WETH', 'USDC', 'USDT', 'WMON', 'AUSD',
  'CHOG', 'YAKI', 'PURP', 'BLOB', 'HEDG', 'NADFUN',
  'MONKE', 'GMON', 'MOCHI'
];

export const TABS = [
  { id: 'stream',  label: 'The Stream' },
  { id: 'wallet',  label: 'Wallet X-Ray' },
  { id: 'radar',   label: 'Token Radar' },
  { id: 'clob',    label: 'CLOB Vision' },
  { id: 'ai',      label: 'AI Oracle' },
  { id: 'help',    label: '? Help' },
];

export const TOOLTIPS = {
  tps: 'Transactions Per Second — measures network throughput on Monad',
  block: 'Current block number on Monad (finality ~400ms)',
  monPrice: 'Live MON token price from CoinGecko',
  gas: 'Current gas price in Gwei — Monad keeps this extremely low',
  theStream: 'Real-time trade feed from all Monad DEXs',
  walletXray: 'Analyze any Monad wallet: balances, tokens, and activity',
  tokenRadar: 'Pool scoring engine — rates pools 0-100 for safety',
  clobVision: 'Live orderbook visualization for Kuru CLOB DEX',
  aiOracle: 'Ask questions about Monad DeFi using live market data',
  buy: 'A buy trade — someone purchased this token',
  sell: 'A sell trade — someone sold this token',
  whale: 'Large trade ($10K+) that may move the market',
  protocol: 'The DEX protocol where this trade was executed',
  safetyScore: 'Composite score 0-100 based on liquidity, volume, age, and volatility',
  spread: 'Difference between best bid and best ask price',
  depth: 'Total order size at each price level in the orderbook',
};

export const COLORS = {
  bg:        '#07090E',
  surface:   '#0D1117',
  border:    'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.12)',
  text:      '#C8D6E5',
  textDim:   '#555D6B',
  textMuted: '#3B4252',
  accent:    '#22C55E',
  accentDim: 'rgba(34,197,94,0.12)',
  indigo:    '#818CF8',
  indigoDim: 'rgba(129,140,248,0.12)',
  danger:    '#EF4444',
  dangerDim: 'rgba(239,68,68,0.08)',
  warning:   '#F59E0B',
  warningDim:'rgba(245,158,11,0.08)',
  buy:       '#22C55E',
  sell:      '#EF4444',
};

// DEX ID mapping from GeckoTerminal to our protocol keys
export const DEX_ID_MAP = {
  'kuru': 'kuru',
  'kuru-monad': 'kuru',
  'uniswap-v2-monad': 'uniswap',
  'uniswap-v3-monad': 'uniswap',
  'uniswap-v4-monad': 'uniswap',
  'uniswap_v2': 'uniswap',
  'uniswap_v3': 'uniswap',
  'uniswap_v4': 'uniswap',
  'pancakeswap-v3-monad': 'pancakeswap',
  'pancakeswap_v3': 'pancakeswap',
  'balancer-v3-monad': 'balancer',
  'balancer_v3': 'balancer',
  'capricorn-monad': 'capricorn',
  'capricorn': 'capricorn',
  'curve-monad': 'curve',
  'curve': 'curve',
  'nadfun': 'nadfun',
  'nad-fun': 'nadfun',
  'perpl': 'perpl',
};

// API endpoints
export const API = {
  COINGECKO_MON_PRICE: 'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd&include_24hr_change=true',
  GECKOTERMINAL_POOLS: 'https://api.geckoterminal.com/api/v2/networks/monad/pools',
  GECKOTERMINAL_NEW_POOLS: 'https://api.geckoterminal.com/api/v2/networks/monad/new_pools',
  GECKOTERMINAL_TRENDING: 'https://api.geckoterminal.com/api/v2/networks/monad/trending_pools',
  GECKOTERMINAL_TRADES: (poolAddr) => `https://api.geckoterminal.com/api/v2/networks/monad/pools/${poolAddr}/trades`,
  GECKOTERMINAL_POOL: (poolAddr) => `https://api.geckoterminal.com/api/v2/networks/monad/pools/${poolAddr}`,
  DEXPAPRIKA_POOLS: 'https://api.dexpaprika.com/networks/monad/pools',
  GOPLUS_TOKEN_SECURITY: (addr) => `https://api.gopluslabs.io/api/v1/token_security/10143?contract_addresses=${addr}`,
};

// GeckoTerminal rate limit: 10 calls/min for free tier
export const POLL_INTERVALS = {
  MARKET_DATA: 30000,     // CoinGecko price: 30s
  POOLS: 15000,           // Pool data: 15s
  TRADES: 12000,          // Trades: 12s
  NEW_POOLS: 20000,       // New pools: 20s
  RPC: 400,               // Monad RPC: 400ms (via useMonadRPC)
};
