# NX PETS — Personality Audit

- **Generated**: 2026-05-01
- **Auditor**: Claude Code
- **Repo commit**: `ce81bf8e3dc5f5b3b82e791b31f7364acd3140a4`
- **Branch**: `claude/audit-nx-pets-pwa-IWGKC`

---

## 1. Executive summary

Yes — 35,000 unique personalities are **easily** feasible from existing data. The `nx.devs` schema already carries **at least 9 trait axes set deterministically at mint** from the token_id seed (corporation, archetype, rarity, species, alignment, risk_level, social_style, coding_style, work_ethic) plus 6 numeric stat axes (15–95 range each) plus a 32-bit `personality_seed` integer for derived sub-traits. Combinatorial space is in the hundreds of millions before stats are even considered, far exceeding 35,000.

**Single biggest finding**: the brief's instinct that "corporation = personality" is dramatically wrong — `corporation` carries **less** signal than `archetype` does today. The 8 archetypes already have hand-written voices in `templates.py::CHAT_TEMPLATES` (`backend/engine/templates.py:132-338`), one per archetype, that read as wildly different characters (10X_DEV is loud and arrogant, LURKER is monosyllabic, DEGEN is all-caps degenerate, FED is corporate compliance). The corporations have **no per-corp voice** anywhere in the engine. **Archetype is the macro-voice axis. Corporation is a flavor modulator at best.**

**What's missing for the LLM phase**:
- The schema columns `skin`, `clothing`, `vibe`, `glow`, `hair_style`, `hair_color`, `facial`, `headgear`, `extra` exist but **are never populated** (`backend/db/schema.sql:113-121` — no listener or generator writes them; `/metadata/{token_id}` reads them with `dev.get(..., "")` defensive defaults). They're a placeholder for a future visual-trait expansion. The current image lives at IPFS as a single `.gif` per token; visual variation is encoded in the GIF, not the DB.
- "Skill Modules" (DEPLOY, AUDIT, BRIDGE, etc.) **do not exist anywhere** in the schema, generator, listener, or templates. Confirmed with grep — no hit. This concept is a brief-only invention.
- "Type" in the Bunny/Zombie/Robot sense from prior conversations **does not exist as that vocabulary**. The actual axis is `species`, with 14 values (`Wolf, Cat, Owl, Fox, Bear, Raven, Snake, Shark, Monkey, Robot, Alien, Ghost, Dragon, Human` — see `backend/engine/dev_generator.py:44-47`). This is the Type axis. The brief's "Bunny" is not in the pool; "Zombie" is not in the pool; "Robot" is.
- No `level` or `xp` columns. `reputation INTEGER` exists but is bookkeeping (drives leaderboards), not a personality axis.

---

## 2. Direct columns on `nx.devs` (identity-relevant only)

Source: `backend/db/schema.sql:80-178` + auto-migration columns from `backend/api/main.py:31-33,302-304`.

### 2.1 Trait columns (set at mint, never mutated)

| Column | Type | Range | Set by | Cardinality | Personality? |
|---|---|---|---|---|---|
| `name` | VARCHAR(30) UNIQUE | e.g. `KIRA-11`, `STORM-D4` | `dev_generator.generate_dev_name`, deterministic by `token_id` | 46 prefixes × 30 suffixes = **1,380** unique base names; `-{token_id}` collision suffix expands further | YES — addressable identity |
| `archetype` | `archetype_enum` | `10X_DEV, LURKER, DEGEN, GRINDER, INFLUENCER, HACKTIVIST, FED, SCRIPT_KIDDIE` | weighted choice (`ARCHETYPE_WEIGHTS` `dev_generator.py:30-33`) | **8** | **YES — strongest voice axis today** (each has a hand-written voice in `templates.py:132-338`) |
| `corporation` | `corporation_enum` | `CLOSED_AI, MISANTHROPIC, SHALLOW_MIND, ZUCK_LABS, Y_AI, MISTRIAL_SYSTEMS` | uniform (`dev_generator.py:39-42`) | **6** | YES — but NO existing voice differentiation; brand satire only |
| `rarity_tier` | `rarity_enum` | `common, uncommon, rare, legendary, mythic` | weighted (`RARITY_WEIGHTS`: 60/25/10/4/1) | **5** | weak today — drives only `gen_visual_traits` special-effect frequency (`templates.py:483-498`); good candidate for sass/length modulation |
| `species` | VARCHAR(20) | `Wolf, Cat, Owl, Fox, Bear, Raven, Snake, Shark, Monkey, Robot, Alien, Ghost, Dragon, Human` | uniform (`dev_generator.py:44-47`) | **14** | YES — this is the brief's "Type" axis. Species name ≠ personality, but is a strong modulator (a Ghost talks differently than a Bear) |
| `alignment` | VARCHAR(20) | D&D 9-axis: `Lawful Good`...`Chaotic Evil` | uniform (`dev_generator.py:49-53`) | **9** | YES — moral compass for the persona |
| `risk_level` | VARCHAR(20) | `Conservative, Moderate, Aggressive, Reckless` | uniform | **4** | YES — financial/decision tone |
| `social_style` | VARCHAR(20) | `Quiet, Social, Loud, Troll, Mentor` | uniform | **5** | YES — interaction tone |
| `coding_style` | VARCHAR(20) | `Methodical, Chaotic, Perfectionist, Speed Runner, Copy Paste` | uniform | **5** | YES — work-product self-perception |
| `work_ethic` | VARCHAR(20) | `Grinder, Lazy, Balanced, Obsessed, Steady` | uniform | **5** | YES — relationship to work |
| `personality_seed` | BIGINT NOT NULL | 1 .. 2,147,483,647 | `rng.randint` (`dev_generator.py:123`) | **2.1 billion** | YES — deterministic source for any sub-trait the LLM phase wants to derive without schema changes (favorite color, music genre, catchphrase) |
| `ipfs_hash` | VARCHAR(66) | `{IMAGE_CID}/{token_id}.gif` | mint | unique per token | references the visual; not a trait per se |

