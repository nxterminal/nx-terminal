/**
 * ChatMessage — one bubble in the conversation log.
 *
 * Three kinds of messages flow through here:
 *   - { role: 'user',      content, timestamp }
 *       Aligned right, no avatar.
 *   - { role: 'assistant', content, timestamp, is_resting?, provider_used? }
 *       Aligned left, mini avatar of the Dev. When `is_resting` is
 *       true the bubble gets a subtler treatment so the user can tell
 *       at a glance that this was the in-character rest line, not a
 *       fresh LLM reply.
 *   - { role: 'system',    content, timestamp, kind: 'error' }
 *       Centered, muted; used by ChatConversation to surface network /
 *       rate-limit / overload errors as inline messages without
 *       interrupting the conversation flow.
 *
 * Timestamp format: HH:MM in the user's local timezone — the brief's
 * "no full ISO, no seconds" rule. We could use Intl.DateTimeFormat
 * with a memo if locale switching ever matters, but Date#toLocale-
 * TimeString is fine for one bubble per message.
 */

import styles from './chat.module.css';

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export default function ChatMessage({ message, dev }) {
  const { role, content, timestamp } = message;

  if (role === 'system') {
    return (
      <div className={styles.chatMessageSystem}>
        <span>{content}</span>
        {timestamp ? (
          <span className={styles.chatMessageTimestamp}>
            {formatTimestamp(timestamp)}
          </span>
        ) : null}
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div className={styles.chatMessageUser}>
        <div className={styles.chatMessageBubble}>{content}</div>
        <div className={styles.chatMessageTimestamp}>
          {formatTimestamp(timestamp)}
        </div>
      </div>
    );
  }

  // role === 'assistant'
  const isResting = message.is_resting === true;
  const bubbleClass = `${styles.chatMessageBubble} ${
    isResting ? styles.chatMessageBubbleResting : ''
  }`.trim();

  return (
    <div className={styles.chatMessageDev}>
      {dev?.ipfs_image ? (
        <img
          src={dev.ipfs_image}
          alt=""
          className={styles.chatMessageAvatarMini}
          loading="lazy"
        />
      ) : (
        <div
          className={`${styles.chatMessageAvatarMini} ${styles.chatListAvatarFallback}`}
        >
          {dev?.name?.slice(0, 2).toUpperCase() || '??'}
        </div>
      )}
      <div className={styles.chatMessageDevBody}>
        <div className={bubbleClass}>{content}</div>
        <div className={styles.chatMessageTimestamp}>
          {formatTimestamp(timestamp)}
        </div>
      </div>
    </div>
  );
}
