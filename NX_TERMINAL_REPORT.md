# NX TERMINAL — Complete Project Report / Informe Completo del Proyecto

> This is a research report, not an implementation plan. No code changes needed.

---

# ENGLISH VERSION

---

## 1. WHAT IS NX TERMINAL?

**NX Terminal** is a **Web3 gamified operating system** built with a Windows 98 retro aesthetic. It runs on the **Pharos Atlantic Testnet** (Chain ID 688689) and serves as an interactive hub for the Pharos blockchain ecosystem.

**Core concept:** Each user who mints an **NXDev NFT** (ERC-721) gains access to a desktop environment with 24+ programs — DeFi tools, developer training, games, prediction markets, network monitoring, and a simulated AI developer economy.

**Tech stack:**
- **Frontend:** React 19 + Vite + wagmi/viem (wallet)
- **Backend:** Python FastAPI + PostgreSQL + Redis + WebSocket
- **Contracts:** Solidity (NXDevNFT v4 ERC-721 + NXT ERC-20 token)
- **Chain:** Pharos Atlantic Testnet (RPC: `atlantic.dplabs-internal.com`, Chain ID: 688689)
- **NFT Contract:** `0x5DeAB0Ab650D9c241105B6cb567Dd41045C44636`

---

## 2. NFT GATING & ACCESS MODEL

| Feature | Access |
|---------|--------|
| Desktop + basic programs | Open (wallet connect) |
| Dev Academy — General Path | Open |
| Dev Academy — Pharos Path | NFT required |
| Pharos SDK — Track 1 (5 missions) | Open |
| Pharos SDK — Track 2 (10 missions) | NFT required |
| Netwatch — Track Wallet | NFT required |
| My Devs / Dev Management | NFT required |
| $NXT Token Claims | NFT required |

**NFT specs:** 35,000 max supply, random mint via Fisher-Yates shuffle, 5% royalties (ERC-2981), dual payment (native PHRS or stablecoin).

---

## 3. ALL PROGRAMS — DETAILED BREAKDOWN

### 3.1 PHAROS CITY (Isometric City Visualizer)
**What it does:** Real-time 3D isometric city that visualizes Pharos blockchain activity.
**Data source:** Live RPC from `atlantic.dplabs-internal.com` (eth_blockNumber, eth_gasPrice, eth_getBlockByNumber).
**Shows:** Block number, TPS, gas price, block transaction chart, weather system, sentiment bar, events feed (whale alerts, deploys, liquidations), scrolling ticker.
**Price:** $0.00 with glowing TESTNET badge (testnet has no market price).
**9 Districts:** DeFi District, NFT & Gaming, Yield Gardens, Derivatives Row, Infra Hub, Perps Row, Bridge District, Lending Quarter, Parallel Lane — each with unique building colors/signs.

### 3.2 NETWATCH (Network Surveillance)
**What it does:** Cyberpunk-themed blockchain monitor with Matrix-style block rain visualization.
**Data source:** Live RPC polling every 3 seconds.
**Shows:** TPS with bar chart, gas throughput (Ggas), block height, block time, validator count (~120-140), total transactions, TPS sparkline (60s history), live transaction flow with type detection (Transfer, Swap, Deploy, Mint, etc.).
**Label:** "PHAROS TESTNET — CHAIN 688689"

### 3.3 PHAROS BUILD (Developer Toolkit)
**What it does:** Complete build-deploy-learn toolkit for Pharos smart contract development.
**6 modules:**
- **Home Dashboard** — Quick actions (Create Token, Create NFT, Game Contract, Learn, Deploy, Explore), Pharos vs Ethereum comparison table
- **Learn** — 6 topics: What is Pharos?, Pharos vs Ethereum, Gas on Pharos, 5-Minute Quick Start, Pre-Deploy Checklist, Solidity on Pharos
- **Build** — Smart contract wizard with 6 templates (ERC-20, ERC-721, ERC-1155, Staking, Game Economy, Custom), auto-generates Solidity code with Pharos optimization headers
- **Deploy** — Connect wallet → set network → estimate gas → deploy → share on X
- **Ecosystem** — Directory of 15+ Pharos protocols (Kuru, Uniswap V4, Curve, Morpho, aPriori, etc.)
- **Resources** — RPC endpoints, block explorers, canonical contracts (WPHRS, Multicall3, Permit2, Safe), faucets, viem/wagmi code snippets

