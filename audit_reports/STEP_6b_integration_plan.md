# Paso 6b — Plan de integración NX_FUTURES: Construcción y hardening (Fases 5-7)

**Pre-requisito**: `STEP_6a_integration_plan.md` completo (Fases 0-4). Base económica refactorizada, ledger validado, service layer funcionando.

---

## FASE 5 — Frontend refactor

**Objetivo**: extraer hooks y componentes reutilizables de NxtWallet.jsx ANTES de construir NX_FUTURES. Sin esto, cada feature nueva propagaría los bugs actuales.

**Duración estimada**: 1 semana (8 PRs).

### Principios

- Cero cambios de UX visible
- Tests de regresión: el componente original sigue funcionando idéntico
- Cada PR extrae UNA pieza reutilizable

### PR 5.1 — useWallet normalizado

**Archivo nuevo**: `frontend/src/hooks/useWallet.js` (ampliar el existente)

```javascript
export function useWallet() {
  const { address, isConnected, chainId } = useAccount();
  
  return {
    address: address?.toLowerCase() ?? null,
    isConnected,
    isOnCorrectChain: chainId === MEGAETH_CHAIN_ID,
    chainId,
  };
}
```

### PR 5.2 — useBalance hook

**Archivo nuevo**: `frontend/src/hooks/useBalance.js`

```javascript
export function useBalance({
  walletAddress,
  source = 'both', // 'offchain' | 'onchain' | 'both'
  pollInterval = 30000,
}) {
  const [data, setData] = useState({
    offchain: null,
    onchain: null,
    loading: true,
    error: null,
  });
  
  const fetch = useCallback(async () => {
    try {
      const results = {};
      
      if (source === 'offchain' || source === 'both') {
        const r = await api.get(`/players/${walletAddress}/wallet-summary`);
        results.offchain = r.data.balance_claimable;
      }
      
      if (source === 'onchain' || source === 'both') {
        const balance = await readContract({
          address: NXT_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress],
        });
        results.onchain = balance;
      }
      
      setData({ ...results, loading: false, error: null });
    } catch (err) {
      setData(d => ({ ...d, loading: false, error: err.message }));
    }
  }, [walletAddress, source]);
  
  useEffect(() => {
    if (!walletAddress) return;
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [walletAddress, pollInterval, fetch]);
  
  return { ...data, refetch: fetch };
}
```

### PR 5.3 — useSignAndSendTx hook

**Archivo nuevo**: `frontend/src/hooks/useSignAndSendTx.js`

```javascript
export function useSignAndSendTx() {
  const [state, setState] = useState({
    status: 'idle', // idle | signing | mining | success | error | timeout_unknown
    txHash: null,
    receipt: null,
    error: null,
  });
  
  const send = useCallback(async ({ abi, address, functionName, args }) => {
    setState({ status: 'signing', txHash: null, receipt: null, error: null });
    
    try {
      const txHash = await writeContract({ abi, address, functionName, args });
      setState({ status: 'mining', txHash, receipt: null, error: null });
      
      const receipt = await waitForTransactionReceipt({ 
        hash: txHash, 
        timeout: 60_000 
      });
      
      if (receipt.status === 'success') {
        setState({ status: 'success', txHash, receipt, error: null });
      } else {
        setState({ status: 'error', txHash, receipt, error: 'Transaction reverted' });
      }
      
      return { txHash, receipt };
    } catch (err) {
      if (err.message?.includes('timeout')) {
        // IMPORTANTE: NO asumir success en timeout
        setState({ 
          status: 'timeout_unknown', 
          txHash: state.txHash, 
          receipt: null, 
          error: 'Transaction is taking longer than expected. Check the explorer.' 
        });
      } else if (err.message?.includes('rejected')) {
        setState({ status: 'error', txHash: null, receipt: null, error: 'Rejected in MetaMask' });
      } else {
        setState({ status: 'error', txHash: state.txHash, receipt: null, error: err.message });
      }
      throw err;
    }
  }, [state.txHash]);
  
  const reset = useCallback(() => {
    setState({ status: 'idle', txHash: null, receipt: null, error: null });
  }, []);
  
  return { ...state, send, reset };
}
```

