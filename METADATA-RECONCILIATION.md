# NX SOULS — Metadata Reconciliation Report

- **Generated**: 2026-05-01
- **Auditor**: Claude Code
- **Repo commit**: `8d2c98c24cd7b2dbb726315c46c5cdf9d12439c5`
- **Branch**: `claude/audit-nx-pets-pwa-IWGKC`

---

## 1. Executive summary

**There are two parallel metadata realities for every Dev — and neither dominates the other on-chain.**

1. **The on-chain `tokenURI(tokenId)` points to the LIVE BACKEND API**, not to IPFS. `contracts/NXDevNFT_v4.sol:801-804` returns `_baseTokenURI + tokenId.toString()` — i.e. `https://<api-host>/api/devs/{N}/metadata` (or `/metadata/{N}`). Marketplaces and any contract-driven metadata read get the API's dynamic JSON.
2. **The IPFS JSONs at `bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema/{N}.json`** are a separate, static, externally-generated artifact (not produced by any code in this repo) that lives at the same CID as the dev image GIFs. They were uploaded once, contain visual trait descriptors (Bunny, Eyewear, Spots, Skill Module) the DB does not have, and are NOT what the contract serves.
3. **The DB's `nx.devs` row carries one set of trait values** (set by `backend/engine/dev_generator.py` from a `random.Random(token_id)` seed). **The IPFS JSON for the same token carries different values** for several axes (Coding Style, Work Ethic, Social Style, Species). The two diverge irreconcilably for the same `token_id`.

**Top 3 corrections to PERSONALITY-AUDIT.md**:

- **The "always-NULL" visual columns claim was correct for the DB, but mistakenly extrapolated as "no visual data exists."** Visual data exists — in the IPFS JSON only. Not in DB. Not served by the live API. The DB columns `skin/clothing/vibe/glow/...` remain unused; the IPFS JSON has its own different visual schema (`Clothing, Clothing Pattern, Eyewear, Neckwear, Spots, Blush, Ear Detail`).
- **Skill Module was correctly reported as absent from the codebase** (no hits anywhere). It exists ONLY in the IPFS JSONs as a 1:1 derivative of `Corporation`. The mapping observed: `CLOSED_AI→DEPLOY, MISANTHROPIC→AUDIT, SHALLOW_MIND→BRIDGE, ZUCK_LABS→BROADCAST, Y_AI→ARBITRAGE, MISTRIAL_SYSTEMS→INFILTRATE` — six corps, six skills, redundant axis.
- **"Species = 14 values incl. Bunny is not in the pool"** — correct for the DB (`dev_generator.py:44-47` has 14 abstract animal/entity values). **WRONG as an interpretation of what users see** — the IPFS JSONs and the GIF images both show Bunny/Robot. The DB axis and the IPFS axis are different things sharing one name. The user-facing species is "Bunny/Robot" (and possibly "Zombie" for the missing 5%); the engine-internal species is the 14-value pool. **Pick which one drives the LLM persona; do not blend.**

The runtime answer to "what is the canonical trait of a Dev?" is **dual**: contract metadata = live API (DB-backed); user-facing visual identity = IPFS JSON. They will stay diverged unless someone backfills the DB from the IPFS JSONs (the obvious recommendation).

---

## 2. Source of truth map

