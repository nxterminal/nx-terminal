import { createContext, useCallback, useContext, useRef, useState } from 'react';
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
// - selectProvider(next): orchestrates disconnect-previous → connect-new →
//   setActive, with a 10s MOSS timeout and error surfacing.
// - cancelPending(): user-initiated cancellation of an in-flight MOSS
//   connect. Used by the floating cancel overlay when the iframe is open.
// - mossHidden: true after the user cancels MOSS, until they pick MOSS
//   again. The cancel overlay injects CSS to hide the iframe while this
//   is true — MOSS's SDK doesn't close its own iframe on disconnect, so
//   we do it from our side.
// - pending: which provider (if any) is currently mid-connect, for per-card
//   spinner state in the modal and for showing the cancel overlay.
// - error: last error from selectProvider, cleared on next attempt.

const MOSS_CONNECT_TIMEOUT_MS = 10_000;

const WalletSelectorContext = createContext(null);

// Turn any thrown value (Error, wagmi error object, string, etc.) into a
// readable message. wagmi errors are often plain objects with a `message`
// or `shortMessage` field; without this helper `String(err)` gives us
// "[object Object]" which leaks to the UI banner.
function toReadableMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    // wagmi/viem conventions — prefer shortMessage for UI, fall back to message.
    if (typeof err.shortMessage === 'string' && err.shortMessage) return err.shortMessage;
    if (typeof err.message === 'string' && err.message) return err.message;
    if (typeof err.name === 'string' && err.name) return err.name;
  }
  return fallback;
}

export function WalletSelectorProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  // When true, the cancel overlay injects CSS to hide the MOSS iframe.
  // Only reset when the user picks MOSS again; otherwise it stays hidden
  // so the iframe doesn't show through behind other provider flows.
  const [mossHidden, setMossHidden] = useState(false);

  const { activeProvider, setActiveProvider } = useWalletProviderContext();

  const { connectAsync: wagmiConnectAsync } = useWagmiConnect();
  const { disconnectAsync: wagmiDisconnectAsync } = useWagmiDisconnect();
  const mossConnectMutation = useMossConnect();
  const mossDisconnectMutation = useMossDisconnect();

  const cancelRef = useRef(null);

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
    // Only unhide the MOSS iframe when the user picks MOSS again. For
    // wagmi, keep it hidden so it doesn't show through behind MetaMask's
    // popup after a previous cancel.
    if (next === 'moss') {
      setMossHidden(false);
    }

    let timeoutId = null;
    const clearTimer = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const controller = {
      cancelled: false,
      cancel: null,
    };

    try {
      // D2: disconnect the previous provider before switching so we don't
      // leave a zombie session. BUT: if the previous provider was MOSS and
      // it's currently hidden (user cancelled it), calling disconnect on
      // the SDK can cause the iframe to re-mount and flash back into view.
      // Skip MOSS cleanup in that case — the iframe is already in a
      // disconnected state from the cancel, re-disconnecting is a no-op
      // in the best case and a visual glitch in the worst.
      if (activeProvider && activeProvider !== next) {
        try {
          if (activeProvider === 'wagmi') {
            await wagmiDisconnectAsync();
          } else if (activeProvider === 'moss' && !mossHidden) {
            await mossDisconnectMutation.mutateAsync();
          }
        } catch {
          /* best-effort */
        }
      }

      if (next === 'moss') {
        setIsOpen(false);
        cancelRef.current = controller;
      }

      const connectPromise =
        next === 'wagmi'
          ? wagmiConnectAsync({ connector: injected() })
          : mossConnectMutation.mutateAsync();

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
        const cancelPromise = new Promise((_, reject) => {
          controller.cancel = () => {
            controller.cancelled = true;
            reject(new Error('cancelled'));
          };
        });
        await Promise.race([connectPromise, timeoutPromise, cancelPromise]);
      } else {
        await connectPromise;
      }

      setActiveProvider(next);

      clearTimer();
      cancelRef.current = null;
      setPending(null);
      setIsOpen(false);
    } catch (err) {
      clearTimer();
      cancelRef.current = null;
      setActiveProvider(null);
      // Best-effort cleanup of any half-opened MOSS session so the SDK
      // doesn't rehydrate a zombie flow on the next attempt.
      if (next === 'moss') {
        try {
          await mossDisconnectMutation.mutateAsync();
        } catch {
          /* best-effort */
        }
        // MOSS's SDK doesn't close its own iframe. Flag it as hidden so
        // the overlay's injected CSS keeps it out of sight until the user
        // picks MOSS again.
        setMossHidden(true);
      }
      setPending(null);
      if (controller.cancelled) {
        // Manual cancel — no red banner, the user knows what they did.
        setError(null);
      } else {
        // Convert whatever was thrown into a readable message. Prevents
        // "[object Object]" from leaking to the UI when wagmi/viem throw
        // plain objects instead of Error instances.
        setError(new Error(toReadableMessage(err)));
      }
      if (next === 'moss') {
        setIsOpen(true);
      }
    }
  }, [
    activeProvider,
    mossHidden,
    setActiveProvider,
    wagmiConnectAsync,
    wagmiDisconnectAsync,
    mossConnectMutation,
    mossDisconnectMutation,
  ]);

  const cancelPending = useCallback(() => {
    const controller = cancelRef.current;
    if (controller && typeof controller.cancel === 'function') {
      controller.cancel();
    }
  }, []);

  const value = {
    isOpen,
    open,
    close,
    selectProvider,
    cancelPending,
    pending,
    error,
    mossHidden,
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
