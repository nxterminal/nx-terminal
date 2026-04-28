import {
  NXT_TOKEN_ADDRESS,
  NXDEVNFT_ADDRESS,
  TREASURY_ADDRESS,
  MEGAETH_CHAIN_ID,
  MEGAETH_RPC,
  EXPLORER_BASE,
} from '../services/contract';

export {
  NXT_TOKEN_ADDRESS,
  NXDEVNFT_ADDRESS,
  TREASURY_ADDRESS,
  MEGAETH_CHAIN_ID,
  MEGAETH_RPC,
  EXPLORER_BASE,
};

export const MAX_DEVS = 35000;
export const MAX_SUPPLY_NXT_FALLBACK = 1_000_000_000n;

export const POLL_DEVS_MS = 30000;
export const POLL_STATS_MS = 10000;
export const POLL_FEED_MS = 6000;
export const POLL_TOKENOMICS_MS = 60000;
export const POLL_BURN_FLAG_MS = 5 * 60 * 1000;

export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_CAP_MS = 16000;

export const DEXSCREENER_URL = `https://api.dexscreener.com/token-pairs/v1/megaeth/${NXT_TOKEN_ADDRESS}`;

export const SETTINGS_STORAGE_KEY = 'nxCity:settings';

export const MOBILE_BREAKPOINT_PX = 600;
