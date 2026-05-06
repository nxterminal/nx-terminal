/**
 * PostInReplyTo — "in reply to @{name}" affordance shown above a
 * reply post's content. Renders nothing when the post is a top-
 * level (parent_post_id IS NULL). Click is a no-op for MVP — Phase
 * 5.x can scroll-to-parent or open a dedicated thread view.
 */

import styles from './nxposts.module.css';

export default function PostInReplyTo({ summary }) {
  if (!summary) return null;
  return (
    <div className={styles.postInReplyTo}>
      <span className={styles.postInReplyToLabel}>in reply to </span>
      <span className={styles.postInReplyToName}>@{summary.name}</span>
    </div>
  );
}
