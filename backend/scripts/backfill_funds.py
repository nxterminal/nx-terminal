"""
NX TERMINAL — Fund Dev Backfill Script

Scans the NXT token contract for ERC-20 Transfer events into the treasury
wallet, finds tx hashes that are NOT yet recorded in funding_txs, and credits
the corresponding dev's in-game balance.

Context
-------
The /shop/fund endpoint used to fail with "Transaction not found or not yet
confirmed" when the backend RPC node had not yet indexed the receipt (see
shop.py diagnosis). Users who hit this path signed a valid on-chain Transfer
but the backend never wrote a funding_txs row or credited devs.balance_nxt.

This script reconciles those orphans using the same verification rules the
live endpoint uses:
  - Transfer's `to` must equal the treasury
  - `from` must be the wallet of a known dev owner
  - The tx_hash must not already be in funding_txs (dedupe)
  - We credit using the exact on-chain amount, not a user-provided one

Usage
-----
  # Scan the recent chain window and auto-credit orphans whose sender wallet
  # owns exactly one dev (safe 1-dev heuristic — the most common test case).
  python backend/scripts/backfill_funds.py

  # Dry run: print what would be credited, don't touch the DB.
  python backend/scripts/backfill_funds.py --dry-run

  # Widen or narrow the scan window (in blocks) from the chain head.
  python backend/scripts/backfill_funds.py --window-blocks 1000000

  # Credit a specific tx to a specific dev when the 1-dev heuristic can't
  # decide (wallet owns multiple devs). The on-chain tx is still re-verified.
  python backend/scripts/backfill_funds.py --tx 0xABC... --dev 42

Env
---
  MEGAETH_RPC_URL   — RPC endpoint (default: https://mainnet.megaeth.com/rpc)
  DATABASE_URL      — Postgres connection string (same as API)

The script must be run from the repo root so `backend.api.deps` imports work.
It intentionally uses the same `get_db()` connection pool as the API so the
write happens inside nx's search_path.
"""

import argparse
import logging
import os
import sys
import time

import requests

# Allow running as `python backend/scripts/backfill_funds.py` from repo root.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.api.deps import get_db  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("backfill_funds")


# ─── Constants (must match shop.py exactly) ──────────────────────────────

RPC_URL = os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc")
NXT_TOKEN = "0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47".lower()
TREASURY = "0x31d6E19aAE43B5E2fbeDb01b6FF82AD1e8B576DC".lower()
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# eth_getLogs on MegaETH has a practical upper bound on block range per call.
# Chunk aggressively so the scan succeeds even on a long scan window.
LOG_CHUNK_BLOCKS = 50_000

DEFAULT_WINDOW_BLOCKS = 500_000  # ~generous — MegaETH has sub-second blocks


# ─── JSON-RPC helpers ────────────────────────────────────────────────────

def rpc(method, params=None):
    resp = requests.post(
        RPC_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"RPC error on {method}: {data['error']}")
    return data.get("result")


def get_head_block():
    return int(rpc("eth_blockNumber"), 16)


def get_receipt(tx_hash):
    return rpc("eth_getTransactionReceipt", [tx_hash])


def pad_addr_topic(addr):
    """0x… address → 32-byte padded topic."""
    return "0x" + "0" * 24 + addr.lower().removeprefix("0x")


def fetch_transfer_logs(from_block, to_block):
    """Return all ERC-20 Transfer events on NXT_TOKEN targeting the treasury
    in [from_block, to_block]. Chunked into LOG_CHUNK_BLOCKS requests."""
    logs = []
    start = from_block
    while start <= to_block:
        end = min(start + LOG_CHUNK_BLOCKS - 1, to_block)
        log.info(
            "Scanning blocks %d–%d (%d blocks)…",
            start, end, end - start + 1,
        )
        chunk = rpc("eth_getLogs", [{
            "fromBlock": hex(start),
            "toBlock": hex(end),
            "address": NXT_TOKEN,
            "topics": [TRANSFER_TOPIC, None, pad_addr_topic(TREASURY)],
        }])
        if chunk:
            log.info("  → %d Transfer events hit the treasury", len(chunk))
            logs.extend(chunk)
        start = end + 1
        time.sleep(0.1)  # gentle on the public RPC
    return logs


# ─── DB helpers ──────────────────────────────────────────────────────────

