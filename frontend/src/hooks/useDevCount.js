import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { useWallet } from './useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, MEGAETH_CHAIN_ID, MEGAETH_RPC } from '../services/contract';
import { getTier, getNextTier } from '../config/tiers';

export function useDevCount() {
  const { address, isConnected } = useWallet();

  // Primary: wagmi balanceOf
  const { data: balanceData, isLoading: wagmiLoading } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: MEGAETH_CHAIN_ID,
    query: { enabled: !!address, staleTime: 60_000 },
  });

  // Fallback: direct RPC if wagmi fails
  const [rpcCount, setRpcCount] = useState(null);
  useEffect(() => {
    if (!address || balanceData != null) return;
    if (wagmiLoading) return;
    let cancelled = false;

    const tryRpc = async () => {
      // balanceOf(address) selector = 0x70a08231
      const paddedAddr = address.slice(2).toLowerCase().padStart(64, '0');
      const data = '0x70a08231' + paddedAddr;
      try {
        const res = await fetch(MEGAETH_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: NXDEVNFT_ADDRESS, data }, 'latest'] }),
        });
        const json = await res.json();
        if (json.result && !cancelled) {
          setRpcCount(parseInt(json.result, 16));
        }
      } catch { /* silent */ }
    };

    const timer = setTimeout(tryRpc, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [address, balanceData, wagmiLoading]);

  const devCount = balanceData != null ? Number(balanceData) : (rpcCount ?? 0);
  const isLoading = wagmiLoading && rpcCount === null;

  return {
    devCount: isConnected ? devCount : 0,
    isLoading,
    tier: getTier(isConnected ? devCount : 0),
    nextTier: getNextTier(isConnected ? devCount : 0),
  };
}
