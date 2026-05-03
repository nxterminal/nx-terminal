# Phase 2.0 — Empirical schema verification

**Branch:** `claude/refactor-metadata-api-J1jMg`
**Date:** 2026-05-03
**Scope:** Compare canonical bundle truth vs. repo schema vs. engine code. Identify every value drift and dispatch hazard before any migration runs.

I have **no access to the production database** from this environment. All "production" findings here are derived from the bundle (which the user described as the canonical pre-game snapshot of all 35 000 Devs) and from repo code. Every claim that requires live DB confirmation is captured as an explicit SQL probe in §6 for the human to run before Phase 2.1.

---

## 0. TL;DR — what changed since the brief was written

The §1.5 claim that **Species is `Bunny + Robot`** is empirically wrong. It is `Bunny + Ghost + Robot + Zombie` (4 values across 127 random samples; possibly more in unsampled ranges).

The **enum-rename strategy described in §2.1 of the updated brief is unsafe as written.** The engine has multiple Python dispatch dictionaries keyed by the current UPPER_SNAKE values (`CHAT_TEMPLATES["10X_DEV"]`, `ARCHETYPE_WEIGHTS["10X_DEV"]`, `COMPLIANCE_RATES[archetype]`, etc.). Renaming the DB enum values to bundle-format Title Case (`'10X Dev'`) without simultaneously updating every dispatch site silently degrades the engine — every `dict.get(archetype, default)` lookup falls through to the default. There are at least **6 dispatch dicts and ~10 test fixtures** that need synchronized updates.

A safer alternative — **keep DB values stable, translate to bundle format at the metadata-emit boundary** — is documented in §7. Recommend the human decide between these two approaches before Phase 2.1.

The **bundle baseline stats do not match the listener-generated stats.** Bundle uses range `5..95`, listener uses `randint(15, 95)`. Roughly 8% of bundle values per stat fall below the listener's floor. This means `dev_canonical_traits.stat_*` (from bundle) will differ from `nx.devs.stat_*` (from listener) for ~10% of Devs. Decide which is the source of truth for baseline.

The **bundle is a pre-game snapshot, not a live snapshot.** All 127 sampled tokens have `Energy=100, Reputation=0, Day=0, Bugs Shipped=0, Devs Burned=0, Status=Active`. Dynamic state must come from `nx.devs`, never the bundle.

The contract `tokenURI` test `https://nx-terminal.onrender.com/metadata/29572` was **not verified in this run**. The Render service is asleep / cold-starting and returns 404 from a different (Spring Boot) service. The brief asserts this URL works; no evidence here either way.

---

## 1. Canonical bundle: confirmed live

| Probe | Result |
|---|---|
| `https://raw.githubusercontent.com/nxterminal/nx-metadata-bundle/main/1.json` | 200, ~160 ms, valid JSON |
| `…/100.json` | 200, ~160 ms |
| `…/1337.json` | 200, ~200 ms |
| `…/29572.json` | 200, ~160 ms |
| `…/35000.json` | 200, ~150 ms |
| `…/0.json` | 404 |
| `…/35001.json` | 404 |

Token range is exactly `1..35000`. GitHub raw is fast and consistent (sub-200 ms across 105 fetches in the sweep). No auth needed. Concurrency cap of 25 in-flight worked without rate-limit errors.

**Sample JSONs cached locally** in `/tmp/bundle*` (127 files). Used for §2 value-set construction.

---

## 2. Bundle value sets (n=127 random samples)

The full distinct value set per non-numeric trait, with sample counts:

