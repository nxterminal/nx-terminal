/**
 * ChatListItem — one row in the NX Souls chat list. Click → open the
 * conversation with that Dev. Avatar source is the pre-built Pinata
 * URL surfaced by the conversations endpoint as `ipfs_image`.
 *
 * Phase 3.5: avatar uses the MyDevs PFP-zoom pattern (scale 2.2 +
 * transformOrigin 'center 32%') so the Dev's head fills the frame
 * instead of the whole-body wide shot. Status indicator opts into
 * `showLabel` so the row carries "Active" / "Resting" / "Exhausted" /
 * "On mission" text alongside the colour swatch.
 */

import ChatStatusIndicator, { getDevChatStatus } from './ChatStatusIndicator';
import styles from './chat.module.css';

const LIST_AVATAR_SIZE_PX = 48;

export default function ChatListItem({ dev, onSelect }) {
  const status = getDevChatStatus(dev);

  return (
    <button
      type="button"
      className={styles.chatListItem}
      onClick={() => onSelect(dev.token_id)}
      aria-label={`Open chat with ${dev.name}`}
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
      </div>
      <ChatStatusIndicator status={status} showLabel />
    </button>
  );
}