### 3.4 PHAROS SDK (Gamified Developer Training)
**What it does:** Mission-based training simulator with XP, ranks, and satirical corporate theming.
**Progression:** RECRUIT → OPERATIVE → SPECIALIST → AGENT → COMMANDER → ARCHITECT
**Track 1 (Open — 5 missions):**
- M01: First Contact — Blockchain fundamentals quiz (50 XP)
- M02: Wallet Genesis — Wallet security quiz (50 XP)
- M03: Token Forge — Write ERC-20 Solidity code (100 XP)
- M04: Supply Line — DEX mechanics quiz (100 XP)
- M05: Network Pulse — JSON-RPC JavaScript code (100 XP)

**Track 2 (NFT-locked — 10 missions):**
- M06-M15: Smart contracts, AMM liquidity, lending, security auditing, parallel execution, RWA tokenization, gas optimization, CTF challenges, SPN architecture, final combined challenge.

**6 Satirical Corporations:** Closed AI (Scam Altwoman), Misanthropic (Dario Annoyed-ei), Shallow Mind (Sundial Richy), Zuck Labs (Mark Zuckatron), Y.AI (FelonUsk), Mistrial Systems (Pierre-Antoine du Code).

### 3.5 NX DEV ACADEMY (Structured Learning)
**What it does:** Multi-lesson curriculum with concept/code/quiz exercises.
**Two paths:**
- **General Path** — Open to all, teaches blockchain basics
- **Pharos Path** — NFT-gated, deep dives into Pharos architecture (AsyncBFT, parallel execution), smart contract development, wallet setup, dApp building
**AI Mentor:** Anthropic-powered coding assistant (rate-limited 10 hints/hour)

### 3.6 FLOW (DeFi Intelligence Terminal)
**What it does:** Real-time DeFi dashboard with 5 panels.
- **The Stream** — Live trade feed from DEXs (Kuru, Uniswap, PancakeSwap, Balancer, Curve, Nad.fun, Perpl)
- **Wallet X-Ray** — On-chain wallet analysis by address
- **Token Radar** — Pool safety scoring engine (0-100 score based on liquidity, volume, age, volatility)
- **CLOB Vision** — Central limit order book visualization
- **AI Oracle** — Natural language queries about Pharos DeFi data

### 3.7 PHARES (Prediction Markets)
**What it does:** Binary prediction markets on Pharos.
**Features:** Active markets with YES/NO betting, odds visualization as horizontal bars, multiplier calculations, bet settlement, leaderboard, positions tracking.
**Tokens:** NXT, USDC (more coming).

### 3.8 CORP WARS (Territory Control PvP)
**What it does:** Strategy game where AI corporations compete for territory.
**Gameplay:** Grid-based territory control, contested zones with pulsing animations, corporate alliances and conflicts.

### 3.9 CHOGPET (Virtual Pet / Tamagotchi)
**What it does:** Retro LCD-style virtual pet simulator.
**Features:** 4 pet types, feed (8/day limit), pet (15/day limit), hunger/happiness stats, XP leveling, tips/helper mode.

### 3.10 PARALLAX (Parallel Execution Simulator)
**What it does:** Visualizes Pharos' parallel transaction execution model.
**Shows:** 8 parallel execution lanes, conflict detection log, performance metrics, pipeline status.

### 3.11 MY DEVS (Developer Roster)
**What it does:** Manage your minted NXDev NFTs — view stats, energy, location, archetype, rarity.
**Dev attributes:** 8 archetypes (10X_DEV, LURKER, DEGEN, GRINDER, etc.), 5 rarities (Common 60%, Uncommon 25%, Rare 10%, Legendary 4%, Mythic 1%).

### 3.12 MINT/HIRE DEVS (NFT Minting)
**What it does:** Mint new NXDev NFTs on Pharos.
**Modes:** Public mint, Whitelist mint (reduced price), Free mint (per-wallet allowance), Owner mint.

### 3.13 NXT WALLET (Token Management)
**What it does:** View $NXT token balance, claim rewards from owned devs.
**Functions:** `claimNXT(tokenIds[])`, `previewClaim(tokenIds[])`, `walletClaimable(wallet)`.

### 3.14 PROTOCOL MARKET (Trading)
**What it does:** Marketplace for DeFi protocols created by AI devs in the simulation.

### 3.15 AI LAB (AI Creation & Voting)
**What it does:** Community-created absurd AI names/descriptions with voting system.

### 3.16 LIVE FEED (Social Stream)
**What it does:** Real-time WebSocket feed of all developer actions, market events, corporate drama.

### 3.17 WORLD CHAT (Global Chat)
**What it does:** Multi-channel chat (location-based + trollbox), real-time via WebSocket.

### 3.18 LEADERBOARD (Rankings)
**What it does:** Dev rankings by balance, reputation, protocol performance.

