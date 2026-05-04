/**
 * ChatModal — root of the NX Souls chat UI.
 *
 * Phase 3.2 scope: skeleton only. Renders a draggable, closable modal
 * with placeholder content. Real list / conversation rendering land
 * in Phase 3.3 / 3.4 respectively.
 *
 * Visibility chain (any one returning false → render null):
 *   1. ChatContext.isOpen must be true (someone called openChatModal)
 *   2. Wallet must be in the NX Souls beta allowlist (visibility-only
 *      gate; backend already enforces ownership + rate limits + quota)
 *
 * The view-state effect mirrors the context's `initialDevId` into
 * local view state every time it changes:
 *   - openChatModal()        → list view, no Dev selected
 *   - openChatModal(tokenId) → conversation view pre-loaded to that Dev
 * Phase 3.3 will add the in-modal navigation that flips view→list /
 * conversation via the back button + list-item click — the setView
 * calls in onBack/onClose are already in place for that.
 *
 * The literal `.msn-title-bar` class on <ChatModalHeader> is what
 * Draggable's handle selector grabs; CSS Modules hash class names so
 * the literal class is added in addition to the module class.
 */

import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';

import { useWallet } from '../../hooks/useWallet';
import { useChatModal } from '../../contexts/ChatContext';
import { isInNXSoulsBeta } from '../../config/betaFeatures';
import ChatModalHeader from './ChatModalHeader';
import styles from './chat.module.css';

export default function ChatModal() {
  const { address } = useWallet();
  const { isOpen, initialDevId, closeChatModal } = useChatModal();

  const [view, setView] = useState('list');
  const [selectedDevId, setSelectedDevId] = useState(null);

  // Mirror the context's `initialDevId` into local view state. Runs on
  // every change so a second openChatModal(otherId) while the modal
  // is already open re-targets the conversation view.
  useEffect(() => {
    if (initialDevId) {
      setView('conversation');
      setSelectedDevId(initialDevId);
    } else {
      setView('list');
      setSelectedDevId(null);
    }
  }, [initialDevId]);

  // react-draggable v4 + React 19 StrictMode: nodeRef avoids the
  // findDOMNode warning that ships with the deprecated default path.
  const nodeRef = useRef(null);

  if (!isOpen) return null;
  if (!isInNXSoulsBeta(address)) return null;

  return (
    <Draggable handle=".msn-title-bar" nodeRef={nodeRef}>
      <div ref={nodeRef} className={styles.msnModal}>
        <ChatModalHeader
          view={view}
          selectedDevId={selectedDevId}
          onBack={view === 'conversation' ? () => setView('list') : null}
          onClose={closeChatModal}
        />
        <div className={styles.msnContent}>
          {view === 'list' ? (
            <div className={styles.msnPlaceholder}>
              ChatList placeholder — Phase 3.3 will render the list of
              Devs here
            </div>
          ) : (
            <div className={styles.msnPlaceholder}>
              ChatConversation placeholder for token {selectedDevId} —
              Phase 3.4 will render the chat
            </div>
          )}
        </div>
      </div>
    </Draggable>
  );
}
