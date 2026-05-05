/**
 * SprklFakePopup — Win98-style fake system dialog.
 *
 * Centered modal with title bar + icon + message + button row.
 * Visual matches the desktop's other Win-chrome surfaces (.win-btn,
 * .taskbar gradient, etc.). Auto-dismisses after 12s — slightly
 * longer than a regular toast because reading a fake error takes
 * longer than glancing at a chat-style notification.
 *
 * Queue semantics: SprklsLayer renders ONE fake_popup at a time
 * (centered modals stacked would be visually broken). Subsequent
 * popups in the queue mount when the current one dismisses; the
 * onMount callback fires the companion toast on each new mount.
 *
 * Keyboard a11y: Escape AND Enter both dismiss. Either is fine —
 * Enter triggers the default action (the popup's first button), and
 * since every button just dismisses anyway, treating Enter as
 * "close" matches the Win98 dialog convention. The listener is
 * registered on `window` so the user doesn't need keyboard focus
 * inside the popup itself.
 *
 * StrictMode gate: hasFiredRef prevents the onMount companion
 * callback from firing twice under React 19 StrictMode's
 * intentional double-invoke. The dismiss timer is naturally
 * idempotent (clearTimeout in cleanup) so it doesn't need its own
 * gate.
 */

import { useEffect, useRef } from 'react';
import styles from './sprkls.module.css';

const DEFAULT_DURATION_MS = 12_000;

const ICON_SYMBOL = {
  warning: '⚠️',  // ⚠️
  error:   '❌',        // ❌
  info:    'ℹ️',  // ℹ️
};

export default function SprklFakePopup({ sprkl, onDismiss, onMount }) {
  const hasFiredRef = useRef(false);

  const meta = sprkl?.visual_metadata ?? {};
  const title = meta.title ?? 'System Message';
  const icon = meta.icon ?? 'info';
  const buttons = Array.isArray(meta.buttons) && meta.buttons.length > 0
    ? meta.buttons
    : ['OK'];

  // Effect 1: companion-toast notification on mount + StrictMode gate.
  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    if (typeof onMount === 'function') {
      onMount(sprkl);
    }
  }, [sprkl, onMount]);

  // Effect 2: auto-dismiss + keyboard listener. Independent of the
  // mount effect so a re-render can't reset the dismiss timer.
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(), DEFAULT_DURATION_MS);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
    // onDismiss identity is stable from the parent's useCallback,
    // but listing it keeps the lint rule happy + correct if a future
    // refactor drops the memo.
  }, [onDismiss]);

  const handleClose = (e) => {
    e?.stopPropagation?.();
    onDismiss();
  };

  // Title-bar palette varies by icon — error is red, others use the
  // shared MSN blue gradient. Class composition picks the variant.
  const titleBarClass = icon === 'error'
    ? `${styles.sprklFakePopupTitleBar} ${styles.sprklFakePopupTitleBar_error}`
    : styles.sprklFakePopupTitleBar;

  return (
    <div
      className={styles.sprklFakePopup}
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={`sprkl-fake-popup-title-${sprkl.id}`}
    >
      <div className={titleBarClass}>
        <span
          id={`sprkl-fake-popup-title-${sprkl.id}`}
          className={styles.sprklFakePopupTitle}
        >
          {title}
        </span>
        <button
          type="button"
          className={styles.sprklFakePopupClose}
          onClick={handleClose}
          aria-label="Dismiss"
          title="Close"
        >
          ✕
        </button>
      </div>
      <div className={styles.sprklFakePopupBody}>
        <span
          className={styles.sprklFakePopupIcon}
          aria-hidden="true"
        >
          {ICON_SYMBOL[icon] || ICON_SYMBOL.info}
        </span>
        <div className={styles.sprklFakePopupMessage}>{sprkl.content}</div>
      </div>
      <div className={styles.sprklFakePopupButtons}>
        {buttons.map((btnText, i) => (
          <button
            key={`${btnText}-${i}`}
            type="button"
            className={styles.sprklFakePopupButton}
            onClick={handleClose}
            // First button is the "default action" — auto-focus so
            // Enter / Space target it cleanly. Multi-button popups
            // (Yes / No) still all dismiss the same way; the focus
            // hint just gives the user a visual default.
            autoFocus={i === 0}
          >
            {btnText}
          </button>
        ))}
      </div>
    </div>
  );
}
