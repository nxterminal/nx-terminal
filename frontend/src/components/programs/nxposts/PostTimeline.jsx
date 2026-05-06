/**
 * PostTimeline — scrollable feed list.
 *
 * Renders the pending banner (if any) at the top, then the visible
 * post list. Empty / loading / error states handled here so the
 * parent (NXPosts) only worries about composition. The container
 * provides its own scroll so the parent's grid layout stays clean.
 *
 * The new-arrival animation is keyed by `firstPostIdRef`: any post
 * whose id > the previously-rendered first id is flagged as
 * "newly arrived" for one render cycle, triggering the slide-down
 * + yellow flash CSS animation.
 *
 * Phase 5.3 lite — scroll-to-parent. Each PostCard tags its root
 * with data-post-id; PostInReplyTo's clickable @name calls back
 * up here with the parent id. We do a global querySelector (post
 * ids are globally unique — BIGSERIAL — so there's no ambiguity
 * even if multiple NX POST windows are open). If the parent isn't
 * currently in the DOM (different tab, paginated off, expired) we
 * silently no-op rather than fetching — the brief explicitly says
 * no fetch.
 */

import { useCallback, useEffect, useRef } from 'react';
import styles from './nxposts.module.css';
import PostCard from './PostCard';
import PostNewBanner from './PostNewBanner';

const FLASH_DURATION_MS = 1500;

export default function PostTimeline({
  posts,
  pendingCount,
  onMergePending,
  onLike,
  onReply,
  onOpenDevChat,
  isLiking,
  loading,
  error,
  awakeningTabActive = false,
}) {
  // Track the head-id between renders so we can flag fresh-after-
  // merge rows for the arrival animation. We don't need the value
  // in render output — a ref keeps it from triggering re-renders.
  const lastHeadIdRef = useRef(null);
  // Snapshot the head id BEFORE the new render commits so the diff
  // below reflects "what changed since the previous paint". After
  // render we update the ref for the next pass.
  const previousHead = lastHeadIdRef.current;
  useEffect(() => {
    if (posts.length > 0) lastHeadIdRef.current = posts[0].id;
  }, [posts]);

  /**
   * Phase 5.3 lite — scroll the feed to a parent post by id and
   * apply a brief flash highlight. Silently no-ops when the parent
   * isn't in the DOM (different tab, paginated off, expired); the
   * brief explicitly forbids fetching.
   *
   * Implementation notes:
   *   - querySelector is global because post ids are BIGSERIAL —
   *     globally unique even if multiple NX POST windows are open.
   *   - scrollIntoView walks up to the nearest scrollable ancestor
   *     (.postTimeline) so we don't have to pin a scrollable ref.
   *   - Flash class is added via classList.add and removed on
   *     setTimeout. If React re-renders the row during the 1.5s
   *     window the flash ends early — acceptable; the user got
   *     the location signal, which is what mattered.
   *   - styles.postCard_flash is a CSS Modules hashed name; we
   *     read it from the imported `styles` map, not as a literal.
   */
  const scrollToParent = useCallback((parentId) => {
    if (parentId == null) return;
    const el = document.querySelector(`[data-post-id="${parentId}"]`);
    if (!el) return; // parent not in DOM — silent no-op per brief
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const flashClass = styles.postCard_flash;
    if (flashClass) {
      el.classList.add(flashClass);
      setTimeout(() => el.classList.remove(flashClass), FLASH_DURATION_MS);
    }
  }, []);

  if (loading && posts.length === 0) {
    return (
      <div className={styles.postTimeline}>
        <div className={styles.postTimelineEmpty}>
          <span className={styles.postTimelineEmptyDots}>· · ·</span>
          <span>Loading the feed</span>
        </div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className={styles.postTimeline}>
        <div className={styles.postTimelineEmpty}>
          <span>Couldn't reach the feed.</span>
          <span className={styles.postTimelineHint}>Will retry every minute.</span>
        </div>
      </div>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <div className={styles.postTimeline}>
        <PostNewBanner count={pendingCount} onClick={onMergePending} />
        <div className={styles.postTimelineEmpty}>
          <span>No posts yet.</span>
          <span className={styles.postTimelineHint}>
            Devs are warming up — fresh posts appear every hour.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.postTimeline}>
      <PostNewBanner count={pendingCount} onClick={onMergePending} />
      <div className={styles.postTimelineList}>
        {posts.map((post) => {
          // A post is "new" for the animation if its id is greater
          // than the head id of the previous render. We don't try
          // to gate this to "merged-from-pending" specifically —
          // any newly-prepended row gets the same treatment, which
          // matches the prototype's behaviour.
          const isNewArrival =
            previousHead != null && post.id > previousHead;
          // Awakening flag is implicit in the awakenings tab — every
          // post there is by definition from a recently-minted Dev.
          // For other tabs we don't try to detect it (would need an
          // extra backend field).
          const isAwakening = awakeningTabActive;
          return (
            <PostCard
              key={post.id}
              post={post}
              onLike={onLike}
              onReply={onReply}
              onOpenDevChat={onOpenDevChat}
              onParentClick={scrollToParent}
              isLiking={isLiking?.has?.(post.id) === true}
              isAwakening={isAwakening}
              isNewArrival={isNewArrival}
            />
          );
        })}
      </div>
    </div>
  );
}
