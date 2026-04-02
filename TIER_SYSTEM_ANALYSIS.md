# Tier System — Technical Analysis

> Read-only analysis of what's needed to implement dev-count-based ranks with program gating.

---

## Proposed Tier Structure

| Devs | Rango | ID | Programs Unlocked |
|------|-------|----|-------------------|
| 1 | Solo Coder | `SOLO_CODER` | Base set (6 programs) |
| 3 | Indie Lab | `INDIE_LAB` | +3 programs |
| 5 | Startup HQ | `STARTUP_HQ` | +3 programs |
| 10 | Dev House | `DEV_HOUSE` | +3 programs |
| 20 | Tech Corp | `TECH_CORP` | +2 programs |
| 50 | Mega Corp | `MEGA_CORP` | +2 programs |
| 100 | Empire | `EMPIRE` | All programs |

---

## 1. Current Desktop Program System

### Desktop.jsx — Program Definitions

**File:** `frontend/src/components/Desktop.jsx` (lines 11-33)

21 programs defined in `DESKTOP_ICONS`:

| # | ID | Label | Currently Hidden? |
|---|-----|-------|-------------------|
| 1 | `nx-terminal` | NX Terminal | No |
| 2 | `live-feed` | Live Feed | No |
| 3 | `world-chat` | World Chat | No |
| 4 | `leaderboard` | Leaderboard | No |
| 5 | `protocol-market` | Protocol Market | No |
| 6 | `ai-lab` | AI Lab | No |
| 7 | `my-devs` | My Devs | No |
| 8 | `nxt-wallet` | NXT Wallet | No |
| 9 | `inbox` | Inbox | No |
| 10 | `hire-devs` | Mint/Hire Devs | No |
| 11 | `notepad` | Notepad | No |
| 12 | `recycle-bin` | Recycle Bin | No |
| 13 | `corp-wars` | Corp Wars | No |
| 14 | `control-panel` | Settings | No |
| 15 | `flow` | Flow | **Yes** |
| 16 | `nadwatch` | Nadwatch | **Yes** |
| 17 | `parallax` | Parallax | **Yes** |
| 18 | `monad-city` | Mega City | No |
| 19 | `dev-academy` | NX Dev Academy | No |
| 20 | `monad-build` | Mega Build | No |
| 21 | `netwatch` | MegaWatch | No |

### Current Gating System
- **Line 177:** Icons filtered by `!item.hidden` — only non-hidden icons render
- **No permission checks** at Desktop or WindowManager level
- **Dev Academy** (`frontend/src/components/programs/dev-academy/DevAcademy.jsx`) is the **only program with NFT gating** — requires owning a specific dev via `NFTGate.jsx`
- **WindowManager** (`frontend/src/components/WindowManager.jsx` lines 27-51) has a static `WINDOW_COMPONENTS` map — no conditional loading

### Start Menu
**File:** `frontend/src/components/StartMenu.jsx` (lines 4-20)
- Lists 10 programs + 2 games (Bug Sweeper, Protocol Solitaire)
- No gating — always shows same items

---

## 2. How to Get Dev Count

### Option A: On-Chain (Current Pattern)
**File:** `frontend/src/windows/MyDevs.jsx` (lines 610-617)
```javascript
const { data: ownedTokens } = useReadContract({
  address: NXDEVNFT_ADDRESS,
  abi: NXDEVNFT_ABI,
  functionName: 'tokensOfOwner',
  args: address ? [address] : undefined,
  chainId: MEGAETH_CHAIN_ID,
  query: { enabled: !!address, staleTime: 60_000 },
});
```
- `ownedTokens.length` = dev count
- Also available: `balanceOf(address)` returns count directly (contract.js line 58-69)
- Also: `walletClaimable(address)` returns `(total, devCount)` (contract.js line 100-117)

### Option B: Backend API
**Endpoint:** `GET /api/players/{wallet}` (`backend/api/routes/players.py` lines 48-65)
- Returns `devs` array — count from `devs.length`
- Also: `total_devs_minted` field in players table (schema.sql line 65)

### Option C: Dedicated Count Endpoint
- `GET /api/devs/count` exists but returns **global** count, not per-user

