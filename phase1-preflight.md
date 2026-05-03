# Phase 1 — Pre-flight Audit

**Branch:** `claude/refactor-metadata-api-J1jMg`
**Date:** 2026-05-03
**Scope:** Read-only investigation. Identify blockers and confirm assumptions before Phase 2.

---

## 0. TL;DR — checkpoint-blocking issues

Three findings block Checkpoint 1 and require explicit human resolution before any Phase 2 work begins:

1. **The IPFS metadata bundle the brief assumes does not exist.** The CID `bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema` contains only `{token_id}.gif` images — there are **no `{id}.json` files**. Multiple gateways (`ipfs.io`, `dweb.link`, `nftstorage.link`) all respond `404 / "no link named '1.json' under bafybeib…uema"`. There is no source-of-truth metadata bundle to ingest.
2. **Visual subtraits don't exist anywhere.** Columns `skin / clothing / vibe / glow / hair_style / hair_color / facial / headgear / extra` are declared in `devs` table but **never populated** by the listener, on-demand generator, or engine. Every value is `NULL`. The brief's Phase 2 §4.2 ingest step ("parse IPFS JSON for Clothing, Eyewear, Spots, Blush, Ear Detail …") therefore has no source data — neither IPFS nor DB has it.
3. **The "Skill Module" trait and the death/burn mechanic the brief asks us to remove already do not exist** in this codebase. The brief's Phase 1 §3.5 ("Engine references to be removed") inventory turns up almost nothing real to delete — there is no `burn_dev`, `_burn_dev`, `set_dev_dead`, `is_dead`, or `Skill Module` anywhere. Only the `devs_burned` column and one trait line in the metadata endpoint exist.

These three together suggest the brief was authored against a different (older, parallel, or planned) codebase than `nxterminal/nx-terminal` at this commit. **Recommend the human reconcile the brief's assumed state vs. the current code before approving Checkpoint 1.**

A fourth finding worth raising immediately:

4. **The public endpoint `https://nxterminal.xyz/metadata/{id}` returns 404.** The apex 301-redirects to `www.`, which 404s with `server: cloudflare`. The Render service `nx-api.onrender.com` resolves to a Spring Boot service unrelated to this repo. I could not verify any production deployment of the FastAPI app in this repo serving `/metadata/{id}` from a publicly reachable URL. If marketplaces are currently consuming metadata, they're consuming it from somewhere I can't locate.

---

## 1. Current `/metadata/{id}` endpoint

### 1.1 Routing

The endpoint is registered **twice** — at the root `/metadata/{token_id}` (the actual public NFT URL) and under `/api/devs/{token_id}/metadata` (the underlying handler).

| Where | File:line | Notes |
|---|---|---|
| Root alias | `backend/api/main.py:738-741` | `@app.get("/metadata/{token_id}")` — delegates to `get_dev_metadata` |
| Implementation | `backend/api/routes/devs.py:276-363` | `async def get_dev_metadata(token_id: int)` |
| Rate-limit bypass | `backend/api/main.py:669` | `path.startswith("/metadata/")` — IP rate limiter is skipped for marketplace traffic |
| Router mount | `backend/api/main.py:717` | `app.include_router(devs.router, prefix="/api/devs", …)` |

**No caching headers are set.** The endpoint emits the response with FastAPI defaults; CDNs / marketplaces cache only on heuristics.

### 1.2 Columns read from `devs`

The handler does `SELECT * FROM devs WHERE token_id = %s` (one round-trip), then reads:

- `name`, `archetype`, `corporation`, `rarity_tier`, `ipfs_hash`
- `species`, `skin`, `clothing`, `vibe`, `glow`, `hair_style`, `hair_color`, `facial`, `headgear`, `extra`
- `alignment`, `risk_level`, `social_style`, `coding_style`, `work_ethic`
- `stat_coding`, `stat_hacking`, `stat_trading`, `stat_social`, `stat_endurance`, `stat_luck`
- `status`, `mood`, `location`, `energy`, `reputation`, `balance_nxt`
- `day`, `coffee_count`, `lines_of_code`, `bugs_shipped`, `hours_since_sleep`
- `protocols_created`, `protocols_failed`, `devs_burned`, `biggest_win`

