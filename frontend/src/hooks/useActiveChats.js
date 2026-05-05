/**
 * useActiveChats(walletAddress, { enabled }) — chat-list feed for the
 * NX Souls modal's left pane (Phase 3.5.2 split view).
 *
 * Mirrors useConversations.js exactly in structure (poll every 60s,
 * stale-token check, first-fetch-only loading flag, refresh()) but
 * targets GET /api/user/{wallet}/active-chats — only Devs the wallet
 * has non-expired persisted messages with.
 *
 * Returns:
 *   - activeChats: Array — empty until first response
 *   - loading:     true on first fetch only (subsequent polls don't
 *                  flash the skeleton)
 *   - error:       Error | null (last fetch error)
 *   - refresh:     () => void  manual refetch — Phase 3.5.2's
 *                  ChatConversation calls this after every successful
 *                  send so the list preview / time / quota update
 *                  immediately instead of at the next 60s tick.
 *
 * Cleanup: clearInterval on unmount and on every (wallet, enabled)
 * change. Stale-token check inside the fetch drops responses that
 * arrive after we've moved on (wallet flip, modal close), so React
 * 19 StrictMode's double-effect doesn't produce stale data or
 * "set state on unmounted component" warnings.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const POLL_INTERVAL_MS = 60_000;

export function useActiveChats(walletAddress, { enabled = true } = {}) {
  const [activeChats, setActiveChats] = useState([]);
  // Initial state is TRUE because the hook fires its first fetch
  // synchronously on mount. Initialising as false would let the
  // first render observe `loading=false && activeChats=[]`, which
  // any consumer guarding on `loading` would interpret as "fetch
  // completed with no results" — exactly the failure mode that
  // caused the spurious NewChatPicker open at modal-mount in
  // Phase 3.5.2 (fixed in 3.5.2.2 for the in-flight branch and
  // here in 3.5.2.3 for the pre-flight branch).
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
  console.log('[Hook useActiveChats] render', {
    walletAddress,
    enabled,
    currentLoading: loading,
    currentLength: activeChats.length,
  });

  // Bumped on every (wallet, enabled) change. In-flight fetches
  // compare against the captured value at request time and bail if
  // the ref no longer matches.
  const fetchTokenRef = useRef(0);
  // First fetch flips loading=true so the UI can render a skeleton;
  // subsequent polls keep loading=false so the list doesn't flash a
  // skeleton every minute.
  const firstFetchDoneRef = useRef(false);

  const doFetch = useCallback(
    async (myToken) => {
      if (!walletAddress) return;
      // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
      console.log('[Hook useActiveChats] doFetch START', {
        walletAddress,
        myToken,
      });
      try {
        const res = await api.getActiveChats(walletAddress);
        if (myToken !== fetchTokenRef.current) {
          // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
          console.log('[Hook useActiveChats] doFetch STALE — dropping result', {
            walletAddress,
            myToken,
            currentToken: fetchTokenRef.current,
          });
          return; // stale
        }
        // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
        console.log('[Hook useActiveChats] doFetch SUCCESS', {
          walletAddress,
          myToken,
          activeChatsLength: res?.active_chats?.length || 0,
          stale: false,
        });
        // Backend returns snake_case `active_chats`; expose as
        // camelCase to match JS convention without forcing every
        // consumer to know the wire shape.
        setActiveChats(Array.isArray(res?.active_chats) ? res.active_chats : []);
        setError(null);
      } catch (e) {
        if (myToken !== fetchTokenRef.current) return;
        // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
        console.log('[Hook useActiveChats] doFetch ERROR', {
          walletAddress,
          myToken,
          errorMessage: e?.message,
        });
        setError(e);
      } finally {
        if (myToken === fetchTokenRef.current) {
          // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
          console.log('[Hook useActiveChats] doFetch FINALLY, setting loading=false', {
            walletAddress,
            myToken,
            stale: false,
          });
          firstFetchDoneRef.current = true;
          setLoading(false);
        } else {
          // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
          console.log('[Hook useActiveChats] doFetch FINALLY (stale, not flipping loading)', {
            walletAddress,
            myToken,
            currentToken: fetchTokenRef.current,
          });
        }
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
    firstFetchDoneRef.current = false;

    // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
    console.log('[Hook useActiveChats] effect run', {
      walletAddress,
      enabled,
      fetchToken: fetchTokenRef.current,
    });

    if (!enabled) {
      // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
      console.log('[Hook useActiveChats] DISABLED branch — clearing state');
      // Explicitly disabled by consumer (modal closed) — settle to a
      // clean idle state so a subsequent re-enable starts fresh.
      setLoading(false);
      setActiveChats([]);
      setError(null);
      return undefined;
    }
    if (!walletAddress) {
      // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
      console.log('[Hook useActiveChats] WAITING FOR WALLET — keeping loading=true');
      // Waiting for the wallet to resolve (wagmi hasn't returned an
      // address yet on cold load). Keep `loading=true` so the
      // ChatModal auto-select effect doesn't mis-interpret the
      // pre-fetch render as "fetch completed empty" and pop the
      // NewChatPicker (the bug Phase 3.5.2.4 diagnostics confirmed).
      // Don't reset activeChats either — a brief wallet=undefined
      // during a reconnect would otherwise wipe a populated list.
      setError(null);
      return undefined;
    }

    // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
    console.log('[Hook useActiveChats] STARTING fetch, setLoading(true)', {
      walletAddress,
      myToken,
    });
    setLoading(true);
    doFetch(myToken);

    const interval = setInterval(() => doFetch(myToken), POLL_INTERVAL_MS);
    return () => {
      // [PHASE 3.5.2.6 DIAGNOSTIC] remove in 3.5.2.7
      console.log('[Hook useActiveChats] cleanup — clearing interval', {
        walletAddress,
        myToken,
      });
      clearInterval(interval);
    };
  }, [walletAddress, enabled, doFetch]);

  return { activeChats, loading, error, refresh };
}
