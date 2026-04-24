import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { megaWallet } from '@megaeth-labs/wallet-wagmi-connector';

// MegaETH — manual chain definition. viem@2.46.2 does not export this
// chain, and the MOSS connector is pinned to a network at construction
// time so the id/rpc here must match 'mainnet'.
export const megaeth = {
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'MegaEtherscan', url: 'https://mega.etherscan.io' },
  },
};

export const wagmiConfig = createConfig({
  chains: [megaeth],
  connectors: [
    injected(),
    megaWallet({ network: 'mainnet' }),
  ],
  transports: {
    [megaeth.id]: http('https://mainnet.megaeth.com/rpc'),
  },
});
