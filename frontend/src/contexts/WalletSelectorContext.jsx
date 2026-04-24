import { createContext, useCallback, useContext, useState } from 'react';
import { useConnect } from 'wagmi';

// WalletSelectorContext owns the state of the wallet picker modal.
//
// Now that MOSS is a wagmi connector, all "select a wallet" flows route
// through wagmi's useConnect — no MOSS SDK code path, no Promise.race,
// no manual timeout. Wagmi handles user-cancel by rejecting connectAsync.
//
// Public shape:
// - isOpen         boolean — modal visibility
// - open / close   imperative controls used by useWallet and the modal
// - connectors     array of wagmi connectors registered in wagmiConfig
// - selectConnector(connector, pendingLabel?)  takes a wagmi connector
//                  instance and tracks `pending` by connector.id (or by
//                  pendingLabel if provided). Closes the modal on
//                  success; sets `error` on failure.
// - cancelPending()  resets wagmi's mutation state and closes the modal
// - pending        connector.id of an in-flight connect, else null
// - error          last error from connectAsync, raw (consumers read
//                  err.message / err.shortMessage)

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

  const selectConnector = useCallback(async (connector, pendingLabel) => {
    if (!connector) {
      setError(new Error('Wallet not available'));
      setPending(null);
      return;
    }
    setError(null);
    setPending(pendingLabel ?? connector.id);
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

  const value = {
    isOpen,
    open,
    close,
    connectors,
    selectConnector,
    cancelPending,
    pending,
    error,
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
