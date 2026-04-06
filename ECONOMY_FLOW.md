# NX TERMINAL: $NXT Economy Flow — Complete Analysis

> **Read-only audit.** No code changes. Traces every $NXT field from database to UI.

---

## TL;DR

- The NXT Wallet shows the **SUM of all devs' balances**, but each dev spends from its **OWN** `balance_nxt`.
- If a specific dev has 0 $NXT, buying food for that dev fails — even if the wallet total looks healthy.
- Devs auto-spend on protocols, AIs, and investments with no hard budget cap. They can drain their own balance to ~3 $NXT.
- Claim sync (`COLLECT`) zeros out `balance_nxt` for synced devs, leaving them unable to buy anything until salary accumulates.
- The error message "Not enough $NXT" refers to the **individual dev's balance**, not the wallet total.

---

## 1. What the User Sees in NXT Wallet

### Display Fields and Their Sources

| What the User Sees | Label in UI | Actual Source | How Calculated |
|---|---|---|---|
| In-game balance | `IN-GAME BALANCE` | `devs.balance_nxt` | `SUM(balance_nxt)` across ALL owned devs |
| Total earned | `TOTAL EARNED` | `devs.total_earned` | `SUM(total_earned)` across ALL owned devs |
| Total spent | `TOTAL SPENT` | `devs.total_spent` | `SUM(total_spent)` across ALL owned devs |
| Wallet balance | `WALLET BALANCE` | On-chain ERC-20 | `balanceOf(address)` RPC call to NXTToken contract |
| Daily salary | `SALARY/DAY` | Calculated | `total_devs × 200` (hardcoded) |

### Backend Query (players.py:109-144)

```sql
-- Fetches per-dev data, then Python sums the fields:
SELECT token_id, name, rarity_tier, balance_nxt, total_earned, total_spent, status
FROM devs
WHERE owner_address = %s
ORDER BY balance_nxt DESC
```

**Key insight:** There is no `players` table field for balance/earned/spent. Everything is aggregated from the `devs` table on every request. The `players` table only caches `balance_claimable` and `balance_claimed` for snapshots.

### Pay Stub Deductions (Frontend Only — NxtWallet.jsx:69-76)

When the user clicks COLLECT, the frontend shows a "pay stub" with themed deductions:

| Deduction | Percentage |
|---|---|
| Health Insurance (MegaETH) | 3% |
| Digital Life Insurance | 2% |
| Dev Union Fee | 2.5% |
| Anti-Hack Fund | 1.5% |
| Income Tax | 1% |
| **Total Deductions** | **10%** |

These map to the real 10% on-chain claim fee (`CLAIM_FEE_BPS = 1000` in the smart contract).

---

## 2. Per-Dev `balance_nxt` — Every Change

### What INCREASES balance_nxt

| Event | Amount | Also Updates | Code Location |
|---|---|---|---|
| Hourly salary | +9 $NXT | `total_earned += 9` | `engine.py:800-813` |
| Sell investment | Variable (shares × 0.5–1.8) | `total_earned += same` | `engine.py:415-420` |
| Hack success (attacker gains) | +20 to +40 $NXT | `total_earned += same` | `shop.py:396-402` |
| Mission claim reward | +15 to +2000 $NXT | `total_earned += same` | `missions.py:291` |

### What DECREASES balance_nxt

| Event | Amount | Also Updates | Code Location |
|---|---|---|---|
| CREATE_PROTOCOL (engine auto) | -3 $NXT | `total_spent += 3` | `engine.py:296-306` |
| CREATE_AI (engine auto) | -1 $NXT | `total_spent += 1` | `engine.py:333-340` |
| INVEST (engine auto) | -2 to -500 $NXT | `total_spent += same` | `engine.py:382-389` |
| Shop: Coffee | -5 $NXT | `total_spent += 5` | `shop.py:157-160` |
| Shop: Energy Drink XL | -12 $NXT | `total_spent += 12` | `shop.py:157-160` |
| Shop: Pizza | -25 $NXT | `total_spent += 25` | `shop.py:157-160` |
| Shop: MegaMeal | -50 $NXT | `total_spent += 50` | `shop.py:157-160` |
| Shop: PC Repair | -10 $NXT | `total_spent += 10` | `shop.py:157-160` |
| Shop: Training courses | -20 to -100 $NXT | `total_spent += same` | `shop.py:157-160` |
| Fix Bug | -5 $NXT | `total_spent += 5` | `shop.py:248-252` |
| Hack attempt (attacker cost) | -15 $NXT | `total_spent += 15` | `shop.py:384-387` |
| Hack victim (on success) | -20 to -40 $NXT | _(no total_spent)_ | `shop.py:396` |
| **Claim sync (COLLECT)** | **→ 0** | **nothing else** | **`claim_sync.py:99-102`** |

