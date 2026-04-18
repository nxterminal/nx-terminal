# Paso 6a — Plan de integración NX_FUTURES: Base económica (Fases 0-4)

## Principios rectores

1. **Zero-downtime obligatorio.** Todo cambio debe poder mergearse sin que los users vean diferencia. Si un fix rompe UX aunque sea brevemente, se posterga hasta poder hacerlo invisible.

2. **Shadow-first.** Sistemas nuevos (ledger, service layer) corren en paralelo al viejo, escribiendo a los dos, antes de migrar lecturas. Esto permite validar durante semanas antes de depender del nuevo.

3. **Feature flags sobre todo.** Cada cambio significativo va detrás de un flag leído de env var. Permite activar gradualmente y rollback instantáneo sin redeploy.

4. **PRs chicos, mergeables en menos de 30 min de review.** Nunca un PR de 2000 líneas. Mejor 20 PRs de 100 líneas.

5. **Tests antes del fix.** Antes de arreglar cualquier bug, escribimos test que lo reproduce. Después el fix. Después el test pasa.

6. **Los users actuales no se enteran.** No pop-ups, no migraciones visibles, no modo mantenimiento.

7. **Solidez sobre velocidad.** NX_FUTURES se construye DESPUÉS de refactorizar la base económica.

---

## Resumen del roadmap

- **Fase 0** — Hotfix crítico inmediato HACK_RAID (1 línea, 1 PR)
- **Fase 1** — Observabilidad (5 PRs, ~2-3 noches)
- **Fase 2** — Hotfixes críticos restantes (6 PRs, ~3-4 noches)
- **Fase 3** — Ledger shadow mode (15 PRs, ~1 semana)
- **Fase 4** — Service layer centralizado (14 PRs, ~1 semana)
- **Fase 5** — Frontend refactor (ver Paso 6b)
- **Fase 6** — NX_FUTURES construcción (ver Paso 6b)
- **Fase 7** — On-chain hardening (ver Paso 6b)

---

## FASE 0 — Hotfix inmediato HACK_RAID

**Objetivo**: cerrar el bug de inflación activo en HACK_RAID. 1 línea de cambio, riesgo mínimo, impacto económico inmediato.

**Duración estimada**: 1 noche.

### PR 0.1 — FOR UPDATE en HACK_RAID target

**Archivo**: `backend/api/routes/shop.py` línea 685

**Cambio**:
```python
# Antes
cur.execute(
    "SELECT ... FROM devs WHERE corporation != %s AND status = 'active' "
    "ORDER BY RANDOM() LIMIT 1",
    (attacker_corp,)
)

# Después
cur.execute(
    "SELECT ... FROM devs WHERE corporation != %s AND status = 'active' "
    "ORDER BY RANDOM() LIMIT 1 FOR UPDATE",
    (attacker_corp,)
)
```

**Test antes del fix**: crear `backend/tests/test_hack_raid_concurrency.py` que simula dos raids paralelas al mismo target con 100 NXT de balance. Test verifica que `total_stolen <= original_balance`.

**Test después del fix**: mismo test pasa.

**Rollback plan**: revert del commit. Sin efectos colaterales.

**Done cuando**: PR mergeado, test de concurrencia pasa, 0 usuarios reportan raids lentas.

---

## FASE 1 — Observabilidad

**Objetivo**: saber qué está pasando en el sistema hoy antes de cambiar nada más. Sin esto, los fixes son a ciegas.

**Duración estimada**: 2-3 noches (5 PRs).

**Regla**: cero cambios de comportamiento. Solo agregar visibilidad.

### PR 1.1 — Structured logging con correlation IDs

**Cambio**: de `logger.info("message")` a `logger.info("message", extra={"event": "...", "wallet": "..."})`.

**Middleware nuevo**: `backend/api/middleware/correlation.py` genera un `correlation_id` UUID por request, lo adjunta al request state, y lo propaga en todos los logs de ese request.

**Archivos tocados**:
- `backend/engine/claim_sync.py` — todos los `logger.info/warning/error`
- `backend/api/routes/players.py` — endpoints económicos
- `backend/api/routes/shop.py` — endpoints económicos
- `backend/api/routes/missions.py` — endpoints económicos
- `backend/api/routes/simulation.py` — endpoints económicos

**Done cuando**: todos los logs económicos tienen `wallet_address` y `correlation_id`.

**Test**: grep en logs de Render por wallet específico retorna flujo completo de su sesión.

### PR 1.2 — Tabla admin_logs append-only

**Migration**: `backend/db/migrations/XXX_admin_logs.sql`

```sql
CREATE TABLE admin_logs (
  id BIGSERIAL PRIMARY KEY,
  correlation_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  wallet_address VARCHAR(42),
  dev_token_id BIGINT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_wallet ON admin_logs(wallet_address, created_at DESC);
CREATE INDEX idx_admin_logs_correlation ON admin_logs(correlation_id);
CREATE INDEX idx_admin_logs_event ON admin_logs(event_type, created_at DESC);
```

**Función helper**: `backend/services/admin_log.py`

```python
def log_event(
    cursor,
    event_type: str,
    wallet_address: str = None,
    dev_token_id: int = None,
    payload: dict = None,
    correlation_id: str = None
):
    cursor.execute("""
        INSERT INTO admin_logs (correlation_id, event_type, wallet_address, dev_token_id, payload)
        VALUES (%s, %s, %s, %s, %s)
    """, [correlation_id, event_type, wallet_address, dev_token_id, json.dumps(payload) if payload else None])
```

