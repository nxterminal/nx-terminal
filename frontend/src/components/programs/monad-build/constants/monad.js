export const MEGAETH_MAINNET = {
  chainId: 4326,
  name: 'MegaETH',
  rpcUrl: 'https://carrot.megaeth.com/rpc',
  explorer: 'https://megaexplorer.xyz',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
};

export const MEGAETH_TESTNET = {
  chainId: 4326,
  name: 'MegaETH',
  rpcUrl: 'https://carrot.megaeth.com/rpc',
  explorer: 'https://megaexplorer.xyz',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
};

export const CANONICAL_CONTRACTS = {
  WETH: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11',
  PERMIT2: '0x000000000022d473030f116ddee9f6b43ac78ba3',
  ENTRYPOINT_V07: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  SAFE: '0x69f4D1788e39c87893C980c06EdF4b7f686e2938',
  CREATEX: '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed',
};

export const MEGAETH_RPC_PROVIDERS = [
  { name: 'MegaETH', url: 'https://carrot.megaeth.com/rpc', rateLimit: '25 rps' },
];

export const FAUCETS = [
  { name: 'MegaETH Faucet', url: 'https://faucet.megaeth.com', description: 'MegaETH testnet faucet' },
];

export const MEGAETH_KEY_DIFFERENCES = [
  { aspect: 'Gas Charging', ethereum: 'Gas used', megaeth: 'Gas limit (full)', impact: 'Set tight gas limits; you pay the max declared', severity: 'warning' },
  { aspect: 'Cold SLOAD', ethereum: '2,100 gas', megaeth: '8,100 gas', impact: '~4x costlier; cache storage reads in memory', severity: 'warning' },
  { aspect: 'Cold Account Access', ethereum: '2,600 gas', megaeth: '10,100 gas', impact: '~4x costlier; minimize cross-contract cold calls', severity: 'warning' },
  { aspect: 'Max Contract Size', ethereum: '24.5 KB', megaeth: '128 KB', impact: 'Larger contracts possible; less need for proxies', severity: 'good' },
  { aspect: 'Block Time', ethereum: '12 sec', megaeth: '0.4 sec', impact: 'Near-instant UI feedback', severity: 'good' },
  { aspect: 'Finality', ethereum: '12-18 min', megaeth: 'Sub-second', impact: 'Immediate confirmations for most apps', severity: 'good' },
  { aspect: 'Mempool', ethereum: 'Global', megaeth: 'Local', impact: 'Track nonces locally for rapid successive txs', severity: 'info' },
  { aspect: 'EVM Version', ethereum: 'Various', megaeth: 'Prague (Pectra)', impact: 'MUST set evmVersion: "prague" in compiler', severity: 'warning' },
];

export const ECOSYSTEM_PROTOCOLS = {
  defi: [
    { name: 'Kuru', category: 'CLOB DEX', url: 'https://kuru.io', description: 'On-chain order book, $500M+ volume' },
    { name: 'Uniswap V4', category: 'AMM DEX', url: 'https://app.uniswap.org', description: 'Leading AMM, ~$60M TVL on MegaETH' },
    { name: 'Curve', category: 'Stableswap', url: 'https://curve.fi', description: 'Stable asset swaps' },
    { name: 'Morpho', category: 'Lending', url: 'https://morpho.org', description: 'Optimized lending protocol' },
    { name: 'aPriori', category: 'Liquid Staking', url: 'https://apriori.finance', description: 'aprETH liquid staking token' },
    { name: 'Kintsu', category: 'Liquid Staking', url: 'https://kintsu.xyz', description: 'sETH liquid staking token' },
    { name: 'FastLane', category: 'Liquid Staking', url: 'https://fastlane.finance', description: 'shETH liquid staking + MEV' },
    { name: 'Perpl', category: 'Perpetuals DEX', url: 'https://perpl.io', description: 'On-chain perpetuals CLOB' },
  ],
  gaming: [
    { name: 'Lumiterra', category: 'MMORPG', url: 'https://lumiterra.net', description: 'AI survival game with on-chain economy' },
    { name: 'Sparkball', category: 'MOBA', url: 'https://sparkball.com', description: '4v4 sports MOBA by ex-Riot devs' },
    { name: 'Breath of Estova', category: 'MMORPG', url: 'https://breathofestova.com', description: '2D pixel-art RPG' },
  ],
  nft: [
    { name: 'Magic Eden', category: 'Marketplace', url: 'https://magiceden.us/megaeth', description: 'Primary NFT marketplace' },
    { name: 'Poply', category: 'Marketplace', url: 'https://poply.io', description: 'Native MegaETH NFT marketplace' },
  ],
  infra: [
    { name: 'MegaExplorer', category: 'Explorer', url: 'https://megaexplorer.xyz', description: 'Block explorer' },
    { name: 'Pyth', category: 'Oracle', url: 'https://pyth.network', description: 'Price feeds for MegaETH' },
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
