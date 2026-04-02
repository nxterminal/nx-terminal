# NXT Wallet — Full Claim Flow Analysis

> Read-only audit of the $NXT claim system across frontend, backend, and smart contracts.

---

## 1. Frontend — NxtWallet.jsx

**File:** `frontend/src/windows/NxtWallet.jsx`

### Claimable Balance Display
- **Line 69-77:** Reads `previewClaim(tokenIds)` via wagmi `useReadContract()` to get total claimable amount from the on-chain contract.
- **Line 156:** Displays claimable amount in gold text: `Claimable: {claimDisplay} $NXT`
- **Lines 251-273:** Three stat boxes from API wallet-summary:
  - Balance (gold): `summary.balance_claimable`
  - Total Spent (red): `summary.total_spent`
  - Total Earned (cyan): `summary.balance_total_earned`

### On-Chain Claim Execution
- **Line 80-106:** Uses wagmi `useWriteContract()`:
  ```javascript
  writeContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'claimNXT',
    args: [ids],  // array of token IDs
  });
  ```
- **Line 83-85:** Waits for receipt via `useWaitForTransactionReceipt()`
- **Line 109:** Button disabled when `!claimEnabled || !hasClaimable || isSending || isMining`

### Contract Address
- **NXDEVNFT_ADDRESS:** `0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7` (from `contract.js` line 6)
- **NXTToken:** `0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47`

### ABI — claimNXT
- **contract.js line 35-40:** `claimNXT(uint256[] tokenIds)` — write, nonpayable
- **contract.js line 110-117:** `previewClaim(uint256[] tokenIds)` — view, returns single `uint256`

### Deposit
- **NO deposit functionality exists** in NxtWallet or any other frontend component.

---

## 2. Backend — claim_sync.py

**File:** `backend/engine/claim_sync.py`

### Synchronization Flow
1. **Line 78-94:** `get_pending_claims()` queries DB:
   ```sql
   SELECT token_id, balance_nxt FROM nx.devs
   WHERE status = 'active' AND balance_nxt > 0
   ORDER BY token_id
   ```
2. **Line 97-123:** `build_sync_batch()` converts to wei: `amount_wei = balance_nxt * (10 ** 18)`
3. **Line 140-168:** `_send_batch()` submits batches to contract
4. **Line 126-137:** `_mark_synced()` zeros out `balance_nxt` after success

### Contract Function Called
- **Line 54-64:** ABI declares `batchSetClaimable(tokenIds[], amounts[])`
- Submits in batches of `BATCH_SIZE` (default 200)
- Gas estimate: `500_000 + (len(batch_ids) * 30_000)` per batch

### Backend Signer Configuration
| Env Var | Purpose | Default |
|---------|---------|---------|
| `BACKEND_SIGNER_PRIVATE_KEY` | EOA private key for TX signing | (empty) |
| `MEGAETH_RPC_URL` | RPC endpoint | `https://carrot.megaeth.com/rpc` |
| `DRY_RUN` | Safe mode toggle | `"true"` |
| `CLAIM_SYNC_BATCH_SIZE` | Devs per TX | `200` |

### Permission Model
- Signer address must have `onlyBackendOrOwner` access on NXDevNFT
- Set via `setBackendSigner(address)` on contract (owner only)

---

## 3. Smart Contract — NXDevNFT v4

**File:** `contracts/NXDevNFT_v4.sol`

### claimNXT() — Lines 436-469
```
1. Check claimEnabled == true
2. Iterate tokenIds, sum claimableBalance[tokenId]
3. Apply 10% fee: feeAmount = (grossAmount * 1000) / 10000
4. Net to player: grossAmount - feeAmount
5. nxtToken.mint(msg.sender, netAmount)     ← MINTS new tokens
6. nxtToken.mint(treasuryWallet, feeAmount) ← Fee to treasury
7. Zero out claimableBalance for each tokenId
```

### Key Points
- **Mints new tokens** — does NOT transfer from treasury
- **NXDevNFT must have MINTER role** on NXTToken (`isMinter[nxdevnft] = true`)
- **No approve needed** — minting bypasses ERC20 allowance
- **10% claim fee** (`CLAIM_FEE_BPS = 1000`)

