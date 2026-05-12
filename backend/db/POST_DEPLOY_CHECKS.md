# Post-deploy schema verification

Use this checklist after a deploy that touched migrations (e.g.
this PR — Phase 5.5.2) to confirm production landed in the expected
state. Every check is read-only; no destructive operations.

## Connecting to the production DB

```bash
# Render dashboard → nx-db → "External Database URL"
# Or via the service's shell with the DATABASE_URL env var:
psql "$DATABASE_URL"
```

If you don't have direct DB access, run each query from a fresh
service shell:

```bash
render exec --service nx-terminal -- psql "$DATABASE_URL"
```

All queries below assume you are connected to the same database
the app talks to (`nxterminal` per `render.yaml`), with the
default `nx` search_path applied.

## Checks

### 1. Every expected table exists

```sql
SELECT tablename
  FROM pg_tables
 WHERE schemaname = current_schema()
 ORDER BY tablename;
```

**Expected**: 45 rows. The full set is in
`backend/tests/test_schema_completeness.py::EXPECTED_TABLES`. The
ones most likely to be missing on an under-migrated DB:

- `rate_limit_counters` — Phase 5.5 per-wallet rate limiter.
- Any table added in a PR that landed during the transaction-poisoning window.

### 2. `rate_limit_counters` specifically

```sql
SELECT EXISTS (
    SELECT 1 FROM pg_tables
     WHERE schemaname = current_schema()
       AND tablename = 'rate_limit_counters'
) AS present;
```

**Expected**: `present | t`.

If `f`: the migration didn't apply. Restart the service to re-run
`run_auto_migrations()` (it's called from `lifespan` in
`backend/api/main.py`). Watch startup logs for `WARNING` lines
starting with `⚠️ Migration step failed` and `⚠️ Bootstrap
failed` — those identify the failing step.

### 3. `balance_snapshots.snapshot_date` (the Phase 5.5.2 incident)

```sql
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = current_schema()
   AND table_name   = 'balance_snapshots'
 ORDER BY column_name;
```

**Expected** column set: `balance_claimable`, `balance_claimed`,
`balance_total_earned`, `created_at`, `id`, `snapshot_date`,
`wallet_address`.

If `snapshot_date` is missing on a deployed prod DB, the Phase
5.5.2 ALTER TABLE didn't run — check the bootstrap log for the
`⚠️ Bootstrap failed` line.

### 4. Critical enums

```sql
SELECT enumlabel
  FROM pg_type t
  JOIN pg_enum e      ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE n.nspname = current_schema()
   AND t.typname = 'dev_status_enum'
 ORDER BY e.enumsortorder;
```

**Expected** values: `active`, `resting`, `frozen`, `exhausted`,
`on_mission`.

```sql
SELECT enumlabel
  FROM pg_type t
  JOIN pg_enum e      ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
 WHERE n.nspname = current_schema()
   AND t.typname = 'action_enum'
 ORDER BY enumlabel;
```

**Expected** values include `HACK_RAID`, `HACK_MAINFRAME`,
`MISSION_COMPLETE`, `FUND_DEV`, `TRANSFER` plus all the canonical
action types. Full set in
`test_schema_completeness.py::EXPECTED_ENUM_VALUES["action_enum"]`.

### 5. Rate-limit counters end-to-end smoke test

This exercises the same INSERT/INCR pattern the live rate-limit
code uses. Idempotent; the cleanup DELETE at the end restores the
table to its pre-test state.

```sql
-- First write (or increment if a leftover row exists).
INSERT INTO rate_limit_counters (namespace, key, count, expires_at)
VALUES ('post_deploy_smoke', 'verify', 1,
        NOW() + INTERVAL '1 minute')
ON CONFLICT (namespace, key) DO UPDATE
    SET count = rate_limit_counters.count + 1
RETURNING count;

-- Second write — must succeed and increment.
INSERT INTO rate_limit_counters (namespace, key, count, expires_at)
VALUES ('post_deploy_smoke', 'verify', 1,
        NOW() + INTERVAL '1 minute')
ON CONFLICT (namespace, key) DO UPDATE
    SET count = rate_limit_counters.count + 1
RETURNING count;

-- Confirm count.
SELECT count FROM rate_limit_counters
 WHERE namespace = 'post_deploy_smoke';

-- Clean up.
DELETE FROM rate_limit_counters
 WHERE namespace = 'post_deploy_smoke';
```

**Expected**: the first INSERT returns `count | 1`, the second
returns `count | 2`, the SELECT returns `count | 2`, the DELETE
reports `DELETE 1`.

If any step errors with `relation "rate_limit_counters" does not
exist`: Check 2 above and re-run migrations.

### 6. Index spot-check

```sql
SELECT indexname
  FROM pg_indexes
 WHERE schemaname = current_schema()
 ORDER BY indexname;
```

Among the expected entries:

- `idx_snapshots_wallet` (would have been missing during the
  Phase 5.5.2 incident).
- `idx_rate_limit_counters_expires`.
- `idx_devs_owner`.
- `idx_nx_posts_created_desc`.

## What to do if any check fails

| Failure | Action |
|---|---|
| Missing table or column | Restart the service to re-run `run_auto_migrations()`. Watch the startup logs for `⚠️` lines that pinpoint the failing step. |
| Missing enum value | An `ALTER TYPE` step rolled back. Same fix — restart and inspect logs. |
| Smoke INSERT errors with "relation does not exist" | The migration definitely didn't apply for that table. Restart, inspect logs, and if the issue persists, fall back to applying the relevant migration SQL manually from `backend/db/migrate.py`. |
| Migration logs show `⚠️ Bootstrap failed` | The bootstrap is atomic — a failure here skips every per-phase migration. Read the embedded error message, fix the root cause in `_BOOTSTRAP_SQL`, redeploy. |
| Migration logs show many `⚠️ Migration step failed (continuing)` lines | The transaction restructure means subsequent steps still ran — but you have a real schema-drift bug. File a follow-up to address each failing step. |

## Why this checklist exists

This is the third time the project has hit transaction-poisoning
in migrations (after the `HACK_RAID` enum and the test
`MINIMAL_SCHEMA` incidents). The Phase 5.5.2 restructure addresses
the failure mode, and the
`backend/tests/test_schema_completeness.py` suite catches future
regressions in CI — but production schema state can still drift
through ad-hoc fixes, manual edits, or imports from older DBs.
This checklist is the manual verification ground truth.
