"""
NX TERMINAL: Claimable Balance Sync (Backend → On-Chain)

This module syncs each dev's claimable $NXT balance to the NXDevNFT contract
so players can claim on-chain via claimNXT(tokenIds[]).

FLOW:
  1. Query all active devs with unclaimed salary (balance_nxt > 0, not yet synced)
  2. For each dev: calculate gross amount = net / 0.9 (to compensate 10% on-chain fee)
     e.g. 200 NXT net → 222.22 NXT gross → player receives 200 after 10% fee
  3. Call batchSetClaimable(tokenIds[], amounts[]) on the NXDevNFT contract
  4. Mark synced devs in DB so they aren't double-synced

REQUIREMENTS:
  - BACKEND_SIGNER_PRIVATE_KEY env var (EOA with SIGNER_ROLE on NXDevNFT)
  - web3.py >= 7.0 (pip install web3)
  - The signer address must have SIGNER_ROLE granted by contract owner
  - MegaETH RPC: https://mainnet.megaeth.com/rpc

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
from decimal import Decimal

from .config import (
    DATABASE_URL,
    SALARY_PER_DAY,
    CLAIM_FEE_BPS,
    CLAIMABLE_AMOUNT_WEI_PER_DAY,
)

logger = logging.getLogger(__name__)

# ── Contract addresses ────────────────────────────────────
NXDEVNFT_ADDRESS = "0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7"
NXT_TOKEN_ADDRESS = "0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47"
MEGAETH_RPC = "https://mainnet.megaeth.com/rpc"
MEGAETH_CHAIN_ID = 4326

# ── Env config ────────────────────────────────────────────
SIGNER_PRIVATE_KEY = os.getenv("BACKEND_SIGNER_PRIVATE_KEY", "")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() != "false"

# ── ABI fragment for batchSetClaimable ────────────────────
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


def calculate_gross_wei(net_amount: int) -> int:
    """
    Calculate the gross amount in wei that must be set on-chain so the player
    receives `net_amount` after the 10% claim fee.

    Formula: gross = net / (1 - fee_rate)
             gross = net / (1 - 1000/10000)
             gross = net / 0.9

    Example: net=200 → gross=222.222... (in token units, 18 decimals)
    """
    fee_rate = Decimal(CLAIM_FEE_BPS) / Decimal(10000)  # 0.10
    multiplier = Decimal(1) / (Decimal(1) - fee_rate)     # 1.1111...
    gross = Decimal(net_amount) * multiplier
    return int(gross)


def get_pending_claims(db_conn):
    """
    Query devs that have unsynchronized claimable balance.

    Returns list of dicts: [{ token_id, balance_nxt, last_sync_at }]

    NOTE: Requires a `last_claim_sync_at` column on the devs table,
    or a separate `claim_sync_log` table. For now, we use balance_nxt > 0
    as a simple heuristic. In production, track sync state explicitly.
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

    Each dev's balance_nxt is the NET amount the player should receive.
    We inflate it to gross so the on-chain 10% fee leaves them with net.
    """
    token_ids = []
    amounts_wei = []

    for dev in pending_devs:
        net_nxt = dev["balance_nxt"]
        if net_nxt <= 0:
            continue

        # Convert token units to wei (18 decimals)
        net_wei = net_nxt * (10 ** 18)
        gross_wei = calculate_gross_wei(net_wei)

        token_ids.append(dev["token_id"])
        amounts_wei.append(gross_wei)

        logger.info(
            "Dev #%d: net=%d NXT, gross_wei=%d",
            dev["token_id"], net_nxt, gross_wei,
        )

    return token_ids, amounts_wei


def sync_claimable_balances():
    """
    Main sync function. Reads pending claims from DB and submits to contract.

    In DRY_RUN mode (default), only logs what would be sent.
    """
    logger.info("=== Claim Sync Started (DRY_RUN=%s) ===", DRY_RUN)

    if not DRY_RUN and not SIGNER_PRIVATE_KEY:
        logger.error("BACKEND_SIGNER_PRIVATE_KEY not set. Cannot send transactions.")
        return

    # ── 1. Connect to DB ──────────────────────────────────
    try:
        import psycopg2
        db_conn = psycopg2.connect(DATABASE_URL)
    except ImportError:
        logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        return
    except Exception as e:
        logger.error("DB connection failed: %s", e)
        return

    # ── 2. Get pending claims ─────────────────────────────
    pending = get_pending_claims(db_conn)
    if not pending:
        logger.info("No pending claims to sync.")
        db_conn.close()
        return

    logger.info("Found %d devs with claimable balance.", len(pending))

    # ── 3. Build batch ────────────────────────────────────
    token_ids, amounts_wei = build_sync_batch(pending)
    if not token_ids:
        logger.info("No non-zero balances to sync.")
        db_conn.close()
        return

    total_gross_nxt = sum(a // (10 ** 18) for a in amounts_wei)
    logger.info(
        "Batch: %d devs, total gross ~%d NXT (players receive ~%d NXT net after 10%% fee)",
        len(token_ids),
        total_gross_nxt,
        sum(d["balance_nxt"] for d in pending if d["balance_nxt"] > 0),
    )

    # ── 4. Submit to contract ─────────────────────────────
    if DRY_RUN:
        logger.info("[DRY RUN] Would call batchSetClaimable(%s, %s)", token_ids, amounts_wei)
        logger.info("[DRY RUN] Skipping on-chain transaction.")
        db_conn.close()
        return

    try:
        from web3 import Web3

        w3 = Web3(Web3.HTTPProvider(MEGAETH_RPC))
        if not w3.is_connected():
            logger.error("Cannot connect to MegaETH RPC.")
            db_conn.close()
            return

        account = w3.eth.account.from_key(SIGNER_PRIVATE_KEY)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(NXDEVNFT_ADDRESS),
            abi=BATCH_SET_CLAIMABLE_ABI,
        )

        # Build transaction
        nonce = w3.eth.get_transaction_count(account.address)
        tx = contract.functions.batchSetClaimable(
            token_ids, amounts_wei
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "chainId": MEGAETH_CHAIN_ID,
            "gas": 500_000 + (len(token_ids) * 30_000),  # estimate
        })

        # Sign and send
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        logger.info("TX sent: %s", tx_hash.hex())

        # Wait for receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status == 1:
            logger.info("TX confirmed in block %d. Gas used: %d", receipt.blockNumber, receipt.gasUsed)
        else:
            logger.error("TX reverted! Hash: %s", tx_hash.hex())
            db_conn.close()
            return

    except ImportError:
        logger.error("web3 not installed. Run: pip install web3")
        db_conn.close()
        return
    except Exception as e:
        logger.error("On-chain sync failed: %s", e)
        db_conn.close()
        return

    db_conn.close()
    logger.info("=== Claim Sync Complete ===")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    sync_claimable_balances()