**Callsites a agregar** (no modifican comportamiento, solo logean):
- Al entrar a `/claim-sync/force` → `event_type='claim_sync_requested'`
- Después de firmar tx de sync → `event_type='claim_sync_tx_sent'`
- Al entrar a `/record-claim` → `event_type='record_claim_received'`
- Al completar mission claim → `event_type='mission_claimed'`
- Al completar shop purchase → `event_type='shop_purchased'`
- Al ejecutar HACK_RAID → `event_type='hack_raid_executed'`
- Al correr pay_salaries del engine → `event_type='salary_batch_paid'`

**Done cuando**: 7 días de uso normal generan al menos 1000 rows en admin_logs.

**Test**: `SELECT event_type, COUNT(*) FROM admin_logs WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY 1` retorna distribución realista.

### PR 1.3 — Endpoint admin `/admin/economy/summary`

**Archivo nuevo**: `backend/api/routes/admin.py`

```python
@router.get("/admin/economy/summary")
async def economy_summary(request: Request):
    """
    Endpoint de diagnóstico económico. Solo accesible desde ADMIN_WALLETS.
    """
    wallet = request.headers.get("X-Admin-Wallet", "").lower()
    if wallet not in ADMIN_WALLETS:
        raise HTTPException(403)
    
    with get_db() as conn:
        with conn.cursor() as cur:
            # DB balance total
            cur.execute("SELECT COALESCE(SUM(balance_nxt), 0) FROM devs")
            db_balance = cur.fetchone()[0]
            
            # Claims últimas 24h
            cur.execute("""
                SELECT COUNT(*), COALESCE(SUM(amount_net), 0)
                FROM claim_history
                WHERE claimed_at > NOW() - INTERVAL '24 hours'
            """)
            claims_24h = cur.fetchone()
    
    # On-chain lookups
    signer_eth = rpc_call("eth_getBalance", [SIGNER_ADDRESS, "latest"])
    signer_nonce_latest = int(rpc_call("eth_getTransactionCount", [SIGNER_ADDRESS, "latest"]), 16)
    signer_nonce_pending = int(rpc_call("eth_getTransactionCount", [SIGNER_ADDRESS, "pending"]), 16)
    
    # Alerts
    alerts = []
    if int(signer_eth, 16) < 10**15:  # < 0.001 ETH
        alerts.append("signer_eth_low")
    if signer_nonce_pending - signer_nonce_latest > 3:
        alerts.append("signer_stuck_nonce")
    if os.getenv("DRY_RUN", "true").lower() != "false":
        alerts.append("dry_run_enabled")
    
    return {
        "circulation": {
            "db_balance_nxt_sum": db_balance,
        },
        "signer": {
            "address": SIGNER_ADDRESS,
            "eth_balance_wei": int(signer_eth, 16),
            "nonce_latest": signer_nonce_latest,
            "nonce_pending": signer_nonce_pending,
            "nonce_gap": signer_nonce_pending - signer_nonce_latest,
        },
        "recent_claims": {
            "last_24h_count": claims_24h[0],
            "last_24h_volume_nxt": claims_24h[1],
        },
        "alerts": alerts,
        "dry_run": os.getenv("DRY_RUN", "true").lower() != "false",
    }
```

**Done cuando**: podés abrir ese endpoint y saber en 10 segundos si el sistema está sano.

### PR 1.4 — DRY_RUN explícito en render.yaml (CONDICIONAL)

**Pre-requisito**: verificar estado actual de `DRY_RUN` en prod.

Validación previa:
1. Dashboard Render → service nx-engine → Environment → buscar `DRY_RUN`
2. Visitar `https://tu-backend.onrender.com/api/claim-sync/status` → campo `dry_run`
3. Query a DB: `SELECT COUNT(*) FROM claim_history WHERE claimed_at > NOW() - INTERVAL '7 days'` → si hay claims recientes, sync funciona

**Caso A — DRY_RUN=false confirmado en prod**:
Agregar a `render.yaml`:
```yaml
envVars:
  - key: DRY_RUN
    value: "false"
```
Zero-risk, solo formaliza lo ya existente.

**Caso B — DRY_RUN=true en prod**:
NO agregar a render.yaml aún. Investigar primero:
- ¿Está en modo testing deliberado?
- ¿Hay balances acumulados sin sincronizar?
- Si se activa sync, ¿el signer tiene ETH suficiente?
- Coordinar con admin para evento de "activación" controlado

**Done cuando**: estado de DRY_RUN documentado en README del proyecto y declarado explícitamente en render.yaml.

### PR 1.5 — Health check profundo

**Archivo**: `backend/api/routes/health.py`

Reemplazar `/health` actual por:

