# NX PETS — Pre-Build Audit Report

- **Generated**: 2026-05-01
- **Auditor**: Claude Code
- **Repo commit**: `30d8c26d056a8e3a77b5ee9def608ad3e8d1db4d`
- **Branch**: `claude/audit-nx-pets-pwa-IWGKC`

---

## 1. Executive summary

The NX Terminal backend is **substantially ready** to be the shared source of truth for NX PETS, but with three blockers and several stack mismatches that contradict the brief.

1. **Stack mismatch — backend is FastAPI, not Flask.** The brief specifies "Flask/PostgreSQL". The repo runs FastAPI 0.115 + uvicorn (8 workers) + psycopg2 (no SQLAlchemy, no Alembic). All schema migrations are raw SQL inside `backend/api/main.py::_run_auto_migrations` and `backend/db/migration_*.sql`. Any Flask-specific assumption in the build plan must be adapted.
2. **No wallet-signature auth exists today — `validate_wallet()` only checks the regex shape `^0x[0-9a-fA-F]{40}$`** (`backend/api/deps.py:199-207`). Every "authenticated" mutation (shop buy, hack, fund, transfer, prompts) trusts the `player_address` field in the request body. There is no SIWE, no JWT, no session, no signed-message verification. Adding NX PETS pair → JWT auth is **net-additive security**, but means the portal endpoints currently have a broader trust posture than the brief implies — the JWT middleware will be the *first* real auth this codebase has.
3. **Decay already exists — this is good news. Introducing decay is NOT a blocker.** Hourly decay runs inside the engine's `run_salary` tick (`backend/engine/engine.py:1039-1140`): energy −1, pc_health −2, caffeine −2, social_vitality −1 (with floor recovery to 25), knowledge −1 (with floor recovery to 30, low-knowledge bug generation). NX PETS reuses this directly.
4. **The portal is NOT the "pet manager" the brief assumes.** `devs` are 35,000 *autonomous AI agents* that act on their own via the simulation engine; the player's interaction is through the **shop** (buy items that mutate stats) and **prompts**. There is no dedicated `POST /api/devs/:id/coffee` endpoint — coffee is a `shop_purchases` row with `item_id="coffee"` posted to `POST /api/shop/buy`. NX PETS should call `/api/shop/buy` with `item_id` ∈ {`coffee`, `pizza`, …}, and `/api/shop/hack-mainframe` / `/api/shop/hack-player` for HACK. **There is no shape called COFFEE/FEED/HACK — there is `buy(coffee)` / `buy(pizza|burger|carrot)` / `hack-mainframe`.**
5. **Three subsystems are 100% NEW: AI chat, push notifications, pgvector memory.** No LLM client, no Web Push, no VAPID, no `pgvector` extension, no embeddings table is present anywhere in the repo. **`/api/chat/devs` is not an AI chat — it returns autonomous-dev `chat_messages` rows the engine writes; players can only read.**

**Top 3 blockers (decision-required, before any code):**

- **B1 — Schema/contract semantics**: confirm that "Bugs" maps to `devs.bugs_shipped` (an integer counter, not a 0–100 stat) and "Energy" is 0–15 in DB (not 0–100). The brief assumes 0–100 stats. The `/metadata` endpoint already lies about this — it serves `Energy` with `max_value: 100` while the column is `CHECK (energy >= 0 AND energy <= 15)` (`backend/db/schema.sql:124`).
- **B2 — Auth migration**: introducing JWT to *any* existing mutation endpoint will break every portal call that currently sends only `player_address`. Either add JWT as an optional second auth path or version the endpoints (`/api/v1/...`).
- **B3 — IPFS CID mismatch**: brief says CID is `bafybeicz5ilcu6i36ljkacix37c4r3qrtrpjhwgylp2buxfea443cxc7i4`. Code uses `bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema` (`backend/engine/dev_generator.py:13`). One is wrong.

---

## 2. Repository inventory

**Not a monorepo.** Single-repo with two siblings (`backend/`, `frontend/`) and a `contracts/` folder. No npm/pnpm workspaces, no turborepo, no `package.json` at root. Two independent build tools:
- **Backend**: `backend/requirements.txt` (pip), `runtime.txt` (Python 3.11.11).
- **Frontend**: `frontend/package.json` (Vite 7.3 / React 19 / wagmi 2.14 / viem 2.46).

```
nx-terminal/
├── backend/            # FastAPI app + simulation engine
│   ├── api/            # FastAPI routers, ws, middleware, rate_limit, auth/ (empty)
│   ├── engine/         # Simulation worker, blockchain listener, claim_sync
│   ├── db/             # raw .sql schema + migration files (no ORM)
│   ├── services/       # ledger, lmsr, signer, wallet_balance, admin_log
│   ├── scripts/        # one-shot scripts
│   ├── tests/
│   └── docs/
├── frontend/           # Vite + React 19 SPA, NOT a PWA
│   └── src/
│       ├── components/programs/  # Sub-apps: chogpet, mega-sentinel, monad-city, etc.
│       ├── windows/              # 19 Win98-style windows
│       ├── contexts/             # DevsContext, WalletSelectorContext
│       ├── hooks/                # useWallet, useAPI, useWebSocket, useMegaName
│       └── services/             # api.js, contract.js, wagmi.js
├── contracts/          # NXDevNFT_v4.sol, NXTToken_v3.sol (only 2 files)
├── audit_reports/      # Prior internal audits
├── render.yaml
├── runtime.txt
└── .env.example
```

