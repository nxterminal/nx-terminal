"""Logarithmic Market Scoring Rule (LMSR) engine for NXMARKET.

Robin Hanson's LMSR with a constant-liquidity parameter ``b`` and two
outcomes (YES / NO). All prices live in ``[0, 1]`` and sum to 1.

Cost function::

    C(q_yes, q_no) = b * ln(exp(q_yes / b) + exp(q_no / b))

Cost to buy ``amount_nxt`` of an outcome is solved by inverting
``C(q_new, q_other) - C(q_yes, q_no) = amount_nxt`` for ``q_new``::

    q_new = b * ln(exp(q_other / b + amount_nxt / b) - exp(q_other / b)
                   + exp(q_new_?)) ...

which reduces to the closed form::

    q_new = q_other + b * ln( exp((C + amount_nxt) / b) - exp(q_other / b) )

where ``C`` is the starting cost. A logsumexp reformulation is used to
avoid overflow for large ``amount_nxt / b``.

Public API (all return ``Decimal``):

- ``calculate_price(shares_yes, shares_no, liquidity_b) -> dict``
- ``calculate_cost_to_buy(shares_yes, shares_no, liquidity_b, outcome, amount_nxt) -> dict``
- ``calculate_value_to_sell(shares_yes, shares_no, liquidity_b, outcome, shares) -> dict``
"""

from __future__ import annotations

import math
from decimal import Decimal, getcontext
from typing import Literal


# Enough precision for the NUMERIC(30,8) share columns; 28 is psycopg2's default.
getcontext().prec = 50


Outcome = Literal["YES", "NO"]


def _d(x) -> Decimal:
    if isinstance(x, Decimal):
        return x
    return Decimal(str(x))


def _check_outcome(outcome: str) -> str:
    if outcome not in ("YES", "NO"):
        raise ValueError(f"outcome must be 'YES' or 'NO', got {outcome!r}")
    return outcome


def _cost_logsumexp(q_yes: float, q_no: float, b: float) -> float:
    """Numerically stable ``b * log(exp(q_yes/b) + exp(q_no/b))``."""
    a = q_yes / b
    c = q_no / b
    m = max(a, c)
    return b * (m + math.log(math.exp(a - m) + math.exp(c - m)))


def calculate_price(shares_yes, shares_no, liquidity_b) -> dict:
    """Current marginal prices.

    price_yes = exp(q_yes/b) / (exp(q_yes/b) + exp(q_no/b))
    Using the logsumexp trick for stability:
        price_yes = 1 / (1 + exp((q_no - q_yes)/b))
    """
    q_yes = float(_d(shares_yes))
    q_no = float(_d(shares_no))
    b = float(_d(liquidity_b))
    if b <= 0:
        raise ValueError("liquidity_b must be positive")

    diff = (q_no - q_yes) / b
    # Stable sigmoid: only ever exp a non-positive argument.
    if diff >= 0:
        e = math.exp(-diff)
        price_yes = e / (e + 1.0)
    else:
        price_yes = 1.0 / (1.0 + math.exp(diff))
    price_no = 1.0 - price_yes
    return {
        "price_yes": Decimal(str(round(price_yes, 6))),
        "price_no": Decimal(str(round(price_no, 6))),
    }


