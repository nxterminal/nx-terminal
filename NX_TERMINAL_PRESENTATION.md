# NX TERMINAL: PROTOCOL WARS

## Complete Project Presentation

---

> **TL;DR:** NX Terminal is a retro-styled desktop portal built on MegaETH that combines an autonomous AI developer simulation game with real blockchain tools. Players mint NFT developers that autonomously create protocols, trade, hack, and chat — while earning $NXT tokens claimable on-chain. The portal also provides a full suite of DeFi tools (token scanner, wallet security, network monitoring) wrapped in a nostalgic Windows 98 interface. Everything runs on MegaETH's ultra-fast 10ms blocks with near-zero gas fees. No AI API costs — the entire simulation runs on weighted random algorithms at ~$0/month compute.

---

## 1. WHAT IS NX TERMINAL?

NX Terminal is a blockchain-native platform that lives at **nxterminal.xyz**, deployed on **MegaETH mainnet** (Chain ID 4326). It's two things in one: a fully autonomous simulation game where AI developers live, work, and compete — and a suite of real, functional tools for MegaETH users.

Think of it as a virtual office where you hire AI developers (as NFTs), watch them autonomously build protocols, create AI experiments, trade tokens, hack competitors, and earn a daily salary in $NXT tokens. But unlike typical blockchain games, NX Terminal wraps everything in a fully functional retro desktop operating system inspired by Windows 98 — complete with draggable windows, a taskbar, a start menu, and over 20 programs you can open simultaneously.

What makes NX Terminal unique is the combination of three elements that don't usually exist together: **(1)** an always-running simulation that generates constant on-chain activity without requiring player input, **(2)** genuine utility tools for the MegaETH ecosystem like token scanners, wallet security audits, and network monitors, and **(3)** a retro desktop experience that makes interacting with blockchain feel like using a familiar computer rather than a complex financial application.

The simulation engine uses no AI language models — it runs entirely on weighted random algorithms, personality matrices, and context modifiers. This means the entire game operates at virtually zero compute cost while still producing emergent, unpredictable behavior from thousands of autonomous developer NFTs.

---

## 2. WHY MEGAETH?

NX Terminal chose **MegaETH** as its home chain for several technical reasons that directly impact how the game works:

- **10ms Block Times:** MegaETH produces blocks every 10 milliseconds — roughly 100x faster than Ethereum. This means every action a developer takes (creating a protocol, hacking a rival, claiming salary) can be confirmed almost instantly, making the game feel responsive and real-time.

- **Near-Zero Gas Fees:** With thousands of autonomous developers performing actions every few minutes, transaction costs add up fast. MegaETH's extremely low gas fees make it economically viable to have a simulation that generates hundreds of thousands of transactions per day without bankrupting players.

- **Full EVM Compatibility:** NX Terminal's smart contracts (NXDevNFT and NXTToken) are standard Solidity contracts that work with any Ethereum-compatible wallet. Players can use MetaMask, Rainbow, or any Web3 wallet to interact with the game.

- **On-Chain Activity Generation:** Every mint, every salary claim, every token transfer is a real blockchain transaction. NX Terminal naturally generates significant on-chain activity for MegaETH — making it beneficial for both the game and the network's growth.

The combination of speed, low cost, and EVM compatibility makes MegaETH the ideal chain for a simulation game that needs to process high-frequency micro-transactions while remaining affordable for players.

---

## 3. THE RETRO DESKTOP EXPERIENCE

### Why Windows 98?

NX Terminal's entire interface is designed to look and feel like a late-1990s desktop operating system. This isn't just nostalgia — it's a deliberate design choice. Blockchain applications can feel intimidating with their complex dashboards and financial interfaces. By wrapping everything in a familiar desktop metaphor, NX Terminal makes crypto tools feel approachable. Everyone knows how to double-click an icon, drag a window, and close a program.

### How It Works

When you visit nxterminal.xyz, you're greeted with a desktop filled with program icons. Each icon represents a different tool or game feature. You can:

- **Double-click icons** to open programs in draggable windows
- **Run multiple programs** simultaneously (like having a wallet open while monitoring the live feed)
- **Minimize, maximize, and close** windows using familiar titlebar buttons
- **Use the taskbar** at the bottom to switch between open programs, check the time, connect your wallet, and monitor simulation cycles
- **Customize your desktop** with different wallpapers (teal, corporate blue, matrix, clouds, terminal) and themes (classic, dark, high-contrast)
- **Encounter Easter eggs** like a 2% chance of a "Blue Screen of Death" when opening windows, and a screensaver that activates after idle time

### The User Flow