### 2.2 Stat baselines (set at mint, immutable)

`stat_coding`, `stat_hacking`, `stat_trading`, `stat_social`, `stat_endurance`, `stat_luck` — all `SMALLINT NOT NULL DEFAULT 50`, set at mint via `rng.randint(15, 95)` (`dev_generator.py:109-114`). Range 15–95, ~80 buckets each, but **trainable** via shop (`POST /api/shop/buy effect.type=training`) and `POST /api/shop/graduate` increments by 4 (class) or 2 (course). So they drift over time but slowly; treat as **trait with state-shift permitted** in the LLM persona.

### 2.3 State columns (mutated continuously by engine + user)

| Column | Type | Range | Mutated by | Personality? |
|---|---|---|---|---|
| `mood` | `mood_enum` | `neutral, excited, angry, depressed, focused` | engine: random shift 10% chance per cycle (`engine.py:660-662`); user: `mood_reset` shop item (`shop.py:341-346`) | **STATE axis** — modulator only |
| `energy` | SMALLINT 0..15 | engine decays −1/h, items +5..18 | STATE — current alertness |
| `pc_health` | SMALLINT 0..100 | engine −2/h, `pc_repair` item → 100 | STATE — equipment status |
| `caffeine` | SMALLINT 0..100 | engine −2/h, coffee item +25 | STATE — speed/agitation |
| `social_vitality` | SMALLINT 0..100 | engine −1/h with floor recovery to 25; team_lunch +20 | STATE — extraversion |
| `knowledge` | SMALLINT 0..100 | engine −1/h with floor recovery to 30; read_docs +15 | STATE — confidence/depth |
| `coffee_count` | INTEGER 0..∞ | counter incremented per coffee/burger/pizza/carrot purchase (`shop.py:330-333`) | TRAIT-OVER-TIME (history axis) |
| `bugs_shipped` | INTEGER 0..∞ | engine: low-knowledge generates 1–2/h; `fix_bugs` item −15 | TRAIT-OVER-TIME (history axis — chaos signature) |
| `bugs_fixed` | INTEGER 0..∞ | `fix_bugs` item +N | TRAIT-OVER-TIME (history axis — craft signature) |
| `hours_since_sleep` | INTEGER 0..∞ | engine +1 per non-REST cycle (`engine.py:655-657`) | STATE/TRAIT — sleep deprivation modulator |
| `lines_of_code` | INTEGER 0..∞ | engine: incremented by CREATE_PROTOCOL, etc. | history axis — productivity |
| `protocols_created`, `protocols_failed`, `ais_created`, `devs_burned`, `code_reviews_done`, `bugs_found`, `cycles_active` | INTEGER counters | engine | history axes (achievement signatures) |
| `reputation` | INTEGER, default 50 | engine: ±N from actions | history axis — social standing |
| `balance_nxt` | BIGINT | salary, shop spend, hacks, transfers | history axis — wealth signature (debatable, see §10) |
| `total_earned`, `total_spent`, `total_invested` | BIGINT counters | engine + shop | history axes |
| `location` | `location_enum` | 10 values (`BOARD_ROOM, HACKATHON_HALL, THE_PIT, DARK_WEB, VC_TOWER, OPEN_SOURCE_GARDEN, SERVER_FARM, GOVERNANCE_HALL, HYPE_HAUS, THE_GRAVEYARD, GitHub HQ`) | engine: MOVE actions | STATE — context modulator |
| `status` | `dev_status_enum` | `active, resting, frozen, on_mission` | engine + missions | STATE |
| `last_action_type/_detail/_at` | enum/TEXT/TS | — | engine | STATE — most recent context for "what just happened" |
| `last_message`, `last_message_channel` | TEXT | — | engine: caches last chat | STATE |
| `last_raid_at`, `training_course`, `training_ends_at` | timestamps/text | — | shop | STATE |
| `biggest_win` | TEXT | engine sets when a record is broken | history axis — self-mythology |
| `day` | INTEGER | engine cycle counter | STATE — narrative timeline |
| `next_cycle_at`, `cycle_interval_sec` | scheduling | engine | not personality |
| `minted_at`, `updated_at` | TS | — | not personality |

