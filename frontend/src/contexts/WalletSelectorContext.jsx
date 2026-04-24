import { createContext, useCallback, useContext, useState } from 'react';
import { useConnect } from 'wagmi';
import { isMossConnector } from '../services/wagmi';

// WalletSelectorContext owns the state of the wallet picker modal.
//
// Now that MOSS is a wagmi connector, all "select a wallet" flows route
// through wagmi's useConnect — no MOSS SDK code path, no Promise.race,
// no manual timeout. Wagmi handles user-cancel by rejecting connectAsync.
//
// Public shape:
// - isOpen         boolean — modal visibility
// - open / close   imperative controls used by useWallet and the modal
// - selectConnector(connector)  canonical: takes a wagmi connector
//                  instance from useConnect().connectors. Tracks `pending`
//                  by connector.id, closes on success.
// - cancelPending()  resets wagmi's mutation state and closes the modal
// - pending        connector.id of an in-flight connect, else null
// - error          last error from connectAsync, raw (consumers read
//                  err.message / err.shortMessage)
//
// Deprecated, removed in chunk 3 alongside the modal/overlay rewrite:
// - selectProvider(legacyId)   maps 'wagmi'|'moss' → connector
// - mossHidden                 always false; old overlay used to inject
//                              CSS to hide MOSS's iframe after a cancel,
//                              no longer needed (wagmi connector owns its
//                              own iframe lifecycle)

const WalletSelectorContext = createContext(null);

export function WalletSelectorProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  const { connectAsync, connectors, reset } = useConnect();

  const open = useCallback(() => {
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectConnector = useCallback(async (connector) => {
    if (!connector) {
      setError(new Error('Wallet not available'));
      return;
    }
    setError(null);
    setPending(connector.id);
    try {
      await connectAsync({ connector });
      setIsOpen(false);
    } catch (err) {
      // wagmi rejects connectAsync with the underlying provider error on
      // user cancel, transport failure, etc. Pass through so the modal
      // can read err.message / err.shortMessage as before.
      setError(err);
    } finally {
      setPending(null);
    }
  }, [connectAsync]);

  // wagmi's useConnect tracks an internal mutation state. reset() clears
  // any in-flight error/status so the next open of the modal starts clean.
  const cancelPending = useCallback(() => {
    reset();
    setPending(null);
    setIsOpen(false);
  }, [reset]);

  // Deprecated alias for the legacy 'wagmi'|'moss' string API. Maps to a
  // concrete connector and forwards through the same connect path.
  // Pending stays the legacy string for the duration so the existing
  // modal's `pending === 'moss'` check keeps working until chunk 3.
  const selectProvider = useCallback(async (legacyId) => {
    const connector =
      legacyId === 'wagmi'
        ? connectors.find((c) => !isMossConnector(c))
        : legacyId === 'moss'
          ? connectors.find(isMossConnector)
          : null;
    if (!connector) {
      setError(new Error('Wallet not available'));
      return;
    }
    setError(null);
    setPending(legacyId);
    try {
      await connectAsync({ connector });
      setIsOpen(false);
    } catch (err) {
      setError(err);
    } finally {
      setPending(null);
    }
  }, [connectAsync, connectors]);

  const value = {
    isOpen,
    open,
    close,
    selectConnector,
    cancelPending,
    pending,
    error,
    // Deprecated. Removed in chunk 3.
    selectProvider,
    mossHidden: false,
  };

  return (
    <WalletSelectorContext.Provider value={value}>
      {children}
    </WalletSelectorContext.Provider>
  );
}

export function useWalletSelector() {
  const ctx = useContext(WalletSelectorContext);
  if (!ctx) {
    throw new Error(
      'useWalletSelector must be used within <WalletSelectorProvider>'
    );
  }
  return ctx;
}
