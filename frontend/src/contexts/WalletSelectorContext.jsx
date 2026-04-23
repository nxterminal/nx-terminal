import { createContext, useCallback, useContext, useState } from 'react';

// WalletSelectorContext owns the state of the provider-picker modal and
// the orchestration for switching between wagmi and MOSS. Scaffolded in
// commit 1 with stubbed behavior so subsequent commits can plug in UI and
// wiring without changing the public surface.
//
// After all commits land, the shape below is:
// - isOpen: whether the selector modal is currently visible.
// - open / close: imperative controls, used by useWallet when activeProvider
//   is null and by the modal itself.
// - selectProvider(next): orchestrates disconnect-previous → setActive →
//   connect-new, with a 30s timeout and error surfacing.
// - pending: which provider (if any) is currently mid-connect, for per-card
//   spinner state in the modal.
// - error: last error from selectProvider, cleared on next attempt.

const WalletSelectorContext = createContext(null);

export function WalletSelectorProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending] = useState(null);
  const [error] = useState(null);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Stubbed in commit 1. Real orchestration (disconnect-previous, set
  // active, connect-new, 30s timeout) is wired in commit 3.
  const selectProvider = useCallback(async (_next) => {
    return undefined;
  }, []);

  const value = {
    isOpen,
    open,
    close,
    selectProvider,
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