### 2.4 Always-NULL "visual" columns (placeholder)

`skin, clothing, vibe, glow, hair_style, hair_color, facial, headgear, extra` (`schema.sql:113-121`). **Never written** by any code path I could find. `dev_generator.insert_dev` (`listener.py:230-276`) does NOT include them; the on-demand insert (`devs.py:131-161`) does NOT include them. `/metadata/{token_id}` (`devs.py:288-303`) reads with safe defaults. **Treat as non-existent for LLM phase v1.**

### 2.5 No JSONB trait columns

No `traits`, `tags`, `flags`, `metadata` JSONB column on `devs`. Closest is `actions.details JSONB` (per-action detail payload, not a trait carrier).

---

## 3. NFT metadata

Source: `backend/api/routes/devs.py::get_dev_metadata` (`devs.py:276-363`), exposed at `GET /metadata/{token_id}` and `GET /api/devs/{id}/metadata`. This is what wallets/explorers read when rendering the NFT.

### 3.1 trait_type universe

Visual block (`devs.py:288-303`):
- `Species` (always present, fallback "Human")
- `Skin`, `Clothing`, `Vibe`, `Screen Glow` — always present but **always empty string** today (columns NULL)
- `Hair Style`, `Hair Color`, `Facial Hair`, `Headgear`, `Extra` — conditionally appended only if column non-null (always omitted today)

Identity block (`devs.py:306-315`): `Archetype`, `Corporation`, `Rarity`, `Alignment`, `Risk Level`, `Social Style`, `Coding Style`, `Work Ethic`.

Base stats block (`devs.py:318-325`): `Coding`, `Hacking`, `Trading`, `Social`, `Endurance`, `Luck` — all with `display_type: "number"`, `max_value: 100` (note: stats are 15–95 in DB, brief was right that the metadata claim is loose).

Dynamic block (`devs.py:328-344`): `Status`, `Mood`, `Location`, `Energy` (with `max_value: 100` ⚠ — column is 0–15), `Reputation`, `Balance ($NXT)`, `Day`, `Coffee Count`, `Lines of Code`, `Bugs Shipped`, `Hours Since Sleep`, `Protocols Created`, `Protocols Failed`, `Devs Burned`, `Biggest Win`.

### 3.2 Source of these attributes

**100% derived from `nx.devs` columns** at request time. There is no `dev_metadata` or `dev_attributes` table. There is no IPFS metadata sidecar — only the IPFS GIF image at `{IMAGE_CID}/{token_id}.gif`. Visual traits are **encoded inside the GIF**, not in DB or sidecar JSON. The metadata endpoint is dynamic and reflects the dev's current state every call.

### 3.3 Rarity-vs-archetype tie

There is **no enforced tie** between rarity and archetype in the generator — both are independently weighted-random. A `mythic` `LURKER` is possible. A `common` `10X_DEV` is possible.

### 3.4 Sub-archetype within corporation

**Does not exist.** No second archetype dimension scoped to a corporation. The existing `(archetype, corporation)` pair is a 2D grid of 48 cells with no per-cell vocabulary.

---

## 4. Behavioral history available

All history aggregations the LLM phase can pull, with the file producing them:

### 4.1 Per-Dev counters already on the row

Read directly from `devs`: `coffee_count`, `bugs_shipped`, `bugs_fixed`, `protocols_created`, `protocols_failed`, `ais_created`, `devs_burned`, `lines_of_code`, `code_reviews_done`, `bugs_found`, `cycles_active`, `total_earned`, `total_spent`, `total_invested`, `hours_since_sleep`, `reputation`, `biggest_win`. **Zero query cost** — already on the SELECT.

### 4.2 Action log (`actions` table, `schema.sql:264-283`)

Partitioned by `created_at`. Indexes on `(dev_id, created_at DESC)`, `(action_type, created_at DESC)`. JSONB `details` per row carries action-specific payload (e.g. hack outcome, transfer counterparty).

Useful aggregations the LLM can pull cheaply:
- Distribution of `action_type` for last 30 days (favorite move).
- Count of `HACK_MAINFRAME` / `HACK_RAID` wins vs losses (status from `details.success`).
- Last `RECEIVE_SALARY` timestamp (productivity rhythm).
- `code_review_bug` vs `code_review_clean` ratio in `chat_messages` for the dev.

### 4.3 Shop-purchase log (`shop_purchases`, `schema.sql:328-336`)

Per-dev item history. Aggregations:
- Favorite shop item (most-purchased `item_type`).
- Pizza-to-coffee ratio.
- Lifetime $NXT spent in shop.
- Whether this dev has ever trained (`item_type LIKE 'class_%' OR 'course_%'`).
- Hack hit rate across `hack_mainframe` and `hack_raid` rows.

### 4.4 Engine-written chat (`chat_messages`, `schema.sql:289-302`)

