# Auditoría de Programas — NX Terminal Post-Migración MegaETH

> Fecha: 2026-04-02 | Solo lectura — sin cambios realizados

---

## Tabla Resumen

| # | Programa | Estado | Datos Reales? | Pharos Pendiente | Prioridad Fix |
|---|---------|--------|:-------------:|:----------------:|---------------|
| 1 | **Mega City** | FUNCIONAL | Sí (RPC: bloques, TPS, gas) + simulado | NO | Baja |
| 2 | **NX Dev Academy** | PARCIAL | No (educativo offline) | NO | Media |
| 3 | **Mega Build** | PARCIAL | No (deploy simulado) | NO | Media |
| 4 | **Netwatch** | FUNCIONAL | Sí (RPC: bloques, TPS, gas, txs) | NO | Baja |
| 5 | **Mega SDK** (x2) | PARCIAL | No (educativo offline) | SÍ (3 refs) | Media |
| 6 | **Corp Wars** | FUNCIONAL | Sí (API backend) | NO | Baja |
| 7 | **PHARES** | PARCIAL | No (100% mock) | SÍ (1 ref) | Baja |

---

## Detalle por Programa

### 1. MEGA CITY (`monad-city/`) — FUNCIONAL

**Qué hace:** Ciudad isométrica 3D procedural con 10 distritos (DeFi, NFT, Yield, Derivatives, Infra, Perps, Bridges, Lending, Parallel Lanes). Menú Win98, clima dinámico, ticker de eventos, sentimiento LONG/SHORT.

**Datos reales (via `useMegaETHRPC`):**
- `eth_blockNumber`, `eth_getBlockByNumber`, `eth_gasPrice`
- TPS calculado de ventana de bloques reales, block time de timestamps reales
- RPC: `https://carrot.megaeth.com/rpc`

**Datos simulados:** Sentimiento (%), eventos (whale alerts, liquidaciones), clima, generación procedural de edificios.

**Botones:** Todos funcionan — File>Exit, View>HQ/Panels/Ticker, Districts (10), Help>About.

**Issues:** Help>About solo cierra menú sin mostrar diálogo (menor).

**Pharos refs:** NINGUNA.

---

### 2. NX DEV ACADEMY (`dev-academy/`) — PARCIAL

**Qué hace:** Plataforma educativa interactiva con 2 paths de aprendizaje.

**Contenido educativo:**
- **Path 1: Dev Fundamentals** — Variables, Control Flow, Loops, Functions, Data Structures (genérico)
- **Path 2: Blockchain Builder (MegaETH):**
  - Módulo 1: MegaETH Fundamentals (qué es, arquitectura, chain ID 4326, RPC connection)
  - Módulo 2: Solidity on MegaETH (contratos, estructura, mintNFT, seguridad, gas optimization)
  - Módulo 3: Building dApps (arquitectura, wallet connection, read contracts, mint button)

**6 tipos de lecciones:** concept, code, fill-blank, fix-bug, reorder, output-predict

**NFT Gating:** MOCKEADO — `NFTGate.jsx` usa `setTimeout` con response fake. El hook `useNFTVerify` existe y llama a `/api/academy/verify-nft` pero NO se usa en el flujo principal. Demo mode funciona como bypass.

**Pharos refs:** NINGUNA (todo actualizado a MegaETH).

**Issues:**
- NFT verification es fake (no verifica ownership real del contrato)
- Hook `useNFTVerify` creado pero no conectado

---

### 3. MEGA BUILD (`monad-build/`) — PARCIAL

**Qué hace:** IDE de contratos para MegaETH con templates, editor, compilación helper y deploy wizard.

**Templates disponibles (5):**
1. **ERC-20 Token** — Burnable, Pausable, Permit, Access Control, Mintable
2. **ERC-721 NFT** — Enumerable, URIStorage, max supply
3. **ERC-1155 Multi-Token** — Fungible + NFT hybrid
4. **Staking Protocol** — Reward rate, lock period, re-entrancy guard
5. **Game Economy** — Moneda in-game + items ERC-1155

**Compilación:** NO compila localmente. Genera config templates para Hardhat/Foundry con `evmVersion: "prague"` (correcto para MegaETH). Redirige a Remix IDE.

**Deploy:** COMPLETAMENTE FAKE — `setTimeout` con direcciones random, sin firma de wallet real, sin `useWriteContract`. DeployForm tiene UI para wallet connection y network toggle pero no ejecuta transacciones.

**Ecosystem directory:** Links a protocolos reales (Kuru, Uniswap, aPriori, etc.)

**Pharos refs:** NINGUNA.

**Issues:**
- Deploy es simulación pura (no usa wagmi para transacciones reales)
- Sin integración real con wallet para deploy on-chain

---

### 4. NETWATCH (`netwatch/`) — FUNCIONAL

**Qué hace:** Terminal de vigilancia de red estilo CRT con scanlines verdes. Boot sequence temático.

**Datos reales (via `useMegaETHRPC`):**
- `eth_blockNumber`, `eth_getBlockByNumber`, `eth_gasPrice`
- Polling cada 3 segundos
- Ventana de 20 bloques para cálculos de TPS y block time
- Cache de 15 transacciones recientes