```python
@router.get("/health")
async def health():
    checks = {
        "db": False,
        "signer_key_valid": False,
        "rpc_reachable": False,
        "signer_has_gas": False,
    }
    errors = []
    
    # DB check
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                checks["db"] = True
    except Exception as e:
        errors.append(f"db: {e}")
    
    # Signer key check
    try:
        from eth_account import Account
        if os.getenv("BACKEND_SIGNER_PRIVATE_KEY"):
            Account.from_key(os.getenv("BACKEND_SIGNER_PRIVATE_KEY"))
            checks["signer_key_valid"] = True
    except Exception as e:
        errors.append(f"signer: {e}")
    
    # RPC check
    try:
        block = rpc_call("eth_blockNumber", [], timeout=5)
        checks["rpc_reachable"] = bool(block)
    except Exception as e:
        errors.append(f"rpc: {e}")
    
    # Signer gas check
    try:
        balance_hex = rpc_call("eth_getBalance", [SIGNER_ADDRESS, "latest"])
        checks["signer_has_gas"] = int(balance_hex, 16) > 10**15
    except Exception as e:
        errors.append(f"gas: {e}")
    
    all_ok = all(checks.values())
    status_code = 200 if all_ok else 503
    
    return JSONResponse(
        status_code=status_code,
        content={"ok": all_ok, "checks": checks, "errors": errors}
    )
```

Actualizar `render.yaml`:
```yaml
healthCheckPath: /health
```

**Done cuando**: Render detecta signer drenado automáticamente y marca el service degraded.

---

## FASE 2 — Hotfixes críticos restantes

**Objetivo**: cerrar los 5 bugs críticos de seguridad restantes sin cambiar UX visible.

**Duración estimada**: 3-4 noches (6 PRs).

### PR 2.1 — Auth bypass en /claim-sync/force

**Archivo**: `backend/api/routes/simulation.py` función `force_claim_sync`

**Cambios**:

1. Exigir `wallet_address` en body siempre
2. Validar ownership de todos los `token_ids`
3. 403 si no coincide

```python
@router.post("/claim-sync/force")
async def force_claim_sync(request: Request):
    body = await request.json() or {}
    wallet = body.get("wallet_address", "").lower()
    filter_ids = [int(t) for t in body.get("token_ids", [])]
    
    if not wallet:
        raise HTTPException(400, "wallet_address required")
    
    # Full sync (sin token_ids): solo admins
    if not filter_ids:
        if wallet not in ADMIN_WALLETS:
            raise HTTPException(403, "Full sync requires admin wallet")
    else:
        # Partial sync: validar ownership
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT COUNT(*) FROM devs
                    WHERE token_id = ANY(%s) AND owner_wallet = %s
                """, [filter_ids, wallet])
                owned_count = cur.fetchone()[0]
                if owned_count != len(filter_ids):
                    raise HTTPException(403, "Not all token_ids belong to this wallet")
    
    # ... resto del código igual
```

**Test**: crear `backend/tests/test_claim_sync_auth.py`:
- Request sin wallet → 400
- Request con token_ids ajenos → 403
- Request legítimo → 200
- Admin full sync → 200

**Zero-downtime verification**: verificar en `frontend/src/services/api.js:152` que ya manda wallet_address en el body. Si sí, impacto cero. Si no, agregar en un PR previo al frontend.

**Done cuando**: tests pasan, frontend sigue funcionando, logs muestran rejected attempts (señal de que el bypass era explotable).

### PR 2.2 — record-claim verifica on-chain

**Archivo**: `backend/api/routes/players.py` función `record_claim`

**Migration**:
```sql
ALTER TABLE claim_history 
  ADD COLUMN tx_block BIGINT,
  ADD COLUMN status TEXT DEFAULT 'confirmed';

CREATE UNIQUE INDEX idx_claim_history_tx_hash_unique 
  ON claim_history(tx_hash) WHERE tx_hash IS NOT NULL;
```

**Código nuevo**:

```python
@router.post("/{wallet}/record-claim")
async def record_claim(wallet: str, req: RecordClaimRequest):
    wallet = wallet.lower()
    
    # 1. Idempotencia
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM claim_history WHERE tx_hash = %s", [req.tx_hash])
            if cur.fetchone():
                return {"ok": True, "status": "already_recorded"}
    
    # 2. Fetch receipt on-chain
    try:
        receipt = rpc_call("eth_getTransactionReceipt", [req.tx_hash])
    except Exception as e:
        raise HTTPException(400, f"Could not fetch receipt: {e}")
    
    if not receipt:
        raise HTTPException(400, "Transaction not confirmed yet")
    
    if receipt.get("status") != "0x1":
        raise HTTPException(400, "Transaction reverted")
    
    # 3. Parse event NXTClaimed
    event = parse_nxt_claimed_event(receipt.get("logs", []))
    if not event:
        raise HTTPException(400, "Tx does not contain NXTClaimed event")
    
    if event["user"].lower() != wallet:
        raise HTTPException(400, "Tx does not match wallet")
    
    # 4. Insert con valores del evento
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO claim_history 
                (player_address, amount_gross, amount_net, fee_amount, 
                 tx_hash, tx_block, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'confirmed')
                ON CONFLICT (tx_hash) DO NOTHING
            """, [
                wallet, 
                event["gross"], event["net"], event["fee"],
                req.tx_hash, int(receipt["blockNumber"], 16)
            ])
            
            # Atomicidad con balance_claimed
            cur.execute("""
                UPDATE players 
                SET balance_claimed = balance_claimed + %s
                WHERE wallet_address = %s
            """, [event["net"], wallet])
            
            conn.commit()
    
    return {"ok": True, "status": "recorded"}


def parse_nxt_claimed_event(logs):
    """
    Parsea el evento NXTClaimed(address user, uint256[] tokenIds, 
    uint256 gross, uint256 fee, uint256 net) del contrato NXDevNFT.
    """
    NXT_CLAIMED_TOPIC = "0x..."  # keccak256("NXTClaimed(address,uint256[],uint256,uint256,uint256)")
    
    for log in logs:
        if log["topics"][0] == NXT_CLAIMED_TOPIC:
            user = "0x" + log["topics"][1][-40:]
            # Decode data payload (gross, fee, net)
            # ... usar eth_abi o web3.py
            return {"user": user, "gross": gross, "fee": fee, "net": net}
    
    return None
```