**Note:** `bugs_fixed` is **not** read by the metadata endpoint despite existing in the schema (`schema.sql:137`) and being incremented by `backend/api/routes/shop.py:364`.

### 1.3 Constants / static traits added

The endpoint hard-codes:
- `Energy max_value: 100` — but the schema CHECK is `0..15` (`schema.sql:124`). This is a **bug** — the brief's example correctly says `max_value: 15`.
- `Day max_value: 21` — engine constant, brief shows it without max.
- `Balance ($NXT) display_type: number` — emitted as `int(balance_nxt)`. Brief moves this into `properties` (out of OpenSea rarity).
- Corporation display name remap (`CLOSED_AI → "Closed AI"`, etc.) at `devs.py:347-352`.

### 1.4 Production output for sample tokens

I could **not** retrieve live JSON for tokens 1, 100, 1337, 35000:

| URL | Result |
|---|---|
| `https://nxterminal.xyz/metadata/1` | `301 → https://www.nxterminal.xyz/metadata/1` |
| `https://www.nxterminal.xyz/metadata/1` | `404 Not Found` (Cloudflare) |
| `https://www.nxterminal.xyz/metadata/{100,1337,35000}` | `404 Not Found` |
| `https://nx-api.onrender.com/metadata/1` | `404` from a Spring Boot service (unrelated app) |

**This is finding #4 above.** Either (a) the FastAPI app isn't deployed anywhere I can reach, (b) the public domain points elsewhere, or (c) the contract's `_baseTokenURI` points to a URL not documented in this repo. Recommend the human supply the actual production base URL so we can capture the current shape verbatim before refactoring.

What we *do* know about the current shape: it's the JSON literally constructed at `devs.py:286-363`. Reproduced here as the contract:

```jsonc
{
  "name": "<dev.name>",
  "description": "<name> — a <Rarity> <Archetype> at <Corp>. <Alignment>. Currently <mood> in <Location>.",
  "image": "ipfs://<CID>/<id>.gif",
  "animation_url": "ipfs://<CID>/<id>.gif",
  "external_url": "https://nxterminal.xyz/dev/<id>",
  "attributes": [
    /* visual — emitted with empty strings when null, or skipped entirely (hair_*, facial, headgear, extra) */
    {"trait_type": "Species", "value": "<species or 'Human'>"},
    {"trait_type": "Skin", "value": ""},          // always "" — column is null
    {"trait_type": "Clothing", "value": ""},      // always ""
    {"trait_type": "Vibe", "value": ""},          // always ""
    {"trait_type": "Screen Glow", "value": ""},   // always ""
    /* identity */
    {"trait_type": "Archetype", "value": "..."},
    {"trait_type": "Corporation", "value": "..."},
    {"trait_type": "Rarity", "value": "..."},     // lowercase: 'common'/'rare'/...
    {"trait_type": "Alignment", "value": "..."},
    {"trait_type": "Risk Level", "value": "..."},
    {"trait_type": "Social Style", "value": "..."},
    {"trait_type": "Coding Style", "value": "..."},
    {"trait_type": "Work Ethic", "value": "..."},
    /* base stats — display_type:number, max_value:100 */
    {"trait_type": "Coding", "value": ..., "display_type":"number", "max_value":100},
    /* ... Hacking, Trading, Social, Endurance, Luck */
    /* dynamic */
    {"trait_type": "Status", "value": "..."},
    {"trait_type": "Mood", "value": "..."},
    {"trait_type": "Location", "value": "..."},
    {"trait_type": "Energy", "value": ..., "display_type":"number", "max_value":100},  // BUG: should be 15
    {"trait_type": "Reputation", "value": ..., "display_type":"number"},
    {"trait_type": "Balance ($NXT)", "value": ..., "display_type":"number"},
    {"trait_type": "Day", "value": ..., "display_type":"number", "max_value":21},
    {"trait_type": "Coffee Count", ...},
    {"trait_type": "Lines of Code", ...},
    {"trait_type": "Bugs Shipped", ...},
    {"trait_type": "Hours Since Sleep", ...},
    {"trait_type": "Protocols Created", ...},
    {"trait_type": "Protocols Failed", ...},
    {"trait_type": "Devs Burned", ...},
    {"trait_type": "Biggest Win", "value": "..."}
  ]
}
```