| Trait | Distinct values | Counts |
|---|---|---|
| **Species** | 4 | Bunny=111, Zombie=8, Ghost=6, Robot=2 |
| **Archetype** | 8 | Hacktivist=22, Influencer=17, Degen=16, 10X Dev=16, Grinder=15, Lurker=15, Fed=13, Script Kiddie=13 |
| **Corporation** | 6 | Mistrial Systems=29, Shallow Mind=27, Zuck Labs=22, Closed AI=18, Misanthropic=16, Y.AI=15 |
| **Rarity** | 5 | Common=49, Uncommon=39, Rare=28, Legendary=8, Mythic=3 |
| **Alignment** | 9 | all 9 D&D alignments, ~uniform |
| **Risk Level** | 4 | Aggressive=39, Conservative=34, Moderate=30, Reckless=24 |
| **Social Style** | 5 | Loud=29, Quiet=29, Silent=26, Social=24, Influencer=19 |
| **Coding Style** | 6 | Over-Engineer=27, Methodical=22, Minimalist=21, Perfectionist=20, Chaotic=19, Speedrun=18 |
| **Work Ethic** | 4 | Lazy=35, Dedicated=33, Obsessed=31, Casual=28 |
| **Skill Module** | 6 | INFILTRATE=29, BRIDGE=27, BROADCAST=22, DEPLOY=18, AUDIT=16, ARBITRAGE=15 |
| **Clothing** | 12 | None=72, T-Shirt=8, Jacket=7, Sweater=7, Sweater V2=7, Hoodie=6, Coat=3, Vest=4, Scarf=4, Costume=4, Shirt=4, Bandana=1 |
| **Clothing Pattern** | 12 | None=72, Two Tone=10, Color Block=8, Chevron=7, H Stripes=7, Checker=5, Polka Dots=5, Gradient V=4, Gradient H=3, Diagonal Fade=2, Solid=2, V Stripes=2 |
| **Eyewear** | 6 | None=91, Shades=10, Visor=9, Glasses=7, Eye Patch=6, Half-Rim=4 |
| **Neckwear** | 3 | None=113, Tie=8, Bow Tie=6 |
| **Spots** | 4 | None=46, Light=34, Medium=33, Heavy=14 |
| **Blush** | 2 | No=70, Yes=57 |
| **Ear Detail** | 2 | Yes=72, No=55 |
| **Status** | 1 | Active=127 (bundle is pre-game snapshot) |
| **Mood** | 5 | Excited=34, Depressed=32, Neutral=32, Angry=15, Focused=14 |
| **Location** | 10 | The Graveyard=19, Board Room=15, The Pit=15, Hackathon Hall=14, Server Farm=14, Hype Haus=12, VC Tower=12, Dark Web=9, Open Source Garden=9, Governance Hall=8 |

**Caveats on sample completeness:**
- 127 samples is enough to cover any value with population ≥1.5%. Rare values below that prevalence (e.g., a hypothetical 0.3% trait) may be missing.
- Mythic appeared 3/127 (2.4%) — within sampling noise of the engine's 1% spec.
- `Status` is locked to `Active` because all 35 000 tokens were exported pre-engine-tick. Real status enum has more.

**Recommend full bundle scan (35 000 fetches, ~5 minutes at concurrency 25) before Phase 2.1 to confirm the complete value set per trait.** A scan script would emit each trait's full distinct-value list as JSON; cache it as `phase2-bundle-value-sets.json`.

### 2.1 Skill Module ↔ Corporation: confirmed 1:1

Cross-tabulation across all 127 samples:

| Corporation | Skill Module |
|---|---|
| Closed AI | DEPLOY |
| Misanthropic | AUDIT |
| Mistrial Systems | INFILTRATE |
| Shallow Mind | BRIDGE |
| Y.AI | ARBITRAGE |
| Zuck Labs | BROADCAST |

Zero deviation. Skill Module is a deterministic function of Corporation. Brief's decision to keep it in `dev_canonical_traits` but exclude from public metadata output is correct.

### 2.2 Numeric ranges in bundle

| Trait | Min | Max | Notes |
|---|---|---|---|
| Coding | 5 | 94 | listener uses `randint(15,95)` — ~7% below floor |
| Hacking | 5 | 95 | ~13% below floor |
| Trading | 6 | 93 | ~8% below floor |
| Social | 5 | 95 | ~8% below floor |
| Endurance | 6 | 95 | ~7% below floor |
| Luck | 6 | 94 | ~6% below floor |
| Energy | 100 | 100 | always 100 (pre-game snapshot) |
| Reputation | 0 | 0 | always 0 |
| Day | 0 | 0 | always 0 |
| Coffee Count | 0 | 5 | small initial seeding |
| Lines of Code | 4 | 491 | small initial seeding |
| Hours Since Sleep | 0 | 48 | small initial seeding |

The 7-13% of stats below the listener's `15..95` range proves bundle baselines were generated by a **different process** than the listener. They are NOT a snapshot of `nx.devs` — they are an external source. This affects the brief's Phase 2.5 alignment plan.

---

## 3. Repo schema vs. bundle: drift inventory

### 3.1 Enum-typed columns (DB ENUM, hard to change)

