// ============================================
// NX CREDENTIAL CONTRACT CONFIGURATION
// ============================================
// Replace these values with real contract details before production.
// After deploying the NX Credential NFT contract, update:
//   1. CONTRACT_ADDRESS with the deployed address
//   2. CONTRACT_ABI with the compiled ABI
//   3. MINT_PRICE with the actual mint cost
// ============================================

// TODO: Replace with real contract address after deployment
export const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

// TODO: Replace with full ABI from contract compilation
export const CONTRACT_ABI = [
  'function mint(address to) payable returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

export const MINT_PRICE = '0.01';
export const MAX_SUPPLY = 10000;
export const CURRENT_SUPPLY = 247;
