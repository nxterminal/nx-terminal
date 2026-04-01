# MIGRATION COMPLETE: Pharos → MegaETH

**Date:** 2026-04-01
**Migration:** Pharos Atlantic Testnet (chain 688689) → MegaETH Mainnet (chain 4326)

---

## New Configuration

| Parameter | Old (Pharos) | New (MegaETH) |
|-----------|-------------|---------------|
| Chain ID | 688689 | 4326 |
| Chain ID (hex) | 0xA8331 | 0x10E6 |
| Network Name | Pharos Atlantic Testnet | MegaETH |
| RPC URL | https://atlantic.dplabs-internal.com | https://carrot.megaeth.com/rpc |
| Explorer | https://atlantic.pharosscan.xyz | https://megaexplorer.xyz |
| Native Currency | PHRS | ETH |
| NXDevNFT | 0x5DeAB0Ab650D9c241105B6cb567Dd41045C44636 | 0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7 |
| NXTToken | 0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47 | 0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47 (same) |
| Env Var | PHAROS_RPC_URL | MEGAETH_RPC_URL |

---

## Files Modified (97 total)

### Backend (5 files)
| File | Changes |
|------|---------|
| `.env.example` | RPC URL, chain ID, explorer, NFT address, env var name |
| `backend/engine/claim_sync.py` | MEGAETH_RPC, MEGAETH_CHAIN_ID, new NFT address, docstrings |
| `backend/engine/listener.py` | MEGAETH_RPC_URL env var, new NFT address, docstrings |
| `backend/api/routes/devs.py` | RPC env var, new NFT address |
| `backend/api/routes/academy.py` | Comment with new NFT address |

### Frontend Config (3 files)
| File | Changes |
|------|---------|
| `frontend/src/services/contract.js` | MEGAETH_CHAIN_ID=4326, new NFT address, explorer |
| `frontend/src/services/wagmi.js` | Full chain definition (megaeth, id 4326, ETH, new RPC/explorer) |
| `frontend/src/hooks/useWallet.js` | MEGAETH_CHAIN_ID, switchToMegaETH, hex 0x10E6, ETH currency |

### Frontend Windows (4 files)
| File | Changes |
|------|---------|
| `frontend/src/windows/HireDevs.jsx` | MEGAETH_CHAIN_ID, switchToMegaETH, RPC URLs, PHRS→ETH, UI text |
| `frontend/src/windows/NxtWallet.jsx` | MEGAETH_CHAIN_ID |
| `frontend/src/windows/NXTerminal.jsx` | MEGAETH_CHAIN_ID, "MegaETH (4326)", "0.0001 ETH" |
| `frontend/src/windows/MyDevs.jsx` | MEGAETH_CHAIN_ID |

### Frontend Programs (85 files across 12 programs)

**netwatch/** — MEGAETH_CONFIG, chain ID, RPC, explorer, ETH, useMegaETHRPC hook
**flow/** — RPC, PHRS→ETH, chain ID, AI Oracle text, ERC-20 tokens commented out
**nadwatch/** — MEGAETH_RPC, chain ID, boot messages, help dialog
**parallax/** — Boot messages (chain ID, PHAROS→MEGAETH)
**monad-build/** — Full config (2 chain objects, canonical contracts, EVM diffs table, ecosystem links, deploy/compile steps, templates)
**chogpet/** — MEGAGOTCHI branding, MegaETH tips, storage key
**pharos-sdk/** — MEGA_SDK text, MegaETH content, chain config, missions
**monad-sdk/** — MEGA_SDK text, MegaETH content, chain config, missions
**phares/** — MegaETH category, prediction market questions
**dev-academy/** — MEGAETH_PATH, chain ID, RPC, NFT gate text
**monad-city/** — ETH ticker, chain ID, MEGAETH branding
**PetMiniModal.jsx** — MEGAGOTCHI, MegaETH tips

---

## Remaining "pharos" References (Acceptable)

These are **internal component IDs and file/folder names** that cannot be renamed without restructuring the app routing:

- `pharos-sdk` — component ID in Desktop.jsx, WindowManager.jsx, Win98Icons.jsx, useWindowManager.js
- `PharosSDK` — React component function name and CSS import
- `IconPharosSDK` — icon function in Win98Icons.jsx
- `../../pharos-sdk/data/constants` — import path from monad-sdk re-exporting shared data

User-facing labels have been changed to "Mega SDK" — the internal IDs remain as `pharos-sdk`.

---

## Verification Results

```
grep -ri "688689" (*.js, *.jsx, *.py) → 0 results ✓
grep -ri "PHRS" (*.js, *.jsx) → 0 results ✓
grep -ri "atlantic.dplabs" (*.js, *.jsx, *.py) → 0 results ✓
grep -ri "pharosscan" (*.js, *.jsx, *.py) → 0 results ✓
grep -ri "0xA8331" (*.js, *.jsx) → 0 results ✓
grep -ri "pharos" backend/ (*.py) → 0 results ✓
grep -ri "pharos" frontend/ (*.js, *.jsx) → 9 results (all component IDs/file paths) ✓
```

---

## Notes

1. **ERC-20 tokens in Flow** — The KNOWN_TOKENS array in `useWalletData.js` has been commented out. Only native ETH balance is shown until MegaETH token addresses are confirmed.
2. **EVM differences table** — Column renamed from `pharos` to `megaeth` in monad-build; values kept as-is.
3. **Ecosystem links** — Updated to placeholder URLs (e.g., `https://docs.megaeth.com`, `https://faucet.megaeth.com`).
4. **Solidity contracts** — NOT modified. They already reference MegaETH in NatSpec comments and have no hardcoded addresses.
5. **localStorage keys** — Changed from `pharosgotchi-state`/`pharos_sdk_progress` to `megagotchi-state`/`mega_sdk_progress` to avoid state collision.
