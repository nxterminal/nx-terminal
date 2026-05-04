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
 *       fresh LLM reply (light italic, dashed border, 💤 prefix).
 *   - { role: 'system',    content, timestamp, kind: 'error' }
 *       Centered, muted; used by ChatConversation to surface network /
 *       rate-limit / overload errors as inline messages without
 *       interrupting the conversation flow.
 *
 * Timestamp format: HH:MM in the user's local timezone.
 *
 * Phase 3.5:
 *   - Dev avatar uses the MyDevs PFP-zoom pattern (scale 2.2 +
 *     transformOrigin 'center 32%') so the face is in frame at the
 *     small 28px size.
 *   - The wrapper carries `.chatMessage` so the message-slide-in
 *     keyframe in chat.module.css triggers on every new bubble.
 */

import styles from './chat.module.css';

const MESSAGE_AVATAR_SIZE_PX = 28;

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
      <div className={`${styles.chatMessageSystem} ${styles.chatMessage}`}>
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
      <div className={`${styles.chatMessageUser} ${styles.chatMessage}`}>
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
    <div className={`${styles.chatMessageDev} ${styles.chatMessage}`}>
      <div
        className={styles.chatAvatarFrame}
        style={{
          width: MESSAGE_AVATAR_SIZE_PX,
          height: MESSAGE_AVATAR_SIZE_PX,
        }}
      >
        {dev?.ipfs_image ? (
          <img
            src={dev.ipfs_image}
            alt=""
            loading="lazy"
            className={styles.chatAvatarImage}
          />
        ) : (
          <div className={styles.chatAvatarFallback}>
            {dev?.name?.slice(0, 2).toUpperCase() || '??'}
          </div>
        )}
      </div>
      <div className={styles.chatMessageDevBody}>
        <div className={bubbleClass}>
          {isResting ? <span className={styles.chatMessageRestingPrefix}>💤 </span> : null}
          {content}
        </div>
        <div className={styles.chatMessageTimestamp}>
          {formatTimestamp(timestamp)}
        </div>
      </div>
    </div>
  );
}
