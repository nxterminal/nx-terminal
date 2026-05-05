/**
 * ChatConversationHeader — Dev info strip at the top of the
 * conversation pane.
 *
 * Phase 3.5.2 reshape: this is no longer the modal-level title bar.
 * The split-view layout always keeps <ChatModalHeader> at the top
 * of the modal (drag handle, sound toggle, close button); this
 * component is now a slim inline strip that gives the conversation
 * pane its dev-context (avatar + name + archetype + status).
 *
 * NO drag handle: the literal `msn-title-bar` class is intentionally
 * NOT applied here so a click on this strip doesn't drag the modal.
 * react-draggable's handle selector still finds the element on
 * <ChatModalHeader>, which keeps the modal moveable.
 *
 * NO close button: <ChatModalHeader>'s ✕ owns close.
 *
 * Optional back arrow: only renders when `onBack` is provided. On
 * desktop split view, the parent passes nothing (the list is always
 * visible — there's nowhere to go "back" to). On mobile it's the
 * only way to return to the list.
 */

import ChatStatusIndicator, { getDevChatStatus } from './ChatStatusIndicator';
import styles from './chat.module.css';

const HEADER_AVATAR_SIZE_PX = 36;

export default function ChatConversationHeader({ dev, onBack }) {
  const status = getDevChatStatus(dev);

  return (
    <div className={styles.chatConversationStrip}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className={styles.chatConversationStripBack}
          aria-label="Back to conversation list"
          title="Back"
        >
          ←
        </button>
      ) : null}
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
      <span className={styles.chatHeaderArchetype}>{dev?.archetype ?? ''}</span>
      <ChatStatusIndicator status={status} showLabel />
    </div>
  );
}
