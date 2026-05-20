"""Routes: Leaderboard"""

import re
from typing import Any

from fastapi import APIRouter, Query
from backend.api.deps import fetch_all, fetch_one, execute

router = APIRouter()


# Loose shape check for an EVM address. We don't 422 on a bad value:
# the spec's tolerance is "viewer_wallet null/vacío → comportamiento
# actual sin viewer", so anything that isn't a clean address falls
# back to "no viewer" rather than failing the whole leaderboard fetch.
_EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def _normalise_viewer(viewer_wallet: str | None) -> str | None:
    """Return a lowercased EVM address or None. Anything that doesn't
    look like an address (empty, malformed, wrong length) collapses
    to None so the caller renders without a viewer row."""
    if not viewer_wallet:
        return None
    if not _EVM_ADDRESS_RE.match(viewer_wallet):
        return None
    return viewer_wallet.lower()


@router.get("")
async def get_leaderboard(
    # 'reputation' kept for back-compat. The Leaderboard window no
    # longer renders a "By Reputation" tab as of Phase 5.11 — if you
    # need to fully retire this path, search for the regex pattern
    # first and confirm no caller depends on it.
    sort: str = Query("balance", pattern="^(balance|reputation)$"),
    limit: int = Query(50, le=200),
):
    """Get leaderboard. Uses materialized view for speed."""
    VIEW_ORDER = {"balance": "rank_balance", "reputation": "rank_reputation"}
    FALLBACK_ORDER = {"balance": "balance_nxt DESC", "reputation": "reputation DESC"}
    order = VIEW_ORDER[sort]          # safe — FastAPI regex guarantees key exists
    fallback = FALLBACK_ORDER[sort]

    try:
        return fetch_all(
            "SELECT * FROM leaderboard ORDER BY " + order + " ASC LIMIT %s",
            (limit,)
        )
    except Exception:
        # Fallback if materialized view not refreshed yet
        return fetch_all(
            "SELECT token_id, name, archetype, corporation, owner_address,"
            "       balance_nxt, reputation, protocols_created, ais_created, rarity_tier"
            " FROM devs WHERE status = 'active'"
            " ORDER BY " + fallback + " LIMIT %s",
            (limit,)
        )


@router.get("/corporations")
async def get_corporation_leaderboard():
    """Aggregated corporation leaderboard.

    `total_devs` counts every minted dev per corp regardless of
    `status` — operational state ('active'/'resting'/'frozen'/
    'on_mission'/'exhausted') is irrelevant to a "how many devs in
    this corp" tally.

    `total_balance` sums `nxt_holder_snapshot.balance` (on-chain, the
    same source NXT Holders consumes) — NOT `devs.balance_nxt` (the
    in-game ledger, which doesn't reflect real wallet holdings). Each
    wallet contributes its balance ONCE per corp it has devs in: a
    wallet with 5 devs in CORP_A counts its balance once for CORP_A;
    a wallet with devs in two corps contributes to both (intentional
    — wallets diversified across corps belong to each ranking).

    Serialized as NXT-integer (`FLOOR(base_units / 1e18)::BIGINT`) so
    the frontend stays on `Number(value)` without precision loss.
    Max realistic NXT ≈ 1e10; BIGINT holds up to ≈ 9.2e18.

    The three-CTE shape is deliberate: stat aggregates run directly
    over `devs` (no join, no row inflation); balance aggregates run
    over `DISTINCT (corp, wallet)` so a wallet's snapshot row joins
    once per corp, not once per dev. Folding them into a single
    `FROM devs LEFT JOIN ...` produced a cartesian explosion that
    multiplied COUNT/SUM by the number of devs per corp.
    """
    return fetch_all("""
        WITH dev_stats AS (
            SELECT corporation,
                   COUNT(*)                AS total_devs,
                   AVG(reputation)         AS avg_reputation,
                   SUM(protocols_created)  AS total_protocols
            FROM devs
            GROUP BY corporation
        ),
        corp_wallets AS (
            SELECT DISTINCT
                   corporation,
                   LOWER(owner_address) AS wallet
            FROM devs
        ),
        corp_balance AS (
            SELECT cw.corporation,
                   SUM(s.balance) AS total_balance_base
            FROM corp_wallets cw
            LEFT JOIN nxt_holder_snapshot s ON s.wallet = cw.wallet
            GROUP BY cw.corporation
        )
        SELECT ds.corporation,
               ds.total_devs,
               COALESCE(
                   FLOOR(cb.total_balance_base / POWER(10::NUMERIC, 18)),
                   0
               )::BIGINT                          AS total_balance,
               COALESCE(ds.avg_reputation, 0)     AS avg_reputation,
               COALESCE(ds.total_protocols, 0)    AS total_protocols
        FROM dev_stats ds
        LEFT JOIN corp_balance cb ON cb.corporation = ds.corporation
        ORDER BY total_balance DESC
    """)