### 1.5 Delta vs. brief's target shape (§1)

| Brief says | Current code says | Notes |
|---|---|---|
| Description ends with `Currently focused in The Graveyard.` | Description ends with `<Alignment>. Currently <mood> in <Location>.` | Cosmetic. |
| `Rarity: "Rare"` (capitalized) | `"rare"` (lowercase enum value) | Brief implicitly capitalizes via `dev["rarity_tier"].capitalize()` already at `devs.py:353` for the description, but the trait emits raw enum. |
| Energy `max_value: 15` | `max_value: 100` | **Schema-level bug to fix.** |
| Visual subtraits (Clothing/Eyewear/Spots/Blush/EarDetail) populated | Columns exist (`skin/clothing/vibe/glow/hair_*/facial/headgear/extra`) but **always NULL** — and naming doesn't match brief | **No source data exists.** See §2. |
| NX Souls (Voice Tone / Quirk / Lore Faction) | Not present anywhere | New, derive from `personality_seed`. ✅ achievable. |
| `Bugs Fixed` trait | Column exists, never emitted | Trivial add. |
| `properties` object | Not present | New top-level field. |
| Drop `Devs Burned`, `Skill Module` | `Devs Burned` exists; `Skill Module` does not | Half the cleanup is moot. |

---

## 2. IPFS source bundle — **does not exist**

### 2.1 Gateway probes (live)

| URL | HTTP | Notes |
|---|---|---|
| `https://ipfs.io/ipfs/bafybeib…uema/1.json` | **404** (~400 ms) | HTML body returned; no such link |
| `https://ipfs.io/ipfs/bafybeib…uema/1.gif` | **200** (~100 ms) | 80 120 B GIF, etag `bafkrei…c4zhu`, `cache-control: max-age=29030400, immutable` |
| `https://dweb.link/ipfs/bafybeib…uema/1.json` | **404** | Body: `failed to resolve …: no link named "1.json" under bafybeib…uema` |
| `https://nftstorage.link/ipfs/bafybeib…uema/1.json` | **404** | Same body. |
| `https://w3s.link/…/1.json` | 301 chain → 404 |  |
| `https://cloudflare-ipfs.com/…/1.json` | ECONNREFUSED | Cloudflare deprecated this gateway in 2024. |

### 2.2 What this means

The IPFS CID is **image-only**. It contains 35 000 GIFs at paths `1.gif` … `35000.gif`. There is no JSON metadata bundle on IPFS for this collection.

The brief's Phase 2 §4.2 step `Fetch IPFS JSON from gateway with retry + concurrency cap` and §4.3 "parse IPFS JSON for: Species, Archetype, Corporation, Rarity, Alignment, Risk Level, Social Style, Coding Style, Work Ethic, Clothing, Clothing Pattern, Eyewear, Neckwear, Spots, Blush, Ear Detail" **cannot run** — those JSON files do not exist.

### 2.3 What *does* exist

