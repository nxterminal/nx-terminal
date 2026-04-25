import { useState, useEffect } from 'react';
import { useReadContract, usePublicClient } from 'wagmi';
import { useWallet } from './useWallet';
import { NXDEVNFT_ADDRESS, NXDEVNFT_ABI, MEGAETH_CHAIN_ID, MEGAETH_RPC } from '../services/contract';
import { getTier, getNextTier } from '../config/tiers';

export function useDevCount() {
  const { address, isConnected } = useWallet();
  const publicClient = usePublicClient({ chainId: MEGAETH_CHAIN_ID });

  // Primary: wagmi balanceOf
  const { data: balanceData, isLoading: wagmiLoading, isError: wagmiError } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: MEGAETH_CHAIN_ID,
    query: { enabled: !!address, staleTime: 60_000 },
  });

  // Fallback chain: wagmi publicClient first (gets viem's retry/timeout
  // layer for free), direct RPC fetch as the genuine different-transport
  // fallback when wagmi's transport is unhappy. Same pattern as DevsContext.
  const [rpcCount, setRpcCount] = useState(null);
  const [rpcFailed, setRpcFailed] = useState(false);
  useEffect(() => {
    if (!address || balanceData != null) return;
    if (wagmiLoading) return;
    let cancelled = false;

    const tryRpc = async () => {
      // Each provider returns Number (the parsed balanceOf result) or throws.
      const providers = [];
      if (publicClient) {
        providers.push(async () => {
          const balance = await publicClient.readContract({
            address: NXDEVNFT_ADDRESS,
            abi: NXDEVNFT_ABI,
            functionName: 'balanceOf',
            args: [address],
          });
          return Number(balance);
        });
      }
      providers.push(async () => {
        // balanceOf(address) selector = 0x70a08231
        const paddedAddr = address.slice(2).toLowerCase().padStart(64, '0');
        const data = '0x70a08231' + paddedAddr;
        const res = await fetch(MEGAETH_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: NXDEVNFT_ADDRESS, data }, 'latest'] }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        if (!json.result || json.result === '0x') throw new Error('Empty result');
        return parseInt(json.result, 16);
      });

      for (const call of providers) {
        if (cancelled) return;
        try {
          const count = await call();
          if (typeof count !== 'number' || Number.isNaN(count)) continue;
          if (!cancelled) {
            setRpcCount(count);
            return;
          }
        } catch { /* try next */ }
      }
      // All providers failed
      if (!cancelled) setRpcFailed(true);
    };

    const timer = setTimeout(tryRpc, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [address, balanceData, wagmiLoading, publicClient]);

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

  // Loading until at least one data source returns or fails (prevents flash of "0 devs")
  const isLoading = isConnected && (wagmiLoading || (balanceData == null && rpcCount === null && !rpcFailed));
  const effectiveCount = isConnected ? devCount : 0;

  return {
    devCount: effectiveCount,
    isLoading,
    tier: getTier(effectiveCount),
    nextTier: getNextTier(effectiveCount),
  };
}
