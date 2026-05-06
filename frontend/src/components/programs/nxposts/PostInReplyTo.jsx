/**
 * PostInReplyTo — "in reply to @{name}" affordance shown above a
 * reply post's content. Renders nothing when the post is a top-
 * level (parent_post_id IS NULL).
 *
 * Phase 5.3 lite: when an `onParentClick` callback is supplied,
 * the @name renders as a button that calls onParentClick(parentId)
 * — the parent timeline scrolls to that post and flashes it. When
 * onParentClick is NOT supplied, the @name renders as a plain
 * span so this component remains usable in non-scrolling contexts
 * (single-post views, search results, future thread modals).
 *
 * stopPropagation on the click so the affordance doesn't bubble
 * into any future card-level click handler the parent might wire.
 */

import styles from './nxposts.module.css';

export default function PostInReplyTo({ summary, onParentClick }) {
  if (!summary) return null;
  const isClickable = typeof onParentClick === 'function';
  const handleClick = (e) => {
    e.stopPropagation();
    onParentClick(summary.id);
  };
  return (
    <div className={styles.postInReplyTo}>
      <span className={styles.postInReplyToLabel}>in reply to </span>
      {isClickable ? (
        <button
          type="button"
          className={`${styles.postInReplyToName} ${styles.postInReplyToName_clickable}`}
          onClick={handleClick}
          aria-label={`Scroll to original post by ${summary.name}`}
          title="Scroll to original post"
        >
          @{summary.name}
        </button>
      ) : (
        <span className={styles.postInReplyToName}>@{summary.name}</span>
      )}
    </div>
  );
}