- **Shared types?** None. JS frontend has no TypeScript; backend has Pydantic models inline in routes. No shared schema package.
- **Existing satellite apps**: `frontend/src/components/programs/{chogpet,dev-academy,flow,mega-sentinel,mission-control,monad-build,monad-city,monad-sdk,nadwatch,netwatch,parallax,phares,pharos-sdk}` — all live **inside** the portal as Win98 windows, none are deployed separately.
- **Files present**: `.env.example` (yes), `render.yaml` (yes), `runtime.txt` (yes).
- **Files absent**: `.env.production` (no), `Dockerfile` (no), `.github/workflows/` (**no — the directory does not exist**), `frontend/Dockerfile` (no).

---

## 3. Frontend findings

- **Vite config (`frontend/vite.config.js`)**: bare-minimum — `react()` plugin only. **No path aliases, no `vite-plugin-pwa`, no Workbox.**
- **Routing**: NO React Router. Path-based switch in `frontend/src/main.jsx:31-41` — only routes are `/` (App) and `/moss-test` (MossTest diagnostic). All "navigation" inside the portal is via the in-app `WindowManager` (`frontend/src/hooks/useWindowManager.js`, `frontend/src/components/WindowManager.jsx`), not URLs. SPA fallback `_redirects: /* /index.html 200` (`frontend/public/_redirects`).
- **State management**: TanStack React Query 5.90 + React Context (`DevsContext`, `WalletSelectorContext`). No Redux/Zustand.
- **Auth (frontend side)**: wagmi 2.14 + viem + injected connector + `@megaeth-labs/wallet-wagmi-connector` (MOSS) + optional `MegaProvider` from `@megaeth-labs/wallet-sdk-react` mounted only on `/moss-test`. **No SIWE, no signMessage flow anywhere in the codebase.** The address from `useAccount()` is sent directly in JSON request bodies (`api.js:68-109`).
- **JWT/session storage**: not present. No `localStorage.setItem('token', ...)`, no `Authorization` header. Frontend talks to API CORS-enabled with `allow_credentials=true` but no cookies are issued by the backend.
- **API client**: `frontend/src/services/api.js` — single object literal. Base URL: `import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com'`. WebSocket: `WS_BASE = API_BASE.replace('https','wss')`. No interceptors, no retry, no auth header.
- **UI library**: 98.css visual style is hand-written in `App.css` + `index.css` (no `98.css` package import). No Tailwind, no CSS Modules adoption (only `WalletSelectorModal.module.css`, `WalletSelectorCancelOverlay.module.css`, `MossTest.module.css`). `lucide-react` for icons.
- **PWA today?** **NO.** `frontend/index.html` has no `<link rel="manifest">`, no service worker registration, no `manifest.webmanifest`, `frontend/public/` only contains `_redirects`.
- **IPFS gateway**: hardcoded as `https://gateway.pinata.cloud/ipfs/` in 7 files (`frontend/src/windows/{MyDevs,DevProfile,DevCamp,HireDevs,LiveFeed}.jsx`, `frontend/src/components/programs/mission-control/MissionControl.jsx`). **No fallback chain.** No `ipfs.io` / `4everland` / `cf-ipfs` rotation.
- **Stat UI** — primary surface is `frontend/src/windows/DevProfile.jsx`. Stat bars rendered in `DevProfile.jsx:302-307` from fields `dev.stat_coding`, `dev.stat_hacking`, `dev.stat_trading`, `dev.stat_social`, `dev.stat_endurance`, `dev.stat_luck`. Energy bar at `DevProfile.jsx:178-180` (renders `energy / max_energy` — note: 0–15 scale). Vitals (caffeine, social_vitality, knowledge, pc_health, bugs_shipped) are read from same dev object — see `DevProfile.jsx:329-361`. Data shape comes from `GET /api/devs/{id}` which returns the entire `devs` row. **NX PETS will consume the same shape, but must be aware that `energy` is 0–15 and "bugs" is a counter (`bugs_shipped` integer), not a 0–100 stat.**
- **Action handlers** — all live in `frontend/src/windows/MyDevs.jsx` (2,571 lines) and `DevProfile.jsx`. The action API surface is in `frontend/src/services/api.js`:
  - `buyItem(player_address, item_id, target_dev_id)` → `POST /api/shop/buy` — used for COFFEE / FEED / FIX / etc.
  - `hackMainframe(player_address, attacker_dev_id)` → `POST /api/shop/hack-mainframe`.
  - `hackPlayer(player_address, attacker_dev_id)` → `POST /api/shop/hack-player`.
  - `fundDev(player_address, dev_token_id, amount, tx_hash)` → `POST /api/shop/fund` (on-chain $NXT deposit).
  - `transferNxt(...)` → `POST /api/shop/transfer`.
  - `graduate(...)` → `POST /api/shop/graduate`.
- **No optimistic UI**. Each shop call awaits the response; the response includes `updated_dev` and `changes[]` array for animation deltas (`backend/api/routes/shop.py:394-402`).
- **Existing chat / messaging UI**: `frontend/src/windows/WorldChat.jsx` (human chat, posts to `/api/chat/world`); read-only AI dev messages via `getDevChat()` consumed by `LiveFeed.jsx`. **No 1:1 chat-with-your-dev component exists.**
- **Pet-like assets already in repo**:
  - `frontend/src/components/PetMiniModal.jsx` — desktop floating pet that uses `frontend/src/components/programs/chogpet/`. This is **a localStorage-only mascot** (`STORAGE_KEY = 'megagotchi-state'`), not connected to the dev system at all. Its decay is client-only (`HUNGER_DECAY_MS`, `HAPPINESS_DECAY_MS`).
  - `frontend/src/components/programs/chogpet/{ChogPet.jsx, components/{PetSprite,DialogBubble,PetMenu,PetOverlay}.jsx, hooks/usePetState.js, constants.js}` — pixel-art sprites for 3 MegaETH mascots (Chog, Molandak, Moyaki) + dialog bubble component. **Reusable for NX PETS UI chrome.**

