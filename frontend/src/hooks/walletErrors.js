// walletErrors — shared helpers for writeContract() error handling across
// providers (wagmi and MOSS). The two SDKs have very different error shapes:
//
// - wagmi throws: UserRejectedRequestError, ContractFunctionExecutionError,
//   ChainMismatchError, etc. All are subclasses of Error.
// - MOSS does NOT throw on user rejection. Its callContract() resolves with
//   { status: 'cancelled' | 'error' | 'approved' }. The wrapper in
//   useWalletMoss converts 'cancelled'/'error' to thrown Errors so callsites
//   see a uniform throw-on-failure contract.
//
// These helpers let the UI decide: was this a user-intentional cancel (no
// red error banner, just close the modal) or a real failure (show message)?

// Sentinel error thrown by useWalletMoss's writeContract wrapper when the
// user cancels inside the MOSS iframe. Callsites can use isUserRejection()
// to detect both this and wagmi's UserRejectedRequestError with one check.
export class WalletUserRejectedError extends Error {
  constructor(message = 'User rejected the request') {
    super(message);
    this.name = 'WalletUserRejectedError';
    this.code = 'USER_REJECTED';
  }
}

// Sentinel error thrown when the active provider does not support the action
// being attempted (e.g. MOSS receives a write request but the SDK returned
// a non-standard error that suggests the feature isn't implemented yet).
// Callsites use this to offer the "switch to MetaMask" fallback.
export class WalletUnsupportedError extends Error {
  constructor(message = 'This action is not supported by the current wallet') {
    super(message);
    this.name = 'WalletUnsupportedError';
    this.code = 'UNSUPPORTED';
  }
}

// Returns true if the error looks like the user intentionally cancelled the
// action (closed the wallet popup, clicked reject, dismissed the iframe).
// Handles both wagmi's UserRejectedRequestError (exposed as err.name or
// err.code 4001 / 'ACTION_REJECTED') and our sentinel from MOSS.
export function isUserRejection(err) {
  if (!err) return false;
  if (err instanceof WalletUserRejectedError) return true;
  if (err?.code === 'USER_REJECTED') return true;
  if (err?.code === 4001) return true;
  if (err?.code === 'ACTION_REJECTED') return true;
  // wagmi/viem error name
  if (err?.name === 'UserRejectedRequestError') return true;
  // Some wrappers put it in shortMessage/message
  const msg = (err?.shortMessage || err?.message || '').toLowerCase();
  if (msg.includes('user rejected')) return true;
  if (msg.includes('user denied')) return true;
  if (msg.includes('rejected by user')) return true;
  if (msg.includes('cancelled')) return true;
  return false;
}

// True if the error indicates the user's current provider can't do what was
// asked. Callsites can prompt to switch providers.
export function isUnsupportedByProvider(err) {
  if (!err) return false;
  if (err instanceof WalletUnsupportedError) return true;
  if (err?.code === 'UNSUPPORTED') return true;
  return false;
}

// Pulls a human-readable message out of any error shape. Mirrors the helper
// used in WalletSelectorContext.
export function toReadableMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    if (typeof err.shortMessage === 'string' && err.shortMessage) return err.shortMessage;
    if (typeof err.message === 'string' && err.message) return err.message;
    if (typeof err.name === 'string' && err.name) return err.name;
  }
  return fallback;
}
