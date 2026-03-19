"""
NX TERMINAL: Claimable Balance Sync (Backend -> On-Chain)

This module syncs each dev's claimable $NXT balance to the NXDevNFT v9 contract
so players can claim on-chain via claimNXT(tokenIds[]).

FLOW:
  1. Query all active devs with unclaimed salary (balance_nxt > 0, not yet synced)
  2. For each dev: convert balance_nxt to wei (no fee inflation — v8 has no claim fee)
  3. Call batchSetClaimable(tokenIds[], amounts[]) on the NXDevNFT contract
     IN BATCHES of BATCH_SIZE to avoid gas limits
  4. Mark synced devs in DB so they aren't double-synced

REQUIREMENTS:
  - BACKEND_SIGNER_PRIVATE_KEY env var (EOA with SIGNER_ROLE on NXDevNFT)
  - web3.py >= 7.0 (pip install web3)
  - The signer address must have SIGNER_ROLE granted by contract owner
  - Pharos RPC: https://atlantic.dplabs-internal.com

SAFETY:
  - This script does NOT execute transactions by default
  - Set DRY_RUN=false env var to enable actual on-chain writes
  - All amounts are logged before submission
  - Failed TXs do not affect DB state (atomic)

USAGE:
  python -m backend.engine.claim_sync          # dry run (default)
  DRY_RUN=false python -m backend.engine.claim_sync   # live sync
"""

import os
import logging

from .config import (
    DATABASE_URL,
    SALARY_PER_DAY,
    CLAIMABLE_AMOUNT_WEI_PER_DAY,
)

logger = logging.getLogger(__name__)

# -- Contract addresses (Pharos Atlantic Testnet) --------------------------
NXDEVNFT_ADDRESS = "0x5DeAB0Ab650D9c241105B6cb567Dd41045C44636"
NXT_TOKEN_ADDRESS = "0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47"
PHAROS_RPC = os.getenv("PHAROS_RPC_URL", "https://atlantic.dplabs-internal.com")
PHAROS_CHAIN_ID = 688689

# -- Env config --------------------------------------------------------
SIGNER_PRIVATE_KEY = os.getenv("BACKEND_SIGNER_PRIVATE_KEY", "")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() != "false"
BATCH_SIZE = int(os.getenv("CLAIM_SYNC_BATCH_SIZE", "200"))

# -- ABI fragment for batchSetClaimable --------------------------------
BATCH_SET_CLAIMABLE_ABI = [
    {
        "name": "batchSetClaimable",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "tokenIds", "type": "uint256[]"},
            {"name": "amounts", "type": "uint256[]"},
        ],
        "outputs": [],
    },
    {
        "name": "setClaimableBalance",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [],
    },
]


def get_pending_claims(db_conn):
    """
    Query devs that have unsynchronized claimable balance.

    Returns list of dicts: [{ token_id, balance_nxt }]
    """
    query = """
        SELECT token_id, balance_nxt
        FROM nx.devs
        WHERE status = 'active'
          AND balance_nxt > 0
        ORDER BY token_id
    """
    cursor = db_conn.cursor()
    cursor.execute(query)
    rows = cursor.fetchall()
    return [{"token_id": r[0], "balance_nxt": r[1]} for r in rows]


def build_sync_batch(pending_devs):
    """
    Build arrays of (tokenIds, amounts_wei) for batchSetClaimable.

    NXDevNFT v8 has no claim fee — the amount set on-chain is exactly
    what the player receives. No gross/net inflation needed.
    """
    token_ids = []
    amounts_wei = []

    for dev in pending_devs:
        balance_nxt = dev["balance_nxt"]
        if balance_nxt <= 0:
            continue

        # Convert token units to wei (18 decimals) — 1:1, no fee adjustment
        amount_wei = balance_nxt * (10 ** 18)

        token_ids.append(dev["token_id"])
        amounts_wei.append(amount_wei)

        logger.info(
            "Dev #%d: %d NXT (%d wei)",
            dev["token_id"], balance_nxt, amount_wei,
        )

    return token_ids, amounts_wei


def _mark_synced(db_conn, synced_token_ids):
    """Zero out balance_nxt for devs that were successfully synced on-chain."""
    if not synced_token_ids:
        return
    cursor = db_conn.cursor()
    placeholders = ",".join(["%s"] * len(synced_token_ids))
    cursor.execute(
        f"UPDATE nx.devs SET balance_nxt = 0 WHERE token_id IN ({placeholders})",
        synced_token_ids,
    )
    db_conn.commit()
    logger.info("Marked %d devs as synced (balance_nxt = 0).", len(synced_token_ids))