### What NEVER Changes balance_nxt

- Viewing wallet summary
- Browsing missions/leaderboard
- Chatting (CHAT action costs 0 energy, 0 $NXT)
- Resting (REST action costs 0 energy, 0 $NXT)
- Moving (MOVE costs 2 energy, 0 $NXT)
- Code review (costs 3 energy, 0 $NXT)

---

## 3. `total_earned` — Every Modification

`total_earned` is a cumulative counter on each dev. It only goes UP, never down.

| Event | Amount | Code Location |
|---|---|---|
| Hourly salary | +9 $NXT | `engine.py:803` |
| Sell investment | +Variable | `engine.py:417` |
| Hack success (attacker) | +20 to +40 | `shop.py:401` |
| Mission claim reward | +15 to +2000 | `missions.py:291` |

**NOT modified by:** shop purchases, engine auto-spending, claim sync, hack costs.

---

## 4. `total_spent` — Every Modification

`total_spent` is a cumulative counter on each dev. It only goes UP, never down.

| Event | Amount | Code Location |
|---|---|---|
| CREATE_PROTOCOL (engine) | +3 $NXT | `engine.py:299` |
| CREATE_AI (engine) | +1 $NXT | `engine.py:336` |
| INVEST (engine) | +Variable (2-500) | `engine.py:385` |
| Shop purchases (all items) | +item cost | `shop.py:158` |
| Fix Bug | +5 $NXT | `shop.py:249` |
| Hack attempt (attacker) | +15 $NXT | `shop.py:385` |

**NOT modified by:** salary, selling, mission rewards, claim sync, being hacked.

---

## 5. Complete $NXT Flow Diagram

```
                          ┌─────────────────────────┐
                          │   ENGINE (hourly cron)   │
                          │   pay_salaries()         │
                          │   +9 $NXT per dev        │
                          └──────────┬──────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    devs.balance_nxt                           │
│                    (per-dev field)                            │
│                                                              │
│  INFLOWS:                    OUTFLOWS:                       │
│  +9/hr salary                -3 create protocol (auto)       │
│  +N sell investment          -1 create AI (auto)             │
│  +20-40 hack success         -2..500 invest (auto)           │
│  +15-2000 mission reward     -5..100 shop purchases          │
│                              -15 hack attempt                │
│                              -5 fix bug                      │
│                              → 0 on COLLECT (claim sync)     │
└───────────────┬──────────────────────────────────┬───────────┘
                │                                  │
    ┌───────────▼───────────┐          ┌───────────▼───────────┐
    │  NXT Wallet Display   │          │  Shop / Actions       │
    │                       │          │                       │
    │  IN-GAME BALANCE =    │          │  CHECK per purchase:  │
    │  SUM of ALL devs'     │          │  dev.balance_nxt >=   │
    │  balance_nxt          │          │  item.cost_nxt        │
    │                       │          │                       │
    │  ⚠ This is AGGREGATE  │          │  ⚠ This checks the   │
    │  User sees total but  │          │  INDIVIDUAL dev, not  │
    │  each dev has its own │          │  the wallet total!    │
    └───────────┬───────────┘          └───────────────────────┘
                │
                │ User clicks COLLECT
                ▼
    ┌───────────────────────────────────┐
    │  Claim Sync Pipeline              │
    │                                   │
    │  1. POST /claim-sync/force        │
    │  2. Read balance_nxt for devs     │
    │  3. Push to on-chain contract:    │
    │     batchSetClaimableBalance()    │
    │  4. ✅ TX confirmed:              │
    │     UPDATE devs                   │
    │     SET balance_nxt = 0           │    ← BALANCE ZEROED
    │  5. Frontend calls claimNXT()     │
    │  6. Contract mints tokens:        │
    │     90% → player wallet           │
    │     10% → treasury (fee)          │
    └───────────────────────────────────┘
```

---

## 6. The Root Cause: "Has $NXT But Can't Buy Food"

### The Problem

The shop buy endpoint checks **the individual dev's balance**, not the wallet total:

```python
# shop.py:146-147
if dev["balance_nxt"] < item["cost_nxt"]:
    raise HTTPException(400, f"Not enough $NXT. Need {item['cost_nxt']}, have {dev['balance_nxt']}")
```

### Why It Fails

**Scenario 1: Wallet shows 500 $NXT, but spread unevenly**
```
Dev A: balance_nxt = 480 $NXT  ← can buy anything
Dev B: balance_nxt = 15 $NXT   ← can buy coffee (5), but not pizza (25)
Dev C: balance_nxt = 5 $NXT    ← can only buy coffee
Wallet total: 500 $NXT ← user sees this
```
User tries to buy pizza for Dev C → "Not enough $NXT. Need 25, have 5"

