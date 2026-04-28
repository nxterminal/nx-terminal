import { useEffect, useRef } from 'react';
import { Wallet } from 'lucide-react';
import { useWalletSelector } from '../contexts/WalletSelectorContext';
import { isMossConnector, SHOW_MOSS_WALLET } from '../services/wagmi';
import styles from './WalletSelectorModal.module.css';
import metamaskLogo from '../assets/wallets/metamasklogo.png';
import megaethLogo from '../assets/wallets/megaethlogo.png';

// WalletSelectorModal — modern dark dialog letting the user pick a wallet.
//
// Cards are driven by the wagmi connectors registered in wagmiConfig and
// exposed through the selector context. wagmi v2 auto-merges every
// EIP-6963-announced extension (Rabby, Coinbase, Frame, Trust, OKX,
// Brave, …) into the connectors array on top of the two we register
// explicitly (`injected()` and the MOSS wagmi connector).
//
// Presentation rules:
//  - MOSS              → hardcoded card (cream icon plate, brand PNG)
//  - io.metamask       → hardcoded card (MetaMask PNG, "Browser extension")
//  - any other EIP-6963 connector → uses connector.icon + connector.name
//                        from the wallet's own announcement (the EIP-6963
//                        spec mandates both fields, so this works for
//                        every spec-compliant wallet)
//  - the generic `injected()` fallback is shown only when no EIP-6963
//                        connector is announced, labeled "Other wallet"
//                        with a neutral lucide icon — never as MetaMask
//
// Mounted once at app level, outside DevsProvider, so it must not call
// useWallet (which is used by data hooks underneath DevsProvider). Talks
// only to the selector context + isMossConnector.

const GENERIC_INJECTED_ID = 'injected';

// True for connectors that came in via wagmi's EIP-6963 auto-discovery.
// We identify them by exclusion — anything that isn't MOSS and isn't the
// generic `injected()` fallback was added by the announcement listener.
function isEip6963Connector(connector) {
  return (
    !isMossConnector(connector) && connector?.id !== GENERIC_INJECTED_ID
  );
}

function getCardPresentation(connector) {
  if (isMossConnector(connector)) {
    return {
      name: 'MOSS — MegaETH Wallet',
      subtitle: 'Embedded — no extension needed',
      logoSrc: megaethLogo,
      iconClassName: 'cardIconMoss',
    };
  }
  if (connector?.id === 'io.metamask') {
    return {
      name: 'MetaMask',
      subtitle: 'Browser extension',
      logoSrc: metamaskLogo,
      iconClassName: 'cardIcon',
    };
  }
  if (connector?.id === GENERIC_INJECTED_ID) {
    return {
      name: 'Other wallet',
      subtitle: 'Browser extension',
      lucideIcon: Wallet,
      iconClassName: 'cardIcon',
    };
  }
  // Generic EIP-6963 connector — use the metadata the wallet itself
  // announced. The spec requires both `name` and `icon` (data URI), so
  // both should always be present; fall back defensively just in case.
  return {
    name: connector?.name || 'Browser wallet',
    subtitle: 'Browser extension',
    logoSrc: connector?.icon || null,
    iconClassName: 'cardIcon',
  };
}

export default function WalletSelectorModal() {
  const {
    isOpen,
    close,
    connectors,
    selectConnector,
    pending,
    error,
  } = useWalletSelector();

  const dialogRef = useRef(null);
  const firstCardRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Build the ordered list of cards.
  //   1. MOSS first — recommended MegaETH wallet, top-of-modal placement.
  //   2. MetaMask second when announced (familiar default for crypto users).
  //   3. Every other EIP-6963 connector, alphabetical by display name.
  //   4. The generic `injected()` fallback only when no EIP-6963 wallet
  //      announced itself — avoids duplicating Rabby / MetaMask under
  //      the misleading "Other wallet" label when their EIP-6963
  //      connector is already in the list.
  const moss = SHOW_MOSS_WALLET ? connectors.find(isMossConnector) : null;
  const eip6963 = connectors
    .filter(isEip6963Connector)
    .sort((a, b) => {
      if (a.id === 'io.metamask') return -1;
      if (b.id === 'io.metamask') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  const genericInjected = connectors.find(
    (c) => c.id === GENERIC_INJECTED_ID
  );
  const filteredConnectors = [
    ...(moss ? [moss] : []),
    ...eip6963,
    ...(eip6963.length === 0 && genericInjected ? [genericInjected] : []),
  ];

  // Focus management: remember the element that had focus before open,
  // autofocus the first wallet card, restore focus to the trigger on close.
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement;
    const id = requestAnimationFrame(() => {
      firstCardRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        requestAnimationFrame(() => prev.focus());
      }
    };
  }, [isOpen]);

  // Keyboard handling: Escape closes (when not pending); Tab wraps between
  // the first and last focusable elements inside the dialog so keyboard
  // users can't accidentally tab out into the rest of the app.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (pending === null) close();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, pending, close]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (pending === null) close();
  };

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-title"
        aria-describedby="ws-desc"
        aria-busy={pending !== null}
      >
        <div className={styles.header}>
          <h2 id="ws-title" className={styles.title}>
            Connect a wallet
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Close"
            disabled={pending !== null}
          >
            ×
          </button>
        </div>
        <p id="ws-desc" className={styles.description}>
          Choose how you&apos;d like to connect to MegaETH.
        </p>
        <div className={styles.cards}>
          {filteredConnectors.map((connector, index) => {
            const { name, subtitle, logoSrc, lucideIcon: LucideIcon, iconClassName } =
              getCardPresentation(connector);
            const isPending =
              connector.id != null && pending === connector.id;
            return (
              <button
                key={
                  connector.uid ||
                  connector.id ||
                  connector.name ||
                  `connector-${index}`
                }
                ref={index === 0 ? firstCardRef : undefined}
                type="button"
                className={styles.card}
                onClick={() => selectConnector(connector)}
                disabled={pending !== null}
                aria-label={`Connect with ${name}`}
              >
                <span className={styles[iconClassName]}>
                  {isPending ? (
                    <span className={styles.spinner} aria-hidden="true" />
                  ) : LucideIcon ? (
                    <LucideIcon
                      className={styles.cardIconLucide}
                      aria-hidden="true"
                    />
                  ) : logoSrc ? (
                    <img
                      src={logoSrc}
                      alt=""
                      className={styles.cardIconImg}
                      aria-hidden="true"
                      draggable="false"
                    />
                  ) : (
                    <Wallet
                      className={styles.cardIconLucide}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.cardName}>{name}</span>
                  <span className={styles.cardSubtitle}>{subtitle}</span>
                </span>
                <span className={styles.cardArrow} aria-hidden="true">→</span>
              </button>
            );
          })}
        </div>
        {error && (
          <div className={styles.error} role="alert">
            {error.shortMessage ||
              error.message ||
              'Failed to connect. Please try again.'}
          </div>
        )}
      </div>
    </div>
  );
}