# ── Viewer rank helpers (Phase 5.12) ──────────────────────────────────
#
# All three viewer-rank computations use COMPETITION RANKING:
#
#     rank = COUNT(wallets whose metric is STRICTLY greater) + 1
#
# Ties share a rank. Deterministic and order-independent (no tiebreaker
# needed). See issue #408 for why we don't reuse the materialized
# view's ROW_NUMBER scheme — it's non-deterministic on ties.
#
# The wallet's own metric is fetched via COALESCE-with-subquery in the
# same statement as the rank, so each endpoint adds exactly ONE extra
# round-trip per viewer (the top-N query is unchanged).
#
# `is_virtual_rank` is true when the wallet's metric is 0 — the rank
# is then equivalent to "first wallet with no activity yet" (N+1 where
# N is the count of wallets with the metric > 0). It's still a real
# competition rank, but it tells the UI "this user is effectively off
# the leaderboard for this metric".


def _compute_top_hackers_viewer(viewer: str, limit: int) -> dict[str, Any]:
    """Single statement: viewer's metrics + competition rank in one
    round-trip. CTE pre-aggregates wallet hacks once; scalar subqueries
    pluck the viewer's row and the gt-count off the same CTE."""
    row = fetch_one(
        """
        WITH wallet_hacks AS (
            SELECT LOWER(d.owner_address)            AS wallet,
                   COUNT(*)                          AS hacks,
                   COUNT(DISTINCT a.dev_id)          AS contributing_devs
            FROM actions a
            JOIN devs d ON d.token_id = a.dev_id
            WHERE a.action_type IN ('HACK_RAID', 'HACK_MAINFRAME')
              AND (a.details->>'success')::boolean = TRUE
              AND d.owner_address IS NOT NULL
              AND d.owner_address <> ''
            GROUP BY LOWER(d.owner_address)
        ),
        viewer_row AS (
            SELECT hacks, contributing_devs
            FROM wallet_hacks
            WHERE wallet = %s
        )
        SELECT
            COALESCE((SELECT hacks             FROM viewer_row), 0) AS hacks,
            COALESCE((SELECT contributing_devs FROM viewer_row), 0) AS contributing_devs,
            (SELECT COUNT(*) FROM wallet_hacks
             WHERE hacks > COALESCE((SELECT hacks FROM viewer_row), 0)) AS gt_count
        """,
        (viewer,),
    )
    hacks = int(row["hacks"])
    rank = int(row["gt_count"]) + 1
    is_virtual = hacks == 0
    return {
        "wallet": viewer,
        "rank": rank,
        "value": hacks,
        "secondary_value": int(row["contributing_devs"]),
        # `in_top` is "the viewer appears in the top-N list we just
        # returned". A virtual-rank wallet (metric = 0) doesn't appear
        # in the SELECT result by definition — it doesn't aggregate
        # any rows — so in_top stays False even if N+1 numerically
        # lands at or below the limit on small data sets.
        "in_top": (not is_virtual) and rank <= limit,
        "is_virtual_rank": is_virtual,
    }


