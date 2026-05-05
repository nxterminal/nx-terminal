/**
 * useSprkls(walletAddress, { enabled }) — non-dismissed, non-expired
 * sprkl feed for the chrome-floating SprklsLayer (Phase 4.2).
 *
 * Mirrors useActiveChats / useConversations exactly:
 *   - 60s poll while enabled
 *   - fetchTokenRef stale-token check inside doFetch (drops responses
 *     that arrive after we've moved on — wallet flip, layer
 *     unmount under React 19 StrictMode's double-effect)
 *   - Initial loading=true (Phase 3.5.2.3 lesson — a `loading=false
 *     && sprkls=[]` first render would briefly look like "fetch
 *     completed empty" to any consumer guarding on `loading`).
 *   - Two distinct early-return branches (Phase 3.5.2.5 lesson):
 *       !enabled        → settle to clean idle (clear state)
 *       !walletAddress  → keep loading=true, preserve cached array
 *
 * Adds a `dismiss(postId)` helper because the SprklsLayer needs to
 * fire the POST and update local state in one call, not via a
 * `mutator + refetch` round-trip. Keeps the toast disappearance
 * snappy (no 60s wait for the next poll to confirm).
 *
 * Phase 4.2 only consumes action_type='toast'. The hook still
 * returns every sprkl regardless of action_type so future phases
 * (graffiti / window / cursor_prank etc.) can layer on without
 * touching the hook.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const POLL_INTERVAL_MS = 60_000;

export function useSprkls(walletAddress, { enabled = true } = {}) {
  const [sprkls, setSprkls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bumped on every (wallet, enabled) change. In-flight fetches
  // compare against the captured value at request time and bail if
  // the ref no longer matches.
  const fetchTokenRef = useRef(0);

  const doFetch = useCallback(
    async (myToken) => {
      if (!walletAddress) return;
      try {
        const res = await api.getSprkls(walletAddress);
        if (myToken !== fetchTokenRef.current) return; // stale
        setSprkls(Array.isArray(res?.sprkls) ? res.sprkls : []);
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
    [walletAddress]
  );

  /**
   * Best-effort dismissal. Optimistically removes the sprkl from
   * local state BEFORE the network round-trip so the toast
   * disappears immediately; if the POST fails (transient network
   * blip), the next poll will surface the same sprkl again — no
   * permanent UI corruption. We deliberately do NOT roll back the
   * optimistic remove on error: if the network came back up by the
   * time we'd roll back, the user would see a flicker. Better to
   * trust the next poll to be the source of truth.
   */
  const dismiss = useCallback(
    async (postId) => {
      if (!walletAddress) return;
      setSprkls((prev) => prev.filter((s) => s.id !== postId));
      try {
        await api.dismissSprkl(walletAddress, postId);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useSprkls] dismiss failed:', e);
      }
    },
    [walletAddress]
  );

  const refresh = useCallback(() => {
    doFetch(fetchTokenRef.current);
  }, [doFetch]);

  useEffect(() => {
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;

    if (!enabled) {
      // Explicitly disabled — settle to a clean idle state.
      setLoading(false);
      setSprkls([]);
      setError(null);
      return undefined;
    }
    if (!walletAddress) {
      // Waiting for the wallet to resolve (wagmi cold-load).
      // Same lesson as Phase 3.5.2.5: keep loading=true so consumers
      // don't mis-interpret the pre-fetch render as "fetch completed
      // empty". Don't reset sprkls either — a brief wallet flicker
      // during reconnect would otherwise wipe the visible feed.
      setError(null);
      return undefined;
    }

    setLoading(true);
    doFetch(myToken);

    const interval = setInterval(() => doFetch(myToken), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [walletAddress, enabled, doFetch]);

  return { sprkls, loading, error, dismiss, refresh };
}