---

## 4. Backend findings

- **Framework**: FastAPI 0.115.6 (`backend/requirements.txt:1`). Single-package layout `backend/api/`, all routers wired in `backend/api/main.py:716-735`. No blueprints (Flask term) — uses `APIRouter` and `app.include_router(...)`.
- **ORM**: NONE. Direct `psycopg2` + `RealDictCursor` (`backend/api/deps.py:69-87`). Migrations are raw SQL, applied at app startup by `_run_auto_migrations()` (idempotent, `IF NOT EXISTS` everywhere — `backend/api/main.py:26-635`). No Alembic.
- **DB**: PostgreSQL 15 on Render (`render.yaml:1-7`). Schema name `nx` (`NX_DB_SCHEMA=nx`). Connection envs: `NX_DB_HOST/PORT/NAME/USER/PASS` or single `DATABASE_URL`. SSL auto-detected when host contains `render.com`.
- **Redis**: `REDIS_URL` configured (`render.yaml:11-15`, free tier, `allkeys-lru`). Used for: rate limiting (`backend/api/rate_limit.py`, fail-open), pub/sub for WebSocket broadcast (`backend/api/deps.py:210-224`), no caching, no sessions.
- **Rate limiting**: custom `RateLimiter` / `SlidingWindowLimiter` in `backend/api/rate_limit.py` backed by Redis. Per-IP global limit in `backend/api/main.py:665-674`. Per-wallet limits in route-level `shop_limiter.check(f"wallet:{addr}")`. **No `flask-limiter` (n/a — FastAPI).**
- **CORS** (`backend/api/main.py:678-692`): allowed origins = `localhost:3000`, `localhost:5173`, `nxterminal.onrender.com`, `nx-terminal.onrender.com`, `nx-frontend-5cbf.onrender.com`, `nxterminal.xyz`, `www.nxterminal.xyz`. **`pets.nxterminal.xyz` will need to be added.** `allow_credentials=True`, methods/headers `*`.
- **Auth verification**: `validate_wallet(addr)` (`backend/api/deps.py:202-207`) is regex-only. **No signed-message verification anywhere.** Admin auth: `X-Admin-Wallet` header matched against an in-memory set `ADMIN_WALLETS` (`backend/api/routes/admin.py:25-41` and same pattern in `simulation.py::force_claim_sync`). **No JWT secret env var. No session secret.** This means pet-pairing JWT is greenfield.

### 4.1 Stats source of truth

**Table: `nx.devs`** (`backend/db/schema.sql:80-178` + auto-migrations). Primary key `token_id INTEGER`. Owner FK `owner_address VARCHAR(42)` references `players.wallet_address`. Relevant columns:

| Column                        | Type                | Range / default                            |
|-------------------------------|---------------------|--------------------------------------------|
| `energy`                      | SMALLINT NOT NULL   | DEFAULT 10, **CHECK 0..15** ⚠              |
| `max_energy`                  | SMALLINT NOT NULL   | DEFAULT 10                                 |
| `pc_health`                   | SMALLINT NOT NULL   | DEFAULT 100 (0..100, no CHECK)             |
| `caffeine`                    | SMALLINT NOT NULL   | DEFAULT 50 (0..100 in code, no CHECK)      |
| `social_vitality`             | SMALLINT NOT NULL   | DEFAULT 50 (0..100 in code, no CHECK)      |
| `knowledge`                   | SMALLINT NOT NULL   | DEFAULT 50 (0..100 in code, no CHECK)      |
| `bugs_shipped`                | INTEGER NOT NULL    | DEFAULT 0 — **counter, not 0..100**        |
| `bugs_fixed`                  | INTEGER NOT NULL    | DEFAULT 0 — counter                        |
| `mood`                        | mood_enum           | DEFAULT 'neutral'                          |
| `balance_nxt`                 | BIGINT NOT NULL     | DEFAULT 2000, CHECK ≥ 0                    |
| `last_action_at`              | TIMESTAMPTZ         | nullable                                   |
| `last_raid_at`                | TIMESTAMPTZ         | nullable — drives 24h hack cooldown        |
| `training_course/_ends_at`    | VARCHAR/TIMESTAMPTZ | nullable                                   |
| `next_cycle_at`               | TIMESTAMPTZ         | NOT NULL — engine schedule                 |
| `cycle_interval_sec`          | INTEGER             | DEFAULT 600                                |
| `coffee_count`                | INTEGER             | DEFAULT 0                                  |
| `hours_since_sleep`           | INTEGER             | DEFAULT 0                                  |

**Indexes**: owner, schedule, location, archetype, balance, reputation, corporation. No composite covering index on `(token_id, energy, caffeine, …)` — single-row reads use the primary key.

**No `last_decay_at` / `last_coffee_at` columns**. Decay is applied as a single batched UPDATE every hour to all active devs; the only per-action timestamps are `last_action_at` (cached last action) and `last_raid_at` (cooldown). For decay countdown UIs, NX PETS will need to derive "next decay tick" from `next_cycle_at` or read engine state.

### 4.2 Action mutation logic

**Not centralized.** Mutations are inlined in route handlers, not factored into a service module. The functions NX PETS must call:

