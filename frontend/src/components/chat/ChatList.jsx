/**
 * ChatList — scrollable list of every Dev the connected wallet owns.
 *
 * Phase 3.4: this component is presentation-only. The conversations
 * hook moved up to <ChatModal> so the same data also feeds the
 * conversation header (we look up the selected dev by token_id from
 * the same array). ChatList just receives `devs / loading / error`
 * as props and renders one of four states.
 *
 * The Phase 3.3 polling-pause requirement still holds: <ChatModal>
 * passes `polling: view === 'list'` to useConversations, so the
 * recurring 60s fetch only runs while the list is on screen, while
 * the cached `devs` array remains available for the conversation
 * view.
 */

import ChatListItem from './ChatListItem';
import styles from './chat.module.css';

const SKELETON_ROWS = 4;

export default function ChatList({
  devs = [],
  loading = false,
  error = null,
  onSelectDev,
}) {
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
