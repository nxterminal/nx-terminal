/**
 * ChatModalHeader — title bar of the floating chat modal.
 *
 * Doubles as the react-draggable handle. The literal `msn-title-bar`
 * class is what react-draggable's `handle=".msn-title-bar"` selector
 * grabs; CSS Modules hash class names, so we apply both the module
 * class (for styling) and the literal class (for the selector match).
 * Phase 3.5 must NOT remove the literal class without also updating
 * the Draggable handle prop in <ChatModal>.
 *
 * Phase 3.2 placeholders:
 *   - "MSN Messenger - NX Terminal" in list view
 *   - "Dev #{id}" in conversation view
 *
 * Phase 3.3 will replace the conversation-view title with the real
 * Dev name once <ChatList> wires the selection through.
 */

import styles from './chat.module.css';

export default function ChatModalHeader({
  view,
  selectedDevId,
  onBack,
  onClose,
}) {
  const title =
    view === 'conversation'
      ? `NX CHAT — Dev #${selectedDevId ?? '?'}`
      : 'NX CHAT';

  return (
    <div className={`${styles.msnTitleBar} msn-title-bar`}>
      <div className={styles.msnTitle}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={styles.msnTitleBarButton}
            aria-label="Back to conversation list"
            title="Back"
          >
            ←
          </button>
        )}
        <span>{title}</span>
      </div>
      <div className={styles.msnTitleBarButtons}>
        <button
          type="button"
          onClick={onClose}
          className={styles.msnTitleBarButton}
          aria-label="Close chat"
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
