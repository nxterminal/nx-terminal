"""
NX TERMINAL: Claimable Balance Sync (Backend -> On-Chain)

Syncs each dev's claimable $NXT balance to the NXDevNFT v9 contract
so players can claim on-chain via claimNXT(tokenIds[]).

Uses httpx + eth_account (NO web3.py dependency).
"""

import os
import logging
import time

import httpx
from eth_account import Account
from eth_abi import encode
from eth_utils import keccak

try:
    from backend.engine.config import DATABASE_URL
except ImportError:
    from config import DATABASE_URL

logger = logging.getLogger(__name__)

# -- Contract addresses (MegaETH Mainnet) --------------------------
NXDEVNFT_ADDRESS = "0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7"
NXT_TOKEN_ADDRESS = "0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47"
MEGAETH_RPC = os.getenv("CLAIM_SYNC_RPC_URL", os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc"))
MEGAETH_CHAIN_ID = 4326

# -- Env config --------------------------------------------------------
SIGNER_PRIVATE_KEY = os.getenv("BACKEND_SIGNER_PRIVATE_KEY", "")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() != "false"
BATCH_SIZE = int(os.getenv("CLAIM_SYNC_BATCH_SIZE", "200"))

# -- Function selector for batchSetClaimableBalance(uint256[],uint256[]) --
BATCH_SET_SELECTOR = keccak(b"batchSetClaimableBalance(uint256[],uint256[])")[:4]


def _rpc_call_sync(method, params):
    """Synchronous JSON-RPC call to MegaETH."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    resp = httpx.post(MEGAETH_RPC, json=payload, timeout=30.0)
    data = resp.json()
    if "error" in data:
        raise Exception(f"RPC error: {data['error']}")
    return data.get("result")


def _build_calldata(token_ids, amounts_wei):
    """Build calldata for batchSetClaimableBalance(uint256[], uint256[])."""
    encoded = encode(
        ["uint256[]", "uint256[]"],
        [token_ids, amounts_wei],
    )
    return BATCH_SET_SELECTOR + encoded


def get_pending_claims(db_conn):
    """Query devs with unsynchronized claimable balance."""
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
    """Build (tokenIds, amounts_wei) arrays for the contract call."""
    token_ids = []
    amounts_wei = []
    for dev in pending_devs:
        balance_nxt = dev["balance_nxt"]
        if balance_nxt <= 0:
            continue
        amount_wei = balance_nxt * (10 ** 18)
        token_ids.append(dev["token_id"])
        amounts_wei.append(amount_wei)
        logger.info("[CLAIM_SYNC] Dev #%d: %d NXT -> %d wei", dev["token_id"], balance_nxt, amount_wei)
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
    logger.info("[CLAIM_SYNC] Marked %d devs as synced (balance_nxt = 0)", len(synced_token_ids))


def _send_batch(account, batch_ids, batch_amounts, nonce):
    """Build, sign, and send a batchSetClaimableBalance TX via raw JSON-RPC.

    Returns (success: bool, tx_hash: str, new_nonce: int).
    """
    # 1. Build calldata
    calldata = _build_calldata(batch_ids, batch_amounts)
    logger.info("[CLAIM_SYNC] Calldata built: %d bytes, selector: 0x%s",
                len(calldata), BATCH_SET_SELECTOR.hex())

    # 2. Estimate gas (or use fixed upper bound)
    gas_limit = 500_000 + (len(batch_ids) * 30_000)

    # 3. Get gas price from RPC
    gas_price_hex = _rpc_call_sync("eth_gasPrice", [])
    gas_price = int(gas_price_hex, 16) if gas_price_hex else 1_000_000_000  # fallback 1 gwei
    logger.info("[CLAIM_SYNC] Gas price: %d wei, gas limit: %d", gas_price, gas_limit)

    # 4. Build transaction dict
    tx = {
        "to": NXDEVNFT_ADDRESS,
        "value": 0,
        "gas": gas_limit,
        "gasPrice": gas_price,
        "nonce": nonce,
        "chainId": MEGAETH_CHAIN_ID,
        "data": calldata,
    }

    # 5. Sign with eth_account
    logger.info("[CLAIM_SYNC] Signing TX with signer %s...", account.address)
    signed = account.sign_transaction(tx)
    raw_tx_hex = "0x" + signed.raw_transaction.hex()
    logger.info("[CLAIM_SYNC] TX signed. Raw TX length: %d bytes", len(signed.raw_transaction))

    # 6. Send via eth_sendRawTransaction
    logger.info("[CLAIM_SYNC] Sending eth_sendRawTransaction...")
    tx_hash = _rpc_call_sync("eth_sendRawTransaction", [raw_tx_hex])
    logger.info("[CLAIM_SYNC] TX sent! Hash: %s", tx_hash)

    # 7. Wait for receipt (poll every 2s, timeout 120s)
    logger.info("[CLAIM_SYNC] Waiting for receipt...")
    deadline = time.time() + 120
    receipt = None
    while time.time() < deadline:
        time.sleep(2)
        try:
            receipt = _rpc_call_sync("eth_getTransactionReceipt", [tx_hash])
            if receipt is not None:
                break
        except Exception:
            pass

    if receipt is None:
        logger.error("[CLAIM_SYNC] TX receipt timeout after 120s. Hash: %s", tx_hash)
        return False, tx_hash, nonce + 1

    status = int(receipt.get("status", "0x0"), 16)
    block = int(receipt.get("blockNumber", "0x0"), 16)
    gas_used = int(receipt.get("gasUsed", "0x0"), 16)

    if status == 1:
        logger.info("[CLAIM_SYNC] TX CONFIRMED! Block: %d, Gas used: %d, Hash: %s",
                     block, gas_used, tx_hash)
        return True, tx_hash, nonce + 1
    else:
        logger.error("[CLAIM_SYNC] TX REVERTED! Block: %d, Hash: %s", block, tx_hash)
        return False, tx_hash, nonce + 1


def sync_claimable_balances():
    """
    Main sync function. Reads pending claims from DB and submits to contract
    in batches of BATCH_SIZE.

    In DRY_RUN mode (default), only logs what would be sent.
    """
    logger.info("[CLAIM_SYNC] ========================================")
    logger.info("[CLAIM_SYNC] === Claim Sync Started ===")
    logger.info("[CLAIM_SYNC] DRY_RUN = %s", DRY_RUN)
    logger.info("[CLAIM_SYNC] BATCH_SIZE = %d", BATCH_SIZE)
    logger.info("[CLAIM_SYNC] RPC = %s", MEGAETH_RPC)
    logger.info("[CLAIM_SYNC] Contract = %s", NXDEVNFT_ADDRESS)

    if not DRY_RUN and not SIGNER_PRIVATE_KEY:
        logger.error("[CLAIM_SYNC] BACKEND_SIGNER_PRIVATE_KEY not set!")
        return "error_no_signer_key"

    if not DRY_RUN:
        account = Account.from_key(SIGNER_PRIVATE_KEY)
        logger.info("[CLAIM_SYNC] Signer = %s", account.address)

        # Check signer ETH balance
        try:
            balance_hex = _rpc_call_sync("eth_getBalance", [account.address, "latest"])
            balance_wei = int(balance_hex, 16)
            balance_eth = balance_wei / 10**18
            logger.info("[CLAIM_SYNC] Signer ETH balance: %.6f ETH (%d wei)", balance_eth, balance_wei)
            if balance_wei < 10**15:  # < 0.001 ETH
                logger.error("[CLAIM_SYNC] Signer has insufficient ETH for gas! Balance: %.6f ETH", balance_eth)
                return f"error_no_gas: {balance_eth:.6f} ETH"
        except Exception as e:
            logger.error("[CLAIM_SYNC] Failed to check signer balance: %s", e)

    # -- 1. Connect to DB --
    try:
        import psycopg2
        db_conn = psycopg2.connect(DATABASE_URL)
        logger.info("[CLAIM_SYNC] DB connected")
    except ImportError:
        logger.error("[CLAIM_SYNC] psycopg2 not installed")
        return "error_no_psycopg2"
    except Exception as e:
        logger.error("[CLAIM_SYNC] DB connection failed: %s", e)
        return f"error_db: {e}"

    # -- 2. Get pending claims --
    try:
        pending = get_pending_claims(db_conn)
    except Exception as e:
        logger.error("[CLAIM_SYNC] Query failed: %s", e)
        db_conn.close()
        return f"error_query: {e}"

    if not pending:
        logger.info("[CLAIM_SYNC] No pending claims to sync")
        db_conn.close()
        return "no_pending"

    logger.info("[CLAIM_SYNC] Found %d devs with claimable balance", len(pending))

    # -- 3. Build batch --
    token_ids, amounts_wei = build_sync_batch(pending)
    if not token_ids:
        logger.info("[CLAIM_SYNC] No non-zero balances")
        db_conn.close()
        return "no_pending"

    total_nxt = sum(a // (10 ** 18) for a in amounts_wei)
    logger.info("[CLAIM_SYNC] Total: %d devs, %d NXT to sync on-chain", len(token_ids), total_nxt)

    # -- 4. DRY RUN --
    if DRY_RUN:
        for i in range(0, len(token_ids), BATCH_SIZE):
            chunk = token_ids[i:i + BATCH_SIZE]
            logger.info("[CLAIM_SYNC][DRY_RUN] Batch %d: %d devs (ids %d..%d)",
                        i // BATCH_SIZE + 1, len(chunk), chunk[0], chunk[-1])
        logger.info("[CLAIM_SYNC][DRY_RUN] Set DRY_RUN=false to enable on-chain writes")
        db_conn.close()
        return f"dry_run: {len(token_ids)} devs, {total_nxt} NXT"

    # -- 5. LIVE: Send transactions --
    try:
        account = Account.from_key(SIGNER_PRIVATE_KEY)
        nonce_hex = _rpc_call_sync("eth_getTransactionCount", [account.address, "latest"])
        nonce = int(nonce_hex, 16)
        logger.info("[CLAIM_SYNC] Starting nonce: %d", nonce)

        total_synced = []

        for i in range(0, len(token_ids), BATCH_SIZE):
            chunk_ids = token_ids[i:i + BATCH_SIZE]
            chunk_amounts = amounts_wei[i:i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            total_batches = (len(token_ids) + BATCH_SIZE - 1) // BATCH_SIZE

            logger.info("[CLAIM_SYNC] === Batch %d/%d (%d devs) ===", batch_num, total_batches, len(chunk_ids))

            success, tx_hash, nonce = _send_batch(account, chunk_ids, chunk_amounts, nonce)
            if success:
                _mark_synced(db_conn, chunk_ids)
                total_synced.extend(chunk_ids)
                logger.info("[CLAIM_SYNC] Batch %d synced successfully", batch_num)
            else:
                logger.error("[CLAIM_SYNC] Batch %d failed — stopping. %d devs synced so far",
                             batch_num, len(total_synced))
                break

        result = f"synced: {len(total_synced)}/{len(token_ids)} devs"
        logger.info("[CLAIM_SYNC] === Complete: %s ===", result)
        return result

    except Exception as e:
        logger.error("[CLAIM_SYNC] FATAL ERROR during on-chain sync: %s", e, exc_info=True)
        return f"error: {e}"
    finally:
        db_conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    sync_claimable_balances()
