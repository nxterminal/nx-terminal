# Simulation Diagnosis — Engine Not Running

> Urgent diagnostic of why 10 devs have balance_nxt=0, no salary, no actions.

---

## TL;DR — ROOT CAUSE

**`pay_salaries()` crashes because `pc_health` column doesn't exist in the Render database.**

The migration `backend/db/migration_mechanics.sql` was never run on production. After 1 hour of uptime, the engine enters an infinite crash loop trying to pay salary and **all simulation processing stops**.

---

## 1. How the Engine Works

### Architecture (3 processes on Render)

| Service | Command | Purpose |
|---------|---------|---------|
| `nx-api` | `uvicorn backend.api.main:app` | FastAPI web server |
| `nx-engine` | `python -m backend.engine.run_all` | Simulation engine + blockchain listener |
| `nx-db` | PostgreSQL 15 | Database |

### Engine Main Loop (`engine.py:927-965`)

```
while True:
    with get_db() as conn:           # ← auto-rollback on exception
        if salary_is_due:
            pay_salaries(conn)       # ← CRASHES HERE
            last_salary = now        # ← NEVER REACHED
        
        if snapshot_is_due:
            take_balance_snapshots(conn)
        
        run_scheduler_tick(conn)     # ← NEVER REACHED after crash
    
    sleep(1 second)
```

### Salary Schedule
- Runs every `SALARY_INTERVAL_HOURS = 1` hour
- Pays `SALARY_PER_INTERVAL = 9` $NXT per dev per hour (216/day)
- Also regenerates energy and degrades PC health

### Dev Cycle Schedule
- `run_scheduler_tick()` runs every 1 second
- Fetches devs with `next_cycle_at <= NOW()` and `status = 'active'`
- Processes up to 500 devs per tick
- Cycles every 8-45 minutes depending on energy level

---

## 2. THE CRASH — `pc_health` Column Missing

### File: `backend/engine/engine.py:822-824`

```python
def pay_salaries(conn):
    # Line 790-803: UPDATE devs SET balance_nxt = balance_nxt + 9 ...
    # Line 808-819: INSERT INTO actions ... RECEIVE_SALARY ...
    
    # Line 822-824: THIS LINE CRASHES ↓
    cur.execute("""
        UPDATE devs SET pc_health = GREATEST(0, pc_health - 2) WHERE status = 'active'
    """)
    
    conn.commit()  # ← NEVER REACHED
```

### What Happens:

