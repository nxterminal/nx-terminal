"""Routes: NXMARKET — prediction markets (foundation).

PR 1 scope:
- POST /api/admin/nxmarket/markets  → create official market (admin-gated,
  auto-mints ``seed_nxt`` into the AMM pool; no wallet is debited).
- POST /api/nxmarket/markets        → create user market (500 NXT debit
  from the creator's devs, 5% creator commission at resolve time).
- GET  /api/nxmarket/markets        → list with live LMSR prices.
- GET  /api/nxmarket/markets/{id}   → detail + last 50 trades + 24h price
  history.

Buy/sell endpoints (PR 2) and admin resolve (PR 3) are intentionally
absent.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.api.deps import get_db, validate_wallet
from backend.api.rate_limit import comment_limiter
from backend.api.routes.admin import ADMIN_WALLETS, _require_admin
from backend.services.admin_log import log_event as admin_log_event
from backend.services import lmsr
from backend.services.ledger import LedgerSource
from backend.services.wallet_balance import (
    InsufficientBalanceError,
    NoDevsError,
    credit_wallet_balance,
    debit_wallet_balance,
)


log = logging.getLogger(__name__)


router = APIRouter()
admin_router = APIRouter()


USER_MARKET_CREATION_COST = 500
USER_MARKET_SEED_NXT = 500
USER_MARKET_CREATOR_FEE_PERCENT = Decimal("5")
LIQUIDITY_B_MIN = Decimal("10")
LIQUIDITY_B_MAX = Decimal("10000")
MIN_CLOSE_AT_LEAD = timedelta(hours=1)
# Flat 3% of pool_total collected on every resolve, paid to the
# treasury wallet. Mirrors the treasury constant repeated in
# shop.py / engine.py / backfill_funds.py to avoid a cross-import.
TREASURY_FEE_PERCENT = Decimal("3")
_TREASURY_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class CreateOfficialMarketBody(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    category: Optional[str] = Field(default=None, max_length=40)
    close_at: datetime
    liquidity_b: Decimal
    seed_nxt: Decimal


class CreateUserMarketBody(BaseModel):
    wallet: str
    question: str = Field(..., min_length=3, max_length=500)
    category: Optional[str] = Field(default=None, max_length=40)
    close_at: datetime
    liquidity_b: Decimal


class BuyBody(BaseModel):
    wallet: str
    side: str
    amount_nxt: int = Field(..., ge=1)


class ExitBody(BaseModel):
    wallet: str
    side: str
    shares_to_sell: Decimal


class ResolveBody(BaseModel):
    resolution: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_market_common(liquidity_b: Decimal, close_at: datetime) -> datetime:
    if liquidity_b < LIQUIDITY_B_MIN or liquidity_b > LIQUIDITY_B_MAX:
        raise HTTPException(
            400,
            f"liquidity_b must be between {LIQUIDITY_B_MIN} and {LIQUIDITY_B_MAX}",
        )
    close = close_at
    if close.tzinfo is None:
        close = close.replace(tzinfo=timezone.utc)
    if close < datetime.now(timezone.utc) + MIN_CLOSE_AT_LEAD:
        raise HTTPException(
            400, "close_at must be at least 1 hour in the future"
        )
    return close


def _row_with_prices(row: dict) -> dict:
    out = dict(row)
    prices = lmsr.calculate_price(
        row["shares_yes"], row["shares_no"], row["liquidity_b"]
    )
    out["price_yes"] = float(prices["price_yes"])
    out["price_no"] = float(prices["price_no"])
    for k in ("seed_nxt", "shares_yes", "shares_no", "liquidity_b",
              "total_volume_nxt", "creator_fee_percent"):
        if k in out and out[k] is not None:
            out[k] = float(out[k])
    for k in ("close_at", "resolved_at", "created_at"):
        if k in out and out[k] is not None:
            out[k] = out[k].isoformat()
    return out


# User-market creation cap escalera. Prevents a single wallet from
# flooding the market list and nudges players toward minting more devs.
# Official markets (admin-created) are NOT counted against the cap.
#   0 devs      → 0 markets
#   1-4 devs    → N markets
#   5-19 devs   → 5 markets
#   20+ devs    → unlimited (max_markets=None)
def _calculate_user_market_cap(cur, wallet: str) -> dict:
    w = wallet.lower()
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM devs WHERE LOWER(owner_address) = %s",
        (w,),
    )
    r = cur.fetchone()
    dev_count = int(r["cnt"] if isinstance(r, dict) else r[0] or 0)

    if dev_count == 0:
        max_markets = 0
    elif dev_count < 5:
        max_markets = dev_count
    elif dev_count < 20:
        max_markets = 5
    else:
        max_markets = None

    cur.execute(
        """
        SELECT COUNT(*) AS cnt FROM nxmarket_markets
         WHERE LOWER(created_by) = %s
           AND status = 'active'
           AND market_type = 'user'
        """,
        (w,),
    )
    r = cur.fetchone()
    active_count = int(r["cnt"] if isinstance(r, dict) else r[0] or 0)

    if max_markets is None:
        remaining = None
        can_create = True
    else:
        remaining = max(0, max_markets - active_count)
        can_create = active_count < max_markets

    return {
        "wallet": w,
        "dev_count": dev_count,
        "max_markets": max_markets,
        "active_markets": active_count,
        "remaining": remaining,
        "can_create": can_create,
    }


# ---------------------------------------------------------------------------
# POST /api/admin/nxmarket/markets (official)
# ---------------------------------------------------------------------------


@admin_router.post("/markets")
def create_official_market(body: CreateOfficialMarketBody, request: Request):
    admin_wallet = _require_admin(request)

    close_at = _validate_market_common(body.liquidity_b, body.close_at)
    if body.seed_nxt <= 0:
        raise HTTPException(400, "seed_nxt must be positive")

    shares_each = body.seed_nxt / Decimal(2)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_markets (
                    question, category, market_type, created_by,
                    creator_fee_percent, seed_nxt, shares_yes, shares_no,
                    liquidity_b, status, close_at
                ) VALUES (
                    %s, %s, 'official', %s, 0, %s, %s, %s, %s, 'active', %s
                ) RETURNING id, created_at
                """,
                (
                    body.question, body.category, admin_wallet,
                    body.seed_nxt, shares_each, shares_each,
                    body.liquidity_b, close_at,
                ),
            )
            row = cur.fetchone()
            market_id = row["id"] if isinstance(row, dict) else row[0]

            cur.execute(
                """
                INSERT INTO nxmarket_price_history
                  (market_id, price_yes, price_no, total_volume_nxt)
                VALUES (%s, 0.5, 0.5, 0)
                """,
                (market_id,),
            )

            admin_log_event(
                cur,
                event_type="nxmarket_official_created",
                wallet_address=admin_wallet,
                payload={
                    "market_id": int(market_id),
                    "seed_nxt": str(body.seed_nxt),
                    "liquidity_b": str(body.liquidity_b),
                    "question": body.question,
                },
            )

    return {"market_id": int(market_id), "status": "active"}


