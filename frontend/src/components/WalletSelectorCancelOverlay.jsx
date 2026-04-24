import { useWalletSelector } from '../contexts/WalletSelectorContext';
import styles from './WalletSelectorCancelOverlay.module.css';

// WalletSelectorCancelOverlay — floating "Cancel" button rendered on top
// of the MOSS iframe while a connect attempt is in flight.
//
// Why this exists:
// The MOSS SDK iframe can leave the user stranded — if they cancel inside
// the iframe (close the passkey dialog, abandon the code entry, etc.) the
// iframe doesn't always close automatically, and our connect mutation
// stays pending until the 10s client-side timeout fires. This overlay
// gives users an explicit escape hatch: one click aborts the pending
// mutation, clears activeProvider, and re-opens the wallet selector.
//
// Visibility: only renders when `pending === 'moss'`. MetaMask has its
// own native cancel inside the browser extension popup, so we don't need
// a custom overlay for the wagmi flow.
//
// Z-index: 10100, explicitly above the MOSS iframe's hardcoded 9999 so
// the button is clickable over the iframe. Below nothing else in the app.

export default function WalletSelectorCancelOverlay() {
  const { pending, cancelPending } = useWalletSelector();

  if (pending !== 'moss') return null;

  return (
    <div className={styles.overlay} role="presentation">
      <button
        type="button"
        className={styles.button}
        onClick={cancelPending}
        aria-label="Cancel connection and choose another wallet"
      >
        <span className={styles.icon} aria-hidden="true">×</span>
        <span className={styles.label}>Cancel</span>
      </button>
    </div>
  );
}
