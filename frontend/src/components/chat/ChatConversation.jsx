/**
 * ChatConversation — orchestrates a single 1-on-1 chat with a Dev.
 *
 * Phase 3.5.3 split: persisted history (loaded once on open via
 * useChatHistory) vs. localMessages appended during this session.
 * Both arrays render in the same scroll container; the merged list
 * stays in chronological order because history is always older than
 * any local message.
 *
 * Owns:
 *   - localMessages: messages added DURING this session (user sends,
 *     Dev replies, system bubbles for inline errors). Reset whenever
 *     the selected Dev changes — the parent already remounts via
 *     `key={dev.token_id}`, but a defensive useEffect handles the
 *     case where that key contract changes someday.
 *   - isResting flag: mirrored from the dev row on mount + flipped
 *     true whenever a response arrives with is_resting=true so the
 *     composer stays disabled until the user reopens the modal next
 *     UTC day.
 *   - Inline system-message mapping for network / 429 / 503 errors.
 *
 * History-source (server, via useChatHistory) is read-only here.
 * The hook owns refresh; ChatConversation never mutates the history
 * array directly (mutations happen on the server through POST /chat,
 * and either get reflected on the next refresh() OR are tracked
 * locally for the rest of this session via localMessages).
 *
 * Server message shape vs. local message shape:
 *   - Server: { id, role, content, is_climax, is_resting,
 *               provider_used, created_at, expires_at }
 *               role ∈ user | assistant | system_error | system_resting
 *   - Local:  { role, content, timestamp, is_resting?, provider_used?,
 *               kind? }    role ∈ user | assistant | system
 *
 * normaliseHistoryMessage() reshapes server rows into the local
 * shape that <ChatMessage> already understands. The server's
 * `system_resting` role collapses into `assistant` with
 * `is_resting=true` because that's how it should render — the rest
 * reply IS a Dev bubble, just visually distinct via the existing
 * `chatMessageBubbleResting` style.
 *
 * Auto-scroll runs on three triggers:
 *   1. local messages change (user sent or Dev replied)
 *   2. typing indicator on/off
 *   3. history just finished loading (new Dev opened)
 * (3) uses block:'end' / behavior:'auto' for instant snap to the
 * latest message — smooth scroll on freshly-mounted history feels
 * laggy.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useChatModal } from '../../contexts/ChatContext';
import { useDevChat } from '../../hooks/useDevChat';
import { useChatHistory } from '../../hooks/useChatHistory';
import ChatComposer from './ChatComposer';
import ChatConversationHeader from './ChatConversationHeader';
import ChatMessage from './ChatMessage';
import ChatTypingIndicator from './ChatTypingIndicator';
import { useChatSounds } from './useChatSounds';
import styles from './chat.module.css';

// Backend MAX_SESSION_MESSAGES is 20 — keep in sync. We slice the
// outgoing history to the LAST (N-1) entries so the in-flight user
// turn fits without overflow.
const MAX_SESSION_HISTORY = 19;

function mapErrorToSystemMessage(err, devName) {
  // Structured 4xx/5xx surfaced by fetchJSON: the backend's nx_souls
  // route shapes detail as { error, message, retry_in_seconds, ... }.
  // We dispatch on the discriminator so each surface gets the most
  // helpful inline copy.
  const detail = err?.detail;
  if (detail?.error === 'ip_rate_limited') {
    const secs = detail.retry_in_seconds ?? 60;
    return `Too many requests right now. Try again in ${secs}s.`;
  }
  if (detail?.error === 'all_providers_failed') {
    const secs = detail.retry_in_seconds ?? 60;
    return `${devName} is overloaded. Try again in ${secs}s.`;
  }
  if (detail?.error === 'quota_exceeded') {
    // Phase 2a returns 200 with is_resting=true instead of 429 for
    // this case; if we ever see this branch the backend regressed.
    return `${devName} is resting until UTC midnight.`;
  }
  // AbortError already returns null from useDevChat — anything else
  // is a network / unknown failure.
  return `Couldn't reach ${devName}. Try again.`;
}

function normaliseHistoryMessage(serverMsg) {
  // Translate the server shape into what <ChatMessage> expects.
  // role='system_resting' renders identically to an assistant
  // bubble with is_resting=true — same visual treatment, same
  // semantic ("the Dev replied with their rest line"). role=
  // 'system_error' isn't currently persisted by any code path
  // (Phase 3.5.1 only inserts user / assistant / system_resting)
  // but we map it to the local 'system' kind defensively in case
  // a future code path persists one.
  const baseRole =
    serverMsg.role === 'system_resting'
      ? 'assistant'
      : serverMsg.role === 'system_error'
        ? 'system'
        : serverMsg.role;
  return {
    id: serverMsg.id,
    role: baseRole,
    content: serverMsg.content,
    // Local shape uses `timestamp` (anything new Date(…) accepts).
    // Server's created_at is an ISO string — passes through cleanly.
    timestamp: serverMsg.created_at,
    is_resting: Boolean(serverMsg.is_resting),
    provider_used: serverMsg.provider_used ?? null,
  };
}

export default function ChatConversation({
  dev,
  walletAddress,
  onBack,
  onClose,
  refreshConversations,
  // Phase 3.5.2 — fires after every successful send (including the
  // resting reply path) so the parent can refresh the active-chats
  // list. The list's last-message preview / time / quota update
  // immediately instead of waiting for the next 60s poll.
  onAfterSend,
}) {
  // Local state for messages added DURING this conversation session.
  const [localMessages, setLocalMessages] = useState([]);
  const [isResting, setIsResting] = useState(Boolean(dev?.is_resting));

  const { sendMessage, isTyping } = useDevChat(walletAddress, dev?.token_id);

  // Phase 3.5.3 — load persisted history once on open. Disabled
  // until both walletAddress and dev.token_id are present (defensive;
  // the parent should already pass both, but the hook gracefully
  // stays in loading=true if either is missing).
  const {
    messages: historyMessages,
    loading: historyLoading,
    error: historyError,
    refresh: refreshHistory,
  } = useChatHistory(walletAddress, dev?.token_id, { enabled: !!dev });

  // Reset localMessages on Dev change. <ChatModal> already mounts
  // <ChatConversation> with `key={dev.token_id}` so a Dev switch
  // unmounts/remounts and naturally resets local state — but a
  // future refactor that drops the key prop would otherwise leak
  // local messages across conversations. Cheap defense.
  useEffect(() => {
    setLocalMessages([]);
  }, [dev?.token_id]);

  // Normalised history is what <ChatMessage> expects. Memoised so a
  // stable identity propagates to the merged array (and the
  // session_history snapshot inside handleSend).
  const normalisedHistory = useMemo(
    () => historyMessages.map(normaliseHistoryMessage),
    [historyMessages]
  );

  // Combined view = history + local. Both already chronological;
  // local always comes after history because it's appended during
  // the session that started AFTER the history was fetched.
  const allMessages = useMemo(
    () => [...normalisedHistory, ...localMessages],
    [normalisedHistory, localMessages]
  );

  // Chat sounds — Phase 3.5. Enabled flag lives on ChatContext so the
  // title-bar toggle can flip it; the hook itself is just an audio
  // emitter with no other state. We deliberately do NOT play on user
  // send (matches MSN behaviour); only the Dev reply triggers the
  // ding.
  const { chatSoundsEnabled, referencedPostId, clearReferencedPostId } = useChatModal();
  const { playMessageReceive } = useChatSounds(chatSoundsEnabled);

  // Auto-scroll to bottom on new local message / typing indicator.
  // Anchoring on a sentinel div is more robust than scrollTop math
  // because the scroll container's content height changes on every
  // bubble + the typing indicator mounting / unmounting.
  const scrollEndRef = useRef(null);
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [localMessages, isTyping]);

  // Phase 3.5.3 — instant scroll to the bottom whenever history
  // finishes loading or the selected Dev changes. Use behavior:'auto'
  // (default — instant) rather than smooth: a smooth scroll over
  // many bubbles after a fresh open feels laggy.
  useEffect(() => {
    if (!historyLoading && scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ block: 'end', behavior: 'auto' });
    }
  }, [historyLoading, dev?.token_id]);

  const handleSend = async (text) => {
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    // Snapshot the conversation context to ship to the backend.
    // History + local both feed the LLM context window so the model
    // can pick up where the previous session left off, not just
    // what was typed since the modal opened. system_* rows are
    // dropped — they're inline UX surfaces, not part of the LLM
    // dialogue.
    const sessionHistory = allMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_SESSION_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }));

    setLocalMessages((prev) => [...prev, userMsg]);

    // Phase 5.4 — attach referenced_post_id on the FIRST send only
    // and clear immediately so subsequent turns in the same modal
    // don't re-attach. The server also no-stacks defensively, but
    // clearing here saves a wasted round-trip through validation.
    const sendOptions = {};
    if (referencedPostId) {
      sendOptions.referencedPostId = referencedPostId;
      clearReferencedPostId();
    }

    try {
      const res = await sendMessage(text, sessionHistory, sendOptions);
      if (!res) return; // aborted (unmount / superseded)

      const assistantMsg = {
        role: 'assistant',
        content: res.response,
        timestamp: Date.now(),
        is_resting: res.is_resting === true,
        provider_used: res.provider_used,
      };
      setLocalMessages((prev) => [...prev, assistantMsg]);

      // Phase 3.5 — MSN-flavoured ding on every Dev reply, including
      // the static rest line. User-send remains silent.
      playMessageReceive();

      if (res.is_resting === true) {
        setIsResting(true);
      }

      // Successful chat consumed a quota slot (or fired a rest reply).
      // Refresh the conversations list so the badge / counters are
      // fresh when the user goes back.
      if (typeof refreshConversations === 'function') {
        refreshConversations();
      }
      if (typeof onAfterSend === 'function') {
        onAfterSend();
      }
    } catch (err) {
      const systemContent = mapErrorToSystemMessage(err, dev?.name ?? 'Dev');
      setLocalMessages((prev) => [
        ...prev,
        {
          role: 'system',
          kind: 'error',
          content: systemContent,
          timestamp: Date.now(),
        },
      ]);
      // Phase 3.5 preserve-on-error: re-throw so <ChatComposer> can
      // restore the cleared draft. The inline system bubble above
      // already informs the user; the composer just brings their
      // text back if they hadn't started a new draft.
      throw err;
    }
  };

  const showSkeleton = historyLoading && allMessages.length === 0;
  const showHistoryError =
    !!historyError && !historyLoading && allMessages.length === 0;
  const showEmptyState =
    !showSkeleton && !showHistoryError && allMessages.length === 0;

  return (
    <>
      <ChatConversationHeader dev={dev} onBack={onBack} onClose={onClose} />
      <div className={styles.chatMessageScroll}>
        {showSkeleton ? <HistorySkeleton /> : null}
        {showHistoryError ? (
          <div className={styles.chatHistoryError}>
            <span>Couldn't load message history. New messages still work.</span>
            <button
              type="button"
              className={styles.chatHistoryRetry}
              onClick={refreshHistory}
            >
              Retry
            </button>
          </div>
        ) : null}
        {showEmptyState ? (
          <div className={styles.chatEmptyConversation}>
            Send a message to start chatting with {dev?.name ?? 'this Dev'}
          </div>
        ) : null}
        {allMessages.map((m, i) => (
          // Use the persisted id when present (history rows) and fall
          // back to a stable index for in-session messages — local
          // messages are append-only so the index is fine for keying.
          <ChatMessage
            key={m.id != null ? `srv-${m.id}` : `loc-${i}`}
            message={m}
            dev={dev}
          />
        ))}
        {isTyping ? <ChatTypingIndicator dev={dev} /> : null}
        <div ref={scrollEndRef} />
      </div>
      {isResting ? (
        <div className={styles.chatRestingState}>
          {dev?.name ?? 'Dev'} is resting until UTC midnight.
        </div>
      ) : null}
      <ChatComposer
        onSend={handleSend}
        isTyping={isTyping}
        isResting={isResting}
        devName={dev?.name ?? 'Dev'}
      />
    </>
  );
}

// Three placeholder bubbles with shimmer — same shimmer keyframe
// already drives the chat-list skeleton (Phase 3.3) so a future
// theming change in one place picks up the other for free.
function HistorySkeleton() {
  return (
    <div className={styles.chatHistorySkeleton} aria-hidden="true">
      <div className={`${styles.chatMessageDev} ${styles.chatHistorySkeletonRow}`}>
        <div className={styles.chatHistorySkeletonAvatar} />
        <div className={styles.chatHistorySkeletonBubble} />
      </div>
      <div className={`${styles.chatMessageUser} ${styles.chatHistorySkeletonRow}`}>
        <div
          className={`${styles.chatHistorySkeletonBubble} ${styles.chatHistorySkeletonBubbleUser}`}
        />
      </div>
      <div className={`${styles.chatMessageDev} ${styles.chatHistorySkeletonRow}`}>
        <div className={styles.chatHistorySkeletonAvatar} />
        <div className={styles.chatHistorySkeletonBubble} />
      </div>
    </div>
  );
}
