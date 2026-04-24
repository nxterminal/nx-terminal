import { useWalletSelector } from '../contexts/WalletSelectorContext';
import styles from './WalletSelectorCancelOverlay.module.css';

// WalletSelectorCancelOverlay — floating "Cancel" button rendered on top
// of the MOSS iframe while a connect attempt is in flight, plus a CSS
// injection that hides the MOSS iframe after a cancel.
//
// Why the CSS injection:
// The MOSS SDK mounts a fullscreen iframe (100vw x 100vh, z-index 9999)
// and doesn't close it automatically when disconnect() is called. Without
// hiding it, after the user cancels they see our reopened selector
// partially obscured by the MOSS iframe in the background, which looks
// broken. We target the iframe by its src attribute (stable across SDK
// versions since the origin is part of the product, not an impl detail).
//
// Visibility:
// - Cancel button: only while `pending === 'moss'`.
// - Hide-iframe CSS: only while `mossHidden === true`, which the context
//   sets after a MOSS cancel/timeout/error and clears on the next connect.

export default function WalletSelectorCancelOverlay() {
  const { pending, cancelPending, mossHidden } = useWalletSelector();

  const showCancelButton = pending === 'moss';
  const hideIframe = mossHidden;

  if (!showCancelButton && !hideIframe) return null;

  return (
    <>
      {hideIframe && (
        <style>{`
          iframe[src*="account.megaeth.com"] {
            display: none !important;
          }
        `}</style>
      )}
      {showCancelButton && (
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
      )}
    </>
  );
}
