/**
 * ChatList — left pane of the split-view chat modal (Phase 3.5.2).
 *
 * Lists ONLY Devs the wallet has active conversations with (data
 * from useActiveChats / GET /api/user/{wallet}/active-chats). The
 * full all-Devs picker lives in <NewChatPicker> as a separate
 * inline render; this component is no longer the entry point for
 * starting a NEW chat.
 *
 * Phase 3.5.2 props:
 *   - activeChats     : Array (lifted from ChatModal)
 *   - loading / error : forwarded for the skeleton / error states
 *   - selectedTokenId : highlights the currently-shown chat
 *   - onSelectChat    : (tokenId) => void  click handler
 *   - onOpenPicker    : () => void          "+ New chat" footer button
 *
 * States rendered:
 *   - first-fetch skeleton
 *   - first-fetch error (no cached data)
 *   - empty list  ("No active chats yet. Click + New chat to start.")
 *   - populated list with footer
 */

import ChatListItem from './ChatListItem';
import styles from './chat.module.css';

const SKELETON_ROWS = 4;

export default function ChatList({
  activeChats = [],
  loading = false,
  error = null,
  selectedTokenId = null,
  onSelectChat,
  onOpenPicker,
}) {
  // Skeleton — first fetch only. The hook keeps loading=false after
  // the first fetch resolves so subsequent polls don't flash this.
  if (loading && activeChats.length === 0) {
    return (
      <>
        <div className={styles.chatListScroll}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div
              key={i}
              className={`${styles.chatListItem} ${styles.chatListSkeleton}`}
              aria-hidden="true"
            >
              <div
                className={`${styles.chatAvatarFrame} ${styles.chatListSkeletonBlock}`}
                style={{ width: 48, height: 48 }}
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
        <ChatListFooter onOpenPicker={onOpenPicker} />
      </>
    );
  }

  if (error && activeChats.length === 0) {
    return (
      <>
        <div className={styles.chatListEmpty}>
          Couldn't load your chats. Retrying in the background — leave
          this open or close and reopen.
        </div>
        <ChatListFooter onOpenPicker={onOpenPicker} />
      </>
    );
  }

  if (activeChats.length === 0) {
    return (
      <>
        <div className={styles.chatListEmpty}>
          No active chats yet. Click + New chat to start.
        </div>
        <ChatListFooter onOpenPicker={onOpenPicker} />
      </>
    );
  }

  return (
    <>
      <div className={styles.chatListScroll}>
        {activeChats.map((dev) => (
          <ChatListItem
            key={dev.token_id}
            dev={dev}
            onSelect={onSelectChat}
            selected={dev.token_id === selectedTokenId}
          />
        ))}
      </div>
      <ChatListFooter onOpenPicker={onOpenPicker} />
    </>
  );
}

function ChatListFooter({ onOpenPicker }) {
  return (
    <div className={styles.chatListFooter}>
      <button
        type="button"
        className={styles.newChatButton}
        onClick={onOpenPicker}
      >
        + New chat
      </button>
    </div>
  );
}
