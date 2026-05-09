/**
 * ChatContext — open/close + initial-Dev state for the NX Souls
 * chat modal, plus Phase 3.5 chat-sounds + Phase 3.5.2 split-view
 * selection / picker state.
 *
 * Why a context, not local state in <ChatModal>: Phase 3.6 wires two
 * entry points (per-Dev "💬 CHAT" button on each card + a global
 * "💬 MESSAGES" button in the header). Both flip a single shared
 * switch read by the floating modal mounted near the root of the
 * tree, so a single context keeps the trigger sites and the modal
 * decoupled.
 *
 * Phase 3.5.2 additions (split-view layout):
 *   - selectedTokenId / selectChat / clearSelectedChat
 *       Which chat is shown in the right pane (desktop) or the
 *       active conversation view (mobile). Reset to null when the
 *       modal closes so each fresh open re-runs ChatModal's
 *       "default to most recent active chat" logic.
 *   - isNewChatPickerOpen / openNewChatPicker / closeNewChatPicker
 *       The nested picker overlay used to start a chat with a Dev
 *       not yet in the active list.
 *
 * Backwards compat preserved:
 *   - openChatModal(devId?) still exists and behaves identically
 *     for Phase 3.6's per-Dev "💬 CHAT" entry: passing a tokenId
 *     populates initialDevId, which ChatModal mirrors into
 *     selectedTokenId on mount.
 *
 * Persistence: nothing in this context touches localStorage
 * (artifact spec rules out browser storage). Each fresh portal
 * load starts with isOpen=false, selectedTokenId=null,
 * chatSoundsEnabled=true.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialDevId, setInitialDevId] = useState(null);
  const [chatSoundsEnabled, setChatSoundsEnabled] = useState(true);

  // Phase 3.5.2 — split-view selection + nested picker state.
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [isNewChatPickerOpen, setIsNewChatPickerOpen] = useState(false);

  // Phase 5.2 — pre-filled draft for the next-mounted ChatComposer.
  // Used by the NX POSTS "⌥ Reply" flow to seed the input with
  // `re: "<excerpt>" `. ChatComposer reads this on mount and clears
  // it via clearPrefillMessage so reopening the modal later doesn't
  // re-seed the same text.
  const [prefillMessage, setPrefillMessage] = useState(null);

  // Phase 5.4 — chat↔post context bridge. When a user replies to a
  // post via the chat modal, the post id rides alongside the prefill
  // so the next outbound message can attach `referenced_post_id` for
  // surgical context injection. ChatConversation consumes this on the
  // FIRST send and immediately clears it via clearReferencedPostId so
  // subsequent turns don't re-attach (no-stacking is also enforced
  // server-side, but clearing on the client saves a wasted round-trip
  // through the validator).
  const [referencedPostId, setReferencedPostId] = useState(null);

  const openChatModal = useCallback((devId = null, options = {}) => {
    setInitialDevId(devId);
    // Caller passes { prefill: '...', referencedPostId: 123 } to seed
    // the composer + carry a post reference. Both options are optional;
    // the 2-arg signature stays backwards-compatible: every existing
    // call site that passes (devId) keeps working.
    setPrefillMessage(typeof options?.prefill === 'string' ? options.prefill : null);
    const ref = options?.referencedPostId;
    setReferencedPostId(Number.isInteger(ref) && ref > 0 ? ref : null);
    setIsOpen(true);
  }, []);

  const closeChatModal = useCallback(() => {
    setIsOpen(false);
    setInitialDevId(null);
    setPrefillMessage(null);
    setReferencedPostId(null);
    // Reset selection + picker on close so a subsequent open runs the
    // "default to most recent" logic from a clean slate. Without this,
    // a user who closed the modal mid-conversation would reopen into
    // the same chat regardless of which one is freshest now.
    setSelectedTokenId(null);
    setIsNewChatPickerOpen(false);
  }, []);

  // Called by ChatComposer after it has consumed the prefill into
  // its local draft state. Without this, switching conversations
  // inside the modal would re-seed the older prefill into the new
  // composer mount.
  const clearPrefillMessage = useCallback(() => {
    setPrefillMessage(null);
  }, []);

  // Phase 5.4 — called by ChatConversation right after the first
  // outbound send consumes the post reference. Subsequent turns in the
  // same opened modal must NOT re-attach the same id.
  const clearReferencedPostId = useCallback(() => {
    setReferencedPostId(null);
  }, []);

  const toggleChatSounds = useCallback(() => {
    setChatSoundsEnabled((prev) => !prev);
  }, []);

  const selectChat = useCallback((tokenId) => {
    setSelectedTokenId(tokenId);
  }, []);

  const clearSelectedChat = useCallback(() => {
    setSelectedTokenId(null);
  }, []);

  const openNewChatPicker = useCallback(() => {
    setIsNewChatPickerOpen(true);
  }, []);

  const closeNewChatPicker = useCallback(() => {
    setIsNewChatPickerOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      initialDevId,
      openChatModal,
      closeChatModal,
      chatSoundsEnabled,
      toggleChatSounds,
      selectedTokenId,
      selectChat,
      clearSelectedChat,
      isNewChatPickerOpen,
      openNewChatPicker,
      closeNewChatPicker,
      prefillMessage,
      clearPrefillMessage,
      referencedPostId,
      clearReferencedPostId,
    }),
    [
      isOpen,
      initialDevId,
      openChatModal,
      closeChatModal,
      chatSoundsEnabled,
      toggleChatSounds,
      selectedTokenId,
      selectChat,
      clearSelectedChat,
      isNewChatPickerOpen,
      openNewChatPicker,
      closeNewChatPicker,
      prefillMessage,
      clearPrefillMessage,
      referencedPostId,
      clearReferencedPostId,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatModal() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatModal must be used inside ChatProvider');
  }
  return ctx;
}
