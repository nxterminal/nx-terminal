import { useState, useEffect, useRef, useCallback } from 'react';
import { API, POLL_INTERVALS, DEX_ID_MAP } from '../constants';

const MAX_TRADES = 150;
const WHALE_THRESHOLD = 1000; // $1000+ = whale

function parsePoolName(name) {
  // "AUSD / WMON 0.05%" → { base: "AUSD", quote: "WMON" }
  const match = name.match(/^(.+?)\s*\/\s*(.+?)(?:\s+[\d.]+%)?$/);
  if (!match) return { base: '???', quote: '???' };
  return { base: match[1].trim(), quote: match[2].trim() };
}

function parseTrade(raw, poolMeta) {
  const a = raw.attributes;
  const usd = parseFloat(a.volume_in_usd) || 0;
  return {
    id: raw.id,
    side: a.kind, // 'buy' or 'sell'
    pair: poolMeta.pair,
    base: poolMeta.base,
    quote: poolMeta.quote,
    protocol: poolMeta.protocol,
    usd,
    isWhale: usd >= WHALE_THRESHOLD,
    txHash: a.tx_hash,
    from: a.tx_from_address,
    block: a.block_number,
    timestamp: a.block_timestamp,
    poolAddress: poolMeta.address,
  };
}

export function useStreamData(isPaused) {
  const [trades, setTrades] = useState([]);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tradeCount, setTradeCount] = useState(0);

  const poolsRef = useRef([]);
  const seenIds = useRef(new Set());
  const poolIndexRef = useRef(0);
  const intervalsRef = useRef({ pools: null, trades: null });

  // 1) Fetch trending pools to know which pools to watch
  const fetchPools = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(API.GECKOTERMINAL_TRENDING, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return;
      const json = await res.json();
      if (!json.data?.length) return;

      const parsed = json.data.slice(0, 10).map(pool => {
        const attrs = pool.attributes;
        const dexId = pool.relationships?.dex?.data?.id || '';
        const { base, quote } = parsePoolName(attrs.name);

        return {
          address: attrs.address,
          name: attrs.name,
          pair: `${base}/${quote}`,
          base,
          quote,
          protocol: DEX_ID_MAP[dexId] || dexId.split('-')[0] || 'unknown',
          volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
        };
      });

      poolsRef.current = parsed;
      setPools(parsed);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  // 2) Fetch trades from pools in round-robin fashion
  const fetchTrades = useCallback(async () => {
    if (isPaused) return;
    const poolList = poolsRef.current;
    if (!poolList.length) return;

    // Round-robin: fetch from 2 pools per cycle to spread API calls
    const fetches = [];
    for (let i = 0; i < 2; i++) {
      const idx = poolIndexRef.current % poolList.length;
      poolIndexRef.current++;
      fetches.push(poolList[idx]);
    }

    for (const poolMeta of fetches) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(API.GECKOTERMINAL_TRADES(poolMeta.address), {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) continue;
        const json = await res.json();
        if (!json.data?.length) continue;

        const newTrades = [];
        for (const raw of json.data) {
          if (seenIds.current.has(raw.id)) continue;
          seenIds.current.add(raw.id);
          newTrades.push(parseTrade(raw, poolMeta));
        }

        if (newTrades.length > 0) {
          setTrades(prev => {
            const merged = [...newTrades, ...prev];
            return merged.slice(0, MAX_TRADES);
          });
          setTradeCount(prev => prev + newTrades.length);
        }
      } catch {
        // network error, skip
      }
    }

    // Cap seen IDs to prevent memory growth
    if (seenIds.current.size > 5000) {
      const arr = [...seenIds.current];
      seenIds.current = new Set(arr.slice(-2000));
    }
  }, [isPaused]);

  // Init: fetch pools, then start trade polling
  useEffect(() => {
    fetchPools();
    intervalsRef.current.pools = setInterval(fetchPools, POLL_INTERVALS.NEW_POOLS);
    return () => clearInterval(intervalsRef.current.pools);
  }, [fetchPools]);

  useEffect(() => {
    fetchTrades();
    intervalsRef.current.trades = setInterval(fetchTrades, POLL_INTERVALS.TRADES);
    return () => clearInterval(intervalsRef.current.trades);
  }, [fetchTrades]);

  return { trades, pools, loading, tradeCount };
}
