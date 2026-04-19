"""Tests for ``backend.services.signer.SignerService``.

Nothing in these tests touches the network. Each test that exercises
the signing path monkeypatches the instance's ``_rpc_call`` with a
deterministic stub so we can assert on nonce + tx-hash behaviour.
"""

from __future__ import annotations

import sys
import threading
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.signer import (  # noqa: E402
    SignerError,
    SignerService,
    get_signer,
    reset_signer,
)


from eth_utils import to_checksum_address  # noqa: E402

TEST_KEY = "0x" + "11" * 32  # any well-formed 32-byte hex key
TEST_RPC = "http://fake.test/rpc"
TO_ADDR = to_checksum_address("0x" + "bc" * 20)


def _tx():
    """A well-formed tx dict SignerService can pass to sign_transaction."""
    return {
        "to": TO_ADDR,
        "data": "0x",
        "gas": 21000,
        "gasPrice": 10**9,
        "chainId": 4326,
        "value": 0,
    }


def _patch_rpc(monkeypatch, signer, mapping):
    """Install an in-memory dispatcher for ``signer._rpc_call``.

    ``mapping`` is ``{method_name: callable(params) -> result}``.
    """
    calls = []

    def fake(method, params, timeout=15.0):
        calls.append((method, params))
        handler = mapping.get(method)
        if handler is None:
            raise AssertionError(f"unmocked RPC call: {method}")
        return handler(params)

    monkeypatch.setattr(signer, "_rpc_call", fake)
    return calls


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------


def test_signer_initializes_with_valid_key():
    s = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)
    assert s.address.startswith("0x")
    assert len(s.address) == 42


def test_signer_fails_with_empty_key():
    with pytest.raises(SignerError):
        SignerService(private_key="", rpc_url=TEST_RPC)


def test_signer_fails_with_invalid_key_format():
    with pytest.raises(SignerError):
        SignerService(private_key="not-a-key", rpc_url=TEST_RPC)


def test_signer_fails_without_rpc_url():
    with pytest.raises(SignerError):
        SignerService(private_key=TEST_KEY, rpc_url="")


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------


def test_singleton_returns_same_instance(monkeypatch):
    reset_signer()
    monkeypatch.setenv("BACKEND_SIGNER_PRIVATE_KEY", TEST_KEY)
    monkeypatch.setenv("MEGAETH_RPC_URL", TEST_RPC)
    try:
        a = get_signer()
        b = get_signer()
        assert a is b
    finally:
        reset_signer()


# ---------------------------------------------------------------------------
# sign_and_send mechanics
# ---------------------------------------------------------------------------


def test_sign_and_send_completes_tx_params(monkeypatch):
    signer = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)
    _patch_rpc(monkeypatch, signer, {
        "eth_getTransactionCount": lambda p: "0x5",
        "eth_sendRawTransaction": lambda p: "0xaabb",
    })

    tx = _tx()
    result = signer.sign_and_send(tx)

    assert result["nonce_used"] == 5
    assert result["tx_hash"] == "0xaabb"
    assert tx["nonce"] == 5
    assert tx["from"].lower() == signer.address.lower()


def test_sign_and_send_increments_cache_on_success(monkeypatch):
    signer = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)
    _patch_rpc(monkeypatch, signer, {
        # RPC is stale: keeps returning the same starting nonce.
        "eth_getTransactionCount": lambda p: "0x10",
        "eth_sendRawTransaction": lambda p: "0xdead",
    })

    r1 = signer.sign_and_send(_tx())
    r2 = signer.sign_and_send(_tx())
    r3 = signer.sign_and_send(_tx())

    # Even though the RPC never moves off 0x10, the cache advances so
    # each send gets a distinct nonce.
    assert [r1["nonce_used"], r2["nonce_used"], r3["nonce_used"]] == [16, 17, 18]


