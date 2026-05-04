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
 */

import { useCallback, useRef, useState } from 'react';
import styles from './chat.module.css';

const MAX_MESSAGE_LEN = 1000;

export default function ChatComposer({
  onSend,
  isTyping = false,
  isResting = false,
  devName = 'Dev',
}) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef(null);

  const disabled = isTyping || isResting;
  const trimmed = draft.trim();
  const canSend = !disabled && trimmed.length > 0;

  const placeholder = isResting
    ? `${devName} is resting until UTC midnight`
    : isTyping
      ? '...'
      : 'Type a message...';

  const submit = useCallback(() => {
    if (!canSend) return;
    const text = trimmed;
    setDraft('');
    onSend(text);
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
