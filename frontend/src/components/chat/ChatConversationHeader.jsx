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
 */

import ChatStatusIndicator, { getDevChatStatus } from './ChatStatusIndicator';
import styles from './chat.module.css';

export default function ChatConversationHeader({ dev, onBack, onClose }) {
  const status = getDevChatStatus(dev);

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
        {dev?.ipfs_image ? (
          <img
            src={dev.ipfs_image}
            alt=""
            className={styles.chatHeaderAvatarMini}
            loading="lazy"
          />
        ) : null}
        <span className={styles.chatHeaderName}>{dev?.name ?? 'Dev'}</span>
        <span className={styles.chatHeaderArchetype}>
          {dev?.archetype ?? ''}
        </span>
        <ChatStatusIndicator status={status} />
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
