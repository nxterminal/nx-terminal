# STEP 1 — Stack & Structure (Auditoría $NXT, solo lectura)

## 1. Estructura del repo

```
nx-terminal/
├── .env.example
├── .gitignore
├── README.md
├── render.yaml
├── runtime.txt
├── CLAIM_SETUP.md
├── CLAUDE_CODE_FRONTEND_INSTRUCTIONS.md
├── DB_STATUS.md
├── ECONOMY_ANALYSIS.md
├── ECONOMY_FLOW.md
├── MEGAETH_AUDIT_REPORT.md
├── MIGRATION_COMPLETE.md
├── NX_TERMINAL_PRESENTACION_ES.md
├── NX_TERMINAL_PRESENTATION.md
├── NX_TERMINAL_REPORT.md
├── PROGRAMS_AUDIT.md
├── SIMULATION_DIAGNOSIS.md
├── TIER_SYSTEM_ANALYSIS.md
├── WALLET_ANALYSIS.md
├── WALLET_TIERS_COMPLETE.md
├── backend/
│   ├── __init__.py
│   ├── requirements.txt
│   ├── api/         (FastAPI app: main.py, deps.py, rate_limit.py, auth/, routes/, ws/)
│   ├── db/          (schema.sql + migration_*.sql + init_db.py + setup.sh)
│   ├── engine/      (engine.py, listener.py, claim_sync.py, run_all.py, run_engine.py, config.py, dev_generator.py, prompt_system.py, templates.py, test_engine.py)
│   └── scripts/     (backfill_funds.py)
├── contracts/
│   ├── NXDevNFT_v4.sol
│   └── NXTToken_v3.sol
└── frontend/
    ├── .env.example
    ├── .gitignore
    ├── README.md
    ├── eslint.config.js
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    └── src/         (App.jsx, main.jsx, components/, windows/, services/, hooks/, contexts/, config/, utils/)
```

## 2. Stack técnico

**Python**: 3.11.11 (`runtime.txt`; el archivo está en UTF-16 BOM, valor decodificado = `python-3.11.11`).

**Backend** (de `backend/requirements.txt`):
- Framework: **FastAPI 0.115.6** + `uvicorn[standard] 0.34.0`
- ORM/DB driver: **psycopg2-binary 2.9.10** (sin ORM; queries SQL crudos sobre Postgres)
- Cache/Pub-Sub: **redis 5.2.1**
- Validación: **pydantic 2.10.4**
- HTTP cliente: **httpx 0.28.1**, **requests 2.31.0**
- WebSocket: **websockets 14.1**
- Config: **python-dotenv 1.0.1**

**On-chain**:
- **NO usa web3.py.** El listener (`backend/engine/listener.py`) hace JSON-RPC crudo vía `requests` y el sync de claimables (`backend/engine/claim_sync.py`) usa `httpx` + `eth_account` + `eth_abi` + `eth_utils`.
- Firma: **eth-account >=0.13.0** (en requirements). `eth_abi` y `eth_utils` se importan en `claim_sync.py` pero NO aparecen explícitos en `requirements.txt` — se asume que entran como transitivos de `eth-account`.

**Frontend** (de `frontend/package.json`):
- React 19.2 + Vite 7.3
- Wallet/RPC: **viem ^2.46.2**, **wagmi ^3.5.0**
- @tanstack/react-query ^5.90.21, recharts ^2.15.3, lucide-react ^0.577.0
- (extras de UI retro: clippyjs, jquery, js-dos)

## 3. Entry points

- **API**: `backend/api/main.py` → `app = FastAPI(...)` con lifespan que (a) inicia pool DB, (b) corre `_run_auto_migrations()` (ALTER/CREATE IF NOT EXISTS + seeds + broadcasts), (c) inicia Redis. Routers en `backend/api/routes/*` + `backend/api/ws/feed.py`.
- **Worker (engine + listener)**: `backend/engine/run_all.py` arranca dos loops:
  - Thread daemon: `listener.run_listener()` (poll JSON-RPC de eventos `Transfer` del NFT en MegaETH; `backend/engine/listener.py`).
  - Main thread: `engine.run_engine()` (simulación; `backend/engine/engine.py`).
  - Ambos con auto-restart a 10 s en excepción.
- **Worker alternativo** (no referenciado en `render.yaml`): `backend/engine/run_engine.py` (solo engine, sin listener).
- **Sync de claimables on-chain**: `backend/engine/claim_sync.py` — invocado desde el engine y desde rutas (`/api/claim-sync/*`); no hay servicio cron dedicado en el deploy.
- **No hay crons separados** definidos en `render.yaml`. La cadencia es interna del engine (loops + intervalos).
- **Scripts one-shot** (no en deploy): `backend/scripts/backfill_funds.py`, `backend/db/init_db.py`, `backend/db/setup.sh`.

## 4. Deploy (`render.yaml`)

Servicios:

| Servicio | Tipo | Plan | Comando de arranque |
|---|---|---|---|
| `nx-db` | postgres (db) | starter | (gestionado por Render, Postgres 15, db = `nxterminal`) |
| `nx-redis` | redis | free | (gestionado, `maxmemoryPolicy: allkeys-lru`) |
| `nx-api` | web (python) | starter (region ohio) | `uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT --workers 8` (build: `pip install -r backend/requirements.txt`, healthcheck `/health`) |
| `nx-engine` | worker (python) | starter (region ohio) | `python -m backend.engine.run_all` (build: `pip install -r backend/requirements.txt`) |

Env vars inyectadas por Render (mismas en `nx-api` y `nx-engine`, **nombres solamente**):
- `PYTHONPATH` (literal: `.`)
- `NX_DB_HOST`, `NX_DB_PORT`, `NX_DB_NAME`, `NX_DB_USER`, `NX_DB_PASS` (de la DB `nx-db`)
- `NX_DB_SCHEMA` (literal: `nx`)
- `REDIS_URL` (de `nx-redis`)

