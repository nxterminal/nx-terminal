# Wallet Fixes + Tier System + Dev Academy — Implementation Summary

---

## TAREA 1: WALLET FIXES — 5 Bugs

### BUG 1: Function Name Mismatch (BLOCKER) ✅
**File:** `backend/engine/claim_sync.py`
- `batchSetClaimable` → `batchSetClaimableBalance` (ABI line 56, call line 145)
- Updated all comments referencing the old name

### BUG 2: previewClaim ABI Mismatch ✅
**File:** `frontend/src/services/contract.js:110-117`
- Changed from 1 output (`total`) to 3 outputs (`gross`, `fee`, `net`)
- Now matches contract's `returns (uint256 gross, uint256 fee, uint256 net)`

### BUG 3: Fee Not Displayed ✅
**File:** `frontend/src/windows/NxtWallet.jsx`
- ClaimSection now shows full breakdown:
  - "Claimable: X $NXT" (gross)
  - "Claim fee: -Y $NXT (10%)" (red)
  - "You receive: Z $NXT" (green, bold)
- CLAIM button shows net amount (what user actually receives)
- Removed all "no fee" comments from NxtWallet.jsx and claim_sync.py

### BUG 4: Game vs On-Chain Confusion ✅
**File:** `frontend/src/windows/NxtWallet.jsx`
- Section 1 label: "GAME BALANCE (Virtual)" with explanation text
- Section 2 label: "CLAIM $NXT (On-Chain)" with fee breakdown
- When game balance > 0 but on-chain = 0: shows "Your devs have X $NXT in-game. It will be synced to blockchain soon."

### BUG 5: claim_sync Integration ✅
**File:** `backend/engine/engine.py`
- Added `run_claim_sync()` wrapper with graceful ImportError handling
- Integrated into main engine loop: runs every 10 minutes
- Runs outside the main DB transaction (has its own connection)

**File:** `backend/api/routes/simulation.py`
- New endpoint: `GET /api/simulation/claim-sync-status`
- Returns: `pending_devs`, `pending_nxt`, `signer_configured`, `dry_run`

**Render env vars needed:**
```
BACKEND_SIGNER_PRIVATE_KEY=<signer_private_key>
DRY_RUN=false
```

---

## TAREA 2: TIER SYSTEM

### New Files Created
| File | Purpose |
|------|---------|
| `frontend/src/config/tiers.js` | Tier definitions, program requirements, helper functions |
| `frontend/src/hooks/useDevCount.js` | Hook using `balanceOf` with RPC fallback |
| `frontend/src/components/LockedProgram.jsx` | Lock screen shown for tier-gated programs |

### Tier Definitions
| Devs | Rank | Programs Unlocked |
|------|------|-------------------|
| 0 | No Devs | nx-terminal, live-feed, my-devs, hire-devs, nxt-wallet, inbox, notepad, recycle-bin, control-panel |
| 1 | Solo Coder | (same as above) |
| 3 | Indie Lab | + world-chat, leaderboard, dev-academy |
| 5 | Startup HQ | + protocol-market, ai-lab, corp-wars |
| 10 | Dev House | + monad-city, monad-build, netwatch |
| 20 | Tech Corp | + flow, nadwatch, parallax |
| 50 | Mega Corp | (reserved for future) |
| 100 | Empire | (reserved for future) |

### Files Modified
| File | Change |
|------|--------|
| `WindowManager.jsx` | Added tier gating: checks `canAccessProgram()` before rendering, shows `LockedProgram` if locked |
| `Desktop.jsx` | Icons filtered by tier visibility. Locked icons show at 50% opacity with grayscale. Removed `hidden:true` from flow/nadwatch/parallax |
| `DesktopIcon.jsx` | Added `locked` and `title` props for visual feedback |
| `StartMenu.jsx` | Programs show lock emoji when tier-locked, with tooltip |
| `Taskbar.jsx` | Tier badge in tray: shows rank icon, name, and progress (e.g., "10/20") |

### How Gating Works
1. `useDevCount()` calls `balanceOf(address)` on NXDevNFT contract
2. `canAccessProgram(id, devCount)` checks `PROGRAM_MIN_DEVS[id]`
3. `WindowManager` renders `LockedProgram` instead of actual content if locked
4. `Desktop` shows locked icons dimmed with lock emoji
5. User can still click locked icons — they open the window with lock screen showing "Mint X more devs to unlock"

---

## TAREA 3: DEV ACADEMY

### Changes
| File | Change |
|------|--------|
| `NFTGate.jsx` | Removed "Skip verification (demo mode)" button entirely. Updated help text to reference Indie Lab rank requirement |
| `DevAcademy.jsx` | Removed `handleSkip` callback and `onSkip` prop from NFTGate. Cleaned up demo badge display |

### Behavior Now
- User MUST enter a valid Dev ID to access Dev Academy
- No demo/bypass mode available
- Additionally, Dev Academy requires Indie Lab tier (3 devs) to even open the window

---

## VERIFICATION CHECKLIST

```
[x] Wallet: Game Balance and On-Chain Claimable shown as separate sections
[x] Wallet: Fee breakdown shows gross/fee/net
[x] Wallet: CLAIM button shows net amount
[x] Wallet: Sync notice when game > 0 but on-chain = 0
[x] claim_sync: Integrated into engine scheduler (10 min interval)
[x] claim_sync: Health endpoint at /api/simulation/claim-sync-status
[x] claim_sync: Function name matches contract (batchSetClaimableBalance)
[x] Tiers: Config with 7 tiers and program assignments
[x] Tiers: useDevCount hook with balanceOf + RPC fallback
[x] Tiers: WindowManager gates locked programs
[x] Tiers: LockedProgram component with unlock guidance
[x] Tiers: Desktop icons dimmed for locked programs
[x] Tiers: StartMenu shows lock indicators
[x] Tiers: Taskbar shows current rank and progress
[x] Tiers: flow/nadwatch/parallax now tier-gated (not hidden)
[x] Dev Academy: Demo mode removed
[x] Dev Academy: NFTGate enforced (no skip button)
```