| Column | DB enum type | DB values | Bundle values | Drift |
|---|---|---|---|---|
| `archetype` | `archetype_enum` | `10X_DEV, LURKER, DEGEN, GRINDER, INFLUENCER, HACKTIVIST, FED, SCRIPT_KIDDIE` | `10X Dev, Lurker, Degen, Grinder, Influencer, Hacktivist, Fed, Script Kiddie` | **Case + separator** (8 values) |
| `corporation` | `corporation_enum` | `CLOSED_AI, MISANTHROPIC, SHALLOW_MIND, ZUCK_LABS, Y_AI, MISTRIAL_SYSTEMS` | `Closed AI, Misanthropic, Shallow Mind, Zuck Labs, Y.AI, Mistrial Systems` | **Case + separator + Y.AI dot** (6 values) |
| `rarity_tier` | `rarity_enum` | `common, uncommon, rare, legendary, mythic` | `Common, Uncommon, Rare, Legendary, Mythic` | **Case** (5 values) |
| `mood` | `mood_enum` | `neutral, excited, angry, depressed, focused` | `Neutral, Excited, Angry, Depressed, Focused` | **Case** (5 values) |
| `location` | `location_enum` | `BOARD_ROOM, HACKATHON_HALL, THE_PIT, DARK_WEB, VC_TOWER, OPEN_SOURCE_GARDEN, SERVER_FARM, GOVERNANCE_HALL, HYPE_HAUS, THE_GRAVEYARD, GitHub HQ` | `Board Room, Hackathon Hall, The Pit, Dark Web, VC Tower, Open Source Garden, Server Farm, Governance Hall, Hype Haus, The Graveyard` | **Case + separator** (10 values) — and the DB has an extra `'GitHub HQ'` value added at runtime via `_run_auto_migrations` (`backend/api/main.py:80-83`) that is NOT in the bundle |
| `status` | `dev_status_enum` | `active, resting, frozen` | `Active` only (in bundle); brief wants to add `exhausted` | **Case + new value** (3→4 values, all need re-case) |

**Important note on `Y.AI`:** Postgres ENUM values can contain dots, but `Y.AI` and `Y_AI` are different strings. ENUM rename works; no escaping issues.

**Important note on `'GitHub HQ'`:** the live DB has it (added by auto-migration) but the bundle does not. Either:
- The bundle is incomplete (missing locations added post-mint).
- The live engine emits a location value not present in the bundle's pre-game state.

The DB value list for `location_enum` is **a superset of the bundle** in this case. Phase 2.5's UPDATE alignment can't simply overwrite — it would erase any Devs that have moved to `'GitHub HQ'`.

### 3.2 VARCHAR-typed trait columns (DB VARCHAR, easy to change)

| Column | Type | Listener pool | Bundle values | Drift |
|---|---|---|---|---|
| `species` | `VARCHAR(20)` | `Wolf, Cat, Owl, Fox, Bear, Raven, Snake, Shark, Monkey, Robot, Alien, Ghost, Dragon, Human` (14) | `Bunny, Ghost, Robot, Zombie` (4) | **Different sets** — only `Robot` and `Ghost` overlap |
| `alignment` | `VARCHAR(20)` | `Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, True Neutral, Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil` (9) | same 9 | ✅ match |
| `risk_level` | `VARCHAR(20)` | `Conservative, Moderate, Aggressive, Reckless` (4) | same 4 | ✅ match |
| `social_style` | `VARCHAR(20)` | `Quiet, Social, Loud, Troll, Mentor` (5) | `Influencer, Loud, Quiet, Silent, Social` (5) | **3 of 5 overlap** — listener has `Troll, Mentor` (not in bundle); bundle has `Silent, Influencer` (not in listener) |
| `coding_style` | `VARCHAR(20)` | `Methodical, Chaotic, Perfectionist, Speed Runner, Copy Paste` (5) | `Chaotic, Methodical, Minimalist, Over-Engineer, Perfectionist, Speedrun` (6) | **3 of 5 overlap**; listener has `Speed Runner` w/ space vs bundle's `Speedrun` (no space); bundle has `Minimalist, Over-Engineer` (new); listener has `Copy Paste` (not in bundle) |
| `work_ethic` | `VARCHAR(20)` | `Grinder, Lazy, Balanced, Obsessed, Steady` (5) | `Casual, Dedicated, Lazy, Obsessed` (4) | **2 of 4 overlap** — listener has `Grinder, Balanced, Steady` (not in bundle); bundle has `Casual, Dedicated` (new) |

