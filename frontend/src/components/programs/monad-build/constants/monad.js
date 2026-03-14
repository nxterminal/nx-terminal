export const MONAD_MAINNET = {
  chainId: 143,
  name: 'Monad',
  rpcUrl: 'https://rpc.monad.xyz',
  explorer: 'https://monadvision.com',
  explorerApi: 'https://sourcify-api-monad.blockvision.org',
  etherscanExplorer: 'https://monadscan.com',
  etherscanApi: 'https://api.monadscan.com/api',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
};

export const MONAD_TESTNET = {
  chainId: 10143,
  name: 'Monad Testnet',
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  explorer: 'https://testnet.monadvision.com',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
};

export const CANONICAL_CONTRACTS = {
  WMON: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11',
  PERMIT2: '0x000000000022d473030f116ddee9f6b43ac78ba3',
  ENTRYPOINT_V07: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  SAFE: '0x69f4D1788e39c87893C980c06EdF4b7f686e2938',
  CREATEX: '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed',
};

export const MONAD_RPC_PROVIDERS = [
  { name: 'QuickNode', url: 'https://rpc.monad.xyz', rateLimit: '25 rps' },
  { name: 'Alchemy', url: 'https://rpc1.monad.xyz', rateLimit: '15 rps' },
  { name: 'Goldsky', url: 'https://rpc2.monad.xyz', rateLimit: '300/10s' },
  { name: 'Ankr', url: 'https://rpc3.monad.xyz', rateLimit: '300/10s' },
  { name: 'Monad Foundation', url: 'https://rpc-mainnet.monadinfra.com', rateLimit: '20 rps' },
];

export const FAUCETS = [
  { name: 'Official Faucet', url: 'https://faucet.monad.xyz', description: 'Official Monad testnet faucet' },
  { name: 'QuickNode Faucet', url: 'https://faucet.quicknode.com/monad/testnet', description: 'QuickNode testnet faucet' },
  { name: 'ETHGlobal Faucet', url: 'https://ethglobal.com/faucet/monad-testnet-10143', description: 'ETHGlobal testnet faucet' },
];

export const MONAD_KEY_DIFFERENCES = [
  { aspect: 'Gas Charging', ethereum: 'Gas used', monad: 'Gas limit (full)', impact: 'Set tight gas limits; you pay the max declared', severity: 'warning' },
  { aspect: 'Cold SLOAD', ethereum: '2,100 gas', monad: '8,100 gas', impact: '~4x costlier; cache storage reads in memory', severity: 'warning' },
  { aspect: 'Cold Account Access', ethereum: '2,600 gas', monad: '10,100 gas', impact: '~4x costlier; minimize cross-contract cold calls', severity: 'warning' },
  { aspect: 'Max Contract Size', ethereum: '24.5 KB', monad: '128 KB', impact: 'Larger contracts possible; less need for proxies', severity: 'good' },
  { aspect: 'Block Time', ethereum: '12 sec', monad: '0.4 sec', impact: 'Near-instant UI feedback', severity: 'good' },
  { aspect: 'Finality', ethereum: '12-18 min', monad: '0.8 sec', impact: 'Immediate confirmations for most apps', severity: 'good' },
  { aspect: 'Mempool', ethereum: 'Global', monad: 'Local', impact: 'Track nonces locally for rapid successive txs', severity: 'info' },
  { aspect: 'EVM Version', ethereum: 'Various', monad: 'Prague (Pectra)', impact: 'MUST set evmVersion: "prague" in compiler', severity: 'warning' },
];

export const ECOSYSTEM_PROTOCOLS = {
  defi: [
    { name: 'Kuru', category: 'CLOB DEX', url: 'https://kuru.io', description: 'On-chain order book, $500M+ volume' },
    { name: 'Uniswap V4', category: 'AMM DEX', url: 'https://app.uniswap.org', description: 'Leading AMM, ~$60M TVL on Monad' },
    { name: 'Curve', category: 'Stableswap', url: 'https://curve.fi', description: 'Stable asset swaps' },
    { name: 'Morpho', category: 'Lending', url: 'https://morpho.org', description: 'Optimized lending protocol' },
    { name: 'aPriori', category: 'Liquid Staking', url: 'https://apriori.finance', description: 'aprMON liquid staking token' },
    { name: 'Kintsu', category: 'Liquid Staking', url: 'https://kintsu.xyz', description: 'sMON liquid staking token' },
    { name: 'FastLane', category: 'Liquid Staking', url: 'https://fastlane.finance', description: 'shMON liquid staking + MEV' },
    { name: 'Perpl', category: 'Perpetuals DEX', url: 'https://perpl.io', description: 'On-chain perpetuals CLOB' },
  ],
  gaming: [
    { name: 'Lumiterra', category: 'MMORPG', url: 'https://lumiterra.net', description: 'AI survival game with on-chain economy' },
    { name: 'Sparkball', category: 'MOBA', url: 'https://sparkball.com', description: '4v4 sports MOBA by ex-Riot devs' },
    { name: 'Breath of Estova', category: 'MMORPG', url: 'https://breathofestova.com', description: '2D pixel-art RPG' },
  ],
  nft: [
    { name: 'Magic Eden', category: 'Marketplace', url: 'https://magiceden.us/monad', description: 'Primary NFT marketplace' },
    { name: 'Poply', category: 'Marketplace', url: 'https://poply.io', description: 'Native Monad NFT marketplace' },
  ],
  infra: [
    { name: 'MonadVision', category: 'Explorer', url: 'https://monadvision.com', description: 'Block explorer (Sourcify)' },
    { name: 'Monadscan', category: 'Explorer', url: 'https://monadscan.com', description: 'Block explorer (Etherscan-style)' },
    { name: 'Pyth', category: 'Oracle', url: 'https://pyth.network', description: 'Price feeds for Monad' },
  ],
};

export const CONTRACT_TYPES = [
  { id: 'erc20', name: 'ERC-20 Token', description: 'Fungible token standard', tags: ['DeFi', 'Fungible'] },
  { id: 'erc721', name: 'NFT Collection', description: 'Non-fungible token standard', tags: ['NFT', 'Collectible'] },
  { id: 'erc1155', name: 'Multi-Token', description: 'Multi-token standard (fungible + NFT)', tags: ['NFT', 'DeFi'] },
  { id: 'staking', name: 'Staking', description: 'Token staking with rewards', tags: ['DeFi', 'Yield'] },
  { id: 'game', name: 'Game Economy', description: 'Gaming currency + items', tags: ['Gaming', 'Economy'] },
  { id: 'custom', name: 'Custom', description: 'Start from scratch', tags: ['Advanced'] },
];