def _compute_nxt_holders_viewer(viewer: str, limit: int) -> dict[str, Any]:
    """Same shape as the hackers helper but reads from
    nxt_holder_snapshot. If the viewer isn't in the snapshot table yet
    (e.g. they just connected and own no devs, so the 5-min job hasn't
    picked them up), COALESCE pins their balance to 0 and the rank
    collapses to the virtual-rank case (N+1 where N is wallets with
    balance > 0). We never sync-call eth_call here — see issue/spec
    discussion in PR description."""
    row = fetch_one(
        """
        WITH viewer_row AS (
            SELECT balance FROM nxt_holder_snapshot WHERE wallet = %s
        )
        SELECT
            -- This alias is named `balance` but the surrounding query
            -- has NO `ORDER BY balance` clause — the only comparison
            -- (`WHERE balance > ...`) lives in a scalar subquery
            -- scoped to nxt_holder_snapshot.balance (NUMERIC). If you
            -- ever add an ORDER BY in here, qualify the column
            -- (`nxt_holder_snapshot.balance`) or rename the alias —
            -- see test_nxt_holders_ranks_by_numeric_not_lexicographic
            -- for the bug this avoids.
            COALESCE((SELECT balance FROM viewer_row), 0)::TEXT AS balance,
            (SELECT COUNT(*) FROM nxt_holder_snapshot
             WHERE balance > COALESCE((SELECT balance FROM viewer_row), 0)) AS gt_count
        """,
        (viewer,),
    )
    balance_str = row["balance"]
    # balance is NUMERIC(78,0); int() handles arbitrary precision so we
    # don't lose digits on uint256-sized values. Comparison to 0 is the
    # is_virtual test.
    balance_int = int(balance_str)
    rank = int(row["gt_count"]) + 1
    is_virtual = balance_int == 0
    return {
        "wallet": viewer,
        "rank": rank,
        "value": balance_str,        # keep as TEXT for JS Number safety
        "secondary_value": None,     # only top-hackers has a second metric
        "in_top": (not is_virtual) and rank <= limit,
        "is_virtual_rank": is_virtual,
    }


def _compute_dev_collectors_viewer(viewer: str, limit: int) -> dict[str, Any]:
    """COUNT-per-owner CTE feeds both the viewer's count and the gt
    count for competition rank. Single round-trip."""
    row = fetch_one(
        """
        WITH wallet_devs AS (
            SELECT LOWER(owner_address) AS wallet, COUNT(*) AS dev_count
            FROM devs
            WHERE owner_address IS NOT NULL AND owner_address <> ''
            GROUP BY LOWER(owner_address)
        ),
        viewer_row AS (
            SELECT dev_count FROM wallet_devs WHERE wallet = %s
        )
        SELECT
            COALESCE((SELECT dev_count FROM viewer_row), 0) AS dev_count,
            (SELECT COUNT(*) FROM wallet_devs
             WHERE dev_count > COALESCE((SELECT dev_count FROM viewer_row), 0)) AS gt_count
        """,
        (viewer,),
    )
    dev_count = int(row["dev_count"])
    rank = int(row["gt_count"]) + 1
    is_virtual = dev_count == 0
    return {
        "wallet": viewer,
        "rank": rank,
        "value": dev_count,
        "secondary_value": None,
        "in_top": (not is_virtual) and rank <= limit,
        "is_virtual_rank": is_virtual,
    }


# ── Public endpoints ──────────────────────────────────────────────────


