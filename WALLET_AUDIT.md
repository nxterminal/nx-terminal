# Wallet Connection Modal — Audit Report

**Branch:** `claude/fix-wallet-modal-6EbXZ`
**Date:** 2026-04-27
**Status:** Phase 1 (audit only) — awaiting approval to proceed to Phase 2

---

## 1. Current state of the connection flow

### 1.1 Stack

The frontend uses **wagmi v2 + viem** (no RainbowKit / Web3Modal / WalletConnect). MOSS is integrated as a **wagmi connector** (not as a parallel SDK on the production path), with the `@megaeth-labs/wallet-sdk-react` SDK only mounted on the internal `/moss-test` diagnostic route.

```
frontend/package.json
  - wagmi ^2.14.0
  - viem ^2.46.2
  - @megaeth-labs/wallet-sdk            0.1.8     (only used on /moss-test)
  - @megaeth-labs/wallet-sdk-react      0.1.6     (only used on /moss-test)
  - @megaeth-labs/wallet-wagmi-connector 0.1.0-beta.2  (production path)
```

### 1.2 Files and roles

| File | Role |
|---|---|
| `frontend/src/services/wagmi.js` | Builds `wagmiConfig` with two explicit connectors: `injected()` and `megaWallet({ network: 'mainnet' })`. Exports `MOSS_CONNECTOR_ID = 'megaWallet'` and `isMossConnector(c)` helper. |
| `frontend/src/main.jsx` | Mounts `<WagmiProvider>`, `<WalletSelectorProvider>`, and `<WalletSelectorModal />` at app root. `<MegaProvider>` (raw MOSS SDK) is mounted **only** on `/moss-test`. |
| `frontend/src/contexts/WalletSelectorContext.jsx` | Owns modal `isOpen` state and routes selection through wagmi's `useConnect().connectAsync({ connector })`. Exposes the live `connectors` list to consumers. |
| `frontend/src/components/WalletSelectorModal.jsx` | Renders the picker. **This is where the bug lives** — see §2. |
| `frontend/src/components/WalletSelectorCancelOverlay.jsx` | Floating "Cancel" button shown only while a MOSS connect is in flight (MOSS shows a fullscreen iframe with no built-in escape). |
| `frontend/src/hooks/useWallet.js` | Thin wrapper on wagmi hooks. Exposes `connect` (which opens the selector), `disconnect`, `switchToMegaETH`, and MOSS-only `openWallet` / `depositWallet` helpers. |
| `frontend/src/hooks/walletErrors.js` | Provider-agnostic error normalization (user reject vs. unsupported method vs. transport). |

### 1.3 Wagmi connector list at runtime

`wagmiConfig.connectors` resolves to:

1. The explicit `injected()` connector — `id: 'injected'`. Talks to whatever sits on `window.ethereum`.
2. The explicit `megaWallet({ network: 'mainnet' })` — `id: 'megaWallet'` (MOSS, iframe-based, no extension).
3. **Auto-discovered EIP-6963 connectors** — wagmi v2's `createConfig` enables `multiInjectedProviderDiscovery: true` by default, so any extension that emits `eip6963:announceProvider` gets registered with its RDNS as the connector id (`io.metamask`, `io.rabby`, `com.coinbase.wallet`, `app.phantom`, etc.).

So the wagmi layer **already has** EIP-6963 — the bug is purely in the modal's filter, which throws those connectors away.

### 1.4 The filter (the bug)

`frontend/src/components/WalletSelectorModal.jsx:57-70`:

```jsx
const hasMetaMaskExtension = connectors.some(c => c.id === 'io.metamask');
const filteredConnectors = connectors
  .filter(c => {
    if (isMossConnector(c)) return true;            // MOSS (megaWallet) ✅
    if (c.id === 'io.metamask') return true;        // EIP-6963 MetaMask ✅
    if (c.id === 'injected' && !hasMetaMaskExtension) return true;  // generic fallback
    return false;                                    // everyone else (Rabby, Coinbase, …) ❌
  })
  .sort(...);
```

Then for the surviving connectors, the visual is picked by:

```jsx
function getCardPresentation(connector) {
  if (isMossConnector(connector)) return { name: 'MOSS — MegaETH Wallet', logo: megaethLogo, ... };
  return { name: 'MetaMask', logo: metamaskLogo, ... };   // ← any non-MOSS gets MetaMask label/icon
}
```