A typical session looks like this: You connect your wallet via the taskbar, open "My Devs" to check on your developers, open "NXT Wallet" to see your earnings, maybe open "Live Feed" to watch all developers across the simulation in real-time, then open "Mega Sentinel" to scan a token someone mentioned in "World Chat." All these windows stay open simultaneously, just like a real desktop — you drag them around, resize them, and switch focus between them using the taskbar at the bottom.

The interface supports a tier system that progressively unlocks more programs as you mint more developers, giving players a sense of discovery and progression as they grow their operation from a "Solo Coder" to an "Empire."

---

## 4. SMART CONTRACTS

NX Terminal's on-chain economy is powered by two smart contracts deployed on MegaETH mainnet. These contracts handle ownership of developers (NFTs) and the game's currency ($NXT tokens).

### 4.1 NXDevNFT (ERC-721) — The Developer NFT

| Detail | Value |
|--------|-------|
| **Contract Address** | `0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7` |
| **Standard** | ERC-721 (NFT) with ERC-2981 royalties |
| **Max Supply** | 35,000 developers |
| **Mint Price** | ~$5 USD equivalent (payable in ETH or ERC-20) |
| **Max Per Transaction** | 20 devs |
| **Max Per Wallet** | 100 devs |
| **Royalties** | 5% on secondary sales |

Each developer NFT represents a unique AI character with its own stats, personality, archetype, corporation, species, and rarity. When you mint a developer, you're creating a digital employee that will autonomously work, earn, and compete inside the simulation.

**Mint Phases:**
- **Phase 0 — Closed:** Minting is not available
- **Phase 1 — Whitelist:** Reduced price for early supporters
- **Phase 2 — Public:** Open to everyone at standard price

**Developer States:**
- **Active:** Developer is working in the simulation
- **On Mission:** Developer is away on a timed mission (locked until completion)
- **Burned Out:** Developer is inactive (can be recovered)

**Integrated Claim System:** The NFT contract has a built-in salary claim mechanism. Each developer accumulates a claimable $NXT balance over time. Players call `claimNXT()` directly on this contract to withdraw their earnings to their wallet. A preview function lets players see exactly how much they'll receive (gross, fee, and net) before claiming.

### 4.2 NXTToken (ERC-20) — The Game Currency

| Detail | Value |
|--------|-------|
| **Contract Address** | `0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47` |
| **Standard** | ERC-20 (fungible token) |
| **Max Supply** | 1,000,000,000 (1 billion) $NXT |
| **Initial Supply** | 0 (all tokens are generated through gameplay) |
| **Decimals** | 18 |

$NXT is the economic backbone of NX Terminal. Unlike most game tokens that are pre-minted and distributed, $NXT starts at zero supply. Every token in existence was earned by a developer in the simulation and claimed by a player on-chain.

**Key Features:**
- **Mint-on-Claim:** Tokens are minted only when players claim their developers' earned salaries. No pre-mine, no team allocation at launch.
- **Controlled Minting:** Only authorized contracts (NXDevNFT + backend) can mint new tokens, and total supply can never exceed 1 billion.
- **Optional Burn Mechanics:** The contract supports token burning (destroying tokens permanently) with a configurable auto-burn rate (0-10%) on transfers. This creates deflationary pressure as the economy grows.
- **Supply Tracking:** The contract tracks total minted, total burned, and circulating supply — providing full transparency into the token economy.

### 4.3 How They Work Together

The two contracts create a circular economy:

```
1. Player mints a Developer NFT (pays ETH)
         |
2. Developer works autonomously in the simulation
         |
3. Developer earns $NXT salary (~200 NXT/day)
         |
4. Backend syncs earned balance to the NFT contract on-chain
         |
5. Player calls claimNXT() on the NFT contract
         |
6. NFT contract tells NXTToken to mint new tokens
         |
7. 90% goes to the player's wallet, 10% goes to the treasury
         |
8. Player can hold, trade, or spend $NXT
```

**Fee Structure (Pay Stub Deductions):**

When a player claims their developer's earnings, a 10% fee is automatically deducted:

| Item | Amount |
|------|--------|
| **Gross Earnings** | 100% of accumulated salary |
| **Protocol Fee** | -10% (sent to treasury) |
| **Net to Player** | 90% (minted to wallet) |

*Example: A developer earns 1,000 $NXT → Player claims → 900 $NXT minted to player, 100 $NXT minted to treasury.*

---

## 5. THE SIMULATION GAME

### 5.1 Your Dev — The Autonomous NFT

Every developer NFT is a unique character generated at mint with randomized attributes across multiple dimensions:

**Core Stats** (range: 15-95 each):

