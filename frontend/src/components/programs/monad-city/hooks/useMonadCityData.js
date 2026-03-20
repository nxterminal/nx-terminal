import { useState, useEffect, useCallback, useRef } from 'react';
import { usePharosRPC } from '../../netwatch/hooks/usePharosRPC';

export function useMonadCityData() {
  const rpc = usePharosRPC();
  const [price, setPrice] = useState({
    usd: 0.0207, change: -2.82, mcap: 229, vol: 35.5,
    fdv: null, circulating: null, total: null, ath: null, athChange: null, rank: null,
  });
  const fetchRef = useRef(null);

  const fetchPrice = useCallback(async () => {
    try {
      const r = await fetch(
        // TODO: update to Pharos CoinGecko ID when available on mainnet
        'https://api.coingecko.com/api/v3/coins/pharos?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false'
      );
      const d = await r.json();
      if (d.market_data) {
        const md = d.market_data;
        setPrice({
          usd: md.current_price?.usd || 0.0207,
          change: md.price_change_percentage_24h || -2.82,
          mcap: Math.round((md.market_cap?.usd || 229e6) / 1e6),
          vol: Math.round((md.total_volume?.usd || 35.5e6) / 1e6 * 10) / 10,
          fdv: md.fully_diluted_valuation?.usd ? Math.round(md.fully_diluted_valuation.usd / 1e6) : null,
          circulating: md.circulating_supply ? Math.round(md.circulating_supply / 1e6) : null,
          total: md.total_supply ? Math.round(md.total_supply / 1e6) : null,
          ath: md.ath?.usd || null,
          athChange: md.ath_change_percentage?.usd || null,
          rank: d.market_cap_rank || null,
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
