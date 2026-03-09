import { useState, useEffect, useCallback, useRef } from 'react';
import { useMonadRPC } from '../../nadwatch/hooks/useMonadRPC';

export function useMonadCityData() {
  const rpc = useMonadRPC();
  const [price, setPrice] = useState({ usd: 0.0207, change: -2.82, mcap: 229, vol: 35.5 });
  const fetchRef = useRef(null);

  const fetchPrice = useCallback(async () => {
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true'
      );
      const d = await r.json();
      if (d.monad) {
        setPrice({
          usd: d.monad.usd || 0.0207,
          change: d.monad.usd_24h_change || -2.82,
          mcap: Math.round((d.monad.usd_market_cap || 229e6) / 1e6),
          vol: Math.round((d.monad.usd_24h_vol || 35.5e6) / 1e6 * 10) / 10,
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchPrice();
    fetchRef.current = setInterval(fetchPrice, 30000);
    return () => clearInterval(fetchRef.current);
  }, [fetchPrice]);

  return {
    price,
    blockNumber: rpc.blockNumber || 59561050,
    tps: rpc.tps || 17,
    gasUsed: rpc.gasUsed || 102,
    gasPrice: rpc.gasPrice || 102,
    isConnected: rpc.isConnected,
    transactions: rpc.transactions || [],
    latestBlock: rpc.latestBlock,
  };
}
