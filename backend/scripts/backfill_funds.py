"""
NX TERMINAL — Fund Dev Backfill Script

Scans the NXT token contract for ERC-20 Transfer events into the treasury
wallet, finds tx hashes that are NOT yet recorded in funding_txs, and credits
the corresponding dev's in-game balance.

Context
-------
The /shop/fund endpoint used to fail with "Transaction not found or not yet
confirmed" when the backend RPC node had not yet indexed the receipt. Users
who hit this path signed a valid on-chain Transfer but the backend never
wrote a funding_txs row or credited devs.balance_nxt.

This script reconciles those orphans using the same verification rules the
live endpoint uses:
  - Transfer's `to` must equal the treasury
  - `from` must be the wallet of a known dev owner
  - The tx_hash must not already be in funding_txs (dedupe)
  - We credit using the exact on-chain amount, not a user-provided one

Usage
-----
  # Scan a wide recent window and auto-credit orphans whose sender wallet
  # owns exactly one dev (safe 1-dev heuristic — the most common test case).
  python backend/scripts/backfill_funds.py

  # Dry run: print what would be credited, don't touch the DB.
  python backend/scripts/backfill_funds.py --dry-run

  # Explicit block range (takes precedence over --window-blocks).
  python backend/scripts/backfill_funds.py --from-block 1000000 --to-block 2000000

  # Widen the scan window (in blocks) from the chain head.
  python backend/scripts/backfill_funds.py --window-blocks 10000000

  # Credit a specific tx to a specific dev — does NOT need any scan.
  # Re-verifies on-chain first. Use this when the 1-dev heuristic can't
  # decide, or when you already have the hash from the tester's wallet.
  python backend/scripts/backfill_funds.py --tx 0xABC... --dev 42

  # Quick RPC smoke test — fetches one tx receipt and prints its logs.
  python backend/scripts/backfill_funds.py --verify-rpc 0xABC...

Env
---
  MEGAETH_RPC_URL   — RPC endpoint (default: https://mainnet.megaeth.com/rpc)
  DATABASE_URL      — Postgres connection string (same as API)
  NX_DB_SCHEMA      — schema (default: nx, same as API)
"""

import argparse
import json
import logging
import os
import sys
import time

import requests

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("psycopg2 is required. Install with `pip install psycopg2-binary`.")

# Ledger shadow write (Fase 3D). Optional — script can run even if
# the backend.services package isn't on the path, since this file is
# meant to be invoked standalone for ops backfills.
try:
    from backend.services.ledger import (
        LedgerSource,
        is_shadow_write_enabled,
        ledger_insert,
        tx_hash_to_bigint,
    )
except ImportError:
    LedgerSource = None  # type: ignore
    is_shadow_write_enabled = lambda: False  # type: ignore
    ledger_insert = None  # type: ignore
    tx_hash_to_bigint = None  # type: ignore

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

DB_SCHEMA = os.getenv("NX_DB_SCHEMA", "nx")

# eth_getLogs has per-request block-range limits that vary between nodes.
# Start at a reasonable chunk and shrink automatically on RPC errors.
LOG_CHUNK_BLOCKS_INITIAL = 10_000
LOG_CHUNK_BLOCKS_MIN = 500

# MegaETH has sub-second blocks, so a recent orphan could be millions of
# blocks deep even within the same day. Err on the side of wide.
DEFAULT_WINDOW_BLOCKS = 5_000_000


# ─── DB connection (direct, no pool — this is a standalone script) ──────

def get_connection():
    """Open a direct psycopg2 connection. The API's get_db() requires an
    initialized pool, which doesn't exist in script mode."""
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit(
            "DATABASE_URL is not set. Export it to the same value the API uses "
            "(see Render dashboard or backend/api/deps.py)."
        )
    conn = psycopg2.connect(
        dsn,
        cursor_factory=psycopg2.extras.RealDictCursor,
        options=f"-c search_path={DB_SCHEMA}",
    )
    conn.autocommit = False
    return conn


# ─── JSON-RPC helpers ────────────────────────────────────────────────────

