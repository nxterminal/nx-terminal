/**
 * ChatList — scrollable list of every Dev the connected wallet owns.
 * Polls every 60s while mounted; the parent is responsible for only
 * mounting this when the modal is in list view (so polling stops in
 * conversation view per Phase 3.3 brief).
 *
 * States rendered:
 *   - loading skeleton  (first fetch, no data yet)
 *   - empty state       (fetch succeeded with zero Devs)
 *   - error state       (first fetch failed and we have nothing to show)
 *   - list              (success path; subsequent failed polls don't
 *                        clobber the list — the hook keeps the last
 *                        good `devs` array on error)
 */

import { useConversations } from '../../hooks/useConversations';
import ChatListItem from './ChatListItem';
import styles from './chat.module.css';

const SKELETON_ROWS = 4;

export default function ChatList({ walletAddress, onSelectDev }) {
  const { devs, loading, error } = useConversations(walletAddress, {
    enabled: true,
  });

  if (loading && devs.length === 0) {
    return (
      <div className={styles.chatListScroll}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div
            key={i}
            className={`${styles.chatListItem} ${styles.chatListSkeleton}`}
            aria-hidden="true"
          >
            <div
              className={`${styles.chatListAvatar} ${styles.chatListSkeletonBlock}`}
            />
            <div className={styles.chatListMeta}>
              <div
                className={`${styles.chatListSkeletonLine} ${styles.chatListSkeletonLineWide}`}
              />
              <div className={styles.chatListSkeletonLine} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && devs.length === 0) {
    return (
      <div className={styles.chatListEmpty}>
        Couldn't load your Devs. Retrying in the background — leave
        this open or close and reopen.
      </div>
    );
  }

  if (devs.length === 0) {
    return (
      <div className={styles.chatListEmpty}>
        You don't own any Devs yet. Mint one to start chatting.
      </div>
    );
  }

  return (
    <div className={styles.chatListScroll}>
      {devs.map((dev) => (
        <ChatListItem
          key={dev.token_id}
          dev={dev}
          onSelect={onSelectDev}
        />
      ))}
    </div>
  );
}
