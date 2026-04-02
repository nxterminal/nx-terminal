# Claim Sync — Required Render Environment Variables

For the on-chain claim system to work, the backend must sync `balance_nxt` from the database to the `claimableBalance` mapping on the NXDevNFT smart contract. This is done by `claim_sync.py` which runs every 10 minutes inside the engine.

## Required Environment Variables

### `DRY_RUN=false`
Enables actual on-chain writes. **Default is `true`** (no transactions sent).

Set to `false` in Render to activate claim sync.

### `BACKEND_SIGNER_PRIVATE_KEY=<private key>`
The EOA private key that has `SIGNER_ROLE` on the NXDevNFT contract.

This wallet must be registered as `backendSigner` on the contract:
```
// From contract owner:
NXDevNFT.setBackendSigner(signerAddress)
```

The signer calls `batchSetClaimableBalance(tokenIds[], amounts[])` to push balances on-chain.

### `MEGAETH_RPC_URL=https://carrot.megaeth.com/rpc`
Already configured by default. Only change if using a different RPC endpoint.

## Verification

After setting the env vars and restarting the engine:

```bash
# Check claim sync status
curl https://nx-terminal.onrender.com/api/simulation/claim-sync-status

# Expected response:
# { "signer_configured": true, "dry_run": false, "last_sync": "...", ... }
```

## How Claim Sync Works

1. Every 10 minutes, `claim_sync.py` queries all active devs with `balance_nxt > 0`
2. Builds batch of `(tokenId, amount_wei)` pairs
3. Calls `batchSetClaimableBalance()` on NXDevNFT contract (batch size: 200)
4. After successful TX, sets `balance_nxt = 0` for synced devs in the database
5. Players can then call `claimNXT(tokenIds[])` from the frontend to mint $NXT tokens
6. A 10% claim fee is sent to the treasury wallet
