/**
 * ChatModal — root of the NX Souls chat UI (Phase 3.5.2 split view).
 *
 * Visibility chain (any one returning false → render null):
 *   1. ChatContext.isOpen must be true (someone called openChatModal)
 *   2. Wallet must be in the NX Souls beta allowlist (visibility-only
 *      gate; backend already enforces ownership + rate limits + quota)
 *
 * Layout:
 *   - Desktop (≥ MOBILE_BREAKPOINT_PX): split view. Header at top
 *     (drag handle, sound, close). Below: left pane (active-chats
 *     list) + right pane (selected conversation OR empty state).
 *   - Mobile (< MOBILE_BREAKPOINT_PX): full-screen toggle. Header
 *     stays at top with optional back arrow when in conversation
 *     view. Body switches between <ChatList> and <ChatConversation>
 *     based on selectedTokenId from context.
 *
 * Data ownership:
 *   - useActiveChats lives here so the same array feeds both
 *     <ChatList> (rows) and the right-pane lookup
 *     `activeChats.find(c => c.token_id === selectedTokenId)`.
 *   - refresh() is threaded into <ChatConversation> as `onAfterSend`
 *     so a successful chat updates the row's preview / time / quota
 *     immediately instead of at the next 60s poll.
 *   - useConversations (the all-Devs hook) is owned by
 *     <NewChatPicker>; the picker only mounts when isNewChatPickerOpen
 *     is true so it doesn't compete with the active-chats poll.
 *
 * Default-to-most-recent on open:
 *   - If openChatModal(tokenId) was called → selectChat(tokenId).
 *   - Else if user has 1+ active chats → select the freshest (the
 *     backend returns them sorted by last_message_at DESC, so [0]).
 *   - Else (no active chats yet) → openNewChatPicker() so the user
 *     immediately sees the picker instead of staring at an empty
 *     right pane.
 *
 * Drag handle: literal `.msn-title-bar` class on <ChatModalHeader>.
 * <ChatConversationHeader> intentionally does NOT carry the class —
 * Phase 3.5.2 collapsed it from "title bar" to "in-pane info strip"
 * so clicking the strip doesn't drag the modal.
 */

import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';

import { useWallet } from '../../hooks/useWallet';
import { useChatModal } from '../../contexts/ChatContext';
import { useActiveChats } from '../../hooks/useActiveChats';
import { useConversations } from '../../hooks/useConversations';
import { isInNXSoulsBeta } from '../../config/betaFeatures';
import ChatList from './ChatList';
import ChatConversation from './ChatConversation';
import ChatModalHeader from './ChatModalHeader';
import NewChatPicker from './NewChatPicker';
import styles from './chat.module.css';

// Modal frame size — must match `.msnModalSplit` width / height in
// chat.module.css. Phase 3.5.2 expanded the desktop frame to fit the
// split layout: 280px left pane + ~580px conversation pane = 880px,
// 640px tall keeps the bubbles + composer comfortable without
// dwarfing smaller laptops. Update both places together.
const MODAL_WIDTH_DESKTOP = 880;
const MODAL_HEIGHT_DESKTOP = 640;
const MOBILE_BREAKPOINT_PX = 768;

// Tiny inline media-query hook — avoids adding a dependency for one
// boolean. Initial state reads window.innerWidth synchronously so the
// first paint matches the final layout (no flash of the wrong
// breakpoint). Resize listener keeps the layout responsive while the
// modal is open (e.g. user rotating a tablet, dragging a window).
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= MOBILE_BREAKPOINT_PX;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      setIsDesktop(window.innerWidth >= MOBILE_BREAKPOINT_PX);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isDesktop;
}