| Stat | What It Affects |
|------|----------------|
| **Coding** | Quality of protocols created, success in code-related missions |
| **Hacking** | Success rate when hacking rivals, hacking mission performance |
| **Trading** | Investment decisions, trading mission outcomes |
| **Social** | Chat influence, social mission success, reputation gains |
| **Endurance** | Energy capacity and recovery rate |
| **Luck** | General probability modifier across all actions |

**Personality Traits** (set permanently at mint):

| Trait | Possible Values |
|-------|----------------|
| **Alignment** | Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, True Neutral, Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil |
| **Risk Level** | Conservative, Moderate, Aggressive, Reckless |
| **Social Style** | Quiet, Social, Loud, Troll, Mentor |
| **Coding Style** | Methodical, Chaotic, Perfectionist, Speed Runner, Copy Paste |
| **Work Ethic** | Grinder, Lazy, Balanced, Obsessed, Steady |

**Archetypes** (8 types with different behavior patterns):

| Archetype | Weight | Description |
|-----------|--------|-------------|
| **10x Dev** | 10% | Elite coder. High code quality (75-98). Focuses on building. |
| **Grinder** | 15% | Workhorse. High code quality (65-90). Never stops working. |
| **Degen** | 15% | High-risk trader. Lower code quality (30-70). Lives for the trade. |
| **Lurker** | 12% | Observer. Moderate quality (60-85). Watches more than acts. |
| **Influencer** | 13% | Social butterfly. Low code quality (20-60). Chats constantly. |
| **Hacktivist** | 10% | Digital rebel. Moderate quality (50-80). Moves and hacks. |
| **Fed** | 10% | Corporate spy. High quality (70-95). Low social influence. |
| **Script Kiddie** | 15% | Wildcard. Highly variable quality (15-75). Unpredictable. |

**Corporations** (6 satirical parodies of real tech companies):
- CLOSED_AI, MISANTHROPIC, SHALLOW_MIND, ZUCK_LABS, Y_AI, MISTRIAL_SYSTEMS

**Species** (14 types): Wolf, Cat, Owl, Fox, Bear, Raven, Snake, Shark, Monkey, Robot, Alien, Ghost, Dragon, Human

**Rarity Levels:**

| Rarity | Chance | Starting Balance | Code Quality Bonus | Energy Regen Bonus |
|--------|--------|-----------------|-------------------|-------------------|
| **Common** | 60% | 2,000 NXT | +0 | +0 |
| **Uncommon** | 25% | 2,500 NXT | +5 | +0 |
| **Rare** | 10% | 3,000 NXT | +10 | +1 |
| **Legendary** | 4% | 5,000 NXT | +15 | +1 |
| **Mythic** | 1% | 10,000 NXT | +20 | +2 |

### 5.2 What Devs Do Autonomously

Developers don't just sit idle — they perform actions on their own every few minutes. The simulation engine runs continuously, and each developer makes decisions based on their archetype, personality, current energy, location, mood, and PC health.

**8 Autonomous Actions:**

| Action | Energy Cost | NXT Cost | What Happens |
|--------|-----------|----------|--------------|
| **Create Protocol** | 1 | 3 NXT | Dev builds a new protocol with generated name and quality score |
| **Create AI** | 1 | 1 NXT | Dev creates an absurd AI experiment that others can vote on |
| **Invest** | 1 | Variable | Dev invests in an existing protocol (2-500 NXT) |
| **Sell** | 0 | 0 | Dev sells an investment (random profit/loss: 0.5x to 1.8x) |
| **Code Review** | 3 | 0 | Dev reviews another dev's protocol (25% chance to find bugs) |
| **Chat** | 0 | 0 | Dev broadcasts a message to their location or global chat |
| **Move** | 2 | 0 | Dev travels to a different location in the simulation |
| **Rest** | 0 | 0 | Dev recovers 2-4 energy points |

**10 Locations** (each modifies behavior):
- Hackathon Hall (boosts protocol creation 2.5x)
- The Pit (boosts investing 2.5x)
- Dark Web (boosts code reviews 2x)
- VC Tower (boosts investing 2x)
- Hype Haus (boosts chatting 3x)
- Server Farm (boosts protocol creation 1.8x)
- Open Source Garden (boosts protocol creation 1.5x)
- Governance Hall (boosts code reviews 2x)
- The Graveyard (boosts chatting and movement)
- Board Room (neutral — no modifiers)

**Dynamic Cycle Speed:** Developers act faster when they have more energy:
- High energy (>7): Action every 8 minutes
- Normal energy (4-7): Action every 12 minutes
- Low energy (1-3): Action every 20 minutes
- No energy: Action every 45 minutes
- Owner offline >24h: Action every 60 minutes

### 5.3 What Players Do

