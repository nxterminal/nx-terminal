/**
 * ChatComposer — textarea + send button at the bottom of the
 * conversation view.
 *
 * Behaviour:
 *   - Enter        → send (if non-empty, not disabled)
 *   - Shift+Enter  → newline
 *   - maxLength=1000 to mirror MAX_MESSAGE_LEN on the backend
 *   - Disabled when:
 *       isTyping       (waiting for the LLM cascade to return)
 *       isResting      (Dev hit daily quota; chat returns rest line
 *                       with no LLM call until UTC midnight)
 *   - Send button is also disabled when text is empty / whitespace
 *
 * Local state owns the draft so the parent can re-render (typing
 * indicator on/off, resting flag flipping) without losing what the
 * user typed. On send, the local draft is cleared synchronously
 * BEFORE awaiting the response — keeps the textarea responsive even
 * if the request takes 10+ seconds.
 *
 * Phase 3.5: preserve-on-error. If the parent's `onSend` rejects
 * (network failure, IP rate-limit, all-providers-failed — anything
 * the conversation surfaces as an inline system bubble), restore the
 * cleared draft so the user doesn't have to retype. We restore via
 * a functional state update that only writes the original draft if
 * the textarea is still empty — protects the case where the user
 * started typing a NEW message during the failed request and would
 * lose THAT text on a naive setDraft(originalDraft).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './chat.module.css';
import { useChatModal } from '../../contexts/ChatContext';

const MAX_MESSAGE_LEN = 1000;

export default function ChatComposer({
  onSend,
  isTyping = false,
  isResting = false,
  devName = 'Dev',
}) {
  // Phase 5.2 — NX POSTS "⌥ Reply" seeds prefillMessage in the
  // ChatContext. We read it here (rather than as a prop) so the
  // posts → chat handoff doesn't have to thread through ChatModal
  // + ChatConversation. Consume-once semantics: copy into draft
  // then clear the context so reopening the modal later doesn't
  // re-seed the same text.
  const { prefillMessage, clearPrefillMessage } = useChatModal();

  const [draft, setDraft] = useState(() =>
    typeof prefillMessage === 'string' ? prefillMessage : ''
  );
  const textareaRef = useRef(null);

  useEffect(() => {
    if (typeof prefillMessage !== 'string' || prefillMessage.length === 0) return;
    // Only seed if the user hasn't started typing — a stale prefill
    // arriving mid-typing shouldn't clobber the in-progress draft.
    setDraft((current) => (current ? current : prefillMessage));
    clearPrefillMessage();
    // Move caret to the end so the user can keep typing after the
    // prefilled "re: " excerpt.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      }
    });
  }, [prefillMessage, clearPrefillMessage]);

  const disabled = isTyping || isResting;
  const trimmed = draft.trim();
  const canSend = !disabled && trimmed.length > 0;

  const placeholder = isResting
    ? `${devName} is resting until UTC midnight`
    : isTyping
      ? '...'
      : 'Type a message...';

  const submit = useCallback(async () => {
    if (!canSend) return;
    const text = trimmed;
    // Clear synchronously so the textarea stays responsive even on
    // slow responses. The parent (ChatConversation.handleSend) is
    // expected to return a promise that rejects on transport / API
    // failures — the inline system bubble is added by the parent's
    // catch BEFORE re-throwing here.
    setDraft('');
    try {
      await onSend(text);
    } catch {
      // Restore draft, but only if the textarea is still empty.
      // A user mid-typing a new message during a failed request
      // would otherwise have their new draft clobbered. Functional
      // update reads the latest state so we don't race the user.
      setDraft((current) => (current ? current : text));
    }
  }, [canSend, trimmed, onSend]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return (
    <form
      className={styles.chatComposer}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={textareaRef}
        className={styles.chatComposerTextarea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={MAX_MESSAGE_LEN}
        rows={2}
        aria-label="Message"
      />
      <button
        type="submit"
        className={styles.chatComposerButton}
        disabled={!canSend}
        aria-label="Send message"
      >
        Send
      </button>
    </form>
  );
}
