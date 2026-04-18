# Paso 4 — Sistema de Claim y Backend Signer

## Resumen ejecutivo

El flujo de claim involucra 3 etapas: sync (backend firma), claim 
on-chain (user firma con MetaMask), record-claim (frontend reporta 
al backend). Funcional en happy path. En failure modes, el sistema 
es frágil y deja saldos huérfanos sin mecanismo de recuperación.

Hallazgos más serios:
- Auth bypass en /claim-sync/force permite zeroar balance ajeno
- wait_for_receipt=False + _mark_synced inmediato = lost funds si tx revierte
- record-claim confía en datos del frontend sin verificar on-chain
- Backend signer con 11 funciones privilegiadas, gestión sin HSM
- Race conditions en nonce, cross-worker, y claim simultáneo
- Cero observabilidad, cero retry automático, cero reconciliación

## 4.1 Arquitectura del claim (3 etapas)

### Etapa 1 — Backend sync
- Endpoint: POST /api/claim-sync/force (simulation.py:112)
- Backend firma batchSetClaimableBalance(ids, amounts) con 
  BACKEND_SIGNER_PRIVATE_KEY
- eth_sendRawTransaction con wait_for_receipt=False
- Inmediatamente UPDATE devs SET balance_nxt = 0 (commit)

### Etapa 2 — Claim on-chain
- Frontend llama claimNXT(tokenIds[]) via wagmi/MetaMask
- User firma y paga gas
- Contrato mintea NXT al msg.sender
- Frontend espera receipt hasta 60s

### Etapa 3 — Record-claim
- Frontend POST /api/players/{wallet}/record-claim (players.py:188)
- INSERT INTO claim_history — confía en datos del frontend
- Fire-and-forget con .catch(() => {})

## 4.2 Backend signer

### Configuración
- Carga: os.getenv("BACKEND_SIGNER_PRIVATE_KEY") en claim_sync.py:33
- Sin wrapper class, sin singleton
- Account.from_key() en cada sync (líneas 207 y 302)

### Permisos on-chain (11 funciones privilegiadas)
Role: state var backendSigner en NXDevNFT, seteado por setBackendSigner

Funciones accesibles vía modifiers onlyBackendOrOwner / onlyGameOrBackend:
- setCorporation / batchSetCorporation
- setClaimableBalance / batchSetClaimableBalance (única usada)
- addClaimableBalance / batchAddClaimableBalance
- setTokenLocked / batchSetTokenLocked
- setTokenState / batchSetTokenState
- deductClaimableBalance

Riesgo: compromise de la key = minteo ilimitado hasta el cap del token.

### Gestión de gas
- Chequeo inline al inicio de cada sync: < 0.00001 ETH → error_no_gas
- Sin alerting, sin autorefill, sin monitoreo persistente

### Gestión de nonce
- Usa "latest" en eth_getTransactionCount (BUG: debe ser "pending")
- Sin lock, sin mutex, sin queue
- Calls concurrentes comparten nonce → race condition

## 4.3 Tracking y observabilidad

### Lo que NO existe
- Tabla de sync_history / sync_txs: los tx_hash de syncs no se persisten
- Worker de receipts: _mark_synced ejecuta sobre promesa del mempool
- Reconciliación entre DB / chain / claim_history
- Endpoint admin para investigar divergencias
- Dashboard de monitoreo
- Alertas (Prometheus, Sentry, Datadog, PagerDuty — todos ausentes)
- Retry logic
- Runbook de incidentes

### Lo que existe
- Variables in-process _last_claim_sync_at/_result (se pierden en restart)
- Endpoint /api/claim-sync/status (volátil, no cross-process)
- Logs stdout en Render (retención limitada)

### Código muerto identificado
- players.balance_claimed nunca se escribe en el código
- Grep UPDATE players SET balance_claimed → 0 matches
- Cualquier feature que lo consume está propagando ceros falsos

## 4.4 Hallazgos críticos (severidad alta)

### 4.4.1 Auth bypass en /claim-sync/force
- Si el request trae token_ids, no se valida ownership
- Un atacante puede zeroar balance_nxt de devs ajenos
- Vector de denial of service / denegación económica
- Fix: validar owner_wallet == caller para todos los token_ids

