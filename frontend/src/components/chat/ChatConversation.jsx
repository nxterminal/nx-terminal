/**
 * ChatConversation — orchestrates a single 1-on-1 chat with a Dev.
 *
 * Owns:
 *   - the local messages array (no persistence — Phase A is stateless;
 *     the array dies with the component when the user leaves the view)
 *   - the resting flag (mirrored from the dev row on mount + flipped
 *     true whenever a response arrives with is_resting=true so the
 *     composer stays disabled until the user reopens the modal next
 *     UTC day)
 *   - error → inline system-message mapping (network / 429 IP rate
 *     limit / 503 all_providers_failed / generic)
 *
 * Delegates I/O to useDevChat. After a successful chat that consumed
 * a quota slot, calls refreshConversations so the list view (whenever
 * the user goes back to it) shows fresh quota counters.
 *
 * Cancellation:
 *   - useDevChat already cancels in-flight requests on unmount,
 *     and on any new sendMessage call (fast-typer protection).
 *
 * Auto-scroll:
 *   - The message scroll container is pinned to the bottom whenever
 *     messages.length / isTyping change — matches conventional chat
 *     UX and means the user never misses a fresh reply that lands
 *     while they're scrolled mid-history. There's no "scroll to read"
 *     UX in Phase 3.4; if the user wants to scroll up, they can, but
 *     a new message will yank them back. Phase 3.5 may refine.
 *
 * Header note: <ChatConversationHeader> carries the literal
 * `msn-title-bar` class so react-draggable's handle selector still
 * works while in conversation view. <ChatModal> does NOT render its
 * own ChatModalHeader on this path — there's only one title bar at
 * a time.
 */

import { useEffect, useRef, useState } from 'react';

import { useDevChat } from '../../hooks/useDevChat';
import ChatComposer from './ChatComposer';
import ChatConversationHeader from './ChatConversationHeader';
import ChatMessage from './ChatMessage';
import ChatTypingIndicator from './ChatTypingIndicator';
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

export default function ChatConversation({
  dev,
  walletAddress,
  onBack,
  onClose,
  refreshConversations,
}) {
  const [messages, setMessages] = useState([]);
  const [isResting, setIsResting] = useState(Boolean(dev?.is_resting));

  const { sendMessage, isTyping } = useDevChat(walletAddress, dev?.token_id);

  // Auto-scroll to bottom on new message / typing-indicator change.
  // Anchoring on a sentinel div is more robust than scrollTop math
  // because the scroll container's content height changes on every
  // bubble + the typing indicator mounting / unmounting.
  const scrollEndRef = useRef(null);
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, isTyping]);

  const handleSend = async (text) => {
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    // Snapshot the history we'll send to the backend BEFORE appending
    // the current turn — the backend treats `message` and
    // `session_messages` separately and would double up if we
    // included the current user turn in both.
    const sessionHistory = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_SESSION_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await sendMessage(text, sessionHistory);
      if (!res) return; // aborted (unmount / superseded)

      const assistantMsg = {
        role: 'assistant',
        content: res.response,
        timestamp: Date.now(),
        is_resting: res.is_resting === true,
        provider_used: res.provider_used,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (res.is_resting === true) {
        setIsResting(true);
      }

      // Successful chat consumed a quota slot (or fired a rest reply).
      // Refresh the conversations list so the badge / counters are
      // fresh when the user goes back.
      if (typeof refreshConversations === 'function') {
        refreshConversations();
      }
    } catch (err) {
      const systemContent = mapErrorToSystemMessage(err, dev?.name ?? 'Dev');
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          kind: 'error',
          content: systemContent,
          timestamp: Date.now(),
        },
      ]);
      // Composer's draft was cleared synchronously on send — for
      // network failures the user has to retype. The error message
      // includes the original copy in their head. Phase 3.5 may add a
      // Retry button on the system bubble.
    }
  };

  return (
    <>
      <ChatConversationHeader dev={dev} onBack={onBack} onClose={onClose} />
      <div className={styles.chatMessageScroll}>
        {messages.length === 0 ? (
          <div className={styles.chatEmptyConversation}>
            Send a message to start chatting with {dev?.name ?? 'this Dev'}
          </div>
        ) : (
          messages.map((m, i) => (
            // index keys are fine here — the array is append-only
            // and never reordered in this component
            <ChatMessage key={i} message={m} dev={dev} />
          ))
        )}
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