def is_tx_already_recorded(cur, tx_hash):
    cur.execute("SELECT 1 FROM funding_txs WHERE tx_hash = %s", (tx_hash.lower(),))
    return cur.fetchone() is not None


def find_devs_owned_by(cur, wallet):
    cur.execute(
        "SELECT token_id, name, archetype FROM devs WHERE owner_address = %s",
        (wallet.lower(),),
    )
    return list(cur.fetchall() or [])


def fetch_dev(cur, token_id):
    cur.execute(
        "SELECT token_id, owner_address, name, archetype FROM devs WHERE token_id = %s",
        (token_id,),
    )
    return cur.fetchone()


def credit_fund(cur, wallet, dev_token_id, amount_nxt, tx_hash, dev_name, archetype):
    """Write funding_txs + bump devs.balance_nxt + log FUND_DEV action.
    Mirrors the successful-path logic in shop.py:864-882."""
    import json  # local to keep top-level imports lean
    cur.execute(
        """INSERT INTO funding_txs (wallet_address, dev_token_id, amount_nxt, tx_hash, verified)
           VALUES (%s, %s, %s, %s, true)""",
        (wallet.lower(), dev_token_id, amount_nxt, tx_hash.lower()),
    )
    cur.execute(
        "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
        (amount_nxt, amount_nxt, dev_token_id),
    )
    cur.execute(
        """INSERT INTO actions (dev_id, dev_name, archetype, action_type, details, energy_cost, nxt_cost)
           VALUES (%s, %s, %s, 'FUND_DEV', %s::jsonb, 0, 0)""",
        (dev_token_id, dev_name, archetype,
         json.dumps({
             "event": "fund_dev",
             "amount": amount_nxt,
             "tx_hash": tx_hash.lower(),
             "source": "backfill_funds.py",
         })),
    )


# ─── Event → credit decisioning ──────────────────────────────────────────

def verify_and_parse_log(log_entry):
    """Extract (from_addr, amount_wei) from an ERC-20 Transfer log whose `to`
    topic is already constrained to the treasury. Returns None on malformed."""
    topics = log_entry.get("topics") or []
    if len(topics) < 3 or topics[0] != TRANSFER_TOPIC:
        return None
    from_addr = "0x" + topics[1][-40:]
    to_addr = "0x" + topics[2][-40:]
    if to_addr.lower() != TREASURY:
        return None
    amount_wei = int(log_entry.get("data", "0x0"), 16)
    return from_addr.lower(), amount_wei


def credit_specific_tx(tx_hash, dev_token_id, dry_run):
    """--tx / --dev explicit path. Verifies the tx on-chain matches the
    fund-endpoint contract and then credits the named dev."""
    if not tx_hash.startswith("0x") or len(tx_hash) != 66:
        log.error("Invalid tx hash: %s", tx_hash)
        return False

    log.info("Verifying %s for dev #%d…", tx_hash, dev_token_id)
    receipt = get_receipt(tx_hash)
    if not receipt:
        log.error("  receipt not found on RPC %s", RPC_URL)
        return False
    if receipt.get("status") != "0x1":
        log.error("  tx reverted on-chain (status != 0x1)")
        return False
    if (receipt.get("to") or "").lower() != NXT_TOKEN:
        log.error("  tx is not a call to NXT_TOKEN")
        return False
    tx_from = (receipt.get("from") or "").lower()

    transfer = None
    for entry in (receipt.get("logs") or []):
        parsed = verify_and_parse_log(entry)
        if parsed and parsed[0] == tx_from:
            transfer = parsed
            break
    if not transfer:
        log.error("  no Transfer event from %s to treasury in this tx", tx_from)
        return False
    _, amount_wei = transfer
    amount_nxt = amount_wei // (10 ** 18)
    if amount_nxt <= 0:
        log.error("  on-chain amount rounds to 0 NXT")
        return False

    with get_db() as conn:
        with conn.cursor() as cur:
            if is_tx_already_recorded(cur, tx_hash):
                log.warning("  tx_hash already in funding_txs — nothing to do")
                return False
            dev = fetch_dev(cur, dev_token_id)
            if not dev:
                log.error("  dev #%d not found", dev_token_id)
                return False
            if dev["owner_address"].lower() != tx_from:
                log.error(
                    "  dev #%d is owned by %s, but tx was signed by %s",
                    dev_token_id, dev["owner_address"], tx_from,
                )
                return False

            if dry_run:
                log.info(
                    "  DRY RUN: would credit dev #%d with %d $NXT from %s",
                    dev_token_id, amount_nxt, tx_hash,
                )
                return True

            credit_fund(
                cur, tx_from, dev_token_id, amount_nxt, tx_hash,
                dev["name"], dev["archetype"],
            )
            log.info(
                "  CREDITED dev #%d (%s) with %d $NXT from %s",
                dev_token_id, dev["name"], amount_nxt, tx_hash,
            )
            return True


