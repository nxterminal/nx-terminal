/**
 * ChatStatusIndicator — coloured dot (and optional label) summarising
 * a Dev's current availability for chat. Reads the boolean flags
 * surfaced by GET /api/user/{wallet}/conversations.
 *
 * Priority (first match wins):
 *   1. is_resting     → 💤 muted-blue   (quota maxed; rests until UTC
 *                                        midnight; chat-endpoint will
 *                                        reply with the in-character
 *                                        rest line until then)
 *   2. is_exhausted   → 🟣 violet       (engine state, energy 0)
 *   3. is_on_mission  → ⚪ grey         (chat still works but the Dev
 *                                        is "busy")
 *   4. else           → 🟢 green        (active, fresh quota)
 *
 * `resting` outranks `exhausted` because a quota-maxed Dev cannot
 * chat at all even if they regain energy, whereas an exhausted Dev
 * *can* still chat. This priority is documented inline because the
 * chat-endpoint behaviour and the chat-list affordance must agree.
 *
 * `showLabel` (default false) renders a short text label next to the
 * dot. The chat-list rows and the conversation-view header opt in to
 * the label; compact/inline indicators (e.g. future Phase 3.6 entry
 * buttons) keep it off.
 */

import styles from './chat.module.css';

export function getDevChatStatus(dev) {
  if (!dev) return 'active';
  if (dev.is_resting) return 'resting';
  if (dev.is_exhausted) return 'exhausted';
  if (dev.is_on_mission) return 'on_mission';
  return 'active';
}

const LABELS = {
  active:     'Active',
  // Shortened from "Resting until UTC midnight" — the full phrase
  // lives in the title attribute / banner copy. The label here
  // sits alongside other one-word statuses, so brevity wins.
  resting:    'Resting',
  exhausted:  'Exhausted',
  on_mission: 'On mission',
};

const FULL_TITLES = {
  active:     'Active',
  resting:    'Resting until UTC midnight',
  exhausted:  'Exhausted',
  on_mission: 'On mission',
};

export default function ChatStatusIndicator({ status, showLabel = false }) {
  const dotClass =
    `${styles.statusDot} ${styles[`statusDot_${status}`] || ''}`.trim();
  const fullTitle = FULL_TITLES[status] || status;
  const shortLabel = LABELS[status] || status;

  if (!showLabel) {
    return (
      <span
        className={dotClass}
        role="img"
        aria-label={fullTitle}
        title={fullTitle}
      />
    );
  }

  return (
    <span className={styles.statusContainer} title={fullTitle}>
      <span className={dotClass} aria-hidden="true" />
      <span className={styles.statusLabel} aria-label={fullTitle}>
        {shortLabel}
      </span>
    </span>
  );
}