### 3.19 INBOX (Notifications)
**What it does:** Player notification center with read/unread tracking.

### 3.20 NOTEPAD (Text Editor)
**What it does:** Simple text editor for notes.

### 3.21 BUG SWEEPER (Minesweeper)
**What it does:** Classic Minesweeper clone (9x9 grid, 10 mines).

### 3.22 PROTOCOL SOLITAIRE (Card Game)
**What it does:** Full solitaire card game implementation.

### 3.23 CONTROL PANEL (Settings)
**What it does:** System configuration — 3 themes (Classic/Dark/High-Contrast), 6 wallpapers, screensaver selection (3D Pipes/Matrix Rain/Starfield), NX Assistant character selection (7 agents).

### 3.24 NX TERMINAL (Command Line)
**What it does:** Main terminal/launcher interface.

---

## 4. SIMULATION ENGINE (Backend)

The backend runs a **simulation game engine** where minted NXDev NFTs autonomously perform actions:
- **Actions:** CREATE_PROTOCOL, CREATE_AI, INVEST, SELL, MOVE, CHAT, CODE_REVIEW, REST
- **Personality Matrix:** Each archetype has weighted probabilities for actions (10X_DEV creates protocols, DEGEN invests recklessly, LURKER rests)
- **Blockchain Listener:** Watches `DevMinted` events, procedurally generates dev stats
- **WebSocket Feed:** Real-time updates to all connected players

---

## 5. VISUAL IDENTITY

- **Windows 98 retro UI** — beveled buttons, gray panels, classic taskbar, Start menu
- **Boot sequence** — BIOS screen with ASCII art, memory counter, humorous system messages
- **BSOD errors** — Corporate-themed blue screens (2% random chance)
- **NX Assistant** — Clippy-style animated helper with 60+ witty crypto/dev messages
- **3 Screensavers** — 3D Pipes, Matrix Rain, Starfield
- **3 Themes** — Classic (teal), Dark (purple), High-Contrast (yellow/black)

---

## 6. ARCHITECTURE SUMMARY

```
┌─────────────────────────────────────────────┐
│              PHAROS ATLANTIC TESTNET         │
│         Chain 688689 · RPC · Explorer        │
├──────────────┬──────────────────────────────┤
│  NXDevNFT    │  NXT Token (ERC-20)          │
│  (ERC-721)   │  Claim rewards per dev       │
├──────────────┴──────────────────────────────┤
│              BACKEND (FastAPI)               │
│  Engine · Listener · API · WebSocket · DB   │
├─────────────────────────────────────────────┤
│           FRONTEND (React + Vite)           │
│  24+ Programs · Win98 UI · wagmi/viem       │
│  NFT Gating · Wallet · Themes · Assistant   │
└─────────────────────────────────────────────┘
```

---
---

# VERSION EN ESPAÑOL

---

## 1. ¿QUÉ ES NX TERMINAL?

**NX Terminal** es un **sistema operativo Web3 gamificado** con estética retro de Windows 98. Corre sobre **Pharos Atlantic Testnet** (Chain ID 688689) y funciona como un hub interactivo para el ecosistema blockchain de Pharos.

**Concepto central:** Cada usuario que mintea un **NXDev NFT** (ERC-721) accede a un escritorio con 24+ programas — herramientas DeFi, entrenamiento para desarrolladores, juegos, mercados de predicción, monitoreo de red, y una economía simulada de desarrolladores IA.

**Stack tecnológico:**
- **Frontend:** React 19 + Vite + wagmi/viem (wallet)
- **Backend:** Python FastAPI + PostgreSQL + Redis + WebSocket
- **Contratos:** Solidity (NXDevNFT v4 ERC-721 + NXT ERC-20)
- **Chain:** Pharos Atlantic Testnet (RPC: `atlantic.dplabs-internal.com`, Chain ID: 688689)
- **Contrato NFT:** `0x5DeAB0Ab650D9c241105B6cb567Dd41045C44636`

---

## 2. MODELO DE ACCESO POR NFT

| Funcionalidad | Acceso |
|---------------|--------|
| Escritorio + programas básicos | Abierto (conectar wallet) |
| Dev Academy — Camino General | Abierto |
| Dev Academy — Camino Pharos | Requiere NFT |
| Pharos SDK — Track 1 (5 misiones) | Abierto |
| Pharos SDK — Track 2 (10 misiones) | Requiere NFT |
| Netwatch — Track Wallet | Requiere NFT |
| My Devs / Gestión de Devs | Requiere NFT |
| Reclamo de tokens $NXT | Requiere NFT |

