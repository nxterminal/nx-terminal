import { useCallback, useMemo } from 'react';
import {
  useStatus,
  useConnect as useMossConnect,
  useDisconnect as useMossDisconnect,
  useCallContract as useMossCallContract,
} from '@megaeth-labs/wallet-sdk-react';
import { MEGAETH_CHAIN_ID } from '../services/contract';
import { useMegaName } from './useMegaName';
import { useWalletProviderContext } from '../contexts/WalletProviderContext';
import {
  WalletUserRejectedError,
  WalletUnsupportedError,
} from './walletErrors';

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
// - MOSS callContract does NOT throw on user rejection; it resolves with
//   { status: 'cancelled' }. We convert that to a thrown error so callsites
//   see the same "throw on failure" contract as wagmi.

export function useWalletMoss() {
  const { initialised, status, address } = useStatus();
  const connectMutation = useMossConnect();
  const disconnectMutation = useMossDisconnect();
  const callContractMutation = useMossCallContract();
  const { setActiveProvider } = useWalletProviderContext();

  // Resolve .mega name — same hook, same cache, shared with the wagmi path.
  const megaName = useMegaName(address);

  const isConnected = status === 'connected' && !!address;

  const connect = useCallback(() => {
    connectMutation.mutate();
  }, [connectMutation]);

  const disconnect = useCallback(() => {
    disconnectMutation.mutate();
    setActiveProvider(null);
  }, [disconnectMutation, setActiveProvider]);

  // MOSS is MegaETH-only. No-op to keep interface compatible.
  const switchToMegaETH = useCallback(async () => {
    return Promise.resolve();
  }, []);

  // writeContract — provider-agnostic contract write for MOSS. Translates
  // MOSS's TransactionResult shape into the same throw-on-failure contract
  // that wagmi uses, so callsites can share try/catch logic.
  //
  // MOSS response shapes:
  //   { status: 'approved', receipt: { hash } }  → resolve with hash
  //   { status: 'cancelled' }                    → throw WalletUserRejectedError
  //   { status: 'error', error: string }         → throw Error with message
  //
  // Params match useWalletWagmi.writeContract's signature exactly.
  const writeContract = useCallback(
    async ({ address: target, abi, functionName, args, value }) => {
      const request = {
        address: target,
        abi,
        functionName,
        args,
      };
      if (value !== undefined && value !== null) {
        // MOSS accepts bigint or string — normalize to bigint for consistency.
        request.value = typeof value === 'bigint' ? value : BigInt(value);
      }

      let result;
      try {
        result = await callContractMutation.mutateAsync(request);
      } catch (err) {
        // MOSS generally doesn't throw, but a transport-level error (iframe
        // not ready, Penpal comms failure, etc) can still throw. Treat this
        // as an unsupported / broken path so callsites can fall back.
        throw new WalletUnsupportedError(
          err?.message || 'MegaETH Wallet could not complete this action.'
        );
      }

      if (!result || typeof result !== 'object') {
        throw new Error('Unexpected response from MegaETH Wallet.');
      }

      if (result.status === 'approved') {
        const hash = result.receipt?.hash;
        if (!hash) {
          throw new Error('Transaction approved but no hash returned.');
        }
        return hash;
      }

      if (result.status === 'cancelled') {
        throw new WalletUserRejectedError();
      }

      // status === 'error' or anything else
      throw new Error(result.error || 'Transaction failed.');
    },
    [callContractMutation]
  );

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
    isConnecting: !initialised || connectMutation.isPending,
    chain,
    isWrongChain: false,
    connectError: connectMutation.error || null,
    connect,
    disconnect,
    switchToMegaETH,
    switchToMonad: switchToMegaETH,
    writeContract,
    formatAddress,
    displayAddress: address ? (megaName || formatAddress(address)) : null,
    megaName,
    providerId: 'moss',
  };
}