**Paneles:** Block Rain (Matrix), Network Vitals (block #, TPS, gas, block time), Transaction Flow (hashes + detalles).

**Botones:** Todos funcionan — File>Exit, View>Refresh/Scanlines toggle, Surveillance>Pause/Resume, Help con diálogo.

**Manejo offline:** Overlay "NETWORK OFFLINE" con retry automático (3s) + botón manual "RETRY NOW".

**Pharos refs:** NINGUNA.

---

### 5. MEGA SDK (`pharos-sdk/` + `monad-sdk/`) — PARCIAL / DUPLICADO

**Qué hace:** Simulador de entrenamiento para developers con misiones, quizzes, ejercicios de código.

**Estructura:** 2 copias casi idénticas registradas como "Mega SDK" en Desktop.jsx.

**Contenido:**
- Track 1: 5 misiones (blockchain basics, wallets/keys, gas mechanics, smart contracts)
- Track 2: 10 misiones avanzadas (BLOQUEADO — requiere NFT)
- Sistema XP con 6 rangos: RECRUIT → VALIDATOR → EXECUTOR → PARALLEL → CONSENSUS → ARCHITECT
- 6 corporaciones satíricas como "mentores" de misiones

**No se solapa con Dev Academy** — formato diferente (misiones vs lecciones), contenido diferente.

**Pharos refs (3):**
| Archivo | Contenido |
|---------|-----------|
| `pharos-sdk/PharosSDK.css:2` | `PHAROS_SDK — WIN98 WIZARD THEME` |
| `monad-sdk/MonadSDK.css:2` | `PHAROS_SDK — WIN98 WIZARD THEME (Purple/Green Pharos palette)` |
| `monad-sdk/data/constants.js:3` | `from '../../pharos-sdk/data/constants'` |

**Issues:**
- **Dependencia cruzada crítica:** monad-sdk importa CORPORATIONS, DIFFICULTIES, EXERCISE_TYPES desde pharos-sdk — si se borra pharos-sdk, monad-sdk se rompe
- `BugHuntMission.jsx` existe en pharos-sdk pero falta en monad-sdk
- Misiones de Track 1 difieren levemente entre las dos versiones

---

### 6. CORP WARS (`windows/CorpWars.jsx`) — FUNCIONAL

**Qué hace:** Rankings de dominancia corporativa, mapa territorial, feed de acciones recientes.

**Datos reales (via API backend):**
- `GET /api/leaderboard/corporations` — rankings con balance, protocolos, reputación
- `GET /api/devs?limit=200` — devs con ubicación y corporación
- `GET /api/simulation/feed?limit=100` — acciones corporativas recientes

**Fórmula de dominancia:** `score = (balance × 0.4) + (protocols × 100 × 0.3) + (reputation × 10 × 0.3)`

**Territorios:** 6 ubicaciones (GitHub HQ, Server Farm, VC Tower, Dark Web, Hackathon Hall, Stack Overflow). Controller = corporación con más devs en esa ubicación. "CONTESTED" si diferencia < 3.

**Auto-refresh:** Cada 30 segundos. Todos los datos son reales del backend.

**Pharos refs:** NINGUNA.

---

### 7. PHARES (`phares/`) — PARCIAL (100% MOCK)

**Qué hace:** Mercado de predicciones — apuestas YES/NO en eventos (crypto, tech, sports, economía, MegaETH).

**Data:** 100% MOCK — 5 mercados hardcodeados, 3 posiciones fake, 10 entries de leaderboard inventados. Código tiene `// All mock data — TODO: fetch from /api/phares/markets`.

**UI funcional:** Tabs (Active Markets, My Positions, Resolved, Leaderboard), panel de apuestas con presets (50/100/250/500/MAX), cálculo de retorno con 3% fee, integración visual de wallet.

**Pharos refs (1):** `Phares.css:1` — "Prediction Markets on Pharos" (comentario CSS).

**Issues:** No backend API, no transacciones reales, placeholder funcional.

---

## Total Pharos References Pendientes: 4

Todas son comentarios CSS o imports internos — **ninguna visible al usuario**.

| Archivo | Tipo | Contenido |
|---------|------|-----------|
| `pharos-sdk/PharosSDK.css:2` | CSS comment | `PHAROS_SDK — WIN98 WIZARD THEME` |
| `monad-sdk/MonadSDK.css:2` | CSS comment | `PHAROS_SDK — WIN98 WIZARD THEME` |
| `monad-sdk/data/constants.js:3` | JS import | `from '../../pharos-sdk/data/constants'` |
| `phares/Phares.css:1` | CSS comment | `Prediction Markets on Pharos` |

---

## Prioridades de Corrección

### MEDIA
1. **Mega SDK:** Copiar constants de pharos-sdk a monad-sdk para eliminar dependencia cruzada
2. **Dev Academy:** Conectar `useNFTVerify` hook al flujo principal de NFTGate
3. **Mega Build:** Implementar deploy real con wagmi `useWriteContract`

### BAJA
4. Limpiar 4 comentarios CSS con "Pharos"
5. PHARES: Crear API backend `/api/phares/markets`
6. Mega City: Agregar diálogo para Help>About
