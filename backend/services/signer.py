"""Thread-safe signing + sending of transactions.

All signing for the NXDevNFT contract goes through a single
``SignerService`` singleton so two concurrent callers never reuse the
same nonce. The ``sign_and_send`` method serialises the RPC-read /
sign / broadcast trio under a ``threading.Lock``; the receipt poll
happens **outside** the lock so one slow confirmation doesn't block
the next signature.

Fixes the two bugs in ``claim_sync.py`` pre-PR 2.3:

1. Nonce was read with ``"latest"`` — in-flight pending txs were not
   counted, so a new call could reuse a nonce from a tx already in
   mempool. Now uses ``"pending"``.
2. No lock between threads — two workers could race inside the 10ms
   between ``eth_getTransactionCount`` and ``eth_sendRawTransaction``.
   Now serialised.

A small cached-next-nonce short-circuits the race where the RPC
doesn't yet reflect a tx we just broadcast (MegaETH's 10ms blocks
are fast but not instant across nodes).
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional

import httpx
from eth_account import Account


logger = logging.getLogger(__name__)


class SignerError(Exception):
    """Raised when signing or sending fails."""


class SignerService:
    """Owns the backend signer's private key and serialises send()s."""

    def __init__(self, private_key: str, rpc_url: str):
        if not private_key:
            raise SignerError("BACKEND_SIGNER_PRIVATE_KEY not configured")
        try:
            self._account = Account.from_key(private_key)
        except Exception as exc:  # noqa: BLE001
            raise SignerError(f"Invalid private key format: {exc}")

        if not rpc_url:
            raise SignerError("RPC URL not configured")

        self._rpc_url = rpc_url
        self._nonce_lock = threading.Lock()
        self._cached_nonce: Optional[int] = None

        logger.info(
            "signer_service.initialized address=%s rpc=%s",
            self._account.address,
            rpc_url,
        )

    # ------------------------------------------------------------------
    # Public, read-only
    # ------------------------------------------------------------------

    @property
    def address(self) -> str:
        return self._account.address

    def get_eth_balance_wei(self) -> int:
        return int(self._rpc_call("eth_getBalance", [self.address, "latest"]), 16)

    def get_nonce(self, block_tag: str = "pending") -> int:
        """Snapshot the on-chain nonce. Does **not** touch the cache."""
        return int(
            self._rpc_call("eth_getTransactionCount", [self.address, block_tag]),
            16,
        )

    # ------------------------------------------------------------------
    # Public, state-mutating
    # ------------------------------------------------------------------

    def sign_and_send(
        self,
        tx_params: Dict[str, Any],
        *,
        wait_for_receipt: bool = False,
        receipt_timeout: int = 30,
    ) -> Dict[str, Any]:
        """Sign ``tx_params`` and broadcast.

        ``tx_params`` is mutated in place — ``nonce`` and ``from`` are
        filled in by the service. The returned dict has ``tx_hash``,
        ``nonce_used`` and (if requested) ``receipt``.
        """
        with self._nonce_lock:
            nonce = self._get_nonce_locked()
            tx_params["nonce"] = nonce
            tx_params["from"] = self.address

            try:
                signed = self._account.sign_transaction(tx_params)
                raw_tx_hex = "0x" + signed.raw_transaction.hex()
                tx_hash = self._rpc_call(
                    "eth_sendRawTransaction", [raw_tx_hex]
                )
            except Exception as exc:  # noqa: BLE001
                logger.error(
                    "signer_service.send_failed nonce=%s error=%s",
                    nonce, exc,
                )
                raise SignerError(f"Failed to send tx: {exc}")

            # Only advance the cache if the broadcast succeeded — a
            # failed send leaves the nonce free for the next caller.
            self._cached_nonce = nonce + 1
            logger.info(
                "signer_service.tx_sent nonce=%s tx_hash=%s", nonce, tx_hash,
            )

        receipt: Optional[Dict[str, Any]] = None
        if wait_for_receipt:
            receipt = self._wait_receipt(tx_hash, receipt_timeout)

        return {"tx_hash": tx_hash, "receipt": receipt, "nonce_used": nonce}

    def reset_cached_nonce(self) -> None:
        """Drop the cache. Next send re-reads the RPC."""
        with self._nonce_lock:
            self._cached_nonce = None
            logger.info("signer_service.cache_reset")

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _get_nonce_locked(self) -> int:
        """Return max(cached, on-chain pending). Caller must hold the lock."""
        on_chain_pending = int(
            self._rpc_call(
                "eth_getTransactionCount", [self.address, "pending"]
            ),
            16,
        )
        if self._cached_nonce is None:
            return on_chain_pending
        return max(self._cached_nonce, on_chain_pending)

    def _rpc_call(self, method: str, params: List[Any], timeout: float = 15.0) -> Any:
        try:
            resp = httpx.post(
                self._rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                timeout=timeout,
            )
            data = resp.json()
        except httpx.TimeoutException:
            raise SignerError(f"RPC timeout on {method}")
        except Exception as exc:  # noqa: BLE001
            raise SignerError(f"RPC call failed: {exc}")
        if "error" in data:
            raise SignerError(f"RPC error: {data['error']}")
        return data.get("result")

    def _wait_receipt(
        self, tx_hash: str, timeout: int
    ) -> Optional[Dict[str, Any]]:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                receipt = self._rpc_call(
                    "eth_getTransactionReceipt", [tx_hash]
                )
                if receipt:
                    return receipt
            except SignerError:
                pass  # transient — retry
            time.sleep(1.0)
        return None


# ----------------------------------------------------------------------
# Singleton accessor
# ----------------------------------------------------------------------

_signer_instance: Optional[SignerService] = None
_signer_init_lock = threading.Lock()


def get_signer() -> SignerService:
    """Lazily construct the process-wide signer from env vars."""
    global _signer_instance
    if _signer_instance is None:
        with _signer_init_lock:
            if _signer_instance is None:
                _signer_instance = SignerService(
                    private_key=os.getenv("BACKEND_SIGNER_PRIVATE_KEY", ""),
                    rpc_url=os.getenv(
                        "CLAIM_SYNC_RPC_URL",
                        os.getenv(
                            "MEGAETH_RPC_URL",
                            "https://mainnet.megaeth.com/rpc",
                        ),
                    ),
                )
    return _signer_instance


def reset_signer() -> None:
    """Drop the singleton. Test-only."""
    global _signer_instance
    _signer_instance = None