def _send_batch(w3, contract, account, batch_ids, batch_amounts, nonce):
    """Send a single batchSetClaimable TX and wait for confirmation.

    Returns (success: bool, new_nonce: int).
    """
    tx = contract.functions.batchSetClaimable(
        batch_ids, batch_amounts
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": PHAROS_CHAIN_ID,
        "gas": 500_000 + (len(batch_ids) * 30_000),
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    logger.info("TX sent: %s (%d devs)", tx_hash.hex(), len(batch_ids))

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status == 1:
        logger.info(
            "TX confirmed in block %d. Gas used: %d",
            receipt.blockNumber, receipt.gasUsed,
        )
        return True, nonce + 1
    else:
        logger.error("TX reverted! Hash: %s", tx_hash.hex())
        return False, nonce + 1


def sync_claimable_balances():
    """
    Main sync function. Reads pending claims from DB and submits to contract
    in batches of BATCH_SIZE.

    In DRY_RUN mode (default), only logs what would be sent.
    """
    logger.info("=== Claim Sync Started (DRY_RUN=%s, BATCH_SIZE=%d) ===", DRY_RUN, BATCH_SIZE)

    if not DRY_RUN and not SIGNER_PRIVATE_KEY:
        logger.error("BACKEND_SIGNER_PRIVATE_KEY not set. Cannot send transactions.")
        return

    # -- 1. Connect to DB ----------------------------------------------
    try:
        import psycopg2
        db_conn = psycopg2.connect(DATABASE_URL)
    except ImportError:
        logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        return
    except Exception as e:
        logger.error("DB connection failed: %s", e)
        return

    # -- 2. Get pending claims -----------------------------------------
    pending = get_pending_claims(db_conn)
    if not pending:
        logger.info("No pending claims to sync.")
        db_conn.close()
        return

    logger.info("Found %d devs with claimable balance.", len(pending))

    # -- 3. Build full batch -------------------------------------------
    token_ids, amounts_wei = build_sync_batch(pending)
    if not token_ids:
        logger.info("No non-zero balances to sync.")
        db_conn.close()
        return

    total_nxt = sum(a // (10 ** 18) for a in amounts_wei)
    logger.info(
        "Total: %d devs, %d NXT to sync on-chain",
        len(token_ids),
        total_nxt,
    )

    # -- 4. Submit to contract in batches ------------------------------
    if DRY_RUN:
        for i in range(0, len(token_ids), BATCH_SIZE):
            chunk_ids = token_ids[i:i + BATCH_SIZE]
            logger.info("[DRY RUN] Batch %d: %d devs (ids %d..%d)",
                        i // BATCH_SIZE + 1, len(chunk_ids), chunk_ids[0], chunk_ids[-1])
        logger.info("[DRY RUN] Skipping on-chain transactions.")
        db_conn.close()
        return

    try:
        from web3 import Web3

        w3 = Web3(Web3.HTTPProvider(PHAROS_RPC))
        if not w3.is_connected():
            logger.error("Cannot connect to Pharos RPC.")
            db_conn.close()
            return

        account = w3.eth.account.from_key(SIGNER_PRIVATE_KEY)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(NXDEVNFT_ADDRESS),
            abi=BATCH_SET_CLAIMABLE_ABI,
        )

        nonce = w3.eth.get_transaction_count(account.address)
        total_synced = []

        for i in range(0, len(token_ids), BATCH_SIZE):
            chunk_ids = token_ids[i:i + BATCH_SIZE]
            chunk_amounts = amounts_wei[i:i + BATCH_SIZE]

            logger.info("Sending batch %d/%d (%d devs)...",
                        i // BATCH_SIZE + 1,
                        (len(token_ids) + BATCH_SIZE - 1) // BATCH_SIZE,
                        len(chunk_ids))

            success, nonce = _send_batch(w3, contract, account, chunk_ids, chunk_amounts, nonce)
            if success:
                # Mark these devs as synced in DB immediately after confirmed TX
                _mark_synced(db_conn, chunk_ids)
                total_synced.extend(chunk_ids)
            else:
                logger.error("Batch failed — stopping. %d devs synced so far.", len(total_synced))
                break

        logger.info("=== Claim Sync Complete: %d/%d devs synced ===", len(total_synced), len(token_ids))

    except ImportError:
        logger.error("web3 not installed. Run: pip install web3")
    except Exception as e:
        logger.error("On-chain sync failed: %s", e)
    finally:
        db_conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    sync_claimable_balances()