### Recommendation
- **Use `balanceOf(address)` on-chain** — single uint256, fast, no array parsing
- Cache in a React context for global access (doesn't exist yet)
- Fallback to API `devs.length` if RPC fails

---

## 3. Current State Management

**File:** `frontend/src/App.jsx`

- **No global store** (no Redux, no Zustand, no global Context for user data)
- Wallet state in `useWallet.js` hook — only provides `address`, `isConnected`
- Dev ownership is fetched **per-component** (MyDevs, NxtWallet each fetch independently)
- **No shared dev count state** across components

### What's Missing for Tier System
A global context/provider that:
1. Reads `balanceOf(address)` on wallet connect
2. Derives current tier from count
3. Exposes `{ devCount, tier, tierName }` to all components

---

## 4. Where to Implement Gating

### Option A: Desktop-Level (Recommended)
**Modify:** `frontend/src/components/Desktop.jsx`

Replace `hidden: true/false` with `minTier: 'TIER_ID'`:
```javascript
const DESKTOP_ICONS = [
  { id: 'nx-terminal', icon: '>_', label: 'NX Terminal', minTier: 'SOLO_CODER' },
  { id: 'corp-wars', icon: '⚔', label: 'Corp Wars', minTier: 'DEV_HOUSE' },
  // ...
];
```

Filter in render:
```javascript
DESKTOP_ICONS.filter(item => userTier >= item.minTier).map(...)
```

**Pros:** Clean, centralized, consistent with existing `hidden` pattern
**Cons:** Programs also accessible via Start Menu (needs same gating there)

### Option B: Wrapper Component
Create `<TierGate minTier="DEV_HOUSE">` that wraps program content:
```jsx
<TierGate minTier="DEV_HOUSE" fallback={<LockedScreen tier="DEV_HOUSE" />}>
  <CorpWars />
</TierGate>
```

**Pros:** Programs visible but locked (better UX — user sees what they can unlock)
**Cons:** More components to maintain

### Option C: Hybrid (Best UX)
- **Desktop:** Show all icons but with lock overlay for gated programs
- **On open:** Show a "Requires X devs (Tier Name)" modal instead of the program
- **Start Menu:** Same gating with lock indicators

### Recommendation: Option C (Hybrid)
- Users see ALL programs → creates aspiration to unlock
- Lock overlay on desktop icon + modal on open = clear feedback
- Minimal code changes: just add tier check in `openWindowWithBSOD()` function

---

## 5. Proposed Program Distribution by Tier

### SOLO_CODER (1 dev) — Base Programs
| Program | Rationale |
|---------|-----------|
| NX Terminal | Core gameplay |
| Live Feed | Core — watch devs work |
| My Devs | Core — manage your dev |
| Hire Devs | Core — mint more devs |
| NXT Wallet | Core — see earnings |
| Control Panel | Core — settings |

### INDIE_LAB (3 devs)
| Program | Rationale |
|---------|-----------|
| World Chat | Social — need a small team first |
| Leaderboard | Competition — meaningful with 3+ devs |
| Notepad | Utility unlock |

### STARTUP_HQ (5 devs)
| Program | Rationale |
|---------|-----------|
| Protocol Market | Economy — need devs to create protocols |
| Inbox | Communications unlock |
| Dev Academy | Training — invest in your team |

### DEV_HOUSE (10 devs)
| Program | Rationale |
|---------|-----------|
| AI Lab | Advanced — create AIs with your team |
| Corp Wars | PvP — need a real team |
| Recycle Bin | Utility (easter egg) |

### TECH_CORP (20 devs)
| Program | Rationale |
|---------|-----------|
| Mega City | World exploration |
| Mega Build | Construction |

### MEGA_CORP (50 devs)
| Program | Rationale |
|---------|-----------|
| MegaWatch | Surveillance/monitoring |
| Flow | Advanced visualization |

### EMPIRE (100 devs)
| Program | Rationale |
|---------|-----------|
| Nadwatch | Endgame content |
| Parallax | Endgame content |

### Games (Always Available)
| Program | Rationale |
|---------|-----------|
| Bug Sweeper | Mini-game, no gating |
| Protocol Solitaire | Mini-game, no gating |

---

## 6. Implementation Requirements

### New Files Needed
1. **`frontend/src/contexts/TierContext.jsx`** — Global tier provider
   - Reads `balanceOf(address)` on connect
   - Derives tier from TIER_THRESHOLDS config
   - Re-fetches on mint events

2. **`frontend/src/config/tiers.js`** — Tier definitions
   - Thresholds, names, IDs
   - Program-to-tier mapping
   - Could be fetched from backend for dynamic config

3. **`frontend/src/components/TierGate.jsx`** — Lock overlay/modal component

### Files to Modify
1. **`frontend/src/components/Desktop.jsx`** — Add `minTier` to DESKTOP_ICONS, filter/overlay logic
2. **`frontend/src/components/StartMenu.jsx`** — Same gating for menu items
3. **`frontend/src/components/WindowManager.jsx`** — Optional: check tier before rendering window
4. **`frontend/src/App.jsx`** — Wrap with `<TierProvider>`

### Backend (Optional)
- Add `tier` field to `GET /api/players/{wallet}` response (computed from dev count)
- Useful for server-side validation of gated actions
- Table: `player_tiers` or computed field in players query

### No Contract Changes Needed
- `balanceOf(address)` already exists on NXDevNFT
- Tier logic is purely frontend/backend — no on-chain gating required

---

## 7. Existing Patterns to Reuse

| Pattern | Location | Reuse For |
|---------|----------|-----------|
| `hidden` flag filtering | Desktop.jsx line 177 | Tier-based filtering |
| `NFTGate` component | dev-academy/components/NFTGate.jsx | Reference for gate UI |
| `useReadContract` for balanceOf | MyDevs.jsx lines 610-617 | Tier detection |
| `walletClaimable` returning devCount | contract.js line 100-117 | Alternative count source |
| `useWallet` hook | hooks/useWallet.js | Wallet address for queries |