For VARCHAR columns the migration is straightforward UPDATEs from `dev_canonical_traits` — but the listener pool also needs to change so future mints (if any) use bundle values.

### 3.3 Missing visual columns

The schema has columns `skin, clothing, vibe, glow, hair_style, hair_color, facial, headgear, extra` (`schema.sql:113-121`) that are **not populated** by anything. They're empty across all 35 000 rows (the API emits `""` literals for them).

The bundle has Clothing, Clothing Pattern, Eyewear, Neckwear, Spots, Blush, Ear Detail. These map roughly:
- `clothing` (DB) ≈ Clothing (bundle) — same name, never populated
- The other 6 bundle visuals have **no matching DB column**

Phase 2 migration adds these to `dev_canonical_traits`, not to `nx.devs`, which is correct. The dead `skin/vibe/glow/hair_*/facial/headgear/extra` columns can be dropped from `nx.devs` in a follow-up cleanup, but that's out of scope for this brief.

### 3.4 Energy scale

| Source | Constraint |
|---|---|
| `schema.sql:124` | `CHECK (energy >= 0 AND energy <= 15)`, default 10 |
| `schema.sql:125` | `max_energy SMALLINT default 10` |
| Bundle | `Energy=100` for all 127 samples, `max_value:100` |
| Current `/metadata/{id}` API | emits `max_value: 100` (`devs.py:332`) |

If the production DB still has the `≤ 15` constraint, every bundle-derived ingest will violate it on row update. **Confirm with §6 probe before any UPDATE runs.**

The brief's Phase 2.0 plan to query `MAX(energy)` and migrate proportionally if ≤15 is correct. The `max_energy` column also needs the same treatment — it's not just about the constraint but also the data.

### 3.5 Other column drift to confirm

- `devs_burned INTEGER NOT NULL DEFAULT 0` (`schema.sql:144`) — present in DB AND bundle (always 0). Brief drops it. Drop in migration.
- `bugs_fixed INTEGER NOT NULL DEFAULT 0` (`schema.sql:137`) — present in DB but **never emitted** by current API. Brief adds it. Trivial.

---

## 4. Engine dispatch hazards (the big one)

This is the part most likely to break if Phase 2.5 alignment renames the enum values without simultaneous code updates.

### 4.1 Production code dispatch sites (will break on rename)

| File:line | Dispatch on | Keys used |
|---|---|---|
| `backend/engine/engine.py:92-99` | `archetype` | `10X_DEV, LURKER, DEGEN, GRINDER, INFLUENCER, HACKTIVIST, FED, SCRIPT_KIDDIE` (action selection weights) |
| `backend/engine/engine.py:103-110` | `archetype` | same 8 keys (vote_weight, code_quality range, prompt_influence) |
| `backend/engine/engine.py:185` | `mood` | `["neutral", "excited", "angry", "depressed", "focused"]` (random pick) |
| `backend/engine/templates.py:132-365` | `archetype` | same 8 keys for CHAT_TEMPLATES |
| `backend/engine/templates.py:466` | fallback | `CHAT_TEMPLATES.get(archetype, CHAT_TEMPLATES["GRINDER"])` |
| `backend/engine/listener.py:65-66` | mint weights | same 8 archetype keys |
| `backend/engine/listener.py:74-75` | corp pool | same 6 corp keys |
| `backend/engine/dev_generator.py:30-42` | mint weights / pools | same archetype + corp keys |
| `backend/engine/prompt_system.py:171-201` | `archetype` | `COMPLIANCE_RATES` keyed by archetype values |

If Phase 2.5 renames `archetype` enum values from `'10X_DEV'` to `'10X Dev'`, every `CHAT_TEMPLATES.get(archetype, …)` falls through to the fallback. The engine still runs (no errors), but every Dev's chat templates collapse to GRINDER's. Same for action weights, vote weights, compliance rates. **Silent functional degradation across the entire engine.**

### 4.2 Test fixtures (will break on rename)

10 test files create their own minimal `archetype_enum` / `corporation_enum` with the old values:

