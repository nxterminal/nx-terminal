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

  const openChatModal = useCallback((devId = null) => {
    // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
    console.log('[ChatContext] openChatModal', { devId });
    setInitialDevId(devId);
    setIsOpen(true);
  }, []);

  const closeChatModal = useCallback(() => {
    // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
    console.log('[ChatContext] closeChatModal');
    setIsOpen(false);
    setInitialDevId(null);
    // Reset selection + picker on close so a subsequent open runs the
    // "default to most recent" logic from a clean slate. Without this,
    // a user who closed the modal mid-conversation would reopen into
    // the same chat regardless of which one is freshest now.
    setSelectedTokenId(null);
    setIsNewChatPickerOpen(false);
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
    // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
    // Stack trace identifies the caller — auto-select effect vs.
    // user click on the "+ New chat" button vs. anything else.
    console.log(
      '[ChatContext] openNewChatPicker called from:',
      new Error().stack
    );
    setIsNewChatPickerOpen(true);
  }, []);

  const closeNewChatPicker = useCallback(() => {
    // [PHASE 3.5.2.4 DIAGNOSTIC] remove in 3.5.2.5
    console.log('[ChatContext] closeNewChatPicker');
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
