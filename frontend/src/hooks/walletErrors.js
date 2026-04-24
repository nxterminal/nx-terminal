// frontend/src/hooks/walletErrors.js
//
// Shared error types and helpers for wallet interactions.
// Used by useWalletWagmi and useWalletMoss to normalize error handling
// across providers so callsites can react to user rejection or
// unsupported-provider conditions without caring which wallet is active.

/**
 * Thrown when the user explicitly rejects/cancels a wallet action.
 * - MetaMask: user clicks "Reject" in the popup (EIP-1193 code 4001)
 * - MOSS: TransactionResult.status === 'cancelled'
 */
export class WalletUserRejectedError extends Error {
  constructor(message = 'Transaction rejected') {
    super(message);
    this.name = 'WalletUserRejectedError';
    this.code = 'USER_REJECTED';
  }
}

/**
 * Thrown when the active provider cannot fulfill the request.
 * Used for transport failures, iframe load errors, missing SDK methods,
 * or when a feature (like wallet_watchAsset) is not supported by the
 * current provider.
 */
export class WalletUnsupportedError extends Error {
  constructor(message = 'Action not supported by current wallet') {
    super(message);
    this.name = 'WalletUnsupportedError';
    this.code = 'UNSUPPORTED';
  }
}

/**
 * Detects whether an error corresponds to a user cancellation,
 * regardless of which provider threw it.
 *
 * Matches:
 *  - Our own WalletUserRejectedError
 *  - EIP-1193 rejection code 4001
 *  - Common error messages from wagmi / viem / MetaMask / MOSS
 */
export function isUserRejection(err) {
  if (!err) return false;
  if (err instanceof WalletUserRejectedError) return true;
  if (err.code === 'USER_REJECTED') return true;
  if (err.code === 4001) return true;

  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('rejected by user') ||
    msg.includes('rejected the request') ||
    msg.includes('cancelled') ||
    msg.includes('canceled') ||
    msg.includes('user cancel')
  );
}

/**
 * Detects whether an error indicates the active provider cannot
 * handle the requested action (transport failure, missing capability,
 * iframe error, etc). Callsites can use this to suggest switching
 * wallets or falling back to an alternative flow.
 */
export function isUnsupportedByProvider(err) {
  if (!err) return false;
  if (err instanceof WalletUnsupportedError) return true;
  if (err.code === 'UNSUPPORTED') return true;

  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('not supported') ||
    msg.includes('unsupported method') ||
    msg.includes('method not found') ||
    msg.includes('no provider') ||
    msg.includes('provider not available') ||
    msg.includes('connector not connected')
  );
}

/**
 * Normalizes an error into a short human-readable string suitable
 * for UI display. Strips stack traces, JSON-RPC noise, and the
 * "Error:" prefix that some libraries prepend.
 *
 * Falls back to a generic message if nothing usable is found.
 */
export function toReadableMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;

  if (isUserRejection(err)) return 'Transaction rejected';
  if (isUnsupportedByProvider(err)) {
    return 'Action not supported by your wallet';
  }

  let msg = err.shortMessage || err.message || String(err);

  // Strip common prefixes
  msg = msg.replace(/^Error:\s*/i, '');

  // Strip JSON-RPC response wrappers some libs add
  const rpcMatch = msg.match(/reason:\s*([^\n]+)/i);
  if (rpcMatch) msg = rpcMatch[1];

  // Cap length so we don't dump a stack trace into the UI
  if (msg.length > 140) msg = msg.slice(0, 137) + '...';

  return msg.trim() || fallback;
}