- `backend/tests/test_streak_cycle.py:92-110`
- `backend/tests/test_ledger_shop_shadow.py:57-58`
- `backend/tests/test_orphan_scanner_disambig.py:58-89`
- `backend/tests/test_wallet_activity_endpoint.py:50-73`
- `backend/tests/test_admin_tickets.py:53-60`
- `backend/tests/test_fund_dev_latency_fix.py:70-71`
- `backend/tests/test_fix_c_antiorphan.py:66-89`
- `backend/tests/test_hack_raid_concurrency.py:107`
- `backend/tests/test_achievements_claim_safety.py:50-151`
- `backend/tests/test_ledger_engine_shadow.py:63-64`

Each hard-codes `'10X_DEV'`, `'CLOSED_AI'`, etc. After enum rename, these tests fail.

### 4.3 Other dispatch usages

- `backend/api/routes/devs.py:347-352` — `corp_names` dict translates `CLOSED_AI` → `Closed AI` for description text. Already maps DB UPPER_SNAKE → bundle Title Case. **Useful pattern: extend this approach to all enum-typed columns instead of renaming the DB.**
- `backend/api/main.py:80-83` — auto-migration adds `'GitHub HQ'` to `location_enum`. Already mixes UPPER_SNAKE and Title Case in DB.

---

## 5. Bundle fidelity check — does the current API match the bundle?

**Cannot check in this run** because production `/metadata/{id}` endpoint returns 404 from every URL we tried. Once we have a working endpoint URL, we should diff:

```
diff <(curl -s nx-terminal.onrender.com/metadata/29572 | jq) \
     <(curl -s raw.githubusercontent.com/nxterminal/nx-metadata-bundle/main/29572.json | jq)
```

Expected drifts (from §1 of phase1-preflight.md):
- Current API emits species/skin/vibe etc. as `""` empty strings → bundle has Title Case Species and visual subtraits
- Current API uses `max_value: 100` for Energy → bundle agrees on 100
- Current API emits enum values raw (`'common'`, `'CLOSED_AI'`) → bundle is Title Case
- Current API emits `Devs Burned` and `Skill Module` (well, doesn't emit Skill Module since it's not in DB)
- Current API emits `Balance ($NXT)` as a trait; brief moves it to `properties` (bundle still has it as a trait)

If the bundle was actually generated by exporting the current API output, the drifts above tell us **the bundle is not a snapshot — it's a target**. That matches the user's wording: "canonical 35,000 metadata JSONs".

---

## 6. SQL probes for the human to run on production

These cannot run from this environment. **Run before Phase 2.1.**