**Zero-downtime**: el frontend sigue enviando los mismos campos. Backend ignora los montos del request y usa los del evento. User no ve diferencia.

**Test**: `backend/tests/test_record_claim.py`:
- Tx hash inexistente → 400
- Tx hash reverted → 400
- Tx con evento pero wallet distinto → 400
- Tx legítimo → 200 + row en claim_history
- Doble POST del mismo tx_hash → 200 sin duplicar

**Done cuando**: 100% de claims nuevos tienen `status='confirmed'` y UNIQUE previene duplicados.

### PR 2.3 — Signer service con nonce lock

**Archivo nuevo**: `backend/services/signer.py`

```python
import threading
import httpx
from eth_account import Account

class SignerService:
    def __init__(self, private_key: str, rpc_url: str):
        if not private_key:
            raise ValueError("BACKEND_SIGNER_PRIVATE_KEY not set")
        self._account = Account.from_key(private_key)
        self._rpc_url = rpc_url
        self._nonce_lock = threading.Lock()
        self._cached_nonce = None
    
    @property
    def address(self):
        return self._account.address
    
    def get_eth_balance(self) -> int:
        resp = self._rpc("eth_getBalance", [self.address, "latest"])
        return int(resp, 16)
    
    def sign_and_send(self, tx_params: dict, timeout: int = 30) -> dict:
        """
        Firma y envía un tx. Thread-safe con respecto al nonce.
        Espera receipt hasta timeout segundos.
        
        Returns: {"tx_hash": str, "receipt": dict | None}
        """
        with self._nonce_lock:
            # Usar "pending" para considerar txs in-flight
            nonce = self._get_nonce_safe()
            
            tx_params["nonce"] = nonce
            tx_params["from"] = self.address
            
            signed = self._account.sign_transaction(tx_params)
            tx_hash = self._rpc("eth_sendRawTransaction", 
                                ["0x" + signed.raw_transaction.hex()])
            
            self._cached_nonce = nonce + 1
        
        # Wait receipt afuera del lock (no bloquear otros signers)
        receipt = self._wait_receipt(tx_hash, timeout)
        
        return {"tx_hash": tx_hash, "receipt": receipt}
    
    def _get_nonce_safe(self) -> int:
        nonce_hex = self._rpc("eth_getTransactionCount", [self.address, "pending"])
        nonce = int(nonce_hex, 16)
        if self._cached_nonce is not None and self._cached_nonce > nonce:
            nonce = self._cached_nonce
        return nonce
    
    def _rpc(self, method, params, timeout=15):
        resp = httpx.post(self._rpc_url, json={
            "jsonrpc": "2.0", "id": 1,
            "method": method, "params": params
        }, timeout=timeout)
        data = resp.json()
        if "error" in data:
            raise Exception(f"RPC error: {data['error']}")
        return data["result"]
    
    def _wait_receipt(self, tx_hash, timeout):
        import time
        start = time.time()
        while time.time() - start < timeout:
            try:
                receipt = self._rpc("eth_getTransactionReceipt", [tx_hash])
                if receipt:
                    return receipt
            except Exception:
                pass
            time.sleep(1)
        return None


# Singleton global
_signer_instance = None

def get_signer() -> SignerService:
    global _signer_instance
    if _signer_instance is None:
        _signer_instance = SignerService(
            private_key=os.getenv("BACKEND_SIGNER_PRIVATE_KEY", ""),
            rpc_url=os.getenv("MEGAETH_RPC_URL", "https://mainnet.megaeth.com/rpc")
        )
    return _signer_instance
```

**Refactor de claim_sync.py**: reemplazar los callsites de `Account.from_key` + `eth_getTransactionCount` + `sign_transaction` por `get_signer().sign_and_send(tx_params)`.

**Test**: `backend/tests/test_signer_concurrency.py`:
- 10 threads concurrentes llamando `sign_and_send` → 10 txs con nonces secuenciales
- Simular error de RPC → retry o error limpio

**Done cuando**: test de concurrencia pasa, 0 txs rechazados por nonce collision.

### PR 2.4 — 2-phase commit en sync

**Migration**:
```sql
ALTER TABLE devs 
  ADD COLUMN sync_status TEXT,
  ADD COLUMN sync_tx_hash VARCHAR(66),
  ADD COLUMN sync_started_at TIMESTAMPTZ;

CREATE INDEX idx_devs_sync_status ON devs(sync_status) 
  WHERE sync_status IS NOT NULL;
```

**Refactor de `sync_claimable_balances` en claim_sync.py**:

