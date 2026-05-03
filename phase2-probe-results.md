# Phase 2.1 — Production probe results

**Branch:** `claude/refactor-metadata-api-J1jMg`
**Probe script:** [`backend/scripts/probe_production.py`](backend/scripts/probe_production.py)

---

## ⚠ This run did not execute against production

The build environment that produced this report does not have access to the
production database. The probe script itself is committed and verified
(exit-code 1 with a clear error message when credentials are absent), but the
result tables below are placeholders. **A human with DB access must run the
probe script to populate this report.**

This file is written by the script when it executes; rerunning it overwrites
this content with real probe results.

### How to run

The script reads either `DATABASE_URL` or the `NX_DB_HOST/PORT/NAME/USER/PASS`
quintuplet, mirroring the convention in `backend/api/deps.py`. It works on
Render's internal connection string out of the box.

**Option 1 — Render shell (recommended, no SSL hassle):**

```bash
# In the nx-api service shell on Render:
python backend/scripts/probe_production.py
```

The script will write `phase2-probe-results.md` to the repo root. Commit and
push it.

**Option 2 — Local with the external DB URL:**

```bash
# Get the External Database URL from the Render dashboard (it ends in
# .ohio-postgres.render.com or similar). The script auto-enables sslmode=require
# when it sees `render.com` in the host.
DATABASE_URL='postgresql://USER:PASS@HOST:PORT/DBNAME' \
  python backend/scripts/probe_production.py
```

**Option 3 — psql + manual transcription:** if you would rather not run any
script, the SQL queries the script runs are listed in §3 below. Paste each
one into psql and copy the results into this file.

---

## 1. Safety guarantees

The probe script runs in **read-only mode at four layers**:

1. The Postgres session executes `SET TRANSACTION READ ONLY` immediately after
   connect. Postgres will reject any DML/DDL with an error.
2. Every SQL statement is statically validated to begin with `SELECT` (modulo
   leading whitespace and `--` comments) before being passed to `cur.execute`.
3. The transaction is rolled back at end of script (and on any exception).
4. The connection uses `autocommit=False` so even an accidental write would
   not auto-commit.

The script never accepts arbitrary SQL from the environment or from a user
prompt — every query is a literal constant in the script.

## 2. Probe inventory

| # | Label | Purpose |
|---|---|---|
| A | Energy / max_energy range | Decides whether the §3.4 schema constraint migration is needed |
| B | Species distribution | Enumerates current 14-pool species values |
| C | Archetype distribution | Confirms `archetype_enum` UPPER_SNAKE values in DB |
| D | Corporation distribution | Confirms `corporation_enum` UPPER_SNAKE values |
| E | Rarity distribution | Confirms `rarity_enum` lowercase values |
| F | Alignment distribution | Confirms VARCHAR matches bundle (expected ✅) |
| G | Risk Level distribution | Confirms VARCHAR matches bundle (expected ✅) |
| H | Social Style distribution | Reveals listener vs. bundle drift |
| I | Coding Style distribution | Reveals listener vs. bundle drift |
| J | Work Ethic distribution | Reveals listener vs. bundle drift |
| K | Location distribution (incl. `'GitHub HQ'`) | How many Devs sit in the runtime-added location |
| L | `dev_status_enum` value list | Confirms `('active','resting','frozen')`; flags whether `'exhausted'` already added |
| M | Column existence | Confirms `devs_burned`, `energy`, `max_energy`, `personality_seed`, `bugs_fixed` columns and their data types |
| N | Stat min/max + sub-15 row count | Confirms listener `15..95` range, identifies how many Devs would still need stat alignment if Phase 2 chose to take bundle stats |
| O | personality_seed health | Validates the NX Souls derivation precondition |
| P | End-to-end token row dump | The five canonical tokens (1, 100, 1337, 29572, 35000) |
| Q | Total dev count | Sanity check that all 35 000 are present |
| R | Bundle vs DB diff | For each canonical token, side-by-side comparison of identity/baseline/dynamic fields |

## 3. Queries the script will execute

(Reproduced verbatim from [`backend/scripts/probe_production.py`](backend/scripts/probe_production.py).)

