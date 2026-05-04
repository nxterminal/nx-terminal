/**
 * ChatModal — root of the NX Souls chat UI.
 *
 * Visibility chain (any one returning false → render null):
 *   1. ChatContext.isOpen must be true (someone called openChatModal)
 *   2. Wallet must be in the NX Souls beta allowlist (visibility-only
 *      gate; backend already enforces ownership + rate limits + quota)
 *
 * View / data ownership (Phase 3.4):
 *   - useConversations lives here so the same `devs` array feeds both
 *     <ChatList> (presentation) and <ChatConversation> (which needs
 *     the selected Dev's full row for its header / avatar / status).
 *   - `polling: view === 'list'` keeps the Phase 3.3 brief honoured —
 *     the 60s interval only runs while the list is on screen — while
 *     the cached `devs` array stays available in conversation view.
 *   - selectedDev is looked up by token_id on every render so a poll
 *     refresh keeps the conversation header in sync (e.g. status flip
 *     from active → resting after a chat).
 *
 * The view-state effect mirrors `initialDevId` from context into local
 * state on every change so a second openChatModal(otherId) re-targets
 * the conversation view.
 *
 * The literal `.msn-title-bar` class is the drag handle — added by
 * <ChatModalHeader> in list view and by <ChatConversationHeader> in
 * conversation view. Both must keep the literal class so Draggable's
 * selector matches whichever header is currently rendered.
 */

import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';

import { useWallet } from '../../hooks/useWallet';
import { useChatModal } from '../../contexts/ChatContext';
import { useConversations } from '../../hooks/useConversations';
import { isInNXSoulsBeta } from '../../config/betaFeatures';
import ChatList from './ChatList';
import ChatConversation from './ChatConversation';
import ChatModalHeader from './ChatModalHeader';
import styles from './chat.module.css';

// Modal frame size — must match `.msnModal` width / height in
// chat.module.css. Used to compute the centred default position so
// react-draggable's transform-on-mount doesn't fight a CSS centering
// translate. Update both places together.
//
// Phase 3.5 bump: 480×640 → 520×720 because the original frame was
// too cramped at the upgraded 13/14px body typography. The list rows
// at 12px padding × 13px text fit comfortably in 520, the
// conversation view's bubbles + composer sit comfortably at 720.
const MODAL_WIDTH_PX = 520;
const MODAL_HEIGHT_PX = 720;

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

  // Conversations hook — fetches always while the modal is open;
  // polls only in list view. Cached `devs` survives a polling pause
  // so the conversation view can resolve the selected dev row.
  const { devs, loading, error, refresh } = useConversations(address, {
    enabled: isOpen,
    polling: view === 'list',
  });

  if (!isOpen) return null;
  if (!isInNXSoulsBeta(address)) return null;

  // Resolve the selected Dev from the live `devs` array on every
  // render. When polling refreshes the list, the selected Dev's
  // status flags update too — useful while the user is in the
  // conversation view if e.g. an admin freezes the Dev or quota
  // resets at UTC midnight.
  const selectedDev =
    selectedDevId != null
      ? devs.find((d) => d.token_id === selectedDevId) || null
      : null;

  return (
    <Draggable
      handle=".msn-title-bar"
      nodeRef={nodeRef}
      defaultPosition={center}
      key={`${center.x}-${center.y}`}
    >
      <div ref={nodeRef} className={styles.msnModal}>
        {view === 'list' ? (
          <>
            <ChatModalHeader
              view={view}
              selectedDevId={selectedDevId}
              onBack={null}
              onClose={closeChatModal}
            />
            <div className={styles.msnContent}>
              <ChatList
                devs={devs}
                loading={loading}
                error={error}
                onSelectDev={(devId) => {
                  setSelectedDevId(devId);
                  setView('conversation');
                }}
              />
            </div>
          </>
        ) : selectedDev ? (
          <ChatConversation
            // Force a remount when the selected Dev changes so the
            // local messages array resets cleanly; without this, a
            // back→pick-different-Dev flow would carry the previous
            // chat into the new one.
            key={selectedDev.token_id}
            dev={selectedDev}
            walletAddress={address}
            onBack={() => setView('list')}
            onClose={closeChatModal}
            refreshConversations={refresh}
          />
        ) : (
          // Selected dev hasn't resolved yet — first fetch in flight,
          // or the dev was removed from the wallet between selection
          // and the next poll. Show a loading shell with the generic
          // header so the user can still close / go back.
          <>
            <ChatModalHeader
              view={view}
              selectedDevId={selectedDevId}
              onBack={() => setView('list')}
              onClose={closeChatModal}
            />
            <div className={styles.msnContent}>
              <div className={styles.msnPlaceholder}>
                {loading ? 'Loading Dev…' : 'Dev not found in your wallet.'}
              </div>
            </div>
          </>
        )}
      </div>
    </Draggable>
  );
}