@router.get("/top-hackers")
async def get_top_hackers(
    limit: int = Query(50, le=200),
    viewer_wallet: str | None = Query(default=None),
):
    """Rank wallets by total successful hacks across all owned devs.

    "Successful hack" = an action row of type HACK_RAID OR
    HACK_MAINFRAME with `details->>'success' = 'true'`. Both
    action_types share the same `{"success": <bool>, ...}` shape so a
    single filter spans them.

    Response shapes:
      - No viewer_wallet  → list of top rows (back-compat with Phase 5.11).
      - Viewer provided   → {"top": [...], "viewer": {...}}.
    """
    top = fetch_all(
        """
        SELECT
            LOWER(d.owner_address)                AS wallet,
            COUNT(*)                              AS hacks_successful,
            COUNT(DISTINCT a.dev_id)              AS contributing_devs
        FROM actions a
        JOIN devs d ON d.token_id = a.dev_id
        WHERE a.action_type IN ('HACK_RAID', 'HACK_MAINFRAME')
          AND (a.details->>'success')::boolean = TRUE
          AND d.owner_address IS NOT NULL
          AND d.owner_address <> ''
        GROUP BY LOWER(d.owner_address)
        ORDER BY hacks_successful DESC, contributing_devs DESC
        LIMIT %s
        """,
        (limit,),
    )
    viewer = _normalise_viewer(viewer_wallet)
    if viewer is None:
        return top
    return {"top": top, "viewer": _compute_top_hackers_viewer(viewer, limit)}


@router.get("/nxt-holders")
async def get_nxt_holders(
    limit: int = Query(50, le=200),
    viewer_wallet: str | None = Query(default=None),
):
    """Rank wallets by on-chain $NXT balance.

    Reads from nxt_holder_snapshot, populated every 5min by
    services.nxt_snapshot.run_nxt_snapshot_tick. Returns the snapshot's
    max(updated_at) alongside the rows so the UI can render the
    "Updated Xmin ago" footer without a second round-trip.

    Balances are NUMERIC(78,0) in DB; serialised as strings so
    JavaScript Number imprecision doesn't truncate the high tail.

    Response shape: same as before, plus a `viewer` key when
    viewer_wallet is supplied. The viewer key is omitted (not null)
    when there's no viewer_wallet — keeps the back-compat shape exact.
    """
    holders = fetch_all(
        """
        SELECT wallet,
               balance::TEXT AS balance,
               updated_at
        FROM nxt_holder_snapshot
        -- Table-qualified to bypass postgres's ORDER BY name resolution
        -- rule: a bare `ORDER BY balance` would prefer the SELECT alias
        -- `balance` (TEXT) over the table column (NUMERIC) and sort
        -- lexicographically. See the regression test in
        -- test_leaderboard_new_tabs.py::test_nxt_holders_ranks_by_
        -- numeric_not_lexicographic for the exact production symptom.
        ORDER BY nxt_holder_snapshot.balance DESC
        LIMIT %s
        """,
        (limit,),
    )
    snapshot_age = fetch_one(
        "SELECT MAX(updated_at) AS updated_at FROM nxt_holder_snapshot",
        (),
    )
    response: dict[str, Any] = {
        "holders": holders,
        "snapshot_updated_at": snapshot_age["updated_at"] if snapshot_age else None,
    }
    viewer = _normalise_viewer(viewer_wallet)
    if viewer is not None:
        response["viewer"] = _compute_nxt_holders_viewer(viewer, limit)
    return response


@router.get("/dev-collectors")
async def get_dev_collectors(
    limit: int = Query(50, le=200),
    viewer_wallet: str | None = Query(default=None),
):
    """Rank wallets by Dev (aNFT) count. Pure DB read — ownership in
    the devs table is the source of truth, no on-chain pull needed.

    Response shapes:
      - No viewer_wallet  → list of top rows (back-compat with Phase 5.11).
      - Viewer provided   → {"top": [...], "viewer": {...}}.
    """
    top = fetch_all(
        """
        SELECT
            LOWER(owner_address) AS wallet,
            COUNT(*)             AS dev_count
        FROM devs
        WHERE owner_address IS NOT NULL AND owner_address <> ''
        GROUP BY LOWER(owner_address)
        ORDER BY dev_count DESC
        LIMIT %s
        """,
        (limit,),
    )
    viewer = _normalise_viewer(viewer_wallet)
    if viewer is None:
        return top
    return {"top": top, "viewer": _compute_dev_collectors_viewer(viewer, limit)}


@router.post("/refresh")
async def refresh_leaderboard():
    """Manually refresh the materialized view (normally done by engine)."""
    try:
        execute("REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard")
        return {"status": "refreshed"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