| Action              | Endpoint                      | Handler (file:line)                      |
|---------------------|-------------------------------|------------------------------------------|
| Buy item (COFFEE/FEED/PIZZA/BURGER/CARROT/PC repair/Bug fix/Mood reset/Team lunch/Read docs/Code boost/Sabotage/Teleport/Reputation boost) | `POST /api/shop/buy` | `backend/api/routes/shop.py:257-402` |
| Training (8h class / 2h course)        | `POST /api/shop/buy` (effect.type=`training`) | same handler, `shop.py:383-388` |
| Graduate completed training            | `POST /api/shop/graduate`     | `shop.py:412-462` |
| Hack mainframe (40% base success)      | `POST /api/shop/hack-mainframe` | `shop.py:510-700` |
| Hack other player's dev (PvP)          | `POST /api/shop/hack-player`  | `shop.py:703-985` |
| Fund dev (on-chain $NXT deposit)       | `POST /api/shop/fund`         | `shop.py:1015-1197` |
| Transfer $NXT between user's devs      | `POST /api/shop/transfer`     | `shop.py:1209-1351` |
| Send prompt to dev                     | `POST /api/prompts`           | `backend/api/routes/prompts.py` |

`SHOP_ITEMS` dict is at `backend/api/routes/shop.py:28-175`. **There is no item called "feed" — feeding is `pizza` / `burger` / `carrot` / `coffee`.** All items target the `target_dev_id` and deduct from `dev.balance_nxt` (the dev's in-game $NXT balance, not the wallet's on-chain balance). Pattern: `SELECT … FOR UPDATE` → ownership check → cost check → `UPDATE devs` → `INSERT shop_purchases`. Optional shadow-write to `nxt_ledger` (Fase 3C) gated by `is_shadow_write_enabled()`.

### 4.3 Existing endpoint catalog (key set)

Mounted in `backend/api/main.py:716-735`:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | health check |
| GET | `/api/simulation/state\|stats\|feed\|events` | none | sim metadata |
| GET | `/api/devs` | none | list (filter/sort) |
| GET | `/api/devs/{id}` | none | full row + on-demand creation |
| GET | `/api/devs/{id}/{history,protocols,investments,ais,messages,metadata}` | none | dev sub-resources |
| GET | `/api/protocols`, `/api/protocols/{id}` | none | LMSR market |
| GET | `/api/ais` | none | AI Lab rankings |
| GET | `/api/leaderboard`, `/api/leaderboard/corporations` | none | rankings |
| POST | `/api/prompts` | wallet body | send player→dev prompt |
| GET | `/api/chat/devs?channel=` | none | autonomous-dev chat (engine-written) |
| GET/POST | `/api/chat/world` | wallet body | human world chat |
| POST | `/api/players/register` | wallet body | register |
| GET | `/api/players/{wallet}` | none | profile |
| GET | `/api/players/{wallet}/claim-history` | none | claim log |
| POST | `/api/players/{wallet}/record-claim` | wallet body | record on-chain claim |
| GET/POST | `/api/shop`, `/api/shop/{buy,graduate,hack-mainframe,hack-player,fund,transfer,…}` | wallet body | actions |
| GET/POST | `/api/notifications` | wallet body | inbox |
| GET/POST | `/api/{academy,sentinel,missions,streak,achievements,nxmarket}` | wallet body | sub-systems |
| GET/POST | `/api/admin/*` | `X-Admin-Wallet` header | ops |
| WS | `/ws/feed` | none | live event stream |
| GET | `/metadata/{token_id}` | none | ERC-721 tokenURI |

### 4.4 Existing decay mechanism

**Yes — decay exists.** Implemented in `backend/engine/engine.py::run_salary` (called once per hour from the engine main loop). Excerpt at lines 1039-1140:

- `energy = GREATEST(0, energy - 1)` per hour, active devs only.
- `pc_health -= 2 * pc_decay_multiplier` per hour.
- `caffeine -= 2 * energy_decay_multiplier` per hour.
- `social_vitality -= 1` per hour, with passive recovery `LEAST(25, social_vitality + 2) WHERE social_vitality < 25` to prevent permanent lockout below the 15-floor required for hacking.
- `knowledge -= 1` per hour, with passive recovery `LEAST(30, knowledge + 2) WHERE knowledge < 30` because low knowledge auto-generates `bugs_shipped`.
- Modulated by active `world_events` JSONB `effects` (e.g. "Energy Crisis" doubles decay; "Maintenance Mode" zeroes pc_decay).

**Decay is NOT a blocker.** NX PETS does not need to introduce it. The product change risk in section 4.3 of the brief does not apply.

### 4.5 LLM, pgvector, embeddings — none of it exists

- No `groq` / `cerebras` / `gemini` / `openai` / `anthropic` import or env var anywhere in `backend/`. Confirmed via `grep -ril "groq\|cerebras\|gemini\|openai\|anthropic\|claude\|llm" backend/`. (Hits in test files / `test_engine.py` are about archetype names like `10X_DEV` and `closed_ai`, not LLM clients.)
- `pgvector` extension is **not** present in `backend/db/schema.sql` (no `CREATE EXTENSION vector`). No table has a `vector(...)` column.
- `templates.py` (`backend/engine/templates.py`) is the "Zero LLM. Weighted random + combinatorial templates" system per `README.md:1-4`. **That is the explicit design choice.** NX PETS is the *first* AI-LLM consumer in this stack.

### 4.6 Web Push, Service Workers, VAPID — none of it exists

- No `pywebpush` / `web-push` import.
- No `VAPID_*` env var.
- No `manifest.webmanifest`, no `sw.js`, no `registerSW`. Confirmed via grep.

---

## 5. Contracts findings

- **Files**: only two — `contracts/NXDevNFT_v4.sol`, `contracts/NXTToken_v3.sol`. No build tool config (no `foundry.toml`, no `hardhat.config.js`) checked in.
- **Addresses (from `.env.example` and `frontend/src/services/contract.js:2-3`)**:
  - NXDevNFT: `0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7` ✅ matches brief.
  - NXTToken: `0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47` ✅ matches brief.
  - Treasury: `0x31d6E19aAE43B5E2fbeDb01b6FF82AD1e8B576DC` ✅ matches brief and is hardcoded in `backend/api/routes/shop.py:992` and `backend/api/routes/admin.py:28`.
