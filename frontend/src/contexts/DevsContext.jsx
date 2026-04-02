/**
 * DevsContext — Global cache for the player's dev NFT data.
 *
 * Persists across window open/close cycles so MyDevs, NxtWallet, etc.
 * don't refetch every time. Refetches automatically after 5 minutes
 * or manually via refreshDevs().
 */
import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { useWallet } from '../hooks/useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, MEGAETH_CHAIN_ID, MEGAETH_RPC } from '../services/contract';
import { api } from '../services/api';

const STALE_TIME = 300_000; // 5 minutes

const DevsContext = createContext(null);

export function useDevs() {
  const ctx = useContext(DevsContext);
  if (!ctx) throw new Error('useDevs must be used inside DevsProvider');
  return ctx;
}

export function DevsProvider({ children }) {
  const { address, isConnected } = useWallet();
  const [devs, setDevs] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const initialLoadDone = useRef(false);
  const lastFetched = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Primary: wagmi tokensOfOwner ──
  const { data: ownedTokens, isLoading: tokensLoading } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    chainId: MEGAETH_CHAIN_ID,
    query: { enabled: !!address, staleTime: STALE_TIME },
  });

  // ── Fallback: direct RPC if wagmi fails ──
  const [rpcTokens, setRpcTokens] = useState(null);
  useEffect(() => {
    if (!address || ownedTokens != null) return;
    if (tokensLoading) return;
    let cancelled = false;

    const tryRpc = async () => {
      const paddedAddr = address.slice(2).toLowerCase().padStart(64, '0');
      const data = '0x8462151c' + paddedAddr;

      const providers = [];
      if (window.ethereum) {
        providers.push(async () => {
          return await window.ethereum.request({
            method: 'eth_call',
            params: [{ to: NXDEVNFT_ADDRESS, data }, 'latest'],
          });
        });
      }
      providers.push(async () => {
        const res = await fetch(MEGAETH_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'eth_call', params: [{ to: NXDEVNFT_ADDRESS, data }, 'latest'] }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        return json.result;
      });

      for (const call of providers) {
        if (cancelled) return;
        try {
          const result = await call();
          if (!result || result === '0x') continue;
          const hex = result.slice(2);
          if (hex.length < 128) continue;
          const length = parseInt(hex.slice(64, 128), 16);
          const ids = [];
          for (let i = 0; i < length; i++) {
            ids.push(parseInt(hex.slice(128 + i * 64, 128 + (i + 1) * 64), 16));
          }
          if (!cancelled) setRpcTokens(ids.map(BigInt));
          return;
        } catch { /* try next */ }
      }
    };

    const timer = setTimeout(tryRpc, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [address, ownedTokens, tokensLoading]);

  // ── Memoize token IDs ──
  const tokenKey = useMemo(() => {
    const tokens = ownedTokens ?? rpcTokens;
    return tokens ? tokens.map(String).join(',') : '';
  }, [ownedTokens, rpcTokens]);

  const tokenIds = useMemo(() => {
    if (!tokenKey) return [];
    return tokenKey.split(',').map(Number);
  }, [tokenKey]);

  // ── Fetch dev data from API ──
  useEffect(() => {
    if (tokenIds.length === 0) {
      setDevs([]);
      setFetching(false);
      initialLoadDone.current = true;
      return;
    }

    // Skip if data is fresh (unless manual refresh)
    const now = Date.now();
    if (initialLoadDone.current && refreshKey === 0 && (now - lastFetched.current) < STALE_TIME) {
      return;
    }

    if (!initialLoadDone.current) {
      setFetching(true);
    }
    setFetchError(null);

    const fetchWithRetry = (id) =>
      api.getDev(id, address).catch(() =>
        new Promise(resolve => setTimeout(resolve, 2000))
          .then(() => api.getDev(id, address))
          .catch((err) => {
            console.warn(`[DevsContext] Failed to fetch dev #${id}:`, err.message);
            return {
              token_id: id,
              name: `Dev #${id}`,
              archetype: 'UNKNOWN',
              _fetchFailed: true,
            };
          })
      );

    Promise.all(tokenIds.map(fetchWithRetry))
      .then(results => {
        setDevs(results);
        initialLoadDone.current = true;
        lastFetched.current = Date.now();
      })
      .catch(() => setFetchError('Failed to load developer data'))
      .finally(() => setFetching(false));
  }, [tokenKey, refreshKey, address]);

  // Reset when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setDevs([]);
      initialLoadDone.current = false;
      lastFetched.current = 0;
      setRpcTokens(null);
    }
  }, [isConnected]);

  const refreshDevs = useCallback(() => {
    lastFetched.current = 0;
    setRefreshKey(k => k + 1);
  }, []);

  const updateDev = useCallback((fresh) => {
    setDevs(prev => prev.map(d => d.token_id === fresh.token_id ? fresh : d));
  }, []);

  // loading = true when wallet is connected AND initial load hasn't completed yet
  // This includes: wagmi fetching tokensOfOwner, RPC fallback, and API dev fetches
  const loading = isConnected && !initialLoadDone.current && (tokensLoading || fetching || devs.length === 0);

  const value = useMemo(() => ({
    devs,
    tokenIds,
    loading,
    fetchError,
    refreshDevs,
    updateDev,
    devCount: tokenIds.length,
  }), [devs, tokenIds, loading, fetchError, refreshDevs, updateDev]);

  return (
    <DevsContext.Provider value={value}>
      {children}
    </DevsContext.Provider>
  );
}