```python
def sync_claimable_balances(db_conn, filter_token_ids, wait_for_receipt=True):
    signer = get_signer()
    
    # Fetch devs con balance > 0
    cursor.execute("""
        SELECT token_id, balance_nxt FROM devs
        WHERE balance_nxt > 0
          AND (sync_status IS NULL OR sync_status = 'failed')
          AND token_id = ANY(%s)
        FOR UPDATE
    """, [filter_token_ids])
    
    rows = cursor.fetchall()
    if not rows:
        return {"synced": 0, "result": "no_pending"}
    
    token_ids = [r["token_id"] for r in rows]
    amounts_wei = [r["balance_nxt"] * 10**18 for r in rows]
    
    # FASE 1: marcar como 'syncing' en DB
    tx_hash_placeholder = None
    cursor.execute("""
        UPDATE devs 
        SET sync_status = 'syncing', sync_started_at = NOW()
        WHERE token_id = ANY(%s)
    """, [token_ids])
    db_conn.commit()
    
    # FASE 2: firmar y enviar tx
    try:
        calldata = build_calldata("batchSetClaimableBalance", [token_ids, amounts_wei])
        result = signer.sign_and_send({
            "to": NXDEVNFT_ADDRESS,
            "data": calldata,
            "gas": estimate_gas(calldata),
            "gasPrice": get_gas_price(),
            "chainId": 4326,
        }, timeout=30 if wait_for_receipt else 0)
        
        tx_hash = result["tx_hash"]
        receipt = result["receipt"]
        
        # Guardar tx_hash en devs
        cursor.execute("""
            UPDATE devs SET sync_tx_hash = %s
            WHERE token_id = ANY(%s)
        """, [tx_hash, token_ids])
        db_conn.commit()
        
        if wait_for_receipt:
            if receipt and receipt.get("status") == "0x1":
                # FASE 3a: éxito, cerrar
                cursor.execute("""
                    UPDATE devs 
                    SET balance_nxt = 0, sync_status = 'synced'
                    WHERE token_id = ANY(%s) AND sync_tx_hash = %s
                """, [token_ids, tx_hash])
                db_conn.commit()
                return {"synced": len(token_ids), "tx_hash": tx_hash, "result": "ok"}
            else:
                # FASE 3b: revirtió, limpiar
                cursor.execute("""
                    UPDATE devs 
                    SET sync_status = 'failed'
                    WHERE token_id = ANY(%s)
                """, [token_ids])
                db_conn.commit()
                return {"synced": 0, "tx_hash": tx_hash, "result": "reverted"}
        else:
            # Modo async: dejar en 'syncing', worker se encarga después
            return {"synced": len(token_ids), "tx_hash": tx_hash, "result": "pending"}
    
    except Exception as e:
        # Error: limpiar sync_status
        cursor.execute("""
            UPDATE devs SET sync_status = NULL, sync_tx_hash = NULL
            WHERE token_id = ANY(%s)
        """, [token_ids])
        db_conn.commit()
        raise
```

**PR complementario — worker de reconciliación**:

```python
# backend/engine/sync_reconciler.py
def reconcile_pending_syncs():
    """
    Corre cada 60s. Para cada dev con sync_status='syncing', 
    consulta el receipt y finaliza (synced o failed).
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT sync_tx_hash 
            FROM devs 
            WHERE sync_status = 'syncing' 
              AND sync_started_at < NOW() - INTERVAL '30 seconds'
        """)
        
        for (tx_hash,) in cur.fetchall():
            try:
                receipt = rpc_call("eth_getTransactionReceipt", [tx_hash])
                if not receipt:
                    continue  # aún pending
                
                if receipt.get("status") == "0x1":
                    cur.execute("""
                        UPDATE devs 
                        SET balance_nxt = 0, sync_status = 'synced'
                        WHERE sync_tx_hash = %s AND sync_status = 'syncing'
                    """, [tx_hash])
                else:
                    cur.execute("""
                        UPDATE devs SET sync_status = 'failed'
                        WHERE sync_tx_hash = %s AND sync_status = 'syncing'
                    """, [tx_hash])
                
                conn.commit()
            except Exception as e:
                logger.error(f"reconcile_pending_syncs error for {tx_hash}: {e}")
```

**Done cuando**: si el sync revierte, `balance_nxt` NUNCA queda en 0 prematuramente.

### PR 2.5 — Event listener de NXTClaimed

**Archivo**: `backend/engine/listener.py`

Agregar listener que hace polling de `eth_getLogs` para el event `NXTClaimed` del contrato NXDevNFT:

```python
def listen_nxt_claimed():
    """
    Polling de eventos NXTClaimed para detectar claims que pueden haber 
    sido hechos por users sin pasar por el frontend (auto-reconciliation).
    """
    last_block = load_last_processed_block()
    
    while True:
        current = int(rpc_call("eth_blockNumber", []), 16)
        
        logs = rpc_call("eth_getLogs", [{
            "fromBlock": hex(last_block + 1),
            "toBlock": hex(current),
            "address": NXDEVNFT_ADDRESS,
            "topics": [NXT_CLAIMED_TOPIC]
        }])
        
        for log in logs:
            try:
                event = parse_nxt_claimed_event([log])
                # Idempotente vía UNIQUE sobre tx_hash
                with get_db() as conn:
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO claim_history 
                            (player_address, amount_gross, amount_net, fee_amount,
                             tx_hash, tx_block, status)
                            VALUES (%s, %s, %s, %s, %s, %s, 'confirmed')
                            ON CONFLICT (tx_hash) DO NOTHING
                        """, [
                            event["user"].lower(),
                            event["gross"], event["net"], event["fee"],
                            log["transactionHash"], int(log["blockNumber"], 16)
                        ])
                        conn.commit()
            except Exception as e:
                logger.error(f"NXTClaimed listener error: {e}")
        
        save_last_processed_block(current)
        time.sleep(15)
```

**Done cuando**: claims directos al contrato (sin frontend) aparecen en `claim_history` automáticamente.

