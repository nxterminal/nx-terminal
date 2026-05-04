/**
 * ChatContext — open/close + initial-Dev state for the NX Souls
 * chat modal.
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
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialDevId, setInitialDevId] = useState(null);

  const openChatModal = useCallback((devId = null) => {
    setInitialDevId(devId);
    setIsOpen(true);
  }, []);

  const closeChatModal = useCallback(() => {
    setIsOpen(false);
    setInitialDevId(null);
  }, []);

  const value = useMemo(
    () => ({ isOpen, initialDevId, openChatModal, closeChatModal }),
    [isOpen, initialDevId, openChatModal, closeChatModal]
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
