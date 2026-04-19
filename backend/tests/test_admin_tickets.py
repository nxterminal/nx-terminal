"""
PR #310 — admin inbox + in-game reply for support tickets.

Covers both endpoints end-to-end against a minimal `nx` schema:
  GET  /api/admin/tickets
  POST /api/admin/tickets/{id}/reply

Each test hits the async endpoint directly via asyncio.run so we
don't have to spin up an HTTP client. The DB pool is wired the same
way as the other admin-route test suites (see test_admin_pending_funds).
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest
from fastapi import HTTPException

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.api.routes import admin as admin_route  # noqa: E402
from backend.api.routes.admin import _TicketReplyBody  # noqa: E402


# Ticket-admin wallet that /api/admin/tickets* must accept.
TICKET_ADMIN = "0xae882a8933b33429f53b7cee102ef3dbf9c9e88b"
TREASURY_ADMIN = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
USER_WALLET = "0x" + "d" * 40


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TYPE corporation_enum AS ENUM (
    'CLOSED_AI','MISANTHROPIC','SHALLOW_MIND',
    'ZUCK_LABS','Y_AI','MISTRIAL_SYSTEMS'
);

CREATE TABLE players (
    wallet_address VARCHAR(42) PRIMARY KEY,
    display_name   VARCHAR(30),
    corporation    corporation_enum NOT NULL DEFAULT 'CLOSED_AI'
);

CREATE TABLE support_tickets (
    id             SERIAL PRIMARY KEY,
    player_address VARCHAR(42) NOT NULL,
    subject        TEXT NOT NULL,
    message        TEXT NOT NULL,
    status         TEXT DEFAULT 'open',
    reply_text     TEXT,
    replied_by     VARCHAR(42),
    replied_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id             BIGSERIAL PRIMARY KEY,
    player_address VARCHAR(42) NOT NULL,
    type           TEXT NOT NULL,
    title          TEXT NOT NULL,
    body           TEXT,
    read           BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
);

CREATE TABLE admin_logs (
    id             BIGSERIAL PRIMARY KEY,
    correlation_id UUID,
    event_type     TEXT NOT NULL,
    wallet_address VARCHAR(42),
    dev_token_id   BIGINT,
    payload        JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def _direct_connect():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=os.environ["NX_DB_PORT"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
        dbname=os.environ["NX_DB_NAME"],
        options="-c search_path=nx",
    )


class _FakeRequest:
    def __init__(self, headers=None):
        self.headers = headers or {}


@pytest.fixture(scope="module", autouse=True)
def schema_and_pool():
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()

    deps.DB_HOST = os.environ["NX_DB_HOST"]
    deps.DB_PORT = int(os.environ["NX_DB_PORT"])
    deps.DB_USER = os.environ["NX_DB_USER"]
    deps.DB_PASS = os.environ["NX_DB_PASS"]
    deps.DB_NAME = os.environ["NX_DB_NAME"]
    deps.DB_SSLMODE = "disable"
    deps.init_db_pool(minconn=1, maxconn=4)
    yield
    deps.close_db_pool()


@pytest.fixture(autouse=True)
def clean():
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            "TRUNCATE admin_logs, notifications, support_tickets, players "
            "RESTART IDENTITY CASCADE"
        )
    conn.close()
    yield


def _insert_ticket(
    *,
    player=USER_WALLET,
    subject="help pls",
    message="something broke",
    status="open",
    display_name=None,
):
    conn = _direct_connect()
    conn.autocommit = True
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if display_name:
            cur.execute(
                "INSERT INTO players (wallet_address, display_name) "
                "VALUES (%s, %s) ON CONFLICT (wallet_address) DO UPDATE SET display_name = EXCLUDED.display_name",
                (player, display_name),
            )
        cur.execute(
            """
            INSERT INTO support_tickets (player_address, subject, message, status)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            (player, subject, message, status),
        )
        row = cur.fetchone()
    conn.close()
    return row["id"]


def _ticket_row(tid):
    conn = _direct_connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM support_tickets WHERE id = %s", (tid,))
    row = cur.fetchone()
    conn.close()
    return row


def _notifications_for(wallet, *, type_=None):
    conn = _direct_connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    if type_:
        cur.execute(
            "SELECT type, title, body FROM notifications "
            "WHERE player_address = %s AND type = %s ORDER BY id",
            (wallet, type_),
        )
    else:
        cur.execute(
            "SELECT type, title, body FROM notifications "
            "WHERE player_address = %s ORDER BY id",
            (wallet,),
        )
    rows = cur.fetchall()
    conn.close()
    return rows


