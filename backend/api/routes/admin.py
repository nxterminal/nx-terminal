"""Routes: Admin — internal observability endpoints.

Access is gated by the ``X-Admin-Wallet`` header which must match a
wallet in ``ADMIN_WALLETS``. This mirrors the gate used by
``simulation.py::force_claim_sync`` so operators only learn one pattern.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request

from backend.api.deps import get_db


router = APIRouter()


# Kept in sync with backend/api/routes/simulation.py::ADMIN_WALLETS.
# Duplicated here rather than imported to avoid a circular import and
# to make the admin gate self-contained for future admin endpoints.
ADMIN_WALLETS = {
    "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc",  # treasury
}


def _require_admin(request: Request) -> str:
    wallet = (request.headers.get("X-Admin-Wallet") or "").strip().lower()
    if wallet not in ADMIN_WALLETS:
        raise HTTPException(status_code=403, detail="Admin only")
    return wallet


def _fetch_signer_state() -> Dict[str, Any]:
    """Look up signer ETH balance and nonce state on-chain.

    Returns a dict with ``address``, ``eth_balance_wei``, ``nonce_latest``,
    ``nonce_pending`` or an ``error`` string if anything went wrong. Never
    raises — operators should see a summary even if the RPC is down.
    """
    state: Dict[str, Any] = {
        "address": None,
        "eth_balance_wei": None,
        "nonce_latest": None,
        "nonce_pending": None,
        "error": None,
    }
    try:
        # Local imports: claim_sync pulls eth deps and shouldn't block
        # module load if they're missing in a reduced test env.
        from backend.engine.claim_sync import (  # noqa: WPS433
            SIGNER_PRIVATE_KEY,
            _rpc_call_sync,
        )
        from eth_account import Account  # noqa: WPS433

        if not SIGNER_PRIVATE_KEY:
            state["error"] = "signer_not_configured"
            return state

        addr = Account.from_key(SIGNER_PRIVATE_KEY).address
        state["address"] = addr
        state["eth_balance_wei"] = int(
            _rpc_call_sync("eth_getBalance", [addr, "latest"]), 16
        )
        state["nonce_latest"] = int(
            _rpc_call_sync("eth_getTransactionCount", [addr, "latest"]), 16
        )
        state["nonce_pending"] = int(
            _rpc_call_sync("eth_getTransactionCount", [addr, "pending"]), 16
        )
    except Exception as exc:  # noqa: BLE001
        state["error"] = str(exc)
    return state


def _serialise_hour(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _build_alerts(
    *,
    dry_run: bool,
    signer: Dict[str, Any],
    salary_hours: List[Dict[str, Any]],
) -> List[Dict[str, str]]:
    alerts: List[Dict[str, str]] = []

    if dry_run:
        alerts.append({
            "severity": "info",
            "message": "DRY_RUN enabled — no on-chain syncs happening",
        })

    eth_wei = signer.get("eth_balance_wei")
    if eth_wei is not None and eth_wei < 10**15:
        alerts.append({
            "severity": "critical",
            "message": f"Signer low ETH: {eth_wei / 1e18:.6f} ETH",
        })

    latest = signer.get("nonce_latest")
    pending = signer.get("nonce_pending")
    if latest is not None and pending is not None:
        gap = pending - latest
        if gap > 3:
            alerts.append({
                "severity": "warning",
                "message": f"Signer has {gap} pending txs (possible stuck)",
            })

    hours_multi = sum(1 for h in salary_hours if (h.get("batches") or 0) > 1)
    if hours_multi > 0:
        alerts.append({
            "severity": "warning",
            "message": (
                f"{hours_multi} hours in last 7d had multiple salary batches "
                "(possible engine restart)"
            ),
        })

    if signer.get("error"):
        alerts.append({
            "severity": "critical",
            "message": f"Signer unreachable: {signer['error']}",
        })

    return alerts


@router.get("/economy/summary")
async def economy_summary(request: Request) -> Dict[str, Any]:
    """Single-shot snapshot of the economic state: DB + on-chain + alerts."""
    _require_admin(request)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(SUM(balance_nxt), 0) AS total FROM devs")
            db_balance_sum = int(cur.fetchone()["total"])

            cur.execute(
                """
                SELECT COUNT(*) AS n, COALESCE(SUM(amount_net), 0) AS volume
                FROM claim_history
                WHERE claimed_at > NOW() - INTERVAL '24 hours'
                """
            )
            claims = cur.fetchone()
            claims_24h_count = int(claims["n"])
            claims_24h_volume = int(claims["volume"])

            cur.execute(
                """
                SELECT event_type, COUNT(*) AS n
                FROM admin_logs
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY event_type
                ORDER BY n DESC
                """
            )
            events_24h = [
                {"event_type": r["event_type"], "count": int(r["n"])}
                for r in cur.fetchall()
            ]

            cur.execute(
                """
                SELECT
                    DATE_TRUNC('hour', created_at) AS hour,
                    COUNT(*) AS batches,
                    COALESCE(SUM((payload->>'count')::int), 0) AS devs_paid,
                    COALESCE(SUM((payload->>'total_emitted')::bigint), 0) AS nxt_emitted
                FROM admin_logs
                WHERE event_type = 'salary_batch_paid'
                  AND created_at > NOW() - INTERVAL '7 days'
                GROUP BY 1
                ORDER BY 1 DESC
                """
            )
            salary_hours = [
                {
                    "hour": _serialise_hour(r["hour"]),
                    "batches": int(r["batches"]),
                    "devs_paid": int(r["devs_paid"]),
                    "nxt_emitted": int(r["nxt_emitted"]),
                }
                for r in cur.fetchall()
            ]

            cur.execute(
                "SELECT COUNT(DISTINCT owner_address) AS n FROM devs WHERE balance_nxt > 0"
            )
            active_players = int(cur.fetchone()["n"])

            cur.execute(
                """
                SELECT COUNT(*) AS n, COALESCE(SUM(balance_nxt), 0) AS total
                FROM devs
                WHERE balance_nxt > 0 AND status IN ('active', 'on_mission')
                """
            )
            pending = cur.fetchone()
            pending_count = int(pending["n"])
            pending_total = int(pending["total"])

    signer = _fetch_signer_state()

    dry_run = os.getenv("DRY_RUN", "true").lower() != "false"

    alerts = _build_alerts(
        dry_run=dry_run,
        signer=signer,
        salary_hours=salary_hours,
    )

    eth_wei = signer.get("eth_balance_wei")
    nonce_latest = signer.get("nonce_latest")
    nonce_pending = signer.get("nonce_pending")
    nonce_gap = (
        nonce_pending - nonce_latest
        if (nonce_pending is not None and nonce_latest is not None)
        else None
    )

    return {
        "circulation": {
            "db_balance_nxt_total": db_balance_sum,
            "active_players": active_players,
            "pending_sync_count": pending_count,
            "pending_sync_nxt": pending_total,
        },
        "signer": {
            "address": signer.get("address"),
            "eth_balance_wei": eth_wei,
            "eth_balance_display": (
                f"{eth_wei / 1e18:.6f}" if eth_wei is not None else None
            ),
            "nonce_latest": nonce_latest,
            "nonce_pending": nonce_pending,
            "nonce_gap": nonce_gap,
            "error": signer.get("error"),
        },
        "recent_activity": {
            "claims_24h_count": claims_24h_count,
            "claims_24h_volume_nxt": claims_24h_volume,
            "events_24h": events_24h,
            "salary_batches_7d": salary_hours[:24],
        },
        "config": {
            "dry_run": dry_run,
        },
        "alerts": alerts,
    }