# ---------------------------------------------------------------------------
# POST /api/admin/nxmarket/markets/{id}/resolve (PR 3)
# ---------------------------------------------------------------------------


def _resolve_invalid(cur, market, admin_wallet: str) -> dict:
    """Refund every bettor their net cost basis (summed across YES+NO
    sides) and mark the market as resolved with outcome='invalid'.

    No treasury fee, no creator commission — the market failed to
    produce a meaningful outcome so nobody extracts value from it.
    Seed stays locked (it always does).
    """
    market_id = int(market["id"])

    # Lock the positions first (Postgres rejects FOR UPDATE alongside
    # GROUP BY), then aggregate per-wallet cost basis in Python. A
    # hedged user (positions on both YES and NO) receives the combined
    # cost basis of whatever they still hold.
    cur.execute(
        """
        SELECT LOWER(wallet_address) AS wallet,
               cost_basis
          FROM nxmarket_positions
         WHERE market_id = %s AND shares > 0
         ORDER BY id
         FOR UPDATE
        """,
        (market_id,),
    )
    pos_rows = cur.fetchall()
    grouped: dict[str, Decimal] = {}
    for pr in pos_rows:
        grouped[pr["wallet"]] = (
            grouped.get(pr["wallet"], Decimal(0)) + Decimal(pr["cost_basis"])
        )
    rows = [
        {"wallet": w, "total_cost": c}
        for w, c in grouped.items() if c > 0
    ]

    refunds: list[dict] = []
    paid_total = 0
    for row in rows:
        wallet = row["wallet"]
        # Floor to int — rounding dust stays in the pool (seed-style).
        amount = int(Decimal(row["total_cost"]))
        if amount <= 0:
            continue
        try:
            credit_wallet_balance(
                cur,
                wallet_address=wallet,
                amount_nxt=amount,
                ledger_source=LedgerSource.NXMARKET_REFUND,
                ref_table="nxmarket_markets",
                ref_id=market_id,
            )
        except NoDevsError as exc:
            # Match YES/NO behaviour: abort the whole resolve so no
            # partial refunds persist.
            raise HTTPException(
                500,
                f"bettor {wallet} owns no devs — cannot refund; "
                f"invalid resolve aborted ({exc})",
            )
        refunds.append({"wallet": wallet, "amount_nxt": amount})
        paid_total += amount

    cur.execute(
        """
        UPDATE nxmarket_markets
           SET status = 'resolved',
               outcome = 'invalid',
               resolved_at = NOW(),
               resolved_by = %s
         WHERE id = %s
        """,
        (admin_wallet, market_id),
    )

    admin_log_event(
        cur,
        event_type="nxmarket_resolved_invalid",
        wallet_address=admin_wallet,
        payload={
            "market_id": market_id,
            "refunds_count": len(refunds),
            "refunds_total_nxt": paid_total,
        },
    )

    return {
        "market_id": market_id,
        "resolution": "invalid",
        "refunds_count": len(refunds),
        "refunds_total_nxt": paid_total,
    }


