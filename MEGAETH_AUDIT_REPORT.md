# MEGAETH AUDIT REPORT — NX Terminal: Protocol Wars

> Auditoría completa del codebase para migración de Pharos Atlantic Testnet (chain 688689) → MegaETH (chain 4326)
> Fecha: 2026-04-01

---

## 1. Resumen Ejecutivo

NX Terminal está actualmente desplegado en **Pharos Atlantic Testnet (chain ID 688689)**. Los contratos Solidity fueron diseñados originalmente para MegaETH (chain 4326) y contienen adaptaciones específicas para MegaEVM en sus comentarios. La migración requiere **redeploy de 2 contratos**, actualización de **~15 archivos de configuración** (backend + frontend), y **rebranding de ~11 programas del portal** que tienen referencias explícitas a "Pharos". Las imágenes NFT en IPFS, el sistema de traits, las 6 corporaciones y la lógica del engine de simulación **no requieren cambios**. El esfuerzo total estimado es **MODERADO** (~2-3 días de desarrollo).

---

## 2. Contratos

### Contratos Solidity

| Contrato | Path | Versión | Funciones Pub/Ext | Estándar |
|----------|------|---------|:-----------------:|----------|
| NXDevNFT v4 | `contracts/NXDevNFT_v4.sol` | `^0.8.20` | 50 | ERC-721 + ERC-2981 |
| NXTToken v3 | `contracts/NXTToken_v3.sol` | `^0.8.20` | 20 | ERC-20 + Burnable |

### Funciones Principales — NXDevNFT v4

| Función | Descripción |
|---------|-------------|
| `mint(quantity)` | Mint público con ETH nativo |
| `whitelistMint(quantity)` | Mint con precio reducido para whitelist |
| `mintWithToken(quantity)` | Mint pagando con ERC-20 |
| `freeMint(quantity)` | Mint gratuito por allowance |
| `ownerMint(to, quantity)` | Mint del owner sin costo |
| `claimNXT(tokenIds[])` | Reclamar $NXT acumulado |
| `setTokenLocked(tokenId, locked)` | Bloquear transferencia de un dev |
| `setTokenState(tokenId, state)` | Cambiar estado (ACTIVE/ON_MISSION/BURNED_OUT) |
| `setCorporation(tokenId, corpId)` | Asignar corporación on-chain |
| `setClaimableBalance(tokenId, amount)` | Setear balance reclamable |
| `setBaseURI(uri)` | Cambiar URL de metadata |
| `tokenURI(tokenId)` | Devuelve baseURI + tokenId |

### Funciones Principales — NXTToken v3

| Función | Descripción |
|---------|-------------|
| `mint(to, amount)` | Mintear tokens (solo minters) |
| `batchMint(recipients[], amounts[])` | Batch mint |
| `burn(amount)` | Quemar tokens propios |
| `gameBurn(from, amount)` | Quema por contratos de juego |
| `setAutoBurnRate(bps)` | Tasa auto-burn en transfers |
| `setTreasury(wallet)` | Cambiar wallet de tesorería |

### Referencias a Red en Contratos

| Archivo | Línea | Tipo | Contenido |
|---------|-------|------|-----------|
| NXDevNFT_v4.sol | 49 | Comentario | `Network: MegaETH (EVM-compatible L2, Chain ID 4326)` |
| NXDevNFT_v4.sol | 54-68 | Comentario | Adaptaciones MegaEVM (Fisher-Yates, gas multidimensional) |
| NXTToken_v3.sol | 34 | Comentario | `Network: MegaETH (EVM-compatible L2, Chain ID 4326)` |
| NXTToken_v3.sol | 38-49 | Comentario | Notas MegaEVM (auto-burn SSTORE, batch limits) |

> **Nota:** Los contratos ya referencian MegaETH en sus comentarios. No hay direcciones ni chain IDs hardcodeados en lógica ejecutable — todo es configurable via funciones setter.

---

## 3. Backend