**IMPORTANTE**: este hook fixea el bug "timeout-asume-éxito". Estado `timeout_unknown` obliga al UI a decirle al user "chequeá el explorer" en vez de mostrar ✅.

### PR 5.4 — TxStatusModal component

**Archivo nuevo**: `frontend/src/components/TxStatusModal.jsx`

Modal unificado que muestra el estado de una tx con link al explorer, manejo de todos los estados (idle/signing/mining/success/error/timeout_unknown). Reutilizable en cualquier feature que firme txs.

### PR 5.5 — DualBalance component

**Archivo nuevo**: `frontend/src/components/DualBalance.jsx`

Extrae el patrón actual de NxtWallet.jsx líneas 622-641 (las dos cards de balance):

```jsx
export function DualBalance({ 
  offChain, onChain, 
  offChainLabel = "In-game Balance", 
  onChainLabel = "Wallet Balance" 
}) {
  return (
    <div className="dual-balance">
      <BalanceCard 
        label={offChainLabel} 
        value={offChain} 
        color="#ffff00"
      />
      <BalanceCard 
        label={onChainLabel} 
        value={onChain} 
        color="#00ff66"
      />
    </div>
  );
}
```

Preparado para extender a N balances (importante para NX_FUTURES: va a haber "in-game" + "wallet" + "trading positions").

### PR 5.6 — TxHashLink component

**Archivo nuevo**: `frontend/src/components/TxHashLink.jsx`

Componente único para linkear a explorer. Elimina las 3 copias duplicadas que vimos.

### PR 5.7 — Refactor NxtWallet.jsx

Usar los hooks/componentes nuevos. El archivo debería bajar de ~880 líneas a ~400.

**Tests manuales obligatorios**:
- Claim parcial 25/50/75/100% → funciona igual que antes
- Visualización de balances → igual
- Pay stub (con o sin deducciones ficticias) → decidir en paralelo
- Errores → mismas UIs

### PR 5.8 — Decisión sobre deducciones ficticias

**Opción A**: remover deducciones si v8/v9 no tiene fee real.
**Opción B**: mantener pero ser transparente ("simulated deductions for flavor, actual fee: 0%")
**Opción C**: hacer deducciones reales (2% de fee real enviado al treasury)

Recomendación: **Opción C para NX_FUTURES**. Establece el patrón de fees reales desde el principio. Si hoy no hay fee en claim, que el primer fee real sea el de NX_FUTURES.

### PR 5.9 — WebSocket push para balances

Activar el `useWebSocket.js` existente. Backend emite eventos cuando cambia balance. Frontend reemplaza polling 90s por push real-time.

Impacto en NX_FUTURES: precios de markets, ordenes ejecutadas, todo push.

**Done con Fase 5 cuando**:
- NxtWallet.jsx usa los hooks/componentes nuevos
- Bug timeout-asume-éxito fixed
- Deducciones ficticias resueltas
- WebSocket activo para balance updates
- Código reutilizable listo para NX_FUTURES

---

## FASE 6 — NX_FUTURES construcción

**Objetivo**: construir el sistema de prediction markets usando toda la infraestructura refactorizada.

**Duración estimada**: 3-4 semanas.

**Filosofía**: Todo off-chain. Reusa NXT existente. Zero contract deploys nuevos (al menos en v1).

### Arquitectura resumen

