# Análisis de Economía — NX Terminal

> Fecha: 2026-04-02 | Solo lectura — sin cambios realizados

---

## 1. Ciclo de Simulación

### Intervalos de Ciclo (por dev, basado en energía)
| Energía | Intervalo | Acciones/día aprox |
|:-------:|:---------:|:------------------:|
| ≥ 8 | 8 min | ~180 |
| 4-7 | 12 min | ~120 |
| 1-3 | 20 min | ~72 |
| 0 | 45 min | ~32 |
| Hackathon activo | 5 min | ~288 |

### Flujo de un Ciclo
1. Verificar si hay prompt del player pendiente
2. Decidir acción (weighted random basado en archetype + modificadores)
3. Ejecutar acción (gastar/ganar $NXT, energía, reputación)
4. 10% chance de cambio de mood
5. 30% chance de +1 energía pasiva
6. 15% chance de auto-votar en un AI aleatorio
7. Programar siguiente ciclo según energía actual

### Scheduler
- **Tick:** cada 1 segundo
- **Batch:** hasta 500 devs por tick
- **Salary:** cada 1 hora
- **Snapshot de balance:** cada 24 horas

---

## 2. Ingresos ($NXT que gana un dev)

### Salario
- **200 $NXT/día** por dev (pagado como 9 $NXT cada hora, 24 veces = 216/día por redondeo)
- Aplicado a TODOS los devs activos automáticamente
- También regenera energía: +1 base, +1 extra si rare/legendary, +2 extra si mythic

### Inversiones (SELL)
- Al vender participación en un protocolo: retorno de 0.5x a 1.8x del monto invertido
- Variable e impredecible

### Balance Inicial (por rareza)
| Rareza | Balance Inicial |
|--------|:--------------:|
| Common | 2,000 $NXT |
| Uncommon | 2,500 $NXT |
| Rare | 3,000 $NXT |
| Legendary | 5,000 $NXT |
| Mythic | 10,000 $NXT |

---

## 3. Gastos ($NXT que gasta un dev)

### Gastos Automáticos (decididos por el engine)
| Acción | Costo $NXT | Costo Energía | Probabilidad Base |
|--------|:----------:|:-------------:|:-----------------:|
| CREATE_PROTOCOL | 15 | 1 | ~8-12% |
| CREATE_AI | 5 | 1 | ~4-8% |
| INVEST | 2-250 (variable) | 1 | ~4-12% |
| SELL | 0 (retorna $NXT) | 0 | ~2-5% |
| MOVE | 0 | 2 | ~10-18% |
| CHAT | 0 | 0 | ~15-35% |
| CODE_REVIEW | 0 | 3 | ~8-30% |
| REST | 0 (regenera energía) | 0 | ~15-28% |

### Modificadores de Probabilidad
- **Energía baja (≤2):** REST ×4.0, crear/review ×0.1
- **Energía alta (≥8):** CREATE_PROTOCOL ×2.0, REST ×0.1
- **Balance < 15:** No puede crear protocolos
- **Balance < 5:** No puede crear AI ni invertir
- **Mood angry:** CHAT ×2.0, REST ×0.5
- **Mood excited:** CREATE ×1.5, AI ×2.0, INVEST ×1.5
- **Mood depressed:** REST ×2.0, CREATE ×0.3
- **Mood focused:** CREATE ×2.0, CODE_REVIEW ×1.5
- **Ubicación:** cada ubicación tiene bonuses (ej: HACKATHON_HALL → CREATE ×2.5)

### Inversión Variable
El monto de inversión es: `random(2, min(500, balance/5))`
- Con balance 2000 → invierte entre 2 y 400
- Con balance 200 → invierte entre 2 y 40
- Con balance 50 → invierte entre 2 y 10

---

## 4. Balance Típico Después de 24 Horas

### Cálculo Estimado (dev Common, archetype promedio)
- **Ingreso:** ~216 $NXT (salario) + 2,000 (inicial) = 2,216 $NXT total
- **Gasto estimado por acciones** (~120 acciones/día):
  - ~12 CREATE_PROTOCOL = 180 $NXT
  - ~7 CREATE_AI = 35 $NXT
  - ~10 INVEST = ~200 $NXT promedio
  - Total gasto: ~415 $NXT
- **Balance estimado después de 24h:** ~1,800 $NXT

**Realidad:** El dev gasta agresivamente en inversiones (hasta balance/5 por vez). Con suerte en SELL, puede recuperar algo. Sin suerte, el balance se drena rápido.

---

## 5. Balance del Dev vs Balance del Player

### Estructura
```
DEV (balance_nxt = 1500)  ─┐
DEV (balance_nxt = 800)   ─┼─→ PLAYER (balance_claimable = 3100)
DEV (balance_nxt = 800)   ─┘
```

- **`dev.balance_nxt`** — Balance líquido del dev individual. Se usa para acciones del engine Y compras de shop.
- **`player.balance_claimable`** — Suma en tiempo real de todos los `balance_nxt` de los devs del player. Es lo que se puede reclamar on-chain.
- **`player.balance_claimed`** — Histórico: total ya reclamado on-chain.
- **`player.balance_total_earned`** — Acumulado lifetime de todos los devs.

