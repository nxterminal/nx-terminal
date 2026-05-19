"""Nickname gate for sensitive endpoints.

Called from inside route handlers (not as a Starlette middleware)
because gated endpoints carry the wallet in different shapes —
request body, path param, query string — and a single middleware
would have to special-case each. A helper called explicitly is the
clearer surface.

Behaviour:
  - Wallet has a nickname (display_name IS NOT NULL and non-empty):
    return silently — handler continues.
  - Wallet has no player row yet (e.g. wallet connected but never
    minted): return silently. We don't gate users who haven't done
    anything yet; they'll create their player row on first mint via
    the listener, then hit this gate on the next sensitive action.
  - Wallet exists with display_name IS NULL: raise 409 with the
    structured error code `nickname_required`. The frontend listens
    for this code and opens the onboarding modal.

Shape of the 409 body matches the rest of the API (HTTPException
detail dict with `error` + `message` keys, e.g. `no_targets`,
`insufficient_funds`, `low_social` in shop.py).

DB failures fail open. A pool outage degrading the gate to "no gate"
is the right failure mode — better than blocking every sensitive
action across the app on a transient DB hiccup.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException

from backend.api.deps import fetch_one


log = logging.getLogger(__name__)


def require_nickname(wallet: str) -> None:
    """Raise 409 nickname_required if `wallet` has a player row with
    no nickname set. Callers pass an already-lowercased wallet — see
    `validate_wallet` in backend/api/deps.py.
    """
    try:
        row = fetch_one(
            "SELECT display_name FROM players WHERE wallet_address = %s",
            (wallet.lower(),),
        )
    except Exception as exc:  # noqa: BLE001
        log.error("nickname_gate.db_error wallet=%s error=%s", wallet, exc)
        return  # fail open

    if row is None:
        return  # no player row yet — gate is silent

    dn = row.get("display_name")
    if dn is not None and dn.strip():
        return  # nickname set — handler proceeds

    raise HTTPException(409, detail={
        "error": "nickname_required",
        "message": "Choose a nickname to continue.",
    })
