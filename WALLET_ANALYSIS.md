# $NXT Wallet — Complete Flow Analysis

> Read-only audit of the claim/wallet pipeline: Frontend → Backend → Contract

---

## 1. FRONTEND: NxtWallet.jsx

### 1.1 Displaying Claimable Balance

Two separate balance views:

**Game Balance (virtual)** — Lines 241-274
- Fetches from backend REST: `GET /api/players/{wallet}/wallet-summary`
- Shows `summary.balance_claimable` (sum of all dev `balance_nxt`)
- Per-dev breakdown table (lines 295-324) with each dev's `balance_nxt`

**On-Chain Claimable** — `ClaimSection` component (lines 57-206)
- Reads from contract directly: `previewClaim(tokenIds)` via wagmi `useReadContract` (line 70-77)
- Displayed as "Claimable: {amount} $NXT" (line 156)
- Uses `formatNxt()` → `formatUnits(BigInt(wei), 18)` for wei→token conversion

### 1.2 Executing Claim

- Uses wagmi `useWriteContract` (line 80) — **no fallback mechanism**
- Calls `claimNXT(tokenIds)` on NXDevNFT contract (lines 99-107)
- Token IDs from on-chain `tokensOfOwner(wallet)` (lines 620-627)
- TX lifecycle: SENDING → MINING → confirmed, with explorer link
- After confirmation, refetches `previewClaim` to update display (lines 88-92)
- Checks `claimEnabled` from contract (lines 61-67), disables button if false

### 1.3 Contract Addresses

```javascript
// frontend/src/services/contract.js
NXDEVNFT_ADDRESS = '0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7'
NXT_TOKEN_ADDRESS = '0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47'  // ✅ Correct
MEGAETH_CHAIN_ID  = 4326
```

Both addresses match between frontend (`contract.js`) and backend (`claim_sync.py`).

### 1.4 ABI — claimNXT

**YES**, included at `contract.js:34-39`:
```javascript
{
  name: 'claimNXT',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'tokenIds', type: 'uint256[]' }],
  outputs: [],
}
```

### 1.5 Deposit $NXT Option

**NO.** There is no deposit functionality anywhere:
- No deposit UI in NxtWallet.jsx
- No deposit contract function
- No backend API endpoint for deposit
- Only two tabs: "Balance" and "Movements"

---

## 2. BACKEND: claim_sync.py

### 2.1 Sync Flow

1. Queries `nx.devs` for active devs with `balance_nxt > 0` (line 84-90)
2. Converts to wei: `amount_wei = balance_nxt * (10 ** 18)` — 1:1 ratio (lines 108-113)
3. Calls `batchSetClaimable(tokenIds[], amounts[])` in batches of 200 (lines 145-146)
4. After confirmed TX: sets `balance_nxt = 0` in DB for synced devs (lines 131-137)

### 2.2 Function Used

**`batchSetClaimable()`** (line 56, 145)

### 2.3 Env Vars Required

| Env Var | Default | Purpose |
|---------|---------|---------|
| `BACKEND_SIGNER_PRIVATE_KEY` | (empty) | EOA with SIGNER_ROLE on NXDevNFT |
| `DRY_RUN` | `"true"` | Set to `"false"` for actual on-chain writes |
| `CLAIM_SYNC_BATCH_SIZE` | `200` | Devs per batch TX |
| `MEGAETH_RPC_URL` | `https://carrot.megaeth.com/rpc` | MegaETH RPC endpoint |
| `DATABASE_URL` | from config.py | PostgreSQL connection |

### 2.4 Signer Configuration

- Private key loaded from `BACKEND_SIGNER_PRIVATE_KEY` (line 49)
- Signer address must match `backendSigner` stored on the NXDevNFT contract
- Gated by `onlyBackendOrOwner` modifier (NXDevNFT_v4.sol:227-231)
- If env var empty + DRY_RUN=false → logs error and exits (line 179-181)

---

## 3. CONTRACT: NXDevNFT + NXTToken

### 3.1 claimNXT() — Mints New Tokens

**`claimNXT()` MINTS new $NXT — does NOT transfer from treasury.**

```solidity
// NXDevNFT_v4.sol:461
nxtToken.mint(msg.sender, netAmount);     // 90% to player
nxtToken.mint(treasuryWallet, feeAmount); // 10% to treasury
```

