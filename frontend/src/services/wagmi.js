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

// MOSS connector id, hardcoded. megaWallet({network:'mainnet'}) returns
// a wagmi CreateConnectorFn whose .id is undefined until wagmi processes
// it inside createConfig — so reading .id at build time gives undefined.
// The materialised connector instance always carries id='megaWallet'.
export const MOSS_CONNECTOR_ID = 'megaWallet';

// Identifies the active wagmi connector as MOSS. Callers pass the
// connector from useAccount() — undefined/null is treated as "not MOSS".
export function isMossConnector(connector) {
  return connector?.id === MOSS_CONNECTOR_ID;
}

export const wagmiConfig = createConfig({
  chains: [megaeth],
  connectors: [injected(), megaWallet({ network: 'mainnet' })],
  transports: {
    [megaeth.id]: http('https://mainnet.megaeth.com/rpc'),
  },
});