### PR 2.6 — Rate limiter consistente en Redis

Reemplazar `defaultdict(float)` in-memory por Redis. Ya tenés Redis configurado (visto en deps.py) pero no usado para rate limit.

```python
# backend/api/rate_limit.py
import redis

_redis = redis.Redis.from_url(os.getenv("REDIS_URL"))

def check_rate_limit(key: str, max_per_window: int, window_seconds: int) -> bool:
    """
    Rate limiter con sliding window en Redis.
    Consistente cross-worker.
    """
    pipe = _redis.pipeline()
    now = time.time()
    pipe.zremrangebyscore(key, 0, now - window_seconds)
    pipe.zcard(key)
    pipe.zadd(key, {str(now): now})
    pipe.expire(key, window_seconds)
    results = pipe.execute()
    count = results[1]
    return count < max_per_window
```

Migrar `shop_limiter` y otros a usar este helper.

**Done cuando**: 8 workers uvicorn comparten el mismo rate limit y "1 req/s por wallet" se respeta realmente.

---

## FASE 3 — Ledger shadow mode

**Objetivo**: crear tabla `nxt_ledger` y escribir en paralelo al sistema viejo, sin leer de ella. Validar durante semanas antes de migrar lecturas.

**Duración estimada**: 1 semana (15 PRs).

### PR 3.1 — Schema de nxt_ledger

**Migration**:

```sql
CREATE TABLE nxt_ledger (
  id BIGSERIAL PRIMARY KEY,
  
  -- Actor afectado
  wallet_address VARCHAR(42) NOT NULL,
  dev_token_id BIGINT,
  
  -- Movimiento (convención: positivo=crédito, negativo=débito)
  delta_nxt BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  
  -- Origen semántico
  source TEXT NOT NULL,
  ref_table TEXT,
  ref_id BIGINT,
  
  -- Idempotencia
  idempotency_key TEXT NOT NULL UNIQUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  correlation_id UUID,
  
  -- Validación
  CHECK (delta_nxt != 0),
  CHECK (balance_after >= 0)
);

CREATE INDEX idx_ledger_wallet_time 
  ON nxt_ledger(wallet_address, created_at DESC);

CREATE INDEX idx_ledger_source_time 
  ON nxt_ledger(source, created_at DESC);

CREATE INDEX idx_ledger_dev_time 
  ON nxt_ledger(dev_token_id, created_at DESC) 
  WHERE dev_token_id IS NOT NULL;

CREATE INDEX idx_ledger_correlation 
  ON nxt_ledger(correlation_id) 
  WHERE correlation_id IS NOT NULL;
```

**Sources permitidos** (enum implícito):
- `salary` — pago horario del engine
- `mission_claim` — reward de misión
- `achievement_claim` — reward de achievement
- `streak_claim` — reward de streak diario
- `hack_mainframe_win` — crédito de HACK_MAINFRAME exitoso
- `hack_raid_attacker_win` — crédito al atacante en raid exitosa
- `hack_raid_target_loss` — débito al target en raid exitosa
- `hack_raid_attacker_loss` — débito al atacante en raid fallida
- `hack_raid_target_win` — crédito al target en raid fallida
- `transfer_out` — débito en TRANSFER dev→dev
- `transfer_in` — crédito en TRANSFER dev→dev
- `shop_purchase` — débito por compra en shop
- `fund_deposit` — crédito por depósito on-chain
- `sell_investment` — crédito por SELL del dev autónomo
- `claim_onchain` — débito cuando el user clama al wallet real
- `backfill_manual` — ajustes manuales del admin

### PR 3.2 — Función ledger_insert

**Archivo**: `backend/services/ledger.py`

```python
import json
import uuid
from typing import Optional

def ledger_insert(
    cursor,
    wallet_address: str,
    delta_nxt: int,
    source: str,
    ref_table: Optional[str] = None,
    ref_id: Optional[int] = None,
    dev_token_id: Optional[int] = None,
    correlation_id: Optional[str] = None,
) -> bool:
    """
    Inserta un movimiento en el ledger. Idempotente vía idempotency_key.
    
    No actualiza devs.balance_nxt — eso lo hace el caller.
    Solo calcula y guarda balance_after snapshot para debugging.
    
    Returns: True si se insertó, False si ya existía (idempotencia).
    """
    wallet_address = wallet_address.lower()
    idem_key = f"{source}:{ref_table}:{ref_id}:{dev_token_id}:{delta_nxt}"
    
    # Calcular balance_after: leer balance actual
    if dev_token_id is not None:
        cursor.execute(
            "SELECT balance_nxt FROM devs WHERE token_id = %s", 
            [dev_token_id]
        )
        row = cursor.fetchone()
        current = row["balance_nxt"] if row else 0
    else:
        cursor.execute("""
            SELECT COALESCE(SUM(balance_nxt), 0) as total
            FROM devs WHERE owner_wallet = %s
        """, [wallet_address])
        row = cursor.fetchone()
        current = row["total"] if row else 0
    
    new_balance = current + delta_nxt
    
    if new_balance < 0:
        raise ValueError(f"Insufficient balance: {current} + {delta_nxt} < 0")
    
    cursor.execute("""
        INSERT INTO nxt_ledger 
        (wallet_address, dev_token_id, delta_nxt, balance_after,
         source, ref_table, ref_id, idempotency_key, correlation_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
    """, [
        wallet_address, dev_token_id, delta_nxt, new_balance,
        source, ref_table, ref_id, idem_key, correlation_id
    ])
    
    return cursor.fetchone() is not None
```

