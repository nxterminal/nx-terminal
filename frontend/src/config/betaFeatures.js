/**
 * Beta-feature gating for the NX Souls UI.
 *
 * VISIBILITY-ONLY GATE. The backend chat endpoint
 * (`POST /api/devs/{token_id}/chat`) is public and gated by ownership +
 * IP rate limits + per-token daily quota + per-wallet 30/day cap
 * (Phase 5.5). This file only controls whether the chat modal *renders*
 * in the frontend.
 *
 * Phase 5.7: `NX_SOULS_BETA_OPEN` flipped to `true` — NX CHAT is now
 * open to all wallets. `isInNXSoulsBeta` short-circuits to `true` on
 * the first line, so the allowlist below is now a no-op dead branch
 * (kept in place for a separate cleanup PR and so flipping the flag
 * back to `false` instantly re-gates without re-typing the operator
 * wallet).
 *
 * Re-gating to a smaller cohort:
 *   - Flip NX_SOULS_BETA_OPEN back to false, OR
 *   - Replace the allowlist with the testers' wallets (lowercase,
 *     0x-prefixed) and flip the flag back.
 *
 * The wallet list is stored lowercased; `isInNXSoulsBeta` lowercases
 * the input before comparing because wagmi's `useAccount().address`
 * returns the EIP-55 checksum casing (mixed-case) and a direct string
 * match would silently fail.
 */

export const NX_SOULS_BETA_OPEN = true;

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