def rpc(method, params=None, raise_on_error=True):
    """POST a JSON-RPC call to the configured MegaETH endpoint.

    When raise_on_error is False the caller gets (result, error) so chunk
    sizing can adapt instead of aborting the whole scan."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}
    try:
        resp = requests.post(RPC_URL, json=payload, timeout=60)
        resp.raise_for_status()
    except requests.RequestException as exc:
        if raise_on_error:
            raise
        return None, str(exc)
    data = resp.json()
    if "error" in data:
        err = data["error"]
        msg = err.get("message") if isinstance(err, dict) else str(err)
        if raise_on_error:
            raise RuntimeError(f"RPC error on {method}: {msg}")
        return None, msg
    return data.get("result"), None


def get_head_block():
    result, _ = rpc("eth_blockNumber")
    return int(result, 16)


def get_receipt(tx_hash):
    result, _ = rpc("eth_getTransactionReceipt", [tx_hash])
    return result


def pad_addr_topic(addr):
    """0x… address → 32-byte padded topic."""
    return "0x" + "0" * 24 + addr.lower().removeprefix("0x")


def get_logs_range(from_block, to_block):
    """One eth_getLogs call for a specific range. Returns (logs, error)."""
    params = [{
        "fromBlock": hex(from_block),
        "toBlock": hex(to_block),
        "address": NXT_TOKEN,
        "topics": [TRANSFER_TOPIC, None, pad_addr_topic(TREASURY)],
    }]
    return rpc("eth_getLogs", params, raise_on_error=False)


def fetch_transfer_logs(from_block, to_block):
    """Return every ERC-20 Transfer event on NXT_TOKEN whose destination is
    the treasury in [from_block, to_block]. Adaptive chunking: starts at
    LOG_CHUNK_BLOCKS_INITIAL and halves on any RPC error until it hits
    LOG_CHUNK_BLOCKS_MIN — useful because different nodes enforce different
    per-request block-range limits.
    """
    logs = []
    start = from_block
    chunk = LOG_CHUNK_BLOCKS_INITIAL
    total = to_block - from_block + 1
    log.info(
        "Scanning %d total blocks (%d → %d) with initial chunk=%d",
        total, from_block, to_block, chunk,
    )

    while start <= to_block:
        end = min(start + chunk - 1, to_block)
        result, err = get_logs_range(start, end)
        if err is not None:
            # Halve and retry the same start, unless we're already at min.
            if chunk > LOG_CHUNK_BLOCKS_MIN:
                new_chunk = max(LOG_CHUNK_BLOCKS_MIN, chunk // 2)
                log.warning(
                    "  RPC error in %d-%d (%s) — shrinking chunk %d → %d and retrying",
                    start, end, err[:120], chunk, new_chunk,
                )
                chunk = new_chunk
                continue
            log.error(
                "  RPC error in %d-%d at minimum chunk %d (%s) — skipping range",
                start, end, chunk, err[:200],
            )
            start = end + 1
            continue

        count = len(result or [])
        if count:
            log.info("  blocks %d-%d: %d Transfer events", start, end, count)
            logs.extend(result)
        else:
            # Only log every ~10 chunks when empty to avoid flooding.
            pct = (end - from_block) * 100 // max(1, total)
            if end == to_block or pct % 10 == 0:
                log.info("  blocks %d-%d: 0 events (scan %d%% complete)", start, end, pct)
        start = end + 1
        time.sleep(0.05)  # gentle on the public RPC

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
    Mirrors the successful-path logic in shop.py."""
    cur.execute(
        """INSERT INTO funding_txs (wallet_address, dev_token_id, amount_nxt, tx_hash, verified)
           VALUES (%s, %s, %s, %s, true)""",
        (wallet.lower(), dev_token_id, amount_nxt, tx_hash.lower()),
    )
    cur.execute(
        "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s WHERE token_id = %s",
        (amount_nxt, amount_nxt, dev_token_id),
    )

    # Shadow-write to nxt_ledger (Fase 3D). Use ref_table="funding_txs"
    # so a tx that the live shop.fund_dev path also processed produces
    # a colliding idempotency_key — second writer is a silent no-op.
    # Source is BACKFILL_MANUAL so the row is still distinguishable
    # in audit reports as "credited by ops backfill".
    if is_shadow_write_enabled() and ledger_insert is not None and tx_hash_to_bigint is not None:
        try:
            ledger_insert(
                cur,
                wallet_address=wallet,
                dev_token_id=dev_token_id,
                delta_nxt=amount_nxt,
                source=LedgerSource.BACKFILL_MANUAL,
                ref_table="funding_txs",
                ref_id=tx_hash_to_bigint(tx_hash),
            )
        except Exception as _e:  # noqa: BLE001
            log.warning(
                "ledger_shadow_write_failed source=backfill_manual "
                "tx_hash=%s error=%s",
                tx_hash, _e,
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

    conn = get_connection()
    try:
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
                conn.rollback()
                return True

            credit_fund(
                cur, tx_from, dev_token_id, amount_nxt, tx_hash,
                dev["name"], dev["archetype"],
            )
            conn.commit()
            log.info(
                "  CREDITED dev #%d (%s) with %d $NXT from %s",
                dev_token_id, dev["name"], amount_nxt, tx_hash,
            )
            return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def scan_and_backfill(from_block, to_block, dry_run):
    log.info("Using RPC %s", RPC_URL)
    log.info("NXT_TOKEN = %s", NXT_TOKEN)
    log.info("TREASURY  = %s", TREASURY)

    logs = fetch_transfer_logs(from_block, to_block)
    log.info("Total Transfer events to treasury in window: %d", len(logs))
    if logs:
        first = logs[0]
        log.info(
            "First hit: block %s, tx %s",
            int(first.get("blockNumber", "0x0"), 16),
            first.get("transactionHash"),
        )

    credited = 0
    skipped_already = 0
    skipped_ambiguous = 0
    skipped_unknown_wallet = 0

    conn = get_connection()
    try:
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

        if dry_run:
            conn.rollback()
        else:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    log.info("---- BACKFILL SUMMARY ----")
    log.info("Credited:            %d", credited)
    log.info("Already recorded:    %d", skipped_already)
    log.info("Ambiguous (>1 dev):  %d  (need manual --tx/--dev)", skipped_ambiguous)
    log.info("Unknown wallet:      %d  (sender owns no devs)", skipped_unknown_wallet)
    if dry_run:
        log.info("Dry run — no rows were written.")


def verify_rpc_tx(tx_hash):
    """Smoke test: fetch one tx receipt, pretty-print its logs. Use when
    the scan returns zero events and you want to confirm the RPC is working
    and the tx is visible from this endpoint."""
    log.info("Using RPC %s", RPC_URL)
    log.info("Fetching receipt for %s …", tx_hash)
    receipt = get_receipt(tx_hash)
    if not receipt:
        log.error("  null receipt — RPC does not know this tx")
        return False
    log.info("  block: %s (decimal %d)", receipt.get("blockNumber"),
             int(receipt.get("blockNumber", "0x0"), 16))
    log.info("  status: %s", receipt.get("status"))
    log.info("  from: %s", receipt.get("from"))
    log.info("  to: %s", receipt.get("to"))
    logs_ = receipt.get("logs") or []
    log.info("  %d log entries", len(logs_))
    for i, entry in enumerate(logs_):
        topics = entry.get("topics") or []
        log.info("  log[%d] addr=%s topics=%s data=%s",
                 i, entry.get("address"), topics, entry.get("data", "")[:80])
    return True


# ─── Entry point ─────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Backfill orphaned NXT Transfer events into funding_txs.")
    ap.add_argument("--dry-run", action="store_true", help="Scan only, do not write to the database.")
    ap.add_argument("--window-blocks", type=int, default=DEFAULT_WINDOW_BLOCKS,
                    help=f"How many blocks back from head to scan (default: {DEFAULT_WINDOW_BLOCKS}).")
    ap.add_argument("--from-block", type=int, help="Explicit start block (overrides --window-blocks).")
    ap.add_argument("--to-block", type=int, help="Explicit end block (default: chain head).")
    ap.add_argument("--tx", help="Explicit tx hash to credit (requires --dev).")
    ap.add_argument("--dev", type=int, help="Dev token id to credit (used with --tx).")
    ap.add_argument("--verify-rpc", metavar="TX_HASH",
                    help="Smoke test: fetch one tx receipt and print its logs, then exit.")
    args = ap.parse_args()

    if args.verify_rpc:
        ok = verify_rpc_tx(args.verify_rpc)
        sys.exit(0 if ok else 1)

    if args.tx or args.dev:
        if not (args.tx and args.dev is not None):
            ap.error("--tx and --dev must be provided together")
        ok = credit_specific_tx(args.tx, args.dev, args.dry_run)
        sys.exit(0 if ok else 1)

    head = get_head_block()
    if args.from_block is not None:
        from_block = args.from_block
        to_block = args.to_block if args.to_block is not None else head
    else:
        to_block = args.to_block if args.to_block is not None else head
        from_block = max(0, to_block - args.window_blocks)

    log.info("Chain head: %d", head)
    scan_and_backfill(from_block, to_block, args.dry_run)


if __name__ == "__main__":
    main()