def _audit_rows(event_type):
    conn = _direct_connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT event_type, wallet_address, payload FROM admin_logs "
        "WHERE event_type = %s ORDER BY id",
        (event_type,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def _call_list(*, wallet=TICKET_ADMIN, status="open", limit=50):
    req = _FakeRequest({"X-Admin-Wallet": wallet} if wallet is not None else {})
    return asyncio.run(
        admin_route.list_tickets(request=req, status=status, limit=limit)
    )


def _call_reply(ticket_id, text, *, wallet=TICKET_ADMIN):
    req = _FakeRequest({"X-Admin-Wallet": wallet} if wallet is not None else {})
    return asyncio.run(
        admin_route.reply_to_ticket(
            ticket_id=ticket_id,
            body=_TicketReplyBody(text=text),
            request=req,
        )
    )


# ---------------------------------------------------------------------------
# GET /api/admin/tickets
# ---------------------------------------------------------------------------


def test_list_tickets_requires_admin_wallet():
    _insert_ticket()
    with pytest.raises(HTTPException) as exc:
        _call_list(wallet=None)
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        _call_list(wallet="0x" + "9" * 40)
    assert exc.value.status_code == 403


def test_list_tickets_accepts_both_treasury_and_ticket_admin():
    """Treasury wallet + the dedicated ticket-admin wallet both pass."""
    _insert_ticket()
    for w in (TICKET_ADMIN, TREASURY_ADMIN, TICKET_ADMIN.upper()):
        res = _call_list(wallet=w)
        assert res["count"] == 1


def test_list_tickets_returns_open_only_by_default():
    _insert_ticket(subject="open one")
    _insert_ticket(subject="replied one", status="replied")

    res = _call_list()
    assert res["count"] == 1
    assert res["tickets"][0]["subject"] == "open one"

    res_replied = _call_list(status="replied")
    assert res_replied["count"] == 1
    assert res_replied["tickets"][0]["subject"] == "replied one"


def test_list_tickets_joins_display_name():
    _insert_ticket(display_name="wabersky")
    res = _call_list()
    assert res["tickets"][0]["display_name"] == "wabersky"


def test_list_tickets_handles_ticket_from_wallet_without_player_row():
    """LEFT JOIN means a ticket from a wallet that has no players row
    still comes back — display_name is just null."""
    _insert_ticket()
    res = _call_list()
    assert res["count"] == 1
    assert res["tickets"][0]["display_name"] is None


def test_list_tickets_rejects_invalid_status():
    with pytest.raises(HTTPException) as exc:
        _call_list(status="garbage")
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/admin/tickets/{id}/reply
# ---------------------------------------------------------------------------


def test_reply_marks_ticket_replied_and_creates_notification():
    tid = _insert_ticket(player=USER_WALLET, subject="help")
    res = _call_reply(tid, "Try restarting")

    assert res["status"] == "replied"
    assert res["ticket_id"] == tid

    row = _ticket_row(tid)
    assert row["status"] == "replied"
    assert row["reply_text"] == "Try restarting"
    assert row["replied_by"] == TICKET_ADMIN
    assert row["replied_at"] is not None

    notifs = _notifications_for(USER_WALLET, type_="ticket_admin_reply")
    assert len(notifs) == 1
    assert "help" in notifs[0]["title"]
    assert notifs[0]["body"] == "Try restarting"


def test_reply_logs_to_admin_logs():
    tid = _insert_ticket(player=USER_WALLET, subject="issue")
    _call_reply(tid, "thanks for the report")

    rows = _audit_rows("admin_ticket_reply")
    assert len(rows) == 1
    assert rows[0]["wallet_address"] == TICKET_ADMIN
    payload = rows[0]["payload"]
    assert payload["ticket_id"] == tid
    assert payload["recipient"] == USER_WALLET
    assert payload["reply_length"] == len("thanks for the report")


def test_reply_requires_admin_wallet():
    tid = _insert_ticket()
    with pytest.raises(HTTPException) as exc:
        _call_reply(tid, "nope", wallet="0x" + "9" * 40)
    assert exc.value.status_code == 403
    # Ticket untouched; no notification; no audit row.
    assert _ticket_row(tid)["status"] == "open"
    assert _notifications_for(USER_WALLET, type_="ticket_admin_reply") == []
    assert _audit_rows("admin_ticket_reply") == []


def test_reply_rejects_already_replied_ticket():
    tid = _insert_ticket(status="replied")
    with pytest.raises(HTTPException) as exc:
        _call_reply(tid, "second reply")
    assert exc.value.status_code == 400
    assert "replied" in exc.value.detail.lower()


def test_reply_rejects_empty_text():
    tid = _insert_ticket()
    for txt in ("", "   ", "\t\n"):
        with pytest.raises(HTTPException) as exc:
            _call_reply(tid, txt)
        assert exc.value.status_code == 400
    # Ticket stayed open
    assert _ticket_row(tid)["status"] == "open"


def test_reply_rejects_oversize_text():
    tid = _insert_ticket()
    with pytest.raises(HTTPException) as exc:
        _call_reply(tid, "x" * 4001)
    assert exc.value.status_code == 400
    assert _ticket_row(tid)["status"] == "open"


def test_reply_returns_404_for_unknown_ticket():
    with pytest.raises(HTTPException) as exc:
        _call_reply(999999, "anybody home")
    assert exc.value.status_code == 404