@admin_router.post("/markets/{market_id}/resolve")
def resolve_market(market_id: int, body: ResolveBody, request: Request):
    admin_wallet = _require_admin(request)

    if body.resolution not in ("YES", "NO", "invalid"):
        raise HTTPException(
            400, "resolution must be 'YES', 'NO', or 'invalid'"
        )

    with get_db() as conn:
        with conn.cursor() as cur:
            # 1. Lock the market row; assert it can still be resolved.
            cur.execute(
                "SELECT id, market_type, created_by, creator_fee_percent, "
                "status, total_volume_nxt FROM nxmarket_markets "
                "WHERE id = %s FOR UPDATE",
                (market_id,),
            )
            market = cur.fetchone()
            if not market:
                raise HTTPException(404, "market not found")
            if market["status"] == "resolved":
                raise HTTPException(400, "market already resolved")
            if market["status"] not in ("active", "closed"):
                raise HTTPException(
                    400, f"market is not resolvable (status={market['status']})"
                )

            # INVALID resolution: refund every bettor their cost basis.
            # No treasury fee, no creator commission, seed stays locked.
            if body.resolution == "invalid":
                return _resolve_invalid(cur, market, admin_wallet)

            # 2. pool_total = net NXT users put in via trading.
            #    SUM(buys) - SUM(sells). Excludes seed_nxt by design
            #    (seed is locked liquidity, not redistributed).
            #    Penalties retained on sells are included because
            #    sells.nxt_amount is value_received (post-penalty).
            cur.execute(
                """
                SELECT
                  COALESCE(SUM(nxt_amount) FILTER (WHERE side = 'buy'), 0) AS buys,
                  COALESCE(SUM(nxt_amount) FILTER (WHERE side = 'sell'), 0) AS sells
                FROM nxmarket_trades WHERE market_id = %s
                """,
                (market_id,),
            )
            r = cur.fetchone()
            pool_total = int(Decimal(r["buys"]) - Decimal(r["sells"]))
            if pool_total < 0:
                pool_total = 0

            is_user_market = market["market_type"] == "user"

            # 3. Fees (floor).
            treasury_fee = pool_total * int(TREASURY_FEE_PERCENT) // 100
            creator_commission = 0
            if is_user_market and pool_total > 0:
                creator_commission = (
                    pool_total * int(market["creator_fee_percent"]) // 100
                )
            distributable = pool_total - treasury_fee - creator_commission

            # 4-5. Lock winning positions; compute total_winning_shares.
            cur.execute(
                """
                SELECT id, wallet_address, shares
                  FROM nxmarket_positions
                 WHERE market_id = %s AND outcome = %s AND shares > 0
                 FOR UPDATE
                """,
                (market_id, body.resolution),
            )
            winning_positions = cur.fetchall()
            total_winning_shares = sum(
                (Decimal(p["shares"]) for p in winning_positions),
                Decimal(0),
            )

            # 6-7-8. Distribute to winners (only when distributable > 0 and
            # winners exist). Otherwise everything rolls into treasury.
            payouts: list[dict] = []
            paid_to_winners = 0

            if winning_positions and total_winning_shares > 0 and distributable > 0:
                for pos in winning_positions:
                    share = Decimal(pos["shares"])
                    raw = (Decimal(distributable) * share) / total_winning_shares
                    payout_i = int(raw)  # floor
                    if payout_i <= 0:
                        continue
                    try:
                        credit_wallet_balance(
                            cur,
                            wallet_address=pos["wallet_address"],
                            amount_nxt=payout_i,
                            ledger_source=LedgerSource.NXMARKET_PAYOUT,
                            ref_table="nxmarket_markets",
                            ref_id=market_id,
                        )
                    except NoDevsError as exc:
                        # Atomicity: roll back the whole resolve. The
                        # context manager will rollback on HTTPException.
                        raise HTTPException(
                            500,
                            f"winner wallet {pos['wallet_address']} owns no "
                            f"devs — cannot credit payout; resolve aborted "
                            f"({exc})",
                        )
                    payouts.append({
                        "wallet": pos["wallet_address"],
                        "amount_nxt": payout_i,
                        "shares": float(share),
                    })
                    paid_to_winners += payout_i

            # Dust = rounding residue from integer payouts.
            dust = distributable - paid_to_winners if winning_positions else distributable
            treasury_total = treasury_fee + dust
            if not winning_positions or total_winning_shares <= 0:
                # No winners → the full pool (minus any creator commission
                # if applicable) goes to treasury.
                treasury_total = pool_total - creator_commission

            # 9. Treasury credit (best-effort: if the treasury wallet
            # owns no devs in this env, fall back to admin_log warning —
            # critical to not block user payouts).
            if treasury_total > 0:
                try:
                    credit_wallet_balance(
                        cur,
                        wallet_address=_TREASURY_WALLET,
                        amount_nxt=treasury_total,
                        ledger_source=LedgerSource.NXMARKET_TREASURY_FEE,
                        ref_table="nxmarket_markets",
                        ref_id=market_id,
                    )
                except NoDevsError:
                    log.warning(
                        "nxmarket_resolve treasury has no devs; "
                        "fee=%s market=%s — recorded in admin_log only",
                        treasury_total, market_id,
                    )
                    admin_log_event(
                        cur,
                        event_type="nxmarket_treasury_uncollected",
                        wallet_address=_TREASURY_WALLET,
                        payload={
                            "market_id": market_id,
                            "amount_nxt": treasury_total,
                        },
                    )

            # 10. Creator commission (only if user market and pool > 0).
            if creator_commission > 0:
                try:
                    credit_wallet_balance(
                        cur,
                        wallet_address=market["created_by"],
                        amount_nxt=creator_commission,
                        ledger_source=LedgerSource.NXMARKET_COMMISSION,
                        ref_table="nxmarket_markets",
                        ref_id=market_id,
                    )
                except NoDevsError as exc:
                    raise HTTPException(
                        500,
                        f"creator {market['created_by']} owns no devs — "
                        f"cannot pay commission; resolve aborted ({exc})",
                    )

            # 11. Mark the market resolved.
            cur.execute(
                """
                UPDATE nxmarket_markets
                   SET status = 'resolved',
                       outcome = %s,
                       resolved_at = NOW(),
                       resolved_by = %s
                 WHERE id = %s
                """,
                (body.resolution, admin_wallet, market_id),
            )

            # 12. Audit log.
            admin_log_event(
                cur,
                event_type="nxmarket_resolved",
                wallet_address=admin_wallet,
                payload={
                    "market_id": market_id,
                    "resolution": body.resolution,
                    "pool_total": pool_total,
                    "treasury_fee": treasury_fee,
                    "treasury_total": treasury_total,
                    "creator_commission": creator_commission,
                    "distributable": distributable,
                    "winners_count": len(payouts),
                    "total_winning_shares": float(total_winning_shares),
                    "paid_to_winners": paid_to_winners,
                    "dust": dust,
                },
            )

    return {
        "market_id": market_id,
        "resolution": body.resolution,
        "pool_total": pool_total,
        "treasury_fee": treasury_fee,
        "treasury_total": treasury_total,
        "creator_commission": creator_commission,
        "distributable": distributable,
        "paid_to_winners": paid_to_winners,
        "winners_count": len(payouts),
        "dust": dust,
    }


