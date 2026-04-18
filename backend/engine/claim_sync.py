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

try:
    from backend.services.logging_helpers import log_info, log_warning, log_error
    from backend.services.admin_log import log_event as admin_log_event
    from backend.services.signer import get_signer, SignerError
    from backend.api.middleware.correlation import (
        new_correlation_id,
        set_correlation_id,
        reset_correlation_id,
        get_correlation_id,
        NO_CORRELATION,
    )
except ImportError:  # engine may run standalone without the api package on path
    log_info = log_warning = log_error = None  # type: ignore
    admin_log_event = None  # type: ignore
    get_signer = None  # type: ignore
    SignerError = Exception  # type: ignore
    new_correlation_id = set_correlation_id = reset_correlation_id = None  # type: ignore
    get_correlation_id = None  # type: ignore
    NO_CORRELATION = "no-correlation"  # type: ignore

logger = logging.getLogger(__name__)


def _reset_cid(token) -> None:
    """Reset the correlation id ContextVar if we own the token."""
    if token is not None and reset_correlation_id:
        reset_correlation_id(token)

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
    resp = httpx.post(MEGAETH_RPC, json=payload, timeout=15.0)
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
        WHERE status IN ('active', 'on_mission')
          AND balance_nxt > 0
        ORDER BY token_id
    """
    cursor = db_conn.cursor()
    cursor.execute(query)
    rows = cursor.fetchall()
    # Support both tuple cursors (engine) and RealDictCursor (API pool)
    if rows and isinstance(rows[0], dict):
        return [{"token_id": r["token_id"], "balance_nxt": r["balance_nxt"]} for r in rows]
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
    if admin_log_event:
        admin_log_event(
            cursor,
            event_type="claim_sync_marked",
            payload={
                "synced_token_ids": list(synced_token_ids),
                "count": len(synced_token_ids),
            },
        )
    db_conn.commit()
    logger.info("[CLAIM_SYNC] Marked %d devs as synced (balance_nxt = 0)", len(synced_token_ids))
    if log_info:
        log_info(logger, "claim_sync.marked_synced", count=len(synced_token_ids))


def _send_batch(batch_ids, batch_amounts, wait_for_receipt=True):
    """Build, sign, and send a batchSetClaimableBalance TX.

    Signing + nonce management is delegated to ``SignerService`` so
    concurrent callers never race on the nonce. Returns
    ``(success: bool, tx_hash: str)``.
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

    # 4. Build transaction dict — nonce + from filled by SignerService
    tx = {
        "to": NXDEVNFT_ADDRESS,
        "value": 0,
        "gas": gas_limit,
        "gasPrice": gas_price,
        "chainId": MEGAETH_CHAIN_ID,
        "data": calldata,
    }

    # 5. Sign + send atomically via SignerService (thread-safe, uses
    # "pending" nonce, cached next-nonce prevents race windows).
    if get_signer is None:
        raise RuntimeError("SignerService unavailable in this environment")
    signer = get_signer()
    logger.info("[CLAIM_SYNC] Signing TX with signer %s...", signer.address)
    try:
        send_result = signer.sign_and_send(tx, wait_for_receipt=False)
    except SignerError as exc:
        logger.error("[CLAIM_SYNC] signer send failed: %s", exc)
        if log_error:
            log_error(logger, "claim_sync.signer_send_failed", error=str(exc))
        return False, None

    tx_hash = send_result["tx_hash"]
    nonce_used = send_result["nonce_used"]
    logger.info("[CLAIM_SYNC] TX sent! Hash: %s", tx_hash)
    if log_info:
        log_info(
            logger,
            "claim_sync.tx_sent",
            tx_hash=tx_hash,
            count=len(batch_ids),
            amount_total_wei=sum(batch_amounts),
            nonce=nonce_used,
        )

    if not wait_for_receipt:
        logger.info("[CLAIM_SYNC] TX sent — skipping receipt wait (API fast mode). Hash: %s", tx_hash)
        return True, tx_hash

    # 6. Wait for receipt (poll every 1s, timeout 30s).
    # MegaETH has 10ms blocks — TXs confirm almost instantly.
    logger.info("[CLAIM_SYNC] Waiting for receipt...")
    deadline = time.time() + 30
    receipt = None
    while time.time() < deadline:
        time.sleep(1)
        try:
            receipt = _rpc_call_sync("eth_getTransactionReceipt", [tx_hash])
            if receipt is not None:
                break
        except Exception:
            pass

    if receipt is None:
        logger.warning("[CLAIM_SYNC] TX receipt timeout after 30s (TX may still confirm). Hash: %s", tx_hash)
        return True, tx_hash

    status = int(receipt.get("status", "0x0"), 16)
    block = int(receipt.get("blockNumber", "0x0"), 16)
    gas_used = int(receipt.get("gasUsed", "0x0"), 16)

    if status == 1:
        logger.info("[CLAIM_SYNC] TX CONFIRMED! Block: %d, Gas used: %d, Hash: %s",
                     block, gas_used, tx_hash)
        if log_info:
            log_info(
                logger,
                "claim_sync.tx_confirmed",
                tx_hash=tx_hash,
                block=block,
                gas_used=gas_used,
                count=len(batch_ids),
            )
        return True, tx_hash
    else:
        logger.error("[CLAIM_SYNC] TX REVERTED! Block: %d, Hash: %s", block, tx_hash)
        if log_error:
            log_error(
                logger,
                "claim_sync.tx_reverted",
                tx_hash=tx_hash,
                block=block,
                count=len(batch_ids),
            )
        return False, tx_hash


