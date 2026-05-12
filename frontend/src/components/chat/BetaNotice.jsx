/**
 * BetaNotice — persistent informational strip rendered between the
 * ChatModalHeader and the modal body during Phase 5.5 / public-beta.
 *
 * Why a separate component:
 *   - ChatModal already conditionally branches on desktop vs mobile;
 *     a small subcomponent keeps the same banner element identical
 *     in both branches without duplicating the JSX inline.
 *   - Pure presentational — no state, no props. Stays a literal
 *     string until the beta window closes (then deleted along with
 *     the import).
 *
 * Deliberately NOT dismissable: dismissal state would have to live
 * in localStorage (per-device) or context (per-session) and would
 * complicate the modal's mount lifecycle. The brief explicitly
 * rules dismissal out for this PR.
 *
 * The 30-msg/day per-wallet limit is NOT mentioned in the banner —
 * it's a server-side internal detail. Surfacing the exact number
 * would invite users to optimize against it and would break if we
 * tune the value later.
 *
 * Phase 5.6.3/5.6.4 — copy refactor: the original "Beta: chats
 * reset every 24h" read like a system disclaimer. The new line
 * (English, in keeping with the rest of the UI) frames the 24h
 * memory reset as part of the Devs' personality rather than a
 * platform limit. The trailing "Probably." fragment is intentional
 * — the self-aware undermining of the previous sentence is the
 * joke; do not "fix" the grammar.
 */

import styles from './chat.module.css';

export default function BetaNotice() {
  return (
    <div className={styles.betaNotice} role="status">
      Devs run on caffeine and 24h memory cycles. Probably.
    </div>
  );
}