- **Chain**: MegaETH mainnet, chainId `4326`, RPC `https://mainnet.megaeth.com/rpc` (frontend) and `https://carrot.megaeth.com/rpc` (`.env.example:14`, backend default in `backend/api/routes/devs.py:16` differs — uses `mainnet.megaeth.com`).
- **RPC fallback**: NONE. `_rpc_call()` (`backend/api/routes/devs.py:86-101`) retries up to 2× on the same URL.
- **Burn function on $NXT**: present (`contracts/NXTToken_v3.sol`): `ERC20Burnable` standard burn, `gameBurn`-style approved-burner mapping (`isApprovedBurner`), auto-burn-on-transfer with `autoBurnRate` BPS, all gated by `burnEnabled` toggle. **The burn primitive exists, but the COFFEE / FEED / HACK actions are entirely off-chain today.** Stats are mutated in PostgreSQL; no on-chain `burn()` is fired by `/api/shop/buy` or `/api/shop/hack-*`. The brief's reference to "(existing) `$NXT.burn()` for paid feeds" does not match the code — feeds today decrement `devs.balance_nxt` only.
- **ABIs in frontend**: `frontend/src/services/contract.js` holds addresses; ABI snippets are inlined per-call in `useWallet`/`MyDevs.jsx` (mint, claim, fund). No `/abis/` directory.
- **Ownership cache**: none. `_check_token_owner()` in `backend/api/routes/devs.py:104-111` does an on-demand `eth_call` against `ownerOf(uint256)` only when the dev is missing from the DB. Routine ownership decisions read `devs.owner_address` cached at mint by the `listener.py`; revocation on transfer relies on the on-chain `Transfer` listener (`backend/engine/listener.py`).

---

## 6. Deployment findings

`render.yaml` defines:

| Service       | Type     | Plan    | Notes |
|---------------|----------|---------|-------|
| `nx-db`       | postgres | starter | PG 15, db `nxterminal` |
| `nx-redis`    | redis    | free    | `allkeys-lru` |
| `nx-api`      | web      | starter | uvicorn, 8 workers, healthcheck `/health`, region `ohio` |
| `nx-engine`   | worker   | starter | runs `backend/engine/run_all.py` (engine + listener + sync_reconciler + ledger_reconciler + nxt_claimed_listener as threads) |

- **No cron services defined.** Hourly jobs are not Render cron — they are Python threads inside the worker (`backend/engine/run_all.py:131-178`).
- **No GitHub Actions** — `.github/` directory does not exist.
- **No staging environment** — single production stack.
- **Branch strategy** observed: dev branch `claude/audit-nx-pets-pwa-IWGKC` exists; main implied. (PR / branch policy not visible without `.github/`.)
- **Env vars referenced** (from `.env.example`, `render.yaml`, `backend/docs/ENVIRONMENT.md`): `NX_DB_{HOST,PORT,NAME,USER,PASS,SCHEMA}`, `DATABASE_URL`, `REDIS_URL`, `MEGAETH_RPC_URL`, `CHAIN_ID`, `EXPLORER_URL`, `NFT_CONTRACT_ADDRESS`, `TOKEN_CONTRACT_ADDRESS`, `BACKEND_SIGNER_PRIVATE_KEY`, `DRY_RUN`, `PYTHONPATH`, `VITE_API_URL`. **No JWT secret, no VAPID, no LLM keys present today.**

---

## 7. Reusable assets

- **IPFS dev image CID**: ⚠ **brief and code disagree.**
  - Brief: `bafybeicz5ilcu6i36ljkacix37c4r3qrtrpjhwgylp2buxfea443cxc7i4`.
  - Code (`backend/engine/dev_generator.py:13`, also `backend/engine/listener.py:203`): `IMAGE_CID = "bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema"`. Asset URL pattern: `{IMAGE_CID}/{token_id}.gif`.
  - `frontend/src/windows/HireDevs.jsx:10` has yet another CID: `bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema` (same as backend) — confirms backend is canonical.
- **Pixel-art fonts / sounds**: only `frontend/src/utils/sound.js` (sound playback util, sounds inlined or in `frontend/src/assets/wallets`). No dedicated pixel-art font dir.
- **Reusable Win98 chrome**: `App.css`, `index.css`, `frontend/src/components/Window.jsx`, `WindowManager.jsx`, `Taskbar.jsx`, `StartMenu.jsx`, `Desktop.jsx`. Hand-rolled, no `98.css` package — copy or extract.
- **Dev image rendering**: `IPFS_GW = 'https://gateway.pinata.cloud/ipfs/'` + `${IPFS_GW}${dev.ipfs_hash}` pattern (single gateway, no fallback). Reuse and add fallback for NX PETS.
- **Pet sprites already shipped**: `frontend/src/components/programs/chogpet/constants.js` ships pixel-art frames for Chog/Molandak/Moyaki + dialog bubble component. **Reusable.** Note: not Dev images — those are IPFS GIFs.
- **Stat-bar component**: not extracted; rendered inline in `DevProfile.jsx:302-307`. Will need to be lifted to a shared component or rebuilt for the PWA.
- **Design system / shared component lib**: NO package. Components live alongside their consumers.

---

## 8. Reuse vs new matrix