```
┌──────────────────────────────────────────────────┐
│  FRONTEND                                         │
│  - DualBalance (extendido a 3 balances)           │
│  - Components nuevos: MarketCard, TradePanel,     │
│    Leaderboard, Portfolio                         │
│  - useSignAndSendTx para claims                   │
│  - WebSocket para precios real-time               │
└──────────────────────────────────────────────────┘
                    ↓ HTTP + WebSocket
┌──────────────────────────────────────────────────┐
│  BACKEND                                          │
│  - Endpoints /api/nxfutures/*                     │
│  - LMSR pricing en services/lmsr.py               │
│  - Settle worker en engine/                       │
│  - Oracle worker (CoinGecko + on-chain reads)     │
│  - Reusa: credit_dev, signer, ledger, claim flow  │
└──────────────────────────────────────────────────┘
                    ↓ Postgres
┌──────────────────────────────────────────────────┐
│  DB                                               │
│  - Tablas nuevas: nxfutures_markets,              │
│    nxfutures_positions, nxfutures_trades, etc.    │
│  - Reusa: players, devs, nxt_ledger               │
└──────────────────────────────────────────────────┘
```

### PR 6.1 — Schema NX_FUTURES

**Migration**: `backend/db/migrations/XXX_nxfutures_schema.sql`

```sql
-- Markets
CREATE TABLE nxfutures_markets (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  resolution_source TEXT NOT NULL,
  resolution_type TEXT NOT NULL,
  source_config JSONB,
  creator_wallet VARCHAR(42) REFERENCES players(wallet_address),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  
  status TEXT NOT NULL DEFAULT 'open',
  
  initial_liquidity_nxt BIGINT NOT NULL DEFAULT 1000,
  seed_yes BIGINT NOT NULL,
  seed_no BIGINT NOT NULL,
  
  price_yes NUMERIC(5,4) NOT NULL,
  total_volume_nxt BIGINT NOT NULL DEFAULT 0,
  total_trades INT NOT NULL DEFAULT 0,
  
  winner TEXT,
  
  CHECK (status IN ('open', 'pending_resolution', 'resolved', 'invalid')),
  CHECK (price_yes BETWEEN 0.0001 AND 0.9999),
  CHECK (resolution_type IN ('manual', 'auto_coingecko', 'auto_onchain_supply', 'auto_onchain_balance')),
  CHECK (winner IS NULL OR winner IN ('YES', 'NO'))
);

CREATE INDEX idx_markets_status_closes 
  ON nxfutures_markets(status, closes_at);
CREATE INDEX idx_markets_category 
  ON nxfutures_markets(category);

-- Positions
CREATE TABLE nxfutures_positions (
  id BIGSERIAL PRIMARY KEY,
  market_id BIGINT NOT NULL REFERENCES nxfutures_markets(id),
  wallet_address VARCHAR(42) NOT NULL REFERENCES players(wallet_address),
  dev_token_id BIGINT NOT NULL REFERENCES devs(token_id),
  
  side TEXT NOT NULL,
  shares NUMERIC(20,6) NOT NULL,
  cost_basis_nxt BIGINT NOT NULL,
  avg_price NUMERIC(5,4) NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'open',
  realized_pnl BIGINT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (side IN ('YES', 'NO')),
  CHECK (status IN ('open', 'sold', 'won', 'lost')),
  CHECK (shares > 0)
);

CREATE INDEX idx_positions_market_status 
  ON nxfutures_positions(market_id, status);
CREATE INDEX idx_positions_wallet_status 
  ON nxfutures_positions(wallet_address, status);
CREATE INDEX idx_positions_dev 
  ON nxfutures_positions(dev_token_id);

-- Trades (log append-only)
CREATE TABLE nxfutures_trades (
  id BIGSERIAL PRIMARY KEY,
  market_id BIGINT NOT NULL REFERENCES nxfutures_markets(id),
  position_id BIGINT REFERENCES nxfutures_positions(id),
  wallet_address VARCHAR(42) NOT NULL,
  dev_token_id BIGINT NOT NULL,
  
  action TEXT NOT NULL,
  side TEXT NOT NULL,
  shares NUMERIC(20,6) NOT NULL,
  price NUMERIC(5,4) NOT NULL,
  amount_gross_nxt BIGINT NOT NULL,
  fee_nxt BIGINT NOT NULL,
  amount_net_nxt BIGINT NOT NULL,
  
  price_before NUMERIC(5,4),
  price_after NUMERIC(5,4),
  
  ledger_id BIGINT REFERENCES nxt_ledger(id),
  correlation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (action IN ('buy', 'sell', 'settle_win', 'settle_loss')),
  CHECK (side IN ('YES', 'NO'))
);

CREATE INDEX idx_trades_market_time 
  ON nxfutures_trades(market_id, created_at DESC);
CREATE INDEX idx_trades_wallet_time 
  ON nxfutures_trades(wallet_address, created_at DESC);

-- Market comments
CREATE TABLE nxfutures_comments (
  id BIGSERIAL PRIMARY KEY,
  market_id BIGINT NOT NULL REFERENCES nxfutures_markets(id),
  wallet_address VARCHAR(42) NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  side_at_post TEXT,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follows
CREATE TABLE nxfutures_follows (
  follower_wallet VARCHAR(42) NOT NULL,
  followed_wallet VARCHAR(42) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_wallet, followed_wallet),
  CHECK (follower_wallet != followed_wallet)
);

-- Leaderboard snapshots
CREATE TABLE nxfutures_leaderboard_snapshots (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  pnl_nxt BIGINT NOT NULL,
  volume_nxt BIGINT NOT NULL,
  trades_count INT NOT NULL,
  win_rate NUMERIC(5,4),
  rank INT NOT NULL,
  reward_nxt BIGINT,
  UNIQUE (period_start, period_end, wallet_address)
);
```

