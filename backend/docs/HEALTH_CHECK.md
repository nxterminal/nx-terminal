# Health Check Behavior

The API exposes two health endpoints. Deploy-time probes (Render) and
external uptime monitors should target `/health`; anything that just
needs a cheap liveness probe can hit `/health/shallow`.

## `/health` (deep check)

Validates four subsystems on each call:

| Check         | What it does                                               | Severity |
| ------------- | ---------------------------------------------------------- | -------- |
| `db`          | `SELECT 1` via the DB pool                                 | critical |
| `signer_key`  | Validates `BACKEND_SIGNER_PRIVATE_KEY` format (no network) | critical |
| `rpc`         | `eth_blockNumber` with 5s timeout                          | warning  |
| `signer_gas`  | `eth_getBalance` ≥ `MIN_SIGNER_ETH_WEI` (0.001 ETH)        | warning  |

### Response matrix

| Situation                                | Status | Body                                                         |
| ---------------------------------------- | ------ | ------------------------------------------------------------ |
| All four checks pass                     | 200    | `{"ok": true, "checks": {...}}`                              |
| A warning check fails, criticals OK      | 200    | `{"ok": false, "warnings": [...], "checks": {...}}`          |
| A critical check fails (db / signer_key) | 503    | `{"ok": false, "critical_failure": true, "checks": {...}}`   |

### Rationale

- **Critical failures** (`db`, `signer_key`) **warrant auto-restart**.
  Render treats 503 on the health check as a signal to recycle the
  instance. If the DB pool is dead or the signer key is malformed, a
  fresh process is the fastest path back to service.
- **Warning-level failures** (`rpc`, `signer_gas`) **do not 503**.
  - RPC timeouts are usually transient upstream problems at MegaETH;
    restarting the process doesn't help and only amplifies the blast
    radius during an RPC incident.
  - Low signer gas needs a human to refill the signer wallet, not a
    process bounce.

  Both surface on `/admin/economy/summary` as alerts so operators
  notice without a pager page.

## `/health/shallow`

Returns `{"ok": true}` unconditionally. Preserved so anything that was
polling the old shallow `/health` (external uptime checks, accidental
scrapers) keeps getting 200s without exercising DB / RPC on every hit.

## Production wiring

- `render.yaml` → `healthCheckPath: /health` for the `nx-api` service.
  Render fails the deploy and will auto-restart on 503s.
- The worker (`nx-engine`) has no HTTP listener; its health is
  observable indirectly via `/admin/economy/summary` (`salary_batches_7d`
  shows that the tick loop is alive).