### Flujo Completo
```
Dev gana salary (+9/hora)
  → balance_nxt sube
  → Engine decide acciones → gasta balance_nxt
  → Player ve balance_claimable (suma de todos los devs)
  → Backend sync: batchSetClaimable() en contrato
  → Player llama claimNXT() on-chain
  → Recibe $NXT tokens en wallet
  → Backend zeros balance_nxt de los devs reclamados
```

### Punto Clave
**El shop deducta directamente del `balance_nxt` del dev.** Cualquier mecánica nueva (café, training, raids) debe deducir del `balance_nxt` del dev específico.

---

## 6. Sistema de Energía

| Concepto | Valor |
|----------|-------|
| Máximo | 10 (cap hard en DB: CHECK energy <= 15) |
| Default inicial | 10 |
| REST regenera | 2-4 + bonus rareza |
| Pasiva (30% chance) | +1 por acción |
| Salary (+1/hora) | +1 base + bonus rareza |
| Energía 0 | Solo puede REST, ciclo cada 45 min |

### Bonuses de Rareza para Energía
| Rareza | Bonus REST | Bonus Salary |
|--------|:----------:|:------------:|
| Common | +0 | +0 |
| Uncommon | +0 | +0 |
| Rare | +1 | +1 |
| Legendary | +1 | +1 |
| Mythic | +2 | +2 |

---

## 7. Sistema de Tienda Existente

### Tabla `shop_purchases`
| Campo | Tipo | Propósito |
|-------|------|-----------|
| id | SERIAL | PK |
| player_address | VARCHAR(42) | Quien compra (FK → players) |
| target_dev_id | INTEGER | Dev que recibe item (FK → devs) |
| item_type | VARCHAR(30) | ID del item |
| item_effect | JSONB | Efecto aplicado |
| nxt_cost | BIGINT | Precio pagado |
| purchased_at | TIMESTAMPTZ | Timestamp |

### Items Actuales (backend/api/routes/shop.py)
| Item | Costo | Efecto |
|------|:-----:|--------|
| energy_drink | 300 $NXT | +5 energía |
| mood_reset | 200 $NXT | Mood → neutral |
| code_boost | 500 $NXT | +15 code quality |
| sabotage_bug | 800 $NXT | -20 reputation a otro dev |
| teleporter | 400 $NXT | Mover gratis a cualquier ubicación |
| reputation_boost | 600 $NXT | +10 reputación |

### Endpoint API
- `POST /api/shop/buy` — Compra un item
- Valida ownership del dev (wallet debe ser owner)
- Deducta del `balance_nxt` del dev
- Aplica efecto inmediato
- Registra en `shop_purchases`

**PROBLEMA:** Los precios son MUY altos (300-800 $NXT) para una economía donde un dev gana ~200/día. Un energy_drink cuesta 1.5 días de salario.

---

## 8. Campos Existentes vs Faltantes para Mecánicas Nuevas

### YA EXISTEN
| Campo | Tabla | Usado para |
|-------|-------|------------|
| `coffee_count` | devs | Counter de cafés (flavor, incrementado en engine) |
| `bugs_shipped` | devs | Counter de bugs (flavor) |
| `bugs_found` | devs | Counter de bugs encontrados |
| `hours_since_sleep` | devs | Fatiga (flavor) |
| `lines_of_code` | devs | Código escrito (flavor) |
| `total_spent` | devs | Gasto acumulado |
| `total_earned` | devs | Ganancia acumulada |
| `devs_burned` | devs | Devs saboteados |

### NO EXISTEN (habría que agregar)
| Campo Propuesto | Tabla | Para Mecánica |
|-----------------|-------|---------------|
| `pc_health` | devs | PC Maintenance |
| `training_course` | devs | Training activo |
| `training_ends_at` | devs | Cuándo termina el training |
| `last_raid_at` | devs | Cooldown de raids |

---

## 9. Problema Económico Principal

### El Dev Gasta Demasiado Automáticamente
Con ~120 acciones/día, un dev gasta ~415 $NXT en protocolos + AI + inversiones.
Gana ~216 de salary. **Déficit de ~200/día** cubierto por el balance inicial de 2,000.

**Después de ~10 días:** balance llega a 0, el dev solo puede hacer acciones gratis (CHAT, REST, MOVE, CODE_REVIEW).

### Los Precios de Shop Son Prohibitivos
- Energy drink: 300 $NXT = 1.5 días de salary
- Code boost: 500 $NXT = 2.5 días de salary
- Sabotage bug: 800 $NXT = 4 días de salary

**Resultado:** Nadie usa la tienda porque el engine gasta todo el balance antes de que el player pueda.

---

## 10. Propuesta de Ajuste Económico

### Dónde Cambiar
**Archivo:** `backend/engine/engine.py`

**Opción A: Reducir costos de acciones automáticas**
```
CREATE_PROTOCOL: 15 → 5 $NXT
CREATE_AI: 5 → 2 $NXT
INVEST max: balance/5 → balance/10
```
Esto reduce el gasto automático de ~415 a ~150 $NXT/día. Dev retiene ~70% del salary.

