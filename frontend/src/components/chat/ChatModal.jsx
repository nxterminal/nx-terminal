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
 * Default-to-most-recent on open (Phase 3.5.2.7):
 *   - If openChatModal(tokenId) was called → selectChat(tokenId).
 *   - Else if user has 1+ active chats → select the freshest (the
 *     backend returns them sorted by last_message_at DESC, so [0]).
 *   - Else (no active chats yet) → leave selection null. The right
 *     pane renders an empty-state with a prominent pointer to
 *     "+ New chat"; the user opens the picker manually. Earlier
 *     phases auto-opened the picker here, but a stubborn timing
 *     race (3.5.2.1 through 3.5.2.6) made that path unreliable.
 *     Removing the auto-open eliminates the bug class entirely.
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
import BetaNotice from './BetaNotice';
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
    if (!isOpen) {
      didAutoSelectRef.current = false;
      return;
    }
    // Phase 3.5.2.5 — wait for the wallet to resolve before deciding
    // anything. wagmi's useAccount returns address=undefined on the
    // first render after a cold load; without this guard the
    // auto-select effect would observe `chatsLoading=false` (from
    // the hooks' pre-wallet branch) and `activeChats=[]` and pop
    // the NewChatPicker before the wallet ever lands.
    if (!address) return;
    if (didAutoSelectRef.current) return;

    // Phase 3.6 entry: openChatModal(tokenId) → reflect into context
    // selection. Wins over default-to-most-recent.
    if (initialDevId) {
      selectChat(initialDevId);
      didAutoSelectRef.current = true;
      return;
    }
    // Wait for the first fetch to fully resolve before deciding.
    if (chatsLoading) return;

    // Phase 3.5.2.7 — auto-SELECT only. The "else open picker" branch
    // that lived here through 3.5.2.6 was the source of a stubborn
    // bug class: even after fixing the pre-wallet race (.5), the
    // initial-loading state (.3), and the in-flight loading flicker
    // (.2), production still reproduced the spurious picker on
    // modal open. The .6 diagnostics confirmed the auto-select
    // effect was firing the `else` branch despite the fetch
    // eventually returning chats successfully.
    //
    // Rather than chase the timing further, we removed the
    // auto-open entirely. The user opens the picker explicitly via
    // "+ New chat" in the left-pane footer; the empty-state UI in
    // the right pane (handled in the JSX below) tells them how.
    // This eliminates the bug class — nothing opens automatically.
    if (activeChats.length > 0) {
      selectChat(activeChats[0].token_id);
    }
    didAutoSelectRef.current = true;
  }, [
    isOpen,
    address,
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
          <BetaNotice />
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
        <BetaNotice />
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
            ) : chatsLoading ? (
              <div className={styles.chatEmptyRightPane}>
                Loading your chats…
              </div>
            ) : activeChats.length === 0 ? (
              // Empty wallet — Phase 3.5.2.7 no longer auto-opens
              // the picker, so the right pane needs to tell the user
              // exactly what to do. The bold "+ New chat" matches
              // the literal label of the footer button on the left
              // pane so users associate the two.
              <div className={styles.chatEmptyRightPane}>
                <div className={styles.chatEmptyTitle}>
                  No active chats yet
                </div>
                <div className={styles.chatEmptySubtitle}>
                  Click <strong>+ New chat</strong> to start a
                  conversation with one of your Devs.
                </div>
              </div>
            ) : (
              // Has chats but none selected (rare — auto-select
              // picks activeChats[0] when the modal opens).
              <div className={styles.chatEmptyRightPane}>
                Select a chat from the list
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
