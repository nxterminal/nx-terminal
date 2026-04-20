"""Append-only economic ledger (Fase 3A — infrastructure only).

Every money-moving callsite **will** be migrated in Fases 3B/3C/3D
to call ``ledger_insert`` alongside its existing UPDATE on
``devs.balance_nxt``. During shadow mode the ledger is purely
observational — the real source of truth stays on ``devs.balance_nxt``
until reconciliation has been clean for two weeks.

The helper enforces:

- delta_nxt != 0          (CHECK constraint mirrored in code)
- balance_after >= 0      (CHECK constraint mirrored in code)
- source ∈ LedgerSource   (closed enum)
- wallet format: 0x + 40 hex
- idempotency via UNIQUE(idempotency_key)

Conventions:
- delta_nxt > 0 → credit (NXT in)
- delta_nxt < 0 → debit  (NXT out)
"""

from __future__ import annotations

import logging
import os
from typing import Iterable, Optional

from backend.api.middleware.correlation import (
    NO_CORRELATION,
    get_correlation_id,
)


logger = logging.getLogger(__name__)


def is_shadow_write_enabled() -> bool:
    """Feature flag for shadow writes from economic callsites.

    Default: enabled. Set ``LEDGER_SHADOW_WRITE=false`` in env for
    instant rollback without a code change.
    """
    return os.getenv("LEDGER_SHADOW_WRITE", "true").lower() != "false"


def tx_hash_to_bigint(tx_hash: str) -> int:
    """Derive a stable BIGINT from a 0x-prefixed 32-byte tx hash.

    Used when a callsite doesn't have a natural DB id to put in
    ``ref_id`` but does have a transaction hash. Takes the first
    15 hex characters after ``0x`` (60 bits) — fits in BIGINT,
    collision probability is astronomical for the volumes we process.
    """
    if not tx_hash:
        raise ValueError("tx_hash must be non-empty")
    clean = tx_hash.lower().lstrip("0x")
    if len(clean) < 15:
        raise ValueError(f"tx_hash too short: {tx_hash!r}")
    return int(clean[:15], 16)


class LedgerSource:
    """Closed enum of allowed ``source`` values for ``nxt_ledger``."""

    SALARY = "salary"
    MISSION_CLAIM = "mission_claim"
    ACHIEVEMENT_CLAIM = "achievement_claim"
    STREAK_CLAIM = "streak_claim"
    HACK_MAINFRAME_WIN = "hack_mainframe_win"
    HACK_MAINFRAME_COST = "hack_mainframe_cost"
    HACK_RAID_ATTACKER_WIN = "hack_raid_attacker_win"
    HACK_RAID_TARGET_LOSS = "hack_raid_target_loss"
    HACK_RAID_ATTACKER_LOSS = "hack_raid_attacker_loss"
    HACK_RAID_TARGET_WIN = "hack_raid_target_win"
    HACK_RAID_COST = "hack_raid_cost"
    TRANSFER_OUT = "transfer_out"
    TRANSFER_IN = "transfer_in"
    SHOP_PURCHASE = "shop_purchase"
    FUND_DEPOSIT = "fund_deposit"
    SELL_INVESTMENT = "sell_investment"
    CLAIM_ONCHAIN = "claim_onchain"
    BACKFILL_MANUAL = "backfill_manual"
    # Unconditional cost deductions that fire before the hack
    # success/fail roll. Both are debits from the attacker and are
    # independent of outcome — so they live in the ledger alongside
    # the outcome row(s) sharing the same ref_id.
    #   HACK_MAINFRAME_COST — attempts against the corporate mainframe
    #   HACK_RAID_COST      — attempts against another player's dev
    # NXMARKET — Fase 1 foundation (PR 1). Buy/sell/payout/commission
    # sources are reserved for PR 2 and PR 3 to avoid dead strings.
    NXMARKET_SEED_MINTED = "nxmarket_seed_minted"
    NXMARKET_CREATION_FEE = "nxmarket_creation_fee"

    @classmethod
    def all_sources(cls) -> Iterable[str]:
        for k, v in cls.__dict__.items():
            if not k.startswith("_") and isinstance(v, str):
                yield v

    @classmethod
    def is_valid(cls, source: str) -> bool:
        return source in set(cls.all_sources())


_WALLET_PREFIX = "0x"
_WALLET_LEN = 42


def _normalised_wallet(addr: str) -> str:
    if not addr or not isinstance(addr, str):
        raise ValueError(f"Invalid wallet_address: {addr!r}")
    if not addr.startswith(_WALLET_PREFIX) or len(addr) != _WALLET_LEN:
        raise ValueError(f"Invalid wallet_address format: {addr!r}")
    return addr.lower()