### 4.4.2 Perdida de saldo por wait_for_receipt=False
- _mark_synced ejecuta UPDATE balance_nxt=0 antes de confirmar tx
- Si la tx revierte, saldo perdido sin mecanismo de recuperación
- Fix: esperar receipt O hacer 2-phase commit con estado "pending"

### 4.4.3 record-claim confía en frontend
- Frontend calcula amount_gross/net/fee y POSTea
- Sin UNIQUE sobre tx_hash, sin idempotency_key, sin verify on-chain
- Vector de corrupción del histórico de claims
- Fix: backend lee receipt on-chain y parsea evento Claim

### 4.4.4 Nonce race condition
- Sin lock en el signer
- Dos syncs concurrentes obtienen mismo nonce → una tx rechazada
- Combinado con wait_for_receipt=False → lost funds garantizado

### 4.4.5 DRY_RUN default "true" no declarado en render.yaml
- Si env var no se setea, sistema entra en modo acumular-sin-sync
- Documentado en ECONOMY_FLOW.md y WALLET_ANALYSIS.md como riesgo conocido
- Fix trivial: agregar a render.yaml

### 4.4.6 Signer overprivilegiado
- Tiene 11 funciones privilegiadas, usa 1
- EOA simple, sin multi-sig, sin HSM
- Compromise = game over económico del sistema

## 4.5 Hallazgos medios

### 4.5.1 Rate limiter inconsistente cross-worker
- 8 workers uvicorn, cada uno con defaultdict local
- shop_limiter "1 req/s por wallet" es en realidad hasta 8 req/s
- Amplifica todas las race conditions anteriores

### 4.5.2 Contrato pausable sin awareness del backend
- batchSetClaimableBalance no tiene whenNotPaused
- claimNXT sí lo tiene
- Si se pausa: backend sigue sync, users no pueden claimar → deadlock

### 4.5.3 Sin failover de RPC
- MEGAETH_RPC evaluado al import del módulo
- Si está down, todas las syncs fallan hasta restart

### 4.5.4 Sin audit trail de fixes manuales
- Recuperación de errores vía psql manual
- Cero registro de qué admin ajustó qué, cuándo, por qué

## 4.6 Modos de fallo documentados

| Escenario | Comportamiento actual | Severidad |
|-----------|----------------------|-----------|
| Signer sin ETH | Error genérico al user, sin alertas | Alta |
| Contrato pausado | Backend sigue sync, user en deadlock | Alta |
| Doble click COLLECT | Race de nonce + balance_nxt=0 aplicado | Alta |
| Restart engine en batch 3/10 | Batches 1-2 aplicados, 4-10 perdidos | Media |
| RPC timeout | Sin retry, sin failover | Media |
| Private key corrupta | Falla silenciosa por sync, nunca detectada | Media |
| Necesidad de compensar saldo | Solo psql manual, sin audit trail | Media |
| DRY_RUN accidentalmente true | Acumulación sin sync, sin alerta | Alta |

## 4.7 Implicaciones para NX_FUTURES

El sistema actual de claim NO es reusable tal cual para trading. Necesita:

1. Tabla de ledger para operations (ver pasos 2-3)
2. Wrapper class SignerService con locking de nonce
3. Tabla de sync_txs persistente con estado (pending/confirmed/failed/reverted)
4. Worker de receipts que reconcilie estado periódicamente
5. Validación de ownership en todos los endpoints privilegiados
6. Endpoint admin para investigar divergencias
7. Rate limiter consistente (Redis, no in-memory)
8. Awareness de pause del contrato

## 4.8 Fixes acumulados pre-NX_FUTURES (paso 4)

Suma a la lista de pasos 2+3:

15. Endpoint /claim-sync/force valida ownership de token_ids
16. record-claim lee receipt on-chain, no confía en frontend
17. wait_for_receipt=True o two-phase commit en sync
18. Lock de nonce en SignerService wrapper
19. eth_getTransactionCount con "pending" no "latest"
20. Persistir tx_hash de syncs en tabla sync_txs
21. Worker de receipts que actualiza sync_txs.status
22. Declarar DRY_RUN=false explícito en render.yaml
23. Health check profundo que valide signer + RPC + gas
24. Endpoint admin /admin/reconcile para detectar divergencias
25. Rate limiter en Redis, consistente cross-worker
26. Upgrade contrato: whenNotPaused en batchSetClaimableBalance
27. Migración a multi-sig o HSM para signer (largo plazo)
28. Runbook de incidentes documentado
