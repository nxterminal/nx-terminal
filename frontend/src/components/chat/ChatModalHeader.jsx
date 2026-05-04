/**
 * ChatModalHeader — title bar of the floating chat modal in list view
 * (and in the loading shell when the conversation view's selected dev
 * hasn't resolved yet).
 *
 * Doubles as the react-draggable handle. The literal `msn-title-bar`
 * class is what react-draggable's `handle=".msn-title-bar"` selector
 * grabs; CSS Modules hash class names, so we apply both the module
 * class (for styling) and the literal class (for the selector match).
 * Phase 3.5 must NOT remove the literal class without also updating
 * the Draggable handle prop in <ChatModal>.
 *
 * Phase 3.5 additions:
 *   - 🔊 / 🔇 toggle button between the title and the close button.
 *     Reads / writes chatSoundsEnabled on ChatContext.
 */

import { useChatModal } from '../../contexts/ChatContext';
import styles from './chat.module.css';

export default function ChatModalHeader({
  view,
  selectedDevId,
  onBack,
  onClose,
}) {
  const { chatSoundsEnabled, toggleChatSounds } = useChatModal();
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
          onClick={toggleChatSounds}
          className={styles.msnTitleBarButton}
          aria-label={
            chatSoundsEnabled
              ? 'Disable chat sounds'
              : 'Enable chat sounds'
          }
          title={chatSoundsEnabled ? 'Sounds: on' : 'Sounds: off'}
        >
          {chatSoundsEnabled ? '🔊' : '🔇'}
        </button>
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
