/**
 * ChatListItem — one row in the NX Souls chat list. Click → open the
 * conversation with that Dev. Avatar source is the pre-built Pinata
 * URL surfaced by the conversations endpoint as `ipfs_image`.
 *
 * Rarity, energy, mission state, and the resting flag come from the
 * same row; the dot lives in <ChatStatusIndicator>.
 */

import ChatStatusIndicator, { getDevChatStatus } from './ChatStatusIndicator';
import styles from './chat.module.css';

export default function ChatListItem({ dev, onSelect }) {
  const status = getDevChatStatus(dev);

  return (
    <button
      type="button"
      className={styles.chatListItem}
      onClick={() => onSelect(dev.token_id)}
      aria-label={`Open chat with ${dev.name}`}
    >
      {dev.ipfs_image ? (
        <img
          src={dev.ipfs_image}
          alt=""
          className={styles.chatListAvatar}
          loading="lazy"
        />
      ) : (
        <div className={`${styles.chatListAvatar} ${styles.chatListAvatarFallback}`}>
          {dev.name?.slice(0, 2).toUpperCase() || '??'}
        </div>
      )}
      <div className={styles.chatListMeta}>
        <div className={styles.chatListName}>{dev.name}</div>
        <div className={styles.chatListSubtitle}>
          {dev.archetype}
        </div>
      </div>
      <ChatStatusIndicator status={status} />
    </button>
  );
}
