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

// Instantiate the MOSS connector once so we can export its identity
// without guessing the id string. useWallet compares connector?.id
// against MOSS_CONNECTOR_ID to decide whether the active wallet is MOSS.
const MOSS_CONNECTOR = megaWallet({ network: 'mainnet' });

export const MOSS_CONNECTOR_ID = MOSS_CONNECTOR.id;
export const MOSS_CONNECTOR_NAME = MOSS_CONNECTOR.name;

if (MOSS_CONNECTOR_ID === undefined) {
  // Fallback: the connector resolves its id lazily inside wagmi. Callers
  // should also compare against MOSS_CONNECTOR_NAME when this happens.
  console.warn(
    '[wallet] MOSS_CONNECTOR.id is undefined at build time — falling back to name match'
  );
}

// Identifies the active wagmi connector as MOSS. Callers pass the
// connector from useAccount() — undefined/null is treated as "not MOSS".
export function isMossConnector(connector) {
  if (!connector) return false;
  if (MOSS_CONNECTOR_ID !== undefined) {
    return connector.id === MOSS_CONNECTOR_ID;
  }
  return connector.name === MOSS_CONNECTOR_NAME;
}

export const wagmiConfig = createConfig({
  chains: [megaeth],
  connectors: [injected(), MOSS_CONNECTOR],
  transports: {
    [megaeth.id]: http('https://mainnet.megaeth.com/rpc'),
  },
});