# ---------------------------------------------------------------------------
# POST /api/nxmarket/markets (user)
# ---------------------------------------------------------------------------


@router.post("/markets")
def create_user_market(body: CreateUserMarketBody):
    wallet = validate_wallet(body.wallet)
    close_at = _validate_market_common(body.liquidity_b, body.close_at)

    with get_db() as conn:
        with conn.cursor() as cur:
            # Escalera check fails fast before we touch balances or
            # allocate a market id. Admin wallets are intentionally
            # subject to the same cap for user markets — they have the
            # /admin/markets flow for unlimited official creation.
            cap = _calculate_user_market_cap(cur, wallet)
            if not cap["can_create"]:
                raise HTTPException(
                    400,
                    f"Market cap reached: "
                    f"{cap['active_markets']}/{cap['max_markets']} active "
                    f"(you have {cap['dev_count']} dev"
                    f"{'s' if cap['dev_count'] != 1 else ''}). "
                    f"Resolve or wait for existing markets to close, or "
                    f"mint more devs (20+ for unlimited).",
                )

            cur.execute(
                "SELECT COALESCE(SUM(balance_nxt), 0) AS total "
                "FROM devs WHERE LOWER(owner_address) = %s",
                (wallet,),
            )
            r = cur.fetchone()
            total = int(r["total"] if isinstance(r, dict) else r[0])
            if total < USER_MARKET_CREATION_COST:
                raise HTTPException(
                    400,
                    f"insufficient balance: need {USER_MARKET_CREATION_COST} "
                    f"NXT across your devs, have {total}",
                )

            seed = Decimal(USER_MARKET_SEED_NXT)
            shares_each = seed / Decimal(2)
            cur.execute(
                """
                INSERT INTO nxmarket_markets (
                    question, category, market_type, created_by,
                    creator_fee_percent, seed_nxt, shares_yes, shares_no,
                    liquidity_b, status, close_at
                ) VALUES (
                    %s, %s, 'user', %s, %s, %s, %s, %s, %s, 'active', %s
                ) RETURNING id
                """,
                (
                    body.question, body.category, wallet,
                    USER_MARKET_CREATOR_FEE_PERCENT, seed,
                    shares_each, shares_each,
                    body.liquidity_b, close_at,
                ),
            )
            row = cur.fetchone()
            market_id = int(row["id"] if isinstance(row, dict) else row[0])

            try:
                debit_wallet_balance(
                    cur,
                    wallet_address=wallet,
                    amount_nxt=USER_MARKET_CREATION_COST,
                    ledger_source=LedgerSource.NXMARKET_CREATION_FEE,
                    ref_table="nxmarket_markets",
                    ref_id=market_id,
                )
            except InsufficientBalanceError as exc:
                raise HTTPException(400, str(exc))

            cur.execute(
                """
                INSERT INTO nxmarket_price_history
                  (market_id, price_yes, price_no, total_volume_nxt)
                VALUES (%s, 0.5, 0.5, 0)
                """,
                (market_id,),
            )

    return {"market_id": market_id, "status": "active"}


# ---------------------------------------------------------------------------
# POST /api/nxmarket/markets/{id}/buy (trading — PR 2)
# ---------------------------------------------------------------------------


def _check_outcome(side: str) -> str:
    if side not in ("YES", "NO"):
        raise HTTPException(400, "side must be 'YES' or 'NO'")
    return side


