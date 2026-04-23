import { useCallback, useMemo } from 'react';
import {
  useStatus,
  useConnect as useMossConnect,
  useDisconnect as useMossDisconnect,
} from '@megaeth-labs/wallet-sdk-react';
import { MEGAETH_CHAIN_ID } from '../services/contract';
import { useMegaName } from './useMegaName';
import { useWalletProviderContext } from '../contexts/WalletProviderContext';

// useWalletMoss — MegaETH Wallet SDK implementation of the wallet interface.
//
// Mirrors the shape returned by useWalletWagmi so useWallet() can dispatch
// between them transparently. Consumers (Desktop, Mint, FundDev, etc.) never
// know which backend is answering.
//
// Key differences from wagmi:
// - MOSS is MegaETH-native; there is no concept of "wrong chain". The SDK
//   only speaks to MegaETH mainnet. `isWrongChain` is always false and
//   `switchToMegaETH` is a no-op that resolves immediately.
// - The iframe wallet boots lazily — `initialised` from useStatus() is the
//   signal that MOSS is ready. While false, we surface `isConnecting: true`
//   so the UI can show a loading state instead of an awkward in-between.

export function useWalletMoss() {
  const { initialised, status, address } = useStatus();
  const connectMutation = useMossConnect();
  const disconnectMutation = useMossDisconnect();
  const { setActiveProvider } = useWalletProviderContext();

  // Resolve .mega name — same hook, same cache, shared with the wagmi path.
  const megaName = useMegaName(address);

  const isConnected = status === 'connected' && !!address;

  // Expose connect / disconnect as plain functions matching the wagmi
  // interface. useMutation's .mutate() fires and forgets; we don't need
  // the returned promise at this level — UI reads state from useStatus().
  const connect = useCallback(() => {
    connectMutation.mutate();
  }, [connectMutation]);

  // Disconnect: fire MOSS's disconnect AND clear activeProvider so the
  // wallet selector re-appears on the next Connect click. Users stay in
  // full control of which wallet they want each session.
  const disconnect = useCallback(() => {
    disconnectMutation.mutate();
    setActiveProvider(null);
  }, [disconnectMutation, setActiveProvider]);

  // MOSS is MegaETH-only. No-op to keep interface compatible.
  const switchToMegaETH = useCallback(async () => {
    return Promise.resolve();
  }, []);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Synthetic chain object mirroring the shape wagmi returns, so downstream
  // code that reads `chain?.id` or `chain?.name` keeps working unchanged.
  const chain = useMemo(
    () => ({
      id: MEGAETH_CHAIN_ID,
      name: 'MegaETH',
    }),
    []
  );

  return {
    address: address || undefined,
    isConnected,
    // While the iframe is bootstrapping OR the connect mutation is pending,
    // surface as "connecting" so the UI shows a spinner instead of a broken
    // empty state.
    isConnecting: !initialised || connectMutation.isPending,
    chain,
    // MOSS is MegaETH-native. No wrong-chain state is possible.
    isWrongChain: false,
    connectError: connectMutation.error || null,
    connect,
    disconnect,
    switchToMegaETH,
    // Backwards compat alias — mirrors what useWalletWagmi exposes.
    switchToMonad: switchToMegaETH,
    formatAddress,
    displayAddress: address ? (megaName || formatAddress(address)) : null,
    megaName,
    // Provider identifier — lets consumers know which backend is answering.
    providerId: 'moss',
  };
}