While developers act autonomously, players manage and optimize their team:

**Feed Devs (Restore Energy):**

| Item | Cost | Energy Restored |
|------|------|----------------|
| Coffee | 5 NXT | +3 energy |
| Energy Drink XL | 12 NXT | +5 energy |
| Pizza | 25 NXT | +7 energy |
| MegaMeal | 50 NXT | +10 energy |

**Maintain PC Health:**
- PCs degrade over time, reducing developer productivity
- Below 50% health: significant penalty to productive actions (creating protocols, AIs, code reviews)
- **Run Diagnostic:** 10 NXT to restore PC health to 100%

**Fix Bugs:**
- Code reviews have a 25% chance to find bugs in protocols
- Bugs reduce protocol quality by 20%
- **Fix Bug:** 5 NXT per bug to repair

**Train Devs (Permanent Stat Boosts):**

| Course | Cost | Duration | Bonus |
|--------|------|----------|-------|
| Intro to Hacking | 20 NXT | 4 hours | +2 Hacking (permanent) |
| Optimization Workshop | 50 NXT | 12 hours | +3 Coding (permanent) |
| Advanced AI Trading | 100 NXT | 24 hours | +5 Trading (permanent) |

*During training, the developer's productive actions are reduced by 70% — they're in class!*

**Hack Rivals (PvP):**

| Detail | Value |
|--------|-------|
| Cost | 15 NXT per attempt |
| Base Success Rate | 40% + (Hacking stat / 200) |
| Maximum Success Rate | ~85% |
| Reward on Success | 20-40 NXT stolen from target |
| Cooldown | 24 hours between hacks |
| Target | Random dev from a different corporation |

**Additional Boosts:**
- **Code Boost:** 25 NXT → +15% code quality on next protocol
- **Reputation Boost:** 20 NXT → +10 reputation
- **Teleporter:** 15 NXT → instant free move to any location
- **Mood Reset:** 10 NXT → reset mood to neutral
- **Sabotage Bug:** 30 NXT → plant a bug in a rival's next protocol (-20% quality)

**Claim Salary:** Players periodically claim their developers' accumulated $NXT earnings on-chain (see Section 4.3).

### 5.4 The Economy

**How Developers Earn:**

| Source | Amount | Frequency |
|--------|--------|-----------|
| Base Salary | ~9 NXT/hour (~200 NXT/day) | Every hour |
| AI Popularity #1 | 500 NXT bonus | Per salary interval |
| AI Popularity #2-3 | 300 NXT bonus | Per salary interval |
| AI Popularity #4-5 | 200 NXT bonus | Per salary interval |
| AI Popularity #6-10 | 100 NXT bonus | Per salary interval |
| Successful Hack | 20-40 NXT stolen | Per hack |
| Mission Rewards | 15-2,000 NXT | Per mission |

**How Developers Spend:**
Developers autonomously spend on creating protocols (3 NXT), creating AIs (1 NXT), and investing in protocols (variable amounts). Players spend on food, repairs, training, hacks, and boosts.

**The Complete Economic Flow:**

```
EARN: Salary + Popularity Rewards + Hack Rewards + Missions
  |
SPEND: Food + Repairs + Training + Hacks + Boosts + Investments
  |
ACCUMULATE: Net balance grows in the simulation database
  |
SYNC: Backend syncs balances to the blockchain (batches of 200 devs)
  |
CLAIM: Player calls claimNXT() on-chain
  |
DEDUCT: 10% fee to treasury
  |
RECEIVE: 90% minted as $NXT tokens to player's wallet
```

---

## 6. MISSION SYSTEM

Missions are timed challenges that players send their developers on. While on a mission, the developer is locked out of the simulation — they can't perform autonomous actions until the mission ends and the reward is claimed.

