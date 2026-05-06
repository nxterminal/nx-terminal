/**
 * useWhoToFollow — 3 random Devs the viewer doesn't already own.
 *
 * Fetches once on mount (no polling) — suggestions are static-ish
 * and the user can call `refresh()` if they want a different roll.
 *
 * Returns: { suggestions, loading, refresh }
 *   suggestions: [{ token_id, name, archetype, corp,
 *                   ipfs_image, recent_post_count }, ...]
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export function useWhoToFollow(walletAddress, { enabled = true } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchTokenRef = useRef(0);

  const doFetch = useCallback(async () => {
    if (!walletAddress) return;
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;
    setLoading(true);
    try {
      const res = await api.getPostsWhoToFollow(walletAddress.toLowerCase());
      if (myToken !== fetchTokenRef.current) return;
      setSuggestions(Array.isArray(res?.suggestions) ? res.suggestions : []);
    } catch {
      if (myToken === fetchTokenRef.current) {
        setSuggestions([]);
      }
    } finally {
      if (myToken === fetchTokenRef.current) {
        setLoading(false);
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (!walletAddress) {
      // No wallet yet — empty state, not loading. Differs from
      // usePostsTimeline because the global feed reads anonymously
      // but who-to-follow is per-viewer (excludes self-owned Devs).
      setSuggestions([]);
      setLoading(false);
      return;
    }
    doFetch();
  }, [walletAddress, enabled, doFetch]);

  return { suggestions, loading, refresh: doFetch };
}