### PR 3.3 a PR 3.15 — Shadow writes en 13 callsites

**Template de cambio** (por ejemplo para mission_claim):

```python
# Código existente (NO tocar)
cur.execute(
    "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s "
    "WHERE token_id = %s",
    (dev_reward, dev_reward, row["dev_token_id"])
)

# Nuevo: shadow write (protegido por feature flag)
if os.getenv("LEDGER_SHADOW_WRITE", "true").lower() == "true":
    try:
        ledger_insert(
            cursor=cur,
            wallet_address=pm["wallet_address"],
            dev_token_id=row["dev_token_id"],
            delta_nxt=dev_reward,  # positivo = crédito
            source="mission_claim",
            ref_table="player_missions",
            ref_id=row["id"],
            correlation_id=getattr(request.state, 'correlation_id', None)
        )
    except Exception as e:
        # Si shadow write falla, loguear pero NO abortar el flujo existente
        logger.error(f"ledger shadow write failed: {e}", extra={
            "event": "ledger_shadow_failed",
            "source": "mission_claim",
            "ref_id": row["id"]
        })
```

**Importante**: si el shadow write falla, se loguea pero el flujo continúa. Así el ledger no bloquea operaciones reales durante la fase de validación.

**13 PRs a crear**:

| # | Archivo | Línea aprox | Source |
|---|---------|-------------|--------|
| 3.3 | engine.py | 957 | salary |
| 3.4 | engine.py | 475 | sell_investment |
| 3.5 | shop.py | 950 | fund_deposit |
| 3.6 | engine.py | 1400 | fund_deposit (pending) |
| 3.7 | engine.py | 1578 | fund_deposit (orphan) |
| 3.8 | shop.py | 569 | hack_mainframe_win |
| 3.9 | shop.py | 714 | hack_raid_attacker_win + hack_raid_target_loss |
| 3.10 | shop.py | 774 | hack_raid_attacker_loss + hack_raid_target_win |
| 3.11 | shop.py | 1035 | transfer_out + transfer_in |
| 3.12 | missions.py | 329 | mission_claim |
| 3.13 | achievements.py | 241 | achievement_claim |
| 3.14 | streaks.py | 122 | streak_claim |
| 3.15 | backfill_funds.py | 248 | backfill_manual |

Cada PR: agrega shadow write + test que verifica que ledger refleja el UPDATE. Mergeable individualmente.

### PR 3.16 — Reconciliation job

**Archivo**: `backend/engine/ledger_reconciler.py`

```python
def reconcile_ledger():
    """
    Cada hora compara:
    - SUM(delta_nxt) per wallet en ledger
    - balance_claimable actual del player + balance_claimed + balance_total_spent
    
    Si hay divergencia, loguea alerta.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH ledger_totals AS (
                    SELECT 
                        wallet_address,
                        SUM(delta_nxt) AS ledger_sum
                    FROM nxt_ledger
                    GROUP BY wallet_address
                ),
                player_totals AS (
                    SELECT 
                        p.wallet_address,
                        COALESCE(SUM(d.balance_nxt), 0) + p.balance_claimed AS actual_total
                    FROM players p
                    LEFT JOIN devs d ON d.owner_wallet = p.wallet_address
                    GROUP BY p.wallet_address, p.balance_claimed
                )
                SELECT 
                    l.wallet_address,
                    l.ledger_sum,
                    p.actual_total,
                    l.ledger_sum - p.actual_total AS divergence
                FROM ledger_totals l
                JOIN player_totals p USING (wallet_address)
                WHERE ABS(l.ledger_sum - p.actual_total) > 0
                ORDER BY ABS(l.ledger_sum - p.actual_total) DESC
                LIMIT 100
            """)
            
            divergences = cur.fetchall()
            
            if divergences:
                # Loguear a admin_logs
                for row in divergences:
                    cur.execute("""
                        INSERT INTO admin_logs (correlation_id, event_type, wallet_address, payload)
                        VALUES (gen_random_uuid(), 'ledger_divergence_detected', %s, %s)
                    """, [
                        row["wallet_address"],
                        json.dumps({
                            "ledger_sum": row["ledger_sum"],
                            "actual_total": row["actual_total"],
                            "divergence": row["divergence"],
                        })
                    ])
                conn.commit()
                
                logger.warning(f"Ledger reconciliation found {len(divergences)} divergences")
            else:
                logger.info("Ledger reconciliation clean")
```

**Done con Fase 3 cuando**: reconciliation job corre por 7 días consecutivos sin divergencias.

---

## FASE 4 — Service layer centralizado

**Objetivo**: centralizar los 13 callsites en función única `credit_dev()`. Elimina duplicación, habilita el patrón necesario para NX_FUTURES.

**Duración estimada**: 1 semana (14 PRs).

**Pre-requisito**: Fase 3 completa con reconciliación limpia.

### PR 4.1 — Función credit_dev

**Archivo**: `backend/services/economy.py`