| Archivo | Qué Cambiar | Esfuerzo |
|---------|-------------|----------|
| `.env.example:12-17` | Renombrar `PHAROS_RPC_URL` → `MEGAETH_RPC_URL`, cambiar CHAIN_ID `688689` → `4326`, nuevas direcciones de contratos, nuevo explorer URL | TRIVIAL |
| `backend/engine/claim_sync.py:42-46,150,230,232` | Direcciones de contratos, variable `PHAROS_RPC` → `MEGAETH_RPC`, `PHAROS_CHAIN_ID` → `4326`, docstrings | MENOR |
| `backend/engine/listener.py:3,24-25,279` | Variable `PHAROS_RPC_URL`/`MONAD_RPC_URL` → `MEGAETH_RPC_URL`, dirección NFT, docstrings | MENOR |
| `backend/api/routes/devs.py:16-17` | Variable RPC + dirección de contrato NFT | TRIVIAL |
| `backend/api/routes/academy.py:189` | Comentario con dirección de contrato | TRIVIAL |
| `backend/db/reset_data.sql:2,4` | Solo comentarios históricos — sin cambio funcional | — |
| `render.yaml` | Sin referencias blockchain — no requiere cambios | — |

---

## 4. Frontend

| Archivo | Qué Cambiar | Esfuerzo |
|---------|-------------|----------|
| `frontend/src/services/contract.js:1-7` | Direcciones de contratos, `PHAROS_CHAIN_ID` → `MEGAETH_CHAIN_ID` = `4326`, explorer URL, eliminar alias `MONAD_CHAIN_ID` | TRIVIAL |
| `frontend/src/services/wagmi.js:4-23` | Definición completa de chain: ID, nombre, moneda nativa, RPC, explorer | MENOR |
| `frontend/src/hooks/useWallet.js:3,11,17,20,27-38` | Import, referencias a chain ID, hex `0xA8331` → `0x10E6`, nombre de red, moneda, RPC, explorer | MENOR |
| `frontend/src/components/programs/netwatch/utils/constants.js:1-14` | `PHAROS_CONFIG` → config MegaETH: RPC, chain ID, explorer | TRIVIAL |
| `frontend/src/components/programs/flow/hooks/useWalletData.js:4-12` | RPC URL + 5 direcciones de tokens ERC-20 en MegaETH | MENOR |
| `frontend/src/components/programs/monad-build/constants/monad.js:1-28` | 2 objetos de config (MAINNET/TESTNET), 6 contratos canónicos, proveedores RPC | MODERADO |
| `frontend/src/components/programs/nadwatch/constants.js:1-3,26` | RPC, chain ID, palabras easter egg | TRIVIAL |
| `frontend/src/components/programs/parallax/constants.js:1,21,24,25` | Textos boot con "PHAROS" y chain ID | TRIVIAL |
| `frontend/src/components/Desktop.jsx:29-34` | Labels: "Pharos SDK" → "MegaETH SDK", "Pharos City", "Pharos Build" | TRIVIAL |
| `frontend/src/components/programs/chogpet/*` | "PHAROSGOTCHI" → rebranding + 14 tips educativos sobre Pharos → MegaETH | MODERADO |
| `frontend/src/components/programs/pharos-sdk/*` | Nombre, HelpDialog completo, misiones track1 (preguntas, respuestas, explicaciones) | MODERADO |

---

## 5. Programas del Portal — Tabla de Compatibilidad

