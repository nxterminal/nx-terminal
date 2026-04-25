import { useWalletSelector } from '../contexts/WalletSelectorContext';
import { isMossConnector } from '../services/wagmi';
import styles from './WalletSelectorCancelOverlay.module.css';

// WalletSelectorCancelOverlay — floating "Cancel" button rendered on top
// of MOSS's iframe while a connect attempt is in flight.
//
// MOSS shows a fullscreen iframe during connect with no built-in escape
// hatch; without this button the user can be stuck if they change their
// mind mid-flow. Injected wallets (MetaMask) show their own popup with
// their own cancel UX, so we don't need to overlay them.
//
// On click the button calls cancelPending(), which resets wagmi's
// useConnect mutation state — the connector tears its iframe down as
// part of that. No CSS-based iframe hiding needed any more.

export default function WalletSelectorCancelOverlay() {
  const { pending, connectors, cancelPending } = useWalletSelector();

  const pendingConnector = pending
    ? connectors.find((c) => c.id === pending)
    : null;
  const showCancelButton = isMossConnector(pendingConnector);

  if (!showCancelButton) return null;

  return (
    <div className={styles.overlay} role="presentation">
      <button
        type="button"
        className={styles.button}
        onClick={cancelPending}
        aria-label="Cancel connection and choose another wallet"
      >
        <span className={styles.icon} aria-hidden="true">×</span>
        <span className={styles.label}>Cancel & choose another wallet</span>
      </button>
    </div>
  );
}
