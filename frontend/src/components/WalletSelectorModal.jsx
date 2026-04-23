import { useEffect } from 'react';
import { useWalletSelector } from '../contexts/WalletSelectorContext';
import { useWalletProviderContext } from '../contexts/WalletProviderContext';
import { MetaMaskIcon, MegaIcon } from './WalletSelectorModal.icons';
import styles from './WalletSelectorModal.module.css';

// WalletSelectorModal — modern dark dialog letting the user pick between
// MetaMask (wagmi) and MegaETH Wallet (MOSS). Mounted once at app level so
// any consumer of useWallet().connect() can open it without per-site code.
//
// Visual-only in commit 2: reads isOpen/close from the selector context but
// the cards call a selectProvider that's still a no-op. Wiring is finished
// in commit 3; accessibility (focus trap, return-focus, aria plumbing) in
// commit 5.

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

  // Escape-to-close. Kept minimal here; commit 5 layers a focus trap on top.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && pending === null) close();
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
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-title"
        aria-describedby="ws-desc"
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
          {PROVIDERS.map(({ id, name, subtitle, Icon }) => {
            const isPending = pending === id;
            const isActive = activeProvider === id;
            return (
              <button
                key={id}
                type="button"
                className={styles.card}
                onClick={() => selectProvider(id)}
                disabled={pending !== null}
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
                  <span className={styles.cardBadge}>Current</span>
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