def calculate_cost_to_buy(
    shares_yes,
    shares_no,
    liquidity_b,
    outcome: str,
    amount_nxt,
) -> dict:
    """How many shares of ``outcome`` does ``amount_nxt`` NXT buy?

    Returns ``{"shares_received": Decimal, "new_shares_yes": Decimal,
    "new_shares_no": Decimal, "average_price": Decimal}``.
    """
    _check_outcome(outcome)
    amount = _d(amount_nxt)
    if amount <= 0:
        raise ValueError("amount_nxt must be positive")
    q_yes = float(_d(shares_yes))
    q_no = float(_d(shares_no))
    b = float(_d(liquidity_b))
    if b <= 0:
        raise ValueError("liquidity_b must be positive")

    c_start = _cost_logsumexp(q_yes, q_no, b)
    c_target = c_start + float(amount)

    # Invert C(q_new, q_other) = c_target for the purchased side.
    # C = b * ln(exp(q_new/b) + exp(q_other/b))
    #   => exp(c_target/b) = exp(q_new/b) + exp(q_other/b)
    #   => q_new = b * ln(exp(c_target/b) - exp(q_other/b))
    # Reformulate to avoid overflow when c_target/b is large:
    # Let t = c_target/b, r = q_other/b. Then
    #   q_new/b = ln(exp(t) - exp(r))
    #          = t + ln(1 - exp(r - t))
    # which is stable for t >> r (the usual case: buying moves the
    # other side's exp term relatively smaller).
    if outcome == "YES":
        q_other = q_no
    else:
        q_other = q_yes
    t = c_target / b
    r = q_other / b
    # Guard — t must be > r (otherwise the trade can't be filled).
    if t <= r:
        raise ValueError("amount_nxt too small to produce any shares")
    log_diff = t + math.log1p(-math.exp(r - t))
    q_new_outcome = b * log_diff

    if outcome == "YES":
        new_q_yes = q_new_outcome
        new_q_no = q_no
        shares_received = new_q_yes - q_yes
    else:
        new_q_no = q_new_outcome
        new_q_yes = q_yes
        shares_received = new_q_no - q_no

    if shares_received <= 0:
        raise ValueError("no shares purchased (numerical underflow)")

    avg_price = float(amount) / shares_received

    return {
        "shares_received": Decimal(str(round(shares_received, 8))),
        "new_shares_yes": Decimal(str(round(new_q_yes, 8))),
        "new_shares_no": Decimal(str(round(new_q_no, 8))),
        "average_price": Decimal(str(round(avg_price, 6))),
    }


def calculate_value_to_sell(
    shares_yes,
    shares_no,
    liquidity_b,
    outcome: str,
    shares,
) -> dict:
    """How much NXT does selling ``shares`` of ``outcome`` return?

    Applies a fixed 3% slippage penalty on top of the raw LMSR refund
    to discourage churn. Returns ``{"value_before_penalty", "penalty_nxt",
    "value_after_penalty", "new_shares_yes", "new_shares_no",
    "average_price"}`` as Decimals.
    """
    _check_outcome(outcome)
    s = _d(shares)
    if s <= 0:
        raise ValueError("shares must be positive")
    q_yes = float(_d(shares_yes))
    q_no = float(_d(shares_no))
    b = float(_d(liquidity_b))
    if b <= 0:
        raise ValueError("liquidity_b must be positive")

    s_f = float(s)
    if outcome == "YES":
        if s_f > q_yes:
            raise ValueError("not enough YES shares in the pool")
        new_q_yes = q_yes - s_f
        new_q_no = q_no
    else:
        if s_f > q_no:
            raise ValueError("not enough NO shares in the pool")
        new_q_yes = q_yes
        new_q_no = q_no - s_f

    c_start = _cost_logsumexp(q_yes, q_no, b)
    c_end = _cost_logsumexp(new_q_yes, new_q_no, b)
    raw_value = c_start - c_end
    if raw_value <= 0:
        raise ValueError("sell would return no NXT (numerical underflow)")

    penalty = raw_value * 0.03
    net_value = raw_value - penalty
    avg_price = net_value / s_f

    return {
        "value_before_penalty": Decimal(str(round(raw_value, 6))),
        "penalty_nxt": Decimal(str(round(penalty, 6))),
        "value_after_penalty": Decimal(str(round(net_value, 6))),
        "new_shares_yes": Decimal(str(round(new_q_yes, 8))),
        "new_shares_no": Decimal(str(round(new_q_no, 8))),
        "average_price": Decimal(str(round(avg_price, 6))),
    }
