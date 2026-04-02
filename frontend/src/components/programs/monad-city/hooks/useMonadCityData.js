import { useState, useEffect } from 'react';
import { useMegaETHRPC } from '../../netwatch/hooks/useMegaETHRPC';

export function useMonadCityData() {
  const rpc = useMegaETHRPC();

  // Fetch real ETH/USD price from CoinGecko every 60s
  const [price, setPrice] = useState({
    usd: null, change: null, mcap: null, vol: null,
    fdv: null, circulating: null, total: null, ath: null, athChange: null, rank: null,
  });

  useEffect(() => {
    let cancelled = false;
    const fetchPrice = () => {
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true')
        .then(r => r.json())
        .then(data => {
          if (cancelled || !data.ethereum) return;
          setPrice(prev => ({
            ...prev,
            usd: data.ethereum.usd,
            change: data.ethereum.usd_24h_change || 0,
          }));
        })
        .catch(() => {}); // keep previous value on error
    };
    fetchPrice();
    const id = setInterval(fetchPrice, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

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