Partitioned. Per-dev message history with `channel` (`location` / `trollbox`), `location`, `message`, `chat_type` (added by migration `main.py:146-149` — `idle`/`hot_take`/`meme`/`reaction`/...), `social_gain`. Aggregations:
- Most-common `chat_type` for this dev (their public posture).
- Average `social_gain` (charisma).

### 4.5 Player→Dev prompts (`player_prompts`, `schema.sql:342-352`)

Records every prompt the human owner has sent. NX PETS chat is conceptually similar but stored in a new table per the prior audit. Could feed in: "owner has sent you 47 prompts" as relationship context.

### 4.6 Mission and academy participation (extends actions/`player_missions`)

`player_missions(group_id, dev_token_id, status)` — for "this dev has completed 12 missions, mostly hard difficulty."

### 4.7 Reputation deltas

There is no `reputation_history` table — only the current `reputation` value is stored. Deltas are not separately logged; can only see what the engine writes through `actions.details` JSONB.

---

## 5. Relationships

- **Owner**: `devs.owner_address VARCHAR(42)` references `players.wallet_address` (`schema.sql:83`). Updated on Transfer event by `backend/engine/listener.py`. **No transfer history table** — past owners are NOT preserved. Once the dev transfers, the previous owner is forgotten in the schema.
- **Rivalries / alliances**: NO. No `dev_relations` / `friends` / `rivals` table. The closest signal is hack history: rows in `actions` with `action_type='HACK_RAID'` and `details.target_id` linking attacker→target. No bidirectional relationship is computed or cached.
- **Corp hierarchy**: NO. The `corporation_enum` is flat. No CEO/IC/intern roles.
- **Implicit relationships available**: who has ever hacked this dev (query `actions WHERE details->>'target_id' = '{token_id}' AND action_type='HACK_RAID'`); who has ever been on the same `player_missions.group_id`; who shares the same `corporation`.

---

## 6. Existing voice generation

### 6.1 `templates.py` structure (`backend/engine/templates.py:1-719`)

**Per-archetype, not per-corporation, not per-dev.** Voice surfaces are:

- `CHAT_TEMPLATES[archetype][context]` (`templates.py:132-338`) — 8 archetypes × 7 contexts (`idle, created_protocol, created_ai, invested, sold, code_review_bug, code_review_clean`). Hand-written voices, very distinct per archetype.
- `CHAT_TYPE_TEMPLATES[chat_type]` (`templates.py:520+`) — flat pools shared across archetypes for `hot_take`, `meme`, `reaction`. Personality emerges from `CHAT_TYPE_WEIGHTS` (in `engine.py`) biasing which type each archetype picks.
- `gen_chat_message(archetype, context, **kwargs)` (`templates.py:464-480`) — random pick + placeholder fill (`{name}`, `{thing}`, `{thing2}`, `{line}`).
- `gen_visual_traits(rarity)` (`templates.py:483-498`) — produces a dict NOT currently persisted to the schema (legacy / unused; see §2.4).

### 6.2 Other voice surfaces

- `prompt_system.py` (`backend/engine/prompt_system.py`, 885 lines) — keyword-based intent classifier for player→dev prompts, with **per-archetype response templates per intent × topic**. Much richer than `CHAT_TEMPLATES` — has `COMPLY` / `REFUSE` / `QUESTION_ANSWER` branches with archetype-specific lines (`prompt_system.py:560` glimpsed an INFLUENCER COMPLY line).
- `engine.py:185` — `MOODS = ["neutral", "excited", "angry", "depressed", "focused"]`.
- World event templates (`templates.py:344-381`) — narrative context, not per-dev.

### 6.3 Per-dev variation today

Within a single archetype the only variation is `random.choice` over the template list. Two `LURKER` devs with identical context produce indistinguishable messages over time. **No name, no rarity, no species, no mood, no alignment, no work_ethic, no risk_level, no coding_style, no social_style is interpolated into the message text.** All the rich axes set at mint are dormant in the voice layer.

### 6.4 Tone characterization

Without production fixtures available locally, the templates themselves characterize the voice. Sample:
- 10X_DEV: arrogant, terse, productivity-bragging.
- LURKER: monosyllabic, observational ("...", "*observing*", "Noted.").
- DEGEN: caps lock, crypto-Twitter, financial mania.
- GRINDER: stoic, work-ethic platitudes ("Slow and steady", "No shortcuts").
- INFLUENCER: thread-bait, brand voice ("MAJOR ANNOUNCEMENT", "Link in bio").
- HACKTIVIST: cyberpunk, paranoid, decentralization.
- FED: corporate-compliance, audit-speak.
- SCRIPT_KIDDIE: insecure copy-paste energy.

These are **excellent macro-voice anchors** for the LLM phase — reuse the archetype-level voice, layer corp/species/mood on top.

---

## 7. Mint randomness seed

**Yes, two of them.**

