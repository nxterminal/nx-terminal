import { useState, useEffect, useRef, useCallback } from 'react';
import { API, POLL_INTERVALS, DEX_ID_MAP } from '../constants';

function parsePoolName(name) {
  const match = name.match(/^(.+?)\s*\/\s*(.+?)(?:\s+[\d.]+%)?$/);
  if (!match) return { base: '???', quote: '???' };
  return { base: match[1].trim(), quote: match[2].trim() };
}

function tokenAge(createdAt) {
  if (!createdAt) return { label: 'unknown', hours: Infinity };
  const diff = (Date.now() - new Date(createdAt).getTime()) / 1000;
  if (diff < 3600) return { label: Math.floor(diff / 60) + 'm', hours: diff / 3600 };
  if (diff < 86400) return { label: Math.floor(diff / 3600) + 'h', hours: diff / 3600 };
  return { label: Math.floor(diff / 86400) + 'd', hours: diff / 3600 };
}

function computeScore(pool) {
  let score = 50;

  // Liquidity factor (higher = better, up to +20)
  const reserve = pool.reserveUsd;
  if (reserve > 100000) score += 20;
  else if (reserve > 50000) score += 15;
  else if (reserve > 10000) score += 10;
  else if (reserve > 1000) score += 5;
  else score -= 10;

  // Volume factor (higher = better, up to +15)
  const vol = pool.volume24h;
  if (vol > 100000) score += 15;
  else if (vol > 10000) score += 10;
  else if (vol > 1000) score += 5;
  else score -= 5;

  // Age factor (older = more trustworthy, up to +10)
  const hours = pool.age.hours;
  if (hours > 168) score += 10;  // > 1 week
  else if (hours > 24) score += 5;
  else score -= 10; // very new = risky

  // Price stability (less volatility = better)
  const change24h = Math.abs(pool.priceChange24h);
  if (change24h > 50) score -= 15;
  else if (change24h > 20) score -= 5;
  else score += 5;

  // Volume/liquidity ratio sanity check
  if (reserve > 0 && vol / reserve > 10) score -= 10; // suspicious wash trading

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getWarnings(pool) {
  const warnings = [];
  if (pool.age.hours < 24) warnings.push('NEW');
  if (pool.reserveUsd < 5000) warnings.push('LOW LIQ');
  if (Math.abs(pool.priceChange24h) > 50) warnings.push('VOLATILE');
  if (pool.reserveUsd > 0 && pool.volume24h / pool.reserveUsd > 10) warnings.push('WASH?');
  return warnings;
}

export function useTokenRadar() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('trending'); // 'trending' | 'new'
  const intervalRef = useRef(null);

  const fetchTokens = useCallback(async () => {
    try {
      const url = source === 'new' ? API.GECKOTERMINAL_NEW_POOLS : API.GECKOTERMINAL_TRENDING;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return;
      const json = await res.json();
      if (!json.data?.length) return;

      const parsed = json.data.map(pool => {
        const attrs = pool.attributes;
        const dexId = pool.relationships?.dex?.data?.id || '';
        const { base, quote } = parsePoolName(attrs.name);
        const age = tokenAge(attrs.pool_created_at);
        const reserveUsd = parseFloat(attrs.reserve_in_usd) || 0;
        const volume24h = parseFloat(attrs.volume_usd?.h24) || 0;
        const priceChange24h = parseFloat(attrs.price_change_percentage?.h24) || 0;
        const priceChange1h = parseFloat(attrs.price_change_percentage?.h1) || 0;
        const fdv = parseFloat(attrs.fdv_usd) || 0;
        const baseTokenId = pool.relationships?.base_token?.data?.id || '';
        const tokenAddress = baseTokenId.replace('monad_', '');

        const tokenData = {
          id: pool.id,
          symbol: base,
          quote,
          pair: `${base}/${quote}`,
          protocol: DEX_ID_MAP[dexId] || dexId.split('-')[0] || 'unknown',
          poolAddress: attrs.address,
          tokenAddress,
          age,
          reserveUsd,
          volume24h,
          priceChange24h,
          priceChange1h,
          fdv,
          createdAt: attrs.pool_created_at,
        };

        tokenData.score = computeScore(tokenData);
        tokenData.warnings = getWarnings(tokenData);

        return tokenData;
      });

      // Sort by score descending
      parsed.sort((a, b) => b.score - a.score);
      setTokens(parsed);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    setLoading(true);
    fetchTokens();
    intervalRef.current = setInterval(fetchTokens, POLL_INTERVALS.POOLS);
    return () => clearInterval(intervalRef.current);
  }, [fetchTokens]);

  return { tokens, loading, source, setSource };
}
