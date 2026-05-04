/**
 * ChatContext — open/close + initial-Dev state for the NX Souls
 * chat modal, plus the Phase 3.5 chat-sounds toggle.
 *
 * Why a context, not local state in <ChatModal>: Phase 3.6 will wire
 * two entry points (per-Dev "💬 CHAT" button on each card + a global
 * "💬 MESSAGES" button in the header). Both need to flip a single
 * shared switch that's read by the floating modal mounted near the
 * root of the tree, so a single context is the minimum-friction way
 * to keep the trigger sites and the modal decoupled.
 *
 * `initialDevId` is the dev to *open into* — null means "show the
 * conversation list", a token_id means "skip the list and open the
 * conversation with that Dev directly". The modal resets its internal
 * view state to match whenever this changes.
 *
 * `chatSoundsEnabled` defaults to true on every portal load. We do
 * NOT persist this to localStorage — the artifact spec for this
 * project rules out browser storage, and Phase 3.5 inherits that
 * constraint. Trade-off documented in the PR description: each fresh
 * portal session starts with sounds on; if a user dislikes the ding
 * they have to flip it once per session via the title-bar toggle.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialDevId, setInitialDevId] = useState(null);
  const [chatSoundsEnabled, setChatSoundsEnabled] = useState(true);

  const openChatModal = useCallback((devId = null) => {
    setInitialDevId(devId);
    setIsOpen(true);
  }, []);

  const closeChatModal = useCallback(() => {
    setIsOpen(false);
    setInitialDevId(null);
  }, []);

  const toggleChatSounds = useCallback(() => {
    setChatSoundsEnabled((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      initialDevId,
      openChatModal,
      closeChatModal,
      chatSoundsEnabled,
      toggleChatSounds,
    }),
    [
      isOpen,
      initialDevId,
      openChatModal,
      closeChatModal,
      chatSoundsEnabled,
      toggleChatSounds,
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

