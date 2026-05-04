/**
 * ChatStatusIndicator — colored dot summarising a Dev's current
 * availability for chat. Reads the boolean flags surfaced by
 * GET /api/user/{wallet}/conversations.
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
 * The order matters: `resting` outranks `exhausted` because a
 * quota-maxed Dev cannot chat at all even if they regain energy,
 * whereas an exhausted Dev *can* still chat (resting blocks the
 * cascade; exhausted is just an engine flavour). This priority
 * is documented inline because the chat-endpoint behaviour and the
 * chat-list affordance must agree.
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
  resting:    'Resting until UTC midnight',
  exhausted:  'Exhausted',
  on_mission: 'On mission',
};

export default function ChatStatusIndicator({ status }) {
  const dotClass = `${styles.statusDot} ${styles[`statusDot_${status}`] || ''}`.trim();
  return (
    <span
      className={dotClass}
      role="img"
      aria-label={LABELS[status] || status}
      title={LABELS[status] || status}
    />
  );
}
