/**
 * usePostsTimeline — global feed polling + "new posts" banner.
 *
 * Polls GET /api/posts/timeline?tab=...&wallet=... every 60s.
 * Tracks the highest post id seen so newer posts (received on a
 * subsequent poll) accumulate in `pendingPosts` instead of pushing
 * the user's scroll position. Calling `mergePending()` flushes
 * pending into the visible list and clears the banner.
 *
 * Mirrors useSprkls / useConversations:
 *   - Initial loading=true (Phase 3.5.2.3 lesson — a `loading=false
 *     && posts=[]` first render would briefly look like "fetch
 *     completed empty" to any consumer guarding on `loading`).
 *   - fetchTokenRef stale-token check (Phase 3.5.2.5 — drops late
 *     responses arriving after a wallet flip / tab change).
 *   - Two distinct early-return branches:
 *       !enabled        → settle to clean idle (clear state)
 *       !walletAddress  → keep loading=true, preserve cached posts
 *
 * Tab change semantics: switching tabs resets pendingPosts (the
 * "↑ N new" banner is meaningless across a different ordering) and
 * fires an immediate refetch. The fetch token bumps so any
 * in-flight response from the previous tab is dropped.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const POLL_INTERVAL_MS = 60_000;
const PAGE_LIMIT = 20;

export function usePostsTimeline(walletAddress, { enabled = true, tab = 'latest' } = {}) {
  const [posts, setPosts] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTokenRef = useRef(0);
  // Highest post id currently in `posts`. Comparing against this on
  // every poll lets us classify newly-arrived rows as either "fresh
  // since last view" (banner) or "already shown".
  const maxKnownIdRef = useRef(0);

  const doFetch = useCallback(
    async (myToken, { initial = false } = {}) => {
      try {
        const res = await api.getPostsTimeline({
          tab,
          limit: PAGE_LIMIT,
          // Wallet is optional — when provided, the server returns
          // user_has_liked: bool per row. Lowercased to match the
          // backend's address normalisation.
          wallet: walletAddress ? walletAddress.toLowerCase() : undefined,
        });
        if (myToken !== fetchTokenRef.current) return; // stale
        const fresh = Array.isArray(res?.posts) ? res.posts : [];

        if (initial) {
          // First fetch (or tab change) — replace wholesale and
          // record the high-water mark. No pending classification.
          setPosts(fresh);
          maxKnownIdRef.current = fresh.length > 0 ? fresh[0].id : 0;
          setPendingPosts([]);
        } else {
          // Subsequent poll. Anything with id > maxKnownIdRef is new.
          // Backend orders DESC, so newer ids land at the front.
          const newer = fresh.filter((p) => p.id > maxKnownIdRef.current);
          if (newer.length > 0) {
            // Merge with existing pending (defensive — a slow
            // network might mean a poll fires mid-mergePending).
            setPendingPosts((prev) => {
              const seen = new Set(prev.map((p) => p.id));
              const additions = newer.filter((p) => !seen.has(p.id));
              return [...additions, ...prev];
            });
          }
          // Refresh in-place engagement counters / user_has_liked
          // for posts already visible. Keeping the same id-keyed
          // array preserves React's reconciliation across re-renders.
          setPosts((prev) =>
            prev.map((existing) => {
              const updated = fresh.find((p) => p.id === existing.id);
              return updated ? updated : existing;
            })
          );
        }
        setError(null);
      } catch (e) {
        if (myToken !== fetchTokenRef.current) return;
        setError(e);
      } finally {
        if (myToken === fetchTokenRef.current) {
          setLoading(false);
        }
      }
    },
    [tab, walletAddress]
  );

  /**
   * Flush pending posts to the top of the visible timeline. Updates
   * the high-water mark in the same pass so a poll firing
   * concurrently can't reclassify the same rows as "new" again.
   */
  const mergePending = useCallback(() => {
    setPendingPosts((pending) => {
      if (pending.length === 0) return pending;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const additions = pending.filter((p) => !seen.has(p.id));
        const merged = [...additions, ...prev];
        if (merged.length > 0) {
          maxKnownIdRef.current = merged[0].id;
        }
        return merged;
      });
      return [];
    });
  }, []);

  const refresh = useCallback(() => {
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;
    if (!enabled) return;
    setLoading(true);
    doFetch(myToken, { initial: true });
  }, [enabled, doFetch]);

  // Update one post's local state (used by usePostLikes for the
  // optimistic toggle). Returning a function via the hook keeps
  // the post-list updates centralised in this module.
  const updatePost = useCallback((postId, updater) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updater(p) } : p))
    );
    setPendingPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updater(p) } : p))
    );
  }, []);

  useEffect(() => {
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;

    if (!enabled) {
      setLoading(false);
      setPosts([]);
      setPendingPosts([]);
      maxKnownIdRef.current = 0;
      setError(null);
      return undefined;
    }
    if (!walletAddress && tab === 'latest') {
      // Anonymous timeline view is allowed (the endpoint doesn't
      // require wallet for the public feed). For tabs that don't
      // need user_has_liked, fetch immediately. We keep the
      // wallet-required check off because the global feed is
      // intentionally readable without auth.
    }

    // Tab change OR first mount → reset pending and treat the next
    // fetch as `initial` so the high-water mark anchors at the
    // freshest row of the new ordering.
    setPendingPosts([]);
    maxKnownIdRef.current = 0;
    setLoading(true);
    doFetch(myToken, { initial: true });

    const interval = setInterval(() => doFetch(myToken), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [walletAddress, enabled, tab, doFetch]);

  return {
    posts,
    pendingPosts,
    loading,
    error,
    mergePending,
    refresh,
    updatePost,
  };
}
