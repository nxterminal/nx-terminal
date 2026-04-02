# Estado de la Base de Datos — NX Terminal Post-Migración MegaETH

> Fecha: 2026-04-02
> DB: PostgreSQL 15 | Schema: `nx` | Host: Render (nx-db)

---

## Schema: 16 Tablas

| # | Tabla | Propósito | FK Principal |
|---|-------|-----------|:------------:|
| 1 | **players** | Wallets, balances, display names | — (PK: wallet_address) |
| 2 | **devs** | NFT devs: traits, stats, estado dinámico | → players |
| 3 | **protocols** | Protocolos creados por devs | → devs |
| 4 | **protocol_investments** | Inversiones de devs en protocolos | → devs, protocols |
| 5 | **absurd_ais** | AIs creadas por devs | → devs |
| 6 | **ai_votes** | Votos de devs en AIs | → devs, absurd_ais |
| 7 | **actions** | Log de eventos (PARTITIONED) | → devs |
| 8 | **chat_messages** | Mensajes de devs (PARTITIONED) | → devs |
| 9 | **world_events** | Eventos globales del juego | — |
| 10 | **world_chat** | Chat de players humanos | — |
| 11 | **shop_purchases** | Compras en la tienda | → players, devs |
| 12 | **player_prompts** | Órdenes de players a devs | → devs |
| 13 | **notifications** | Notificaciones de players | → devs |
| 14 | **claim_history** | Claims on-chain de $NXT | → players |
| 15 | **balance_snapshots** | Snapshots diarios de balances | → players |
| 16 | **simulation_state** | Key-value global (ciclo, status, contadores) | — |

---

## Cómo Verificar el Estado Actual

### Opción A: Via API (sin acceso directo a DB)

```bash
# Total de devs en DB
curl https://nx-terminal.onrender.com/api/devs/count

# Stats de simulación (devs activos, NXT, protocolos, AIs)
curl https://nx-terminal.onrender.com/api/simulation/stats

# Estado de simulación (ciclo, status, listener block)
curl https://nx-terminal.onrender.com/api/simulation/state

# Primeros 5 devs
curl "https://nx-terminal.onrender.com/api/devs?limit=5"

# Health check
curl https://nx-terminal.onrender.com/health
```

### Opción B: Via psql directo (requiere acceso a Render DB)

```sql
-- Conectar a la DB
SET search_path TO nx;

-- Conteo de todas las tablas
SELECT 'players' as tabla, COUNT(*) FROM players
UNION ALL SELECT 'devs', COUNT(*) FROM devs
UNION ALL SELECT 'protocols', COUNT(*) FROM protocols
UNION ALL SELECT 'protocol_investments', COUNT(*) FROM protocol_investments
UNION ALL SELECT 'absurd_ais', COUNT(*) FROM absurd_ais
UNION ALL SELECT 'ai_votes', COUNT(*) FROM ai_votes
UNION ALL SELECT 'actions', COUNT(*) FROM actions
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'world_events', COUNT(*) FROM world_events
UNION ALL SELECT 'world_chat', COUNT(*) FROM world_chat
UNION ALL SELECT 'shop_purchases', COUNT(*) FROM shop_purchases
UNION ALL SELECT 'player_prompts', COUNT(*) FROM player_prompts
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'claim_history', COUNT(*) FROM claim_history
UNION ALL SELECT 'balance_snapshots', COUNT(*) FROM balance_snapshots
UNION ALL SELECT 'simulation_state', COUNT(*) FROM simulation_state
ORDER BY 1;

-- Primeros 5 devs (verificar si son de Pharos o MegaETH)
SELECT token_id, name, corporation, owner_address, status, minted_at
FROM devs ORDER BY token_id LIMIT 5;

-- Estado de simulación
SELECT key, value FROM simulation_state ORDER BY key;

-- Listener block checkpoint
SELECT key, value FROM simulation_state WHERE key = 'listener_last_block';
```

---

## Identificar Data Pharos vs MegaETH

**MegaETH (REAL — mantener):**
- 10 NFTs minteados en contrato `0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7` en chain 4326
- Wallet owner: `0xaE882a8933b33429F53B7Cee102Ef3Dbf9C9E88B`
- Token IDs: los que el listener haya procesado (o generados on-demand por la API)