export default function ChatModal() {
  const { address } = useWallet();
  const {
    isOpen,
    initialDevId,
    closeChatModal,
    selectedTokenId,
    selectChat,
    clearSelectedChat,
    isNewChatPickerOpen,
    openNewChatPicker,
    closeNewChatPicker,
  } = useChatModal();

  const isDesktop = useIsDesktop();

  // Lift the active-chats hook up: same data feeds both the left
  // pane and the right-pane dev lookup.
  const { activeChats, loading: chatsLoading, error: chatsError, refresh: refreshChats } =
    useActiveChats(address, { enabled: isOpen });

  // All-Devs fallback for the right pane. Phase 3.5.2 looked up the
  // selected Dev only in `activeChats`, which broke the
  // NewChatPicker flow: picking a Dev with no active conversation
  // yet would set `selectedTokenId` but the right pane stayed on
  // the empty-state placeholder (the row didn't exist in
  // activeChats yet). NewChatPicker already uses this same hook
  // internally; mounting it here too is harmless because both
  // instances share the in-flight request via the React Query-style
  // poll dedup the hook isn't doing — they DO each fire a request,
  // but it's two GETs to the same endpoint at most every 60s and
  // the picker only mounts when the overlay is open. Acceptable
  // cost; the alternative would be lifting useConversations to
  // ChatModal and threading `devs` down to NewChatPicker, which
  // would entangle two surfaces that are otherwise independent.
  const { devs: ownedDevs } = useConversations(address, { enabled: isOpen });

  // Default-to-most-recent / open-picker logic. Fires ONCE per open
  // cycle — tracked via the ref below — so on mobile a user who
  // taps "back" out of a conversation (clearSelectedChat → null)
  // doesn't get yanked back into the most-recent chat by the next
  // re-render. The ref resets when the modal closes so the next
  // open re-runs the logic from scratch.
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
    console.log('[ChatModal] auto-select effect run', {
      isOpen,
      initialDevId,
      chatsLoading,
      activeChatsLength: activeChats.length,
      didAutoSelected: didAutoSelectRef.current,
    });

    if (!isOpen) {
      // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
      console.log('[ChatModal] effect: not open, resetting ref');
      didAutoSelectRef.current = false;
      return;
    }
    if (didAutoSelectRef.current) {
      // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
      console.log('[ChatModal] effect: already auto-selected, return');
      return;
    }

    // Phase 3.6 entry: openChatModal(tokenId) → reflect into context
    // selection. Wins over default-to-most-recent.
    if (initialDevId) {
      // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
      console.log('[ChatModal] effect: initialDevId path', initialDevId);
      selectChat(initialDevId);
      didAutoSelectRef.current = true;
      return;
    }
    // Wait for the first fetch to fully resolve before deciding.
    //
    // Phase 3.5.2 had `chatsLoading && activeChats.length === 0` here,
    // which raced: useActiveChats flips loading=false inside the
    // finally-block of doFetch, but the success branch updates the
    // devs array via setDevs(). React batches both setStates from the
    // same task, but a strict-mode double-effect can still observe
    // the brief render where loading=false AND activeChats=[]. The
    // effect interpreted that as "no chats" and called
    // openNewChatPicker() — and didAutoSelectRef latched it for the
    // open cycle, so the spurious picker stuck around.
    //
    // The bare `if (chatsLoading) return` removes the race: the hook
    // only flips loading=false after the response (success OR error)
    // has been processed, so once we proceed past this guard,
    // activeChats reflects an actual server snapshot.
    if (chatsLoading) {
      // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
      console.log('[ChatModal] effect: still loading, return');
      return;
    }

    if (activeChats.length > 0) {
      // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
      console.log(
        '[ChatModal] effect: selecting most recent',
        activeChats[0].token_id
      );
      selectChat(activeChats[0].token_id);
    } else {
      // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
      console.log('[ChatModal] effect: NO active chats, opening picker');
      openNewChatPicker();
    }
    didAutoSelectRef.current = true;
  }, [
    isOpen,
    initialDevId,
    chatsLoading,
    activeChats,
    selectChat,
    openNewChatPicker,
  ]);

  // Initial centring (desktop only — mobile is full-screen). Same
  // pattern as Phase 3.5: anchor at top:0/left:0 in CSS, feed
  // Draggable an explicit defaultPosition; key forces a remount once
  // the real centre is computed because Draggable only reads
  // defaultPosition on initial mount.
  const [center, setCenter] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!isDesktop) {
      setCenter({ x: 0, y: 0 });
      return;
    }
    const x = Math.max(0, (window.innerWidth - MODAL_WIDTH_DESKTOP) / 2);
    const y = Math.max(0, (window.innerHeight - MODAL_HEIGHT_DESKTOP) / 2);
    setCenter({ x, y });
  }, [isDesktop]);

  const nodeRef = useRef(null);

  if (!isOpen) return null;
  if (!isInNXSoulsBeta(address)) return null;

  // Resolve the selected Dev. Prefer the active-chats row because
  // it carries the freshest signal (last_message preview, current
  // quota state from the join). Fall back to the all-Devs list when
  // a NewChatPicker selection lands on a Dev that hasn't sent a
  // first message yet — until the picker→send→poll cycle completes
  // (~60s, or sooner via refreshChats), the Dev only exists in
  // `ownedDevs`. Without this fallback the right pane would render
  // its empty-state placeholder instead of the chosen conversation.
  //
  // The two arrays may briefly carry slightly different shapes for
  // the same token_id (active-chats has last_message; ownedDevs
  // doesn't). ChatConversation only reads name / archetype /
  // ipfs_image / status / quota / token_id, all of which exist on
  // both shapes.
  const selectedDev =
    selectedTokenId != null
      ? activeChats.find((c) => c.token_id === selectedTokenId)
        || ownedDevs.find((d) => d.token_id === selectedTokenId)
        || null
      : null;

  // Mobile: full-screen toggle layout. selectedTokenId is the
  // implicit "view" — null = list, set = conversation.
  if (!isDesktop) {
    return (
      // Wrapping in Draggable on mobile is a no-op visually because
      // the modal fills the viewport, but it keeps the drag-handle
      // selector consistent and avoids a conditional Draggable mount
      // that would lose its node ref between layouts.
      <Draggable
        handle=".msn-title-bar"
        nodeRef={nodeRef}
        defaultPosition={{ x: 0, y: 0 }}
        key="mobile"
      >
        <div ref={nodeRef} className={styles.msnModalMobile}>
          <ChatModalHeader
            view={selectedTokenId ? 'conversation' : 'list'}
            selectedDevId={selectedTokenId}
            onBack={selectedTokenId ? clearSelectedChat : null}
            onClose={closeChatModal}
          />
          <div className={styles.msnContent}>
            {selectedTokenId && selectedDev ? (
              <ChatConversation
                key={selectedDev.token_id}
                dev={selectedDev}
                walletAddress={address}
                onBack={clearSelectedChat}
                onAfterSend={refreshChats}
              />
            ) : (
              <ChatList
                activeChats={activeChats}
                loading={chatsLoading}
                error={chatsError}
                selectedTokenId={selectedTokenId}
                onSelectChat={selectChat}
                onOpenPicker={openNewChatPicker}
              />
            )}
          </div>
          {isNewChatPickerOpen ? (
            <NewChatPicker
              walletAddress={address}
              activeChats={activeChats}
              onSelectDev={(tokenId) => {
                selectChat(tokenId);
                closeNewChatPicker();
              }}
              onCancel={closeNewChatPicker}
            />
          ) : null}
        </div>
      </Draggable>
    );
  }

  // Desktop: split view. Both panes always visible.
  return (
    <Draggable
      handle=".msn-title-bar"
      nodeRef={nodeRef}
      defaultPosition={center}
      key={`desktop-${center.x}-${center.y}`}
    >
      <div ref={nodeRef} className={styles.msnModalSplit}>
        <ChatModalHeader
          view="list"
          selectedDevId={null}
          onBack={null}
          onClose={closeChatModal}
        />
        <div className={styles.msnSplitBody}>
          <div className={styles.msnSplitLeft}>
            <ChatList
              activeChats={activeChats}
              loading={chatsLoading}
              error={chatsError}
              selectedTokenId={selectedTokenId}
              onSelectChat={selectChat}
              onOpenPicker={openNewChatPicker}
            />
          </div>
          <div className={styles.msnSplitRight}>
            {selectedDev ? (
              <ChatConversation
                key={selectedDev.token_id}
                dev={selectedDev}
                walletAddress={address}
                // Desktop has the list always visible — there's
                // nowhere to go "back" to, so no back arrow in the
                // conversation strip.
                onBack={null}
                onAfterSend={refreshChats}
              />
            ) : (
              <div className={styles.chatEmptyRightPane}>
                {chatsLoading
                  ? 'Loading your chats…'
                  : 'Select a chat or click + New chat'}
              </div>
            )}
          </div>
        </div>
        {isNewChatPickerOpen ? (
          <NewChatPicker
            walletAddress={address}
            activeChats={activeChats}
            onSelectDev={(tokenId) => {
              selectChat(tokenId);
              closeNewChatPicker();
            }}
            onCancel={closeNewChatPicker}
          />
        ) : null}
      </div>
    </Draggable>
  );
}
