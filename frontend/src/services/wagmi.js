import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

// Pharos Atlantic Testnet — custom chain definition
export const pharos = {
  id: 688689,
  name: 'Pharos Atlantic Testnet',
  nativeCurrency: { name: 'Pharos', symbol: 'PHRS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://atlantic.dplabs-internal.com'] },
  },
  blockExplorers: {
    default: { name: 'PharosScan', url: 'https://atlantic.pharosscan.xyz' },
  },
};

export const wagmiConfig = createConfig({
  chains: [pharos],
  connectors: [injected()],
  transports: {
    [pharos.id]: http('https://atlantic.dplabs-internal.com'),
  },
});