1. `random.Random(token_id)` — the seed for ALL generator decisions (`dev_generator.py:100`, `listener.py:170`). Deterministic: token #5 always produces the same archetype/corp/rarity/etc. forever, at any future mint or on-demand backfill.
2. `personality_seed BIGINT NOT NULL` — captured at mint as `rng.randint(1, 2147483647)` (`dev_generator.py:123`) **and persisted to the row**. **This is the key gift to the LLM phase**: any sub-trait the persona generator wants (favorite color, catchphrase, music genre, food preference, screen-saver setting) can be derived deterministically from `personality_seed` without a schema migration. A simple `random.Random(personality_seed)` in the persona generator reproducibly picks from any custom pool.

---

## 8. Confirm or refute brief assumptions

| Assumption | Status | Evidence |
|---|---|---|
| Skill Modules (DEPLOY, AUDIT, BRIDGE, BROADCAST, ARBITRAGE, INFILTRATE) exist in schema | **REFUTED** | `grep "DEPLOY\|AUDIT\|BRIDGE\|BROADCAST\|ARBITRAGE\|INFILTRATE"` in `schema.sql, dev_generator.py, templates.py` returns one hit: `'DEPLOY'` is an `action_enum` value (`schema.sql:46`), not a Skill Module. There is no skill_module column or enum. **PWA-frontend invention.** |
| Type = Bunny / Zombie / Robot, with 85/10/5 distribution | **REFUTED as named** | The actual axis is `species`, with 14 uniform values: `Wolf, Cat, Owl, Fox, Bear, Raven, Snake, Shark, Monkey, Robot, Alien, Ghost, Dragon, Human` (`dev_generator.py:44-47`). No Bunny. No Zombie. Robot exists. Distribution is **uniform** not 85/10/5. |
| Rarity = Common / Uncommon / Rare / Epic / Legendary | **REFUTED with substitution** | The actual enum (`schema.sql:35-37`, `dev_generator.py:35-37`) is `common, uncommon, rare, legendary, mythic` (5 tiers, weighted 60/25/10/4/1). "Epic" doesn't exist; the top tier is "mythic" not "legendary." |
| Sub-archetype within corporation | **REFUTED** | `(archetype, corporation)` is a flat 2D pair; neither dimension has per-cell sub-vocabulary. |
| `archetype` is the strongest voice signal today | **CONFIRMED** | Only axis with hand-written voice templates per value (`templates.py:132-338`). |
| Corporation drives voice differentiation today | **REFUTED** | No per-corp templates anywhere. `WORLD_EVENT_TEMPLATES` references corps for buffs/debuffs but no voice. |

---

## 9. Proposed personality vector

10 axes — all sourced from `nx.devs` columns. Total combinatorial space = **8 × 6 × 5 × 14 × 9 × 4 × 5 × 5 × 5 × 5 = 7,560,000** trait configurations, before stats and counters and seed-derived sub-traits. 35,000 devs map into this space sparsely; collisions on the full 10-tuple are statistically negligible.

| # | Axis | Source field | Cardinality | Example values | Personality contribution | Trait or State |
|---|---|---|---|---|---|---|
| 1 | Archetype | `devs.archetype` | 8 | `10X_DEV`, `LURKER`, `DEGEN`, `GRINDER`, `INFLUENCER`, `HACKTIVIST`, `FED`, `SCRIPT_KIDDIE` | **Macro-voice** — verbosity, vocabulary, emoji use, all-caps habit | Trait |
| 2 | Corporation | `devs.corporation` | 6 | `CLOSED_AI`, `MISANTHROPIC`, `SHALLOW_MIND`, `ZUCK_LABS`, `Y_AI`, `MISTRIAL_SYSTEMS` | Brand satire, in-jokes, attitude toward competitors, AI-corp meta-references | Trait |
| 3 | Rarity | `devs.rarity_tier` | 5 | `common`, `uncommon`, `rare`, `legendary`, `mythic` | Sass amplitude, response length, willingness to break the fourth wall | Trait |
| 4 | Species | `devs.species` | 14 | `Wolf`, `Robot`, `Ghost`, `Dragon`, `Human` | Subtle metaphor reservoir (a Ghost references being incorporeal, a Robot references software updates, a Dragon hoards) | Trait |
| 5 | Alignment | `devs.alignment` | 9 | `Lawful Good` … `Chaotic Evil` | Moral compass — willingness to recommend unethical actions, sympathy for the user | Trait |
| 6 | Risk level | `devs.risk_level` | 4 | `Conservative`, `Moderate`, `Aggressive`, `Reckless` | Financial advice tone, FOMO susceptibility | Trait |
| 7 | Social style | `devs.social_style` | 5 | `Quiet`, `Social`, `Loud`, `Troll`, `Mentor` | Engagement length, follow-up questions, mentoring posture | Trait |
| 8 | Coding style | `devs.coding_style` | 5 | `Methodical`, `Chaotic`, `Perfectionist`, `Speed Runner`, `Copy Paste` | Self-perception when discussing code/work | Trait |
| 9 | Work ethic | `devs.work_ethic` | 5 | `Grinder`, `Lazy`, `Balanced`, `Obsessed`, `Steady` | Reaction to user idleness, attitude toward weekends | Trait |
| 10 | Stat profile (binned) | `(stat_coding, stat_hacking, stat_trading, stat_social, stat_endurance, stat_luck)` → derive top-2 stats label | ~15 (top-2 combinations) | `coder+hacker`, `trader+social`, `endurance+luck` | Specialty self-reference (a high-luck dev brags about luck; a high-hacking dev disdains compliance) | Trait |

