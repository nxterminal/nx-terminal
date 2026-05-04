/**
 * useConversations(walletAddress, { enabled }) — chat-list feed for the
 * NX Souls modal.
 *
 * Polls GET /api/user/{wallet}/conversations every 60 seconds while
 * `enabled` is true (the chat modal is in list view), and pauses when
 * `enabled` flips false (modal is in conversation view, or closed).
 *
 * Returns:
 *   - devs:    Array<DevConversation> — empty until first response lands
 *   - loading: true while the FIRST fetch is in flight; subsequent
 *              polls don't flip this back to true so the list doesn't
 *              flash "Loading…" every minute. Use `error` to surface
 *              a refresh-failed state if you need one.
 *   - error:   Error | null — last fetch error
 *   - refresh: () => void — manual refetch (e.g., after a chat that
 *              consumed quota)
 *
 * Cleanup: the polling interval is cleared on unmount and on every
 * change to `walletAddress` / `enabled`. An in-flight fetch that
 * resolves after the hook unmounts (or after walletAddress changes)
 * is dropped via a stale-token check, so React 19 StrictMode's
 * double-effect doesn't produce a "set state on unmounted component"
 * warning or stale data.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const POLL_INTERVAL_MS = 60_000;

export function useConversations(walletAddress, { enabled = true } = {}) {
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bumped on every (walletAddress, enabled) change. In-flight fetches
  // compare against the captured value at request time and bail if it
  // doesn't match the current ref, so a slow response that arrives
  // after we've moved on doesn't clobber fresher state.
  const fetchTokenRef = useRef(0);
  // Track whether we've completed the first successful (or failed)
  // fetch for the current wallet. The first fetch flips `loading=true`
  // so the UI can render a skeleton; subsequent polls keep `loading`
  // false to avoid a one-second skeleton flash every minute.
  const firstFetchDoneRef = useRef(false);

  const doFetch = useCallback(
    async (myToken) => {
      if (!walletAddress) return;
      try {
        const res = await api.getUserConversations(walletAddress);
        if (myToken !== fetchTokenRef.current) return; // stale
        setDevs(Array.isArray(res?.devs) ? res.devs : []);
        setError(null);
      } catch (e) {
        if (myToken !== fetchTokenRef.current) return; // stale
        setError(e);
      } finally {
        if (myToken === fetchTokenRef.current) {
          firstFetchDoneRef.current = true;
          setLoading(false);
        }
      }
    },
    [walletAddress]
  );

  // Manual refresh — fires a one-shot fetch under the current token
  // without resetting the polling interval. Useful after the user
  // sends a chat (Phase 3.4) that consumed a quota slot.
  const refresh = useCallback(() => {
    doFetch(fetchTokenRef.current);
  }, [doFetch]);

  useEffect(() => {
    // Bump the token: any in-flight fetch from a previous wallet /
    // enabled state becomes stale.
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;
    firstFetchDoneRef.current = false;

    if (!enabled || !walletAddress) {
      // Disabled or wallet not connected — clear out any prior data
      // so a stale list doesn't flash when the modal re-opens for a
      // different wallet.
      setLoading(false);
      setDevs([]);
      setError(null);
      return undefined;
    }

    setLoading(true);
    doFetch(myToken);

    const interval = setInterval(() => doFetch(myToken), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [walletAddress, enabled, doFetch]);

  return { devs, loading, error, refresh };
}