def _lock_open_market(cur, market_id: int) -> dict:
    """SELECT … FOR UPDATE and assert the market is still tradeable."""
    cur.execute(
        "SELECT id, status, close_at, shares_yes, shares_no, liquidity_b, "
        "total_volume_nxt FROM nxmarket_markets WHERE id = %s FOR UPDATE",
        (market_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "market not found")
    if row["status"] != "active":
        raise HTTPException(400, f"market is not tradeable (status={row['status']})")
    if row["close_at"] <= datetime.now(timezone.utc):
        raise HTTPException(400, "market is past its close_at")
    return row


def _snapshot_prices(cur, market_id: int, shares_yes, shares_no, liquidity_b,
                     total_volume_nxt) -> dict:
    prices = lmsr.calculate_price(shares_yes, shares_no, liquidity_b)
    cur.execute(
        """
        INSERT INTO nxmarket_price_history
          (market_id, price_yes, price_no, total_volume_nxt)
        VALUES (%s, %s, %s, %s)
        """,
        (market_id, prices["price_yes"], prices["price_no"], total_volume_nxt),
    )
    return prices


@router.post("/markets/{market_id}/buy")
def buy_shares(market_id: int, body: BuyBody):
    wallet = validate_wallet(body.wallet)
    side = _check_outcome(body.side)
    amount = int(body.amount_nxt)

    with get_db() as conn:
        with conn.cursor() as cur:
            market = _lock_open_market(cur, market_id)

            cur.execute(
                "SELECT COALESCE(SUM(balance_nxt), 0) AS total FROM devs "
                "WHERE LOWER(owner_address) = %s",
                (wallet,),
            )
            r = cur.fetchone()
            total = int(r["total"] if isinstance(r, dict) else r[0])
            if total < amount:
                raise HTTPException(
                    400,
                    f"insufficient balance: need {amount}, have {total}",
                )

            cost = lmsr.calculate_cost_to_buy(
                market["shares_yes"], market["shares_no"],
                market["liquidity_b"], side, Decimal(amount),
            )
            shares_received = cost["shares_received"]
            new_shares_yes = cost["new_shares_yes"]
            new_shares_no = cost["new_shares_no"]
            avg_price = cost["average_price"]

            # INSERT the trade first so we have a stable id to use as
            # ref_id for the ledger (keeps idempotency keys unique even
            # when the same wallet buys the same market+side twice).
            cur.execute(
                """
                INSERT INTO nxmarket_trades
                  (market_id, wallet_address, side, outcome, shares,
                   nxt_amount, price, penalty_nxt)
                VALUES (%s, %s, 'buy', %s, %s, %s, %s, 0)
                RETURNING id
                """,
                (market_id, wallet, side, shares_received, amount, avg_price),
            )
            trade_row = cur.fetchone()
            trade_id = int(trade_row["id"] if isinstance(trade_row, dict) else trade_row[0])

            ledger_source = (
                LedgerSource.NXMARKET_BUY_YES if side == "YES"
                else LedgerSource.NXMARKET_BUY_NO
            )
            try:
                debit_wallet_balance(
                    cur,
                    wallet_address=wallet,
                    amount_nxt=amount,
                    ledger_source=ledger_source,
                    ref_table="nxmarket_trades",
                    ref_id=trade_id,
                )
            except InsufficientBalanceError as exc:
                raise HTTPException(400, str(exc))

            cur.execute(
                """
                UPDATE nxmarket_markets
                   SET shares_yes = %s,
                       shares_no  = %s,
                       total_volume_nxt = total_volume_nxt + %s
                 WHERE id = %s
                """,
                (new_shares_yes, new_shares_no, amount, market_id),
            )

            cur.execute(
                """
                INSERT INTO nxmarket_positions
                  (market_id, wallet_address, outcome, shares, cost_basis)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (market_id, wallet_address, outcome)
                DO UPDATE SET
                  shares     = nxmarket_positions.shares + EXCLUDED.shares,
                  cost_basis = nxmarket_positions.cost_basis + EXCLUDED.cost_basis,
                  updated_at = NOW()
                """,
                (market_id, wallet, side, shares_received, amount),
            )

            new_total_volume = Decimal(market["total_volume_nxt"]) + Decimal(amount)
            prices = _snapshot_prices(
                cur, market_id, new_shares_yes, new_shares_no,
                market["liquidity_b"], new_total_volume,
            )

    return {
        "trade_id": trade_id,
        "market_id": market_id,
        "side": side,
        "amount_nxt": amount,
        "shares_received": float(shares_received),
        "average_price": float(avg_price),
        "new_price_yes": float(prices["price_yes"]),
        "new_price_no": float(prices["price_no"]),
    }


# ---------------------------------------------------------------------------
# POST /api/nxmarket/markets/{id}/exit (trading — PR 2)
# ---------------------------------------------------------------------------


@router.post("/markets/{market_id}/exit")
def exit_position(market_id: int, body: ExitBody):
    wallet = validate_wallet(body.wallet)
    side = _check_outcome(body.side)
    shares = body.shares_to_sell
    if shares <= 0:
        raise HTTPException(400, "shares_to_sell must be positive")

    with get_db() as conn:
        with conn.cursor() as cur:
            market = _lock_open_market(cur, market_id)

            cur.execute(
                """
                SELECT id, shares, cost_basis FROM nxmarket_positions
                 WHERE market_id = %s AND LOWER(wallet_address) = %s
                   AND outcome = %s
                 FOR UPDATE
                """,
                (market_id, wallet, side),
            )
            pos = cur.fetchone()
            if not pos:
                raise HTTPException(400, "no position in this market/side")
            if Decimal(pos["shares"]) < shares:
                raise HTTPException(
                    400,
                    f"insufficient shares: have {pos['shares']}, want {shares}",
                )

            sell = lmsr.calculate_value_to_sell(
                market["shares_yes"], market["shares_no"],
                market["liquidity_b"], side, shares,
            )
            value_after = sell["value_after_penalty"]
            penalty = sell["penalty_nxt"]
            new_shares_yes = sell["new_shares_yes"]
            new_shares_no = sell["new_shares_no"]
            avg_price = sell["average_price"]

            # Floor to int — rounding diff stays in the pool. Guard against
            # tiny sells rounding down to 0 NXT: refuse the trade so the
            # user doesn't hand over shares for nothing.
            value_received_int = int(value_after)
            if value_received_int <= 0:
                raise HTTPException(
                    400,
                    "sell produces 0 NXT after rounding — sell more shares",
                )

            cur.execute(
                """
                INSERT INTO nxmarket_trades
                  (market_id, wallet_address, side, outcome, shares,
                   nxt_amount, price, penalty_nxt)
                VALUES (%s, %s, 'sell', %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (market_id, wallet, side, shares, value_received_int,
                 avg_price, penalty),
            )
            trade_row = cur.fetchone()
            trade_id = int(trade_row["id"] if isinstance(trade_row, dict) else trade_row[0])

            try:
                credit_wallet_balance(
                    cur,
                    wallet_address=wallet,
                    amount_nxt=value_received_int,
                    ledger_source=LedgerSource.NXMARKET_SELL,
                    ref_table="nxmarket_trades",
                    ref_id=trade_id,
                )
            except NoDevsError as exc:
                raise HTTPException(400, str(exc))

            cur.execute(
                """
                UPDATE nxmarket_markets
                   SET shares_yes = %s,
                       shares_no  = %s,
                       total_volume_nxt = total_volume_nxt + %s
                 WHERE id = %s
                """,
                (new_shares_yes, new_shares_no, value_received_int, market_id),
            )

            # Keep cost_basis as historical record — only subtract shares.
            cur.execute(
                """
                UPDATE nxmarket_positions
                   SET shares = shares - %s,
                       updated_at = NOW()
                 WHERE id = %s
                """,
                (shares, pos["id"]),
            )

            new_total_volume = (
                Decimal(market["total_volume_nxt"]) + Decimal(value_received_int)
            )
            prices = _snapshot_prices(
                cur, market_id, new_shares_yes, new_shares_no,
                market["liquidity_b"], new_total_volume,
            )

    return {
        "trade_id": trade_id,
        "market_id": market_id,
        "side": side,
        "shares_sold": float(shares),
        "value_received_nxt": value_received_int,
        "penalty_paid": float(penalty),
        "average_price": float(avg_price),
        "new_price_yes": float(prices["price_yes"]),
        "new_price_no": float(prices["price_no"]),
    }


# ---------------------------------------------------------------------------
# GET /api/nxmarket/markets (list)
# ---------------------------------------------------------------------------


@router.get("/markets")
def list_markets(
    status: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    market_type: Optional[str] = Query(default=None),
):
    clauses: List[str] = []
    params: List = []
    if status:
        clauses.append("status = %s")
        params.append(status)
    if category:
        clauses.append("category = %s")
        params.append(category)
    if market_type:
        clauses.append("market_type = %s")
        params.append(market_type)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, question, category, market_type, created_by,
                       creator_fee_percent, seed_nxt, shares_yes, shares_no,
                       liquidity_b, status, outcome, close_at, resolved_at,
                       total_volume_nxt, created_at
                  FROM nxmarket_markets
                  {where}
                  ORDER BY
                    -- Active markets first, sorted by urgency (soonest
                    -- close_at on top). Resolved/closed below, sorted
                    -- by recency (resolved_at DESC, falling back to
                    -- close_at for closed-but-not-resolved rows).
                    CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC,
                    CASE WHEN status = 'active' THEN close_at END ASC,
                    CASE WHEN status <> 'active'
                         THEN COALESCE(resolved_at, close_at) END DESC
                """,
                params,
            )
            rows = cur.fetchall()

    return {"markets": [_row_with_prices(r) for r in rows]}


# ---------------------------------------------------------------------------
# GET /api/nxmarket/markets/{market_id} (detail)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# GET /api/nxmarket/markets/pending (admin) — drives the admin banner
# in MarketsList. Registered BEFORE /markets/{market_id} on purpose:
# Starlette matches routes in declaration order, and if the int-param
# detail route came first it would 422 on the literal "pending".
# ---------------------------------------------------------------------------


@router.get("/markets/pending")
def list_pending_markets(request: Request):
    _require_admin(request)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.id, m.question, m.category, m.market_type,
                       m.close_at, m.created_by, m.seed_nxt
                  FROM nxmarket_markets m
                 WHERE m.status = 'closed'
                   AND m.outcome IS NULL
                 ORDER BY m.close_at ASC
                """,
            )
            markets = cur.fetchall()

            out: list[dict] = []
            for m in markets:
                mid = int(m["id"])
                cur.execute(
                    """
                    SELECT
                      COALESCE(SUM(nxt_amount) FILTER (WHERE side='buy'),  0)  AS buys,
                      COALESCE(SUM(nxt_amount) FILTER (WHERE side='sell'), 0)  AS sells,
                      COALESCE(SUM(nxt_amount) FILTER (
                        WHERE side='buy' AND outcome='YES'), 0)               AS yes_vol,
                      COALESCE(SUM(nxt_amount) FILTER (
                        WHERE side='buy' AND outcome='NO'),  0)               AS no_vol,
                      COUNT(DISTINCT wallet_address)                           AS bettors,
                      COUNT(DISTINCT wallet_address) FILTER (
                        WHERE side='buy' AND outcome='YES')                    AS yes_bettors,
                      COUNT(DISTINCT wallet_address) FILTER (
                        WHERE side='buy' AND outcome='NO')                     AS no_bettors
                    FROM nxmarket_trades WHERE market_id = %s
                    """,
                    (mid,),
                )
                agg = cur.fetchone()

                pool_total = max(
                    0, int(Decimal(agg["buys"]) - Decimal(agg["sells"])),
                )
                close_at = m["close_at"]
                now = datetime.now(timezone.utc)
                closed_days = max(0, (now - close_at).days) if close_at else 0
                days_until_timeout = max(0, 30 - closed_days)

                out.append({
                    "id": mid,
                    "question": m["question"],
                    "category": m["category"],
                    "market_type": m["market_type"],
                    "close_at": close_at.isoformat() if close_at else None,
                    "closed_since_days": closed_days,
                    "days_until_timeout": days_until_timeout,
                    "pool_total": pool_total,
                    "yes_volume": int(Decimal(agg["yes_vol"])),
                    "no_volume": int(Decimal(agg["no_vol"])),
                    "bettors_count": int(agg["bettors"] or 0),
                    "yes_bettors": int(agg["yes_bettors"] or 0),
                    "no_bettors": int(agg["no_bettors"] or 0),
                })

    return {"markets": out, "total_pending": len(out)}


@router.get("/markets/{market_id}")
def get_market_detail(market_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, question, category, market_type, created_by,
                       creator_fee_percent, seed_nxt, shares_yes, shares_no,
                       liquidity_b, status, outcome, close_at, resolved_at,
                       total_volume_nxt, created_at
                  FROM nxmarket_markets WHERE id = %s
                """,
                (market_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "market not found")

            cur.execute(
                """
                SELECT id, wallet_address, side, outcome, shares, nxt_amount,
                       price, created_at
                  FROM nxmarket_trades WHERE market_id = %s
                  ORDER BY created_at DESC LIMIT 50
                """,
                (market_id,),
            )
            trades = cur.fetchall()

            cur.execute(
                """
                SELECT price_yes, price_no, total_volume_nxt, snapshot_at
                  FROM nxmarket_price_history
                 WHERE market_id = %s
                   AND snapshot_at >= NOW() - INTERVAL '24 hours'
                 ORDER BY snapshot_at ASC
                """,
                (market_id,),
            )
            history = cur.fetchall()

    market = _row_with_prices(row)

    def _trade(t):
        d = dict(t)
        for k in ("shares", "nxt_amount", "price"):
            if k in d and d[k] is not None:
                d[k] = float(d[k])
        if d.get("created_at") is not None:
            d["created_at"] = d["created_at"].isoformat()
        return d

    def _hist(h):
        d = dict(h)
        for k in ("price_yes", "price_no", "total_volume_nxt"):
            if k in d and d[k] is not None:
                d[k] = float(d[k])
        if d.get("snapshot_at") is not None:
            d["snapshot_at"] = d["snapshot_at"].isoformat()
        return d

    return {
        "market": market,
        "recent_trades": [_trade(t) for t in trades],
        "price_history": [_hist(h) for h in history],
    }


# ---------------------------------------------------------------------------
# Comments (PR C1) — flat per-market comment thread with like/dislike votes,
# soft delete (owner or admin), 500-char body cap, 1-per-minute rate limit.
# ---------------------------------------------------------------------------


COMMENT_MAX_LEN = 500
COMMENT_LIST_DEFAULT_LIMIT = 20
COMMENT_LIST_MAX_LIMIT = 50


class CreateCommentBody(BaseModel):
    wallet: str
    body: str


class VoteCommentBody(BaseModel):
    wallet: str
    vote: str  # 'like' | 'dislike' | 'none'


def _serialise_comment(row: dict) -> dict:
    """Shape a SELECT result (with aggregated counts) into the API contract."""
    is_deleted = row["deleted_at"] is not None
    return {
        "id": int(row["id"]),
        "wallet_address": row["wallet_address"],
        "body": "[Comment deleted]" if is_deleted else row["body"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "like_count": 0 if is_deleted else int(row.get("like_count") or 0),
        "dislike_count": 0 if is_deleted else int(row.get("dislike_count") or 0),
        "my_vote": None if is_deleted else row.get("my_vote"),
        "is_deleted": is_deleted,
        "deleted_by": row["deleted_by"],
    }


@router.get("/markets/{market_id}/comments")
def list_comments(
    market_id: int,
    limit: int = Query(default=COMMENT_LIST_DEFAULT_LIMIT, ge=1,
                       le=COMMENT_LIST_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    wallet: Optional[str] = Query(default=None),
):
    # If wallet is provided, resolve it to a normalised form for my_vote
    # lookup; but don't 400 when an unrecognised wallet is passed — just
    # skip the my_vote join so public reads never fail for missing/invalid
    # wallet headers.
    me = None
    if wallet:
        try:
            me = validate_wallet(wallet)
        except HTTPException:
            me = None

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            if cur.fetchone() is None:
                raise HTTPException(404, "market not found")

            cur.execute(
                "SELECT COUNT(*) AS c FROM nxmarket_comments WHERE market_id = %s",
                (market_id,),
            )
            r = cur.fetchone()
            total_count = int(r["c"] if isinstance(r, dict) else r[0])

            cur.execute(
                """
                SELECT
                  c.id, c.wallet_address, c.body, c.created_at,
                  c.deleted_at, c.deleted_by,
                  COALESCE(SUM(CASE WHEN v.vote_type = 'like'    THEN 1 ELSE 0 END), 0) AS like_count,
                  COALESCE(SUM(CASE WHEN v.vote_type = 'dislike' THEN 1 ELSE 0 END), 0) AS dislike_count,
                  MAX(CASE WHEN v.wallet_address = %s THEN v.vote_type END) AS my_vote
                FROM nxmarket_comments c
                LEFT JOIN nxmarket_comment_votes v ON v.comment_id = c.id
                WHERE c.market_id = %s
                GROUP BY c.id
                ORDER BY c.created_at DESC, c.id DESC
                LIMIT %s OFFSET %s
                """,
                (me, market_id, limit, offset),
            )
            rows = cur.fetchall()

    comments = [_serialise_comment(dict(r)) for r in rows]
    return {
        "comments": comments,
        "total_count": total_count,
        "has_more": (offset + len(comments)) < total_count,
    }


@router.post("/markets/{market_id}/comments")
def create_comment(market_id: int, body: CreateCommentBody):
    wallet = validate_wallet(body.wallet)
    text = (body.body or "").strip()
    if not text:
        raise HTTPException(400, "body cannot be empty")
    if len(text) > COMMENT_MAX_LEN:
        raise HTTPException(
            400, f"body too long (max {COMMENT_MAX_LEN} chars)"
        )

    # Redis-backed 60s cooldown per wallet. comment_limiter.check raises
    # HTTPException(429) when the wallet hit the endpoint in the window.
    comment_limiter.check(wallet)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM nxmarket_markets WHERE id = %s",
                (market_id,),
            )
            if cur.fetchone() is None:
                raise HTTPException(404, "market not found")

            cur.execute(
                """
                INSERT INTO nxmarket_comments (market_id, wallet_address, body)
                VALUES (%s, %s, %s)
                RETURNING id, created_at
                """,
                (market_id, wallet, text),
            )
            r = cur.fetchone()
            cid = int(r["id"] if isinstance(r, dict) else r[0])
            created = r["created_at"] if isinstance(r, dict) else r[1]

    return {
        "comment_id": cid,
        "created_at": created.isoformat() if created else None,
    }


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, request: Request):
    header = request.headers.get("X-Wallet") or request.headers.get("x-wallet")
    if not header:
        raise HTTPException(400, "X-Wallet header required")
    wallet = validate_wallet(header)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, wallet_address, deleted_at "
                "FROM nxmarket_comments WHERE id = %s FOR UPDATE",
                (comment_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "comment not found")
            if row["deleted_at"] is not None:
                raise HTTPException(400, "comment already deleted")

            is_owner = row["wallet_address"].lower() == wallet
            is_admin = wallet in ADMIN_WALLETS
            if not (is_owner or is_admin):
                raise HTTPException(
                    403, "you can only delete your own comments",
                )

            cur.execute(
                """
                UPDATE nxmarket_comments
                   SET deleted_at = NOW(), deleted_by = %s
                 WHERE id = %s
                """,
                (wallet, comment_id),
            )

    return {"deleted": True}


@router.post("/comments/{comment_id}/vote")
def vote_comment(comment_id: int, body: VoteCommentBody):
    wallet = validate_wallet(body.wallet)
    if body.vote not in ("like", "dislike", "none"):
        raise HTTPException(400, "vote must be 'like', 'dislike', or 'none'")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, deleted_at FROM nxmarket_comments WHERE id = %s",
                (comment_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "comment not found")
            if row["deleted_at"] is not None:
                raise HTTPException(400, "cannot vote on a deleted comment")

            if body.vote == "none":
                cur.execute(
                    "DELETE FROM nxmarket_comment_votes "
                    "WHERE comment_id = %s AND wallet_address = %s",
                    (comment_id, wallet),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO nxmarket_comment_votes
                      (comment_id, wallet_address, vote_type)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (comment_id, wallet_address)
                    DO UPDATE SET vote_type = EXCLUDED.vote_type,
                                  created_at = NOW()
                    """,
                    (comment_id, wallet, body.vote),
                )

            # Return fresh aggregates + my_vote.
            cur.execute(
                """
                SELECT
                  COALESCE(SUM(CASE WHEN vote_type='like'    THEN 1 ELSE 0 END), 0) AS like_count,
                  COALESCE(SUM(CASE WHEN vote_type='dislike' THEN 1 ELSE 0 END), 0) AS dislike_count,
                  MAX(CASE WHEN wallet_address=%s THEN vote_type END) AS my_vote
                FROM nxmarket_comment_votes WHERE comment_id = %s
                """,
                (wallet, comment_id),
            )
            agg = cur.fetchone()

    return {
        "like_count": int(agg["like_count"] or 0),
        "dislike_count": int(agg["dislike_count"] or 0),
        "my_vote": agg["my_vote"],
    }


# ---------------------------------------------------------------------------
# Leaderboard (PR C2) — top users ranked by net profit in NX Market.
# Net profit = SUM(payouts) - SUM(|buys|). Losers show as negative entries
# and are still ranked (no exclusion), so the list reflects reality.
# ---------------------------------------------------------------------------


LEADERBOARD_DEFAULT_LIMIT = 25
LEADERBOARD_MAX_LIMIT = 100


@router.get("/leaderboard")
def get_leaderboard(
    period: str = Query(default="all", pattern="^(all|30d)$"),
    limit: int = Query(default=LEADERBOARD_DEFAULT_LIMIT, ge=1,
                       le=LEADERBOARD_MAX_LIMIT),
):
    # period_filter is a Postgres INTERVAL string applied server-side so
    # the conditional stays in SQL (no Python branching between queries).
    period_filter_sql = "AND created_at >= NOW() - INTERVAL '30 days'" \
        if period == "30d" else ""

    query = f"""
        WITH earnings AS (
          SELECT
            wallet_address,
            SUM(CASE WHEN source = 'nxmarket_payout'
                     THEN delta_nxt ELSE 0 END) AS total_payouts,
            SUM(CASE WHEN source IN ('nxmarket_buy_yes', 'nxmarket_buy_no')
                     THEN ABS(delta_nxt) ELSE 0 END) AS total_invested
          FROM nxt_ledger
          WHERE source IN ('nxmarket_payout', 'nxmarket_buy_yes', 'nxmarket_buy_no')
            {period_filter_sql}
          GROUP BY wallet_address
        )
        SELECT
          wallet_address,
          total_payouts,
          total_invested,
          (total_payouts - total_invested) AS net_profit
        FROM earnings
        WHERE total_payouts > 0 OR total_invested > 0
        ORDER BY net_profit DESC, wallet_address ASC
        LIMIT %s
    """

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()
            # total_users = count of wallets with ANY activity in the period
            # (not limited). Second query keeps the main query limit-aware.
            cur.execute(
                f"""
                SELECT COUNT(DISTINCT wallet_address) AS c FROM nxt_ledger
                 WHERE source IN ('nxmarket_payout', 'nxmarket_buy_yes', 'nxmarket_buy_no')
                   {period_filter_sql}
                """,
            )
            total_users = int(cur.fetchone()["c"])

    leaderboard = []
    for idx, r in enumerate(rows, start=1):
        leaderboard.append({
            "rank": idx,
            "wallet_address": r["wallet_address"],
            "net_profit": int(r["net_profit"] or 0),
            "total_payouts": int(r["total_payouts"] or 0),
            "total_invested": int(r["total_invested"] or 0),
        })

    return {
        "period": period,
        "leaderboard": leaderboard,
        "total_users": total_users,
    }


# ---------------------------------------------------------------------------
# GET /api/nxmarket/markets/cap/{wallet} — expose user's escalera state
# so the frontend can render the Create Market modal with an
# informative cap-reached panel instead of bouncing off the 400 at submit.
# Public (no auth) — the data is per-wallet and not sensitive.
# ---------------------------------------------------------------------------


@router.get("/markets/cap/{wallet}")
def get_user_market_cap(wallet: str):
    w = validate_wallet(wallet)
    with get_db() as conn:
        with conn.cursor() as cur:
            return _calculate_user_market_cap(cur, w)
