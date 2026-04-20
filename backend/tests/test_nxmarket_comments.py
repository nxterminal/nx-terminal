"""Tests for NXMARKET comments (PR C1).

Covers:
- Creation (4): success, empty, over 500, rate limit
- Listing (3): newest-first, pagination, per-wallet my_vote isolation
- Delete (4): own, not-own, admin, already-deleted
- Votes (4): like creates row, upsert like→dislike, none removes, my_vote
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.pop("DATABASE_URL", None)
os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_SCHEMA", "nx")

from backend.api import deps  # noqa: E402
from backend.api.middleware.correlation import CorrelationIdMiddleware  # noqa: E402
from backend.api.routes import nxmarket as nxmarket_module  # noqa: E402


ADMIN_WALLET = "0x31d6e19aae43b5e2fbedb01b6ff82ad1e8b576dc"
USER_A = "0x" + "aa" * 20
USER_B = "0x" + "bb" * 20
USER_C = "0x" + "cc" * 20


MINIMAL_SCHEMA = """
DROP SCHEMA IF EXISTS nx CASCADE;
CREATE SCHEMA nx;
SET search_path TO nx;

CREATE TABLE nxmarket_markets (
    id                   BIGSERIAL PRIMARY KEY,
    question             TEXT NOT NULL,
    category             VARCHAR(40),
    market_type          VARCHAR(20) NOT NULL
                          CHECK (market_type IN ('official', 'user')),
    created_by           VARCHAR(42) NOT NULL,
    creator_fee_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
    seed_nxt             NUMERIC(20,2) NOT NULL,
    shares_yes           NUMERIC(30,8) NOT NULL,
    shares_no            NUMERIC(30,8) NOT NULL,
    liquidity_b          NUMERIC(20,2) NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'closed', 'resolved', 'invalid')),
    outcome              VARCHAR(10),
    close_at             TIMESTAMPTZ NOT NULL,
    resolved_at          TIMESTAMPTZ,
    resolved_by          VARCHAR(42),
    total_volume_nxt     NUMERIC(20,2) NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nxmarket_comments (
    id              BIGSERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES nxmarket_markets(id) ON DELETE CASCADE,
    wallet_address  VARCHAR(42) NOT NULL,
    body            TEXT NOT NULL
                      CHECK (char_length(body) > 0 AND char_length(body) <= 500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      VARCHAR(42)
);

CREATE TABLE nxmarket_comment_votes (
    id              BIGSERIAL PRIMARY KEY,
    comment_id      BIGINT NOT NULL REFERENCES nxmarket_comments(id) ON DELETE CASCADE,
    wallet_address  VARCHAR(42) NOT NULL,
    vote_type       VARCHAR(10) NOT NULL CHECK (vote_type IN ('like', 'dislike')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (comment_id, wallet_address)
);
"""


def _raw_connect():
    return psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=int(os.environ["NX_DB_PORT"]),
        dbname=os.environ["NX_DB_NAME"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
    )


@pytest.fixture(scope="module")
def app():
    conn = _raw_connect()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(MINIMAL_SCHEMA)
    conn.close()

    deps.init_db_pool(minconn=1, maxconn=4)
    fastapi_app = FastAPI()
    fastapi_app.add_middleware(CorrelationIdMiddleware)
    fastapi_app.include_router(
        nxmarket_module.router, prefix="/api/nxmarket"
    )

    try:
        yield fastapi_app
    finally:
        deps.close_db_pool()


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def clean_db(app):
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE nxmarket_comment_votes, nxmarket_comments, "
                "nxmarket_markets RESTART IDENTITY CASCADE"
            )


@pytest.fixture(autouse=True)
def _disable_rate_limit(monkeypatch):
    """Redis is not mocked here. Most tests don't want the 60s cooldown
    to interfere; the one that DOES (test_create_comment_rate_limited)
    overrides by re-enabling the real limiter."""
    from backend.api.routes import nxmarket as nxm
    called = {"count": 0}
    original = nxm.comment_limiter.check

    def noop(_key):
        called["count"] += 1
        return None

    monkeypatch.setattr(nxm.comment_limiter, "check", noop)
    yield called
    # Auto-restored by monkeypatch.


def _seed_market() -> int:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nxmarket_markets (
                    question, category, market_type, created_by,
                    seed_nxt, shares_yes, shares_no, liquidity_b,
                    status, close_at
                ) VALUES (
                    'Q?', 'crypto', 'official', %s,
                    500, 250, 250, 100,
                    'active', NOW() + INTERVAL '24 hours'
                ) RETURNING id
                """,
                (ADMIN_WALLET,),
            )
            r = cur.fetchone()
            return int(r["id"] if isinstance(r, dict) else r[0])


def _post_comment(client, market_id: int, wallet: str, body: str):
    return client.post(
        f"/api/nxmarket/markets/{market_id}/comments",
        json={"wallet": wallet, "body": body},
    )


# ---------------------------------------------------------------------------
# Creation (4)
# ---------------------------------------------------------------------------


def test_create_comment_success(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "Hello market!")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "comment_id" in body
    assert "created_at" in body


def test_create_comment_rejects_empty_body(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "   ")
    assert r.status_code == 400


def test_create_comment_rejects_body_over_500_chars(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "x" * 501)
    assert r.status_code == 400


def test_create_comment_rate_limited_within_minute(client, clean_db, monkeypatch):
    # Re-enable the real limiter for this test. Redis is not mocked —
    # but when redis is unreachable, the limiter fails open (returns
    # silently). To simulate the 429 path, stub the check to raise
    # directly on the second call.
    from backend.api.routes import nxmarket as nxm
    from fastapi import HTTPException
    calls = {"n": 0}

    def fake_check(_key):
        calls["n"] += 1
        if calls["n"] >= 2:
            raise HTTPException(429, "Rate limited. Try again in 60s.")

    monkeypatch.setattr(nxm.comment_limiter, "check", fake_check)

    m = _seed_market()
    r1 = _post_comment(client, m, USER_A, "First")
    assert r1.status_code == 200
    r2 = _post_comment(client, m, USER_A, "Second")
    assert r2.status_code == 429


# ---------------------------------------------------------------------------
# Listing (3)
# ---------------------------------------------------------------------------


def test_list_comments_newest_first(client, clean_db):
    m = _seed_market()
    _post_comment(client, m, USER_A, "first")
    time.sleep(0.01)
    _post_comment(client, m, USER_B, "second")
    time.sleep(0.01)
    _post_comment(client, m, USER_C, "third")

    r = client.get(f"/api/nxmarket/markets/{m}/comments")
    data = r.json()
    assert data["total_count"] == 3
    bodies = [c["body"] for c in data["comments"]]
    assert bodies == ["third", "second", "first"]


def test_list_comments_pagination(client, clean_db):
    m = _seed_market()
    for i in range(25):
        _post_comment(client, m, USER_A, f"c{i}")

    r1 = client.get(f"/api/nxmarket/markets/{m}/comments?limit=20&offset=0")
    d1 = r1.json()
    assert len(d1["comments"]) == 20
    assert d1["total_count"] == 25
    assert d1["has_more"] is True

    r2 = client.get(f"/api/nxmarket/markets/{m}/comments?limit=20&offset=20")
    d2 = r2.json()
    assert len(d2["comments"]) == 5
    assert d2["has_more"] is False


def test_list_comments_excludes_votes_of_other_wallets(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "vote on me")
    cid = r.json()["comment_id"]

    # USER_B likes it.
    client.post(f"/api/nxmarket/comments/{cid}/vote",
                json={"wallet": USER_B, "vote": "like"})

    # When USER_C lists, my_vote should be None (only USER_B's vote
    # contributes to the like_count, not to USER_C's my_vote).
    r = client.get(
        f"/api/nxmarket/markets/{m}/comments?wallet={USER_C}"
    )
    c = r.json()["comments"][0]
    assert c["like_count"] == 1
    assert c["my_vote"] is None

    # When USER_B lists with their own wallet, my_vote is 'like'.
    r = client.get(
        f"/api/nxmarket/markets/{m}/comments?wallet={USER_B}"
    )
    assert r.json()["comments"][0]["my_vote"] == "like"


# ---------------------------------------------------------------------------
# Delete (4)
# ---------------------------------------------------------------------------


def test_delete_own_comment_success(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "mine")
    cid = r.json()["comment_id"]
    r = client.delete(f"/api/nxmarket/comments/{cid}",
                      headers={"X-Wallet": USER_A})
    assert r.status_code == 200
    assert r.json()["deleted"] is True
    # Now listing shows it as deleted.
    r = client.get(f"/api/nxmarket/markets/{m}/comments")
    c = r.json()["comments"][0]
    assert c["is_deleted"] is True
    assert c["body"] == "[Comment deleted]"


def test_delete_other_users_comment_rejected_if_not_admin(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "not yours")
    cid = r.json()["comment_id"]
    r = client.delete(f"/api/nxmarket/comments/{cid}",
                      headers={"X-Wallet": USER_B})
    assert r.status_code == 403


def test_admin_can_delete_any_comment(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "naughty")
    cid = r.json()["comment_id"]
    r = client.delete(f"/api/nxmarket/comments/{cid}",
                      headers={"X-Wallet": ADMIN_WALLET})
    assert r.status_code == 200
    # Deleted_by recorded as admin.
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT deleted_by FROM nxmarket_comments WHERE id = %s",
                (cid,),
            )
            assert cur.fetchone()["deleted_by"] == ADMIN_WALLET


