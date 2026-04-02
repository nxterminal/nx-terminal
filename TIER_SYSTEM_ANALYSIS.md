# Tier System — Technical Analysis

> Read-only analysis of what's needed to implement dev-count-based ranks with program gating.

---

## 1. PROPOSED TIER TABLE

| Devs | Rank | ID | Unlocks |
|------|------|----|---------|
| 1 | Solo Coder | `SOLO_CODER` | Base programs |
| 3 | Indie Lab | `INDIE_LAB` | + social/market tools |
| 5 | Startup HQ | `STARTUP_HQ` | + advanced programs |
| 10 | Dev House | `DEV_HOUSE` | + strategy tools |
| 20 | Tech Corp | `TECH_CORP` | + full access |
| 50 | Mega Corp | `MEGA_CORP` | + exclusive features |
| 100 | Empire | `EMPIRE` | Everything + cosmetics |

---

## 2. CURRENT PROGRAM ACCESS — NO GATING EXISTS

### 2.1 Desktop Icons (Desktop.jsx:11-33)

All 21 programs are defined in `DESKTOP_ICONS` array. **There is zero access control.**

| # | ID | Label | Hidden? |
|---|------|-------|---------|
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

### 2.2 How Programs Open

```
Desktop.jsx:177-185
  → DESKTOP_ICONS.filter(item => !item.hidden)    // only hides 3
  → DesktopIcon onDoubleClick → openWindowWithBSOD(id)
  → useWindowManager.openWindow(id)               // no permission check
  → WindowManager renders WINDOW_COMPONENTS[id]   // no gating
```

**Key files:**
- `Desktop.jsx:11-33` — Icon definitions
- `Desktop.jsx:177-185` — Rendering (filters `hidden: true`)
- `hooks/useWindowManager.js:31-58` — `openWindow()` — zero auth checks
- `components/WindowManager.jsx:27-51` — Component registry

### 2.3 No Permission System Exists

- No role/clearance checks in `openWindow()`
- No user tier state anywhere in the app
- `hidden: true` is the only "gating" — just hides icon, program still accessible via registry
- `ErrorPopup.jsx` has a joke about "clearance level" but it's cosmetic

---

## 3. HOW TO GET DEV COUNT

### 3.1 Current State — No Global Dev Count

**`useWallet()` hook** (`hooks/useWallet.js`) returns address, connection status, chain info — **no dev count**.

Each component that needs dev count fetches it independently:

| Component | How it gets devs | Line |
|-----------|-----------------|------|
| `MyDevs.jsx` | `useReadContract('tokensOfOwner')` + RPC fallback | 628-683 |
| `HireDevs.jsx` | `useReadContract('tokensOfOwner')` | 46-52 |
| `NxtWallet.jsx` | `useReadContract('tokensOfOwner')` | 620-627 |
| `LiveFeed.jsx` | Receives `devCount` as prop from parent | Uses for message frequency |

There's also `balanceOf(address)` in the ABI (`contract.js:57-62`) which returns just the count (cheaper than `tokensOfOwner`), but nothing uses it globally.

### 3.2 Best Approach for Tier System

**Option A: New `useDevCount()` hook** (Recommended)
```javascript
// hooks/useDevCount.js
export function useDevCount() {
  const { address } = useWallet();
  const { data: count } = useReadContract({
    address: NXDEVNFT_ADDRESS,
    abi: NXDEVNFT_ABI,
    functionName: 'balanceOf',       // cheaper than tokensOfOwner
    args: address ? [address] : undefined,
    chainId: MEGAETH_CHAIN_ID,
    query: { enabled: !!address, staleTime: 60_000 },
  });
  return { devCount: count ? Number(count) : 0 };
}
```

**Option B: Backend API**
- `GET /api/players/{wallet}` already returns player data
- Could add `dev_count` field (just `SELECT COUNT(*) FROM devs WHERE owner_address = %s`)
- Slower than on-chain `balanceOf` but doesn't need wallet connection

