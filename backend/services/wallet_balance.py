"""Wallet-level NXT debit helper for NXMARKET.

Most NXT-moving endpoints target a single ``devs.token_id`` (one dev pays
one fee, one claim credits one dev). NXMARKET's market-creation fee is
different: it's a wallet-level charge and the wallet may hold several
devs each with a partial balance.

``debit_wallet_balance`` walks the owner's devs in descending balance
order, locking each row with ``FOR UPDATE`` so two concurrent buys from
the same wallet can't double-spend the same dev. It updates
``balance_nxt`` and emits one ``nxt_ledger`` row per affected dev (in
shadow mode).

Matches the insert-ref / update-balance / shadow-insert ordering used
by ``shop.py::fund_dev``.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from backend.services.ledger import (
    LedgerSource,
    is_shadow_write_enabled,
    ledger_insert,
)

log = logging.getLogger(__name__)


class InsufficientBalanceError(ValueError):
    """Raised when the wallet's devs don't cover ``amount_nxt`` in total."""


def debit_wallet_balance(
    cursor,
    wallet_address: str,
    amount_nxt: int,
    ledger_source: str,
    ref_table: str,
    ref_id: int,
) -> List[dict]:
    """Debit ``amount_nxt`` NXT from the wallet, spread across its devs.

    Order: largest balance first. Each affected dev gets a single UPDATE
    and a single shadow ledger row (when ``LEDGER_SHADOW_WRITE`` is on).
    Participates in the caller's transaction.

    Returns a list like ``[{"dev_token_id": 42, "amount": 300}, ...]``.
    """
    if amount_nxt <= 0:
        raise ValueError(f"amount_nxt must be positive, got {amount_nxt!r}")
    if not LedgerSource.is_valid(ledger_source):
        raise ValueError(f"Invalid ledger_source: {ledger_source!r}")

    wallet = wallet_address.lower()

    cursor.execute(
        """
        SELECT token_id, balance_nxt
          FROM devs
         WHERE LOWER(owner_address) = %s
           AND balance_nxt > 0
         ORDER BY balance_nxt DESC, token_id ASC
         FOR UPDATE
        """,
        (wallet,),
    )
    rows = cursor.fetchall()

    total = 0
    normalised: List[tuple] = []
    for r in rows:
        if isinstance(r, dict):
            tid = int(r["token_id"])
            bal = int(r["balance_nxt"])
        else:
            tid, bal = int(r[0]), int(r[1])
        total += bal
        normalised.append((tid, bal))

    if total < amount_nxt:
        raise InsufficientBalanceError(
            f"insufficient balance: have {total}, need {amount_nxt}"
        )

    remaining = amount_nxt
    debited: List[dict] = []
    shadow = is_shadow_write_enabled()

    for tid, bal in normalised:
        if remaining <= 0:
            break
        take = bal if bal <= remaining else remaining
        # Shadow-write first so ``_current_balance`` sees the pre-UPDATE
        # row and records ``balance_after = pre - take`` (i.e. the
        # post-UPDATE balance). Calling it AFTER the UPDATE would
        # double-subtract and fail the CHECK (balance_after >= 0)
        # whenever we drain a dev to zero.
        if shadow:
            try:
                ledger_insert(
                    cursor,
                    wallet_address=wallet,
                    dev_token_id=tid,
                    delta_nxt=-take,
                    source=ledger_source,
                    ref_table=ref_table,
                    ref_id=ref_id,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "ledger_shadow_write_failed source=%s dev=%s err=%s",
                    ledger_source,
                    tid,
                    exc,
                )
        cursor.execute(
            "UPDATE devs SET balance_nxt = balance_nxt - %s WHERE token_id = %s",
            (take, tid),
        )
        debited.append({"dev_token_id": tid, "amount": take})
        remaining -= take

    if remaining > 0:  # pragma: no cover — guarded by the total check above
        raise InsufficientBalanceError(
            f"logic error: {remaining} NXT unallocated after walk"
        )

    return debited