**Opción B: Reducir probabilidad de acciones costosas**
Bajar los pesos de CREATE_PROTOCOL e INVEST en la PERSONALITY_MATRIX para todos los archetypes.

**Opción C: Agregar "savings" mechanic**
El engine solo gasta hasta el 40% del balance actual, reservando 60% para el player.
```python
# En execute_action(), antes de gastar:
available_budget = int(dev["balance_nxt"] * 0.4)
if action_cost > available_budget:
    action = "REST"  # Can't afford, rest instead
```

**Recomendación:** Opción C es la más limpia — no cambia los precios ni las probabilidades, solo agrega un "tope de gasto" que preserva balance para el player.

### Precios de Shop Nuevos (para mecánicas propuestas)
| Item | Costo Propuesto | Comparado con Salary |
|------|:--------------:|:-------------------:|
| Coffee | 5 $NXT | ~30 min salary |
| Energy Drink | 12 $NXT | ~1.5 hrs salary |
| Pizza | 25 $NXT | ~3 hrs salary |
| MegaMeal | 50 $NXT | ~6 hrs salary |
| Fix Bug (Warning) | 3 $NXT | ~20 min salary |
| Fix Bug (Error) | 8 $NXT | ~1 hr salary |
| Fix Bug (BSOD) | 20 $NXT | ~2.5 hrs salary |
| Run Diagnostic | 10 $NXT | ~1.2 hrs salary |
| Training (básico) | 20 $NXT | ~2.5 hrs salary |
| Training (medio) | 50 $NXT | ~6 hrs salary |
| Training (avanzado) | 100 $NXT | ~12 hrs salary |
| Hack/Raid | 15 $NXT | ~2 hrs salary |

Todos accesibles con el balance diario si el dev retiene 60-70%.

---

## 11. Plan Técnico — 5 Mecánicas Nuevas

### Cambios a Base de Datos (`schema.sql` + migration)
```sql
-- Nuevos campos en tabla devs
ALTER TABLE devs ADD COLUMN pc_health SMALLINT NOT NULL DEFAULT 100;
ALTER TABLE devs ADD COLUMN training_course VARCHAR(30) DEFAULT NULL;
ALTER TABLE devs ADD COLUMN training_ends_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE devs ADD COLUMN last_raid_at TIMESTAMPTZ DEFAULT NULL;

-- Nuevos valores en action_enum
ALTER TYPE action_enum ADD VALUE 'BUY_ITEM';
ALTER TYPE action_enum ADD VALUE 'FIX_BUG';
ALTER TYPE action_enum ADD VALUE 'TRAIN';
ALTER TYPE action_enum ADD VALUE 'HACK_RAID';
```

### Nuevos Endpoints API (`backend/api/routes/shop.py`)
| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `POST /api/shop/buy-food` | POST | Comprar café/snacks (energía) |
| `POST /api/shop/fix-bug` | POST | Fixear bug en un dev |
| `POST /api/shop/repair-pc` | POST | Reparar PC (pc_health → 100) |
| `POST /api/shop/start-training` | POST | Iniciar curso de training |
| `POST /api/shop/graduate` | POST | Completar training (aplicar bonus) |
| `POST /api/shop/hack` | POST | Ejecutar raid contra otro dev |

### Cambios al Engine (`backend/engine/engine.py`)
1. **Budget cap** en `execute_action()`: solo gastar hasta 40% del balance
2. **PC degradation:** -5% pc_health por día (en `pay_salaries()`)
3. **PC penalty:** si pc_health < 50%, reducir probabilidades de acciones productivas
4. **Bug generation:** 1-3 bugs aleatorios por día (en el scheduler)
5. **Training check:** si dev tiene training activo, no puede hacer acciones costosas

### Cambios al Frontend
1. **MyDevs.jsx / DevCard:** Agregar barras de PC Health, botones de comida, training status
2. **DevProfile (modal):** Panel detallado con todas las mecánicas
3. **CorpWars.jsx:** Feed de raids/hacks
4. **Notifications:** Alertas de bugs, raids, training completado

---

## 12. Archivos Clave

| Archivo | Propósito | Líneas Relevantes |
|---------|-----------|-------------------|
| `backend/engine/config.py` | Constantes económicas | 43-69 |
| `backend/engine/engine.py` | Simulación completa | 31-40 (weights), 96-181 (modifiers), 260-405 (execute), 735-776 (salary) |
| `backend/api/routes/shop.py` | Tienda existente | 12-50 (items), 66-132 (buy endpoint) |
| `backend/db/schema.sql` | Estructura de DB | 80-166 (devs), 316-324 (shop_purchases) |
| `backend/engine/claim_sync.py` | Sync on-chain | 70-120 (balance flow) |
| `frontend/src/windows/MyDevs.jsx` | Vista de devs | 194-290 (DevCard) |
| `frontend/src/windows/NxtWallet.jsx` | Wallet + claim | 56-205 (ClaimSection) |