### 3.2 Claim Fee

```solidity
// NXDevNFT_v4.sol:86
uint256 public constant CLAIM_FEE_BPS = 1000; // 10%

// NXDevNFT_v4.sol:458-459
uint256 feeAmount = (grossAmount * CLAIM_FEE_BPS) / 10_000;
uint256 netAmount = grossAmount - feeAmount;
```

**10% fee on every claim.** Gross goes 90% player, 10% treasury.

### 3.3 Minter Role

- NXTToken uses `mapping(address => bool) public isMinter` (NXTToken_v3.sol:73)
- NXDevNFT must be registered as minter: `nxtToken.addMinter(nxdevnft_address)`
- This is a **one-time admin setup** by NXTToken owner
- NXTToken has a 1 billion max supply cap checked against `totalSupply()`

### 3.4 No Approve Pattern

No ERC-20 `approve` needed. NXDevNFT directly calls `nxtToken.mint()`. It's a mint operation, not a transfer.

---

## 4. CRITICAL BUGS FOUND

### BUG #1: `batchSetClaimable` vs `batchSetClaimableBalance` — BLOCKER

| | Backend (claim_sync.py) | Contract (NXDevNFT_v4.sol) |
|--|---|---|
| ABI name | `batchSetClaimable` (line 56) | `batchSetClaimableBalance` (line 611) |
| Called as | `contract.functions.batchSetClaimable(...)` (line 145) | N/A |

**The function selector won't match.** Every sync TX will **revert** on-chain. No balances will ever be pushed to the contract.

**Fix:** Rename `batchSetClaimable` → `batchSetClaimableBalance` in `claim_sync.py` lines 56 and 145.

### BUG #2: `previewClaim` ABI Return Mismatch — MEDIUM

| | Frontend ABI (contract.js) | Contract (NXDevNFT_v4.sol) |
|--|---|---|
| Returns | `(uint256 total)` — 1 value | `(uint256 gross, uint256 fee, uint256 net)` — 3 values |

```javascript
// contract.js:110-117  — declares 1 output
outputs: [{ name: 'total', type: 'uint256' }]

// NXDevNFT_v4.sol:474-477 — returns 3 values
returns (uint256 gross, uint256 fee, uint256 net)
```

**Result:** wagmi decodes only the first return value (`gross`). The frontend shows the **pre-fee amount** (100%), but the user actually receives **90%** after the 10% claim fee.

```javascript
// NxtWallet.jsx:94-95 — treats preview as gross (no fee awareness)
// v8: previewClaim returns single total (no fee deduction)  ← WRONG COMMENT
const totalWei = preview != null ? BigInt(preview) : BigInt(0);
```

**Fix:** Update ABI to return 3 values, display `net` instead of `gross`. Or show both: "Gross: X, Fee: Y, You receive: Z".

### BUG #3: Comment Says "No Fee" But Contract Has 10% Fee — MEDIUM

```python
# claim_sync.py:9
# no fee inflation — v8 has no claim fee  ← WRONG

# NxtWallet.jsx:69
# Read previewClaim to get total claimable amount (v8: no fee)  ← WRONG
```

The contract has `CLAIM_FEE_BPS = 1000` (10%). This means:
- `claim_sync.py` sets exact `balance_nxt` as claimable (no gross inflation)
- But `claimNXT()` deducts 10% at claim time
- **Player receives 10% less than what the game promised**

**Example:** Dev earns 216 $NXT/day → sync pushes 216 $NXT on-chain → player claims → receives 194.4 $NXT (216 × 0.9). Lost 21.6 $NXT to fee that was never communicated.

**Fix options:**
- A) Inflate by 1/0.9 in claim_sync: `amount_wei = int(balance_nxt * 10**18 / 0.9)`
- B) Set `CLAIM_FEE_BPS = 0` in contract (if owner can update — but it's `constant`, so NO)
- C) Display fee clearly in frontend and document the 10% cut

Note: `CLAIM_FEE_BPS` is `constant` in Solidity, so it **cannot be changed** without redeploying the contract. Option C is the only viable path without a new contract deployment.

---

## 5. GAP ANALYSIS

### Can user SEE claimable $NXT? — PARTIALLY