```sql
-- A. Energy scale verification (decides §3.4 migration path)
SELECT MIN(energy)        AS min_e,
       MAX(energy)        AS max_e,
       AVG(energy)::numeric(5,1) AS avg_e,
       MIN(max_energy)    AS min_me,
       MAX(max_energy)    AS max_me
  FROM nx.devs;
-- Interpretation:
--   max_e ≤ 15  → schema constraint still in place, need scaling migration
--   max_e > 15  → constraint already loosened, just update schema.sql

-- B. Confirm devs_burned column existence
SELECT column_name FROM information_schema.columns
  WHERE table_schema='nx' AND table_name='devs' AND column_name='devs_burned';

-- C. Confirm dev_status_enum values
SELECT unnest(enum_range(NULL::nx.dev_status_enum)) AS status_value;

-- D. Confirm location_enum has 'GitHub HQ' added
SELECT unnest(enum_range(NULL::nx.location_enum)) AS loc_value;

-- E. personality_seed health
SELECT COUNT(*) FILTER (WHERE personality_seed IS NULL OR personality_seed = 0) AS bad_seeds,
       MIN(personality_seed) AS min_seed,
       MAX(personality_seed) AS max_seed,
       COUNT(DISTINCT personality_seed) AS distinct_seeds,
       COUNT(*) AS total_devs
  FROM nx.devs;
-- Expected: bad_seeds=0, distinct_seeds≈total_devs

-- F. Species values currently in DB (will reveal listener-generated drift)
SELECT species, COUNT(*) FROM nx.devs GROUP BY species ORDER BY 2 DESC;
-- Expected: 14 listener-pool values (Wolf, Cat, Owl, ...). Confirms drift from bundle's 4-value set.

-- G. Archetype values
SELECT archetype, COUNT(*) FROM nx.devs GROUP BY archetype ORDER BY 2 DESC;
-- Expected: UPPER_SNAKE 8 values

-- H. Corporation values
SELECT corporation, COUNT(*) FROM nx.devs GROUP BY corporation ORDER BY 2 DESC;
-- Expected: UPPER_SNAKE 6 values

-- I. Rarity values
SELECT rarity_tier, COUNT(*) FROM nx.devs GROUP BY rarity_tier ORDER BY 2 DESC;
-- Expected: lowercase 5 values

-- J. Mood values
SELECT mood, COUNT(*) FROM nx.devs GROUP BY mood ORDER BY 2 DESC;
-- Expected: lowercase 5 values

-- K. Location values (incl 'GitHub HQ')
SELECT location, COUNT(*) FROM nx.devs GROUP BY location ORDER BY 2 DESC;
-- Watch: any rows with 'GitHub HQ'?

-- L. VARCHAR trait drift quantification
SELECT alignment, COUNT(*) FROM nx.devs GROUP BY alignment ORDER BY 2 DESC;
SELECT risk_level, COUNT(*) FROM nx.devs GROUP BY risk_level ORDER BY 2 DESC;
SELECT social_style, COUNT(*) FROM nx.devs GROUP BY social_style ORDER BY 2 DESC;
SELECT coding_style, COUNT(*) FROM nx.devs GROUP BY coding_style ORDER BY 2 DESC;
SELECT work_ethic, COUNT(*) FROM nx.devs GROUP BY work_ethic ORDER BY 2 DESC;
-- Expect mismatches per §3.2.

-- M. Stat range
SELECT MIN(stat_coding) AS c_min, MAX(stat_coding) AS c_max,
       MIN(stat_hacking), MAX(stat_hacking),
       MIN(stat_trading), MAX(stat_trading),
       MIN(stat_social), MAX(stat_social),
       MIN(stat_endurance), MAX(stat_endurance),
       MIN(stat_luck), MAX(stat_luck)
  FROM nx.devs;
-- Listener generates 15..95. Bundle has 5..95 (∼8% below 15).

-- N. Cross-check one specific token end-to-end
SELECT token_id, name, species, archetype, corporation, rarity_tier,
       alignment, risk_level, social_style, coding_style, work_ethic,
       stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck,
       energy, max_energy, mood, location, status, personality_seed
  FROM nx.devs
 WHERE token_id IN (1, 100, 1337, 29572, 35000);
-- Diff result against the bundle JSON for the same token_ids
-- (cached at /tmp/b{1,100,1337,29572,35000}.json from this run).

-- O. Total dev count (sanity)
SELECT COUNT(*) FROM nx.devs;
-- Expected: 35000 if all minted; less if mint is ongoing.
```

Capture results into `phase2-empirical-prod.md`. The decision in §7 depends on items A, F, K, N specifically.

---

## 7. Migration strategy options — decide before Phase 2.1

The brief's §2.1 plan to **rename DB enum values** to bundle Title Case is one option. There is a safer alternative.

### Option A: Rename DB enum values (brief's plan)

```sql
ALTER TYPE nx.archetype_enum RENAME VALUE '10X_DEV' TO '10X Dev';
ALTER TYPE nx.archetype_enum RENAME VALUE 'LURKER' TO 'Lurker';
-- ... 6 more
ALTER TYPE nx.corporation_enum RENAME VALUE 'CLOSED_AI' TO 'Closed AI';
-- ... 5 more (incl Y.AI dot)
ALTER TYPE nx.rarity_enum RENAME VALUE 'common' TO 'Common';
-- ... 4 more
ALTER TYPE nx.mood_enum RENAME VALUE 'neutral' TO 'Neutral';
-- ... 4 more
ALTER TYPE nx.location_enum RENAME VALUE 'BOARD_ROOM' TO 'Board Room';
-- ... 9 more (decide what to do with 'GitHub HQ')
ALTER TYPE nx.dev_status_enum RENAME VALUE 'active' TO 'Active';
ALTER TYPE nx.dev_status_enum RENAME VALUE 'resting' TO 'Resting';
ALTER TYPE nx.dev_status_enum RENAME VALUE 'frozen' TO 'Frozen';
ALTER TYPE nx.dev_status_enum ADD VALUE 'Exhausted';
```

Plus VARCHAR UPDATEs for species, social_style, coding_style, work_ethic.

**Then update simultaneously:**
- All 6 production dispatch dicts (engine.py, templates.py, listener.py, dev_generator.py, prompt_system.py)
- All 10 test fixtures
- All hardcoded string comparisons (e.g., `WHERE status = 'active'` becomes `WHERE status = 'Active'`)
- Any value-typed Postgres expressions

