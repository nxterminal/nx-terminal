"""Routes: Player notifications + support tickets"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.api.deps import fetch_one, fetch_all, get_db

log = logging.getLogger("nx_api")
router = APIRouter()

ADMIN_WALLET = "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b"


class TicketRequest(BaseModel):
    wallet: str
    subject: str
    message: str


@router.post("/ticket")
async def submit_ticket(req: TicketRequest):
    """Submit a support ticket. Rate-limited to 3/day/wallet."""
    addr = req.wallet.lower()
    if not req.subject.strip() or not req.message.strip():
        raise HTTPException(400, "Subject and message are required")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) as c FROM support_tickets
                WHERE player_address = %s
                  AND created_at > NOW() - INTERVAL '24 hours'
            """, (addr,))
            if cur.fetchone()["c"] >= 3:
                raise HTTPException(
                    429,
                    "Ticket limit reached (3/day). HR suggests "
                    "trying again tomorrow. Or not.",
                )

            cur.execute("""
                INSERT INTO support_tickets (player_address, subject, message)
                VALUES (%s, %s, %s) RETURNING id
            """, (addr, req.subject.strip()[:200], req.message.strip()[:2000]))
            ticket_id = cur.fetchone()["id"]

            cur.execute("""
                INSERT INTO notifications (player_address, type, title, body)
                VALUES (%s, 'ticket_sent', %s, %s)
            """, (addr,
                  req.subject.strip()[:200],
                  req.message.strip()[:2000]))

            cur.execute("""
                INSERT INTO notifications (player_address, type, title, body)
                VALUES (%s, 'ticket_response', %s, %s)
            """, (addr,
                  f"Re: {req.subject.strip()[:80]} — Ticket #{ticket_id}",
                  f"Your ticket has been received and filed under "
                  f"'things we might read eventually.'\n\n"
                  f"Ticket #{ticket_id}\n"
                  f"Response time: somewhere between 5 minutes and "
                  f"heat death of the universe.\n\n"
                  f"— NX Terminal Support Department\n"
                  f"   (We don't actually have a support department.)"))

            cur.execute("""
                INSERT INTO notifications (player_address, type, title, body)
                VALUES (%s, 'ticket_received', %s, %s)
            """, (ADMIN_WALLET,
                  f"[TICKET #{ticket_id}] {req.subject.strip()[:80]}",
                  f"From: {addr[:6]}...{addr[-4:]}\n"
                  f"Subject: {req.subject.strip()[:200]}\n\n"
                  f"{req.message.strip()[:2000]}"))

    log.info(f"Ticket #{ticket_id} from {addr[:8]}...")
    return {"success": True, "ticket_id": ticket_id}


@router.get("/{wallet}")
async def get_notifications(wallet: str, unread: bool = False, limit: int = 50):
    """Get notifications for a player wallet."""
    wallet = wallet.lower()
    if unread:
        return fetch_all(
            """SELECT id, type, title, body, read, dev_id, created_at
               FROM notifications
               WHERE player_address = %s AND read = FALSE
               ORDER BY created_at DESC LIMIT %s""",
            (wallet, limit)
        )
    return fetch_all(
        """SELECT id, type, title, body, read, dev_id, created_at
           FROM notifications
           WHERE player_address = %s
           ORDER BY created_at DESC LIMIT %s""",
        (wallet, limit)
    )


@router.post("/{notification_id}/read")
async def mark_read(notification_id: int):
    """Mark a notification as read."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE notifications SET read = TRUE WHERE id = %s RETURNING id",
                (notification_id,)
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Notification not found")
    return {"id": notification_id, "read": True}


@router.post("/{wallet}/read-all")
async def mark_all_read(wallet: str):
    """Mark all notifications as read for a wallet."""
    wallet = wallet.lower()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE notifications SET read = TRUE WHERE player_address = %s AND read = FALSE",
                (wallet,)
            )
            count = cur.rowcount
    return {"marked_read": count}