### PR 6.2 — LMSR pricing logic

**Archivo**: `backend/services/lmsr.py`

```python
def calculate_trade(
    current_price_yes: float,
    liquidity: int,
    amount_nxt: int,
    side: str,  # 'YES' | 'NO'
) -> dict:
    """
    Calcula shares recibidas y nuevo precio tras un trade.
    """
    FEE_BPS = 200  # 2%
    
    fee = amount_nxt * FEE_BPS // 10000
    net_amount = amount_nxt - fee
    
    entry_price = current_price_yes if side == 'YES' else (1 - current_price_yes)
    shares = net_amount / entry_price
    
    impact = min(0.05, (amount_nxt / max(5000, liquidity)) * 0.3)
    
    if side == 'YES':
        new_price_yes = min(0.9999, current_price_yes + impact)
    else:
        new_price_yes = max(0.0001, current_price_yes - impact)
    
    return {
        'shares': shares,
        'fee_nxt': fee,
        'amount_net_nxt': net_amount,
        'entry_price': entry_price,
        'new_price_yes': new_price_yes,
        'potential_payout_nxt': int(shares),
    }


def calculate_sell(
    current_price_yes: float,
    liquidity: int,
    shares: float,
    side: str,
) -> dict:
    """Proceeds de vender shares antes de resolución."""
    FEE_BPS = 200
    
    exit_price = current_price_yes if side == 'YES' else (1 - current_price_yes)
    gross = int(shares * exit_price)
    fee = gross * FEE_BPS // 10000
    net = gross - fee
    
    impact = min(0.04, (gross / max(5000, liquidity)) * 0.3)
    if side == 'YES':
        new_price_yes = max(0.0001, current_price_yes - impact)
    else:
        new_price_yes = min(0.9999, current_price_yes + impact)
    
    return {
        'gross_nxt': gross,
        'fee_nxt': fee,
        'net_nxt': net,
        'exit_price': exit_price,
        'new_price_yes': new_price_yes,
    }
```

### PR 6.3 — Endpoint crear market

`POST /api/nxfutures/markets`

1. Validar wallet connected + caller tiene dev activo
2. Validar question/category/resolution_source
3. Debitar 500 NXT del dev con `credit_dev` (source='nxfutures_create_market')
4. Initial liquidity: treasury debita 1000 NXT a pool del mercado (accounting interno)
5. INSERT market con seed_yes=500, seed_no=500, price_yes=0.5

### PR 6.4 — Endpoint listar markets

