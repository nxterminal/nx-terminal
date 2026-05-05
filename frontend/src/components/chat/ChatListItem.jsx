/**
 * ChatListItem — one row in the NX Souls chat list.
 *
 * Phase 3.5.2 reshape: the row now covers two layouts depending on
 * which list is rendering it.
 *
 *   1. Active-chats list (left pane of split view):
 *        Avatar | name + archetype + last-message preview |
 *               status (with label) + relative time
 *      Carries `selected` styling when this row's token_id matches
 *      the parent's selectedTokenId.
 *
 *   2. NewChatPicker list (nested overlay):
 *        Avatar | name + archetype | status (with label)
 *      No preview, no time, no selected state — the picker is for
 *      starting a NEW chat with a Dev that has no active history.
 *
 * The same component handles both because the only difference is
 * the optional `last_message` field on the dev row + the optional
 * `selected` prop. When `last_message` is present we render the
 * preview line + time; otherwise we fall back to the original
 * Phase 3.3 layout.
 *
 * Avatar uses the MyDevs PFP-zoom pattern (Phase 3.5) at 48px.
 * Status indicator opts into showLabel.
 */

import ChatStatusIndicator, { getDevChatStatus } from './ChatStatusIndicator';
import { formatRelativeTime } from './timeAgo';
import styles from './chat.module.css';

const LIST_AVATAR_SIZE_PX = 48;

export default function ChatListItem({
  dev,
  onSelect,
  selected = false,
}) {
  const status = getDevChatStatus(dev);
  const lastMessage = dev?.last_message;
  const itemClass = `${styles.chatListItem} ${
    selected ? styles.chatListItemSelected : ''
  }`.trim();

  return (
    <button
      type="button"
      className={itemClass}
      onClick={() => onSelect(dev.token_id)}
      aria-label={`Open chat with ${dev.name}`}
      aria-current={selected ? 'true' : undefined}
    >
      <div
        className={styles.chatAvatarFrame}
        style={{
          width: LIST_AVATAR_SIZE_PX,
          height: LIST_AVATAR_SIZE_PX,
        }}
      >
        {dev.ipfs_image ? (
          <img
            src={dev.ipfs_image}
            alt=""
            loading="lazy"
            className={styles.chatAvatarImage}
          />
        ) : (
          <div className={styles.chatAvatarFallback}>
            {dev.name?.slice(0, 2).toUpperCase() || '??'}
          </div>
        )}
      </div>
      <div className={styles.chatListMeta}>
        <div className={styles.chatListName}>{dev.name}</div>
        <div className={styles.chatListSubtitle}>{dev.archetype}</div>
        {lastMessage?.content_preview ? (
          <div className={styles.chatListPreview}>
            {lastMessage.content_preview}
          </div>
        ) : null}
      </div>
      <div className={styles.chatListSide}>
        <ChatStatusIndicator status={status} showLabel />
        {lastMessage?.created_at ? (
          <div className={styles.chatListTime}>
            {formatRelativeTime(lastMessage.created_at)}
          </div>
        ) : null}
      </div>
    </button>
  );
}
