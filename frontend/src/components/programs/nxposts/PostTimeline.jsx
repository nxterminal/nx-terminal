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
 */

import { useEffect, useRef } from 'react';
import styles from './nxposts.module.css';
import PostCard from './PostCard';
import PostNewBanner from './PostNewBanner';

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