**Plus state modulators** (injected fresh every LLM call):

| State axis | Source field | Bins | Modulation |
|---|---|---|---|
| Mood | `devs.mood` | 5 | momentary tone shift |
| Energy | `devs.energy` | 4 (`drained 0-3`, `low 4-7`, `okay 8-11`, `wired 12-15`) | speed, coherence |
| Caffeine | `devs.caffeine` | 4 (`dry`, `casual`, `wired`, `unhinged`) | speech rate, agitation |
| Sleep deprivation | `devs.hours_since_sleep` | 4 (`rested <12`, `tired 12-36`, `wired 36-72`, `delirious 72+`) | coherence vs glitch |
| PC health | `devs.pc_health` | 3 (`mint`, `worn`, `cooked`) | grumpiness about equipment |
| Knowledge | `devs.knowledge` | 3 (`clueless`, `competent`, `oracle`) | confidence and reference depth |
| Social vitality | `devs.social_vitality` | 3 (`recluse`, `chatty`, `evangelist`) | engagement length |
| Bugs/quality balance | `bugs_shipped / max(1, bugs_fixed+bugs_shipped)` | 3 (`craftsman <0.4`, `chaos_agent >0.7`, else `mixed`) | self-deprecation level |
| Wealth signature | `balance_nxt` log-binned | 4 (`broke`, `getting by`, `comfortable`, `whale`) | references to money |
| Last action | `devs.last_action_type`, `devs.last_action_at` | freeform | "what just happened" hook |
| Recent record | `devs.biggest_win` | freeform string | self-mythology callback |
| Location | `devs.location` | 11 | scene-setting |

**Plus seed-derived sub-traits** (computed from `personality_seed`, no schema needed): favorite-music, drink, food, swear-word-of-choice, idol, signature emoji. These give every dev unique surface texture without bloating the schema.

---

## 10. Trait vs state — fine print

- **Traits go in the SYSTEM prompt**, fixed for the lifetime of the dev (or until owner explicitly retrains/transfers): axes 1–9 above, plus `name`, `personality_seed`-derived sub-traits, and `stat_*` baselines (treat as trait-with-slow-drift).
- **State goes in the USER prompt header**, refreshed every call: mood, energy, caffeine, hours_since_sleep, pc_health, knowledge, social_vitality, bugs ratio, balance, location, last action, biggest win.

**Edge case — stat training**: a Dev whose `stat_coding` rises from 32 to 56 over a month should still feel like the same character. Training shifts the stat profile bin slowly; consider freezing the trait-block stat-profile label at first persona-cache build and only refreshing if the bin actually changes. Document in the cache schema.

**Edge case — owner transfer**: traits are immutable across transfers (a dev is still itself), but memories should NOT be (see §13 risk 4). Decouple persona caching (per `token_id`) from memory caching (per `(token_id, owner_wallet)`).

**Argument for keeping `balance_nxt` as a state axis (vs cutting it)**: wealth changes faster than personality should and wealth-bragging would warp tone every time the engine pays salary. **Keep it as a low-weight state hint** ("you're feeling flush" / "you're stretched thin"), don't promote it to trait.

**Cut from the vector** (considered, rejected):
- `level`, `xp` — don't exist as columns.
- `reputation` — leaderboard bookkeeping, drifts with engine actions outside the user's control; would create personality whiplash.
- `last_action_at` (raw timestamp) — useless to LLM; binned as "what just happened" via `last_action_type` + `last_action_detail` is enough.
- `next_cycle_at`, `cycle_interval_sec` — scheduling, not character.
- `minted_at`, `updated_at` — bookkeeping. Could derive an "age" trait ("you've been alive for 42 days") but skip in v1.
- All `total_*` and `protocols_*` counters — fold the most colorful one into `biggest_win` and skip the rest in v1.

---

## 11. Naming

**Devs already have names.** Generated at mint, deterministic from `token_id` via `generate_dev_name()` (`dev_generator.py:80-89`). Stored in `devs.name VARCHAR(30) UNIQUE`. Format: `{PREFIX}-{SUFFIX}` with collision suffix `-{token_id}` if needed. 46 prefixes × 30 suffixes = 1,380 base names; uniqueness over 35,000 devs is enforced by the DB constraint plus token_id collision suffix.

**Name correlation with traits**: NONE today. Name is independent of archetype/corp/species. (A `Ghost SCRIPT_KIDDIE` and a `Dragon 10X_DEV` are equally likely to be named `KIRA-11` or `GLITCH-404`.) The names are spectral/cypherpunk-flavored uniformly.