def test_delete_idempotent_rejects_already_deleted(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "once")
    cid = r.json()["comment_id"]
    r1 = client.delete(f"/api/nxmarket/comments/{cid}",
                       headers={"X-Wallet": USER_A})
    assert r1.status_code == 200
    r2 = client.delete(f"/api/nxmarket/comments/{cid}",
                       headers={"X-Wallet": USER_A})
    assert r2.status_code == 400


# ---------------------------------------------------------------------------
# Votes (4)
# ---------------------------------------------------------------------------


def test_vote_like_creates_vote_row(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "vote me")
    cid = r.json()["comment_id"]
    r = client.post(f"/api/nxmarket/comments/{cid}/vote",
                    json={"wallet": USER_B, "vote": "like"})
    assert r.status_code == 200
    body = r.json()
    assert body["like_count"] == 1
    assert body["dislike_count"] == 0
    assert body["my_vote"] == "like"


def test_vote_upsert_changes_from_like_to_dislike(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "flip vote")
    cid = r.json()["comment_id"]
    client.post(f"/api/nxmarket/comments/{cid}/vote",
                json={"wallet": USER_B, "vote": "like"})
    r = client.post(f"/api/nxmarket/comments/{cid}/vote",
                    json={"wallet": USER_B, "vote": "dislike"})
    body = r.json()
    # Same wallet: like replaced by dislike (UNIQUE constraint).
    assert body["like_count"] == 0
    assert body["dislike_count"] == 1
    assert body["my_vote"] == "dislike"
    # Confirm only one row exists (not two).
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM nxmarket_comment_votes "
                "WHERE comment_id = %s AND wallet_address = %s",
                (cid, USER_B.lower()),
            )
            assert int(cur.fetchone()["c"]) == 1


def test_vote_none_removes_existing_vote(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "toggle me")
    cid = r.json()["comment_id"]
    client.post(f"/api/nxmarket/comments/{cid}/vote",
                json={"wallet": USER_B, "vote": "like"})
    r = client.post(f"/api/nxmarket/comments/{cid}/vote",
                    json={"wallet": USER_B, "vote": "none"})
    body = r.json()
    assert body["like_count"] == 0
    assert body["my_vote"] is None


def test_my_vote_returned_in_list_when_wallet_provided(client, clean_db):
    m = _seed_market()
    r = _post_comment(client, m, USER_A, "votes list")
    cid = r.json()["comment_id"]
    client.post(f"/api/nxmarket/comments/{cid}/vote",
                json={"wallet": USER_B, "vote": "dislike"})

    r = client.get(
        f"/api/nxmarket/markets/{m}/comments?wallet={USER_B}"
    )
    c = r.json()["comments"][0]
    assert c["dislike_count"] == 1
    assert c["my_vote"] == "dislike"

    # Without wallet → my_vote is null.
    r = client.get(f"/api/nxmarket/markets/{m}/comments")
    c = r.json()["comments"][0]
    assert c["my_vote"] is None
