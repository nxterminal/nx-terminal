"""Routes: Player notifications"""

from fastapi import APIRouter, HTTPException
from backend.api.deps import fetch_one, fetch_all, get_db

router = APIRouter()


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
