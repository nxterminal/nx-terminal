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
`ALTER TYPE … ADD VALUE` is guarded by a `pg_enum` lookup, every
seed `INSERT` uses `ON CONFLICT DO NOTHING`. Safe to call repeatedly.

## Callers

| Caller | Purpose |
|--------|---------|
| `backend/api/main.py` (lifespan) | Production API startup — runs every deploy |
| `backend/db/init_db.py` (CLI) | First-time provisioning of a new DB |
| `backend/tests/conftest.py` (session fixture) | Test-suite schema bootstrap |

All three converge on the same function. Schema cannot drift between
environments because there is only one place to change.

## What was retired in Phase 5.3.5b

Phase 5.3.5 (PR #387) extracted the inline `_run_auto_migrations()`
out of `main.py` and made it the production source of truth — but
deferred test-fixture migration and kept the legacy `schema.sql` +
`migration_*.sql` files on disk because `test_hack_raid_concurrency`
still loaded them.

Phase 5.3.5b (this commit) finished the unification:

- **Three production enum values were missing from `migrate.py`**
  because they lived only in the standalone `migration_*.sql` files
  that PR #387 didn't absorb. A fresh DB provisioned via `init_db.py`
  would have lacked them, breaking disaster recovery. Added:
  - `dev_status_enum.on_mission` — used in 10 production sites
  - `action_enum.HACK_RAID` — used in `shop.py` raid INSERTs
  - `action_enum.MISSION_START` — used in `missions.py`
- **`backend/tests/_seed.py`** — `seed_player` + `seed_dev` helpers
  that supply NOT NULL columns (`corporation`, `name`, etc) and
  satisfy the `devs.owner_address` FK to players automatically.
- **28 deferred test files** dropped their inline `MINIMAL_SCHEMA`
  constants and now rely on the `conftest.py` session fixture's
  `run_auto_migrations()` call. INSERT call sites use the new seed
  helpers; TRUNCATE statements got `CASCADE` for FK compatibility.
- **The legacy `.sql` files were deleted**:

  ```
  schema.sql                          (542 lines)
  migration_admin_logs.sql            ( 35)
  migration_bugfix.sql                (  8)
  migration_caffeine.sql              (  4)
  migration_claim_history_status.sql  ( 27)
  migration_devs_sync_status.sql      ( 28)
  migration_funding.sql               ( 24)
  migration_mechanics.sql             ( 48)
  migration_missions.sql              (163)
  migration_nxt_ledger.sql            ( 61)
  migration_pending_funds.sql         ( 30)
  migration_pending_funds_backoff.sql ( 23)
  migration_phase22_canonical.sql     ( 96)
  migration_tickets_reply.sql         ( 20)
  migration_vitals.sql                (  9)
  ```

  Their content was either already in `migrate.py` or wasn't part of
  the always-on migration flow (and was reachable only via manual
  `psql -f`, which is no longer documented as a workflow).

## Adding a schema change

1. Append the necessary `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` /
   `CREATE INDEX IF NOT EXISTS` calls to `migrate.py`'s
   `run_auto_migrations()` body. Keep them idempotent.
2. **For new enum values**: use the `DO $$ BEGIN IF NOT EXISTS … THEN
   ALTER TYPE …; END IF; END $$;` pattern — never the bootstrap
   `CREATE TYPE` block (that breaks idempotency on existing DBs).
3. The next deploy runs `run_auto_migrations()` from the API lifespan,
   which applies the new statements against the live DB. Already-
   applied statements no-op.

No Alembic. No revision IDs. No version table. The combination of
`IF NOT EXISTS`, `ON CONFLICT`, and `pg_enum` guards is the version-
control mechanism — the live DB always converges on whatever the
function describes.

## Files in this directory

| File | Purpose |
|------|---------|
| `migrate.py` | Single source of schema truth — production tables, indexes, views, triggers, enums, seed data. |
| `init_db.py` | Fresh-DB provisioning CLI; calls `migrate.run_auto_migrations`. |
| `__init__.py` | Package marker. |
| `academy_schema.sql` | Academy tables, separately bootstrapped. |
| `sentinel_schema.sql` | Mega Sentinel tables, separately bootstrapped. |
| `migrate_deploy_action.sql` | One-shot deploy operation. |
| `reset_data.sql` | Operational reset utility. |
| `setup.sh` | DB provisioning script. |

The `.sql` files that remain are either separately-bootstrapped (academy
/ sentinel) or operational utilities, not part of the always-on migration
flow.
