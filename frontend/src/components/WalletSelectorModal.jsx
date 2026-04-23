import { useEffect, useRef } from 'react';
import { useWalletSelector } from '../contexts/WalletSelectorContext';
import { useWalletProviderContext } from '../contexts/WalletProviderContext';
import { MetaMaskIcon, MegaIcon } from './WalletSelectorModal.icons';
import styles from './WalletSelectorModal.module.css';

// WalletSelectorModal — modern dark dialog letting the user pick between
// MetaMask (wagmi) and MegaETH Wallet (MOSS). Mounted once at app level so
// any consumer of useWallet().connect() can open it without per-site code.

const PROVIDERS = [
  {
    id: 'wagmi',
    name: 'MetaMask',
    subtitle: 'Browser extension',
    Icon: MetaMaskIcon,
  },
  {
    id: 'moss',
    name: 'MegaETH Wallet',
    subtitle: 'Embedded — no extension needed',
    Icon: MegaIcon,
  },
];

export default function WalletSelectorModal() {
  const { isOpen, close, selectProvider, pending, error } = useWalletSelector();
  const { activeProvider } = useWalletProviderContext();

  const dialogRef = useRef(null);
  const firstCardRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus management: remember the element that had focus before open,
  // autofocus the first wallet card, restore focus to the trigger on close.
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement;
    // Wait one frame so the dialog is mounted and the card ref is attached.
    const id = requestAnimationFrame(() => {
      firstCardRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        // Deferred so the restore happens after the dialog unmounts and
        // any blur from disabled-on-unmount buttons has settled.
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
          {PROVIDERS.map(({ id, name, subtitle, Icon }, index) => {
            const isPending = pending === id;
            const isActive = activeProvider === id;
            return (
              <button
                key={id}
                ref={index === 0 ? firstCardRef : undefined}
                type="button"
                className={styles.card}
                onClick={() => selectProvider(id)}
                disabled={pending !== null}
                aria-label={
                  isActive ? `${name} — current wallet` : `Connect with ${name}`
                }
              >
                <span className={styles.cardIcon}>
                  {isPending ? (
                    <span className={styles.spinner} aria-hidden="true" />
                  ) : (
                    <Icon size={36} />
                  )}
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.cardName}>{name}</span>
                  <span className={styles.cardSubtitle}>{subtitle}</span>
                </span>
                {isActive && (
                  <span className={styles.cardBadge} aria-hidden="true">
                    Current
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {error && (
          <div className={styles.error} role="alert">
            {error.message || 'Failed to connect. Please try again.'}
          </div>
        )}
      </div>
    </div>
  );
}
