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
// - mossHidden: true after the user cancels MOSS, until a new connect
//   attempt starts. The cancel overlay injects CSS to hide the iframe
//   while this is true — MOSS's SDK doesn't close its own iframe on
//   disconnect, so we do it from our side.
// - pending: which provider (if any) is currently mid-connect, for per-card
//   spinner state in the modal and for showing the cancel overlay.
// - error: last error from selectProvider, cleared on next attempt.

// Lowered from 30s → 10s. The iframe is open and interactive during this
// window, so a user who actually wants to complete the flow will click
// something well before the timeout fires. 10s is long enough for the
// code-input + passkey exchange to start, short enough that a user who
// abandons gets the selector back without an awkward wait.
const MOSS_CONNECT_TIMEOUT_MS = 10_000;

const WalletSelectorContext = createContext(null);

export function WalletSelectorProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  // When true, the cancel overlay injects CSS to hide the MOSS iframe.
  // Cleared automatically at the start of any new selectProvider() call.
  const [mossHidden, setMossHidden] = useState(false);

  const { activeProvider, setActiveProvider } = useWalletProviderContext();

  // Both providers' mutations are subscribed unconditionally so we always
  // have stable async handles regardless of which one is currently active.
  // This is the same "call both, use one" pattern as useWallet.js.
  const { connectAsync: wagmiConnectAsync } = useWagmiConnect();
  const { disconnectAsync: wagmiDisconnectAsync } = useWagmiDisconnect();
  const mossConnectMutation = useMossConnect();
  const mossDisconnectMutation = useMossDisconnect();

  // Ref to the current in-flight cancel signaller. When the user clicks
  // the cancel overlay, we reject the MOSS connect promise through this
  // controller and the selectProvider() try/catch handles the rest.
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
    // Reset the hidden flag — if the iframe was hidden from a previous
    // cancel, any new connect attempt should make it interactive again
    // (in case the new attempt is for MOSS itself).
    setMossHidden(false);

    let timeoutId = null;
    const clearTimer = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // Local controller for this specific selectProvider invocation.
    // Stored in cancelRef so the overlay can reach it; cleared when the
    // flow resolves (success, timeout, error, or manual cancel).
    const controller = {
      cancelled: false,
      cancel: null,
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

      // Close the selector modal before MOSS connects so its iframe
      // (z-index 9999, hardcoded by the SDK) isn't obscured by our modal
      // (z-index 10050). The iframe must be interactable for the user to
      // complete the passkey flow. wagmi uses a native extension popup
      // that renders above everything, so no early-close needed there.
      if (next === 'moss') {
        setIsOpen(false);
        // Expose this invocation's controller so the cancel overlay can
        // reach it. Only set for moss because wagmi has the browser's
        // native cancel in its extension popup.
        cancelRef.current = controller;
      }

      const connectPromise =
        next === 'wagmi'
          ? wagmiConnectAsync({ connector: injected() })
          : mossConnectMutation.mutateAsync();

      if (next === 'moss') {
        // Race the connect against: (1) a 10s timeout, (2) a manual cancel
        // from the user via the overlay. Whichever wins first rejects the
        // overall promise and lands us in the catch block.
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

      // Only commit activeProvider AFTER a successful connection.
      // If the user cancels or the connect throws, we fall into catch()
      // and never persist the choice — so the next Connect click opens
      // the selector again instead of blindly routing to the half-chosen
      // provider.
      setActiveProvider(next);

      clearTimer();
      cancelRef.current = null;
      setPending(null);
      setIsOpen(false);
    } catch (err) {
      clearTimer();
      cancelRef.current = null;
      // Defensively clear activeProvider on failure. Guarantees the
      // selector re-appears on the next Connect click regardless of
      // what went wrong (timeout, cancel, MetaMask rejection, etc.).
      setActiveProvider(null);
      // Best-effort cleanup of any half-opened MOSS session so the SDK
      // doesn't rehydrate a zombie flow on the next attempt.
      if (next === 'moss') {
        try {
          await mossDisconnectMutation.mutateAsync();
        } catch {
          /* best-effort */
        }
        // The MOSS SDK doesn't close its own iframe on disconnect. Flag
        // it as hidden so the cancel overlay injects CSS to hide it;
        // this lets the user see the reopened selector without MOSS's
        // iframe covering everything.
        setMossHidden(true);
      }
      setPending(null);
      // Distinguish manual cancel from real errors — no red banner for
      // cancels, the user knows what they did.
      if (controller.cancelled) {
        setError(null);
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      // Re-open the selector after MOSS failures so the user lands back
      // on the picker instead of an empty screen. wagmi never closed the
      // modal in the first place, so no re-open needed there.
      if (next === 'moss') {
        setIsOpen(true);
      }
    }
  }, [
    activeProvider,
    setActiveProvider,
    wagmiConnectAsync,
    wagmiDisconnectAsync,
    mossConnectMutation,
    mossDisconnectMutation,
  ]);

  // Called by the floating cancel overlay. Triggers the cancel promise
  // inside the current selectProvider() call, which causes it to reject
  // and fall into the catch block (setting activeProvider=null, clearing
  // pending, re-opening the selector).
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