Pros: a single source of truth (bundle format) flows through entire stack.
Cons: blast radius is large; one missed dispatch site silently degrades behavior; ENUM renames are non-atomic across multiple types (transactional but multiple SQL statements); `'GitHub HQ'` decision adds complexity.

### Option B: Keep DB stable, translate at the metadata-emit boundary (recommended)

Leave DB enums and VARCHAR pools as-is. Add a small, well-tested mapping layer in the metadata composer (`compose_metadata_json`) that converts DB values → bundle Title Case on emit.

```python
# backend/services/metadata/value_maps.py
ARCHETYPE_DISPLAY = {
    "10X_DEV": "10X Dev", "LURKER": "Lurker", "DEGEN": "Degen",
    "GRINDER": "Grinder", "INFLUENCER": "Influencer",
    "HACKTIVIST": "Hacktivist", "FED": "Fed", "SCRIPT_KIDDIE": "Script Kiddie",
}
CORPORATION_DISPLAY = {
    "CLOSED_AI": "Closed AI", "MISANTHROPIC": "Misanthropic",
    "SHALLOW_MIND": "Shallow Mind", "ZUCK_LABS": "Zuck Labs",
    "Y_AI": "Y.AI", "MISTRIAL_SYSTEMS": "Mistrial Systems",
}
RARITY_DISPLAY = {"common": "Common", "uncommon": "Uncommon",
                  "rare": "Rare", "legendary": "Legendary", "mythic": "Mythic"}
MOOD_DISPLAY = {"neutral": "Neutral", "excited": "Excited", "angry": "Angry",
                "depressed": "Depressed", "focused": "Focused"}
LOCATION_DISPLAY = {
    "BOARD_ROOM": "Board Room", "HACKATHON_HALL": "Hackathon Hall",
    "THE_PIT": "The Pit", "DARK_WEB": "Dark Web", "VC_TOWER": "VC Tower",
    "OPEN_SOURCE_GARDEN": "Open Source Garden", "SERVER_FARM": "Server Farm",
    "GOVERNANCE_HALL": "Governance Hall", "HYPE_HAUS": "Hype Haus",
    "THE_GRAVEYARD": "The Graveyard", "GitHub HQ": "GitHub HQ",
}
STATUS_DISPLAY = {"active": "Active", "resting": "Resting",
                  "frozen": "Frozen", "exhausted": "Exhausted"}
```

Then in `dev_canonical_traits`, store the bundle Title Case values directly (since canonical = bundle). The endpoint reads:
- `nx.devs.{archetype, corporation, rarity_tier, mood, location, status}` → translate via maps before emit
- `dev_canonical_traits.*` → emit verbatim (already bundle format)