| Need (NX PETS) | Status | File refs / notes |
|---|---|---|
| **Stats source of truth** | REUSE | `nx.devs` table (`backend/db/schema.sql:80-178`) — but ⚠ `energy` is 0–15, "Bugs" is `bugs_shipped` counter |
| Hourly decay engine | REUSE | `backend/engine/engine.py::run_salary` (lines 1039-1140) — already runs |
| Apply COFFEE / FEED | REUSE | `POST /api/shop/buy` with `item_id ∈ {coffee, carrot, pizza, burger}` (`shop.py:257`) |
| Apply HACK | REUSE | `POST /api/shop/hack-mainframe` and `POST /api/shop/hack-player` (`shop.py:510`, `:703`) |
| Read full Dev state | REUSE | `GET /api/devs/{id}` (`backend/api/routes/devs.py:176`) |
| List wallet's Devs | REUSE | `GET /api/devs?owner=0x…` (`backend/api/routes/devs.py:20`) |
| Action history | REUSE | `GET /api/devs/{id}/history` returns `actions` rows (`devs.py:208`) — already partitioned by date |
| `pair_codes(...)` table | NEW | none today |
| `push_subscriptions(...)` table | NEW | none today |
| `chat_messages(role,content,...)` for player↔Dev AI | NEW | existing `chat_messages` is for autonomous-dev-to-world chat; **schema collision risk on table name** — must namespace (e.g. `companion_chat_messages`) |
| `dev_memories(... vector(768) ...)` | NEW | pgvector not installed; extension to be added |
| `notif_templates(...)` | NEW | none today |
| `ai_usage(...)` | NEW | none today |
| `users.active_dev_id` | EXTEND `players` | use `players` table (`backend/db/schema.sql:61-71`); add `active_dev_id INTEGER REFERENCES devs(token_id)` |
| Dev action log per-user | REUSE (partial) | `actions` table logs everything by `dev_id` (`backend/db/schema.sql:264-283`); for "user-triggered actions" specifically, `shop_purchases` (`schema.sql:328-336`) is the cleanest source |
| `last_*_at` timestamp columns | EXTEND devs | only `last_action_at`, `last_raid_at` exist; **no per-stat "last_decay_at"** — derive from `next_cycle_at` |
| `POST /api/companion/pair` | NEW | endpoint must be added |
| `POST /api/companion/redeem` | NEW | new endpoint; will be FIRST JWT-issuing endpoint in the codebase |
| `GET /api/companion/me` | NEW | new endpoint |
| `POST /api/companion/active` | NEW | new endpoint |
| `POST /api/companion/chat/:tokenId` (LLM) | NEW | NEW LLM client + cascade required; pgvector required |
| `GET /api/companion/chat/:tokenId` | NEW | new endpoint |
| `POST /api/companion/push/{subscribe,unsubscribe}` | NEW | requires VAPID + `pywebpush` dep |
| Decay cron | REUSE | already in engine worker |
| Notification dispatcher cron | NEW | new thread in engine worker recommended (cheaper than Render cron) |
| Memory consolidation cron | NEW | new thread or GH Actions cron |
| Template refresh cron | NEW | new thread or GH Actions cron |
| Ownership re-verify cron | NEW | new thread; `Transfer` listener already exists in `backend/engine/listener.py` — extend instead of polling |
| Auth middleware (JWT bearer) | NEW | none today; first JWT path in repo |
| CORS allow `pets.nxterminal.xyz` | EXTEND | `backend/api/main.py:680-688` |
| Frontend PWA shell | NEW | new Vite project; portal is not a PWA |
| IPFS gateway fallback | EXTEND | currently single Pinata gateway (`frontend/src/windows/MyDevs.jsx:18` etc.) |
| Wallet connect on portal pair-init | REUSE | wagmi/MOSS already set up (`frontend/src/services/wagmi.js`) |
| Realtime sync to PWA | EXTEND | `/ws/feed` exists but is a public firehose; new per-user WS or SSE channel is recommended (or polling) |

---

