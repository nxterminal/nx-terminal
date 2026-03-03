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

  const switchToPharos = () => {
    switchChain({ chainId: PHAROS_CHAIN_ID });
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
    formatAddress,
    displayAddress: address ? formatAddress(address) : null,
  };
}
