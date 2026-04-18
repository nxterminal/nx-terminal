# NX Terminal Economic Refactor + NX_FUTURES Launch

Checklist ejecutable del roadmap completo. Ver `audit_reports/ECONOMY_AUDIT_FINAL.md` para contexto completo de cada PR.

**Regla de oro**: marcá cada box al mergear. No al empezar, no al terminar el código — al mergear el PR a main. Es el único evento que cuenta.

---

## Fase 0 — HACK_RAID hotfix (1 noche)

- [ ] PR 0.1 FOR UPDATE en shop.py:685

---

## Fase 1 — Observabilidad (2-3 noches)

- [ ] PR 1.1 Structured logging con correlation IDs
- [ ] PR 1.2 Tabla admin_logs append-only
- [ ] PR 1.3 Endpoint /admin/economy/summary
- [ ] PR 1.4 DRY_RUN explicit en render.yaml (pending verification)
- [ ] PR 1.5 Health check profundo

---

## Fase 2 — Hotfixes críticos restantes (3-4 noches)

- [ ] PR 2.1 Auth bypass fix en /claim-sync/force
- [ ] PR 2.2 record-claim verifica on-chain
- [ ] PR 2.3 SignerService con nonce lock
- [ ] PR 2.4 2-phase commit en sync
- [ ] PR 2.5 Event listener NXTClaimed
- [ ] PR 2.6 Rate limiter consistente en Redis

---

## Fase 3 — Ledger shadow mode (1 semana)

- [ ] PR 3.1 Schema nxt_ledger
- [ ] PR 3.2 Función ledger_insert()
- [ ] PR 3.3 Shadow write salary (engine.py:957)
- [ ] PR 3.4 Shadow write sell_investment (engine.py:475)
- [ ] PR 3.5 Shadow write fund_deposit shop (shop.py:950)
- [ ] PR 3.6 Shadow write fund_deposit pending (engine.py:1400)
- [ ] PR 3.7 Shadow write fund_deposit orphan (engine.py:1578)
- [ ] PR 3.8 Shadow write hack_mainframe (shop.py:569)
- [ ] PR 3.9 Shadow write hack_raid éxito (shop.py:714)
- [ ] PR 3.10 Shadow write hack_raid fallo (shop.py:774)
- [ ] PR 3.11 Shadow write transfer (shop.py:1035)
- [ ] PR 3.12 Shadow write mission_claim (missions.py:329)
- [ ] PR 3.13 Shadow write achievement (achievements.py:241)
- [ ] PR 3.14 Shadow write streak (streaks.py:122)
- [ ] PR 3.15 Shadow write backfill (backfill_funds.py:248)
- [ ] PR 3.16 Reconciliation job en cron
- [ ] Validar 7 días de reconciliación limpia

---

## Fase 4 — Service layer (1 semana)

- [ ] PR 4.1 Función credit_dev()
- [ ] PR 4.2 Migrar streak_claim
- [ ] PR 4.3 Migrar achievement_claim
- [ ] PR 4.4 Migrar mission_claim
- [ ] PR 4.5 Migrar salary (adaptar a batch_credit_devs)
- [ ] PR 4.6 Migrar sell_investment
- [ ] PR 4.7 Migrar fund_deposit shop
- [ ] PR 4.8 Migrar fund_deposit pending
- [ ] PR 4.9 Migrar fund_deposit orphan
- [ ] PR 4.10 Migrar hack_mainframe
- [ ] PR 4.11 Migrar hack_raid (2 callsites éxito)
- [ ] PR 4.12 Migrar hack_raid (2 callsites fallo)
- [ ] PR 4.13 Migrar transfer (2 callsites)
- [ ] PR 4.14 Migrar backfill_manual
- [ ] PR 4.15 Remover flag LEGACY_BALANCE_UPDATES
- [ ] Validar 14 días de reconciliación limpia

---

## Fase 5 — Frontend refactor (1.5 semanas)

- [ ] PR 5.1 useWallet normalizado
- [ ] PR 5.2 useBalance hook
- [ ] PR 5.3 useSignAndSendTx hook (fixea timeout-asume-éxito)
- [ ] PR 5.4 TxStatusModal component
- [ ] PR 5.5 DualBalance component
- [ ] PR 5.6 TxHashLink component
- [ ] PR 5.7 Refactor NxtWallet.jsx usando los hooks/componentes nuevos
- [ ] PR 5.8 Decisión sobre deducciones ficticias del pay stub
- [ ] PR 5.9 WebSocket push para balance updates

---

## Fase 6 — NX_FUTURES construcción (4-6 semanas)

