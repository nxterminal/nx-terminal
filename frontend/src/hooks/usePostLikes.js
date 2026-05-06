/**
 * usePostLikes — toggle like/unlike with optimistic updates.
 *
 * The truth lives on the backend (`user_has_liked` field on each
 * post in the timeline payload). This hook handles the optimistic
 * UI flip + the POST/DELETE round-trip; on failure it doesn't roll
 * back the local state — the next 60s poll will reconcile (same
 * pattern as useSprkls.dismiss).
 *
 * Wiring: usePostsTimeline returns an `updatePost(id, updater)`
 * setter; this hook calls that to flip the local user_has_liked
 * + like_count BEFORE awaiting the network. After the response we
 * sync like_count to the authoritative count from the backend
 * (handles cases where another viewer liked between our optimistic
 * +1 and the round-trip return — rare but possible).
 *
 * Returns: { toggleLike, isLiking }
 *   toggleLike(post): does the right POST/DELETE based on
 *                     post.user_has_liked
 *   isLiking: Set<postId> currently in flight (for disabling
 *             double-clicks per row)
 */

import { useCallback, useRef, useState } from 'react';
import { api } from '../services/api';

export function usePostLikes(walletAddress, { updatePost } = {}) {
  // Set of post ids currently in flight. Stored in state so the UI
  // can disable the affordance per-row; a ref alone wouldn't trigger
  // re-render. New Set on each mutation so React notices.
  const [isLiking, setIsLiking] = useState(() => new Set());

  // Reuse-by-ref for the latest updatePost callback so toggleLike's
  // own identity stays stable across re-renders.
  const updatePostRef = useRef(updatePost);
  updatePostRef.current = updatePost;

  const toggleLike = useCallback(
    async (post) => {
      if (!post || !walletAddress) return;
      const wallet = walletAddress.toLowerCase();
      const wasLiked = !!post.user_has_liked;

      // Optimistic flip — visual feedback before the network.
      if (typeof updatePostRef.current === 'function') {
        updatePostRef.current(post.id, (p) => ({
          user_has_liked: !wasLiked,
          like_count: Math.max(0, (p.like_count || 0) + (wasLiked ? -1 : 1)),
        }));
      }

      setIsLiking((prev) => {
        const next = new Set(prev);
        next.add(post.id);
        return next;
      });

      try {
        const res = wasLiked
          ? await api.unlikePost(post.id, wallet)
          : await api.likePost(post.id, wallet);
        // Sync to authoritative count from the response. Handles
        // the rare race where another viewer liked between our
        // optimistic +1 and the return.
        if (res && typeof res.like_count === 'number'
            && typeof updatePostRef.current === 'function') {
          updatePostRef.current(post.id, () => ({
            like_count: res.like_count,
          }));
        }
      } catch {
        // Silent failure — don't roll back. The next 60s poll
        // re-fetches the timeline with authoritative state and
        // any optimistic mismatch self-corrects. Logging only:
        // eslint-disable-next-line no-console
        console.warn('[usePostLikes] toggle failed for post', post.id);
      } finally {
        setIsLiking((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
      }
    },
    [walletAddress]
  );

  return { toggleLike, isLiking };
}
