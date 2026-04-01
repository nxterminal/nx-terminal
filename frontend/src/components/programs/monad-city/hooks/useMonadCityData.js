import { useMegaETHRPC } from '../../netwatch/hooks/useMegaETHRPC';

export function useMonadCityData() {
  const rpc = useMegaETHRPC();

  // Testnet — no real market price; all price fields zeroed
  const price = {
    usd: 0, change: 0, mcap: 0, vol: 0,
    fdv: null, circulating: null, total: null, ath: null, athChange: null, rank: null,
  };

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