**Option C: React Context** (for performance)
- Create `DevCountProvider` that wraps the app
- Calls `balanceOf` once, caches result
- All components read from context instead of independent RPC calls
- Best if many components need the count simultaneously

**Recommendation:** Option A for simplicity, upgrade to Option C if performance issues arise.

---

## 4. WHERE TO IMPLEMENT GATING

### Option 1: Desktop.jsx — Hide/Show Icons (Simplest)

```javascript
// Add tier to each DESKTOP_ICONS entry
{ id: 'corp-wars', label: 'Corp Wars', icon: 'corp-wars', minDevs: 5 },

// Filter by tier when rendering
DESKTOP_ICONS.filter(item => !item.hidden && devCount >= (item.minDevs || 0))
```

**Pros:** Simple, one-file change
**Cons:** Programs still accessible if user knows the ID (via URL/console)

### Option 2: Inside Each Program — Candado/Lock Screen (Best UX)

```javascript
// Show icon always, but render lock screen when opened without enough devs
function LockedProgram({ requiredDevs, currentDevs, children }) {
  if (currentDevs < requiredDevs) {
    return <LockScreen requiredDevs={requiredDevs} currentDevs={currentDevs} />;
  }
  return children;
}
```

**Pros:** User sees all programs (aspirational), knows what to unlock
**Cons:** More code per program, or needs wrapper in WindowManager

### Option 3: WindowManager Wrapper (Recommended)

```javascript
// WindowManager.jsx — add tier check before rendering
const PROGRAM_TIERS = {
  'corp-wars': 5,
  'protocol-market': 3,
  'ai-lab': 5,
  // ...
};

// In render:
const minDevs = PROGRAM_TIERS[win.id] || 0;
if (devCount < minDevs) {
  return <LockedWindow requiredDevs={minDevs} programName={win.title} />;
}
return <ActualComponent ... />;
```

**Pros:** Centralized, one place to manage all tier gates. Icons visible on desktop (user knows what exists). Lock screen shows when opened. No changes needed in individual programs.

**Cons:** Needs dev count available in WindowManager (via hook or context)

**Recommendation: Option 3** — centralized, clean, good UX.

---

## 5. PROPOSED TIER DISTRIBUTION

### Tier 1: Solo Coder (1 dev) — Base Programs

Always available, the minimum experience:

| Program | Reason |
|---------|--------|
| `nx-terminal` | Core terminal, always needed |
| `my-devs` | Must see your dev |
| `hire-devs` | Must be able to mint more |
| `nxt-wallet` | Must manage funds |
| `live-feed` | Can watch simulation |
| `notepad` | Basic utility |
| `recycle-bin` | Basic utility |
| `control-panel` | Settings always available |
| `inbox` | Notifications always available |

### Tier 2: Indie Lab (3 devs) — Social & Market Access

| Program | Reason |
|---------|--------|
| `world-chat` | Social features unlock with a small team |
| `leaderboard` | Start competing with others |
| `dev-academy` | Learning/training your devs |

### Tier 3: Startup HQ (5 devs) — Strategy Programs

| Program | Reason |
|---------|--------|
| `protocol-market` | Create and trade protocols |
| `ai-lab` | Create AIs with your devs |
| `corp-wars` | Territory battles need a team |

### Tier 4: Dev House (10 devs) — Advanced Tools

| Program | Reason |
|---------|--------|
| `monad-city` | Mega City visualization |
| `monad-build` | Build projects |
| `netwatch` | MegaWatch monitoring |

### Tier 5: Tech Corp (20 devs) — Hidden Programs

| Program | Reason |
|---------|--------|
| `flow` | Currently hidden — unlock at higher tier |
| `nadwatch` | Currently hidden — unlock at higher tier |
| `parallax` | Currently hidden — unlock at higher tier |

### Tier 6-7: Mega Corp (50) / Empire (100)

No current programs to gate. Reserved for:
- Custom themes / desktop backgrounds
- Exclusive chat channels
- Priority dev cycle scheduling
- Badge/title display on leaderboard
- Special shop items