**Importante**: `render.yaml` **NO declara** las vars de blockchain (`MEGAETH_RPC_URL`, `BACKEND_SIGNER_PRIVATE_KEY`, `DRY_RUN`, `CLAIM_SYNC_RPC_URL`, `CLAIM_SYNC_BATCH_SIZE`, `LISTENER_POLL_INTERVAL`, `NFT_CONTRACT_ADDRESS`, `TOKEN_CONTRACT_ADDRESS`, `CHAIN_ID`, `EXPLORER_URL`). Si están en producción, deben configurarse manualmente en el dashboard de Render (no pude determinar su estado real desde el repo).

No hay `Procfile` ni `Dockerfile`.

## 5. Variables de entorno

De `.env.example` (raíz) y `frontend/.env.example`, más los `os.getenv(...)` rastreados en código:

**Base de datos**
- `NX_DB_HOST`, `NX_DB_PORT`, `NX_DB_NAME`, `NX_DB_USER`, `NX_DB_PASS`, `NX_DB_SCHEMA`
- `DATABASE_URL` (alternativa: si está, se parsea y popula los `NX_DB_*` — usado por `run_all.py`, `run_engine.py`, `listener.py`, `scripts/backfill_funds.py`)

**Cache**
- `REDIS_URL`

**Wallet / private keys**
- `BACKEND_SIGNER_PRIVATE_KEY` (usado por `backend/engine/claim_sync.py` y leído por `backend/api/routes/simulation.py` para reportar si está configurado). **Vive en**: `.env` local (slot vacío en `.env.example`) y debería estar en el dashboard de Render para `nx-engine`. **No leído**: en este reporte no se muestra valor.

**RPC endpoints / on-chain**
- `MEGAETH_RPC_URL` (usado en `listener.py`, `claim_sync.py`, `engine.py`, `routes/shop.py`, `routes/sentinel.py`, `routes/devs.py`, `scripts/backfill_funds.py`)
- `CLAIM_SYNC_RPC_URL` (override opcional para el sync de claimables)
- `CHAIN_ID` (en `.env.example` = `4326`; el código lo trata como constante `MEGAETH_CHAIN_ID = 4326`)
- `EXPLORER_URL`
- `NFT_CONTRACT_ADDRESS`, `TOKEN_CONTRACT_ADDRESS` (en `.env.example`; en código las direcciones están **hardcoded** en `claim_sync.py` y `listener.py` — duplicación de fuente de verdad)

**Tuning del engine/listener/sync**
- `DRY_RUN` (default `"true"`; cuando es `false`, `claim_sync` envía tx reales)
- `CLAIM_SYNC_BATCH_SIZE` (default `200`)
- `LISTENER_POLL_INTERVAL` (default `5` s)

**Frontend**
- `VITE_API_URL` (URL del backend; default local `http://localhost:8000`)

**APIs externas**: no se detectaron env vars para terceros (sin OpenAI/Anthropic/SendGrid/Stripe/etc. en el repo).

---

## Notas

- **El stack on-chain evita web3.py**: todo se hace con JSON-RPC crudo (`requests`/`httpx`) + `eth_account` para firma + `eth_abi`/`eth_utils` (transitivos) para encoding/keccak. Esto reduce dependencias pero implica que la auditoría debe verificar manualmente la construcción de tx, ABI selectors y manejo de nonce/gas (no lo abordo en este paso).
- **`DRY_RUN` por defecto = `true`**: si la env var no se setea explícitamente a `"false"` en Render, el sync de claimables NO firma ni envía nada — verificar en producción.
- **Direcciones de contratos duplicadas**: aparecen tanto en `.env.example` (`NFT_CONTRACT_ADDRESS`, `TOKEN_CONTRACT_ADDRESS`) como hardcoded en `backend/engine/claim_sync.py:27-28` y `backend/engine/listener.py:25`. Riesgo de divergencia si se rota un contrato.
- **Auto-migraciones en cada arranque del API** (`backend/api/main.py:25-344`): el lifespan ejecuta múltiples `ALTER TABLE`, `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`, seeds de `achievements` y `vip_testers`, y broadcasts one-shot gateados por `system_broadcasts`. **Hardcodea wallets de testers** (16 direcciones en `_VIP_TESTERS`) y un broadcast de "fund reconciliation" con dos wallets receptoras y montos (60 y 100 $NXT). Esto mezcla migración, seed y operación de negocio en el path de startup — relevante para el audit económico.
- **`render.yaml` no declara las vars de blockchain**, así que no se puede verificar desde el repo qué RPC, signer o flags corren en producción. No pude determinar los valores reales sin acceso al dashboard.
- **Sin Alembic / framework de migraciones**: las "migraciones" son SQL planos en `backend/db/migration_*.sql` + el bloque `_run_auto_migrations` en `main.py`. No hay versionado ni rollback declarado.
- **`runtime.txt` está en UTF-16** (con BOM) — Render espera UTF-8; podría romper la pin de Python en algunos entornos. Worth verificar.
- **`backend/api/auth/`** solo contiene `__init__.py` vacío — no hay middleware/dependencia de autenticación por sesión (el auth es por wallet address en cada request, a confirmar en pasos posteriores).
- Frontend con `wagmi ^3.5.0` + `viem ^2.46.2`: la combinación es válida pero wagmi 3.x usa `@wagmi/core` v1; vale auditar el flujo de firma cliente cuando lleguemos al paso correspondiente.

---

**Paso 1 listo.** No ejecuté ningún otro paso.
