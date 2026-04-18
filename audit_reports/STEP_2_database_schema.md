# Paso 2 — Database Schema para flujo económico $NXT

## Resumen ejecutivo

Estado del sistema: funcional pero con deuda técnica crítica en:
- Ausencia de ledger append-only
- Vulnerabilidades de concurrencia en claims
- Inconsistencia potencial entre balances agregados y valores derivados

## 2.1 Saldo virtual del user

- **Tabla**: players
- **Columna**: balance_claimable BIGINT DEFAULT 0
- **Archivo**: backend/db/schema.sql:66
- **Patrón**: derivado — se recalcula como SUM(devs.balance_nxt) vía 
  función recalc_player_balance (schema.sql:467)

Contadores adicionales en la misma tabla:
- balance_claimed BIGINT — total histórico retirado al wallet on-chain
- balance_total_earned BIGINT — total histórico ganado

## 2.2 Ledger append-only

**NO EXISTE.** Los balances son autoritativos por estado mutable, no 
reconstruibles desde eventos.

Tablas que cubren sub-flujos (no constituyen un ledger completo):
| Tabla | Archivo:línea | Qué registra |
|-------|---------------|--------------|
| actions | schema.sql:264 | Log de acciones de devs con nxt_cost |
| claim_history | schema.sql:400 | Solo claims on-chain (gross/fee/net) |
| shop_purchases | schema.sql:328 | Solo compras de tienda |
| balance_snapshots | schema.sql:416 | Snapshots diarios |
| funding_txs | migration_funding.sql:14 | Depósitos on-chain |
| pending_fund_txs | migration_pending_funds.sql:14 | Fondos pendientes |

Créditos NO registrados en ledger (solo mutan balance): salarios, 
misiones, streaks, achievements.

## 2.3 Tabla claim_history

### Schema
CREATE TABLE claim_history (
    id                  SERIAL PRIMARY KEY,
    player_address      VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
    amount_gross        BIGINT NOT NULL,
    fee_amount          BIGINT NOT NULL,
    amount_net          BIGINT NOT NULL,
    tx_hash             VARCHAR(66),
    claimed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

### Problemas identificados
- tx_hash es NULLABLE y sin UNIQUE → doble registro posible
- No hay columna de status (pending/confirmed/failed)
- No hay idempotency_key
- Endpoint record-claim (players.py:188) NO verifica on-chain antes 
  de insertar — confía en el frontend
- players.balance_claimed puede divergir de SUM(claim_history.amount_net)

## 2.4 Mecanismos de concurrencia

### Row locks (FOR UPDATE)
Se usan SOLO sobre devs por token_id y player_missions. 
NUNCA sobre players.

Endpoints sin lock que deberían tener:
- players.py:209 record-claim
- schema.sql:467 recalc_player_balance

### Version columns
No existen en ninguna tabla relevante.

### Transacciones
Manager central en backend/api/deps.py:113. Los helpers fetch_*/execute 
abren TX separados — romper atomicidad es fácil.

### Idempotency en otros endpoints
| Mecanismo | Ubicación |
|-----------|-----------|
| funding_txs.tx_hash UNIQUE | migration_funding.sql:19 |
| pending_fund_txs.tx_hash UNIQUE | migration_pending_funds.sql:16 |
| balance_snapshots UNIQUE(wallet, date) | schema.sql:424 |

### Advisory locks
No se usan en ningún flujo económico.

### Wallet address normalization
Lowercase en código (92 ocurrencias) pero sin CITEXT ni CHECK 
constraint en DB — vulnerable a bugs de callsite.

## 2.5 Vectores de race condition identificados

1. Doble record-claim sin lock ni UNIQUE sobre tx_hash
2. Shop purchases concurrentes en devs distintos del mismo owner
3. recalc_player_balance concurrente (lost update)
4. Helpers execute/fetch_* rompiendo atomicidad por error de uso
5. Case mismatch de wallet creando filas duplicadas

## 2.6 Respuestas a las 5 preguntas clave

1. **Saldo virtual del user**: players.balance_claimable (BIGINT)
2. **Ledger append-only**: NO EXISTE. Solo hay tablas por sub-flujo.
3. **Vinculación user → wallet**: players.wallet_address es PK 
   (VARCHAR(42), lowercase por convención de código, no por constraint)
4. **Tabla de tx hashes**: claim_history.tx_hash y funding_txs.tx_hash. 
   Solo funding_txs tiene UNIQUE.
5. **Locks/concurrencia**: FOR UPDATE solo en devs y player_missions. 
   Ningún mecanismo sobre players.balance_claimable. Sin version 
   columns. Sin advisory locks.

## 2.7 Fixes requeridos antes de construir NX_FUTURES

1. Crear tabla nxt_ledger append-only (single source of truth)
2. Agregar UNIQUE + idempotency_key a claim_history
3. Agregar columna status a claim_history
4. Verificar tx_hash on-chain antes de registrar claims
5. Agregar FOR UPDATE a record-claim y recalc_player_balance
6. Auditar usos de execute/fetch_* en flujos económicos
7. Forzar lowercase en wallet_address via CITEXT o CHECK
8. Agregar advisory locks en operaciones multi-row
9. Revisar UNIQUE constraints en shop_purchases