`GET /api/nxfutures/markets?category=X&status=open`

### PR 6.5 — Endpoint trade (buy)

`POST /api/nxfutures/markets/{id}/buy`

Request: `{ dev_token_id, side, amount_nxt }`

1. Validar ownership del dev
2. Validar market status='open' y closes_at>NOW
3. `SELECT market FOR UPDATE`
4. Calcular con `calculate_trade()`
5. `credit_dev(dev_token_id, -amount_nxt, source='nxfutures_buy_yes'|'nxfutures_buy_no', ref_table='nxfutures_markets', ref_id=market.id)`
6. Crear/merge position
7. Actualizar market price + volume
8. INSERT trade
9. Emit WebSocket event

### PR 6.6 — Endpoint sell

`POST /api/nxfutures/positions/{id}/sell`

### PR 6.7 — Endpoint resolve market (admin)

`POST /api/nxfutures/markets/{id}/resolve`

Request: `{ winner: 'YES' | 'NO' | 'INVALID' }`. Solo `ADMIN_WALLETS`.

1. Validar market status='pending_resolution'
2. For each position in market:
   - Si won: `credit_dev(+payout, source='nxfutures_settle_win')`
   - Si lost: nada
   - Si invalid: refund cost_basis
3. Update market status='resolved', winner
4. INSERT trades action='settle_win'/'settle_loss'

### PR 6.8 — Oracle worker auto-resolve

`backend/engine/nxfutures_oracle.py`

Cada 5 min:
1. `SELECT markets WHERE closes_at <= NOW AND status='open'` → marcar `pending_resolution`
2. Para markets con `resolution_type='auto_*'`, llamar al source (CoinGecko API, on-chain read) y resolver automáticamente

### PR 6.9 — Leaderboard worker

Cada lunes 00:00 UTC:
1. Calcular ranking de la semana (PnL, volume, win_rate)
2. INSERT snapshot
3. Distribuir 12,500 NXT a top 10 (via `credit_dev` del primer dev de cada)

### PR 6.10-6.16 — Frontend NX_FUTURES

Componentes nuevos:
- `<MarketFeed />` con filtros
- `<MarketCard />` con botones YES/NO
- `<MarketDetail />` con chart + trade panel
- `<TradePanel />` usando useBalance + useSignAndSendTx
- `<Portfolio />` con positions abiertas y cerradas
- `<Leaderboard />` con podium y tabla
- `<CreateMarketModal />`

Todos los montos y precios pasan por `<TxHashLink />`, `<DualBalance />`, etc.

### PR 6.17 — Launch gradual

1. Feature flag `NXFUTURES_ENABLED=false` por defecto
2. Activar solo para ADMIN_WALLETS durante 1 semana
3. Activar para beta list (50 wallets) durante 2 semanas
4. Activar público

**Done con Fase 6 cuando**: usuarios pueden crear markets, tradear, ver portfolio, recibir rewards semanales.

---

## FASE 7 — On-chain hardening

**Objetivo**: cerrar deuda de seguridad del stack on-chain. No bloquea NX_FUTURES pero debe ejecutarse antes de volumen significativo.

**Duración estimada**: variable (depende de audit externo).

### PR 7.1 — Recuperar source v8/v9 del explorer

1. Ir a explorer de MegaETH
2. Buscar 0x5fe9...07F7 (NXDevNFT)
3. Pestaña Contract → Source Code
4. Copiar source a `contracts/NXDevNFT_v9.sol`
5. Commitear al repo
6. Hacer lo mismo con NXTToken
7. Actualizar docstrings en `claim_sync.py` y `players.py`
8. Verificar ABI en `frontend/src/services/contract.js` sincronizado con v9

### PR 7.2 — Centralizar contract addresses

**Archivo nuevo**: `shared/contracts.json`