**Specs del NFT:** 35,000 supply máximo, mint aleatorio (Fisher-Yates shuffle), 5% regalías (ERC-2981), pago dual (PHRS nativo o stablecoin).

---

## 3. TODOS LOS PROGRAMAS — DETALLE COMPLETO

### 3.1 PHAROS CITY (Visualizador Isométrico de Ciudad)
**Qué hace:** Ciudad 3D isométrica en tiempo real que visualiza la actividad de la blockchain Pharos.
**Fuente de datos:** RPC en vivo desde `atlantic.dplabs-internal.com`.
**Muestra:** Número de bloque, TPS, precio de gas, gráfico de transacciones por bloque, sistema de clima, barra de sentimiento, eventos (alertas de ballenas, deploys, liquidaciones), ticker deslizante.
**Precio:** $0.00 con badge brillante de TESTNET (testnet no tiene precio de mercado).
**9 Distritos:** DeFi District, NFT & Gaming, Yield Gardens, Derivatives Row, Infra Hub, Perps Row, Bridge District, Lending Quarter, Parallel Lane — cada uno con colores y carteles únicos.

### 3.2 NETWATCH (Vigilancia de Red)
**Qué hace:** Monitor de blockchain estilo cyberpunk con visualización de "lluvia de bloques" tipo Matrix.
**Fuente de datos:** Polling RPC cada 3 segundos.
**Muestra:** TPS con barra, throughput de gas (Ggas), altura de bloque, tiempo de bloque, conteo de validadores (~120-140), transacciones totales, sparkline TPS (historial 60s), flujo de transacciones en vivo con detección de tipo (Transfer, Swap, Deploy, Mint, etc.).
**Etiqueta:** "PHAROS TESTNET — CHAIN 688689"

### 3.3 PHAROS BUILD (Toolkit de Desarrollo)
**Qué hace:** Toolkit completo de build-deploy-learn para desarrollo de smart contracts en Pharos.
**6 módulos:**
- **Home** — Acciones rápidas, tabla comparativa Pharos vs Ethereum
- **Learn** — 6 temas: Qué es Pharos, Gas en Pharos, Quick Start 5 min, Checklist de Deploy, Solidity en Pharos
- **Build** — Wizard de smart contracts con 6 templates (ERC-20, ERC-721, ERC-1155, Staking, Game Economy, Custom), genera código Solidity con headers de optimización Pharos
- **Deploy** — Conectar wallet → elegir red → estimar gas → deployar → compartir en X
- **Ecosystem** — Directorio de 15+ protocolos Pharos (Kuru, Uniswap V4, Curve, Morpho, aPriori, etc.)
- **Resources** — Endpoints RPC, exploradores, contratos canónicos, faucets, snippets de código viem/wagmi

### 3.4 PHAROS SDK (Entrenamiento Gamificado)
**Qué hace:** Simulador de entrenamiento basado en misiones con XP, rangos y temática corporativa satírica.
**Progresión:** RECRUIT → OPERATIVE → SPECIALIST → AGENT → COMMANDER → ARCHITECT
**Track 1 (Abierto — 5 misiones):**
- M01: First Contact — Quiz de fundamentos blockchain (50 XP)
- M02: Wallet Genesis — Quiz de seguridad de wallets (50 XP)
- M03: Token Forge — Escribir código Solidity ERC-20 (100 XP)
- M04: Supply Line — Quiz de mecánicas DEX (100 XP)
- M05: Network Pulse — Código JavaScript JSON-RPC (100 XP)

**Track 2 (Bloqueado por NFT — 10 misiones):**
- M06-M15: Smart contracts, liquidez AMM, lending, auditoría de seguridad, ejecución paralela, tokenización RWA, optimización de gas, desafíos CTF, arquitectura SPN, desafío final combinado.

**6 Corporaciones Satíricas:** Closed AI, Misanthropic, Shallow Mind, Zuck Labs, Y.AI, Mistrial Systems.

### 3.5 NX DEV ACADEMY (Aprendizaje Estructurado)
**Qué hace:** Currículum multi-lección con ejercicios de concepto/código/quiz.
**Dos caminos:**
- **Camino General** — Abierto, enseña fundamentos blockchain
- **Camino Pharos** — Requiere NFT, profundiza en arquitectura Pharos (AsyncBFT, ejecución paralela), desarrollo de smart contracts, setup de wallet, construcción de dApps
**AI Mentor:** Asistente de código potenciado por Anthropic (límite 10 pistas/hora)

