import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { MEGAETH_CHAIN_ID } from '../services/contract';

export function useWallet() {
  const { address, isConnected, chain, isConnecting, isReconnecting } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isWrongChain = isConnected && chain?.id !== MEGAETH_CHAIN_ID;

  const connectWallet = () => {
    connect({ connector: injected() });
  };

  const switchToMegaETH = () => {
    switchChain({ chainId: MEGAETH_CHAIN_ID });
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
    formatAddress,
    displayAddress: address ? formatAddress(address) : null,
  };
}