def scan_and_backfill(window_blocks, dry_run):
    head = get_head_block()
    from_block = max(0, head - window_blocks)
    log.info("Chain head %d — scanning %d block window from %d", head, window_blocks, from_block)
    logs = fetch_transfer_logs(from_block, head)
    log.info("Total Transfer events to treasury in window: %d", len(logs))

    credited = 0
    skipped_already = 0
    skipped_ambiguous = 0
    skipped_unknown_wallet = 0

    with get_db() as conn:
        with conn.cursor() as cur:
            for entry in logs:
                tx_hash = entry.get("transactionHash", "").lower()
                parsed = verify_and_parse_log(entry)
                if not parsed:
                    continue
                from_addr, amount_wei = parsed
                amount_nxt = amount_wei // (10 ** 18)
                if amount_nxt <= 0:
                    continue

                if is_tx_already_recorded(cur, tx_hash):
                    skipped_already += 1
                    continue

                devs = find_devs_owned_by(cur, from_addr)
                if not devs:
                    skipped_unknown_wallet += 1
                    log.info(
                        "  UNKNOWN: %s sent %d $NXT (tx %s) — wallet owns no devs",
                        from_addr, amount_nxt, tx_hash,
                    )
                    continue
                if len(devs) > 1:
                    skipped_ambiguous += 1
                    log.warning(
                        "  AMBIGUOUS: %s sent %d $NXT (tx %s) but owns %d devs — "
                        "credit manually with --tx %s --dev <id>",
                        from_addr, amount_nxt, tx_hash, len(devs), tx_hash,
                    )
                    for d in devs:
                        log.warning("    candidate dev #%d (%s / %s)", d["token_id"], d["name"], d["archetype"])
                    continue

                dev = devs[0]
                if dry_run:
                    log.info(
                        "  DRY RUN: would credit dev #%d (%s) with %d $NXT from %s (tx %s)",
                        dev["token_id"], dev["name"], amount_nxt, from_addr, tx_hash,
                    )
                else:
                    credit_fund(
                        cur, from_addr, dev["token_id"], amount_nxt, tx_hash,
                        dev["name"], dev["archetype"],
                    )
                    log.info(
                        "  CREDITED dev #%d (%s) with %d $NXT from %s (tx %s)",
                        dev["token_id"], dev["name"], amount_nxt, from_addr, tx_hash,
                    )
                credited += 1

    log.info("---- BACKFILL SUMMARY ----")
    log.info("Credited:            %d", credited)
    log.info("Already recorded:    %d", skipped_already)
    log.info("Ambiguous (>1 dev):  %d  (need manual --tx/--dev)", skipped_ambiguous)
    log.info("Unknown wallet:      %d  (sender owns no devs)", skipped_unknown_wallet)
    if dry_run:
        log.info("Dry run — no rows were written.")


# ─── Entry point ─────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Backfill orphaned NXT Transfer events into funding_txs.")
    ap.add_argument("--dry-run", action="store_true", help="Scan only, do not write to the database.")
    ap.add_argument("--window-blocks", type=int, default=DEFAULT_WINDOW_BLOCKS,
                    help=f"How many blocks back from head to scan (default: {DEFAULT_WINDOW_BLOCKS}).")
    ap.add_argument("--tx", help="Explicit tx hash to credit (requires --dev).")
    ap.add_argument("--dev", type=int, help="Dev token id to credit (used with --tx).")
    args = ap.parse_args()

    if args.tx or args.dev:
        if not (args.tx and args.dev is not None):
            ap.error("--tx and --dev must be provided together")
        ok = credit_specific_tx(args.tx, args.dev, args.dry_run)
        sys.exit(0 if ok else 1)

    scan_and_backfill(args.window_blocks, args.dry_run)


if __name__ == "__main__":
    main()