For the species/alignment/risk_level/social_style/coding_style/work_ethic VARCHAR columns: store the bundle values in `dev_canonical_traits` (which the metadata endpoint reads), and leave `nx.devs` columns alone (engine doesn't dispatch on them).

**Pros:**
- Zero risk to engine — DB values unchanged, all dispatch dicts still match.
- Tests continue to pass without modification.
- One small, locally-tested mapping module, easy to review.
- `'GitHub HQ'` and any future runtime-added enum values handled by adding an entry in one dict.
- Reversible — delete the file, endpoint emits raw DB values.

**Cons:**
- Two representations of the same value live in the codebase (DB form + display form). Mitigation: this already exists today (`devs.py:347-352`), we're just centralizing.
- Future contributors might write a query that filters on `archetype = '10X Dev'` and silently get zero rows. Mitigation: code comment + linter rule.

### Recommendation

**Take Option B unless there's a compelling reason to rewrite the engine.** The blast radius reduction is substantial, the rollback story is clean, and the user-facing behavior is identical. Phase 2.5's `UPDATE nx.devs SET ... FROM dev_canonical_traits` becomes unnecessary for enum columns under Option B.

VARCHAR columns (species, social_style, coding_style, work_ethic) can still be aligned to bundle values via UPDATE, since the engine doesn't dispatch on them. That's lower-risk and worth doing for data hygiene.

**Open question for the human:** Option A or Option B?

---

## 8. Other surprises worth flagging

1. **Listener and `dev_generator.py` are duplicate code**, both generate stat values in `15..95`. Bundle has values down to 5. **Whoever made the bundle used a different generator.** Either someone re-rolled stats with a wider range, or an older listener version produced these values and was later changed. Either way, `nx.devs.stat_*` for currently-minted Devs probably matches the listener (15-95), not the bundle (5-95). Confirm with §6 probe M.

2. **`'GitHub HQ'` value in `location_enum`** is added at runtime by `_run_auto_migrations()` (`backend/api/main.py:80-83`). Not in the bundle. After Phase 2 we either:
   - Map `'GitHub HQ'` → `'GitHub HQ'` (Title Case unchanged) in the location display map
   - Or accept that some live Devs have a Location that isn't in the canonical bundle's location set

3. **Bundle is a target, not a snapshot.** All dynamic values are zero/initial. Bundle was produced offline as the "what we want" output, not exported from the live API. Confirms the goal: the new endpoint should produce JSON that exactly matches the bundle for the immutable parts.

4. **`Devs Burned: 0` in bundle** but the brief drops it. Bundle has it. This means OpenSea has been seeing a stale `Devs Burned: 0` trait for every token. Removing it from the new API will cause the trait to disappear from existing OpenSea pages until refresh, which is fine.

5. **Stat baseline source-of-truth question.** If `dev_canonical_traits.stat_*` is loaded from the bundle (range 5-95) but `nx.devs.stat_*` is the listener-generated (range 15-95), the metadata endpoint's `Coding`/`Hacking`/etc. values can come from either. Brief §3.1 reads dynamic state from `nx.devs`; baseline stats from `canonical`. So users see bundle stats. That's probably correct, but means users' Devs may have visibly *different* stats post-deploy than they did pre-deploy for ~10% of Devs. **Decide: keep bundle as truth, or align nx.devs.stat_* to bundle in Phase 2.5.**

6. **Old visual columns in `nx.devs`** (`skin, vibe, glow, hair_*, facial, headgear, extra`) are dead weight. Out of scope to remove now, but worth a follow-up cleanup migration.

7. **No EIP-4906 in contract.** Phase 4 §6.2 of the original brief assumed contract emits `BatchMetadataUpdate`; it does not. Per-token marketplace refresh remains the only option. Already captured in the new brief's §4.2.

8. **`nx-terminal.onrender.com/metadata/{id}` access not verified.** Cold-start returns a Spring Boot 404 — possibly the FastAPI service is asleep / scaled to zero. Worth confirming the service is reachable before Phase 4 deploy, since marketplaces will hit this URL on every refresh.

---

## 9. Decisions needed for Phase 2.1 to begin

| # | Question | Default if no answer |
|---|---|---|
| 1 | **Migration approach: Option A (rename enums) or Option B (translate at emit)?** | Option B — safer |
| 2 | **`dev_canonical_traits.stat_*` source: bundle or `nx.devs`?** | Bundle (since bundle = canonical) |
| 3 | **Align `nx.devs.stat_*` to bundle, or keep listener values?** | Align to bundle (§5 mismatch) |
| 4 | **`'GitHub HQ'` location: keep / drop / rename?** | Keep, since live Devs may be there |
| 5 | **Drop `nx.devs.devs_burned` column or just stop emitting?** | Drop (data has no other consumer) |
| 6 | **Drop `nx.devs.{skin, vibe, glow, hair_*, facial, headgear, extra}` now or later?** | Later — out of scope |
| 7 | **Run a full 35 000-token bundle scan to lock down complete value sets before migration?** | Yes — small cost, high value |
| 8 | **Confirm `nx-terminal.onrender.com` is the live metadata host (and warm)?** | Yes — Phase 4 deploy depends on it |
| 9 | **Energy migration path — confirm via §6 probe A first?** | Yes — required before Phase 2.1 |

---

## 10. What I did NOT do

- Did not run any production SQL.
- Did not create `dev_canonical_traits`.
- Did not run any migration.
- Did not modify any source file.
- Did not download the full bundle (only ~127 sample JSONs in `/tmp/bundle{,2}/`).

---

## 11. Sign-off

🛑 **STOP at Checkpoint 2 (pre-Phase-2.1).** Awaiting:
1. Human approval of Option A vs. Option B (§7).
2. Decisions 2–9 in §9.
3. Result of SQL probes A, F, K, M, N from §6.

Once those are in hand, Phase 2.1 (migration + ingest script + tests) can proceed.