---

## 2. Root cause

### 2.1 Hypothesis confirmation

> ¿El modal actual hardcodea solo `MetaMask` y `MOSS` y descarta cualquier otro provider?

**Confirmed.** `WalletSelectorModal.jsx:57-64` whitelists only three connector IDs (`megaWallet`, `io.metamask`, `injected`). Every other connector — including every EIP-6963-announced wallet that isn't MetaMask — is filtered out before render.

> ¿Se está usando `window.ethereum` directo (que Rabby sobreescribe) o se busca un provider específico por nombre (`window.ethereum.isMetaMask`)?

Neither, exactly. The selector itself goes through wagmi's `connectAsync({ connector })`. Each connector internally talks to its provider:
- The `injected()` connector resolves to whatever owns `window.ethereum` at the time of connect — which Rabby will hijack.
- The auto-discovered `io.metamask` connector talks to MetaMask's specific EIP-6963 provider, regardless of `window.ethereum` ownership.
- `io.rabby` would talk to Rabby's specific EIP-6963 provider — but it's filtered out before reaching the UI.

There is **no** `isMetaMask` sniffing in our code (good).

> ¿Hay soporte EIP-6963?

Yes, at the wagmi layer (default in v2). **No** at the UI layer — the filter explicitly drops every EIP-6963 connector that isn't MetaMask.

> ¿Cómo está integrada MOSS?

MOSS is integrated via `@megaeth-labs/wallet-wagmi-connector`. It is a wagmi `CreateConnectorFn` whose underlying transport is a **fullscreen iframe** the SDK injects into the page (no extension, no `window.ethereum`, no EIP-6963 announcement). It does not follow EIP-6963 — it must be added explicitly to the connectors array, which we already do in `services/wagmi.js:34`. The SDK is pinned to a single network at construction time (hence the manual `megaeth` chain definition).

### 2.2 Two failure modes

**Mode A — User has MetaMask + Rabby installed.** Rabby announces `io.rabby` via EIP-6963; MetaMask announces `io.metamask`. The filter keeps only `io.metamask` and `megaWallet`. The user sees MetaMask + MOSS and **has no way to pick Rabby**.

**Mode B — User has only Rabby installed.** No `io.metamask` connector is announced, so `hasMetaMaskExtension` is `false` and the generic `injected()` connector survives the filter. But:
- `getCardPresentation()` labels it **"MetaMask"** with the **MetaMask logo**. A Rabby user looking for "Rabby" or even a generic "Browser wallet" sees a misleading button.
- Clicking it does technically work (Rabby owns `window.ethereum` so the connect succeeds), but plenty of users won't trust a button that says "MetaMask" when they don't have MetaMask.

The git history confirms the regression timing:
- `f0a3642` — MOSS connector added alongside `injected()`.
- `e17a78f` — modal rewritten to render every wagmi connector (Rabby would have appeared correctly here).
- **`7f345a6` — "show only MetaMask + MOSS, hide other injected wallets"** — this is the commit that introduces the bug. It explicitly opts out of every EIP-6963 wallet that isn't MetaMask.

### 2.3 Quick reproduction

1. Install MetaMask + Rabby in the same Chrome profile.
2. Visit the portal, click Connect.
3. Modal shows two cards: MetaMask, MOSS. **Rabby is absent.**

---

## 3. Collateral damage (other wallets impacted)

Every EIP-6963 wallet other than MetaMask is hidden whenever MetaMask is also installed. With the user's typical setup (MetaMask + a secondary wallet), the modal silently drops:

| Wallet | RDNS / id (typical) |
|---|---|
| Rabby | `io.rabby` |
| Coinbase Wallet | `com.coinbase.wallet` |
| Frame | `sh.frame` |
| Trust Wallet | `com.trustwallet.app` |
| OKX Wallet | `com.okex.wallet` |
| Brave Wallet | `com.brave.wallet` |
| Rainbow | `me.rainbow` |
| Phantom (EVM) | `app.phantom` |
| Zerion | `io.zerion.wallet` |
| Talisman | `xyz.talisman` |
| Ledger Connect (extension) | `com.ledger` |

Anyone using one of these as their **only** wallet falls back to the misleading "MetaMask"-labeled `injected()` card and may bounce off the portal. Anyone using one of these **alongside** MetaMask cannot pick it at all.