def _resolve_correlation_id(explicit: Optional[str]) -> Optional[str]:
    if explicit:
        return explicit
    cid = get_correlation_id()
    if not cid or cid == NO_CORRELATION:
        return None
    return cid


def _make_idempotency_key(
    source: str,
    ref_table: Optional[str],
    ref_id: Optional[int],
    dev_token_id: Optional[int],
    delta_nxt: int,
) -> str:
    return ":".join([
        source,
        ref_table or "_",
        str(ref_id or 0),
        str(dev_token_id or 0),
        str(delta_nxt),
    ])


def _current_balance(cursor, wallet: str, dev_token_id: Optional[int]) -> int:
    """Snapshot the current balance for the affected scope.

    If a specific ``dev_token_id`` is provided, return that dev's
    ``balance_nxt``. Otherwise sum across every dev owned by ``wallet``.
    Used only to record ``balance_after`` for debugging — the ledger
    itself doesn't drive the source of truth during shadow mode.
    """
    if dev_token_id is not None:
        cursor.execute(
            "SELECT balance_nxt FROM devs WHERE token_id = %s",
            (dev_token_id,),
        )
    else:
        cursor.execute(
            "SELECT COALESCE(SUM(balance_nxt), 0) AS s FROM devs "
            "WHERE LOWER(owner_address) = %s",
            (wallet,),
        )
    row = cursor.fetchone()
    if row is None:
        return 0
    if isinstance(row, dict):
        # RealDictCursor — pull the only field present.
        return int(next(iter(row.values())) or 0)
    return int(row[0] or 0)


def ledger_insert(
    cursor,
    *,
    wallet_address: str,
    delta_nxt: int,
    source: str,
    ref_table: Optional[str] = None,
    ref_id: Optional[int] = None,
    dev_token_id: Optional[int] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """Insert one row into ``nxt_ledger``. Idempotent by ``idempotency_key``.

    Does **not** touch ``devs.balance_nxt`` — the caller still owns the
    real balance write. The insert participates in the caller's
    transaction (no commit here).

    Returns ``True`` if a new row was written, ``False`` if the same
    ``(source, ref_table, ref_id, dev_token_id, delta_nxt)`` tuple was
    already present.
    """
    if not isinstance(delta_nxt, int):
        raise ValueError(f"delta_nxt must be int, got {type(delta_nxt).__name__}")
    if delta_nxt == 0:
        raise ValueError("delta_nxt must not be zero")
    if not LedgerSource.is_valid(source):
        raise ValueError(f"Invalid source: {source!r}")

    wallet = _normalised_wallet(wallet_address)
    current = _current_balance(cursor, wallet, dev_token_id)
    balance_after = current + delta_nxt
    if balance_after < 0:
        raise ValueError(
            f"Insufficient balance: current={current} + delta={delta_nxt} < 0"
        )

    idem_key = _make_idempotency_key(
        source, ref_table, ref_id, dev_token_id, delta_nxt
    )
    cid = _resolve_correlation_id(correlation_id)

    cursor.execute(
        """
        INSERT INTO nxt_ledger
            (wallet_address, dev_token_id, delta_nxt, balance_after,
             source, ref_table, ref_id, idempotency_key, correlation_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
        """,
        (
            wallet, dev_token_id, delta_nxt, balance_after,
            source, ref_table, ref_id, idem_key, cid,
        ),
    )
    return cursor.fetchone() is not None


def get_ledger_summary_by_wallet(
    cursor,
    wallet_address: str,
    since: Optional[str] = None,
) -> dict:
    """Aggregate the ledger by source for one wallet — debug helper.

    Not used in the hot path; this exists for the admin tools that
    will be added in later phases.
    """
    wallet = _normalised_wallet(wallet_address)

    query = (
        "SELECT source, COUNT(*) AS events_count, "
        "COALESCE(SUM(delta_nxt), 0) AS total_delta, "
        "MIN(created_at) AS first_event, MAX(created_at) AS last_event "
        "FROM nxt_ledger WHERE wallet_address = %s"
    )
    params: list = [wallet]
    if since:
        query += " AND created_at >= %s"
        params.append(since)
    query += " GROUP BY source ORDER BY total_delta DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    by_source = []
    for r in rows:
        if isinstance(r, dict):
            src, n, total, first, last = (
                r["source"], r["events_count"], r["total_delta"],
                r["first_event"], r["last_event"],
            )
        else:
            src, n, total, first, last = r
        by_source.append({
            "source": src,
            "events_count": int(n),
            "total_delta": int(total),
            "first_event": first.isoformat() if first else None,
            "last_event": last.isoformat() if last else None,
        })

    return {
        "wallet": wallet,
        "by_source": by_source,
        "total_delta_all_sources": sum(item["total_delta"] for item in by_source),
    }
