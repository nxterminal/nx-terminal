"""Routes: Admin — internal observability endpoints.

Access is gated by the ``X-Admin-Wallet`` header which must match a
wallet in ``ADMIN_WALLETS``. This mirrors the gate used by
``simulation.py::force_claim_sync`` so operators only learn one pattern.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from backend.api.deps import get_db
from backend.services.admin_log import log_event


router = APIRouter()


# Kept in sync with backend/api/routes/simulation.py::ADMIN_WALLETS.
# Duplicated here rather than imported to avoid a circular import and
# to make the admin gate self-contained for future admin endpoints.
ADMIN_WALLETS = {
    "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc",  # treasury
    # Ticket admin — same wallet that receives `ticket_received`
    # notifications in backend/api/routes/notifications.py. Added so
    # the operator reading support tickets in-game can also reply to
    # them via the admin endpoints below.
    "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b",
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
    stuck_pending_count: int = 0,
    stuck_pending_oldest=None,
    stuck_pending_total_nxt: int = 0,
) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []

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

    if stuck_pending_count > 0:
        oldest_age_minutes: Optional[int] = None
        if stuck_pending_oldest is not None:
            try:
                from datetime import datetime, timezone
                oldest_age_minutes = int(
                    (datetime.now(timezone.utc) - stuck_pending_oldest)
                    .total_seconds() / 60
                )
            except Exception:  # noqa: BLE001
                oldest_age_minutes = None
        alerts.append({
            "severity": "warning",
            "type": "pending_fund_txs_slow",
            "message": (
                f"{stuck_pending_count} pending_fund_txs unresolved >10min "
                f"(total {stuck_pending_total_nxt} NXT)."
            ),
            "count": stuck_pending_count,
            "oldest_age_minutes": oldest_age_minutes,
            "total_amount_nxt": str(stuck_pending_total_nxt),
            "hint": (
                "Check pending_fund_txs. If stuck, use "
                "POST /api/admin/pending-funds/{id}/reset or run "
                "backfill_funds.py manually."
            ),
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

            # pending_fund_txs older than 10 min and still unresolved.
            # Under normal load the 30s worker drains these in < 2 min,
            # so >10min is already an early warning that ops should
            # investigate (likely reset + backfill) before users notice.
            try:
                cur.execute(
                    """
                    SELECT COUNT(*) AS n,
                           MIN(created_at) AS oldest,
                           COALESCE(SUM(amount_nxt), 0) AS total_nxt
                      FROM pending_fund_txs
                     WHERE resolved = false
                       AND created_at < NOW() - INTERVAL '10 minutes'
                    """
                )
                stuck = cur.fetchone()
                stuck_count = int(stuck["n"])
                stuck_oldest = stuck["oldest"]
                stuck_total = int(stuck["total_nxt"])
            except Exception:  # noqa: BLE001 — table may not exist in tests
                stuck_count, stuck_oldest, stuck_total = 0, None, 0

    signer = _fetch_signer_state()

    dry_run = os.getenv("DRY_RUN", "true").lower() != "false"

    alerts = _build_alerts(
        dry_run=dry_run,
        signer=signer,
        salary_hours=salary_hours,
        stuck_pending_count=stuck_count,
        stuck_pending_oldest=stuck_oldest,
        stuck_pending_total_nxt=stuck_total,
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


# ── Admin: reset the retry counter on a stuck pending fund ────────
@router.post("/pending-funds/{pending_id}/reset")
async def admin_reset_pending_fund(pending_id: int, request: Request) -> Dict[str, Any]:
    """Reset ``attempts``, ``last_attempt_at`` and ``last_error`` on a
    single unresolved ``pending_fund_txs`` row so ``process_pending_funds``
    picks it up again on its next tick. Never flips ``resolved`` —
    crediting still goes through the normal dedup-protected path. The
    reset itself is persisted in ``admin_logs`` for audit.
    """
    admin_wallet = _require_admin(request)
    if pending_id <= 0:
        raise HTTPException(status_code=400, detail="pending_id must be > 0")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, tx_hash, wallet_address, dev_token_id, resolved, "
                "attempts FROM pending_fund_txs WHERE id = %s FOR UPDATE",
                (pending_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Pending fund not found")
            if row["resolved"]:
                raise HTTPException(
                    status_code=400, detail="Pending fund already resolved"
                )

            cur.execute(
                "UPDATE pending_fund_txs "
                "SET attempts = 0, last_attempt_at = NULL, last_error = NULL "
                "WHERE id = %s",
                (pending_id,),
            )

            log_event(
                cur,
                event_type="admin_pending_fund_reset",
                wallet_address=admin_wallet,
                dev_token_id=row["dev_token_id"],
                payload={
                    "pending_fund_id": pending_id,
                    "tx_hash": row["tx_hash"],
                    "target_wallet": row["wallet_address"],
                    "prev_attempts": row["attempts"],
                },
            )

    return {
        "ok": True,
        "id": pending_id,
        "tx_hash": row["tx_hash"],
        "prev_attempts": row["attempts"],
    }


# ── Support tickets: admin inbox + in-game reply ─────────────────
#
# Users file tickets via POST /api/notifications/ticket, which inserts
# a row into support_tickets and pings the ticket-admin with a
# ticket_received notification. Before this module shipped, admins had
# no in-game tool to reply — they had to hand-write notifications via
# SQL. These two endpoints close the loop:
#
#   GET  /api/admin/tickets                → list open tickets + player name
#   POST /api/admin/tickets/{id}/reply     → mark replied, notify user
#
# Reply delivery reuses the existing notifications table (type
# `ticket_admin_reply`), so no SMTP / transactional-mail dep is added.


class _TicketReplyBody(BaseModel):
    text: str


@router.get("/tickets")
async def list_tickets(
    request: Request,
    status: str = Query(default="open"),
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    """Admin-only list of support tickets, most recent first.

    Default returns only `open` tickets — the admin workflow is to
    triage, reply (flips status to `replied`), and move on. Other
    valid values: `replied`, `archived`.
    """
    _require_admin(request)
    if status not in {"open", "replied", "archived"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    t.id, t.player_address, t.subject, t.message,
                    t.status, t.reply_text, t.replied_by, t.replied_at,
                    t.created_at,
                    p.display_name
                  FROM support_tickets t
                  LEFT JOIN players p
                    ON LOWER(p.wallet_address) = LOWER(t.player_address)
                 WHERE t.status = %s
                 ORDER BY t.created_at DESC
                 LIMIT %s
                """,
                (status, limit),
            )
            rows = cur.fetchall()

    return {
        "tickets": [dict(r) for r in rows],
        "count": len(rows),
    }


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: int,
    body: _TicketReplyBody,
    request: Request,
) -> Dict[str, Any]:
    """Admin reply to a support ticket. Marks the ticket replied,
    delivers the reply as an in-game notification to the user, and
    logs the action in admin_logs for audit."""
    admin = _require_admin(request)

    reply_text = (body.text or "").strip()
    if not reply_text:
        raise HTTPException(status_code=400, detail="Reply text cannot be empty")
    if len(reply_text) > 4000:
        raise HTTPException(status_code=400, detail="Reply text too long (max 4000 chars)")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, player_address, subject, status
                  FROM support_tickets
                 WHERE id = %s FOR UPDATE
                """,
                (ticket_id,),
            )
            ticket = cur.fetchone()
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            if ticket["status"] != "open":
                raise HTTPException(
                    status_code=400,
                    detail=f"Ticket already {ticket['status']}",
                )

            cur.execute(
                """
                UPDATE support_tickets
                   SET status = 'replied',
                       reply_text = %s,
                       replied_by = %s,
                       replied_at = NOW()
                 WHERE id = %s
                """,
                (reply_text, admin, ticket_id),
            )

            cur.execute(
                """
                INSERT INTO notifications (player_address, type, title, body)
                VALUES (%s, 'ticket_admin_reply', %s, %s)
                """,
                (
                    ticket["player_address"],
                    f"Reply from Admin: {ticket['subject']}",
                    reply_text,
                ),
            )

            log_event(
                cur,
                event_type="admin_ticket_reply",
                wallet_address=admin,
                payload={
                    "ticket_id": ticket_id,
                    "recipient": ticket["player_address"],
                    "reply_length": len(reply_text),
                },
            )

    return {
        "status": "replied",
        "ticket_id": ticket_id,
        "recipient": ticket["player_address"],
    }


