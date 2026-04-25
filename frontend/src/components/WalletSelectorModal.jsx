import { useEffect, useRef } from 'react';
import { useWalletSelector } from '../contexts/WalletSelectorContext';
import { isMossConnector } from '../services/wagmi';
import styles from './WalletSelectorModal.module.css';
import metamaskLogo from '../assets/wallets/metamasklogo.png';
import megaethLogo from '../assets/wallets/megaethlogo.png';

// WalletSelectorModal — modern dark dialog letting the user pick a wallet.
//
// Cards are driven by the wagmi connectors registered in wagmiConfig and
// exposed through the selector context. We pick the visual presentation
// per connector by inspecting it with isMossConnector — the MegaETH
// wallet connector gets the MOSS card (light icon plate); everything
// else (currently `injected`) gets MetaMask styling.
//
// Mounted once at app level, outside DevsProvider, so it must not call
// useWallet (which is used by data hooks underneath DevsProvider). Talks
// only to the selector context + isMossConnector.

function getCardPresentation(connector) {
  if (isMossConnector(connector)) {
    return {
      name: 'MOSS — MegaETH Wallet',
      subtitle: 'Embedded — no extension needed',
      logo: megaethLogo,
      iconClassName: 'cardIconMoss',
    };
  }
  return {
    name: 'MetaMask',
    subtitle: 'Browser extension',
    logo: metamaskLogo,
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

  // Show only MetaMask + MOSS in the picker. Other auto-detected injected
  // wallets (Phantom, etc.) get hidden — wagmi exposes them via EIP-6963
  // but our UI only has cards for the two supported flows. If the user
  // has no MetaMask extension, fall back to the generic 'injected'
  // connector for compatibility with Brave Wallet / Rabby.
  const hasMetaMaskExtension = connectors.some(c => c.id === 'io.metamask');
  const filteredConnectors = connectors.filter(c => {
    if (isMossConnector(c)) return true;
    if (c.id === 'io.metamask') return true;
    if (c.id === 'injected' && !hasMetaMaskExtension) return true;
    return false;
  });

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
            const { name, subtitle, logo, iconClassName } =
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
                  ) : (
                    <img
                      src={logo}
                      alt=""
                      className={styles.cardIconImg}
                      aria-hidden="true"
                      draggable="false"
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
