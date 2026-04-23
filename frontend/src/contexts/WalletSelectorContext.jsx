import { createContext, useCallback, useContext, useState } from 'react';
import { useConnect as useWagmiConnect, useDisconnect as useWagmiDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  useConnect as useMossConnect,
  useDisconnect as useMossDisconnect,
} from '@megaeth-labs/wallet-sdk-react';
import { useWalletProviderContext } from './WalletProviderContext';

// WalletSelectorContext owns the state of the provider-picker modal and
// the orchestration for switching between wagmi and MOSS.
//
// Public shape:
// - isOpen: whether the selector modal is currently visible.
// - open / close: imperative controls, used by useWallet when activeProvider
//   is null and by the modal itself.
// - selectProvider(next): orchestrates disconnect-previous → setActive →
//   connect-new, with a 30s MOSS timeout and error surfacing.
// - pending: which provider (if any) is currently mid-connect, for per-card
//   spinner state in the modal.
// - error: last error from selectProvider, cleared on next attempt.

const MOSS_CONNECT_TIMEOUT_MS = 30_000;

const WalletSelectorContext = createContext(null);

export function WalletSelectorProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  const { activeProvider, setActiveProvider } = useWalletProviderContext();

  // Both providers' mutations are subscribed unconditionally so we always
  // have stable async handles regardless of which one is currently active.
  // This is the same "call both, use one" pattern as useWallet.js.
  const { connectAsync: wagmiConnectAsync } = useWagmiConnect();
  const { disconnectAsync: wagmiDisconnectAsync } = useWagmiDisconnect();
  const mossConnectMutation = useMossConnect();
  const mossDisconnectMutation = useMossDisconnect();

  const open = useCallback(() => {
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectProvider = useCallback(async (next) => {
    if (next !== 'wagmi' && next !== 'moss') return;

    setError(null);
    setPending(next);

    let timeoutId = null;
    const clearTimer = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    try {
      // D2: disconnect the previous provider before switching so we don't
      // leave a zombie session in MetaMask or the MOSS iframe. Errors here
      // are non-fatal — the user is switching anyway, a failed cleanup
      // shouldn't block the new connect.
      if (activeProvider && activeProvider !== next) {
        try {
          if (activeProvider === 'wagmi') {
            await wagmiDisconnectAsync();
          } else if (activeProvider === 'moss') {
            await mossDisconnectMutation.mutateAsync();
          }
        } catch {
          /* best-effort */
        }
      }

      setActiveProvider(next);

      const connectPromise =
        next === 'wagmi'
          ? wagmiConnectAsync({ connector: injected() })
          : mossConnectMutation.mutateAsync();

      // D1: 30s client-side timeout on MOSS connects only. wagmi already
      // surfaces UserRejected / popup-dismissed errors cleanly; the MOSS
      // iframe can hang silently, so we race it against a timer and leave
      // the modal open for retry when it fires.
      if (next === 'moss') {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                'Timed out connecting to MegaETH Wallet. Please try again.'
              )
            );
          }, MOSS_CONNECT_TIMEOUT_MS);
        });
        await Promise.race([connectPromise, timeoutPromise]);
      } else {
        await connectPromise;
      }

      clearTimer();
      setPending(null);
      setIsOpen(false);
    } catch (err) {
      clearTimer();
      setError(err instanceof Error ? err : new Error(String(err)));
      setPending(null);
    }
  }, [
    activeProvider,
    setActiveProvider,
    wagmiConnectAsync,
    wagmiDisconnectAsync,
    mossConnectMutation,
    mossDisconnectMutation,
  ]);

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