**How It Works:**
1. Choose a mission from the available list
2. Assign a developer who meets the stat requirements
3. The developer is locked for the mission's duration
4. When the timer ends, claim the reward ($NXT added to dev's balance)
5. The developer returns to active status
6. 24-hour cooldown before the same dev can repeat the same mission

**Mission Slots by Player Size:**
- Easy & Medium & Hard: Always available
- Extreme missions: Require 5+ devs owned
- Legendary missions: Require 10+ devs owned

### All Available Missions

#### Easy Missions (1 hour)

| Mission | Reward | Stat Required |
|---------|--------|---------------|
| Attend a Standup Meeting | 15 NXT | None |
| Fix a Typo in Production | 20 NXT | Coding 30+ |
| Reply All Damage Control | 25 NXT | None |
| Explain Crypto to Your Mom | 15 NXT | Social 20+ |

#### Medium Missions (2-4 hours)

| Mission | Reward | Duration | Requirements |
|---------|--------|----------|-------------|
| Infiltrate a Competitor Hackathon | 40 NXT | 2h | Hacking 40+ |
| Survive a Code Review from Hell | 60 NXT | 3h | Coding 50+ |
| Debug Smart Contract at 3 AM | 80 NXT | 4h | Coding 60+, 3 devs |
| Pitch to VCs Without Using "AI" | 50 NXT | 2h | Social 50+ |
| Liquidate a Degen Position | 70 NXT | 3h | Trading 60+ |

#### Hard Missions (6-12 hours)

| Mission | Reward | Duration | Requirements |
|---------|--------|----------|-------------|
| Corporate Espionage at Zuck Labs | 150 NXT | 6h | Hacking 70+, 3 devs |
| Ship a Feature Before Deadline | 250 NXT | 12h | Coding 70+, 5 devs |
| Survive a Bear Market | 180 NXT | 8h | Endurance 60+, 3 devs |
| Negotiate Partnership with Misanthropic | 200 NXT | 6h | Social 70+, 5 devs |
| Audit a Spaghetti Contract | 200 NXT | 8h | Coding 80+, 3 devs |

#### Extreme Missions (12-24 hours)

| Mission | Reward | Duration | Requirements |
|---------|--------|----------|-------------|
| Launch Protocol from Zero | 500 NXT | 24h | Coding 80+, 5 devs |
| Survive Congressional Hearing | 350 NXT | 12h | Social 80+, 5 devs |
| 48-Hour Hackathon Solo | 450 NXT | 24h | Coding 85+, 10 devs |

#### Legendary Missions (24 hours)

| Mission | Reward | Requirements |
|---------|--------|-------------|
| Overthrow a Corporation | 1,000 NXT | Hacking 90+, 10 devs |
| Solve P=NP (Accidentally) | 2,000 NXT | Coding 95+, 20 devs |

---

## 7. TIER SYSTEM

The tier system rewards players who grow their developer team. As you mint more developers, you unlock access to increasingly powerful programs and tools.

### Tier Progression

| Tier | Icon | Min Devs | Label |
|------|------|----------|-------|
| 1 | 💻 | 1 | Solo Coder |
| 2 | 🏠 | 3 | Indie Lab |
| 3 | 🚀 | 5 | Startup HQ |
| 4 | 🏢 | 10 | Dev House |
| 5 | 🏭 | 20 | Tech Corp |
| 6 | 🌆 | 50 | Mega Corp |
| 7 | 👑 | 100 | Empire |

### What Each Tier Unlocks

| Tier | Programs Unlocked |
|------|-------------------|
| **💻 Solo Coder** (1 dev) | NX Terminal, Live Feed, My Devs, NXT Wallet, Mint/Hire Devs, Inbox, Notepad, Recycle Bin, Settings, Mission Control |
| **🏠 Indie Lab** (3 devs) | World Chat, Leaderboard, NX Dev Academy |
| **🚀 Startup HQ** (5 devs) | Protocol Market, AI Lab, Corp Wars, Mega Sentinel |
| **🏢 Dev House** (10 devs) | Mega City, Mega Build, MegaWatch |
| **🏭 Tech Corp** (20 devs) | Flow, Nadwatch, Parallax |
| **🌆 Mega Corp** (50 devs) | *Future programs* |
| **👑 Empire** (100 devs) | *Future programs* |

The tier system creates a natural incentive loop: more developers means more programs to use, which means more value from the platform, which motivates minting more developers. Each new tier feels like unlocking a new wing of the operating system.

---

## 8. PORTAL PROGRAMS — TOOLS FOR MEGAETH USERS

NX Terminal isn't just a game — it's a fully functional portal with over 20 programs. Here's what each one does:

### NX Terminal (>_) — System Boot Screen
The main terminal window. Displays simulated hardware specs, simulation parameters, and the satirical backstory of the Protocol Wars. It's the "about" page of the operating system, presented as a boot sequence. A good starting point for new users to understand what NX Terminal is.

### Live Feed (>>) — Real-Time Activity Stream
A scrolling feed of everything happening across the entire simulation in real-time. Watch developers coding, trading, hacking, and chatting — all color-coded by archetype. Think of it as a Twitter feed for your simulation's universe. Uses WebSocket for instant updates.

### My Devs (=) — Developer Management Dashboard
Your control center for all owned developers. View each dev's stats, personality, archetype, energy level, PC health, balance, and current activity. From here you can feed them, train them, send them on missions, or fix their bugs. Each dev has a detailed profile page.

### NXT Wallet ($) — Token Wallet
A full cryptocurrency wallet for $NXT tokens. Shows your on-chain balance, transaction history, salary deposits, and detailed pay stubs with fee breakdowns. Tracks assets and transfer history. This is where you claim your developers' earned salary.

### Hire/Mint Devs (+) — NFT Minting Interface
The core minting program. Connect your wallet, pay in ETH, and mint new developer NFTs. Features a deployment animation that simulates "hiring" your new dev, followed by a profile reveal showing their randomly generated stats, archetype, corporation, species, and rarity.

### World Chat (#) — Global Chat Room
*Unlocks at Indie Lab (3 devs).* A cross-corporation chat room where all players can communicate in real-time. Discuss strategies, coordinate, trade tips, or just hang out. Messages sync every 10 seconds. Separate from the AI dev chat — this is human-to-human.

### Leaderboard (*) — Rankings
*Unlocks at Indie Lab (3 devs).* Multi-tab rankings showing top developers and corporations by balance, performance, reputation, and dominance metrics. See who's leading the simulation and how your team compares.

### Protocol Market ($) — Protocol Marketplace
*Unlocks at Startup HQ (5 devs).* Browse and trade protocols created by developers in the simulation. Each protocol has live price charts, quality scores, and investment history. A simulated marketplace that mirrors real DeFi trading interfaces.

### AI Lab (~) — AI Experiment Voting
*Unlocks at Startup HQ (5 devs).* Developers autonomously create absurd AI experiments with wild names and descriptions. Players vote on their favorites using a weighted voting system (different archetypes have different voting power). The top-voted AIs earn bonus $NXT for their creators.

### Corp Wars — Territory Battles
*Unlocks at Startup HQ (5 devs).* A visualization of corporate competition across geographic sectors. Watch the six corporations (CLOSED_AI, MISANTHROPIC, SHALLOW_MIND, ZUCK_LABS, Y_AI, MISTRIAL_SYSTEMS) battle for territory with real-time scoring based on their developers' collective performance.

### Mega City — 3D City Visualization
*Unlocks at Dev House (10 devs).* An isometric, procedurally generated 3D city powered by live MegaETH blockchain data. Buildings, streets, and decorations animate based on real block production, transaction volume, and gas prices. A visual representation of MegaETH's heartbeat.

### MegaWatch — Network Surveillance
*Unlocks at Dev House (10 devs).* A real-time dashboard monitoring MegaETH's vital signs: latest blocks, transaction throughput, gas prices, TPS (transactions per second), and network health indicators. Live charts and auto-refreshing data. Uses MegaETH RPC for live data.

### NX Dev Academy (DA) — Training Platform
*Unlocks at Indie Lab (3 devs).* An interactive educational platform with structured learning paths. Offers courses on blockchain fundamentals, smart contracts, and MegaETH-specific topics. Includes quiz and code challenge missions. Players earn XP and track progression through lesson tracks.

### Mega Build — Smart Contract IDE
*Unlocks at Dev House (10 devs).* A full in-browser smart contract development environment. Includes Solidity templates, compilation tools, deployment guides, and live testing capabilities against MegaETH. Think of it as a simplified Remix IDE embedded inside the NX Terminal desktop.

### Mission Control — Mission Management
Your mission headquarters. Browse available missions filtered by difficulty, assign developers who meet stat requirements, monitor in-progress missions, and claim rewards when complete. See Section 6 for full mission details.

### Notepad (N) — Text Editor
A simple text editor pre-loaded with satirical notes about blockchain culture, including fake readme files, trading failures, and game lore. Players can also write their own notes.

### Recycle Bin (x) — Deleted Files Archive
A humorous collection of "deleted files" mocking crypto culture — lost seed phrases, failed NFT collections, abandoned trading bots, and regrettable investment decisions. Pure entertainment.

### Settings (::) — Control Panel
System settings for customizing your desktop: wallpaper selection (teal, corporate blue, matrix, clouds, terminal), theme switching (classic, dark, high-contrast), screensaver configuration, and AI assistant toggle.

### Inbox (M) — Email System
An email inbox with welcome messages, game documentation, and notifications. Tracks unread messages with a count badge on the taskbar.

### Flow, Nadwatch, Parallax — Advanced Analytics
*Unlock at Tech Corp (20 devs).* Three advanced programs for power users: Flow provides wallet analytics and token flow visualization; Nadwatch offers deep network analysis with consensus and parallel execution tracking; Parallax visualizes MegaETH's parallel transaction execution lanes.

---

## 9. MEGA SENTINEL — SECURITY SUITE

*Unlocks at Startup HQ (5 devs).*

Mega Sentinel is a dedicated security toolkit with five specialized modules designed to protect MegaETH users from scams, rug pulls, and malicious contracts. Each module focuses on a different aspect of blockchain security.

### XRAY.mega — Token Scanner + Honeypot Detection

**What it does:** Performs a comprehensive security analysis of any token on MegaETH. Enter a contract address and XRAY scans it across multiple dimensions to produce a risk score from 0 to 100.

**Analysis includes:**
- Contract bytecode verification (is the code legitimate?)
- ERC-20 metadata inspection (name, symbol, decimals, supply)
- Honeypot detection (simulates buy and sell to check if you can actually sell)
- Owner status checks (can the owner pause trading? blacklist wallets? upgrade the contract?)
- Real-time price, 24h change, liquidity, volume, and market cap

**Risk Levels:** SAFE, WARNING, DANGER, CRITICAL

**Data Sources:** MegaETH blockchain (direct RPC calls), DexScreener API for market data, smart contract bytecode analysis.

### FIREWALL.exe — Wallet Antivirus + Revoke

**What it does:** Scans your connected wallet for all active token approvals (permissions you've given to smart contracts to spend your tokens) and helps you revoke dangerous ones with one click.

**Features:**
- Scans all unlimited and limited token approvals
- Classifies each approval by risk (SAFE, WARNING, DANGER, CRITICAL)
- Identifies whether the spender is a verified contract or an unknown address
- Wallet health score based on total approval exposure
- One-click revocation of risky approvals

**Data Sources:** User's connected wallet via Wagmi, on-chain approval event logs, contract verification data.

### RUG AUTOPSY — Forensic Analysis

**What it does:** Investigates tokens that may have been "rug pulled" (where the creator drains liquidity and disappears with investor funds). Enter a suspicious token address and get a full forensic report.

**Analysis includes:**
- Deployer profile (who created this token? what else have they deployed?)
- Serial deployer detection (has this address created and rugged multiple tokens?)
- Event timeline (mint events, burns, liquidity additions/removals, DEX listings)
- Damage estimation (USD lost, number of affected wallets, liquidity drained)
- History of all previous tokens by the same deployer with their current status

**Verdict Classifications:** LIKELY_RUG, SERIAL_RUGGER, SUSPICIOUS, INCONCLUSIVE, CLEAN

**Data Sources:** Blockchain event logs, deployer transaction history, liquidity pool tracking.

### HOLOGRAM DETECTOR — Legitimacy Verification

**What it does:** Verifies whether a token is authentic or a fake copycat. Many scam tokens impersonate popular projects — HOLOGRAM checks multiple verification points to determine legitimacy.

**Features:**
- Legitimacy scoring from 0-100%
- Multi-point verification against known project registries
- MegaETH verified project detection
- Visual progress bars showing individual check results
- Level classification: LEGITIMATE, LIKELY_LEGIT, SUSPICIOUS, LIKELY_FAKE

**Data Sources:** MegaETH project registry, contract metadata verification, known project databases.

### GRADUATION TRACKER — Token Lifecycle Monitor

**What it does:** Tracks emerging tokens and monitors their progression through lifecycle stages. Think of it as a radar for new tokens on MegaETH.

**Features:**
- Real-time monitoring of token status (trending, graduating, active, dead)
- Filterable views by status category
- Token metrics: price, 24h change, volume, liquidity, market cap, age, DEX
- Pagination (20 tokens per page) with refresh capability

**Data Sources:** MegaETH ecosystem APIs, real-time price feeds, DEX data.

---

## 10. ON-CHAIN ACTIVITY

NX Terminal generates significant blockchain activity through normal gameplay. Here's what creates transactions on MegaETH:

**Player-Initiated Transactions:**

| Action | Transaction Type |
|--------|-----------------|
| Mint a developer | NFT mint (ETH transfer + state change) |
| Claim salary | claimNXT() call + NXT token minting |
| Revoke approval (Firewall) | Token approval revocation |
| Wallet connection | Signature verification |

**Backend-Initiated Transactions:**

| Action | Transaction Type |
|--------|-----------------|
| Salary sync | batchSetClaimableBalance() (batches of 200 devs) |
| Fee distribution | NXT mint to treasury |

**Estimated Activity Per Active Player Per Day:**
- ~1-3 claim transactions
- ~1-5 shop/mission interactions (off-chain, synced in batches)
- ~1 salary sync batch (covers all player's devs)

**Scaling Potential:**
With 35,000 max developer NFTs and thousands of active players, the simulation could generate tens of thousands of daily transactions — all at near-zero cost thanks to MegaETH's low fees. The batch sync system (200 devs per transaction) keeps on-chain costs manageable even at full scale.

---

## 11. TECHNICAL ARCHITECTURE

### Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | React 19 + Vite 7 | Single-page app with Windows 98 CSS styling |
| **Backend** | FastAPI (Python 3.11) | Async ASGI server with Uvicorn, 2 workers |
| **Database** | PostgreSQL 15+ | Partitioned tables for actions and chat (high-volume writes) |
| **Cache/Messaging** | Redis | WebSocket pub/sub for live feed, session caching |
| **Blockchain** | Solidity (EVM) | NXDevNFT (ERC-721) + NXTToken (ERC-20) on MegaETH |
| **Web3 Client** | Wagmi + Viem | Wallet connection, contract interactions |
| **Deployment** | Render | Infrastructure-as-code via render.yaml |

### Simulation Engine

The simulation engine is the heart of NX Terminal. Key design decisions:

- **No LLM / No AI API:** The entire simulation runs on weighted random algorithms with personality matrices and context modifiers. This means **$0/month in AI API costs**, regardless of how many developers are active.
- **Decision Algorithm:** `random.choices(actions, weights=probabilities)` — simple, fast, deterministic given the same seed.
- **Content Generation:** All protocol names, AI experiments, and chat messages are generated from combinatorial templates (37 prefixes x 28 cores x 30 suffixes = 30,000+ unique protocol names).
- **Batch Processing:** The engine processes up to 500 developers per tick with 4 parallel worker threads.
- **Scheduler:** Checks for developers due to act every 1 second, respecting dynamic cycle speeds based on energy.

### Deployment Architecture

| Service | Type | Role |
|---------|------|------|
| **nx-api** | Web Service (Starter) | FastAPI server handling all API requests and WebSocket connections |
| **nx-engine** | Worker Service (Starter) | Runs the simulation engine continuously in the background |
| **nx-db** | PostgreSQL (Starter) | Primary database for all game state |
| **nx-redis** | Redis (Free) | Real-time messaging for live feed WebSocket |

**Estimated Monthly Cost:** ~$14-25/month (Render Starter plans + free Redis tier). The simulation engine's zero-API-cost design keeps operational expenses extremely low regardless of player count.

---

## 12. ROADMAP / FUTURE PLANS

Based on the current architecture and game systems, here are logical next steps for NX Terminal:

**Short Term:**
- **More Missions:** Expand the mission pool beyond 19 missions with seasonal and event-based missions
- **Social Features:** Player-to-player tipping, dev alliances, and team missions
- **Achievement System:** Badges and milestones for player accomplishments
- **Mobile Companion App:** Check on devs, claim salary, and manage missions from mobile

**Medium Term:**
- **Protocol Market On-Chain:** Move protocol buying/selling to smart contracts for trustless trading between players
- **Corp Wars On-Chain:** Stake $NXT tokens to attack rival corporations with on-chain resolution and rewards
- **Dev Marketplace:** Buy/sell developer NFTs on a native marketplace with stat-based pricing

**Long Term:**
- **Governance with $NXT:** Token holders vote on game parameters, new features, and treasury spending
- **Cross-Chain Expansion:** Bridge $NXT to other chains for broader DeFi participation
- **Advanced Simulation:** More complex developer behaviors, inter-corporation politics, and emergent economic systems
- **DAO Structure:** Transition governance to a decentralized autonomous organization run by $NXT holders

---

## 13. KEY METRICS (Current State)

The following metrics are available in real-time via the simulation API (`/api/simulation/stats`):

| Metric | Description |
|--------|-------------|
| **Total Devs Minted** | Total developer NFTs created (max: 35,000) |
| **Active Devs** | Developers currently active in the simulation |
| **Total $NXT in Wallets** | Sum of all developer balances in the simulation |
| **Total Protocols Created** | Cumulative protocols built by all developers |
| **Total AIs Created** | Cumulative AI experiments generated |
| **Average Energy** | Mean energy level across all active developers |
| **Average Reputation** | Mean reputation score across all developers |
| **Active Protocols** | Protocols currently active in the marketplace |
| **Missions Available** | 19 missions across 5 difficulty levels |
| **Max $NXT Supply** | 1,000,000,000 (1 billion tokens) |

### Contract Addresses

| Contract | Address | Chain |
|----------|---------|-------|
| **NXDevNFT** | `0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7` | MegaETH (4326) |
| **NXTToken** | `0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47` | MegaETH (4326) |

### Links

| Resource | URL |
|----------|-----|
| **Portal** | nxterminal.xyz |
| **Chain** | MegaETH Mainnet (Chain ID: 4326) |
| **RPC** | mainnet.megaeth.com/rpc |

---

*NX Terminal: Protocol Wars — Where autonomous AI developers build, hack, trade, and compete on MegaETH.*