## 9. Risk register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **`energy` is 0–15, not 0–100.** Schema check `CHECK (energy >= 0 AND energy <= 15)` (`schema.sql:124`). `/metadata/{token_id}` already mis-advertises `max_value: 100` (`devs.py:332`). | **HIGH** | Pick one and codify. Recommend: keep DB at 0–15 (changing it touches the running engine and 35,000 rows), document the 0–15 scale in the audit, render in the PWA as `energy / max_energy * 100`. |
| 2 | **"Bugs" is `bugs_shipped` integer counter, not a 0–100 stat.** Brief and pet-UX assume a bar. Counter can grow unbounded under low knowledge. | **HIGH** | Either add a derived `bugs_pct = LEAST(100, bugs_shipped)` in API responses, or replace "Bugs" with `pc_health` (which IS 0–100) in the pet UX. |
| 3 | **No wallet-signature auth today.** `validate_wallet()` is regex-only. NX PETS introducing JWT puts a real auth boundary in place — but means existing portal endpoints still trust the request body. Coordinated rollout required. | **HIGH** | Add JWT as additive (Bearer header). Existing routes accept either: header JWT *or* body `player_address`. Migrate gradually. |
| 4 | **Action endpoint shape lock-in.** Once the PWA calls `/api/shop/buy`, its `request {player_address,item_id,target_dev_id}` and `response {purchase_id,changes[],updated_dev}` are dual-client public contracts. | MED | Version the endpoints (`/api/v1/shop/buy`) before NX PETS launches. Cheap insurance. |
| 5 | Decay introduction risk | LOW | **N/A — decay already exists in production.** |
| 6 | **CORS / domain split.** Portal at `nxterminal.xyz`, PWA at `pets.nxterminal.xyz` — same eTLD+1 means subdomain cookies are technically possible but JWT in Authorization header is cleaner across origins. | MED | Use Bearer JWT, no cookies on PWA. Whitelist `https://pets.nxterminal.xyz` in `backend/api/main.py:680`. |
| 7 | **Render plan limits.** Adding a static site (free) is fine. Adding 5 cron services is **NOT** — Render starter charges per cron. | MED | **Run the 5 PWA-specific jobs as threads in the existing `nx-engine` worker** (matching the existing pattern in `run_all.py`). Zero new Render services needed. |
| 8 | **RPC rate limits.** PWA `ownerOf` daily re-verify adds a new consumer to MegaETH RPC. | LOW | Reuse the on-chain `Transfer` listener (`backend/engine/listener.py`) instead of polling. Cache `owner_address` in `devs` table (already done). |
| 9 | **GitHub Actions cron load.** N/A — `.github/workflows/` does not exist. | LOW | If we add GH Actions, pick public repo or budget the 2k min/mo. |
| 10 | **No Solidity changes needed.** Confirmed: no new on-chain logic for NX PETS. `ownerOf`/`balanceOf` reads + existing `$NXT.burn()` (currently unused by shop) only. | LOW | Stay off-chain. |
| 11 | **MOSS SDK already integrated** (`@megaeth-labs/wallet-sdk-react@0.1.6`, `@megaeth-labs/wallet-wagmi-connector@0.1.0-beta.2`). Currently behind `SHOW_MOSS_WALLET=false` flag (`frontend/src/services/wagmi.js:36`) — registered but hidden from picker. | LOW | Reuse on portal-side pair-init. No PWA-side wallet integration needed. |
| 12 | **Multi-Dev write contention.** `SELECT … FOR UPDATE` is used in shop/hack/transfer paths. Safe. | LOW | Verified — existing pattern is correct. |
| 13 | **Active companion semantics on transfer.** Need to clear `players.active_dev_id` when the on-chain `Transfer` event fires. | MED | Hook into `backend/engine/listener.py` (the existing Transfer listener). |
| 14 | **Realtime sync.** Existing `/ws/feed` is a global firehose, not user-scoped. PWA polling on focus is sufficient and cheaper. | LOW | PWA polls `GET /api/devs/{id}` every 15s when foregrounded, plus revalidate on every action response (already returns `updated_dev`). |
| 15 | **IPFS CID disagreement** brief vs code (see §1). | **HIGH** | Confirm canonical CID with human before any UI uses it. |
| 16 | **No pgvector extension** today. Adding it requires a Render dashboard step (CREATE EXTENSION needs superuser; managed PG on Render allows it via UI). | MED | Verify Render's PG starter plan supports `vector`. Alternative: store memories as TEXT and use Cerebras/OpenAI for retrieval until pgvector is enabled. |
| 17 | **`chat_messages` table-name collision.** Existing table holds engine-written autonomous-dev chat (`backend/db/schema.sql:289-302`, partitioned by date). Brief's "AI chat history per Dev" must use a new table to avoid contaminating the partition or breaking `GET /api/chat/devs`. | **HIGH** | Use `companion_chat_messages` (or `pet_chat_messages`). Do not extend the existing partitioned table. |
| 18 | **Single IPFS gateway** (Pinata). One outage = pet images blank. | MED | Add `[ipfs.io, 4everland.io, w3s.link]` fallback chain in PWA. Replicate to portal opportunistically. |
| 19 | **No CI** at all (`.github/` missing). | MED | Decide whether to add minimal CI before the PWA work, or accept manual deploy verification. |
| 20 | **Private signer key (`BACKEND_SIGNER_PRIVATE_KEY`)** sits in Render env. NX PETS does NOT need this key — keep it isolated. | LOW | Don't share signer creds with the LLM-chat route. |

---

## 10. Pre-build checklist (human action items)

1. **Resolve IPFS CID** (Risk 15). Confirm canonical CID. If brief is right, fix `backend/engine/dev_generator.py:13` and `backend/engine/listener.py:203`. If code is right, update brief.
2. **Resolve stat scale** (Risk 1). Decide: keep `energy` at 0–15, or run a migration to 0–100. Migration affects 35,000 live rows and engine code.
3. **Resolve "Bugs" semantics** (Risk 2). Decide: derived `bugs_pct` field, or swap to `pc_health` for the pet bar.
4. **Approve auth strategy** (Risk 3). JWT additive vs replacing? Confirm portal calls keep working unchanged.
5. **Create accounts and obtain API keys** (none of these exist today):
   - Groq Cloud — `GROQ_API_KEY`
   - Cerebras Inference — `CEREBRAS_API_KEY`
   - Google AI Studio (Gemini) — `GEMINI_API_KEY`
   - OpenRouter (optional) — `OPENROUTER_API_KEY`
   - Mistral La Plateforme (optional) — `MISTRAL_API_KEY`
6. **Generate VAPID keys** locally; add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` to Render env on `nx-api` and `nx-engine`.
7. **Choose JWT secret** — add `PETS_JWT_SECRET` (recommend separate from any future portal JWT secret; the portal currently has none, so this is greenfield).
8. **Add `PETS_FRONTEND_ORIGIN=https://pets.nxterminal.xyz`** to Render env; whitelist in CORS.
9. **Add `CRON_SECRET`** if using any out-of-process cron (GH Actions / external pinger).
10. **DNS**: create CNAME `pets.nxterminal.xyz` → Render static-site URL.
11. **Render**: add a 4th service `pets-frontend` (static site, build `cd frontend-pets && npm run build`, publish `frontend-pets/dist`). No new worker; no new postgres; no new redis.
12. **Confirm Postgres `vector` extension availability** on Render starter plan. If unavailable, defer pgvector and use a TEXT-based memory store v1.
13. **Approve `companion_chat_messages` table name** (Risk 17) so the build plan doesn't collide with engine partitions.
14. **No Solidity changes required** — confirm explicitly that NX PETS launches with zero contract changes.
15. **DB migrations to run on portal DB** (single transaction):
    - `ALTER TABLE players ADD COLUMN active_dev_id INTEGER REFERENCES devs(token_id);`
    - `CREATE TABLE pair_codes (...)`
    - `CREATE TABLE push_subscriptions (...)`
    - `CREATE TABLE companion_chat_messages (...)`
    - `CREATE EXTENSION IF NOT EXISTS vector;` *(if approved at step 12)*
    - `CREATE TABLE dev_memories (...)`
    - `CREATE TABLE notif_templates (...)`
    - `CREATE TABLE ai_usage (...)`
    Pattern: append to `_run_auto_migrations()` in `backend/api/main.py` (idempotent `IF NOT EXISTS`), matching the existing convention.

