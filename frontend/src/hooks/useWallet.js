import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { PHAROS_CHAIN_ID } from '../services/contract';

export function useWallet() {
  const { address, isConnected, chain, isConnecting, isReconnecting } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isWrongChain = isConnected && chain?.id !== PHAROS_CHAIN_ID;

  const connectWallet = () => {
    connect({ connector: injected() });
  };

  const switchToPharos = async () => {
    // Try wagmi switchChain first
    try {
      switchChain({ chainId: PHAROS_CHAIN_ID });
    } catch {
      // Fallback: use window.ethereum directly to add+switch
      if (window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xA8331' }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xA8331',
                chainName: 'Pharos Atlantic Testnet',
                nativeCurrency: { name: 'Pharos', symbol: 'PHRS', decimals: 18 },
                rpcUrls: ['https://atlantic.dplabs-internal.com'],
                blockExplorerUrls: ['https://atlantic.pharosscan.xyz'],
              }],
            });
          }
        }
      }
    }
  };

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
    switchToPharos,
    // Backwards compat alias
    switchToMonad: switchToPharos,
    formatAddress,
    displayAddress: address ? formatAddress(address) : null,
  };
}
