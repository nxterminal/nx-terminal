/**
 * useConversations(walletAddress, { enabled, polling }) — chat-list
 * feed for the NX Souls modal.
 *
 * Two independent gates:
 *
 *   - `enabled` (default true)
 *       false → no fetch at all, drops any cached data + state. Used
 *       when the modal is closed or no wallet is connected.
 *
 *   - `polling` (default true)
 *       false → fetches once on mount but skips the recurring 60s
 *       interval. Used while the modal is in conversation view, where
 *       we still need the dev metadata cached but don't want to keep
 *       hammering the server every minute (Phase 3.3 brief).
 *       Crucially, flipping `polling` false does NOT drop cached
 *       data — the conversation view depends on the dev row staying
 *       resolved while the user reads / sends.
 *
 * Returns:
 *   - devs:    Array<DevConversation> (last good list; preserved across
 *              transient errors and polling pauses)
 *   - loading: true only during the FIRST fetch per (wallet, enabled)
 *              cycle — subsequent polls don't flip back to true so the
 *              list doesn't flash a skeleton every minute
 *   - error:   Error | null (last fetch error)
 *   - refresh: () => void  (manual refetch — Phase 3.4 calls this
 *              after a chat that consumed quota so the list shows
 *              fresh quota counters when the user returns to it)
 *
 * Stale-token check inside the fetch drops responses that arrive
 * after we've moved on (wallet flip, modal close), so React 19
 * StrictMode's double-effect doesn't produce stale data or
 * "set state on unmounted component" warnings.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const POLL_INTERVAL_MS = 60_000;

export function useConversations(
  walletAddress,
  { enabled = true, polling = true } = {}
) {
  const [devs, setDevs] = useState([]);
  // Initial state is TRUE for the same reason as useActiveChats: the
  // hook fires its first fetch synchronously on mount, so any
  // consumer guarding on `loading` should observe "loading" until
  // the first response lands. Initialising false would briefly
  // expose `loading=false && devs=[]` on the very first render,
  // which a consumer could misinterpret as "fetch completed empty"
  // (the Phase 3.5.2 spurious-picker bug, applied symmetrically
  // here so a future caller doesn't repeat it).
  const [loading, setLoading] = useState(true);
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
  // without resetting the polling interval. Phase 3.4 ChatConversation
  // calls this after a chat that consumed a quota slot so the list
  // shows fresh counters when the user returns to it.
  const refresh = useCallback(() => {
    doFetch(fetchTokenRef.current);
  }, [doFetch]);

  // Fetch + polling effect. `enabled` gates whether anything happens
  // at all; `polling` independently gates the recurring interval, so
  // pausing polling while in conversation view doesn't drop the
  // cached list.
  useEffect(() => {
    if (!enabled) {
      // Explicitly disabled by consumer — settle to a clean idle
      // state so a subsequent re-enable starts fresh. Bump the
      // fetch token so any in-flight response from the previous
      // cycle becomes stale.
      fetchTokenRef.current += 1;
      firstFetchDoneRef.current = false;
      setLoading(false);
      setDevs([]);
      setError(null);
      return undefined;
    }
    if (!walletAddress) {
      // Waiting for the wallet to resolve (wagmi hasn't returned an
      // address yet on cold load). Keep `loading=true` so the
      // ChatModal auto-select effect doesn't mis-interpret the
      // pre-fetch render as "fetch completed empty" and pop the
      // NewChatPicker (the bug Phase 3.5.2.4 diagnostics confirmed
      // for the parallel useActiveChats hook). Don't reset devs
      // either — a brief wallet=undefined during a reconnect would
      // otherwise wipe a populated list.
      fetchTokenRef.current += 1;
      firstFetchDoneRef.current = false;
      setError(null);
      return undefined;
    }

    // Bump the token on every effect run so a previous-cycle response
    // can't clobber state from this cycle.
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;

    // Only flip loading when we don't have data yet; this keeps the
    // cached list visible while a polling-paused → polling-resumed
    // transition (or a manual refresh) is in flight.
    if (!firstFetchDoneRef.current) {
      setLoading(true);
    }
    doFetch(myToken);

    if (!polling) return undefined; // initial fetch only

    const interval = setInterval(() => doFetch(myToken), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [walletAddress, enabled, polling, doFetch]);

  return { devs, loading, error, refresh };
}

