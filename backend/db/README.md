# `backend/db/` — Database schema source-of-truth

The single, canonical source of every NX Terminal table, index, view,
trigger, function, and seed-data row is **`backend/db/migrate.py`**.

```python
from backend.db.migrate import run_auto_migrations
run_auto_migrations()
```

`run_auto_migrations()` is idempotent — every `CREATE TABLE` /
`CREATE INDEX` / `CREATE MATERIALIZED VIEW` uses `IF NOT EXISTS`,
every `CREATE TRIGGER` is preceded by `DROP TRIGGER IF EXISTS`,
every `CREATE TYPE` is wrapped in a `duplicate_object` catch, every
seed `INSERT` uses `ON CONFLICT DO NOTHING`. Safe to call repeatedly.

## Callers

| Caller | Purpose |
|--------|---------|
| `backend/api/main.py` (lifespan) | Production API startup — runs every deploy |
| `backend/db/init_db.py` (CLI) | First-time provisioning of a new DB |
| `backend/tests/conftest.py` (session fixture) | Provides a production-equivalent schema for tests that opt in |

## Phase 5.3.5 — what changed, what didn't

**Changed:**
- `backend/api/main.py` — the inline 1044-line `_run_auto_migrations()`
  function was extracted verbatim into `migrate.py:run_auto_migrations`.
  `main.py:lifespan` now imports + calls it. Production behavior is
  byte-identical to before.
- `backend/db/init_db.py` — used to read `schema.sql` directly. Now
  calls `run_auto_migrations()`, which is a strict superset (schema.sql
  bootstrap + every per-phase migration).
- `backend/db/migrate.py` — new module containing the bootstrap SQL
  (formerly `schema.sql`, made idempotent) plus the auto-migration
  body verbatim from main.py.
- `backend/tests/conftest.py` — new file. Session-scoped fixture
  drops + recreates the `nx` schema and runs `run_auto_migrations()`
  once per test session. Tests that want a production-equivalent
  schema can rely on this; tests with their own `MINIMAL_SCHEMA` /
  custom bootstrap run as before.

**Latent bug fixed in passing**: the original `_run_auto_migrations`
ran `SELECT 1 FROM system_broadcasts WHERE id = 'welcome_backfill'`
BEFORE the `CREATE TABLE IF NOT EXISTS system_broadcasts`. On a fresh
DB the SELECT failed (table didn't exist) and aborted the whole
transaction. Production never hit this because earlier runs accumulated
the table; tests on a fresh DB did. The CREATE TABLE is now hoisted
above the SELECT.

**NOT changed in this PR (deferred to follow-ups)**:
- The 28 test files that have inline `MINIMAL_SCHEMA` constants and
  hand-tailored bootstrap fixtures keep using their existing pattern.
  Their `MINIMAL_SCHEMA` values were tailored per-test (e.g., `players`
  with no `corporation NOT NULL`, `devs` without FK constraints) —
  switching them to the production schema reveals ~145 cases where
  `INSERT INTO players (...) VALUES (...)` omits required columns or
  `TRUNCATE devs` fails for missing CASCADE. Each is a per-test fix
  and is out of scope for this "move-only refactor". A follow-up PR
  (Phase 5.3.5.x) can migrate test files one at a time.
- `schema.sql` and the `migration_*.sql` files remain on disk because
  `test_hack_raid_concurrency.py` still loads them. Once the test
  migration follow-up retires those references, the standalone SQL
  files can be deleted (see "Files retired in Phase 5.3.5" below for
  what they currently contain — historical reference only at that
  point).

## Adding a schema change

1. Append the necessary `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` /
   `CREATE INDEX IF NOT EXISTS` calls to `migrate.py`'s
   `run_auto_migrations()` body. Keep them idempotent.
2. The next deploy runs `run_auto_migrations()` from the API lifespan,
   which applies the new statements against the live DB. Already-
   applied statements no-op.
3. **Do not** add a corresponding `migration_*.sql` file — those are
   legacy artefacts kept around only until the test-fixture migration
   completes.

No Alembic. No revision IDs. No version table. The combination of
`IF NOT EXISTS` and `ON CONFLICT` is the version-control mechanism —
the live DB always converges on whatever the function describes.

## Files in this directory

| File | Status | Purpose |
|------|--------|---------|
| `migrate.py` | **Active** | Single source of schema truth (Phase 5.3.5). |
| `init_db.py` | **Active** | Fresh-DB provisioning CLI; calls `migrate.run_auto_migrations`. |
| `__init__.py` | **Active** | Package marker. |
| `schema.sql` | **Legacy, kept temporarily** | Loaded by `test_hack_raid_concurrency`; will be retired when tests migrate. |
| `migration_*.sql` | **Legacy, kept temporarily** | Same — `migration_mechanics.sql` is loaded by `test_hack_raid_concurrency`. |
| `academy_schema.sql` | **Active (separate)** | Academy tables, separately bootstrapped. |
| `sentinel_schema.sql` | **Active (separate)** | Mega Sentinel tables, separately bootstrapped. |
| `migrate_deploy_action.sql` | **Active (separate)** | One-shot deploy operation. |
| `reset_data.sql` | **Active (separate)** | Operational reset utility. |
| `setup.sh` | **Active (separate)** | DB provisioning script. |

The "separate" files remain as standalone SQL because they're either
manually-loaded (academy / sentinel) or operational utilities, not
part of the always-on migration flow.
