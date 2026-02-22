import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

// MegaETH Mainnet — not in viem's default chains
export const megaeth = {
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'MegaETH Explorer', url: 'https://megaexplorer.xyz' },
  },
};

export const wagmiConfig = createConfig({
  chains: [megaeth],
  connectors: [injected()],
  transports: {
    [megaeth.id]: http('https://mainnet.megaeth.com/rpc'),
  },
});
