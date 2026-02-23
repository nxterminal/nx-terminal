// NXDevNFT contract on MegaETH (chain 4326)
export const NXDEVNFT_ADDRESS = '0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7';
export const NXT_TOKEN_ADDRESS = '0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47';
export const TREASURY_ADDRESS = '0x31d6E19aAE43B5E2fbeDb01b6FF82AD1e8B576DC';
export const MEGAETH_CHAIN_ID = 4326;
export const EXPLORER_BASE = 'https://megaeth.blockscout.com';

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
      { name: 'gross', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
      { name: 'net', type: 'uint256' },
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