| trait_type (as seen in IPFS JSON or live API) | Origin of value | Production value source | File / Line |
|---|---|---|---|
| `Species` (Bunny/Robot/...) | IPFS JSON only | external tool (not in repo) | n/a — externally generated |
| `Species` (Wolf/Cat/Owl/Fox/Bear/Raven/Snake/Shark/Monkey/Robot/Alien/Ghost/Dragon/Human) | DB column `devs.species`, live API | `dev_generator.SPECIES_POOL` | `backend/engine/dev_generator.py:44-47` |
| `Skill Module` (DEPLOY/AUDIT/BRIDGE/BROADCAST/ARBITRAGE/INFILTRATE) | IPFS JSON only | external tool, derived 1:1 from corporation | n/a |
| `Archetype` (8 values, weighted) | DB + IPFS + live API (consistent) | `ARCHETYPE_WEIGHTS` | `backend/engine/dev_generator.py:30-33` |
| `Corporation` (6 values, uniform) | DB + IPFS + live API (consistent) | `CORPORATION_POOL` | `backend/engine/dev_generator.py:39-42` |
| `Rarity` | DB + IPFS + live API (consistent values) | `RARITY_WEIGHTS` (`common/uncommon/rare/legendary/mythic` 60/25/10/4/1) | `backend/engine/dev_generator.py:35-37` |
| `Alignment` (D&D 9-axis) | DB + live API only | `ALIGNMENT_POOL` | `backend/engine/dev_generator.py:49-53` — **NOT in IPFS JSON sample** |
| `Risk Level` | DB + live API only | `RISK_LEVEL_POOL` (`Conservative/Moderate/Aggressive/Reckless`) | `backend/engine/dev_generator.py:55` — **NOT in IPFS JSON sample** |
| `Social Style` (Quiet/Social/Loud/Troll/Mentor) | DB + live API | `SOCIAL_STYLE_POOL` | `backend/engine/dev_generator.py:56` |
| `Social Style` (Influencer/Quiet/Social — different pool) | IPFS JSON only | external tool | n/a |
| `Coding Style` (Methodical/Chaotic/Perfectionist/Speed Runner/Copy Paste) | DB + live API | `CODING_STYLE_POOL` | `backend/engine/dev_generator.py:57` |
| `Coding Style` (Over-Engineer/Minimalist/Chaotic/Speedrun/Perfectionist) | IPFS JSON only | external tool | n/a |
| `Work Ethic` (Grinder/Lazy/Balanced/Obsessed/Steady) | DB + live API | `WORK_ETHIC_POOL` | `backend/engine/dev_generator.py:58` |
| `Work Ethic` (Casual/Dedicated/Lazy/Obsessed) | IPFS JSON only | external tool | n/a |
| `Clothing` (None/Hoodie/Vest/Jacket) | IPFS JSON only | external tool | n/a — DB column `devs.clothing` exists but is always NULL |
| `Clothing Pattern` (None/Gradient H/H Stripes/Polka Dots/Solid/Color Block) | IPFS JSON only | external tool | n/a — no DB column |
| `Eyewear` (None/Shades/Glasses) | IPFS JSON only | external tool | n/a — no DB column |
| `Neckwear` (None/Bow Tie) | IPFS JSON only | external tool | n/a — no DB column |
| `Spots` (None/Light/Medium/Heavy) | IPFS JSON only | external tool | n/a — no DB column |
| `Blush` (Yes/No) | IPFS JSON only | external tool | n/a — no DB column |
| `Ear Detail` (Yes/No) | IPFS JSON only | external tool | n/a — no DB column |
| `Coding/Hacking/Trading/Social/Endurance/Luck` (15..95) | DB columns `stat_*`, live API | `rng.randint(15, 95)` | `backend/engine/dev_generator.py:109-114` — IPFS JSON unknown (depends on whether external tool snapshotted these) |
| `Energy` (live API: 0..15 raw, advertised max=100; IPFS: 100/100) | divergent | DB has `CHECK 0..15` and `DEFAULT 10`; IPFS hardcodes 100 | `backend/db/schema.sql:124-125`; live API at `backend/api/routes/devs.py:332` |
| `Mood/Status/Location/Reputation/Balance ($NXT)/Day/Coffee Count/Lines of Code/Bugs Shipped/Hours Since Sleep/Protocols Created/Protocols Failed/Devs Burned/Biggest Win` | DB + live API | engine ticks | `backend/api/routes/devs.py:328-344` — **NOT in IPFS JSON** (IPFS is a static snapshot, doesn't carry dynamic state) |
| `Skin/Vibe/Screen Glow/Hair Style/Hair Color/Facial Hair/Headgear/Extra` | live API serves them but they are always NULL/empty | DB columns exist, never populated | `backend/db/schema.sql:113-121`; `backend/api/routes/devs.py:288-303` |
| `image / animation_url` | live API: `ipfs://{ipfs_hash}` (i.e. `ipfs://{IMAGE_CID}/{token_id}.gif`) | DB `devs.ipfs_hash` | `backend/api/routes/devs.py:359-360`; `dev_generator.py:122` |

---

## 3. Corrections to PERSONALITY-AUDIT.md

| Original claim (PERSONALITY-AUDIT.md) | Corrected claim | Evidence |
|---|---|---|
| §1 "The brief's Bunny is not in the pool" — implying Bunny doesn't exist | **Partially incorrect.** Bunny exists in the IPFS JSON as the visual species, dominant (≈90% of the 10-sample) — just not in the DB column `species` (which uses 14 abstract values). Two distinct axes, both real, served by different sources. | IPFS JSONs from user; `dev_generator.py:44-47`; `devs.py:288` |
| §1 "Skill Modules do not exist anywhere — brief invention" | **Update.** Skill Module exists in the IPFS JSONs only, as a Corporation-derived label (1:1 mapping). It is NOT in the DB and NOT in the live API, but it IS in user-visible NFT marketplace metadata at the IPFS path. **Not a brief invention; a real but redundant axis.** | Brief's 10 JSONs show one Skill Module per corp; no schema/code hit |
| §1 "Top tier is mythic, not legendary" | Confirmed — but caveat: the IPFS sample contains a `Legendary` (#9), no `Mythic`. The 10-sample is too small to confirm Mythic exists in IPFS exports; the DB enum confirms it should. | `dev_generator.py:35-37`: `legendary:4, mythic:1` weights |
| §2.4 "skin, clothing, vibe, glow, hair_style, hair_color, facial, headgear, extra are placeholder columns, never written. Treat as non-existent for LLM v1." | **Sharpen.** The DB columns are still always-NULL — confirmed by re-reading `dev_generator.insert_dev` and `listener.py:230-276` and `devs.py::_insert_dev_on_demand` (none populate them). **But** equivalent visual data DOES exist for every Dev — in the IPFS JSON. Different field names (`Clothing Pattern, Eyewear, Neckwear, Spots, Blush, Ear Detail` in IPFS vs `clothing, hair_*, facial, headgear` in DB). LLM v1 should fetch from IPFS, not DB. | `backend/engine/listener.py:232-276`; `backend/api/routes/devs.py:131-161` |
| §8 "Type = Bunny/Zombie/Robot — REFUTED as named" | **Re-classified as PARTIALLY CONFIRMED.** Bunny and Robot are the user-facing visual species (per IPFS sample). Zombie is unconfirmed (not in 10-sample). The DB's 14-value `species` is a SECOND axis with no overlap. The brief's "Type" matches the IPFS axis. | IPFS samples 1-10 show 9× Bunny + 1× Robot |
| §8 "DEPLOY is an action_enum value, not a Skill Module — There is no skill_module column or enum. PWA-frontend invention." | **Update.** The skill_module is not in the DB or the API or any frontend constant — but it is in the IPFS JSON metadata served at the image CID. **Externally-generated artifact**. NOT a frontend invention; an out-of-repo artifact the user has direct access to via IPFS. | No grep hit anywhere in the repo |
| §9 vector axis "Coding Style: 5 values" with `Methodical, Chaotic, Perfectionist, Speed Runner, Copy Paste` | The DB-canonical pool is correct, but **users may see different vocabulary on marketplaces** (`Over-Engineer, Minimalist, Chaotic, Speedrun, Perfectionist`). For LLM persona consistency, pick one source and stick with it. Same divergence for Work Ethic and Social Style. | `dev_generator.py:55-58`; user JSON sample |
| §13 risk 13 "Energy max_value=100 but column is 0..15" | Confirmed. **No migration found that changes the 0..15 constraint.** `backend/db/schema.sql:124` still has `CHECK (energy >= 0 AND energy <= 15)`. The IPFS JSON's `Energy: 100, max_value: 100` is hardcoded by the external tool, NOT reflective of DB. The live API outputs the raw column value (typically 0..15) with a literal `max_value: 100`. | `backend/db/schema.sql:124-125`; `backend/api/routes/devs.py:332` |

---

## 4. The IPFS metadata generator

**It is NOT in this repository.** Confirmed by exhaustive grep:

- `grep -rn "metadata_gen\|generate_metadata\|build_metadata\|mint_metadata\|pinata\|pinFileToIPFS\|pinJSONToIPFS\|w3.storage\|nft.storage"` over `backend/`, `frontend/src/`, `contracts/` returns ZERO matches.
- `find . -name "*.py"` lists 41 Python files; none produce `{N}.json` output and none reference Pinata/IPFS upload SDKs.
- `backend/scripts/` contains exactly one file: `backfill_funds.py` (unrelated).
- The trait_type strings unique to the IPFS JSONs (`"Skill Module"`, `"Clothing Pattern"`, `"Ear Detail"`, `"Eyewear"`, `"Neckwear"`, `"Spots"`, `"Blush"`, value `"Bunny"`, value `"Over-Engineer"`, value `"Minimalist"`, value `"Casual"` (as work ethic), value `"Dedicated"`, value `"Influencer"` (as social style), values `"BRIDGE"/"AUDIT"/"INFILTRATE"/"ARBITRAGE"/"BROADCAST"` as Skill Module) **return zero matches** in any `.py`, `.js`, `.jsx`, `.json`, `.html`, or `.sql` file.
- The CID `bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema` appears in three places: `backend/engine/dev_generator.py:13` (as `IMAGE_CID` for `.gif` paths), `backend/engine/listener.py:26` (same), `frontend/src/windows/HireDevs.jsx:10` (frontend image base). Nothing references the `.json` companions at this CID.
- The user-facing GIF assets share the same CID directory as the JSON files; the IPFS upload was a **single directory** containing both `{N}.gif` (referenced by the code) and `{N}.json` (referenced only by external tooling).

**Implication**: a separate, external generator pipeline (likely a Python or Node script run during the mint preparation, or a no-code asset generator like Hashlips/NFTGenerator/etc.) produced the JSONs and uploaded them to Pinata. **That pipeline is the source of truth for visual traits and Skill Module — and it is opaque to this repo.** Any future change to the visual trait vocabulary requires access to that external tool.

**Re-runnability**: cannot re-run from this repo. To regenerate or extend the IPFS metadata, either (a) recover the external generator from elsewhere, or (b) read the existing JSONs from IPFS, ingest them into the DB (e.g. a `dev_visual_traits` table populated by a one-shot ingest script), and treat them as immutable post-mint truth going forward.

---

## 5. Definitive enum tables

Production = whatever the DB+engine actually use. IPFS JSON values are documented in parallel where they diverge.

### 5.1 Archetype (DB + IPFS aligned)

| Value | Weight | File:line |
|---|---|---|
| `10X_DEV` | 10 | `backend/engine/dev_generator.py:30-33` |
| `LURKER` | 12 | same |
| `DEGEN` | 15 | same |
| `GRINDER` | 15 | same |
| `INFLUENCER` | 13 | same |
| `HACKTIVIST` | 10 | same |
| `FED` | 10 | same |
| `SCRIPT_KIDDIE` | 15 | same |

### 5.2 Corporation (DB + IPFS aligned)

| Value | Weight | File:line |
|---|---|---|
| `CLOSED_AI`, `MISANTHROPIC`, `SHALLOW_MIND`, `ZUCK_LABS`, `Y_AI`, `MISTRIAL_SYSTEMS` | uniform `rng.choice` | `backend/engine/dev_generator.py:39-42` |

### 5.3 Rarity (DB + IPFS aligned)

| Value | Weight | File:line |
|---|---|---|
| `common` | 60 | `backend/engine/dev_generator.py:35-37` |
| `uncommon` | 25 | same |
| `rare` | 10 | same |
| `legendary` | 4 | same |
| `mythic` | 1 | same |

### 5.4 Species — DB axis (14 abstract values, dormant)

`["Wolf", "Cat", "Owl", "Fox", "Bear", "Raven", "Snake", "Shark", "Monkey", "Robot", "Alien", "Ghost", "Dragon", "Human"]` — uniform `rng.choice` — `backend/engine/dev_generator.py:44-47`. Stored in `devs.species` (`schema.sql:90`). Served by live API as `Species` trait_type.

### 5.5 Species — IPFS axis (visual, live)

Sample distribution (n=10): `Bunny ×9, Robot ×1`. Implied population: `Bunny ~85%, Zombie ~10%, Robot ~5%` per the brief, though Zombie unconfirmed in the 10-sample. **Source: external generator (not in repo).**

### 5.6 Skill Module — IPFS axis only (corp-derived)

| Corporation | Skill Module |
|---|---|
| `CLOSED_AI` | `DEPLOY` |
| `MISANTHROPIC` | `AUDIT` |
| `SHALLOW_MIND` | `BRIDGE` |
| `ZUCK_LABS` | `BROADCAST` (by elimination from 10-sample) |
| `Y_AI` | `ARBITRAGE` |
| `MISTRIAL_SYSTEMS` | `INFILTRATE` |

1:1 with corporation; carries no information beyond what `corporation` already carries. **Source: external generator.**

### 5.7 Alignment (DB + live API; absent from IPFS sample)

D&D 9-axis: `["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"]` — uniform — `backend/engine/dev_generator.py:49-53`.

### 5.8 Risk Level (DB + live API; absent from IPFS sample)

`["Conservative", "Moderate", "Aggressive", "Reckless"]` — uniform — `backend/engine/dev_generator.py:55`.

### 5.9 Social Style — DB axis

`["Quiet", "Social", "Loud", "Troll", "Mentor"]` — uniform — `backend/engine/dev_generator.py:56`.

### 5.10 Social Style — IPFS axis (different pool)

Observed in samples: `Influencer, Quiet, Social`. **Different vocabulary** from the DB. Source: external generator.

### 5.11 Coding Style — DB axis

`["Methodical", "Chaotic", "Perfectionist", "Speed Runner", "Copy Paste"]` — uniform — `backend/engine/dev_generator.py:57`.

### 5.12 Coding Style — IPFS axis (different pool)

Observed in samples: `Over-Engineer, Minimalist, Chaotic, Speedrun, Perfectionist`. Note `Speedrun` (one word) ≠ `Speed Runner` (two words). `Over-Engineer` and `Minimalist` are net-new. `Chaotic` and `Perfectionist` overlap. Source: external generator.

### 5.13 Work Ethic — DB axis

`["Grinder", "Lazy", "Balanced", "Obsessed", "Steady"]` — uniform — `backend/engine/dev_generator.py:58`.

### 5.14 Work Ethic — IPFS axis (different pool)

Observed: `Casual, Dedicated, Lazy, Obsessed`. `Casual` and `Dedicated` are net-new. `Lazy` and `Obsessed` overlap. Source: external generator.

### 5.15 Visual subtraits — IPFS axis only

| trait_type | Sample values |
|---|---|
| `Clothing` | None / Hoodie / Vest / Jacket |
| `Clothing Pattern` | None / Gradient H / H Stripes / Polka Dots / Solid / Color Block |
| `Eyewear` | None / Shades / Glasses |
| `Neckwear` | None / Bow Tie |
| `Spots` | None / Light / Medium / Heavy |
| `Blush` | Yes / No |
| `Ear Detail` | Yes / No |

Source: external generator. Full pools unknown without more samples or access to the generator.

### 5.16 Mood (DB + live API)

`["neutral", "excited", "angry", "depressed", "focused"]` — `mood_enum` in `backend/db/schema.sql:31-33` and `MOODS` in `backend/engine/engine.py:185`.

### 5.17 Location (DB + live API; not in IPFS)

`["BOARD_ROOM", "HACKATHON_HALL", "THE_PIT", "DARK_WEB", "VC_TOWER", "OPEN_SOURCE_GARDEN", "SERVER_FARM", "GOVERNANCE_HALL", "HYPE_HAUS", "THE_GRAVEYARD"]` plus runtime-added `"GitHub HQ"` (`location_enum` in `schema.sql:25-29`, auto-migration in `backend/api/main.py:80-85`).

### 5.18 Status (DB + live API)

`["active", "resting", "frozen"]` plus runtime-added `"on_mission"` (`dev_status_enum` in `schema.sql:39-41`; `migration_missions.sql:11`).

---

## 6. Energy scale verdict

**The DB column is 0..15. The IPFS JSON shows 100/100. The live API shows 0..15 with literal `max_value: 100`. They diverge.**

Evidence:
- **DB schema** (`backend/db/schema.sql:124`): `energy SMALLINT NOT NULL DEFAULT 10 CHECK (energy >= 0 AND energy <= 15)`.
- **DB schema** (`backend/db/schema.sql:125`): `max_energy SMALLINT NOT NULL DEFAULT 10`.
- **No migration anywhere** alters the energy CHECK or default. Searched `backend/db/migration_*.sql` and `backend/api/main.py::_run_auto_migrations` — none touch `energy` constraint or scale. The auto-migration block adds `caffeine`, `social_vitality`, `knowledge` (each 0..100 by convention, no CHECK) but leaves `energy` at the original 0..15 range.
- **Engine writes** (`backend/engine/engine.py:579, 651`): `LEAST(max_energy, energy + N)` and `GREATEST(0, energy - N)` — both bounded by `max_energy` (default 10) and 0. Confirms 0..15 is in active production use.
- **Live API output** (`backend/api/routes/devs.py:332`): `{"trait_type": "Energy", "value": dev["energy"], "display_type": "number", "max_value": 100}`. The `max_value: 100` is a hand-written literal in the metadata code; the actual `value` is whatever the column holds (0..15 in production).
- **IPFS JSON for token #1** (per user brief): `Energy: 100, max_value: 100`. **This value is impossible from the live system** — the column never reaches 100. **Verdict: the external generator hardcoded 100/100 into every static JSON at mint export time, ignoring the actual schema.**

**Production reality: `devs.energy` is 0..15. The IPFS metadata is wrong.**

For NX SOULS / NX PETS, the LLM should bin energy on the 0..15 scale (e.g. `drained 0-3, low 4-7, okay 8-11, wired 12-15` per PERSONALITY-AUDIT §9). The PWA UI should render as `energy / max_energy * 100` percentage if a bar is desired. Do not trust the IPFS JSON's energy value — it is a static snapshot fixed at 100 forever.

---

## 7. Visual trait storage verdict

**Verdict: IPFS only.**

- DB columns (`devs.skin, clothing, vibe, glow, hair_style, hair_color, facial, headgear, extra`) are defined (`schema.sql:113-121`) but **never written** by any insert path: `dev_generator.insert_dev` (`listener.py:230-276`) does not populate them; `_insert_dev_on_demand` (`devs.py:114-173`) does not populate them; no UPDATE in the engine sets them. They remain NULL forever.
- The visual axes the user actually sees (`Clothing, Clothing Pattern, Eyewear, Neckwear, Spots, Blush, Ear Detail`) are NOT DB columns. They live exclusively in the IPFS JSONs at the image CID.
- The on-chain `tokenURI` returns an HTTP URL to the live API (NOT IPFS), so a marketplace following `tokenURI` will get the API JSON which has empty visual fields. **A marketplace fetching the IPFS-served metadata directly (by knowing the CID) would see the real visuals.**

**Access pattern for the LLM phase**:

Recommended: **one-shot ingestion** of the 35,000 IPFS JSONs into a new `dev_ipfs_metadata` table (or expand `devs` with new columns). A small Python script can iterate `range(35000)`, fetch `https://gateway.pinata.cloud/ipfs/{CID}/{N}.json`, and persist `Species, Skill Module, Clothing, Clothing Pattern, Eyewear, Neckwear, Spots, Blush, Ear Detail` plus the IPFS-axis variants of `Coding Style, Work Ethic, Social Style`. Once cached:
- LLM persona generator reads from the cache (zero IPFS calls per chat).
- The live `/metadata` API can be extended to merge IPFS-cache + DB-state so on-chain consumers also see visuals.
- Cache is immutable (visuals don't change post-mint), so TTL is infinite; refresh only on a re-mint event (which can't happen with an ERC-721 token id once issued).

Alternative: read from IPFS at persona-build time and Redis-cache `persona:visuals:{token_id}` with no TTL. Cheaper to implement, slightly worse availability if Pinata is down.

---

## 8. Skill Module verdict

**Verdict: derived from corporation, label-only, redundant axis.**

- Not a DB column.
- Not a code constant in any backend or frontend file.
- Not in the live API response.
- Lives ONLY in the IPFS JSONs at the image CID.
- 1:1 mapping with `corporation`, observed across all 10 samples and predicted by elimination for the missing case.

| Corporation | Skill Module |
|---|---|
| `CLOSED_AI` | `DEPLOY` |
| `MISANTHROPIC` | `AUDIT` |
| `SHALLOW_MIND` | `BRIDGE` |
| `ZUCK_LABS` | `BROADCAST` (predicted) |
| `Y_AI` | `ARBITRAGE` |
| `MISTRIAL_SYSTEMS` | `INFILTRATE` |

**Recommendation**: treat Skill Module as a **display alias** for Corporation, not as an independent personality axis. In the LLM persona prompt, it can be referenced for flavor ("You're a BRIDGE specialist at Shallow Mind") but it is NOT additional signal.

If the human wants Skill Module to mean something distinct, a schema migration is required to add a per-Dev `skill_module` column with values that are NOT corp-derived.

---

## 9. Updated personality vector recommendation

Replaces PERSONALITY-AUDIT.md §9. Key changes: pick the IPFS-side vocabulary as the user-facing source of truth (because it aligns with the visual GIF and what users see on marketplaces), drop Skill Module as redundant with Corporation, add the visual subtraits (which are real and identity-relevant), and document Energy as 0..15 from the DB.

| # | Axis | Source field | Cardinality | Example values | Personality contribution | Trait or State |
|---|---|---|---|---|---|---|
| 1 | Archetype | DB `devs.archetype` | 8 | `10X_DEV, LURKER, DEGEN, GRINDER, INFLUENCER, HACKTIVIST, FED, SCRIPT_KIDDIE` | Macro-voice (already has hand-written voices in templates.py) | Trait |
| 2 | Corporation | DB `devs.corporation` (also exposed as Skill Module in IPFS) | 6 | `CLOSED_AI, …, MISTRIAL_SYSTEMS` | Brand voice, AI-corp satire | Trait |
| 3 | Rarity | DB `devs.rarity_tier` | 5 | `common, uncommon, rare, legendary, mythic` | Sass amplitude, response length | Trait |
| 4 | Visual Species | IPFS JSON `Species` (cache to DB) | 2–3 | `Bunny, Robot, [Zombie?]` | Animal/entity self-reference (90% bunny → most devs talk about ears/hopping; robots talk about software updates) | Trait |
| 5 | Alignment | DB `devs.alignment` | 9 | `Lawful Good … Chaotic Evil` | Moral compass | Trait |
| 6 | Risk Level | DB `devs.risk_level` | 4 | `Conservative, Moderate, Aggressive, Reckless` | Decision tone | Trait |
| 7 | Social Style | IPFS JSON (override DB) | 3+ | `Influencer, Quiet, Social` (or DB pool if cache miss) | Engagement length, posture | Trait |
| 8 | Coding Style | IPFS JSON (override DB) | 5 | `Over-Engineer, Minimalist, Chaotic, Speedrun, Perfectionist` | Self-perception when discussing work | Trait |
| 9 | Work Ethic | IPFS JSON (override DB) | 4+ | `Casual, Dedicated, Lazy, Obsessed` | Reaction to user idleness | Trait |
| 10 | Stat profile (binned, top-2) | DB `stat_*` (15..95) | ~15 | `coder+hacker, trader+social, …` | Specialty self-reference | Trait |
| 11 | Visual signature (concat) | IPFS JSON `Clothing + Clothing Pattern + Eyewear + Neckwear + Spots + Blush + Ear Detail` | combinatorial (~10⁴) | "Hoodie / Polka Dots / Shades / None / Heavy / Yes / Yes" | Mentions own appearance; favorite outfit | Trait |
| 12 | personality_seed-derived sub-traits | DB `personality_seed` BIGINT | 2.1B | catchphrase, drink, music, swear | Surface uniqueness | Trait (deterministic) |

**State modulators** (unchanged from PERSONALITY-AUDIT §9): `mood, energy (0..15 actual scale), caffeine (0..100), hours_since_sleep, pc_health, knowledge, social_vitality, bugs_shipped/fixed ratio, balance_nxt log-binned, location, last_action_*, biggest_win`.

**Notable adjustments**:
- **Skill Module dropped** as a separate axis (1:1 with Corporation).
- **Visual species** is now a real axis (not "Wolf/Cat/Owl/..." — that DB column is dormant trivia).
- **Energy bins** confirmed at 0..15 not 0..100.
- **DB-axis Coding/Work/Social Style values are ignored in favor of IPFS values** because users see the IPFS values on marketplaces and via the visual.
- **Visual subtraits** (Clothing, Eyewear, etc.) become a single concatenated "outfit signature" axis — gives every Dev a unique on-screen look the LLM can reference.

Combinatorial space: 8 × 6 × 5 × 3 × 9 × 4 × 5 × 5 × 4 × 15 × ~10⁴ = ~10¹¹ before stats and seed-derived sub-traits. Trivially unique per Dev.

---

## 10. Open questions

1. **Where is the external IPFS metadata generator?** Recover it (or its config) so we can re-extend the visual vocabulary (e.g. add new Eyewear values) without rebuilding from scratch.
2. **Is the IPFS upload immutable?** If yes, the visual data for the existing 35,000 (or however many minted) is fixed forever, but new mints might use the live API as the only source unless the generator is re-run.
3. **Is `Zombie` a real species value** or did the user misremember? 10 samples is too few to confirm. A directory listing or ~30 more samples would settle it.
4. **Do the IPFS JSONs include the static stats** (`Coding/Hacking/Trading/Social/Endurance/Luck`)? The brief did not list these among the trait_types. If absent, we'd need to merge IPFS-visual + DB-stats anyway.
5. **Should we backfill the DB from IPFS** (one-shot ingest of all 35,000 JSONs into a `dev_ipfs_metadata` table)? Recommended yes — gives the LLM a single source and removes Pinata dependency from chat path. Estimated 35,000 HTTP fetches at ~150ms each = ~90 minutes single-threaded, ~10 min with 10 concurrent fetchers.
6. **Should the live `/metadata` endpoint be patched** to merge IPFS-visual data with DB-state, so marketplaces see the same visuals as users do via the IPFS path? Or leave them divergent? Divergent is the current state and breaks nothing; merging is more correct.
7. **For DB-axis values (Coding/Work/Social Style) and IPFS-axis values that disagree for the same token** — should the engine's behavioral logic (e.g. archetype-keyed templates that read DB `coding_style`) be migrated to read the IPFS value, or stay on DB? Recommend stay on DB for engine; LLM persona uses IPFS. They serve different purposes.
8. **Skill Module**: confirm it is intentionally redundant with Corporation, or do we promote it to a real per-Dev axis (schema migration, generator update, IPFS regen)?
9. **Energy scale unification**: align the metadata API's literal `max_value: 100` with the DB's actual 0..15, OR migrate the DB to 0..100. Either is a breaking change for one consumer.
10. **The audit's claim that the brief CID `bafybeicz5ilcu...` is wrong stands** — both GIFs and JSONs live at `bafybeibax74y...`. The brief's quoted CID does not appear anywhere in the codebase or the supplied JSONs.

---
*End of metadata reconciliation. No code modifications were made beyond creating this file.*
