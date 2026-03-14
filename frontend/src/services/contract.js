// NXDevNFT v9 & NXTToken v5 on Monad Testnet (chain 10143)
export const NXDEVNFT_ADDRESS = '0x5DeAB0Ab650D9c241105B6cb567Dd41045C44636';
export const NXT_TOKEN_ADDRESS = '0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47';
export const MONAD_CHAIN_ID = 10143;
export const EXPLORER_BASE = 'https://testnet.monadexplorer.com';

// Minimal ABI — only the functions the frontend needs
export const NXDEVNFT_ABI = [
  // ── Write functions ──────────────────────────────────────
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'quantity', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'whitelistMint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'quantity', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'freeMint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'quantity', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'claimNXT',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokenIds', type: 'uint256[]' }],
    outputs: [],
  },

  // ── Read functions ───────────────────────────────────────
  {
    name: 'mintPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'mintPhase',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokensOfOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner_', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'whitelisted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'freeMintAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'remainingSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'claimEnabled',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'walletClaimable',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'devCount', type: 'uint256' },
    ],
  },
  {
    name: 'previewClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenIds', type: 'uint256[]' }],
    outputs: [
      { name: 'total', type: 'uint256' },
    ],
  },
  {
    name: 'getMintPrices',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'ethPublic', type: 'uint256' },
      { name: 'ethWL', type: 'uint256' },
      { name: 'tokenPublic', type: 'uint256' },
      { name: 'tokenWL', type: 'uint256' },
    ],
  },
  {
    name: 'totalMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalClaimedByWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];
