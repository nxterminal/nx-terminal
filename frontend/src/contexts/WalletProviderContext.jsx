import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Wallet provider context
//
// Tracks which wallet provider the user is currently connected with.
// Persists to localStorage so page reloads don't lose the choice.
//
// Values:
// - 'wagmi' → MetaMask / injected provider (current behavior)
// - 'moss'  → MegaETH Wallet SDK (new, embedded iframe wallet)
// - null    → nothing connected yet; useWallet() defaults to wagmi for
//             backward compatibility so existing read-only flows keep
//             working without changes.

const LS_KEY = 'nx-wallet-provider';

const WalletProviderContext = createContext(null);

export function WalletProviderContextProvider({ children }) {
  // Lazy initial read from localStorage — only runs once on mount.
  const [activeProvider, setActiveProviderState] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved === 'wagmi' || saved === 'moss' ? saved : null;
    } catch {
      return null;
    }
  });

  // Persist on every change. setActiveProvider(null) clears the entry
  // so a fresh user sees the wallet selector again next time.
  const setActiveProvider = useCallback((next) => {
    setActiveProviderState(next);
    try {
      if (next === null) {
        localStorage.removeItem(LS_KEY);
      } else {
        localStorage.setItem(LS_KEY, next);
      }
    } catch { /* quota / privacy mode — best effort */ }
  }, []);

  // Cross-tab sync: if the user connects/disconnects in another tab,
  // this tab picks it up via the storage event. Keeps things consistent
  // without forcing a full reload.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== LS_KEY) return;
      const next = e.newValue;
      setActiveProviderState(
        next === 'wagmi' || next === 'moss' ? next : null
      );
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = {
    activeProvider,
    setActiveProvider,
    isWagmi: activeProvider === 'wagmi' || activeProvider === null,
    isMoss: activeProvider === 'moss',
  };

  return (
    <WalletProviderContext.Provider value={value}>
      {children}
    </WalletProviderContext.Provider>
  );
}

export function useWalletProviderContext() {
  const ctx = useContext(WalletProviderContext);
  if (!ctx) {
    throw new Error(
      'useWalletProviderContext must be used within <WalletProviderContextProvider>'
    );
  }
  return ctx;
}