### previewClaim() — Lines 474-484
- **Contract signature:** returns `(uint256 gross, uint256 fee, uint256 net)` — 3 values
- Calculates what player would receive before actually claiming

### batchSetClaimableBalance() — Line 611
- **Contract name:** `batchSetClaimableBalance` (NOT `batchSetClaimable`)
- Access: `onlyBackendOrOwner`
- Sets absolute claimable balance per tokenId in wei

### Other Relevant Functions
| Function | Access | Purpose |
|----------|--------|---------|
| `setClaimableBalance(id, amount)` | `onlyBackendOrOwner` | Set single dev balance |
| `batchAddClaimableBalance(ids[], amounts[])` | `onlyBackendOrOwner` | Increment balances |
| `deductClaimableBalance(id, amount)` | `onlyGameOrBackend` | Deduct for shop purchases |

---

## 4. NXTToken v3

**File:** `contracts/NXTToken_v3.sol`

- **Address:** `0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47`
- `mint(address to, uint256 amount)` — requires `onlyMinter` (line 169)
- `MAX_SUPPLY = 1,000,000,000 * 1e18` (1 billion, immutable)
- Standard ERC20 with optional auto-burn on transfer

---

## 5. Full User Flow: Claim $NXT

### What works today:
1. Dev earns salary in-game → `balance_nxt` increases in DB
2. Frontend shows virtual balance from API `/wallet-summary`
3. Frontend shows on-chain claimable from `previewClaim()`
4. User clicks "Claim" → `claimNXT(tokenIds)` mints $NXT to wallet

### What's needed for full operation:
1. `BACKEND_SIGNER_PRIVATE_KEY` must be set in Render env
2. `DRY_RUN` must be set to `"false"`
3. Backend signer address must be registered via `setBackendSigner()` on contract
4. NXDevNFT contract must have `isMinter = true` on NXTToken
5. `claimEnabled` must be `true` on NXDevNFT
6. `claim_sync.py` must be running (cron or manual)

### Deposit $NXT back to game:
- **Not implemented anywhere.** Would require:
  - Frontend: deposit UI with `transferFrom()` or custom contract call
  - Backend: event listener or API to credit `balance_nxt`
  - Contract: deposit function or ERC20 approval + pull pattern

---

## 6. CRITICAL ISSUES FOUND

### Issue 1: ABI Function Name Mismatch (Backend)
- **Location:** `backend/engine/claim_sync.py` line 56
- **Problem:** ABI declares `batchSetClaimable` but contract function is `batchSetClaimableBalance`
- **Impact:** **claim_sync will revert every transaction** — function selector won't match
- **Fix:** Rename in ABI to `batchSetClaimableBalance`

### Issue 2: previewClaim Return Value Mismatch (Frontend)
- **Location:** `frontend/src/services/contract.js` lines 110-117
- **Problem:** ABI declares single `uint256` return, but contract returns `(uint256 gross, uint256 fee, uint256 net)`
- **Impact:** Frontend shows gross amount as claimable, but user receives net (10% less)
- **Fix:** Update ABI outputs to 3 values, display net amount in UI

### Issue 3: Missing Fee Display
- **Location:** `frontend/src/windows/NxtWallet.jsx` line 69
- **Problem:** Comment says "v8: no fee" but contract charges 10% (`CLAIM_FEE_BPS = 1000`)
- **Impact:** Users don't see the fee before claiming — unexpected 10% deduction
- **Fix:** Show gross, fee, and net breakdown in claim UI

### Issue 4: Two-Tier Balance Confusion
- **Problem:** `balance_claimable` from API (virtual in-game, integer NXT) vs `claimableBalance` on contract (wei, synced periodically) are different values shown in the same wallet
- **Impact:** User may see different numbers for "claimable" depending on sync timing
- **Fix:** Clearly label "In-Game Balance" vs "On-Chain Claimable" with sync status indicator

### Issue 5: No Minter Role Verification
- **Problem:** No startup check that NXDevNFT has minter role on NXTToken
- **Impact:** Claims will revert silently if minter role not granted
- **Fix:** Add health check endpoint or startup verification
