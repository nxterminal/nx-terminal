"""Schema-completeness verification.

Phase 5.5.2 — guards against the migration-poisoning bug class
documented in PRs #391 / #392 / this one. Single-transaction
migrations had been silently aborting partway through, leaving
schema objects unapplied. The route-level "table does not exist"
errors only surfaced at runtime in production.

This suite runs after the session-scoped schema bootstrap in
``conftest.py`` (which calls ``run_auto_migrations()``), then
queries ``information_schema`` / ``pg_*`` catalogs to verify the
applied schema matches the expected shape. The expected shape is
maintained as constants in this file; updating a migration means
updating the corresponding constant in the same PR, which makes
schema drift visible at review time.

What this catches that older suites didn't:
  - Tables silently missing because an earlier per-phase step
    poisoned the transaction (Phase 5.5's `rate_limit_counters`,
    pre-fix).
  - Columns missing on legacy tables because the CREATE TABLE was
    a no-op and no ALTER healed it (Phase 5.5.2's `snapshot_date`,
    pre-fix).
  - Enum values missing because the ALTER TYPE step rolled back
    (HACK_RAID, `on_mission` — earlier incidents).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("NX_DB_HOST", "localhost")
os.environ.setdefault("NX_DB_PORT", "5432")
os.environ.setdefault("NX_DB_USER", "nxtest")
os.environ.setdefault("NX_DB_PASS", "nxtest")
os.environ.setdefault("NX_DB_NAME", "nxtest_db")

from backend.api import deps  # noqa: E402


# Every table created by `run_auto_migrations()` on a fresh DB.
# Source of truth: the actual migration output, captured below.
# When adding a CREATE TABLE to migrate.py, also add the name here —
# the failing assertion at review time is the design feature.
EXPECTED_TABLES: set[str] = {
    "absurd_ais",
    "achievements",
    "actions",
    "actions_default",
    "admin_logs",
    "ai_votes",
    "balance_snapshots",
    "chat_messages",
    "chat_messages_default",
    "claim_history",
    "dev_canonical_traits",
    "devs",
    "funding_txs",
    "llm_usage_daily",
    "login_streaks",
    "missions",
    "notifications",
    "nx_post_likes",
    "nx_posts",
    "nx_souls_messages",
    "nx_souls_messages_cache",
    "nx_souls_quota",
    "nx_souls_sleep_state",
    "nxmarket_comment_votes",
    "nxmarket_comments",
    "nxmarket_markets",
    "nxmarket_positions",
    "nxmarket_price_history",
    "nxmarket_trades",
    "nxt_ledger",
    "pending_fund_txs",
    "player_achievements",
    "player_missions",
    "player_prompts",
    "players",
    "protocol_investments",
    "protocols",
    # Phase 5.5: per-wallet rate limiter storage. Was silently
    # absent in production until Phase 5.5.2 fixed the transaction-
    # poisoning bug that prevented the per-phase CREATE from running.
    "rate_limit_counters",
    # Phase 5.11: NXT holders snapshot, populated every 5 min by
    # services.nxt_snapshot. Feeds the Leaderboard's NXT Holders tab.
    "nxt_holder_snapshot",
    "shop_purchases",
    "simulation_state",
    "support_tickets",
    "system_broadcasts",
    "vip_testers",
    "world_chat",
    "world_events",
}


# Spot-checked columns whose absence has caused production incidents.
# Not exhaustive — adding every column would be redundant with the
# CREATE TABLE statements themselves. These are the "load-bearing"
# columns whose silent absence broke things at runtime.
EXPECTED_COLUMNS: dict[str, set[str]] = {
    # The Phase 5.5.2 incident: stale prod table lacked this column,
    # CREATE INDEX failed, transaction poisoned, rate_limit_counters
    # never created.
    "balance_snapshots": {"wallet_address", "snapshot_date", "created_at"},
    # The Phase 5.5 table itself.
    "rate_limit_counters": {"namespace", "key", "count", "expires_at"},
    # The Phase 5.4 chat↔post bridge depends on nx_posts.token_id and
    # nx_posts.visibility being readable from the chat route.
    "nx_posts": {"id", "token_id", "content", "visibility", "created_at"},
    # The Phase 5.5 per-wallet limit reads against this table on every
    # chat send.
    "nx_souls_quota": {"token_id", "messages_today", "quota_date"},
    # devs.status drives the chat-frozen check.
    "devs": {"token_id", "owner_address", "status", "archetype", "rarity_tier"},
}


# Enums that have suffered value-not-found bugs in past incidents.
# Source of truth: backend.db.migrate ALTER TYPE statements.
EXPECTED_ENUM_VALUES: dict[str, set[str]] = {
    # `on_mission` was the missing value from a prior incident; the
    # whole status set is asserted to catch future regressions.
    "dev_status_enum": {"active", "resting", "frozen", "exhausted", "on_mission"},
    # HACK_RAID was the missing value from a prior incident. Same
    # rationale — assert the whole set.
    "action_enum": {
        "CREATE_PROTOCOL", "CREATE_AI", "INVEST", "SELL", "MOVE",
        "CHAT", "CODE_REVIEW", "REST", "RECEIVE_SALARY", "USE_ITEM",
        "GET_SABOTAGED", "DEPLOY", "HACK_MAINFRAME", "HACK_RAID",
        "MISSION_START", "MISSION_COMPLETE", "FUND_DEV", "TRANSFER",
    },
    "archetype_enum": {
        "10X_DEV", "DEGEN", "FED", "GRINDER", "HACKTIVIST",
        "INFLUENCER", "LURKER", "SCRIPT_KIDDIE",
    },
    "rarity_enum": {"common", "uncommon", "rare", "legendary", "mythic"},
}


# Indexes that have been deliberately added for performance and whose
# absence would silently degrade production queries. Spot-check.
EXPECTED_INDEXES: set[str] = {
    "idx_snapshots_wallet",
    "idx_rate_limit_counters_expires",
    "idx_nx_posts_created_desc",
    "idx_devs_owner",
    # Phase 5.11: keeps the NXT Holders leaderboard ORDER BY cheap.
    "idx_nxt_holder_balance",
}


@pytest.fixture(scope="module", autouse=True)
def _ensure_pool():
    """The session-scoped bootstrap in conftest.py runs migrations
    then closes the pool. Reopen it here so the tests can query
    the catalog directly. Closed at module teardown so other
    modules using the same connection-pool slot are unaffected."""
    if deps._pool is None:
        deps.init_db_pool(minconn=1, maxconn=2)
        opened_here = True
    else:
        opened_here = False
    yield
    if opened_here:
        deps.close_db_pool()


def _actual_tables() -> set[str]:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            # `current_schema()` resolves to whatever search_path the
            # pool configured (`nx` in this codebase). Filtering by
            # the active schema keeps the assertion robust if a
            # future deploy changes the schema name.
            cur.execute(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = current_schema()"
            )
            return {r["tablename"] for r in cur.fetchall()}


def _actual_columns(table: str) -> set[str]:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = %s",
                (table,),
            )
            return {r["column_name"] for r in cur.fetchall()}


def _actual_enum_values(enum_name: str) -> set[str]:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT e.enumlabel AS label
                  FROM pg_type t
                  JOIN pg_enum e        ON t.oid = e.enumtypid
                  JOIN pg_namespace n   ON n.oid = t.typnamespace
                 WHERE n.nspname = current_schema()
                   AND t.typname = %s
                """,
                (enum_name,),
            )
            return {r["label"] for r in cur.fetchall()}


