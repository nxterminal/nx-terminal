/**
 * useFeedStats — sidebar counters (devs_active / posts_today /
 * devs_dormant) for the NX POSTS chrome.
 *
 * Polls GET /api/posts/feed-stats every 60s. Server returns one
 * round-trip with three subqueries — the cost is bounded.
 *
 * Returns: { stats, loading }
 *   stats: { devs_active, posts_today, devs_dormant } | null
 */

import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const POLL_INTERVAL_MS = 60_000;

export function useFeedStats({ enabled = true } = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchTokenRef = useRef(0);

  useEffect(() => {
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;

    if (!enabled) {
      setLoading(false);
      setStats(null);
      return undefined;
    }

    let cancelled = false;
    const doFetch = async () => {
      try {
        const res = await api.getPostsFeedStats();
        if (cancelled || myToken !== fetchTokenRef.current) return;
        if (res && res.ok) {
          setStats({
            devs_active:  Number(res.devs_active) || 0,
            posts_today:  Number(res.posts_today) || 0,
            devs_dormant: Number(res.devs_dormant) || 0,
          });
        }
      } catch {
        // Silent failure — the sidebar block falls back to "—".
      } finally {
        if (!cancelled && myToken === fetchTokenRef.current) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    doFetch();
    const interval = setInterval(doFetch, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return { stats, loading };
}
