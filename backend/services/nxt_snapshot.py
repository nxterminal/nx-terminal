"""NXT holder balance snapshot — periodic on-chain pull.

Every 5 min the engine calls `run_nxt_snapshot_tick(conn)`. The tick:

  1. Lists every distinct `owner_address` from devs (anyone holding an
     aNFT is also a candidate $NXT holder).
  2. Calls `balanceOf(wallet)` on NXTToken via eth_call, parallelised
     through a small thread pool (sync `requests` + ThreadPoolExecutor)
     so we don't pay N × RPC-latency sequentially.
  3. UPSERTs the (wallet, balance, updated_at) tuple into
     nxt_holder_snapshot.

Design notes:

  - NO Multicall3. The standard `0xcA11bde0…` address is deployed on
    most EVM chains, but we haven't confirmed it on MegaETH mainnet
    and a silent revert here would zero every balance in the snapshot.
    Thread-pooled eth_call is slower but correct from day one. If we
    later confirm Multicall3, this is an easy upgrade.

  - balanceOf is read-only — no nonce, no gas concerns. The only
    failure mode is RPC flakiness; per-wallet errors are logged and
    the wallet's previous snapshot row stays as-is (last good value).

  - NUMERIC(78,0) in DB; Python int (arbitrary precision) on the way
    in. We never round, truncate, or pass through float.
"""

from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor

import requests

log = logging.getLogger("nx_engine")


# MegaETH mainnet. Same env var as the engine's fund reconciler so
# both share a single RPC override surface.
_RPC_URL = os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc")

# NXTToken ERC-20.
_NXT_TOKEN = "0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47"

# `balanceOf(address)` selector — first 4 bytes of keccak256
# ("balanceOf(address)"). Hard-coded so we don't drag a keccak dep
# in for a single value.
_BALANCE_OF_SELECTOR = "0x70a08231"

# Concurrency cap on the RPC fan-out. Tuned conservatively: 10 ×
# (~150ms RPC) ≈ 1.5s for 100 holders, comfortably inside the 5-min
# tick budget. Pushing this higher risks tripping per-IP rate limits
# on the public RPC.
_MAX_RPC_CONCURRENCY = 10

# Per-call timeout. balanceOf shouldn't ever take more than ~1s; 8s
# gives slack for cold connections without letting a stuck call
# stall the whole batch.
_RPC_TIMEOUT_SEC = 8.0


def _wallets_from_devs(cur) -> list[str]:
    """Return every distinct lower-cased wallet that owns at least one
    Dev. Anything else (no aNFT, no $NXT exposure we care about) is
    out of scope for this snapshot."""
    cur.execute(
        "SELECT DISTINCT LOWER(owner_address) AS w "
        "FROM devs "
        "WHERE owner_address IS NOT NULL AND owner_address <> ''"
    )
    rows = cur.fetchall() or []
    # RealDictCursor returns dicts; default cursor returns tuples. Be
    # defensive — the engine's get_db() is RealDict, but the test
    # StubCursor is tuple-y.
    out: list[str] = []
    for r in rows:
        if isinstance(r, dict):
            w = r.get("w")
        else:
            w = r[0]
        if w:
            out.append(w.lower())
    return out


def _encode_balance_of_calldata(wallet: str) -> str:
    """Build the 4+32 byte calldata for balanceOf(address). The
    address is left-padded with zeros to 32 bytes per ABI rules."""
    addr = wallet.lower().removeprefix("0x")
    if len(addr) != 40:
        raise ValueError(f"bad wallet length: {wallet!r}")
    return _BALANCE_OF_SELECTOR + ("0" * 24) + addr


def _fetch_balance(wallet: str) -> tuple[str, int | None]:
    """Single eth_call. Returns (wallet, balance_or_None). None on
    any RPC error / bad response — caller skips the upsert so the
    last-known snapshot row is preserved."""
    try:
        calldata = _encode_balance_of_calldata(wallet)
    except ValueError as e:
        log.warning("[nxt_snapshot] %s", e)
        return wallet, None

    payload = {
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [
            {"to": _NXT_TOKEN, "data": calldata},
            "latest",
        ],
        "id": 1,
    }
    try:
        r = requests.post(_RPC_URL, json=payload, timeout=_RPC_TIMEOUT_SEC)
        data = r.json()
    except Exception as e:
        log.info("[nxt_snapshot] eth_call failed wallet=%s err=%s", wallet, e)
        return wallet, None

    if "error" in data:
        log.info("[nxt_snapshot] rpc error wallet=%s err=%s", wallet, data["error"])
        return wallet, None

    raw = data.get("result")
    if not isinstance(raw, str) or not raw.startswith("0x"):
        return wallet, None
    try:
        # uint256 hex → int. Empty / '0x' parses as 0.
        return wallet, int(raw, 16) if raw != "0x" else 0
    except ValueError:
        return wallet, None


def _upsert_snapshot(cur, rows: list[tuple[str, int]]) -> int:
    """UPSERT (wallet, balance) tuples. updated_at refreshes on every
    upsert so the leaderboard "Updated Xmin ago" footer reflects this
    tick's run, not the wallet's first appearance. Returns the count
    upserted."""
    count = 0
    for wallet, balance in rows:
        cur.execute(
            """
            INSERT INTO nxt_holder_snapshot (wallet, balance, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (wallet) DO UPDATE SET
                balance    = EXCLUDED.balance,
                updated_at = EXCLUDED.updated_at
            """,
            (wallet, balance),
        )
        count += 1
    return count


def run_nxt_snapshot_tick(conn) -> int:
    """Engine entry point. Returns the count of wallets upserted.

    Lives on the engine's main loop, called every 5 min (see
    engine.py near the other tick registrations). Catches its own
    exceptions per-wallet so a flaky RPC for ONE address doesn't
    abort the rest of the batch.
    """
    with conn.cursor() as cur:
        wallets = _wallets_from_devs(cur)
    if not wallets:
        return 0

    # Fan out balanceOf calls through a small thread pool. The pool
    # is recreated per tick so it doesn't hold a thread group between
    # ticks (each tick is short — startup cost is negligible).
    results: list[tuple[str, int]] = []
    with ThreadPoolExecutor(max_workers=_MAX_RPC_CONCURRENCY) as pool:
        for wallet, balance in pool.map(_fetch_balance, wallets):
            if balance is not None:
                results.append((wallet, balance))

    if not results:
        log.warning(
            "[nxt_snapshot] tick produced no balances "
            "(wallets=%d, rpc=%s)",
            len(wallets), _RPC_URL,
        )
        return 0

    with conn.cursor() as cur:
        upserted = _upsert_snapshot(cur, results)
    conn.commit()
    log.info(
        "[nxt_snapshot] tick upserted=%d skipped=%d",
        upserted, len(wallets) - len(results),
    )
    return upserted