---

## 11. Recommended build order (14-day stub, topological)

1. **Day 1** — Approve §10 decisions; freeze JWT shape; pick IPFS CID; pick `companion_chat_messages` name.
2. **Day 1-2** — DB migration PR: 7 new tables + `players.active_dev_id`, applied via `_run_auto_migrations()`.
3. **Day 2-3** — Auth foundation: JWT issuance lib (PyJWT), middleware accepting Bearer alongside body-`player_address`, mounted on existing routes additively.
4. **Day 3-4** — `POST /api/companion/pair` (portal-side, requires connected wallet) + `POST /api/companion/redeem` (PWA-side, returns JWT) + `GET /api/companion/me`.
5. **Day 4-5** — Scaffold new Vite app `frontend-pets/`, `vite-plugin-pwa` + Workbox + manifest + iOS-16.4 PWA quirks. `/pair` route + Active Companion HOME.
6. **Day 5-7** — Wire PWA STATS tab to existing `GET /api/devs/{id}`. Lift stat-bar from `DevProfile.jsx` into shared component. IPFS gateway fallback chain.
7. **Day 7-8** — Wire ACTIONS to existing `/api/shop/buy` and `/api/shop/hack-*` (no new endpoints). Confirm portal still works with same payloads.
8. **Day 8-10** — LLM cascade service (`backend/services/llm.py`): Groq → Cerebras → Gemini → OpenRouter, with `ai_usage` quota tracking. `POST /api/companion/chat/:tokenId` + `GET ...` history.
9. **Day 10-11** — pgvector + `dev_memories` + nightly memory-consolidation thread in `nx-engine`.
10. **Day 11-12** — Web Push: VAPID, `push_subscriptions`, subscribe/unsubscribe endpoints, dispatcher thread in `nx-engine` (every 15 min, scans active companions).
11. **Day 12-13** — Notification template generator (weekly thread). Hook ownership-revoke into existing `Transfer` listener.
12. **Day 13** — CORS allow PWA origin, Render static-site DNS, smoke tests on staging URL (manual; no staging env exists).
13. **Day 14** — Polish, sound, animations, ship.

---

## 12. Open questions for the human

1. **IPFS CID** — code says `bafybeibax74y4go2ygcj5ukuk2jc46duiwxbu73v4g4lataigy23cfuema`, brief says `bafybeicz5ilcu6i36ljkacix37c4r3qrtrpjhwgylp2buxfea443cxc7i4`. Which is canonical?
2. **`energy` scale**: keep 0–15 (cheap, requires PWA UI to scale to 100% on display) or migrate to 0–100 (touches every engine cycle and 35,000 rows)?
3. **"Bugs" stat**: derive `bugs_pct = LEAST(100, bugs_shipped)`, or swap to `pc_health` for the pet UX?
4. **Auth migration mode**: additive (existing body-wallet routes still work, new routes also accept JWT) or hard-cutover (everything goes JWT, portal frontend updates in lockstep)? Brief favors mirror, but the portal's lack of any signature today is its own latent issue.
5. **Endpoint versioning**: introduce `/api/v1/...` prefix before NX PETS goes live? Cheap insurance against a future breaking change.
6. **Render postgres `vector` extension** availability on starter plan — verify, or defer pgvector to phase 2?
7. **Active Companion table location**: `players.active_dev_id` (recommended; `players` is already keyed by wallet) or a new `companion_users` table (cleaner separation, more typing)?
8. **Notifications channel reuse**: existing `notifications` table (`schema.sql:358-370`) is the portal inbox. Should pet push notifications also drop a row there for the in-portal inbox, or stay PWA-only?
9. **Realtime sync**: PWA polls every 15s on focus + revalidate-on-action — is that acceptable, or do we want a per-user SSE channel?
10. **`chat_messages` rename**: confirm we can use `companion_chat_messages` (or another name) so we don't collide with the existing partitioned table.
11. **Burn-on-feed**: brief mentions "(existing) `$NXT.burn()` for paid feeds" — but feeds today only deduct from the dev's in-game `balance_nxt` (off-chain). Does NX PETS introduce on-chain burns, or stay off-chain like the portal?
12. **MOSS visibility on PWA** — portal currently hides MOSS (`SHOW_MOSS_WALLET=false`). Should the PWA's pair-init flow show it?
13. **CI**: is the absence of `.github/workflows/` deliberate, or do we add minimal CI as part of this work?
14. **Brief mentions "Mistrial Systems × Skill Module DEPLOY/AUDIT/BRIDGE/BROADCAST/ARBITRAGE/INFILTRATE"** for AI personalities — none of these names appear in `corporation_enum` (which has 6 corps as expected) or anywhere else in the code. Where do the Skill Modules come from? Are they a NEW frontend-only concept for NX PETS?

---
*End of audit. No code modifications were made beyond creating this file.*
