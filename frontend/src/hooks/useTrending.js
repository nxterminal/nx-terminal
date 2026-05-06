/**
 * useTrending — top hashtags over the last 7 days.
 *
 * Polls GET /api/posts/trending every 5 minutes. The endpoint
 * aggregates over a rolling 7-day window so the response changes
 * slowly; a 5-minute cadence is plenty.
 *
 * Returns: { trending, loading }
 *   trending: [{ tag, post_count }, ...] (max 10, DESC by count)
 */

import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useTrending({ enabled = true } = {}) {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchTokenRef = useRef(0);

  useEffect(() => {
    fetchTokenRef.current += 1;
    const myToken = fetchTokenRef.current;

    if (!enabled) {
      setLoading(false);
      setTrending([]);
      return undefined;
    }

    let cancelled = false;
    const doFetch = async () => {
      try {
        const res = await api.getPostsTrending();
        if (cancelled || myToken !== fetchTokenRef.current) return;
        setTrending(Array.isArray(res?.trending) ? res.trending : []);
      } catch {
        // Trending failure is silent — the sidebar block degrades
        // to "no trending yet" rather than blowing up the program.
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

  return { trending, loading };
}