def sync_claimable_balances(db_conn=None, filter_token_ids=None, wait_for_receipt=True):
    """
    Main sync function. Reads pending claims from DB and submits to contract
    in batches of BATCH_SIZE.

    If db_conn is provided (e.g. from the API pool), uses it instead of
    creating a new connection.  In DRY_RUN mode (default), only logs what
    would be sent.
    """
    # Engine/cron callers have no request scope — mint a correlation id.
    # API callers (force_claim_sync) already have one from the middleware,
    # don't clobber it.
    _cid_token = None
    if set_correlation_id and new_correlation_id and get_correlation_id:
        current = get_correlation_id()
        if not current or current == NO_CORRELATION:
            _cid_token = set_correlation_id(new_correlation_id())

    logger.info("[CLAIM_SYNC] ========================================")
    logger.info("[CLAIM_SYNC] === Claim Sync Started ===")
    logger.info("[CLAIM_SYNC] DRY_RUN = %s", DRY_RUN)
    logger.info("[CLAIM_SYNC] BATCH_SIZE = %d", BATCH_SIZE)
    logger.info("[CLAIM_SYNC] RPC = %s", MEGAETH_RPC)
    logger.info("[CLAIM_SYNC] Contract = %s", NXDEVNFT_ADDRESS)
    if log_info:
        log_info(
            logger,
            "claim_sync.started",
            dry_run=DRY_RUN,
            batch_size=BATCH_SIZE,
        )

    own_conn = db_conn is None  # track if we created the connection

    if not DRY_RUN and not SIGNER_PRIVATE_KEY:
        logger.error("[CLAIM_SYNC] BACKEND_SIGNER_PRIVATE_KEY not set!")
        if log_error:
            log_error(logger, "claim_sync.error_no_signer")
        _reset_cid(_cid_token)
        return "error_no_signer_key"

    if not DRY_RUN:
        signer = get_signer() if get_signer else None
        signer_address = signer.address if signer else Account.from_key(SIGNER_PRIVATE_KEY).address
        logger.info("[CLAIM_SYNC] Signer = %s", signer_address)
        if log_info:
            log_info(logger, "claim_sync.signer_loaded", signer=signer_address)

        # Check signer ETH balance
        try:
            if signer:
                balance_wei = signer.get_eth_balance_wei()
            else:
                balance_hex = _rpc_call_sync("eth_getBalance", [signer_address, "latest"])
                balance_wei = int(balance_hex, 16)
            balance_eth = balance_wei / 10**18
            logger.info("[CLAIM_SYNC] Signer ETH balance: %.6f ETH (%d wei)", balance_eth, balance_wei)
            if log_info:
                log_info(
                    logger,
                    "claim_sync.signer_gas_check",
                    signer=signer_address,
                    balance_wei=balance_wei,
                    balance_eth=f"{balance_eth:.6f}",
                )
            if balance_wei < 10**13:  # < 0.00001 ETH (MegaETH gas is near-zero)
                logger.error("[CLAIM_SYNC] Signer has insufficient ETH for gas! Balance: %.6f ETH", balance_eth)
                if log_error:
                    log_error(
                        logger,
                        "claim_sync.error_no_gas",
                        signer=signer_address,
                        balance_eth=f"{balance_eth:.6f}",
                    )
                _reset_cid(_cid_token)
                return f"error_no_gas: {balance_eth:.6f} ETH"
        except Exception as e:
            logger.error("[CLAIM_SYNC] Failed to check signer balance: %s", e)
            if log_error:
                log_error(logger, "claim_sync.signer_gas_check_failed", error=str(e))

    # -- 1. Connect to DB (only if no connection was passed in) --
    if db_conn is None:
        try:
            import psycopg2
            from urllib.parse import urlparse
            _parsed = urlparse(DATABASE_URL)
            _host = _parsed.hostname or "localhost"
            _is_external = "render.com" in _host
            _sslmode = "require" if _is_external else "prefer"
            db_conn = psycopg2.connect(
                host=_host,
                port=_parsed.port or 5432,
                dbname=(_parsed.path or "").lstrip("/"),
                user=_parsed.username,
                password=_parsed.password,
                sslmode=_sslmode,
                options="-c search_path=nx",
            )
            logger.info("[CLAIM_SYNC] DB connected (host=%s, ssl=%s)", _host, _sslmode)
        except ImportError:
            logger.error("[CLAIM_SYNC] psycopg2 not installed")
            _reset_cid(_cid_token)
            return "error_no_psycopg2"
        except Exception as e:
            logger.error("[CLAIM_SYNC] DB connection failed: %s", e)
            _reset_cid(_cid_token)
            return f"error_db: {e}"
    else:
        logger.info("[CLAIM_SYNC] Using provided DB connection (API pool)")

    # -- 2. Get pending claims --
    try:
        pending = get_pending_claims(db_conn)
    except Exception as e:
        logger.error("[CLAIM_SYNC] Query failed: %s", e)
        if own_conn:
            db_conn.close()
        _reset_cid(_cid_token)
        return f"error_query: {e}"

    if not pending:
        logger.info("[CLAIM_SYNC] No pending claims to sync")
        if own_conn:
            db_conn.close()
        _reset_cid(_cid_token)
        return "no_pending"

    # Filter to specific token IDs if requested (partial claims)
    if filter_token_ids:
        filter_set = set(filter_token_ids)
        pending = [d for d in pending if d["token_id"] in filter_set]
        if not pending:
            logger.info("[CLAIM_SYNC] None of the requested %d token IDs have pending balance", len(filter_set))
            if own_conn:
                db_conn.close()
            _reset_cid(_cid_token)
            return "no_pending"
        logger.info("[CLAIM_SYNC] Filtered to %d of %d requested devs", len(pending), len(filter_set))

    logger.info("[CLAIM_SYNC] Found %d devs with claimable balance", len(pending))

    # -- 3. Build batch --
    token_ids, amounts_wei = build_sync_batch(pending)
    if not token_ids:
        logger.info("[CLAIM_SYNC] No non-zero balances")
        if own_conn:
            db_conn.close()
        _reset_cid(_cid_token)
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
        if own_conn:
            db_conn.close()
        _reset_cid(_cid_token)
        return f"dry_run: {len(token_ids)} devs, {total_nxt} NXT"

    # -- 5. LIVE: Send transactions --
    try:
        # SignerService owns the nonce — no manual fetch needed here.
        total_synced = []
        last_tx_hash = None

        for i in range(0, len(token_ids), BATCH_SIZE):
            chunk_ids = token_ids[i:i + BATCH_SIZE]
            chunk_amounts = amounts_wei[i:i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            total_batches = (len(token_ids) + BATCH_SIZE - 1) // BATCH_SIZE

            logger.info("[CLAIM_SYNC] === Batch %d/%d (%d devs) ===", batch_num, total_batches, len(chunk_ids))

            success, tx_hash = _send_batch(chunk_ids, chunk_amounts, wait_for_receipt=wait_for_receipt)
            last_tx_hash = tx_hash
            if success:
                _mark_synced(db_conn, chunk_ids)
                total_synced.extend(chunk_ids)
                logger.info("[CLAIM_SYNC] Batch %d synced successfully", batch_num)
            else:
                logger.error("[CLAIM_SYNC] Batch %d failed — stopping. %d devs synced so far",
                             batch_num, len(total_synced))
                break

        result = {
            "synced": len(total_synced),
            "total": len(token_ids),
            "tx_hash": last_tx_hash,
            "status": "ok" if len(total_synced) == len(token_ids) else "partial",
        }
        logger.info("[CLAIM_SYNC] === Complete: %s ===", result)
        return result

    except Exception as e:
        logger.error("[CLAIM_SYNC] FATAL ERROR during on-chain sync: %s", e, exc_info=True)
        return f"error: {e}"
    finally:
        if own_conn:
            db_conn.close()
        _reset_cid(_cid_token)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    sync_claimable_balances()
