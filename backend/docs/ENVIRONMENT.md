# Environment Variables

This document catalogs the runtime environment variables consumed by the
backend. The source of truth for production values is
[`render.yaml`](../../render.yaml); this file explains what each critical
var does and why it must be set.

## Critical vars

### `DRY_RUN`

- **Values**: `"true"` (safety default in code) or `"false"`.
- **Read by**: `backend/engine/claim_sync.py` — gates every on-chain
  write (`batchSetClaimableBalance`). When `"true"` the worker logs what
  it would have sent and returns without signing or broadcasting.
- **Production requirement**: must be `"false"` so players can actually
  claim their $NXT on-chain. Declared explicitly in `render.yaml` for
  both `nx-api` and `nx-engine` so a redeploy or blueprint re-apply
  can never silently revert it to the code default.
- **Consumers**:
  - `nx-engine` — worker running `backend.engine.run_all`, which
    ultimately calls `claim_sync.sync_claimable_balances`.
  - `nx-api` — exposes `POST /api/claim-sync/force` and calls the same
    `sync_claimable_balances`, so the API process must see the same
    value as the worker.

### `BACKEND_SIGNER_PRIVATE_KEY`

- **Read by**: `backend/engine/claim_sync.py`.
- **Required when `DRY_RUN=false`**: without it the sync aborts with
  `error_no_signer_key`.
- **Render**: set via dashboard (`sync: false` would be added here if
  this key were ever added to `render.yaml`; today it is managed purely
  via the Render secrets UI).

### `DATABASE_URL` / `NX_DB_*`

- Either a single `DATABASE_URL` or the five `NX_DB_HOST`, `NX_DB_PORT`,
  `NX_DB_NAME`, `NX_DB_USER`, `NX_DB_PASS` variables must be present.
- `render.yaml` wires the `NX_DB_*` set from the `nx-db` database.

### `NX_DB_SCHEMA`

- Postgres search_path. Defaults to `"nx"`; set explicitly in
  `render.yaml` to avoid relying on the default.

### `REDIS_URL`

- Used by `backend/api/deps.py` for pub/sub and cache. Optional — the
  API runs without cache if unreachable, but pub/sub for WebSocket
  broadcast is degraded.

## Verifying in production

Hit `GET /api/admin/economy/summary` with `X-Admin-Wallet: <treasury>`:

```json
{
  "config": {"dry_run": false},
  "signer": {
    "address": "0x…",
    "eth_balance_wei": 50000000000000000,
    ...
  },
  "alerts": []
}
```

`alerts` flags `DRY_RUN enabled — no on-chain syncs happening` (severity
`info`) whenever `DRY_RUN` is anything other than `"false"`. If that
alert ever appears in production, check the env var on both services.

## Full list

See `render.yaml` for the complete list of variables and where each one
gets its value (database, redis service, or static string).
