import { useState, useEffect, useCallback } from 'react';

export function useAPI(apiFn, deps = [], options = {}) {
  const { autoFetch = true, interval = null } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
  }, [fetch, autoFetch]);

  useEffect(() => {
    if (!interval || !autoFetch) return;
    const id = setInterval(fetch, interval);
    return () => clearInterval(id);
  }, [fetch, interval, autoFetch]);

  return { data, loading, error, refetch: fetch };
}
