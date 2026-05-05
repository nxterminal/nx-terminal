/**
 * useChatHistory(walletAddress, tokenId, { enabled }) — load the
 * persisted message history for one (wallet, Dev) chat.
 *
 * Phase 3.5.3 implementation. The Phase 3.5.2 stub returned an empty
 * shape so consumers could pre-import the hook without a circular
 * dependency; this PR wires the real fetch.
 *
 * Returns:
 *   - messages: Array<{ id, role, content, is_climax, is_resting,
 *                       provider_used, created_at, expires_at }>
 *   - loading:  true on first fetch only (subsequent refreshes
 *               keep the cached array visible — no skeleton flash)
 *   - error:    Error | null
 *   - refresh:  () => void  manual refetch under the current token
 *
 * NO polling: history is loaded ONCE per conversation open. New
 * messages sent during the session are appended to local state in
 * <ChatConversation>; they don't need to round-trip through this
 * hook. The user can call refresh() if they want to pull fresh
 * history (e.g. after a reconnect that may have surfaced replies
 * from elsewhere — out of scope for Phase A but the hook supports it).
 *
 * Cleanup: the hook bumps fetchTokenRef on every (wallet, tokenId,
 * enabled) change so an in-flight fetch that resolves AFTER the
 * caller switched conversations is dropped silently. Same
 * stale-token pattern as useActiveChats / useConversations.
 *
 * Initial loading state TRUE — same lesson as Phase 3.5.2.3: a
 * `loading=false && messages=[]` first render would flash an
 * incorrect "no history" empty state under the conversation
 * before the first response lands.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export function useChatHistory(walletAddress, tokenId, { enabled = true } = {}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bumped on every (wallet, tokenId, enabled) change. In-flight
  // fetches compare against the captured value at request time and
  // bail if the ref no longer matches.
  const fetchTokenRef = useRef(0);

  const doFetch = useCallback(
    async (myToken) => {
      if (!walletAddress || !tokenId) return;
      try {
        const res = await api.getMessages(walletAddress, tokenId);
        if (myToken !== fetchTokenRef.current) return; // stale
        setMessages(Array.isArray(res?.messages) ? res.messages : []);
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
    [walletAddress, tokenId]
  );

  const refresh = useCallback(() => {
    doFetch(fetchTokenRef.current);
  }, [doFetch]);

  useEffect(() => {
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;

    if (!enabled) {
      // Consumer-disabled — settle to clean idle. Caller is
      // responsible for re-enabling when ready.
      setLoading(false);
      setMessages([]);
      setError(null);
      return undefined;
    }
    if (!walletAddress || !tokenId) {
      // Waiting for full identification (wallet flicker during
      // reconnect, or no Dev selected yet). Keep loading=true so
      // the conversation pane shows the skeleton instead of the
      // "no history" empty state. Don't reset messages either —
      // a brief identity flicker shouldn't wipe the visible chat.
      setError(null);
      return undefined;
    }

    setLoading(true);
    doFetch(myToken);
    // No interval — history is loaded once per (wallet, tokenId)
    // pair. ChatConversation handles new messages via local state.
    return undefined;
  }, [walletAddress, tokenId, enabled, doFetch]);

  return { messages, loading, error, refresh };
}