### Backend
- [ ] PR 6.1 Schema nxfutures (markets, positions, trades, comments, follows, leaderboard)
- [ ] PR 6.2 LMSR pricing en services/lmsr.py
- [ ] PR 6.3 POST /api/nxfutures/markets (crear market)
- [ ] PR 6.4 GET /api/nxfutures/markets (listar)
- [ ] PR 6.5 POST /api/nxfutures/markets/{id}/buy
- [ ] PR 6.6 POST /api/nxfutures/positions/{id}/sell
- [ ] PR 6.7 POST /api/nxfutures/markets/{id}/resolve (admin)
- [ ] PR 6.8 Oracle worker auto-resolve (CoinGecko + on-chain)
- [ ] PR 6.9 Leaderboard worker semanal (12,500 NXT distribución)

### Frontend
- [ ] PR 6.10 MarketFeed con filtros
- [ ] PR 6.11 MarketCard component
- [ ] PR 6.12 MarketDetail con chart
- [ ] PR 6.13 TradePanel
- [ ] PR 6.14 Portfolio view
- [ ] PR 6.15 Leaderboard view
- [ ] PR 6.16 CreateMarketModal

### Launch
- [ ] PR 6.17 Feature flag NXFUTURES_ENABLED + launch gradual
- [ ] Semana 1: solo ADMIN_WALLETS
- [ ] Semana 2-3: beta list (50 wallets)
- [ ] Semana 4+: público

---

## Fase 7 — On-chain hardening

- [ ] PR 7.1 Recuperar source v8/v9 del explorer y commitear
- [ ] PR 7.2 Centralizar contract addresses en shared/contracts.json
- [ ] PR 7.3 Multi-sig para treasury wallet
- [ ] PR 7.4 Audit externo (Code4rena / OZ / Trail of Bits)
- [ ] PR 7.5 Contract upgrade con whenNotPaused en batchSetClaimableBalance
- [ ] PR 7.6 Signer migrado a KMS/HSM (AWS KMS / Turnkey / Fireblocks)

---

## Checklist pre-launch NX_FUTURES público

Antes de activar el feature flag para usuarios generales:

- [ ] Fase 0 completa
- [ ] Fase 1 completa con observability operativa
- [ ] Fase 2 completa con todos los hotfixes deployados
- [ ] Fase 3 con reconciliación limpia 7 días consecutivos
- [ ] Fase 4 con todos los callsites migrados a credit_dev
- [ ] Fase 5 con frontend refactorizado
- [ ] Fase 6 completa con beta test exitoso (2+ semanas)
- [ ] Fase 7 al menos PR 7.1 y 7.2 (source v9 y addresses centralizadas)
- [ ] Runbook de incidentes documentado
- [ ] Monitoring activo (balances, signer gas, divergencias)
- [ ] Plan de comunicación para users nuevos y existentes

**Nota**: Fase 7.3-7.6 pueden ejecutarse post-launch público mientras el volumen sea bajo. El audit externo es idealmente pre-launch pero puede hacerse después si no hay listing público del token todavía.

---

## Estimación de tiempo total

Con un solo dev trabajando evenings + weekends:

| Fase | Estimación |
|------|-----------|
| 0 | 1 noche |
| 1 | ~1 semana |
| 2 | ~1.5 semanas |
| 3 | ~2 semanas |
| 4 | ~2 semanas |
| 5 | ~1.5 semanas |
| 6 | ~4-6 semanas |
| 7 | variable (depende de audit) |
| **Total** | **3-4 meses hasta Fase 6, + Fase 7 en paralelo o post-launch** |

---

## Filosofía de trabajo

1. **Zero-downtime siempre**. Cada PR debe poder mergearse sin que los users se enteren.
2. **Shadow-first**. Sistemas nuevos corren en paralelo al viejo antes de reemplazarlo.
3. **Feature flags para todo**. Rollback instantáneo sin redeploy.
4. **PRs chicos** (<500 líneas idealmente).
5. **Tests antes del fix**. Escribir el test que reproduce el bug, después el fix.
6. **No apurarse**. El sistema funciona hoy. La deuda puede esperar a que se arregle con cuidado.
7. **Descansar**. Este proyecto es largo. Burnout = más bugs.

---

## Referencias

- `audit_reports/ECONOMY_AUDIT_FINAL.md` — Auditoría completa del sistema actual
- `audit_reports/STEP_6a_integration_plan.md` — Plan detallado Fases 0-4
- `audit_reports/STEP_6b_integration_plan.md` — Plan detallado Fases 5-7
