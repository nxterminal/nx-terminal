/**
 * NewChatPicker — nested modal overlay for picking an inactive Dev
 * to start a fresh conversation with.
 *
 * Sits on top of <ChatModal> at z-index 10001 (the modal is at
 * 9999, the floating debug button at 10000). Has its own backdrop
 * so the user can see it's a nested action they can cancel.
 *
 * Data source: useConversations — the original Phase 3.3 hook that
 * returns every Dev the wallet owns. Filtered by `activeChats` (the
 * left pane's data) so we only show Devs WITHOUT an active chat
 * — there's no value in starting a "new" chat with someone the
 * user can already continue from the left pane.
 *
 * The list is rendered inline (not via <ChatList>) because <ChatList>
 * is now the active-chats component with its own footer and
 * selected-state semantics. A picker row is simpler: avatar + name +
 * archetype + status dot+label, no preview, no time, no selected
 * state. Click → onSelectDev(token_id) and the parent closes the
 * picker + selects the chat.
 *
 * Empty state: "All your Devs have active chats. Continue any from
 * the list." — surfaces only when the user has 14/14 active chats
 * already, which is the strongly-engaged case where the picker has
 * literally nothing to offer.
 */

import { useMemo } from 'react';

import { useConversations } from '../../hooks/useConversations';
import ChatStatusIndicator, { getDevChatStatus } from './ChatStatusIndicator';
import styles from './chat.module.css';

const PICKER_AVATAR_SIZE_PX = 40;

export default function NewChatPicker({
  walletAddress,
  activeChats = [],
  onSelectDev,
  onCancel,
}) {
  // useConversations runs only while the picker is mounted, so it
  // doesn't compete with the active-chats poll in ChatModal. The
  // `polling` flag stays default (true) — the picker is short-lived
  // so an extra recurring poll while it's open is fine.
  const { devs, loading } = useConversations(walletAddress, { enabled: true });

  const activeIds = useMemo(
    () => new Set(activeChats.map((c) => c.token_id)),
    [activeChats]
  );

  // Show only Devs that don't already have an active chat in the
  // left pane. Sort matches the conversations endpoint contract
  // (ASC by token_id), which is also how the list of own Devs is
  // ordered everywhere else in the portal.
  const availableDevs = useMemo(
    () => (devs || []).filter((d) => !activeIds.has(d.token_id)),
    [devs, activeIds]
  );

  return (
    <div
      className={styles.newChatPickerOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Start a new chat"
    >
      <div className={styles.newChatPicker}>
        <div className={`${styles.msnTitleBar} ${styles.newChatPickerHeader}`}>
          <div className={styles.msnTitle}>
            <span>Start a new chat</span>
          </div>
          <div className={styles.msnTitleBarButtons}>
            <button
              type="button"
              onClick={onCancel}
              className={styles.msnTitleBarButton}
              aria-label="Close picker"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className={styles.newChatPickerSubtitle}>
          Choose a Dev to talk with
        </div>
        <div className={styles.newChatPickerList}>
          {loading && availableDevs.length === 0 ? (
            <div className={styles.chatListEmpty}>Loading your Devs…</div>
          ) : availableDevs.length === 0 ? (
            <div className={styles.chatListEmpty}>
              All your Devs have active chats. Continue any from the
              list.
            </div>
          ) : (
            availableDevs.map((dev) => (
              <button
                type="button"
                key={dev.token_id}
                className={styles.chatListItem}
                onClick={() => onSelectDev(dev.token_id)}
                aria-label={`Start chat with ${dev.name}`}
              >
                <div
                  className={styles.chatAvatarFrame}
                  style={{
                    width: PICKER_AVATAR_SIZE_PX,
                    height: PICKER_AVATAR_SIZE_PX,
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
                  <div className={styles.chatListSubtitle}>
                    {dev.archetype}
                  </div>
                </div>
                <ChatStatusIndicator status={getDevChatStatus(dev)} showLabel />
              </button>
            ))
          )}
        </div>
        <div className={styles.newChatPickerCancel}>
          <button
            type="button"
            className={styles.chatComposerButton}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
