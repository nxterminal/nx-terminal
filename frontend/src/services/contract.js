export const NXDEV_ADDRESS = '0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7';

export const NXDEV_ABI = [
  // Read functions
  {
    name: 'mintPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'whitelistPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalMinted',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'mintPhase',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'maxPerWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'tokensOfOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner_', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
  },
  {
    name: 'whitelisted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'freeMintAllowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'remainingSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getDevInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'owner_', type: 'address' },
      { name: 'locked_', type: 'bool' },
      { name: 'state_', type: 'uint8' },
      { name: 'corpId_', type: 'uint8' },
      { name: 'corpSet_', type: 'bool' },
      { name: 'claimable_', type: 'uint256' },
      { name: 'claimed_', type: 'uint256' },
    ],
  },
  {
    name: 'claimEnabled',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
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
  // Write functions
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
  // Events
  {
    name: 'DevMinted',
    type: 'event',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
  {
    name: 'BatchMinted',
    type: 'event',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'tokenIds', type: 'uint256[]', indexed: false },
    ],
  },
];
