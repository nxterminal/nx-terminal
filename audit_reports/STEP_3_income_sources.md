# Paso 3 — Fuentes de ingreso de $NXT

## Resumen ejecutivo

13 fuentes de crédito de $NXT distribuidas en 6 archivos distintos. 
No existe función centralizada — cada módulo hace su propio 
UPDATE devs SET balance_nxt = balance_nxt + X.

Hallazgos críticos:
- Bug de inflación activo en HACK_RAID por falta de lock sobre target
- Doble pago de salary en cada restart del engine
- Sin source of truth del historial económico

## 3.1 Inventario completo de fuentes

| # | Fuente | Archivo:línea | Trigger | Monto típico |
|---|--------|---------------|---------|--------------|
| 1 | Salario por intervalo | engine.py:957 | Cron horario in-process | 9 NXT/h × multi |
| 2 | SELL investment | engine.py:475 | Scheduler autónomo | shares × 0.5-1.8 |
| 3 | Fund dev (deposit) | shop.py:950 | User tx on-chain | amount verificado |
| 4 | Pending funds processor | engine.py:1400 | Cron 5 min | idem #3 |
| 5 | Orphan funds scanner | engine.py:1578 | Cron vault scan | Transfer event |
| 6 | HACK_MAINFRAME éxito | shop.py:569 | User click | random MIN-MAX |
| 7 | HACK_RAID éxito atacante | shop.py:714 | User click | random vs target |
| 8 | HACK_RAID fallo target | shop.py:774 | User click | effective_cost |
| 9 | TRANSFER dev→dev | shop.py:1035 | User click | req.amount |
| 10 | Mission claim | missions.py:329 | User click | dev_reward |
| 11 | Achievement claim | achievements.py:241 | User click | achievement.reward_nxt |
| 12 | Daily streak claim | streaks.py:122 | User click 1/día | reward según día |
| 13 | Backfill manual | scripts/backfill_funds.py:248 | Admin CLI | amount on-chain |

## 3.2 Patrones detectados

### Patrón A — User claim (mission, achievement, streak, transfer)
- FOR UPDATE sobre la entidad de control (player_missions, etc.)
- Validación de ownership + status + timing
- UPDATE devs SET balance_nxt += X
- INSERT en actions como log semántico
- Commit via context manager

### Patrón B — Cron / engine (salary, sell, pending funds)
- UPDATE masivo sin FOR UPDATE
- Sin advisory lock anti-overlap
- Estado de "última ejecución" en variable Python (se pierde en restarts)
- Logging batch en actions

### Patrón C — Peer-to-peer (HACK_RAID, TRANSFER)
- TRANSFER: lock ordenado ambos devs ✅
- HACK_RAID: lock solo atacante ❌ — bug de inflación

### Patrón D — On-chain deposit (fund_dev, pending_funds, backfill)
- Verificación de tx receipt
- UNIQUE constraint sobre tx_hash
- Idempotent por construcción

## 3.3 Hallazgos de severidad alta

### 3.3.1 Inflación en HACK_RAID concurrente

Target sin FOR UPDATE (shop.py:685). Snapshot stale de balance_nxt 
usado en random.randint. Dos raids paralelas al mismo target pueden 
acreditar ambas el steal_amount completo, creando NXT de la nada.

Ejemplo reproducible:
- target con 100 NXT
- raid A y raid B leen 100 en paralelo
- ambas sortean steal = 80
- GREATEST protege el balance del target (no queda negativo)
- pero ambos atacantes reciben +80 = 160 NXT creados, 100 extraídos del target
- 60 NXT de inflación pura

Mitigación inmediata: agregar FOR UPDATE al SELECT del target 
(shop.py:685).

### 3.3.2 Doble pago de salary en restarts

engine.py:1681 paga salary incondicionalmente en startup. Cada deploy 
a Render o crash+restart genera un pago extra no contabilizado.

La variable last_salary vive en memoria Python del proceso — 
se pierde en cada reinicio.

Mitigación inmediata: persistir last_salary_paid_at en 
simulation_state o tabla dedicada, chequear antes de pagar en startup.

### 3.3.3 Inconsistencia en convención de actions.nxt_cost

| Fuente | Signo | Valor |
|--------|-------|-------|
| RECEIVE_SALARY | + | salary (crédito como positivo) |
| MISSION_COMPLETE | − | reward (crédito como negativo) |
| TRANSFER | + | amount (ambos lados, sin distinción) |
| HACK_RAID | + | effective_cost (no steal_amount) |

Consecuencia: SUM(actions.nxt_cost) es matemáticamente basura. 
No usable como ledger.

## 3.4 Hallazgos de severidad media

- 13 callsites duplicando UPDATE balance_nxt, cero centralización
- players.balance_claimable nunca se invalida; el sistema depende de 
  que wallet-summary recalcule con SUM(devs.balance_nxt) en Python
- ceil(200/24) = 9 emite 216 NXT/día vs 200 anunciados
- shop_purchases.target_dev_id mal nombrado: en HACK_RAID guarda al atacante
- HACK_RAID no valida attacker_id != target_id (solo por corp check)
- Pérdida silenciosa de reward en mission_claim si dev fue borrado

## 3.5 Patrones buenos a replicar en NX_FUTURES

### TRANSFER dev→dev (shop.py:1030)
- SELECT ambos devs con ORDER BY token_id FOR UPDATE → previene deadlocks
- Self-transfer bloqueado explícitamente
- Log simétrico en actions (dos filas, una por lado)
- Validación de amount > 0
- Este es el template para trades peer-to-peer

### mission_claim idempotency (missions.py:283)
- FOR UPDATE + status = 'in_progress' check
- Double-claim correctamente rechazado con 400
- Este es el template para resolver mercado

## 3.6 Impacto para NX_FUTURES

NX_FUTURES genera órdenes de magnitud más créditos/débitos que misiones:
- 10-50 trades/día/player activo (vs 1-2 claims/día)
- Resoluciones batch de mercados (similar a salary pero correctas)
- Copy-trading encadenado (una decisión → N trades)

Construir NX_FUTURES sobre la infraestructura actual propagaría todos 
los bugs. Requisito: crear función centralizada credit_dev() + 
tabla nxt_ledger antes de cualquier nuevo callsite.

## 3.7 Fixes acumulados pre-NX_FUTURES

De paso 2 + paso 3:

1. Tabla nxt_ledger append-only
2. Función centralizada credit_dev(dev_id, delta, source, ref) 
   que hace UPDATE + INSERT ledger en una operación
3. Migrar los 13 callsites existentes a usar credit_dev
4. UNIQUE + idempotency_key en claim_history
5. Columna status en claim_history
6. Verificar tx_hash on-chain antes de registrar
7. FOR UPDATE en HACK_RAID sobre el target (fix crítico hoy)
8. FOR UPDATE en record-claim y recalc_player_balance
9. Persistir last_salary_paid_at, chequear en startup
10. Auditar usos de execute/fetch_* en flujos económicos
11. CITEXT o CHECK constraint sobre wallet_address
12. Advisory locks en operaciones batch del engine
13. Corregir ceil() en SALARY_PER_INTERVAL
14. Validar attacker_id != target_id en HACK_RAID