```python
from backend.services.ledger import ledger_insert

def credit_dev(
    cursor,
    dev_token_id: int,
    delta_nxt: int,
    source: str,
    ref_table: str = None,
    ref_id: int = None,
    correlation_id: str = None,
    update_total_earned: bool = True,
    update_total_spent: bool = False,
) -> dict:
    """
    Aplica delta al balance_nxt de un dev.
    Escribe al ledger atómicamente en la misma transacción.
    Lockea el dev con FOR UPDATE para prevenir races.
    
    Returns: {"dev_token_id", "old_balance", "new_balance", "delta", "ledger_inserted"}
    """
    # Lock del dev
    cursor.execute("""
        SELECT balance_nxt, owner_wallet, name, archetype
        FROM devs
        WHERE token_id = %s
        FOR UPDATE
    """, [dev_token_id])
    
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Dev {dev_token_id} not found")
    
    old_balance = row["balance_nxt"]
    new_balance = old_balance + delta_nxt
    
    if new_balance < 0:
        raise ValueError(
            f"Insufficient balance for dev {dev_token_id}: "
            f"{old_balance} + {delta_nxt} < 0"
        )
    
    # Update balance + total_earned/total_spent
    update_parts = ["balance_nxt = %s"]
    params = [new_balance]
    
    if update_total_earned and delta_nxt > 0:
        update_parts.append("total_earned = total_earned + %s")
        params.append(delta_nxt)
    
    if update_total_spent and delta_nxt < 0:
        update_parts.append("total_spent = total_spent + %s")
        params.append(abs(delta_nxt))
    
    params.append(dev_token_id)
    cursor.execute(
        f"UPDATE devs SET {', '.join(update_parts)} WHERE token_id = %s",
        params
    )
    
    # Ledger insert (misma transacción)
    ledger_inserted = ledger_insert(
        cursor=cursor,
        wallet_address=row["owner_wallet"],
        dev_token_id=dev_token_id,
        delta_nxt=delta_nxt,
        source=source,
        ref_table=ref_table,
        ref_id=ref_id,
        correlation_id=correlation_id,
    )
    
    return {
        "dev_token_id": dev_token_id,
        "old_balance": old_balance,
        "new_balance": new_balance,
        "delta": delta_nxt,
        "ledger_inserted": ledger_inserted,
        "dev_name": row["name"],
        "dev_archetype": row["archetype"],
    }
```

**Test**: `backend/tests/test_credit_dev.py`:
- Crédito normal → balance actualizado + ledger row
- Débito con fondos → ok
- Débito sin fondos → ValueError
- Llamada doble con mismos params → ledger inserta 1 vez (idempotencia)
- Concurrencia: 2 threads llamando credit_dev sobre mismo dev → serializan

### PR 4.2 a PR 4.14 — Migrar 13 callsites a credit_dev

**Template**:

```python
# Antes (missions.py:329)
cur.execute(
    "UPDATE devs SET balance_nxt = balance_nxt + %s, total_earned = total_earned + %s, status = 'active' "
    "WHERE token_id = %s RETURNING name, archetype",
    (dev_reward, dev_reward, row["dev_token_id"])
)
dev = cur.fetchone()
# ... shadow write del ledger de Fase 3 ...

# Después
result = credit_dev(
    cursor=cur,
    dev_token_id=row["dev_token_id"],
    delta_nxt=dev_reward,
    source="mission_claim",
    ref_table="player_missions",
    ref_id=row["id"],
    correlation_id=getattr(request.state, 'correlation_id', None),
)

# Status cambia afuera de credit_dev (no es parte del flujo económico)
cur.execute(
    "UPDATE devs SET status = 'active' WHERE token_id = %s",
    [row["dev_token_id"]]
)

dev_info = {
    "name": result["dev_name"],
    "archetype": result["dev_archetype"],
    "reward": result["delta"],
    "new_balance": result["new_balance"],
}
```

**Beneficio de cada PR**:
- Elimina ~10 líneas de código duplicado por callsite
- Los tests de ledger shadow de Fase 3 siguen pasando (idéntico resultado)
- Se elimina el shadow write ya que `credit_dev` lo hace internamente

**Orden sugerido** (más simples primero):

| # | Callsite | Complejidad |
|---|----------|-------------|
| 4.2 | streak_claim | Simple |
| 4.3 | achievement_claim | Simple |
| 4.4 | mission_claim | Simple |
| 4.5 | salary | Batch — adaptar credit_dev a batch_credit_devs |
| 4.6 | sell_investment | Simple |
| 4.7 | fund_deposit shop | Simple |
| 4.8 | fund_deposit pending | Simple |
| 4.9 | fund_deposit orphan | Simple |
| 4.10 | hack_mainframe_win | Simple |
| 4.11 | hack_raid (éxito: 2 callsites) | Medio |
| 4.12 | hack_raid (fallo: 2 callsites) | Medio |
| 4.13 | transfer (2 callsites) | Medio |
| 4.14 | backfill_manual | Simple |

### PR 4.15 — Desactivar feature flag legacy

Una vez todos los callsites migrados:

```python
# Remover el try/except y la flag LEDGER_SHADOW_WRITE
# Agregar flag nueva para deshabilitar legacy si hace falta rollback
LEGACY_BALANCE_UPDATES = os.getenv("LEGACY_BALANCE_UPDATES", "false")
```

**Done con Fase 4 cuando**: 
- Todos los callsites migrados
- `LEDGER_SHADOW_WRITE` ya no existe
- Reconciliation job corre limpio por 14 días consecutivos
- Grep `UPDATE devs SET balance_nxt` retorna solo callsites dentro de `credit_dev`

---

## Continuación

Ver `STEP_6b_integration_plan.md` para Fases 5-7 (Frontend refactor, NX_FUTURES, On-chain hardening).