**Scenario 2: After COLLECT (claim sync)**
```
Before: Dev A = 300 $NXT, Dev B = 200 $NXT → Wallet shows 500
COLLECT syncs both devs → both balance_nxt = 0
After: Wallet shows 0 → nothing can be purchased
Salary resumes at +9/hr per dev → after 1 hour, each has 9 $NXT
```

**Scenario 3: Engine auto-spending drained the dev**
```
Engine continuously runs actions:
  - CREATE_PROTOCOL: -3 $NXT
  - CREATE_AI: -1 $NXT
  - INVEST: -2 to -500 $NXT (up to 20% of balance per investment)
No hard budget cap — dev keeps spending until balance < 3 $NXT
```

### The Missing Budget Cap

The config and documentation reference a "40% budget cap" for auto-spending, but **the engine code does not enforce any percentage-based budget cap**. The only guards are:

- `balance < 5` → blocks INVEST and CREATE_AI
- `balance < 3` → blocks CREATE_PROTOCOL (implicitly, since it costs 3)
- Low-balance devs get higher REST weight (but can still spend)

This means a dev earning 9 $NXT/hour can spend 3+1+variable every ~12 minutes (action cycle), potentially outspending their salary.

---

## 7. Invariants and Accounting Rules

### Always True

1. **Every balance_nxt decrease** (except claim sync and hack victim) has a matching `total_spent` increase
2. **Every balance_nxt increase** has a matching `total_earned` increase
3. `total_earned` and `total_spent` only go up, never down
4. `balance_nxt` has a DB constraint: `CHECK (balance_nxt >= 0)` — can never go negative
5. Claim sync sets `balance_nxt = 0` but does NOT touch `total_earned` or `total_spent`

### Theoretical Identity

In a world without claim sync:
```
balance_nxt ≈ starting_balance + total_earned - total_spent - hack_victim_losses
```

After claim syncs:
```
balance_nxt = total_earned - total_spent - all_claims - hack_victim_losses
```

(But `all_claims` is not tracked per-dev in a single field, so this can't be verified from one query.)

---

## 8. Key Differences: In-Game vs On-Chain

| Aspect | In-Game ($NXT) | On-Chain ($NXT Token) |
|---|---|---|
| Where stored | `devs.balance_nxt` in PostgreSQL | ERC-20 balance on MegaETH |
| Who controls | Backend engine + API | Smart contract + player wallet |
| Earnable | Yes (salary, missions, hacks) | No (only via claim) |
| Spendable in-game | Yes (shop, food, training) | No |
| Transferable | No | Yes (ERC-20 transfer) |
| Affected by claim | Zeroed to 0 | Increases by net amount |
| Max supply | Unlimited (generated by engine) | 1,000,000,000 (contract cap) |

---

## 9. DRY_RUN Status

The claim sync has a `DRY_RUN` flag (default: `"true"`):

```python
# claim_sync.py:34
DRY_RUN = os.getenv("DRY_RUN", "true").lower() != "false"
```

- **If DRY_RUN=true (default):** Claim sync logs what it would do but does NOT send transactions or zero balances. Devs accumulate $NXT forever.
- **If DRY_RUN=false:** Claim sync actually pushes to chain and zeros `balance_nxt` after confirmation.

**Check production:** If `DRY_RUN` is not explicitly set to `"false"` in Render environment variables, claims don't work and balances never get zeroed.

---

## 10. Files Referenced

| File | Purpose |
|---|---|
| `backend/api/routes/players.py:109-144` | Wallet summary endpoint |
| `backend/api/routes/shop.py:130-214` | Shop buy endpoint (balance check at :146) |
| `backend/api/routes/shop.py:248-252` | Fix bug endpoint |
| `backend/api/routes/shop.py:284-410` | Hack/raid endpoint |
| `backend/api/routes/missions.py:270-310` | Mission claim (balance update at :291) |
| `backend/engine/engine.py:296-306` | CREATE_PROTOCOL costs |
| `backend/engine/engine.py:333-340` | CREATE_AI costs |
| `backend/engine/engine.py:382-389` | INVEST costs |
| `backend/engine/engine.py:415-420` | SELL returns |
| `backend/engine/engine.py:800-813` | Salary payment |
| `backend/engine/claim_sync.py:93-104` | Balance zeroing after sync |
| `backend/engine/config.py:43-58` | Economy constants |
| `backend/db/schema.sql:80-173` | Dev table schema |
| `frontend/src/windows/NxtWallet.jsx:69-76` | Pay stub deductions |
| `frontend/src/services/contract.js:109-119` | previewClaim ABI |