| # | Programa | Component ID | Depende On-Chain | Branding Pharos | Acción Requerida |
|---|---------|-------------|:----------------:|:---------------:|-----------------|
| 1 | NX Terminal | `nx-terminal` | NO | NO | Ninguna |
| 2 | Live Feed | `live-feed` | NO | NO | Ninguna |
| 3 | World Chat | `world-chat` | NO | NO | Ninguna |
| 4 | Leaderboard | `leaderboard` | NO | NO | Ninguna |
| 5 | Protocol Market | `protocol-market` | NO | NO | Ninguna |
| 6 | AI Lab | `ai-lab` | NO | NO | Ninguna |
| 7 | My Devs | `my-devs` | SÍ | NO | Actualizar chain config |
| 8 | NXT Wallet | `nxt-wallet` | SÍ | NO | Actualizar chain config |
| 9 | Inbox | `inbox` | NO | NO | Ninguna |
| 10 | Mint/Hire Devs | `hire-devs` | SÍ | NO | Actualizar chain config + dirección contrato |
| 11 | Notepad | `notepad` | NO | NO | Ninguna |
| 12 | Recycle Bin | `recycle-bin` | NO | NO | Ninguna |
| 13 | Corp Wars | `corp-wars` | NO | NO | Ninguna |
| 14 | Settings | `control-panel` | NO | NO | Ninguna |
| 15 | Flow | `flow` | SÍ | SÍ (texto) | Cambiar RPC + direcciones tokens |
| 16 | Nadwatch | `nadwatch` | SÍ | SÍ (extensivo) | Cambiar RPC, chain ID, rebranding |
| 17 | Parallax | `parallax` | NO | SÍ (boot msgs) | Rebranding boot messages |
| 18 | Pharos SDK (old) | `monad-sdk` | NO | SÍ (label) | Renombrar label |
| 19 | Pharos City | `monad-city` | NO | SÍ (label) | Renombrar label |
| 20 | NX Dev Academy | `dev-academy` | SÍ | SÍ (contenido) | NFT gating usa config central — OK |
| 21 | Pharos Build | `monad-build` | SÍ | SÍ (extensivo) | Config completa + contratos canónicos |
| 22 | Netwatch | `netwatch` | SÍ | SÍ (config) | Cambiar PHAROS_CONFIG completo |
| 23 | Pharos SDK (new) | `pharos-sdk` | NO | SÍ (nombre completo) | Rebranding + contenido educativo |
| 24 | PHARES | `phares` | Posiblemente | SÍ (nombre) | Evaluar renombrar |
| | | | | | |
| | **TOTALES** | | **8 SÍ + 1 posible** | **11 SÍ** | |

---

## 6. NFTs y Metadata

### Estado Actual del Sistema

| Componente | Detalle | Impacto Migración |
|------------|---------|:-----------------:|
| **Contrato NFT** | NXDevNFT v4, ERC-721, 35,000 supply, mint aleatorio Fisher-Yates | REDEPLOY |
| **Contrato Token** | NXTToken v3, ERC-20, 1B max supply, economía circular | REDEPLOY |
| **baseURI** | Configurable via `setBaseURI()` — apunta al backend API | Configurar post-deploy |
| **Imágenes** | IPFS CID: `bafybeicz5ilcu6i36ljkacix37c4r3qrtrpjhwgylp2buxfea443cxc7i4/{id}.gif` | SIN CAMBIO |
| **Metadata API** | `GET /metadata/{token_id}` y `GET /devs/{token_id}/metadata` | SIN CAMBIO en lógica |
| **external_url** | `https://nxterminal.xyz/dev/{token_id}` | SIN CAMBIO |

### Las 6 Corporaciones (Lore del juego — sin cambio)

| ID | Nombre | Definida en |
|----|--------|-------------|
| CLOSED_AI | Closed AI | DB schema, dev_generator, listener, devs.py, corps.js, netwatch constants |
| MISANTHROPIC | Misanthropic | (mismos archivos) |
| SHALLOW_MIND | Shallow Mind | (mismos archivos) |
| ZUCK_LABS | Zuck Labs | (mismos archivos) |
| Y_AI | Y.AI | (mismos archivos) |
| MISTRIAL_SYSTEMS | Mistrial Systems | (mismos archivos) |

### Sistema de Traits (generación procedural determinística desde token ID)

| Categoría | Cantidad | Ejemplos | Impacto Migración |
|-----------|:--------:|---------|:-----------------:|
| Traits Visuales | 14 | Species, Skin, Clothing, Vibe, Glow, Hair, Headgear, etc. | SIN CAMBIO |
| Traits de Personalidad | 5 | Alignment, Risk Level, Social Style, Coding Style, Work Ethic | SIN CAMBIO |
| Base Stats | 6 | Coding, Hacking, Trading, Social, Endurance, Luck (15-95) | SIN CAMBIO |
| Traits Dinámicos | 15+ | Status, Mood, Energy, Reputation, Balance $NXT, Day, Coffee, etc. | SIN CAMBIO |
| Archetype | 8 tipos | 10X_DEV, LURKER, DEGEN, GRINDER, etc. (pesados) | SIN CAMBIO |
| Rarity | 5 niveles | Common 60%, Uncommon 25%, Rare 10%, Legendary 4%, Mythic 1% | SIN CAMBIO |

> **No existe sistema "Skill Modules".** Los traits son de personalidad y stats base.

---

## 7. Estimación de Esfuerzo

### Cada Cambio Individual

