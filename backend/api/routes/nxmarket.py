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
from backend.api.routes.admin import _require_admin
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
# POST /api/nxmarket/markets (user)
# ---------------------------------------------------------------------------


@router.post("/markets")
def create_user_market(body: CreateUserMarketBody):
    wallet = validate_wallet(body.wallet)
    close_at = _validate_market_common(body.liquidity_b, body.close_at)

    with get_db() as conn:
        with conn.cursor() as cur:
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
                  ORDER BY created_at DESC
                """,
                params,
            )
            rows = cur.fetchall()

    return {"markets": [_row_with_prices(r) for r in rows]}


# ---------------------------------------------------------------------------
# GET /api/nxmarket/markets/{market_id} (detail)
# ---------------------------------------------------------------------------


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