```json
{
  "megaeth_mainnet": {
    "chainId": 4326,
    "rpc": "https://mainnet.megaeth.com/rpc",
    "contracts": {
      "NXTToken": "0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47",
      "NXDevNFT": "0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7"
    },
    "wallets": {
      "treasury": "0x31d6E19aAE43B5E2fbeDb01b6FF82AD1e8B576DC"
    }
  }
}
```

Tanto backend (Python) como frontend (JS) leen de este JSON. Una sola fuente de verdad.

### PR 7.3 — Multi-sig para treasury

Migrar el treasury wallet a Safe (o equivalente en MegaETH). Requiere 2-of-3 firmas para mover fondos.

Operativamente: emergencias requieren 2 firmantes online. En día a día no impacta nada porque el treasury no mueve fondos (solo recibe).

### PR 7.4 — Audit externo

Opciones ordenadas por costo:
- **Code4rena / Sherlock** (contests competitivos): ~15-30k USD, 1-4 semanas
- **OpenZeppelin Audits**: ~50-150k USD, 4-8 semanas
- **Trail of Bits**: ~80-200k USD, 6-12 semanas

Scope: solo NXTToken + NXDevNFT. NX_FUTURES es off-chain, no requiere audit.

Timing: **antes de cualquier listing público del token** o volumen > 100k NXT/día.

### PR 7.5 — Contract upgrade con whenNotPaused

Si el audit revela issues (y probablemente revelará algunos), preparar v10 con fixes:
- `whenNotPaused` en `batchSetClaimableBalance` (previene deadlock si se pausa)
- Role-based access control (granular en vez de backendSigner god-mode)
- Event emission más rica para reconciliación

Deploy, migrar state, actualizar `claim_sync.py`.

### PR 7.6 — Migrar signer a KMS/HSM

Opciones (ordenadas por complejidad):
- **AWS KMS**: signer key gestionada por AWS, backend firma via API
- **Turnkey / Fireblocks**: servicios especializados en crypto signing
- **HashiCorp Vault**: auto-hosteado

Elimina el riesgo de que la env var se filtre.

**Done con Fase 7 cuando**:
- Source v9 en repo
- Contract addresses centralizados
- Treasury multi-sig
- Audit externo completado con fixes implementados
- Signer no vive en env vars planas

---

## Tracking del progreso

Crear `TRACKING.md` en el repo con:

```markdown
# NX Terminal Economic Refactor + NX_FUTURES Launch

## Fase 0 — HACK_RAID hotfix
- [ ] PR 0.1 FOR UPDATE

## Fase 1 — Observabilidad
- [ ] PR 1.1 Structured logging
- [ ] PR 1.2 admin_logs table
- [ ] PR 1.3 /admin/economy/summary
- [ ] PR 1.4 DRY_RUN explicit (pending verification)
- [ ] PR 1.5 Deep health check

## Fase 2 — Hotfixes críticos
- [ ] PR 2.1 Auth bypass fix
- [ ] PR 2.2 record-claim verify on-chain
- [ ] PR 2.3 SignerService con nonce lock
- [ ] PR 2.4 2-phase commit sync
- [ ] PR 2.5 NXTClaimed listener
- [ ] PR 2.6 Rate limiter Redis

## Fase 3 — Ledger shadow
- [ ] PR 3.1 Schema nxt_ledger
- [ ] PR 3.2 ledger_insert()
- [ ] PR 3.3-3.15 Shadow writes (13 callsites)
- [ ] PR 3.16 Reconciliation job
- [ ] Validar 7 días limpio

## Fase 4 — Service layer
- [ ] PR 4.1 credit_dev()
- [ ] PR 4.2-4.14 Migrar 13 callsites
- [ ] PR 4.15 Remove legacy flag
- [ ] Validar 14 días limpio

## Fase 5 — Frontend refactor
- [ ] PR 5.1-5.9 hooks, componentes, WebSocket

## Fase 6 — NX_FUTURES
- [ ] PR 6.1 Schema
- [ ] PR 6.2 LMSR
- [ ] PR 6.3-6.9 Endpoints + workers
- [ ] PR 6.10-6.16 Frontend
- [ ] PR 6.17 Launch gradual

## Fase 7 — On-chain hardening
- [ ] PR 7.1 Recuperar source v9
- [ ] PR 7.2 Centralizar addresses
- [ ] PR 7.3 Multi-sig treasury
- [ ] PR 7.4 Audit externo
- [ ] PR 7.5 Contract upgrade
- [ ] PR 7.6 Signer a KMS
```

