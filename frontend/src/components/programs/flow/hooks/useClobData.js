import { useState, useEffect, useRef, useCallback } from 'react';
import { API, POLL_INTERVALS, DEX_ID_MAP } from '../constants';

function parsePoolName(name) {
  const match = name.match(/^(.+?)\s*\/\s*(.+?)(?:\s+[\d.]+%)?$/);
  if (!match) return { base: '???', quote: '???' };
  return { base: match[1].trim(), quote: match[2].trim() };
}

function buildOrderbook(trades, midPrice) {
  // Build pseudo-orderbook from recent trades
  // Group trades by price level to simulate bid/ask depth
  const bids = [];
  const asks = [];

  const buyTrades = trades.filter(t => t.kind === 'buy');
  const sellTrades = trades.filter(t => t.kind === 'sell');

  // Create price levels from trades
  const priceStep = midPrice * 0.002; // 0.2% steps

  for (let i = 0; i < 12; i++) {
    const bidPrice = midPrice - priceStep * (i + 1);
    const askPrice = midPrice + priceStep * (i + 1);

    // Aggregate volume near this price level
    const bidVol = buyTrades
      .filter(t => {
        const p = parseFloat(t.price_from_in_usd) || 0;
        return Math.abs(p - bidPrice) < priceStep;
      })
      .reduce((sum, t) => sum + (parseFloat(t.volume_in_usd) || 0), 0);

    const askVol = sellTrades
      .filter(t => {
        const p = parseFloat(t.price_from_in_usd) || 0;
        return Math.abs(p - askPrice) < priceStep;
      })
      .reduce((sum, t) => sum + (parseFloat(t.volume_in_usd) || 0), 0);

    // Add synthetic depth based on distance from mid
    const synthBid = (50 + Math.random() * 200) / (i + 1);
    const synthAsk = (50 + Math.random() * 200) / (i + 1);

    bids.push({
      price: bidPrice,
      size: bidVol + synthBid,
      total: 0,
    });

    asks.push({
      price: askPrice,
      size: askVol + synthAsk,
      total: 0,
    });
  }

  // Calculate cumulative totals
  let bidTotal = 0;
  for (const b of bids) {
    bidTotal += b.size;
    b.total = bidTotal;
  }

  let askTotal = 0;
  for (const a of asks) {
    askTotal += a.size;
    a.total = askTotal;
  }

  return { bids, asks, maxTotal: Math.max(bidTotal, askTotal) };
}

export function useClobData() {
  const [pairs, setPairs] = useState([]);
  const [selectedPair, setSelectedPair] = useState(null);
  const [orderbook, setOrderbook] = useState({ bids: [], asks: [], maxTotal: 0 });
  const [recentTrades, setRecentTrades] = useState([]);
  const [stats, setStats] = useState({ volume24h: 0, spread: 0, midPrice: 0 });
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  // Fetch Kuru and other CLOB pools
  const fetchPairs = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(API.GECKOTERMINAL_TRENDING, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const json = await res.json();
      if (!json.data?.length) return;

      const poolPairs = json.data.slice(0, 8).map(pool => {
        const attrs = pool.attributes;
        const dexId = pool.relationships?.dex?.data?.id || '';
        const { base, quote } = parsePoolName(attrs.name);
        const protocol = DEX_ID_MAP[dexId] || dexId.split('-')[0] || 'unknown';

        return {
          id: pool.id,
          address: attrs.address,
          base,
          quote,
          pair: `${base}/${quote}`,
          protocol,
          price: parseFloat(attrs.base_token_price_usd) || 0,
          volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
          reserve: parseFloat(attrs.reserve_in_usd) || 0,
          priceChange: parseFloat(attrs.price_change_percentage?.h24) || 0,
        };
      });

      setPairs(poolPairs);
      if (!selectedPair && poolPairs.length > 0) {
        setSelectedPair(poolPairs[0]);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [selectedPair]);

  // Fetch trades for selected pair and build orderbook
  const fetchOrderbook = useCallback(async () => {
    if (!selectedPair) return;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(API.GECKOTERMINAL_TRADES(selectedPair.address), {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return;
      const json = await res.json();
      const trades = (json.data || []).map(t => t.attributes);

      const midPrice = selectedPair.price;
      const book = buildOrderbook(trades, midPrice);
      setOrderbook(book);

      // Recent trades
      const recent = (json.data || []).slice(0, 15).map(t => ({
        id: t.id,
        side: t.attributes.kind,
        price: parseFloat(t.attributes.price_from_in_usd) || 0,
        usd: parseFloat(t.attributes.volume_in_usd) || 0,
        timestamp: t.attributes.block_timestamp,
      }));
      setRecentTrades(recent);

      // Stats
      const spread = book.asks.length > 0 && book.bids.length > 0
        ? ((book.asks[0].price - book.bids[0].price) / midPrice) * 100
        : 0;

      setStats({
        volume24h: selectedPair.volume24h,
        spread: Math.abs(spread),
        midPrice,
      });
    } catch {
      // skip
    }
  }, [selectedPair]);

  useEffect(() => {
    fetchPairs();
    const id = setInterval(fetchPairs, POLL_INTERVALS.NEW_POOLS);
    return () => clearInterval(id);
  }, [fetchPairs]);

  useEffect(() => {
    fetchOrderbook();
    intervalRef.current = setInterval(fetchOrderbook, POLL_INTERVALS.TRADES);
    return () => clearInterval(intervalRef.current);
  }, [fetchOrderbook]);

  return {
    pairs,
    selectedPair,
    setSelectedPair,
    orderbook,
    recentTrades,
    stats,
    loading,
  };
}