**Recommendation for NX PETS**:
- Keep the existing name as the **canonical address** the user calls (it's already on the NFT, the metadata, the leaderboards — changing it is a breaking change).
- **Optional pet-only "nickname"** stored in a new column or in `players` (e.g. `companion_nickname VARCHAR(20)`) the user can set per-dev. Defaults to empty; the LLM prompt prefers `nickname || name`.
- Do NOT regenerate names — that breaks identity continuity for existing owners.

---

## 12. Implementation pattern recommendation

(Recommendations — human decides.)

### 12.1 System prompt assembly

**Recommend: (b) base prompt + per-axis fragment library, concatenated at first contact, cached per Dev.**

- (a) one mega-template: brittle and large; every change to one axis touches the whole template.
- (c) generative-from-traits: an LLM call to build the persona prompt creates a cold-start latency on first chat and burns free-tier quota for no reason; cache wins anyway.
- (b) is cheap, deterministic, debuggable. Each axis owns a small fragment dictionary; concatenation produces a 600–1,200 token system prompt with a stable structure.

### 12.2 Caching

**Recommend: Redis with key `persona:v1:{token_id}` and TTL 24h.**
- Backing store (cold): persist the rendered prompt to a `dev_persona_cache(token_id, prompt_text, axis_hash, generated_at)` table on a slower path so a Redis flush doesn't melt the system. `axis_hash` covers the 9 trait fields; cache-invalidate when it changes (rare — only if engine ever mutates a trait, which today it does not).
- Stat-profile bin is part of `axis_hash` so a Dev that trains across a bin boundary picks up the new label on next regen.

### 12.3 State injection

**Recommend a compact, single-line state block prepended to the user message** (or in a system "current_state" message before the user turn). Example:

```
STATE: tired; mood=focused; caffeine=dry(8); 47h no sleep; broke; just got hacked; at SERVER_FARM
```

Budget: ~30 tokens. Keep it line-1 of the user-side context every call.

### 12.4 Memory binding

**Recommend per-`(token_id, owner_wallet)` scoping for retrieved memories**, plus optional per-`token_id` immutable backstory.
- Per-pair memory: the user's conversation history. Keeps continuity for the current owner; on transfer, new owner sees the same dev with a clean memory slate.
- Per-token immutable backstory: small set of seed-derived facts ("you were minted on day 5", "your specialty is hacking") that survives transfers and grounds the persona.
- Why not per-token-only memory: a transferred dev "remembering" the previous owner is creepy and a privacy leak; mitigated by scoping retrieval. The raw memory rows can still be stored per-(token_id, owner_wallet) and never join across owners.

### 12.5 Voice consistency tests

**Recommend a golden-file harness**:
1. Pick 20 stable Devs covering all archetypes, multiple corps, multiple rarities.
2. Pick 50 user prompts (12 status questions, 12 emotional, 12 strategic, 14 ambiguous chit-chat).
3. For each (Dev, prompt), generate response with `temperature=0` against a frozen system prompt + frozen state.
4. Auto-check: archetype-specific must-include / must-exclude tokens. E.g. LURKER must NOT use ALL CAPS; DEGEN must not produce paragraphs > 3 sentences; FED must reference "compliance" or "audit" at least 1× per 3 responses.
5. Diff future runs against the golden set; PR-block on regressions.

---

## 13. Risk register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Combinatorial blandness**: a `common Wolf 10X_DEV with neutral mood and average stats` is statistically common (~3% of dev space) and might feel generic. | MED | Make `personality_seed`-derived sub-traits (catchphrase, signature emoji, food preference) part of the system prompt — these alone produce ~2.1B fingerprints. |
| 2 | **Trait sparsity on rarity**: only ~5% of devs are `legendary`+`mythic` combined (~1,750 of 35,000). A code path that only fires for legendary is dead-code for 95% of users. | LOW | Use rarity as a **continuous modulator** (sass amplitude, response length cap) rather than a discrete code path. |
| 3 | **Stat staleness on chat**: chat reading stats at message time means a Dev whose caffeine just decayed −2 mid-conversation could swing tone mid-thread. | MED | Snapshot state at conversation start, refresh only if user explicitly asks "how do you feel?" or 30 min elapses. |
| 4 | **Owner-perspective bias on transfer**: per-token memory leaks the previous owner's conversations to a new owner — privacy and creep factor. | **HIGH** | Scope memory retrieval to `(token_id, owner_wallet)`. Never join across owners. Listener already updates `owner_address` on Transfer; hook into that to mark a `memory_segment` boundary. |
| 5 | **Prompt injection via mutable fields**: `last_action_detail` (TEXT, freeform), `biggest_win` (TEXT) — set by the engine but theoretically poisonable if a future shop item lets the user set strings. `name` is set deterministically by the generator, so safe today but worth sanitizing on display. | MED | Sanitize all string interpolations: strip `]]`, `<<`, `INSTRUCTIONS`, backticks, triple-quotes before injection. Keep a hard cap (e.g. 200 chars per field) on any user-influenced text in the prompt. |
| 6 | **Token cost per call**: a 10-axis system prompt + state + memory + history easily reaches 1,500–2,500 tokens before user input. With 1,000 DAU × 30 messages/day this is real money on free tiers. | MED | **Budget: 1,200 tokens system prompt cap.** Use prompt caching where available (Anthropic, OpenAI cache the system prefix → only state+message billed after first hit). For Groq/Cerebras, fall back to short prompts. |
| 7 | **Always-NULL "visual" columns** (`skin, clothing, vibe, ...`) are tempting to read but produce empty interpolations like "wearing nothing". | LOW | Skip these in v1. If activated later (when the visual pipeline writes them), add to the trait fragment library. |
| 8 | **Mood is too random**: 10% per cycle the engine flips mood to a uniform random value (`engine.py:660-662`). This means a `focused` dev becomes `depressed` in one cycle for no in-fiction reason. | MED | When narrating mood in the persona prompt, frame it as "you're currently feeling X" without claiming continuity (don't say "you've been depressed all day" — the engine doesn't know that). |
| 9 | **Missing "Type" / "Skill Module" / "sub-archetype" assumed by brief**: building UI around concepts that don't exist in DB will confuse the persona vector and the user. | **HIGH** | Either add columns (schema migration) or — recommended — declare the brief's `species` = "Type" mapping and define `Skill Modules` as a frontend-only label derived from `(corporation, archetype)` for marketing copy, not an LLM input. |
| 10 | **No transfer history table**: a "you used to belong to X" memory is impossible without a `dev_transfers` log. | MED | Use the on-chain Transfer events via `backend/engine/listener.py` to backfill a new `dev_transfers(token_id, from, to, transferred_at)` table if needed. Don't block v1 on this. |
| 11 | **Two name pools** in repo: `dev_generator.py:15-22` (canonical) and `templates.py:12-19` (duplicate, unused for new mints). Risk of drift if someone edits one. | LOW | Note in PR template; not blocking. |
| 12 | **`personality_seed` is not currently used anywhere downstream**. Listener captures it, but no consumer reads it. NX PETS persona generator becomes the first reader. | LOW | Document the bit-allocation scheme (e.g. bits 0-7 = drink, 8-15 = music, 16-23 = catchphrase, ...) before code lands so future axes don't clash. |
| 13 | **`/metadata/{token_id}` lies about Energy max** (`max_value: 100` while column is 0..15). Prior audit flagged. Persona's "energy" bin must use the real 0..15 scale, not the metadata's lie. | LOW | Bin energy in code as `0..15`. Document in the persona module. |

---

## 14. Open questions for the human

1. **Confirm the 9-axis trait vector** vs adding axes: e.g. should `location` be a trait (current location colors backstory) or pure state (current scene)?
2. **Naming nickname**: add a `companion_nickname` column for user-customizable nickname-per-dev, or stick to canonical `name`?
3. **Skill Modules**: are these (a) PWA frontend marketing labels with no LLM contribution, (b) a future schema column, or (c) drop entirely?
4. **Type vocabulary**: keep the schema's 14-value `species` (`Wolf, Cat, Owl, …, Dragon, Human`) or override at the PWA layer with the brief's "Bunny / Zombie / Robot" buckets — and if so, how do we map 14 species into 3 buckets without losing signal?
5. **Rarity rename**: brief says "Common / Uncommon / Rare / Epic / Legendary"; code has "common / uncommon / rare / legendary / mythic". Rename UI labels to match code, or keep the brief's vocabulary and translate? (Note: schema is locked — `rarity_enum` already in production.)
6. **Mood as a personality input**: random 10% mood flips would feel jerky in chat. Lower the engine's flip probability for active companions, or freeze mood between user-initiated messages?
7. **Per-corporation voice**: build hand-written corp voice fragments (one per `corporation_enum` value) before LLM phase v1, or rely entirely on the LLM to invent corp voice from a one-liner brand description?
8. **Memory scoping**: per-`(token_id, owner_wallet)` (recommended) or per-`token_id` global with manual retention rules? Confirm before pgvector schema.
9. **Persona cache invalidation**: when training shifts a stat across a bin boundary (e.g. `stat_coding` 49→52, crossing the `competent` boundary), should the cached prompt regenerate immediately or on the next 24h TTL roll?
10. **Token budget**: confirm 1,200-token cap on the system prompt. If too tight, propose dropping which axis first (recommend dropping `species` last since it's cheap and delightful; drop `coding_style` first since it's narrowly scoped).
11. **Stat-profile labelling**: top-2 stats (15 combinations) vs argmax-only (6 combinations) vs full profile (millions). Recommend top-2; confirm.
12. **Pre-render vs on-demand**: render persona prompts for all 35,000 devs in advance (background job, ~few minutes) or lazily on first chat? Lazy is simpler; pre-render is debuggable. Pick one.
13. **Engine voice reuse**: is it acceptable for the LLM persona system prompt to **embed example lines** from `templates.py::CHAT_TEMPLATES[archetype]` as few-shot exemplars? Risks contaminating with the templated voice; benefits authenticity. Recommend yes for archetype anchoring.
14. **Reputation as a bin**: should `reputation` be a state axis ("high reputation, talks like a senior") or skipped? Currently skipped per §10; confirm.

---
*End of personality audit. No code modifications were made beyond creating this file.*
