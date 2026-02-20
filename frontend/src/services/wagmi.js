import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';

// MegaETH Mainnet chain definition
export const megaeth = {
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://megaeth.blockscout.com' },
  },
};

export const config = createConfig({
  chains: [megaeth],
  connectors: [
    injected(), // MetaMask, Rabby, etc.
  ],
  transports: {
    [megaeth.id]: http('https://mainnet.megaeth.com/rpc'),
  },
});