The `useWallet().switchToMegaETH` chain-switch fallback in `useWallet.js:73-101` does call `window.ethereum` directly, so it works for any single-injected setup, but it does not help inside the modal.

---

## 4. Recommended fix (Phase 2 — high level)

**Pivot from "explicit whitelist of two connectors" to "show every wallet wagmi knows about, plus MOSS as a special card."**

Concretely:

1. **Replace the filter with EIP-6963-aware presentation.** Render every connector wagmi exposes, using `connector.icon` + `connector.name` (both populated for EIP-6963 connectors) for cards we don't have hardcoded art for. Keep MOSS as the explicitly-styled "embedded wallet" card. Keep a hardcoded MetaMask fallback only for the case where the user has MetaMask installed but EIP-6963 didn't fire (rare, very old MetaMask).
2. **De-duplicate.** Hide the generic `injected` connector when at least one EIP-6963 connector is present (otherwise users see e.g. both `io.rabby` and `injected` for the same wallet). When there are no EIP-6963 connectors, keep `injected` as a "Browser wallet" fallback labeled generically — never as "MetaMask" with MetaMask art.
3. **Sort:** MOSS first or last (TBD), then MetaMask if present, then alphabetically by `connector.name`.
4. **Recommendation on the "Otra billetera" fallback:** prefer **Option B (generic injected fallback)** over Option A (WalletConnect v2). Rationale below.
5. **No dependency changes.** Everything we need is already in wagmi v2 and viem. No new packages, no env vars.

### 4.1 Why Option B (generic injected fallback) over Option A (WalletConnect v2)

| Criterion | Option A — WalletConnect v2 | Option B — generic injected |
|---|---|---|
| New dependency | `@walletconnect/ethereum-provider` (~250 kB gzipped) plus `wagmi/connectors/walletConnect` | none |
| Config required | `VITE_WALLETCONNECT_PROJECT_ID` env var, account at cloud.walletconnect.com | none |
| Mobile coverage | Yes (QR pairing for any v2 wallet) | No |
| Real desktop coverage gap | Tiny — almost every modern desktop wallet ships EIP-6963 | Same |
| Risk to MOSS / MetaMask paths | Low but non-zero (extra connector, extra session state) | Zero |
| User restriction "no librerías pesadas" | Borderline — WalletConnect is the heaviest part of RainbowKit too | Compliant |

EIP-6963 already covers the vast majority of desktop users. The portal is desktop-first (Windows-98 retro UI; mobile is a known second-class target). The generic `injected` card handles old wallets that haven't shipped EIP-6963 yet. **Adding WalletConnect is a separate decision** that we can revisit later if mobile becomes a priority — it's orthogonal to fixing Rabby today.

### 4.2 Visual style

