import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { MEGAETH_CHAIN_ID } from '../services/contract';

export function useWallet() {
  const { address, isConnected, chain, isConnecting, isReconnecting } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const isWrongChain = isConnected && chain?.id !== MEGAETH_CHAIN_ID;

  const connectWallet = () => {
    connect({ connector: injected() });
  };

  const switchToMegaETH = async () => {
    // Try wagmi switchChain first
    try {
      await switchChainAsync({ chainId: MEGAETH_CHAIN_ID });
    } catch {
      // Fallback: use window.ethereum directly to add+switch
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
                rpcUrls: ['https://carrot.megaeth.com/rpc'],
                blockExplorerUrls: ['https://mega.etherscan.io'],
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
    switchToMegaETH,
    // Backwards compat alias
    switchToMonad: switchToMegaETH,
    formatAddress,
    displayAddress: address ? formatAddress(address) : null,
  };
}