---

## 6. IMPLEMENTATION PLAN

### Step 1: Create `useDevCount` hook

File: `frontend/src/hooks/useDevCount.js`
- Uses `balanceOf(address)` from contract
- Returns `{ devCount, isLoading }`
- Stale time: 60s

### Step 2: Define tier config

File: `frontend/src/config/tiers.js`
```javascript
export const TIERS = [
  { id: 'SOLO_CODER', minDevs: 1, label: 'Solo Coder' },
  { id: 'INDIE_LAB', minDevs: 3, label: 'Indie Lab' },
  { id: 'STARTUP_HQ', minDevs: 5, label: 'Startup HQ' },
  { id: 'DEV_HOUSE', minDevs: 10, label: 'Dev House' },
  { id: 'TECH_CORP', minDevs: 20, label: 'Tech Corp' },
  { id: 'MEGA_CORP', minDevs: 50, label: 'Mega Corp' },
  { id: 'EMPIRE', minDevs: 100, label: 'Empire' },
];

export const PROGRAM_MIN_DEVS = {
  // Tier 1 (1 dev) — no entry needed (default 0)
  'world-chat': 3,
  'leaderboard': 3,
  'dev-academy': 3,
  'protocol-market': 5,
  'ai-lab': 5,
  'corp-wars': 5,
  'monad-city': 10,
  'monad-build': 10,
  'netwatch': 10,
  'flow': 20,
  'nadwatch': 20,
  'parallax': 20,
};
```

### Step 3: Add gate in WindowManager.jsx

- Import `useDevCount` and `PROGRAM_MIN_DEVS`
- Before rendering component, check `devCount >= PROGRAM_MIN_DEVS[id]`
- If locked: render `<LockedProgram>` component with lock icon, tier name, and "Mint X more devs to unlock"

### Step 4: Add tier badge to Desktop

- Show current tier in taskbar or desktop corner
- Visual indicator: "RANK: Indie Lab (3/5 → Startup HQ)"
- Optional: dim locked icons on desktop with lock overlay

### Step 5: Remove `hidden: true` from flow/nadwatch/parallax

- These become tier-gated instead of hidden
- Users see them on desktop, know they exist, motivated to unlock

---

## 7. DEV COUNT SOURCES — COMPARISON

| Source | Method | Speed | Requires Wallet | Always Accurate |
|--------|--------|-------|-----------------|-----------------|
| On-chain `balanceOf` | wagmi `useReadContract` | ~200ms | Yes | Yes (authoritative) |
| On-chain `tokensOfOwner` | wagmi `useReadContract` | ~200ms | Yes | Yes + gives IDs |
| Backend API | `GET /api/players/{wallet}` | ~100ms | No (just address) | Depends on listener sync |
| MyDevs component | Already fetches `tokensOfOwner` | N/A (local state) | Yes | Only when MyDevs is open |

**Best for tier system:** `balanceOf` — cheapest on-chain call, returns just the count, always accurate.

---

## 8. UX CONSIDERATIONS

### Locked Program Screen Design

```
┌─────────────────────────────────────────┐
│ ⊞ Corp Wars                        [X] │
├─────────────────────────────────────────┤
│                                         │
│            🔒 LOCKED                    │
│                                         │
│    Requires: STARTUP HQ (5 devs)        │
│    You have: 3 devs (Indie Lab)         │
│                                         │
│    ┌─────────────────────────┐          │
│    │  Open Mint/Hire Devs    │          │
│    └─────────────────────────┘          │
│                                         │
│    Mint 2 more devs to unlock           │
│    Corp Wars and territory battles.     │
│                                         │
└─────────────────────────────────────────┘
```

### Desktop Icon States

- **Unlocked:** Normal icon, full color
- **Locked (next tier):** Visible but grayed out, small 🔒 overlay
- **Locked (2+ tiers away):** Hidden (too far away, avoid clutter)

This creates a "progression horizon" — users see what's coming next but aren't overwhelmed by distant unlocks.
