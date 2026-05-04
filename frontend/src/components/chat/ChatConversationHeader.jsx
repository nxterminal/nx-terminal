/**
 * ChatConversationHeader — title bar shown while the modal is in
 * conversation view. Replaces ChatModalHeader for this view so the
 * Dev's avatar / name / archetype / status indicator can sit where
 * the generic title used to be.
 *
 * This element MUST carry the literal `msn-title-bar` class so
 * react-draggable's `handle=".msn-title-bar"` selector in <ChatModal>
 * still grabs it as the drag handle. CSS Modules hash class names so
 * the literal class is added in addition to the module class —
 * mirrors the pattern in ChatModalHeader.
 *
 * Phase 3.5:
 *   - Avatar uses the MyDevs PFP-zoom pattern (scale 2.2 +
 *     transformOrigin 'center 32%') so the Dev's face / whiskers
 *     land in frame instead of the full body. The `overflow: hidden`
 *     wrapper clips the overflow.
 *   - Status indicator opts into `showLabel` so the user gets
 *     "Active" / "Resting" / etc. inline next to the dot.
 *   - 🔊 / 🔇 toggle reads / writes chatSoundsEnabled on context.
 */

import { useChatModal } from '../../contexts/ChatContext';
import ChatStatusIndicator, { getDevChatStatus } from './ChatStatusIndicator';
import styles from './chat.module.css';

const HEADER_AVATAR_SIZE_PX = 36;

export default function ChatConversationHeader({ dev, onBack, onClose }) {
  const status = getDevChatStatus(dev);
  const { chatSoundsEnabled, toggleChatSounds } = useChatModal();

  return (
    <div className={`${styles.msnTitleBar} msn-title-bar`}>
      <div className={styles.msnTitle}>
        <button
          type="button"
          onClick={onBack}
          className={styles.msnTitleBarButton}
          aria-label="Back to conversation list"
          title="Back"
        >
          ←
        </button>
        <div
          className={styles.chatAvatarFrame}
          style={{
            width: HEADER_AVATAR_SIZE_PX,
            height: HEADER_AVATAR_SIZE_PX,
          }}
        >
          {dev?.ipfs_image ? (
            <img
              src={dev.ipfs_image}
              alt=""
              loading="lazy"
              className={styles.chatAvatarImage}
            />
          ) : (
            <div className={styles.chatAvatarFallback}>
              {dev?.name?.slice(0, 2).toUpperCase() || '??'}
            </div>
          )}
        </div>
        <span className={styles.chatHeaderName}>{dev?.name ?? 'Dev'}</span>
        <span className={styles.chatHeaderArchetype}>
          {dev?.archetype ?? ''}
        </span>
        <ChatStatusIndicator status={status} showLabel />
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
