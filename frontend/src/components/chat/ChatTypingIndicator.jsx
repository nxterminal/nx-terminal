/**
 * ChatTypingIndicator — bubble shown while the LLM cascade is in
 * flight.
 *
 * Two phases:
 *   - 0..5s   "🐰 {name} is typing..."     (the cascade is fast — Groq
 *                                            usually returns in ~1s)
 *   - 5s+     "🐰 {name} is thinking deeply..."
 *                                          (something slower is
 *                                           happening — most likely
 *                                           the climax cascade routed
 *                                           the turn to OpenRouter
 *                                           Sonnet, which takes 3-15s)
 *
 * Animated dots come from a CSS keyframe defined in chat.module.css —
 * three dots with staggered opacity. This component just toggles the
 * label.
 */

import { useEffect, useState } from 'react';
import styles from './chat.module.css';

const SLOW_THRESHOLD_MS = 5000;

export default function ChatTypingIndicator({ dev }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(t);
  }, []);

  const verb = slow ? 'is thinking deeply' : 'is typing';

  return (
    <div className={styles.chatTypingIndicator}>
      <span className={styles.chatTypingPrefix}>🐰</span>
      <span>
        {dev?.name ?? 'Dev'} {verb}
        <span className={styles.chatTypingDots}>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </div>
  );
}
