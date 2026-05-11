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
  // Phase 5.4.1 — Set<number> of token_ids owned by the connected
  // wallet. Optional / defaulted to an empty Set so the timeline
  // still renders when no wallet is connected; every post lookup
  // returns false in that state, which is the correct read-only
  // behaviour.
  ownedTokenIdSet,
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

  // Active flash timeouts, keyed by postId. Used to:
  //   1. Cancel a still-running flash when the user clicks the
  //      same parent again (rapid re-clicks would otherwise stack
  //      timers and double-fire classList.remove).
  //   2. Clear all pending timers on unmount so a Win98 window
  //      close mid-flash doesn't leave callbacks holding refs to
  //      detached DOM nodes.
  const flashTimeoutsRef = useRef(new Map());

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
   *   - Per-parent timeout tracking via flashTimeoutsRef lets a
   *     rapid re-click cancel the previous flash and start fresh
   *     without a doubled animation; unmount cleanup below clears
   *     any pending timers so the callback never runs against a
   *     detached element.
   */
  const scrollToParent = useCallback((parentId) => {
    if (parentId == null) return;
    const el = document.querySelector(`[data-post-id="${parentId}"]`);
    if (!el) return; // parent not in DOM — silent no-op per brief
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const flashClass = styles.postCard_flash;
    if (!flashClass) return;

    // Cancel an in-flight flash on the same parent (rapid re-click)
    // so we don't end up with two timers racing to remove the class.
    const existing = flashTimeoutsRef.current.get(parentId);
    if (existing != null) {
      clearTimeout(existing);
      // The class is already on the element; remove + re-add so the
      // CSS animation restarts from frame 0 instead of finishing
      // whatever fraction of the previous run was still playing.
      el.classList.remove(flashClass);
      // Force a reflow so the browser registers the removal before
      // we re-add — without this, the class toggle in the same
      // microtask is a no-op and the animation doesn't restart.
      // void el.offsetWidth is the canonical force-reflow trick.
      // eslint-disable-next-line no-unused-expressions
      void el.offsetWidth;
    }

    el.classList.add(flashClass);
    const timeoutId = setTimeout(() => {
      el.classList.remove(flashClass);
      flashTimeoutsRef.current.delete(parentId);
    }, FLASH_DURATION_MS);
    flashTimeoutsRef.current.set(parentId, timeoutId);
  }, []);

  // Cleanup on unmount — clear any pending flash timers so their
  // closures don't keep references to detached DOM nodes after a
  // window close. The Map itself goes with the component; we just
  // need to cancel the OS-level timers.
  useEffect(() => {
    const timers = flashTimeoutsRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
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
          const isOwnedByCurrentUser =
            !!ownedTokenIdSet &&
            ownedTokenIdSet.has(Number(post.token_id));
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
              isOwnedByCurrentUser={isOwnedByCurrentUser}
            />
          );
        })}
      </div>
    </div>
  );
}
