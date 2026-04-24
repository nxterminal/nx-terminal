import { useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { writeContract as wagmiWriteContract } from 'wagmi/actions';
import { injected } from 'wagmi/connectors';
import { wagmiConfig } from '../services/wagmi';
import { MEGAETH_CHAIN_ID } from '../services/contract';
import { useMegaName } from './useMegaName';
import { useWalletProviderContext } from '../contexts/WalletProviderContext';

// useWalletWagmi — wagmi / MetaMask implementation of the wallet interface.
//
// Mirrors the shape returned by useWalletMoss so useWallet() can dispatch
// between them transparently. Consumers read from this via useWallet() only —
// no component should import this hook directly.

export function useWalletWagmi() {
  const { address, isConnected, chain, isConnecting, isReconnecting } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { setActiveProvider } = useWalletProviderContext();
  const megaName = useMegaName(address);

  const isWrongChain = isConnected && chain?.id !== MEGAETH_CHAIN_ID;

  const connectWallet = () => {
    connect({ connector: injected() });
  };

  const disconnect = () => {
    wagmiDisconnect();
    setActiveProvider(null);
  };

  const switchToMegaETH = async () => {
    try {
      await switchChainAsync({ chainId: MEGAETH_CHAIN_ID });
    } catch {
      if (window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x10E6' }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x10E6',
                chainName: 'MegaETH',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.megaeth.com/rpc'],
                blockExplorerUrls: ['https://mega.etherscan.io'],
              }],
            });
          }
        }
      }
    }
  };

  // writeContract — provider-agnostic contract write. Mirrors the signature
  // used by MOSS's callContract so useWallet() can dispatch without the
  // caller caring which SDK is underneath.
  //
  // Params:
  //   address:       contract address (0x...)
  //   abi:           ABI array (or subset)
  //   functionName:  name of the function to call
  //   args:          args array
  //   value:         optional, for payable functions (bigint, or string that
  //                  parses to bigint)
  //
  // Returns: transaction hash (string). Throws on failure. User rejection
  // throws with a detectable shape — callsites use isUserRejection() from
  // walletErrors.js to distinguish cancel-from-error.
  const writeContract = useCallback(async ({ address: target, abi, functionName, args, value }) => {
    const params = {
      address: target,
      abi,
      functionName,
      args,
    };
    // wagmi wants `value` as bigint. Accept either bigint or string for
    // symmetry with MOSS's interface.
    if (value !== undefined && value !== null) {
      params.value = typeof value === 'bigint' ? value : BigInt(value);
    }
    const hash = await wagmiWriteContract(wagmiConfig, params);
    return hash;
  }, []);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isReconnecting,
    chain,
    isWrongChain,
    connectError,
    connect: connectWallet,
    disconnect,
    switchToMegaETH,
    switchToMonad: switchToMegaETH,
    writeContract,
    formatAddress,
    displayAddress: address ? (megaName || formatAddress(address)) : null,
    megaName,
    providerId: 'wagmi',
  };
}