1. **Hour 0-1:** Engine starts. Salary not due yet. Dev cycles run normally (don't reference `pc_health`).
2. **Hour 1:** `pay_salaries()` is called for the first time.
3. **Line 823:** `UPDATE devs SET pc_health = ...` → **`ERROR: column "pc_health" does not exist`**
4. **Exception propagates** through `get_db()` context manager (`run_all.py:47-52`):
   - `conn.rollback()` — ALL salary updates (balance_nxt + 9) are **rolled back**
   - Exception re-raised
5. **`last_salary = now` (line 946) is never reached.**
6. **Next tick (1 second later):** `now - last_salary >= 1 hour` is STILL true.
7. **`pay_salaries()` is called again → crashes again.**
8. **`run_scheduler_tick()` is NEVER reached** — it's after the salary call in the same try block.
9. **Engine is stuck in an infinite crash loop** — logging `Engine error: column "pc_health" does not exist` every second.

### Why Balance is 0:
- Salary is rolled back every attempt (never committed)
- Dev cycles stop after hour 1 (run_scheduler_tick never called)
- Even cycles in the first hour produce no balance growth (devs start with 0 NXT after reset, can't afford CREATE_PROTOCOL or CREATE_AI)

---

## 3. SECONDARY ISSUE — `listener_last_block` Not Reset

### File: `backend/db/reset_data.sql:58-67`

The reset script resets 10 simulation_state keys but **does NOT reset `listener_last_block`**.

```sql
-- Keys that ARE reset:
UPDATE simulation_state SET value = '"pre_launch"' WHERE key = 'simulation_status';
UPDATE simulation_state SET value = '0'             WHERE key = 'total_devs_minted';
-- ... 8 more keys ...

-- KEY THAT IS NOT RESET:
-- listener_last_block ← STAYS AT LAST VALUE
```

### Consequence:

After data reset:
1. All devs are TRUNCATED (table empty)
2. `simulation_status = "pre_launch"`
3. `listener_last_block` still points to a recent block (after all mint events)
4. Listener starts from that block → **never re-detects old mints**
5. No devs are re-created → simulation has 0 devs
6. Even if engine runs, `fetch_due_devs()` returns empty results

### How Devs Got Back:

If the 10 devs ARE in the DB, one of these happened:
- `listener_last_block` was manually reset to 0 (listener re-scanned all blocks)
- New mints happened on-chain after the reset
- Devs were manually inserted via SQL

---

## 4. ENGINE DOES NOT CHECK `simulation_status`

Important finding: **`engine.py` NEVER references `simulation_status`** (confirmed via grep). The engine just processes any dev with `status='active' AND next_cycle_at <= NOW()`. So even with `simulation_status = "pre_launch"`, devs would be processed if they exist.

The `simulation_status` transition to `"running"` only happens in the **listener** (`listener.py:349-357`) when it detects a mint with `total_minted >= 1`.

---

## 5. VERIFICATION STEPS

### Step A: Check Render Engine Logs

Go to Render dashboard → `nx-engine` service → Logs. Look for:

```
Engine error: column "pc_health" does not exist
```

If this appears repeatedly, the diagnosis is confirmed.

### Step B: Check Simulation State

```bash
curl https://nx-terminal.onrender.com/api/simulation/state
```

Expected fields to check:
| Key | Expected if broken | Expected if working |
|-----|-------------------|---------------------|
| `simulation_status` | `"pre_launch"` or `"running"` | `"running"` |
| `total_devs_minted` | `0` or `10` | `10` |
| `simulation_started_at` | `null` or timestamp | timestamp |

### Step C: Check Dev Status

```bash
curl https://nx-terminal.onrender.com/api/devs?limit=3
```

Check each dev for:
- `status` should be `"active"`
- `next_cycle_at` should NOT be NULL
- `balance_nxt` should be > 0 if salary is working

### Step D: Check Health

```bash
curl https://nx-terminal.onrender.com/health
```

This only checks the **API** (not the engine). Engine has no health endpoint.

---

## 6. FIX — Run the Migration

### Step 1: Run migration on Render DB

```bash
psql $DATABASE_URL -f backend/db/migration_mechanics.sql
```

This adds 4 columns: `pc_health`, `training_course`, `training_ends_at`, `last_raid_at`.

### Step 2: Restart nx-engine on Render

After migration, restart the engine service so it picks up the new columns.

### Step 3: Verify salary starts flowing

Wait 1 hour (or check engine logs for `💰 Paid salary`). Devs should start accumulating balance.

### Step 4 (If devs are missing): Reset listener_last_block

If devs don't exist in the DB (truncated and never re-created):

```sql
-- Set listener to re-scan from block 0 (will re-detect all mints)
UPDATE nx.simulation_state 
SET value = '0', updated_at = NOW() 
WHERE key = 'listener_last_block';
```

Then restart `nx-engine`. The listener will re-scan the blockchain and re-create all minted devs.

---

## 7. OPTIONAL — Fix the Crash Resilience

The current code structure means ONE failed salary payment kills ALL dev cycle processing. To make this more resilient:

**File:** `backend/engine/engine.py:940-963`

The salary call and scheduler tick should be in **separate try/except blocks** so a salary failure doesn't block dev cycles:

```python
# Current (broken):
try:
    if salary_due:
        pay_salaries(conn)    # crash here kills everything
    run_scheduler_tick(conn)  # never reached
except:
    log.error(...)

# Proposed (resilient):
try:
    if salary_due:
        pay_salaries(conn)
        last_salary = now
except Exception as e:
    log.error(f"Salary error: {e}")

try:
    run_scheduler_tick(conn)
except Exception as e:
    log.error(f"Scheduler error: {e}")
```

This way, even if salary crashes, dev cycles continue running.

---

## 8. TIMELINE OF EVENTS

```
[RESET]
  ├─ All devs TRUNCATED
  ├─ simulation_status = "pre_launch"  
  ├─ listener_last_block = (unchanged, still recent)
  └─ Sequences reset

[LISTENER RESTART]
  ├─ Starts from listener_last_block (recent block)
  ├─ No new mints detected (old mints are in past blocks)
  └─ simulation_status stays "pre_launch"

[IF devs were re-created somehow]
  ├─ Engine starts, runs dev cycles (hour 0-1)
  ├─ Devs have 0 balance, can only REST/CHAT/MOVE
  ├─ No protocols created, no AIs created
  └─ Hour 1: pay_salaries() CRASHES on pc_health

[AFTER HOUR 1]
  ├─ Engine stuck in crash loop
  ├─ No salary paid (rolled back)
  ├─ No dev cycles processed
  └─ All values stay at 0
```

---

## 9. OTHER REFERENCES TO NEW COLUMNS

These will also break if migration isn't run:

| File | Line | Column | Impact |
|------|------|--------|--------|
| `engine.py` | 823 | `pc_health` | **CRITICAL** — kills engine |
| `shop.py` | 138 | `training_course` | Shop purchases crash |
| `shop.py` | 193 | `pc_health` | PC repair item crashes |
| `shop.py` | 199 | `training_course`, `training_ends_at` | Training items crash |
| `shop.py` | 289 | `last_raid_at` | Hack raids crash |
| `devs.py` | 65 | All 4 columns | API list_devs crashes |

**Running the migration fixes ALL of these.**