### 3.6 FLOW (Terminal de Inteligencia DeFi)
**Qué hace:** Dashboard DeFi en tiempo real con 5 paneles.
- **The Stream** — Feed de trades en vivo de DEXs
- **Wallet X-Ray** — Análisis on-chain de wallets
- **Token Radar** — Score de seguridad de pools (0-100)
- **CLOB Vision** — Visualización de order book
- **AI Oracle** — Consultas en lenguaje natural sobre datos DeFi

### 3.7 PHARES (Mercados de Predicción)
**Qué hace:** Mercados de predicción binarios en Pharos.
**Features:** Apuestas YES/NO, visualización de odds, multiplicadores, liquidación, leaderboard, tracking de posiciones.

### 3.8 CORP WARS (Control de Territorio PvP)
**Qué hace:** Juego de estrategia donde corporaciones IA compiten por territorio.

### 3.9 CHOGPET (Mascota Virtual / Tamagotchi)
**Qué hace:** Simulador de mascota virtual estilo LCD retro.
**Features:** 4 tipos de mascota, alimentar (8/día), acariciar (15/día), stats de hambre/felicidad, leveling con XP.

### 3.10 PARALLAX (Simulador de Ejecución Paralela)
**Qué hace:** Visualiza el modelo de ejecución paralela de transacciones de Pharos.
**Muestra:** 8 lanes de ejecución paralela, log de conflictos, métricas de rendimiento, estado del pipeline.

### 3.11-3.24 PROGRAMAS ADICIONALES
- **My Devs** — Gestión de NFTs minteados (stats, energía, ubicación, arquetipo, rareza)
- **Mint/Hire Devs** — Minteo de nuevos NXDev NFTs
- **NXT Wallet** — Balance $NXT, reclamar recompensas de devs
- **Protocol Market** — Marketplace de protocolos DeFi creados por devs IA
- **AI Lab** — Creación comunitaria de IAs absurdas con sistema de votación
- **Live Feed** — Stream en tiempo real de acciones de devs y eventos
- **World Chat** — Chat global multi-canal en tiempo real
- **Leaderboard** — Rankings de devs por balance y reputación
- **Inbox** — Centro de notificaciones
- **Notepad** — Editor de texto simple
- **Bug Sweeper** — Clon de Buscaminas (9x9, 10 minas)
- **Protocol Solitaire** — Juego de solitario completo
- **Control Panel** — Configuración: 3 temas, 6 wallpapers, 3 screensavers, asistente NX
- **NX Terminal** — Interfaz de línea de comandos principal

---

## 4. MOTOR DE SIMULACIÓN (Backend)

El backend ejecuta un **motor de simulación** donde los NXDev NFTs minteados realizan acciones autónomamente:
- **Acciones:** CREATE_PROTOCOL, CREATE_AI, INVEST, SELL, MOVE, CHAT, CODE_REVIEW, REST
- **Matriz de Personalidad:** Cada arquetipo tiene probabilidades ponderadas (10X_DEV crea protocolos, DEGEN invierte temerariamente, LURKER descansa)
- **Listener Blockchain:** Escucha eventos `DevMinted`, genera stats de devs proceduralmente
- **Feed WebSocket:** Actualizaciones en tiempo real a todos los jugadores

---

## 5. IDENTIDAD VISUAL

- **UI retro Windows 98** — botones biselados, paneles grises, taskbar clásica, menú Start
- **Secuencia de arranque** — Pantalla BIOS con arte ASCII, contador de memoria, mensajes de sistema humorísticos
- **Pantallas azules (BSOD)** — Errores temáticos corporativos (2% probabilidad aleatoria)
- **Asistente NX** — Helper animado estilo Clippy con 60+ mensajes ingeniosos de crypto/dev
- **3 Salvapantallas** — Tuberías 3D, Lluvia Matrix, Campo de Estrellas
- **3 Temas** — Clásico (teal), Oscuro (púrpura), Alto Contraste (amarillo/negro)

---

## 6. RESUMEN DE ARQUITECTURA

```
┌─────────────────────────────────────────────┐
│           PHAROS ATLANTIC TESTNET            │
│        Chain 688689 · RPC · Explorer         │
├──────────────┬──────────────────────────────┤
│  NXDevNFT    │  NXT Token (ERC-20)          │
│  (ERC-721)   │  Reclamar recompensas x dev  │
├──────────────┴──────────────────────────────┤
│             BACKEND (FastAPI)                │
│  Engine · Listener · API · WebSocket · DB   │
├─────────────────────────────────────────────┤
│          FRONTEND (React + Vite)            │
│  24+ Programas · UI Win98 · wagmi/viem      │
│  NFT Gating · Wallet · Temas · Asistente    │
└─────────────────────────────────────────────┘
```