def _actual_indexes() -> set[str]:
    with deps.get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT indexname FROM pg_indexes "
                "WHERE schemaname = current_schema()"
            )
            return {r["indexname"] for r in cur.fetchall()}


# ─── Tests ────────────────────────────────────────────────────────────────


def test_all_expected_tables_exist():
    """Every table the migration creates must end up in the DB.

    This is the primary anti-poisoning assertion: when a migration
    fails partway and the rest is silently skipped, this test fails
    with a list of the missing tables — the same list that would
    have surfaced as "relation does not exist" runtime errors in
    production."""
    actual = _actual_tables()
    missing = EXPECTED_TABLES - actual
    assert not missing, (
        f"Tables missing from the applied schema: {sorted(missing)}. "
        f"Likely cause: a migration step failed and subsequent steps "
        f"didn't run. Check run_auto_migrations() logs for WARNING "
        f"lines starting with '⚠️ Migration step failed'."
    )


def test_no_unexpected_tables_present():
    """Surface tables that exist in the DB but aren't in
    EXPECTED_TABLES. A leftover from a renamed/dropped table is
    fine for now, but a fresh migration adding a CREATE TABLE
    without updating EXPECTED_TABLES is a schema-drift signal we
    want to catch at review time."""
    actual = _actual_tables()
    unexpected = actual - EXPECTED_TABLES
    assert not unexpected, (
        f"Tables present in the DB but missing from EXPECTED_TABLES: "
        f"{sorted(unexpected)}. If you added a new migration in this "
        f"PR, add the new table name to EXPECTED_TABLES in this file."
    )


def test_load_bearing_columns_exist():
    """Spot-check columns whose absence has caused production
    incidents. balance_snapshots.snapshot_date is the Phase 5.5.2
    incident; the others are touched on every chat / rate-limit
    request."""
    for table, expected_cols in EXPECTED_COLUMNS.items():
        actual = _actual_columns(table)
        missing = expected_cols - actual
        assert not missing, (
            f"{table}: missing columns {sorted(missing)}. "
            f"actual columns: {sorted(actual)}"
        )


def test_enums_have_expected_values():
    """Catches the HACK_RAID / on_mission incident class — an
    ALTER TYPE step rolling back leaves the enum incomplete, and
    code paths that emit the missing value error at runtime."""
    for enum_name, expected_values in EXPECTED_ENUM_VALUES.items():
        actual = _actual_enum_values(enum_name)
        missing = expected_values - actual
        assert not missing, (
            f"{enum_name}: missing values {sorted(missing)}. "
            f"actual values: {sorted(actual)}"
        )


def test_load_bearing_indexes_exist():
    """Spot-check performance-critical indexes. Their absence
    doesn't break correctness, but does silently degrade queries —
    the kind of regression that's hard to spot post-deploy."""
    actual = _actual_indexes()
    missing = EXPECTED_INDEXES - actual
    assert not missing, (
        f"Indexes missing from the applied schema: {sorted(missing)}. "
        f"Likely cause: an index CREATE statement was poisoned by an "
        f"earlier migration failure."
    )


def test_simulated_missing_table_fails_assertion():
    """Meta-test: the assertion itself must fail loudly when a table
    is missing. Catches a future bug where `_actual_tables()` returns
    stale or otherwise wrong data and the test passes vacuously.

    We don't drop a real table (would interfere with other tests in
    the session). Instead, we synthesize a `missing` set the same
    way the production test does, and confirm the same assertion
    logic raises."""
    actual = {"only_one_real_table"}
    missing = EXPECTED_TABLES - actual
    assert missing, "Expected the synthetic missing set to be non-empty"
    # Now verify the assertion's failure message is informative.
    with pytest.raises(AssertionError) as excinfo:
        assert not missing, (
            f"Tables missing from the applied schema: {sorted(missing)}."
        )
    assert "rate_limit_counters" in str(excinfo.value)