Identity traits (Archetype, Corporation, Rarity, Alignment, RiskLevel, SocialStyle, CodingStyle, WorkEthic) **and** baseline stats are deterministically generated from `token_id` itself (`backend/engine/dev_generator.py:92-144`, `backend/engine/listener.py:160-227`) and stored in `devs` at mint time. They never went through IPFS. The "ingest from IPFS" step should be replaced with **"snapshot from `devs` table"** for those eight identity fields and six baseline stats.

Visual subtraits (Clothing, Eyewear, Spots, Blush, Ear Detail, etc.) have **no generator and no source**. They were declared as schema columns and apparently never wired up. To populate them we need either:
- (a) a separate IPFS bundle containing trait metadata (CID would need to come from the human),
- (b) a deterministic generator (Phase 2 would have to design the trait pools, weights, and seed mapping — nontrivial scope creep), or
- (c) a manual / off-line traits CSV the human provides.

**Action needed at Checkpoint 1:** which path?

### 2.4 Risk if we proceed without resolution

If we forge ahead and write the ingest script as the brief describes, it will fail on every token at the IPFS fetch step. If we stub visual fields with the literal string `"None"` (matching the brief's example for some fields), every Dev becomes visually identical for rarity purposes — destroying the entire visual rarity dimension across the collection.

---

## 3. `personality_seed` availability

✅ **Confirmed populated** by code inspection (cannot run a live SQL query — no DB access from this environment).

- Schema: `personality_seed BIGINT NOT NULL` (`schema.sql:89`). NOT NULL constraint guarantees no nulls.
- Generation: `personality_seed = rng.randint(1, 2_147_483_647)` in both `dev_generator.py:123` and `listener.py:206`. Range is positive INT32, comfortably within BIGINT.
- Insert paths that set it:
  - `backend/api/routes/devs.py:134, 154` (on-demand generator)
  - `backend/engine/listener.py:235, 261` (mint listener)
- Read in engine: `backend/engine/engine.py:311` (`dev.get("personality_seed", 0)`) and selected at `:931, :1237`.

The proposed sanity query for the human to run before Checkpoint 1:
```sql
SELECT COUNT(*) FROM nx.devs WHERE personality_seed IS NULL OR personality_seed = 0;
-- expected: 0
SELECT MIN(personality_seed), MAX(personality_seed) FROM nx.devs;
-- expected: 1 .. 2147483647
SELECT COUNT(DISTINCT personality_seed), COUNT(*) FROM nx.devs;
-- expected: distinct ≈ count (very low collision rate at INT32 range, 35k tokens)
```

**Caveat:** because the generator uses `rng = random.Random(token_id)` and `personality_seed` is the *7th* `rng.randint` call in a fixed sequence (after stat_coding..stat_luck), the seed is fully deterministic from `token_id`. So the NX Souls derivation downstream is also deterministic from `token_id` alone — that's fine for the brief's correctness goal, but worth noting that two different mint runs with the same token_id would produce identical NX Souls.

---

## 4. Backend / frontend dependencies on the metadata shape

### 4.1 Frontend

Searched `frontend/src/` for `trait_type`, `attributes`, `/metadata/`, `devs_burned`, `skill_module`, `hair_style`, `hair_color`:

- **No frontend code consumes the `/metadata/{id}` JSON shape.** Every match for `attributes` was in `frontend/src/components/programs/flow/...` consuming **GeckoTerminal pool/trade attributes**, not Dev metadata.
- The frontend reads Dev data via `/api/devs/{id}` (which returns the full row, not the metadata-formatted JSON). That endpoint is `devs.py:176-205` and is **unaffected** by this refactor.
- One stray match: `monad-build/components/Build/steps/Step2Config.jsx:16` references a placeholder `"https://api.example.com/metadata/"` for a *different* product's baseURI input field. Not a consumer.

**Conclusion:** the public NFT metadata shape can change freely without breaking the frontend. The brief's §3.4 concern about migrating frontend consumers to `/api/devs/{id}/state` and `/api/devs/{id}/traits` is therefore not urgent — those new endpoints are still worth adding for NX Souls / PWA, but no migration is needed.

### 4.2 Backend

- `backend/api/routes/sentinel.py:875` references `"hasMetadata"` — this is checking ERC-20 contract metadata, unrelated to NFT JSON.
- No worker, Discord bot, or Twitter bot in the repo consumes the `/metadata/{id}` JSON. (No such code exists in the tree.)

### 4.3 Marketplaces / external consumers

Unknown without production telemetry. Recommend the human grep the API access logs (or Cloudflare analytics) for `/metadata/` requests over the last 7 days to enumerate live consumer User-Agents before deploying the new shape.

---

## 5. Engine / generator references the brief asks us to remove

### 5.1 Death / burn mechanic — **already absent**

Searched all of `backend/` for `burn_dev`, `_burn_dev`, `set_dev_dead`, `is_dead`, `burnDev`, `burned`:

| Symbol | Hits |
|---|---|
| `burn_dev` / `_burn_dev` / `burnDev` | 0 |
| `set_dev_dead` / `is_dead` | 0 |
| `devs_burned` | 2 — one column declaration (`schema.sql:144`) and one metadata trait line (`devs.py:342`) |

**There is no death mechanic to remove.** The brief's Phase 3 §5.6 task "Remove `burn_dev`, `_burn_dev`, `is_dead`, all dev-death logic from `engine.py`" finds nothing. The cleanup reduces to:
- Drop the `devs_burned` column (or just stop emitting it).
- Remove the one `Devs Burned` trait line in the metadata response.
- Add `exhausted` to `dev_status_enum` if we want the new exhaustion semantics. Current enum is `('active', 'resting', 'frozen')` (`schema.sql:39-41`). `'frozen'` may already serve this role — the human should confirm intent.

### 5.2 `Skill Module` — **already absent**

Zero hits anywhere in `backend/` or `frontend/` for `skill_module` or `Skill Module`. Nothing to remove. The brief's §1 "What's gone" line about `Skill Module` is a no-op.

### 5.3 Species pool reduction (14 → Bunny/Robot)

`SPECIES_POOL` at `backend/engine/dev_generator.py:44-47`:

```python
["Wolf", "Cat", "Owl", "Fox", "Bear", "Raven", "Snake", "Shark",
 "Monkey", "Robot", "Alien", "Ghost", "Dragon", "Human"]
```

Used at `dev_generator.py:107` (`species = rng.choice(SPECIES_POOL)`). Also assigned in `listener.py` (parallel implementation — see §6). This is what produces the audit-flagged "Species: Wolf, image: Bunny" mismatch.

Reducing to `["Bunny"]` (or `["Bunny", "Robot"]` if Robot is intentional) is one-line in two files. **However**: if we change the pool, all existing Devs in DB still have the wrong species value. The new endpoint can ignore the column and hard-code `"Bunny"` based on the actual GIF (which is the safer fix), or we can run a one-shot UPDATE. Decide at Checkpoint 1.

### 5.4 Other inventory worth flagging

- **Listener and on-demand generator are duplicated logic.** `backend/engine/listener.py:160-227` and `backend/engine/dev_generator.py:92-144` both generate Dev data with very similar code. Any species/trait change must be made in **both** files, or unified before Phase 2/3.
- **Energy CHECK is `0..15`, but metadata reports `max_value: 100`.** Already noted in §1.5; flagging again because it's the easiest pre-Phase-3 win and the brief assumes 15.
- **`balance_nxt` is BIGINT raw `$NXT`, not a decimal.** The brief's example shows `balance_nxt: 247.5` in `properties`. We'd need to either store decimals or document a divisor. The current code emits it as a plain integer.

---

## 6. Code-quality hazards Phase 2/3 will hit

1. **Two parallel generators.** `dev_generator.py` and `listener.py` (and the API's `_insert_dev_on_demand` at `devs.py:114-173`) all duplicate trait logic. Phase 2's NX Souls derivation will need to be wired in at three sites unless we unify first.
2. **`_run_auto_migrations()` is a hand-rolled idempotent migration runner.** Adding `dev_canonical_traits` here is fine, but it's a single function in `main.py:26+` that is already 60+ lines. Recommend keeping the brief's `migrations/YYYYMMDD_*.sql` filenames as documentation while also adding the `CREATE TABLE IF NOT EXISTS` block to `_run_auto_migrations()` so it actually runs.
3. **No EIP-4906 in the contract.** Searched `contracts/NXDevNFT_v4.sol` — zero matches for `4906`, `BatchMetadataUpdate`, or `MetadataUpdate`. Phase 4 §6.2's `emit BatchMetadataUpdate(0, 35000)` is **not available**. We'd have to hit each marketplace's refresh API per-token.
4. **Prior audit docs the brief references are missing.** `AUDIT-REPORT.md`, `PERSONALITY-AUDIT.md`, and `METADATA-RECONCILIATION.md` do not exist at the repo root. The closest analogues are in `audit_reports/STEP_*.md`, but they cover stack/DB/income/claims, not metadata. If those three docs encode design decisions the brief assumes (e.g., what visual subtrait pools should be), we're missing them.
5. **No project tests directory layout for `tests/test_nx_souls_derivation.py`.** Existing tests live at `backend/tests/`. The brief's path `tests/test_nx_souls_derivation.py` should be `backend/tests/test_nx_souls_derivation.py` — minor, but worth aligning.

---

## 7. Recommended decisions for the human at Checkpoint 1

Cannot proceed to Phase 2 until each of these is answered:

1. **Visual subtraits source.** No IPFS JSON exists. Pick one:
   - (a) Provide a separate CID for a metadata bundle — confirm it resolves on at least two gateways.
   - (b) Approve a deterministic generator (and provide trait pools + weights for Clothing, Eyewear, Spots, Blush, Ear Detail).
   - (c) Provide a one-time CSV / JSON file for all 35 000 tokens.
   - (d) Drop visual subtraits from the metadata entirely (collection is image-only for visual rarity).
2. **Production base URL.** Confirm where the contract's `_baseTokenURI` actually points and verify a live response. If `https://nxterminal.xyz/metadata/{id}` is genuinely 404, marketplaces are seeing nothing today and we need to fix that infra issue before the refactor lands.
3. **Species column behaviour.** Hard-code `"Bunny"` ignoring the DB? Run a one-shot UPDATE? Keep `"Robot"` in the pool? Pick one.
4. **`Devs Burned` removal.** Drop the column entirely (irreversible; need a Postgres backup), or just stop emitting the trait? Brief says drop; recommend keep + stop emitting until confirmed unused by analytics.
5. **`dev_status_enum`.** Repurpose existing `'frozen'` for exhausted Devs, or add a new `'exhausted'` value? (Postgres ENUM additions are one-way.)
6. **Energy `max_value` bug.** Approve fixing the schema/metadata mismatch (`100` → `15`) immediately as part of Phase 3, regardless of the larger refactor outcome.
7. **Marketplace refresh strategy.** Contract has no EIP-4906. Confirm we'll loop per-token across OpenSea / Magic Eden / Reservoir APIs (slow but works), or wait on a contract upgrade.

---

## 8. What I did *not* do (per "read-only by default")

- Ran no migrations.
- Wrote no SQL UPDATEs / INSERTs / DELETEs.
- Did not query the production database.
- Did not deploy or modify the running API.
- Did not modify any source file in `backend/` or `contracts/`.
- Did not create `dev_canonical_traits`, `nx_souls/derivation.py`, or any Phase 2 artifact.

The only file written by this phase is this report (`phase1-preflight.md`) at the repo root.

---

## 9. Sign-off

🛑 **STOP at Checkpoint 1.** Awaiting human resolution of §7 items 1–7 before starting Phase 2.
