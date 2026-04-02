import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { useWallet } from './useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, MEGAETH_CHAIN_ID, MEGAETH_RPC } from '../services/contract';
import { getTier, getNextTier } from '../config/tiers';

export function useDevCount() {
  const { address, isConnected } = useWallet();

  // Primary: wagmi balanceOf
  const { data: balanceData, isLoading: wagmiLoading, isError: wagmiError } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: MEGAETH_CHAIN_ID,
    query: { enabled: !!address, staleTime: 60_000 },
  });

  // Fallback: direct RPC if wagmi fails (same pattern as MyDevs.jsx)
  const [rpcCount, setRpcCount] = useState(null);
  const [rpcFailed, setRpcFailed] = useState(false);
  useEffect(() => {
    if (!address || balanceData != null) return;
    if (wagmiLoading) return;
    let cancelled = false;

    const tryRpc = async () => {
      // balanceOf(address) selector = 0x70a08231
      const paddedAddr = address.slice(2).toLowerCase().padStart(64, '0');
      const data = '0x70a08231' + paddedAddr;

      // Try wallet provider first, then direct RPC
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
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: NXDEVNFT_ADDRESS, data }, 'latest'] }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        return json.result;
      });

      for (const call of providers) {
        if (cancelled) return;
        try {
          const result = await call();
          if (result && !cancelled) {
            setRpcCount(parseInt(result, 16));
            return;
          }
        } catch { /* try next */ }
      }
      // All providers failed
      if (!cancelled) setRpcFailed(true);
    };

    const timer = setTimeout(tryRpc, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [address, balanceData, wagmiLoading]);

  // Never block users due to technical errors: if all RPC calls fail, assume 999 devs
  let devCount;
  if (balanceData != null) {
    devCount = Number(balanceData);
  } else if (rpcCount != null) {
    devCount = rpcCount;
  } else if (wagmiError && rpcFailed) {
    devCount = 999; // fail-open: never lock programs due to RPC errors
  } else {
    devCount = 0;
  }

  const isLoading = wagmiLoading && rpcCount === null && !rpcFailed;
  const effectiveCount = isConnected ? devCount : 0;

  return {
    devCount: effectiveCount,
    isLoading,
    tier: getTier(effectiveCount),
    nextTier: getNextTier(effectiveCount),
  };
}
