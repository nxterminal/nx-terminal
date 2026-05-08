"""Session-scoped schema bootstrap for the test suite.

Phase 5.3.5 — replaces the per-file `MINIMAL_SCHEMA` constants and
the standalone `schema.sql + migration_*.sql` file loaders that
each of the 28 DB-dependent test files used to define inline.

How it works:
  1. On pytest session start (before any test fixture runs), this
     conftest's `_bootstrap_schema` autouse fixture connects raw,
     drops + recreates the `nx` schema, opens a temporary connection
     pool, runs `backend.db.migrate.run_auto_migrations()`, then
     closes the temporary pool.
  2. After yield, every test module's own `db_pool` / `app` fixture
     opens its own pool against the now-fully-migrated DB. Per-test
     `clean` / `clean_db` fixtures TRUNCATE specific tables for
     isolation between tests within a module.

Why session-scoped, not function-scoped: schema bootstrap is
expensive (~1.5s for the full migrate). Per-test recreation would
balloon the suite from ~17s to >10min. Per-test cleanup is handled
by each module's existing TRUNCATE fixtures, which are fine for
isolation against shared schema.

DATABASE_URL is explicitly popped so tests can't accidentally talk
to a real prod DB if the env happens to have it set. The
NX_DB_* defaults match what every test's own setdefault block
expects (nxtest:nxtest@localhost/nxtest_db).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
import pytest


# Make `backend.*` imports work from any test file without each one
# having to insert REPO_ROOT into sys.path. (Most do today, but
# centralising it here means new tests don't need the boilerplate.)
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _set_test_db_env() -> None:
    """Apply the test-DB environment defaults. Uses setdefault so a
    real CI / local override (e.g. running against a docker postgres
    on a different port) wins. DATABASE_URL is explicitly popped to
    avoid accidentally aiming the test pool at production."""
    os.environ.pop("DATABASE_URL", None)
    os.environ.setdefault("NX_DB_HOST", "localhost")
    os.environ.setdefault("NX_DB_PORT", "5432")
    os.environ.setdefault("NX_DB_NAME", "nxtest_db")
    os.environ.setdefault("NX_DB_USER", "nxtest")
    os.environ.setdefault("NX_DB_PASS", "nxtest")
    os.environ.setdefault("NX_DB_SCHEMA", "nx")


@pytest.fixture(scope="session", autouse=True)
def _bootstrap_schema():
    """Drop + recreate `nx` schema and run all migrations once per
    session. Every DB-dependent test file relies on this — the per-
    file MINIMAL_SCHEMA constants from before Phase 5.3.5 have been
    deleted in favour of this single source of truth."""
    _set_test_db_env()

    # Step 1: drop + recreate `nx` schema via raw connection. Done
    # outside any pool so a leftover pool from a previous interrupted
    # session can't hold open connections that block CASCADE.
    conn = psycopg2.connect(
        host=os.environ["NX_DB_HOST"],
        port=int(os.environ["NX_DB_PORT"]),
        dbname=os.environ["NX_DB_NAME"],
        user=os.environ["NX_DB_USER"],
        password=os.environ["NX_DB_PASS"],
    )
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA IF EXISTS nx CASCADE")
    conn.close()

    # Step 2: open a temporary pool, run migrations, close pool.
    # Tests then open their own per-module pool for the actual
    # test runs.
    from backend.api import deps
    deps.init_db_pool(minconn=1, maxconn=2)
    try:
        from backend.db.migrate import run_auto_migrations
        run_auto_migrations()
    finally:
        deps.close_db_pool()

    yield
