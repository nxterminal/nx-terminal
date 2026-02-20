import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  const connectWallet = () => {
    connect({ connector: injected() });
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const wrongChain = isConnected && chain?.id !== 4326;

  return {
    address,
    shortAddress,
    isConnected,
    isConnecting,
    wrongChain,
    balance: balance?.formatted ? `${parseFloat(balance.formatted).toFixed(4)} ETH` : '0 ETH',
    connectWallet,
    disconnect,
  };
}
