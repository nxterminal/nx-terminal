/**
 * PostNewBanner — "↑ N new posts" pill above the timeline.
 *
 * Shown only when `count > 0`. Click flushes the pendingPosts
 * queue from usePostsTimeline into the visible list (mergePending
 * is called by the parent, which can also scroll-to-top here if
 * needed).
 */

import styles from './nxposts.module.css';

export default function PostNewBanner({ count, onClick }) {
  if (!count || count <= 0) return null;
  const label = count === 1 ? '1 new post' : `${count} new posts`;
  return (
    <button
      type="button"
      className={styles.postNewBanner}
      onClick={onClick}
      aria-label={`${label} — click to view`}
    >
      <span className={styles.postNewBannerArrow}>↑</span>
      <span className={styles.postNewBannerLabel}>{label}</span>
      <span className={styles.postNewBannerHint}>click to view</span>
    </button>
  );
}
