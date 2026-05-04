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

// Modal frame size — must match `.msnModal` width / height in
// chat.module.css. Used to compute the centred default position so
// react-draggable's transform-on-mount doesn't fight a CSS centering
// translate. Update both places together.
const MODAL_WIDTH_PX = 480;
const MODAL_HEIGHT_PX = 640;

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

  // Initial centring. react-draggable v4 sets element.style.transform
  // directly on mount, which would override any CSS-based centering
  // translate. So the modal anchors at top:0/left:0 (see
  // chat.module.css) and we feed Draggable an explicit
  // defaultPosition. Center starts at (0,0) and is set on mount;
  // because Draggable only reads defaultPosition on its initial
  // mount, the `key` below forces a remount once the real centre is
  // computed, picking up the new defaultPosition.
  const [center, setCenter] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const x = Math.max(0, (window.innerWidth - MODAL_WIDTH_PX) / 2);
    const y = Math.max(0, (window.innerHeight - MODAL_HEIGHT_PX) / 2);
    setCenter({ x, y });
  }, []);

  // react-draggable v4 + React 19 StrictMode: nodeRef avoids the
  // findDOMNode warning that ships with the deprecated default path.
  const nodeRef = useRef(null);

  if (!isOpen) return null;
  if (!isInNXSoulsBeta(address)) return null;

  return (
    <Draggable
      handle=".msn-title-bar"
      nodeRef={nodeRef}
      defaultPosition={center}
      key={`${center.x}-${center.y}`}
    >
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
