/**
 * Beta-feature gating for the NX Souls UI.
 *
 * VISIBILITY-ONLY GATE. The backend chat endpoint
 * (`POST /api/devs/{token_id}/chat`) is public and gated by ownership +
 * IP rate limits + per-token daily quota. This file only controls
 * whether the chat modal *renders* in the frontend — useful while we
 * iterate on the UI with a small group of testers without exposing
 * half-finished UX to the wider community.
 *
 * To open NX Souls to everyone:
 *   - Add wallets to NX_SOULS_BETA_WALLETS (lowercase, 0x-prefixed), OR
 *   - Set NX_SOULS_BETA_OPEN = true.
 *
 * The wallet list is stored lowercased; `isInNXSoulsBeta` lowercases
 * the input before comparing because wagmi's `useAccount().address`
 * returns the EIP-55 checksum casing (mixed-case) and a direct string
 * match would silently fail.
 */

export const NX_SOULS_BETA_OPEN = false;

export const NX_SOULS_BETA_WALLETS = [
  '0xae882a8933b33429f53b7cee102ef3dbf9c9e88b', // operator
];

/**
 * @param {string | null | undefined} walletAddress wagmi-style address
 *   (checksum casing accepted; null / undefined treated as "not in beta")
 * @returns {boolean}
 */
export function isInNXSoulsBeta(walletAddress) {
  if (NX_SOULS_BETA_OPEN) return true;
  if (!walletAddress) return false;
  return NX_SOULS_BETA_WALLETS.includes(walletAddress.toLowerCase());
}