---

## Checklist final antes de NX_FUTURES launch público

- [ ] Fase 0 completa
- [ ] Fase 1 completa con observability operativa
- [ ] Fase 2 completa con todos los hotfixes deployados
- [ ] Fase 3 con reconciliación limpia 7 días
- [ ] Fase 4 con todos los callsites migrados a credit_dev
- [ ] Fase 5 con frontend refactorizado
- [ ] Fase 6 completa con beta test exitoso
- [ ] Fase 7 al menos PR 7.1 + 7.2 (source y addresses)
- [ ] Runbook de incidentes documentado
- [ ] Monitoring activo (balances, signer gas, divergencias)

**Fase 7.3-7.6 pueden ocurrir post-launch público mientras el volumen sea bajo.**

---

## Estimación de tiempo total

Con un solo dev (Ariel) trabajando evenings + weekends, estimación realista:

- Fase 0: 1 noche
- Fase 1: 2-3 noches → ~1 semana
- Fase 2: 3-4 noches → ~1.5 semanas
- Fase 3: 15 PRs chicos → ~2 semanas (incluye validation time)
- Fase 4: 14 PRs → ~2 semanas
- Fase 5: 8 PRs → ~1.5 semanas
- Fase 6: construcción + beta → ~4-6 semanas
- Fase 7: depende de audit externo

**Total realista**: 3-4 meses desde hoy hasta NX_FUTURES público con Fases 0-6 completas. Fase 7 puede estirarse hasta 6-9 meses dependiendo de cuándo se haga el audit.

---

## Riesgos identificados

### Riesgo 1: DRY_RUN en producción sin verificar
**Mitigación**: PR 1.4 condicional a verificación previa.

### Riesgo 2: Ledger shadow mode revela divergencias que no sabemos fixear
**Mitigación**: hacer reconciliation job con rollback fácil y logs detallados.

### Riesgo 3: Refactor de frontend rompe UX sin que nadie lo note hasta que el user reporta
**Mitigación**: PR chicos + testing manual obligatorio por cada componente extraído.

### Riesgo 4: Bug sutil en credit_dev afecta todos los 13 callsites a la vez
**Mitigación**: feature flag LEGACY_BALANCE_UPDATES + tests exhaustivos antes de merge.

### Riesgo 5: NX_FUTURES tracción muy alta rompe rate limits o saturación del signer
**Mitigación**: launch gradual con feature flag. Monitoring activo desde Fase 1.

### Riesgo 6: Burnout del único dev
**Mitigación**: PRs chicos, celebrar cada merge, no trabajar cuando no hay energía, preservar horas de descanso.

---

## Conclusión

El sistema actual es funcional pero tiene deuda técnica crítica que se multiplicaría con NX_FUTURES. Este plan:

1. **Cierra vulnerabilidades explotables hoy** (Fase 0 + Fase 2)
2. **Construye observabilidad** antes de tocar comportamientos (Fase 1)
3. **Refactoriza sin romper** vía shadow mode (Fase 3)
4. **Centraliza y limpia** la base (Fase 4 + 5)
5. **Construye NX_FUTURES** sobre base sólida (Fase 6)
6. **Hardening final** post-launch o pre-volumen alto (Fase 7)

La filosofía es: **zero-downtime, shadow-first, feature flags, PRs chicos, tests antes de fixes**. Todo pensado para un solo dev con tiempo limitado que no puede permitirse disruption de los users actuales.

Con este plan ejecutado correctamente, NX_FUTURES lanza sobre una base sólida y el sistema entero queda preparado para el siguiente capítulo del proyecto.
