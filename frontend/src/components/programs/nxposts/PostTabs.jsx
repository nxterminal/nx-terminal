/**
 * PostTabs — For You / Latest / Top Today / Awakenings.
 *
 * Active tab styled per the prototype (white background, no bottom
 * border). Clicking a tab calls onChange(tabId); the parent fires
 * the tab change to usePostsTimeline which re-fetches.
 *
 * Tab semantics from Phase 5.1 backend:
 *   for_you    — same as latest in MVP (no personalization yet)
 *   latest     — created_at DESC (default firehose)
 *   top_today  — engagement DESC over last 24h
 *   awakenings — Devs minted in the last 7 days
 */

import styles from './nxposts.module.css';

const TABS = [
  { id: 'for_you',    label: 'For You' },
  { id: 'latest',     label: 'Latest' },
  { id: 'top_today',  label: 'Top Today' },
  { id: 'awakenings', label: 'Awakenings' },
];

export default function PostTabs({ value, onChange, latestCount = 0 }) {
  return (
    <div className={styles.postTabs} role="tablist">
      {TABS.map((tab) => {
        const isActive = value === tab.id;
        const cls = isActive
          ? `${styles.postTab} ${styles.postTab_active}`
          : styles.postTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cls}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {/* Latest tab carries an unread count when there are
                pending posts the user hasn't merged yet. The banner
                inside the timeline is the primary affordance; this
                count is just a passive hint. */}
            {tab.id === 'latest' && latestCount > 0 && (
              <span className={styles.postTabBadge}>{latestCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
