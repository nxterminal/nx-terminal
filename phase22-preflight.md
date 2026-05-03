# Phase 2.2 — Step 0 pre-flight verification

**Branch:** `claude/refactor-metadata-api-J1jMg`
**Verifier script:** [`backend/scripts/verify_phase22_preflight.py`](backend/scripts/verify_phase22_preflight.py)

---

## ⚠ This run did not execute against production

The build environment has no DB credentials. The verifier script is committed
and verified to fail-closed when creds are missing (exit code 1, helpful
error message). **A human with DB access must run it to populate §3 below.**

The script writes this file when it executes; rerunning overwrites the
"results pending" sections with real data and marks GO/HALT explicitly.

### How to run

```bash
# Render shell, recommended
python backend/scripts/verify_phase22_preflight.py

# Or local with the External DB URL (sslmode auto-selected)
DATABASE_URL='postgresql://USER:PASS@HOST:PORT/DBNAME' \
  python backend/scripts/verify_phase22_preflight.py
```

The script has the same 4-layer read-only safety as `probe_production.py`
(autocommit=False, `SET TRANSACTION READ ONLY`, static SELECT-only gate,
final `ROLLBACK`).

---

## 1. What this verifier checks

| Check | Why |
|---|---|
| Row counts for retired values: `social_style ∈ {Mentor, Troll}`, `coding_style = Copy Paste`, `work_ethic ∈ {Grinder, Steady, Balanced}` | Each must be 0 — otherwise the Phase 2.2 plan would orphan those rows |
| Row count for `coding_style = Speed Runner` | Tells us how many rows the rename touches (not a blocker — it's a rename, not a drop) |
| `data_type / udt_name` of `species`, `archetype`, `corporation`, `rarity_tier`, `mood`, `location`, `status`, `alignment`, `risk_level`, `social_style`, `coding_style`, `work_ethic` | Detects the schema-vs-brief drift documented in §2 below |
| Total minted Devs | Confirms probe's 163 figure |
| Energy `MIN/MAX/AVG` | Confirms probe's 0..100 finding (schema.sql still says ≤15) |
| `devs_burned` column existence | Step A drops it |
| `dev_status_enum` value list | Confirms `'on_mission'` was added at runtime; checks `'exhausted'` not yet present |
| `'GitHub HQ'` row count | Confirms the runtime-added value is dominant per probe |
| `personality_seed` health | Validates NX Souls derivation precondition |

---

## 2. Pre-flight finding from the repo (no DB needed)

While writing the verifier I noticed a **schema-vs-brief drift** that
materially affects Phase 2.2 Step 2. Surfacing it now so it can be
reconciled before any DDL runs.

The brief's §4.1 Step C and Step D operate on these enum types:

```sql
ALTER TYPE nx.social_style_enum  ADD VALUE 'Influencer';   -- and 'Silent'
ALTER TYPE nx.coding_style_enum  ADD VALUE 'Speedrun';     -- and 'Over-Engineer', 'Minimalist'
ALTER TYPE nx.coding_style_enum  RENAME VALUE 'Speed Runner' TO 'Speedrun';
ALTER TYPE nx.work_ethic_enum    ADD VALUE 'Casual';       -- and 'Dedicated'
```

But `backend/db/schema.sql:100-102` declares those columns as **plain
`VARCHAR(20)`**, not enum-typed:

```sql
social_style        VARCHAR(20),
coding_style        VARCHAR(20),
work_ethic          VARCHAR(20),
```

A repo-wide grep finds zero references to `social_style_enum`,
`coding_style_enum`, or `work_ethic_enum` in `schema.sql`,
`backend/api/main.py:_run_auto_migrations()`, or anywhere else. (The only
declared enums are: `archetype_enum, corporation_enum, location_enum,
mood_enum, rarity_enum, dev_status_enum, action_enum, chat_channel_enum,
protocol_status_enum`. None of the three the brief targets exist.)

If the production DB matches the repo schema — which the verifier confirms
in §3.3 — then:

- **Step C `ADD VALUE` statements would fail** with `type "..._enum" does not exist`.
  For VARCHAR columns, "adding a value" is a **no-op** — the column already
  accepts any string up to 20 chars. Just write the new value when needed.
- **Step D `RENAME VALUE` statement would fail** for the same reason. The
  rename for `Speed Runner → Speedrun` becomes a simple
  `UPDATE nx.devs SET coding_style = 'Speedrun' WHERE coding_style = 'Speed Runner'`.

Likewise for `species` (VARCHAR(20) per `schema.sql:90`): the brief's §4.5
"add new species values to enum" doesn't apply. The column already accepts
`Bunny`, `Zombie`, etc.

The verifier's §3.3 column-type probe will return `data_type = 'character
varying'` for these columns and `udt_name = 'varchar'` if the production
schema matches the repo. If instead these columns turn out to be enum-typed
(somebody migrated production without updating `schema.sql`), the brief's
Step C/D works as written and we'll see `data_type = 'USER-DEFINED'`,
`udt_name = '..._enum'`.

**Decision needed before Step 2 runs:** swap brief's Step C/D for the
VARCHAR-friendly version below, OR confirm production has these as enums
(in which case the brief is right and `schema.sql` needs updating
post-migration).

### Suggested VARCHAR-friendly replacement for Step C / Step D

```sql
-- Step C (no-op for VARCHAR — the column already accepts any 20-char string).
-- Optionally enforce a CHECK constraint if you want the column to behave
-- enum-like:
ALTER TABLE nx.devs ADD CONSTRAINT social_style_values
  CHECK (social_style IS NULL OR social_style IN
         ('Quiet','Social','Loud','Influencer','Silent'));
-- (Same pattern for coding_style and work_ethic, listing the union of
-- bundle values + any retired-but-still-in-use values from probe §3.1.)

-- Step D (rename in-place via UPDATE).
UPDATE nx.devs SET coding_style = 'Speedrun'
 WHERE coding_style = 'Speed Runner';
```

The CHECK constraint is optional but documents the value set in DB and
catches typos. It can be added now or deferred to Phase 3.

### Other small repo-side notes

- The brief says listener lives at `backend/listeners/listener.py`. It
  does not — the actual path is `backend/engine/listener.py`. Confirmed
  via `ls`. Use that path in the §4.4 listener update.
- `dev_status_enum` was added the value `'on_mission'` at runtime per the
  probe results, but the source for that addition is not in
  `_run_auto_migrations()` (which only adds `'HACK_MAINFRAME'` to
  `action_enum` and `'GitHub HQ'` to `location_enum`). Worth investigating
  whether `'on_mission'` came from a hand-run migration. The verifier
  probe in §3.4 will confirm the live enum value list.

---

## 3. Verifier results

**The blocks below remain placeholders until the verifier runs against
production.** The script will replace this entire `## 3.` section with
real tables.

### 3.1 Retired values — row counts (must all be 0)

_Pending verifier execution._

### 3.2 Renamed values — row counts (informational)

_Pending verifier execution._

### 3.3 Column data types

_Pending verifier execution. Watch for `data_type = 'character varying'`
on social_style / coding_style / work_ethic / species — that confirms
the schema-vs-brief drift in §2 above._

### 3.4 Live state probes

#### Total minted Devs

_Pending. Probe reported 163; if drift, halt._

#### Energy range

_Pending. Probe reported 0..100; if MIN < 0 or MAX > 100, halt._

#### `devs_burned` column existence

_Pending. Should exist with default 0; if missing, Step A is a no-op (fine)._

#### `dev_status_enum` values

_Pending. Should include `active, resting, frozen, on_mission`; should NOT
yet include `exhausted` (Step B adds it)._

#### `'GitHub HQ'` row count

_Pending. Probe reported 107; preserve via location-enum
(`_run_auto_migrations` already adds the value)._

#### `personality_seed` health

_Pending. All 163 must have non-null, non-zero, distinct seeds._

---

## 4. Verdict

🟡 **PARTIAL** — the verifier has not yet run against production. Two
deliverables are committed:

1. The verifier script itself ([`backend/scripts/verify_phase22_preflight.py`](backend/scripts/verify_phase22_preflight.py))
   is ready and tested in fail-closed mode.
2. This stub report.

A static repo-side finding (§2) flags that the brief's Step C and Step D
operate on enum types that don't exist in `schema.sql`. The correct
treatment is most likely the VARCHAR-friendly replacement shown in §2.

**Next action:** the human runs the verifier and pushes the regenerated
report. If §3.1 is all zeros and §3.3 confirms VARCHAR for the three
columns, **adopt the §2 replacement** and proceed to Step 1 (DB backup),
then Step 2 with the corrected migration. If any §3.1 row is non-zero,
halt and surface to me.

🛑 Phase 2.2 is paused at Step 0 until this report is populated.