The modal already uses `connector.icon` / `connector.name` aware code paths via `getCardPresentation`. The fix preserves the existing dark-card / arrow / hover look (the modal is *already* slightly off-theme from the Win98 chrome — the audit doesn't change that, just stops hiding wallets).

### 4.3 What will NOT change

- `services/wagmi.js` — connectors stay as `[injected(), megaWallet({...})]`. Wagmi v2 auto-merges EIP-6963 announcements into this list at runtime; we don't need to add per-wallet connector imports.
- `WalletSelectorContext.jsx` — already passes `connectors` through unchanged.
- `useWallet.js` — already routes through the selector.
- MOSS path — the `isMossConnector` check stays as the single source of truth for "is this the embedded wallet?" so all MOSS-only branches (cancel overlay, deposit/open helpers, fixed-chain logic) keep working.
- Mint flow / Fund Dev flow — not touched. They consume `useWallet()` which remains identical.

---

## 5. Manual test plan (will be executed in Phase 3 after the fix lands)

Pre-conditions: latest build of the branch served via `npm run dev`.

| # | Setup | Action | Expected |
|---|---|---|---|
| 1 | MetaMask only | Open portal → Connect | Cards: MetaMask, MOSS. Click MetaMask → MetaMask popup → connect succeeds → modal closes. |
| 2 | Rabby only | Open portal → Connect | Cards: Rabby, MOSS (no misleading "MetaMask" card). Click Rabby → Rabby popup → connect succeeds. |
| 3 | MetaMask + Rabby | Open portal → Connect | Cards: MetaMask, Rabby, MOSS. Both connect paths work. |
| 4 | No extension wallet | Open portal → Connect | Cards: MOSS, optionally a generic "Browser wallet" card if `window.ethereum` happens to be defined. Click MOSS → iframe gate → connect succeeds. |
| 5 | Coinbase Wallet only | Open portal → Connect | Cards: Coinbase Wallet, MOSS. Connect succeeds. |
| 6 | Any setup, mid-connect | Click Cancel during MOSS iframe | Iframe tears down, modal stays open with Cancel cleared (no "stuck" state). |
| 7 | Any setup | Connect, then go to NXT Wallet → Claim | Claim transaction prompts on the active wallet, no MOSS-vs-MM mismatch. |
| 8 | Any setup | Connect with a non-MegaETH chain selected | "Wrong network" banner, click switch → wallet switches to MegaETH (chainId 4326). |

---

## 6. Decisions (resolved 2026-04-27)

1. **Sort order:** MOSS first (recommended MegaETH wallet, brand-forward).
2. **Generic injected fallback label:** "Other wallet" with a neutral lucide-react `Wallet` icon (lucide-react is already a project dep, so no new packages).
3. **WalletConnect:** not in scope for this fix — see follow-up TODO in §8.

---

## 7. Implementation summary (Phase 3, applied)

Files touched:

- `frontend/src/components/WalletSelectorModal.jsx`
  - Removed the hardcoded MetaMask+MOSS whitelist (`io.metamask` / `injected` / MOSS only).
  - Added `isEip6963Connector(c)` — true for any wagmi connector that isn't MOSS and isn't the generic `injected()` fallback.
  - Built `filteredConnectors` as: MOSS → MetaMask → other EIP-6963 connectors alphabetical → generic `injected()` only when no EIP-6963 connector is present.
  - Extended `getCardPresentation()` with three new branches:
    - `io.metamask` → existing hardcoded MetaMask card (unchanged behavior).
    - `injected` (generic) → label "Other wallet" / "Browser extension" / lucide `Wallet` icon.
    - any other connector → uses `connector.icon` (data URI from EIP-6963 announcement) + `connector.name`.
  - Renamed `logo` → `logoSrc` for clarity in the presentation object; render block now picks lucide icon → `<img>` → fallback lucide icon, in that order.

- `frontend/src/components/WalletSelectorModal.module.css`
  - Added `.cardIconLucide` (22×22 zinc-300) so the neutral lucide icon sits centered inside the same 40×40 plate as the brand PNGs. No other style changes — dark card / hover / arrow / spinner / focus all preserved.

Files NOT touched (intentionally):

- `frontend/src/services/wagmi.js` — connectors stay as `[injected(), megaWallet({ network: 'mainnet' })]`. EIP-6963 auto-discovery is wagmi v2 default behavior.
- `frontend/src/contexts/WalletSelectorContext.jsx` — already passes the live `connectors` list through.
- `frontend/src/hooks/useWallet.js`, `walletErrors.js`, `WalletSelectorCancelOverlay.jsx`, MOSS SDK route, contract / mint / Fund Dev paths.

Behavior parity for the existing happy paths:

- **MetaMask card** — same PNG (`metamasklogo.png`), same `'Browser extension'` subtitle, same hardcoded path through the `io.metamask` connector. A user who connected MetaMask before this change will see the identical card and identical click behavior.
- **MOSS card** — same PNG (`megaethlogo.png`), same cream `cardIconMoss` plate, same `'Embedded — no extension needed'` subtitle, same `megaWallet` connector. Cancel overlay still triggers off `isMossConnector(pendingConnector)` — unchanged.
- **Sort change** — MOSS moves from second to first. This is a deliberate decision (resolution §6.1).

Expected modal contents per setup:

| Setup | Modal cards (top to bottom) |
|---|---|
| Only MetaMask installed | MOSS, MetaMask |
| Only Rabby installed | MOSS, Rabby |
| MetaMask + Rabby | MOSS, MetaMask, Rabby |
| MetaMask + Coinbase Wallet | MOSS, MetaMask, Coinbase Wallet |
| Rabby + Frame + Phantom (EVM) | MOSS, Frame, Phantom, Rabby |
| No extension wallet at all | MOSS, Other wallet |
| MetaMask + (any non-EIP-6963 legacy wallet) | MOSS, MetaMask  *(legacy wallet hidden — owns `window.ethereum` but doesn't announce; user can still go through MetaMask. Edge case, see TODO §8.2.)* |

Visual description with Rabby installed (case 3 above):

```
┌─────────────────────────────────────────────┐
│ Connect a wallet                          × │
│ Choose how you'd like to connect to MegaETH.│
│                                             │
│  [🟫 MOSS plate ]  MOSS — MegaETH Wallet  →│
│                    Embedded — no extension  │
│                                             │
│  [🦊 PNG       ]   MetaMask              → │
│                    Browser extension        │
│                                             │
│  [🐰 data-URI  ]   Rabby Wallet          → │
│                    Browser extension        │
└─────────────────────────────────────────────┘
```

The Rabby card uses the exact same `.card` styling as MetaMask — same dark background, same padding, same arrow, same hover/focus state. Only the icon contents come from Rabby's own EIP-6963 announcement (data-URI SVG/PNG).

---

## 8. Follow-up TODOs

### 8.1 WalletConnect v2 (mobile coverage) — deferred

Not added in this fix per resolution §6.3. When mobile becomes a priority:

- Install `@walletconnect/ethereum-provider` and use the `walletConnect` connector exported from `wagmi/connectors`.
- Add `VITE_WALLETCONNECT_PROJECT_ID` to `frontend/.env.example` and document it. The Project ID is free at https://cloud.reown.com (formerly cloud.walletconnect.com).
- Wire it as a third explicit connector in `services/wagmi.js`. The modal already iterates over the full connector list and would render a WalletConnect card automatically (its `connector.id === 'walletConnect'`, `connector.name === 'WalletConnect'`, and `connector.icon` is set by the connector itself).
- Decide whether the WalletConnect QR card should be visually grouped separately ("Mobile wallets" section) or just sorted alphabetically inline.
- Open question: project ID exposure in client bundle is fine per WalletConnect docs (it's a public identifier), but coordinate with the deploy pipeline so the env var lands on Render.

### 8.2 Legacy wallets that only inject `window.ethereum` (no EIP-6963)

A vanishingly small group of older wallets still skip EIP-6963 (e.g. some old MetaMask Mobile in-app browsers, very old Brave). When such a wallet is installed alongside MetaMask, our filter hides the generic "Other wallet" card (because `eip6963.length > 0`), leaving the legacy wallet inaccessible from the modal. Only worth fixing if real users complain — most users on those wallets get auto-handled because their wallet still owns `window.ethereum` after MetaMask's announcement and the EIP-6963 MetaMask card connects through MetaMask's own provider regardless.

If we ever need to handle this: add a "Show all wallets" expander that always reveals the generic `injected()` card.

---

## 9. Manual test plan (for QA)

Pre-conditions: latest build of the branch served via `npm run dev`.

| # | Setup | Action | Expected |
|---|---|---|---|
| 1 | MetaMask only | Open portal → Connect | Cards: MOSS, MetaMask. Click MetaMask → MM popup → connect succeeds → modal closes. |
| 2 | Rabby only | Open portal → Connect | Cards: MOSS, Rabby (Rabby card uses Rabby's own icon). Click Rabby → Rabby popup → connect succeeds. |
| 3 | MetaMask + Rabby | Open portal → Connect | Cards: MOSS, MetaMask, Rabby. Both connect paths work; clicking MetaMask connects MetaMask, clicking Rabby connects Rabby — no provider hijack. |
| 4 | No extension wallet | Open portal → Connect | Cards: MOSS, Other wallet (neutral icon). Clicking MOSS opens iframe and connects. Clicking "Other wallet" surfaces a clean "no provider" error. |
| 5 | Coinbase Wallet only | Open portal → Connect | Cards: MOSS, Coinbase Wallet. Connect succeeds. |
| 6 | MOSS connect, mid-iframe | Click "Cancel & choose another wallet" overlay | Iframe tears down; modal stays open with no stale pending; user can pick a different card. |
| 7 | Any setup, post-connect | Open NXT Wallet → Claim | Claim transaction prompts on the active wallet — no MOSS-vs-MM provider mismatch. |
| 8 | Any setup, wrong chain | Connect with wallet on a non-MegaETH chain | "Wrong network" banner appears; clicking switch performs `wallet_switchEthereumChain` to chainId 4326. |

---

## 10. Status

- [x] Phase 1 — audit
- [x] Phase 2 — proposal & decisions captured
- [x] Phase 3 — implement + commit + push
- [ ] Phase 3 — manual QA pass (per §9, executed by user / next reviewer)