| Step | Status | Issue |
|------|--------|-------|
| Game balance (backend) | ✅ Works | Shows virtual balance from DB |
| On-chain claimable | ⚠️ Shows wrong amount | Displays gross (includes fee) |
| claim_sync pushes to chain | ❌ BLOCKED | Function name mismatch → all TXs revert |

If `claim_sync` has never run, `claimableBalance` = 0 for all devs on-chain. Frontend shows "Claimable: 0 $NXT" regardless of virtual balance.

### Can user CLAIM $NXT? — BLOCKED

| Prerequisite | Status | How to verify |
|---|---|---|
| claim_sync runs without error | ❌ Function name mismatch | Fix ABI name |
| `claimEnabled = true` on contract | ❓ Unknown | Call `claimEnabled()` on explorer |
| NXDevNFT is minter on NXTToken | ❓ Unknown | Call `isMinter(0x5fe9...)` on NXTToken |
| `nxtToken` address set on NXDevNFT | ❓ Unknown | Call `nxtToken()` on explorer |
| `treasuryWallet` set | ❓ Unknown | Call `treasuryWallet()` on explorer |
| `BACKEND_SIGNER_PRIVATE_KEY` on Render | ❓ Unknown | Check Render env vars |
| Signer has SIGNER_ROLE on contract | ❓ Unknown | Call `backendSigner()` on explorer |

### Can user DEPOSIT $NXT back? — NOT IMPLEMENTED

Would require:
1. **Contract:** `deposit(uint256 amount)` function that calls `nxtToken.transferFrom(msg.sender, address(this), amount)` or `nxtToken.gameBurn(msg.sender, amount)` and emits event for backend
2. **Backend:** Listener to detect deposit events + API endpoint to credit `balance_nxt`
3. **Frontend:** Approve + Deposit UI flow in NxtWallet

---

## 6. DEPLOYMENT CHECKLIST

Before claims can work end-to-end:

```
[ ] Fix claim_sync.py: batchSetClaimable → batchSetClaimableBalance
[ ] Fix contract.js: previewClaim outputs: 1 → 3 values (gross, fee, net)
[ ] Fix NxtWallet.jsx: display net amount, not gross
[ ] Decide fee strategy (inflate sync amounts or document the 10% cut)
[ ] Verify on-chain setup:
    [ ] claimEnabled = true
    [ ] NXDevNFT is minter on NXTToken
    [ ] nxtToken address set on NXDevNFT
    [ ] treasuryWallet set
    [ ] backendSigner matches BACKEND_SIGNER_PRIVATE_KEY
[ ] Set BACKEND_SIGNER_PRIVATE_KEY on Render
[ ] Set DRY_RUN=false on Render
[ ] Test with DRY_RUN=true first to verify DB query + batch building
[ ] Run claim_sync manually once, verify TX on explorer
[ ] Monitor first user claim end-to-end
```

---

## 7. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                     GAME ENGINE (hourly)                     │
│  pay_salaries() → UPDATE devs SET balance_nxt += 9          │
└──────────────────────────┬──────────────────────────────────┘
                           │ balance_nxt accumulates in DB
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLAIM_SYNC (periodic)                      │
│  1. SELECT devs WHERE balance_nxt > 0                        │
│  2. batchSetClaimableBalance(ids, amounts_wei) ← BUG: name  │
│  3. UPDATE devs SET balance_nxt = 0 (after TX confirms)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ on-chain TX via backend signer
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              NXDevNFT CONTRACT (on-chain)                     │
│  claimableBalance[tokenId] = amount_wei                      │
│                                                              │
│  User calls claimNXT(tokenIds[]):                            │
│    gross = sum(claimableBalance[id])                         │
│    fee = gross * 10%        ← 10% CLAIM FEE                 │
│    net = gross - fee                                         │
│    nxtToken.mint(user, net)                                  │
│    nxtToken.mint(treasury, fee)                              │
└──────────────────────────┬──────────────────────────────────┘
                           │ $NXT minted to user wallet
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              NXTToken (ERC-20 on MegaETH)                    │
│  0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47                 │
│  Max supply: 1,000,000,000 · Decimals: 18                   │
│  user.balance += net amount                                  │
└─────────────────────────────────────────────────────────────┘
```