| # | Cambio | Esfuerzo | Archivos |
|---|--------|----------|----------|
| 1 | Redeploy NXDevNFT v4 en MegaETH | MODERADO | contracts/NXDevNFT_v4.sol |
| 2 | Redeploy NXTToken v3 en MegaETH | MODERADO | contracts/NXTToken_v3.sol |
| 3 | Configurar baseURI post-deploy | TRIVIAL | Llamada on-chain `setBaseURI()` |
| 4 | Actualizar .env.example | TRIVIAL | .env.example |
| 5 | Actualizar claim_sync.py | MENOR | backend/engine/claim_sync.py |
| 6 | Actualizar listener.py | MENOR | backend/engine/listener.py |
| 7 | Actualizar devs.py | TRIVIAL | backend/api/routes/devs.py |
| 8 | Actualizar academy.py | TRIVIAL | backend/api/routes/academy.py |
| 9 | Actualizar contract.js | TRIVIAL | frontend/src/services/contract.js |
| 10 | Actualizar wagmi.js | MENOR | frontend/src/services/wagmi.js |
| 11 | Actualizar useWallet.js | MENOR | frontend/src/hooks/useWallet.js |
| 12 | Actualizar netwatch constants | TRIVIAL | frontend/src/.../netwatch/utils/constants.js |
| 13 | Actualizar flow useWalletData | MENOR | frontend/src/.../flow/hooks/useWalletData.js |
| 14 | Actualizar monad-build constants | MODERADO | frontend/src/.../monad-build/constants/monad.js |
| 15 | Actualizar nadwatch constants | TRIVIAL | frontend/src/.../nadwatch/constants.js |
| 16 | Actualizar parallax constants | TRIVIAL | frontend/src/.../parallax/constants.js |
| 17 | Actualizar Desktop.jsx labels | TRIVIAL | frontend/src/components/Desktop.jsx |
| 18 | Rebranding chogpet | MODERADO | frontend/src/.../chogpet/* (3 archivos) |
| 19 | Rebranding pharos-sdk | MODERADO | frontend/src/.../pharos-sdk/* (HelpDialog + misiones) |
| 20 | Actualizar env vars en Render dashboard | TRIVIAL | Dashboard de Render (no es código) |

### Resumen de Esfuerzo

| Nivel | Cantidad | Ejemplos |
|-------|:--------:|---------|
| TRIVIAL (< 5 min) | 10 | .env, contract.js, Desktop labels, comentarios |
| MENOR (5-30 min) | 6 | wagmi.js, useWallet.js, listener.py, claim_sync.py |
| MODERADO (30 min - 2 hrs) | 4 | Deploy contratos, monad-build config, chogpet, pharos-sdk |
| MAYOR (> 2 hrs) | 0 | — |

**Esfuerzo total estimado: ~2-3 días de trabajo**

---

## 8. Riesgos

### Riesgos al Cambiar de Red

| # | Riesgo | Severidad | Mitigación |
|---|--------|:---------:|-----------|
| 1 | **Pérdida de estado on-chain** — NFTs minteados en Pharos no existen en MegaETH | ALTA | Snapshot de holders + airdrop/migration contract en MegaETH, o fresh start |
| 2 | **Tokens $NXT perdidos** — Balances de $NXT en Pharos no se transfieren | ALTA | Snapshot de balances + mint equivalente en MegaETH |
| 3 | **Direcciones de contratos hardcodeadas** — 5 archivos backend + 3 frontend con direcciones hardcodeadas | MEDIA | Centralizar en env vars; actualmente 3 archivos usan la misma dirección hardcodeada |
| 4 | **Gas model diferente** — MegaEVM usa gas multidimensional (compute + storage), intrinsic gas 60,000 | MEDIA | Los contratos ya están adaptados para MegaEVM (ver comentarios NatSpec) |
| 5 | **Tokens ERC-20 en Flow** — WMON, USDC, USDT, WETH, AUSD tienen direcciones específicas de Pharos | MEDIA | Obtener direcciones de tokens en MegaETH; algunos pueden no existir aún |
| 6 | **Contratos canónicos** — MULTICALL3, PERMIT2, SAFE, CREATEX tienen direcciones de Pharos | MEDIA | Verificar si MegaETH tiene CREATE2 deployments estándar (la mayoría de L2s los tienen) |
| 7 | **RPC rate limits** — El RPC de MegaETH puede tener diferentes límites vs Pharos | BAJA | Monitorear y ajustar POLL_INTERVAL si es necesario |
| 8 | **Explorer no disponible** — MegaETH puede no tener un explorer público estable | BAJA | Usar explorer alternativo o deshabilitar links temporalmente |
| 9 | **localStorage collision** — `pharosgotchi-state` key podría causar conflictos si el usuario usó la versión Pharos | BAJA | Cambiar key de localStorage |
| 10 | **Moneda nativa diferente** — Pharos usa PHRS; MegaETH usa ETH. Afecta precios de mint y gas | MEDIA | Ajustar precios de mint en los contratos (ya configurables via setter) |

---

## 9. Plan de Acción — Pasos Ordenados para Reactivar MegaETH

### Fase 1: Preparación (Pre-deploy)

1. **Obtener acceso a MegaETH testnet/mainnet**
   - RPC URL, chain ID (4326), faucet, explorer URL
   - Verificar que el nodo esté estable y acepte transacciones

2. **Verificar contratos canónicos en MegaETH**
   - Confirmar existencia de MULTICALL3, PERMIT2, SAFE, CREATEX
   - Identificar tokens ERC-20 disponibles (WETH, USDC, stablecoins)

3. **Decidir estrategia de migración de estado**
   - Opción A: Fresh start (sin migración de NFTs/tokens)
   - Opción B: Snapshot + airdrop (preservar holders de Pharos)

### Fase 2: Deploy de Contratos

4. **Deploy NXTToken v3 en MegaETH**
   - Usar Foundry con `--skip-simulation --gas-limit` (requerido por MegaEVM)
   - Configurar treasury wallet y minters iniciales

5. **Deploy NXDevNFT v4 en MegaETH**
   - Configurar: baseURI apuntando al backend API, payment token, treasury wallet
   - Setear NXTToken address via `setNXTToken()`
   - Configurar backend signer via `setBackendSigner()`
   - Verificar contratos en explorer de MegaETH

6. **Anotar nuevas direcciones de contratos**
   - NXDevNFT: `0x...` (nueva)
   - NXTToken: `0x...` (nueva)

### Fase 3: Actualizar Backend

7. **Actualizar configuración de entorno**
   - `.env.example`: nuevas vars, direcciones, chain ID 4326
   - Render dashboard: actualizar env vars en producción

8. **Actualizar archivos de backend**
   - `claim_sync.py`: direcciones, RPC, chain ID
   - `listener.py`: RPC, dirección NFT
   - `devs.py`: RPC, dirección NFT
   - `academy.py`: comentario con dirección

9. **Resetear base de datos** (si fresh start)
   - Ejecutar `reset_data.sql` adaptado para nueva migración
   - Verificar que el listener detecta eventos en MegaETH

### Fase 4: Actualizar Frontend

10. **Actualizar configuración central**
    - `contract.js`: direcciones, chain ID, explorer
    - `wagmi.js`: definición completa de chain MegaETH
    - `useWallet.js`: chain ID hex, nombre, RPC, explorer, moneda

11. **Actualizar programas con datos on-chain**
    - `netwatch/constants.js`: config de red
    - `nadwatch/constants.js`: RPC, chain ID
    - `flow/useWalletData.js`: RPC + direcciones de tokens
    - `monad-build/constants/monad.js`: config completa + contratos canónicos

12. **Rebranding de UI**
    - `Desktop.jsx`: labels de iconos
    - `parallax/constants.js`: boot messages
    - `chogpet/*`: nombre, tips educativos
    - `pharos-sdk/*`: nombre, contenido educativo, misiones

### Fase 5: Testing y Deploy

13. **Testing end-to-end en MegaETH testnet**
    - Mint de NFTs
    - Claim de $NXT
    - Verificar metadata endpoint
    - Verificar listener detecta eventos
    - Probar todos los programas on-chain (Flow, Nadwatch, Netwatch, Monad Build)

14. **Deploy a producción**
    - Push frontend actualizado
    - Actualizar env vars en Render
    - Verificar health checks del backend
    - Monitorear logs del listener y claim_sync

15. **Verificación post-deploy**
    - Confirmar tokenURI devuelve metadata correcta
    - Confirmar wallet connection funciona con chain 4326
    - Confirmar auto-switch de red funciona
    - Monitorear RPC rate limits y ajustar polling si es necesario
