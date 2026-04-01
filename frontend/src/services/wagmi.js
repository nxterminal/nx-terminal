import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

// MegaETH — custom chain definition
export const megaeth = {
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://carrot.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'MegaExplorer', url: 'https://megaexplorer.xyz' },
  },
};

export const wagmiConfig = createConfig({
  chains: [megaeth],
  connectors: [injected()],
  transports: {
    [megaeth.id]: http('https://carrot.megaeth.com/rpc'),
  },
});
