import { useState, useEffect, useRef, useCallback } from 'react';
import { useMonadRPC } from '../../nadwatch/hooks/useMonadRPC';
import { API, POLL_INTERVALS } from '../constants';

export function useMarketData() {
  const {
    blockNumber,
    tps,
    gasPrice,
    isConnected,
    isLoading: rpcLoading,
  } = useMonadRPC();

  const [monPrice, setMonPrice] = useState(null);
  const [monChange24h, setMonChange24h] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);

  const intervalRef = useRef(null);

  const fetchPrice = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(API.COINGECKO_MON_PRICE, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = await res.json();

      if (data.monad) {
        setMonPrice(data.monad.usd);
        setMonChange24h(data.monad.usd_24h_change);
      }
      setPriceLoading(false);
    } catch {
      setPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    intervalRef.current = setInterval(fetchPrice, POLL_INTERVALS.MARKET_DATA);
    return () => clearInterval(intervalRef.current);
  }, [fetchPrice]);

  return {
    blockNumber,
    tps,
    gasPrice,
    isConnected,
    rpcLoading,
    monPrice,
    monChange24h,
    priceLoading,
  };
}