**Pharos (VIEJA — borrar):**
- Todo lo demás: devs con token IDs que no existen en MegaETH
- Protocolos, AIs, inversiones, acciones, chat — todo generado en Pharos testnet
- Players con wallets de prueba de Pharos

**Cómo distinguir:**
```sql
-- Devs que probablemente son de MegaETH (minteados recientemente)
SELECT token_id, name, owner_address, minted_at 
FROM devs 
WHERE minted_at > '2026-04-01'
ORDER BY minted_at;

-- Devs que probablemente son de Pharos (anteriores a la migración)
SELECT COUNT(*) as pharos_devs FROM devs WHERE minted_at < '2026-04-01';
SELECT COUNT(*) as megaeth_devs FROM devs WHERE minted_at >= '2026-04-01';
```

---

## Mecanismo de Reset Existente

### `backend/db/reset_data.sql`

Script completo que hace TRUNCATE CASCADE de todas las tablas, resetea secuencias y reinicializa simulation_state. **Preserva** schema, enums, funciones, triggers, vistas.

```bash
# Ejecutar el reset completo (DESTRUCTIVO — borra TODO)
psql $DATABASE_URL -f backend/db/reset_data.sql
```

**Lo que BORRA:**
- Todos los devs, players, protocolos, AIs, inversiones
- Todos los logs (actions, chat_messages)
- Todos los eventos, notificaciones, compras, claims
- Todos los snapshots

**Lo que PRESERVA:**
- Estructura de tablas, columnas, índices, constraints
- Enums (archetype_enum, corporation_enum, action_enum, etc.)
- Funciones (update_timestamp, recalc_player_balance)
- Vistas materializadas (leaderboard, protocol_market, ai_lab)
- Particiones de tablas

**Lo que REINICIALIZA:**
- `simulation_state` → valores iniciales (cycle=0, status=pre_launch, etc.)
- Todas las secuencias → restart con 1

---

## Opciones de Limpieza

### Opción 1: RESET TOTAL (Recomendado)
Ejecutar `reset_data.sql` y dejar que el listener re-procese los 10 mints de MegaETH.

**Pros:** Limpio, sin data vieja, listener generará devs frescos con traits correctos.
**Contras:** Hay que verificar que el listener esté corriendo y que el checkpoint de bloques permita re-procesar los mints.

**Pasos:**
1. Ejecutar `reset_data.sql` via psql
2. Verificar que `MEGAETH_RPC_URL` está configurada en nx-engine
3. El listener arrancará desde el bloque actual — necesita saber desde qué bloque buscar los mints
4. Manualmente setear `listener_last_block` a un bloque anterior a los mints:
   ```sql
   UPDATE simulation_state SET value = '0' WHERE key = 'listener_last_block';
   ```
5. Reiniciar nx-engine — el listener procesará todos los mints desde el bloque 0 (o el bloque configurado)

### Opción 2: RESET SELECTIVO
Borrar solo data de Pharos, mantener los devs de MegaETH.

**Más complejo.** Requiere identificar exactamente cuáles devs son de MegaETH y borrar todo lo demás:
```sql
-- Borrar devs de Pharos (mantener los de MegaETH)
DELETE FROM devs WHERE minted_at < '2026-04-01';
-- Las FKs con CASCADE borrarán inversiones, acciones, etc. asociadas
```

### Opción 3: NO HACER NADA
Si la data vieja no molesta (los devs de Pharos no aparecen a users de MegaETH porque `tokensOfOwner` solo devuelve tokens de MegaETH), se puede dejar como está.

**Riesgo:** Stats de simulación, leaderboard y Corp Wars mostrarán data combinada (Pharos + MegaETH).

---

## Estado del Listener

El listener necesita estas condiciones para funcionar:
- `MEGAETH_RPC_URL` configurada en el servicio nx-engine de Render
- El servicio corriendo `python -m backend.engine.run_all` (no `run_engine`)
- La tabla `devs` accesible (schema `nx` existe)
- El enum `action_enum` incluye `DEPLOY`

Verificar logs del listener:
```
# En Render dashboard → nx-engine → Logs
# Buscar: "[LISTENER]" 
```