def test_sign_and_send_does_not_increment_on_send_failure(monkeypatch):
    signer = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)

    def explode(params):
        raise Exception("RPC exploded")

    _patch_rpc(monkeypatch, signer, {
        "eth_getTransactionCount": lambda p: "0x5",
        "eth_sendRawTransaction": explode,
    })

    with pytest.raises(SignerError):
        signer.sign_and_send(_tx())

    # The nonce is still free — a retry should pick the same value.
    # Replace the explode stub with a success to verify.
    _patch_rpc(monkeypatch, signer, {
        "eth_getTransactionCount": lambda p: "0x5",
        "eth_sendRawTransaction": lambda p: "0xok",
    })
    result = signer.sign_and_send(_tx())
    assert result["nonce_used"] == 5


def test_nonce_uses_pending_not_latest(monkeypatch):
    signer = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)
    captured_tags = []

    def fake(method, params, timeout=15.0):
        if method == "eth_getTransactionCount":
            captured_tags.append(params[1])
            return "0x7" if params[1] == "pending" else "0x3"
        if method == "eth_sendRawTransaction":
            return "0xh"
        raise AssertionError(method)

    monkeypatch.setattr(signer, "_rpc_call", fake)

    result = signer.sign_and_send(_tx())

    assert captured_tags == ["pending"]  # only pending was queried
    assert result["nonce_used"] == 7  # used pending (0x7), not latest (0x3)


def test_cached_nonce_wins_over_stale_rpc(monkeypatch):
    signer = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)
    # Prime the cache to 50 — simulate "we already sent some txs the
    # RPC hasn't seen yet".
    signer._cached_nonce = 50

    _patch_rpc(monkeypatch, signer, {
        "eth_getTransactionCount": lambda p: "0x30",  # 48, stale
        "eth_sendRawTransaction": lambda p: "0xh",
    })

    result = signer.sign_and_send(_tx())
    assert result["nonce_used"] == 50


def test_reset_cached_nonce_forces_rpc_reread(monkeypatch):
    signer = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)
    signer._cached_nonce = 99  # pretend we've been running for a while

    _patch_rpc(monkeypatch, signer, {
        "eth_getTransactionCount": lambda p: "0xa",  # 10
        "eth_sendRawTransaction": lambda p: "0xh",
    })

    signer.reset_cached_nonce()
    result = signer.sign_and_send(_tx())
    assert result["nonce_used"] == 10  # honoured the RPC, not the old cache


def test_rpc_timeout_raises_signer_error(monkeypatch):
    signer = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)

    import httpx

    def boom(*a, **kw):
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr("backend.services.signer.httpx.post", boom)

    with pytest.raises(SignerError, match="timeout"):
        signer.get_nonce()


# ---------------------------------------------------------------------------
# The important one: concurrency
# ---------------------------------------------------------------------------


def test_concurrent_sign_and_send_uses_sequential_nonces(monkeypatch):
    """10 threads hammer sign_and_send. Each must get a unique nonce."""
    signer = SignerService(private_key=TEST_KEY, rpc_url=TEST_RPC)

    # Every thread sees the same stale "pending" value from the RPC.
    # Correctness therefore relies entirely on the lock + cache.
    barrier = threading.Barrier(10, timeout=5)

    def fake(method, params, timeout=15.0):
        if method == "eth_getTransactionCount":
            # Force interleaving: every caller waits here before the
            # cache gets bumped, so bugs in the lock are visible.
            try:
                barrier.wait(timeout=0.01)
            except threading.BrokenBarrierError:
                pass
            return "0x2a"  # 42
        if method == "eth_sendRawTransaction":
            return "0xhash"
        raise AssertionError(method)

    monkeypatch.setattr(signer, "_rpc_call", fake)

    results: list = []
    errors: list = []

    def worker():
        try:
            r = signer.sign_and_send(_tx())
            results.append(r["nonce_used"])
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert not errors, f"worker errors: {errors}"
    assert sorted(results) == list(range(42, 52)), (
        f"expected sequential 42..51, got {sorted(results)}"
    )
    assert len(set(results)) == 10, "nonce collision detected"