```sql
-- A. Energy / max_energy range
SELECT MIN(energy) AS energy_min, MAX(energy) AS energy_max,
       AVG(energy)::numeric(5,1) AS energy_avg,
       MIN(max_energy) AS max_energy_min, MAX(max_energy) AS max_energy_max,
       COUNT(*) FILTER (WHERE energy > 15) AS rows_with_energy_gt_15
  FROM nx.devs;

-- B. Species distribution
SELECT species, COUNT(*) AS n FROM nx.devs GROUP BY species ORDER BY n DESC;

-- C. Archetype distribution
SELECT archetype::text AS archetype, COUNT(*) AS n FROM nx.devs
 GROUP BY archetype ORDER BY n DESC;

-- D. Corporation distribution
SELECT corporation::text AS corporation, COUNT(*) AS n FROM nx.devs
 GROUP BY corporation ORDER BY n DESC;

-- E. Rarity distribution
SELECT rarity_tier::text AS rarity, COUNT(*) AS n FROM nx.devs
 GROUP BY rarity_tier ORDER BY n DESC;

-- F. Alignment, G. Risk Level, H. Social Style,
-- I. Coding Style, J. Work Ethic, K. Location distribution
-- (one query each; identical structure)

-- L. dev_status_enum value list
SELECT unnest(enum_range(NULL::nx.dev_status_enum))::text AS status_value;

-- M. Column existence
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'nx' AND table_name = 'devs'
   AND column_name IN ('devs_burned','energy','max_energy',
                       'personality_seed','bugs_fixed')
 ORDER BY column_name;

-- N. Stat min/max + sub-15 row count
SELECT MIN(stat_coding) AS coding_min, MAX(stat_coding) AS coding_max,
       MIN(stat_hacking) AS hacking_min, MAX(stat_hacking) AS hacking_max,
       MIN(stat_trading) AS trading_min, MAX(stat_trading) AS trading_max,
       MIN(stat_social) AS social_min, MAX(stat_social) AS social_max,
       MIN(stat_endurance) AS endurance_min, MAX(stat_endurance) AS endurance_max,
       MIN(stat_luck) AS luck_min, MAX(stat_luck) AS luck_max,
       COUNT(*) FILTER (WHERE stat_coding < 15
                      OR stat_hacking < 15
                      OR stat_trading < 15
                      OR stat_social < 15
                      OR stat_endurance < 15
                      OR stat_luck < 15) AS rows_with_any_stat_below_15
  FROM nx.devs;

-- O. personality_seed health
SELECT COUNT(*) FILTER (WHERE personality_seed IS NULL OR personality_seed = 0) AS bad_seeds,
       MIN(personality_seed) AS min_seed,
       MAX(personality_seed) AS max_seed,
       COUNT(DISTINCT personality_seed) AS distinct_seeds,
       COUNT(*) AS total_devs
  FROM nx.devs;

-- P. End-to-end token row dump
SELECT token_id, name, species, archetype::text, corporation::text,
       rarity_tier::text, alignment, risk_level, social_style, coding_style, work_ethic,
       stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck,
       energy, max_energy, mood::text, location::text, status::text, personality_seed
  FROM nx.devs
 WHERE token_id IN (1, 100, 1337, 29572, 35000)
 ORDER BY token_id;

-- Q. Total dev count
SELECT COUNT(*) AS total_devs FROM nx.devs;
```

## 4. Decisions that depend on these results

The following Phase 2.2 actions cannot be finalized until the probe runs:

1. **Energy migration path (probe A).** If `MAX(energy) > 15`, the schema
   constraint has already been loosened in production and only `schema.sql`
   needs updating. If `MAX(energy) <= 15`, a value-scaling UPDATE
   (`energy * 100 / 15`) plus constraint replacement is needed. The migration
   SQL has both branches commented in `phase2-empirical.md` §3.4.

2. **`'GitHub HQ'` row count (probe K).** If zero rows, the value can be
   safely left in the enum without metadata-layer handling. If non-zero, the
   translation map needs an explicit entry.

3. **Stat baseline mismatch quantification (probe N).** Confirms how many of
   the 35 000 Devs would have visibly different baseline stats post-deploy
   if Phase 2 takes bundle stats as truth. Per the user's decision, we are
   keeping `nx.devs.stat_*` as the live truth and ignoring bundle stats — but
   the probe still produces a useful pre-deploy diff metric.

4. **Token diff (probe R).** Reveals exactly which fields drift on a
   per-token basis. If the diff for tokens 1, 100, 1337, 29572, 35000 is
   exactly the case/separator drift identified in
   `phase2-empirical.md` §3.1, no surprise rework is needed for Phase 2.2.

5. **`dev_status_enum` (probe L).** If `'exhausted'` is already in the enum
   from a previous run, the migration `ADD VALUE` becomes a no-op. If the
   set is `('active','resting','frozen')` exactly as schema.sql says,
   the migration adds it.

6. **Total dev count (probe Q).** If less than 35 000, the bundle ingest in
   Phase 2.2 must be careful — it expects a 1:1 match. The script can be
   adjusted to skip bundle tokens that lack a corresponding `nx.devs` row.

---

## 5. Results

**The blocks below remain placeholders until the probe runs against
production.** The script will replace this entire `## 5. Results` section
(and everything after it) with the actual data.

### A. Energy / max_energy range

_Pending probe execution._

### B. Species distribution

_Pending probe execution._

### C. Archetype distribution

_Pending probe execution._

### D. Corporation distribution

_Pending probe execution._

### E. Rarity distribution

_Pending probe execution._

### F. Alignment distribution

_Pending probe execution._

### G. Risk Level distribution

_Pending probe execution._

### H. Social Style distribution

_Pending probe execution._

### I. Coding Style distribution

_Pending probe execution._

### J. Work Ethic distribution

_Pending probe execution._

### K. Location distribution

_Pending probe execution. Watch for `GitHub HQ` row count._

### L. dev_status_enum values

_Pending probe execution._

### M. Column existence (devs_burned, energy, max_energy, personality_seed, bugs_fixed)

_Pending probe execution._

### N. Stat min/max + sub-15 row count

_Pending probe execution._

### O. personality_seed health

_Pending probe execution._

### P. End-to-end token row dump (1, 100, 1337, 29572, 35000)

_Pending probe execution._

### Q. Total dev count

_Pending probe execution._

### R. Bundle vs nx.devs side-by-side diff

_Pending probe execution._

---

## 6. Sign-off

🛑 **HALT.** Run `python backend/scripts/probe_production.py` from an
environment with DB access (e.g. Render shell) to populate this report.
Then commit and push. Phase 2.2 (migration + ingest) does not begin until
this report has real values and `phase2-bundle-scan.md` has been reviewed.
