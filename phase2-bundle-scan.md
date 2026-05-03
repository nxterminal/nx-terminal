# Phase 2.1 — Full bundle scan results

**Branch:** `claude/refactor-metadata-api-J1jMg`  
**Source:** `https://raw.githubusercontent.com/nxterminal/nx-metadata-bundle/main/{N}.json` for `N ∈ [1, 35000]`  
**Scan duration:** 202.4s @ concurrency 25  
**Fetched:** 35000 / 35000 successful, **0 failures**.

---

## 0. TL;DR

Bundle drifts from **7** repo-defined value set(s): Species, Archetype, Corporation, Rarity, Social Style, Coding Style, Work Ethic.

**1** unrecognized trait keys found in bundle: Biggest Win.

---

## 1. Per-axis distinct values + counts

Sorted by frequency. ★ = present in bundle but NOT in repo's expected set; ✗ = in repo's expected set but NOT in bundle.

### Species

**Distinct values:** 4  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Bunny` | 30425 | 86.93% | ★ new |
| `Zombie` | 1757 | 5.02% | ★ new |
| `Robot` | 1410 | 4.03% |  |
| `Ghost` | 1408 | 4.02% |  |
| `Alien` | 0 | 0.00% | ✗ in repo but not bundle |
| `Bear` | 0 | 0.00% | ✗ in repo but not bundle |
| `Cat` | 0 | 0.00% | ✗ in repo but not bundle |
| `Dragon` | 0 | 0.00% | ✗ in repo but not bundle |
| `Fox` | 0 | 0.00% | ✗ in repo but not bundle |
| `Human` | 0 | 0.00% | ✗ in repo but not bundle |
| `Monkey` | 0 | 0.00% | ✗ in repo but not bundle |
| `Owl` | 0 | 0.00% | ✗ in repo but not bundle |
| `Raven` | 0 | 0.00% | ✗ in repo but not bundle |
| `Shark` | 0 | 0.00% | ✗ in repo but not bundle |
| `Snake` | 0 | 0.00% | ✗ in repo but not bundle |
| `Wolf` | 0 | 0.00% | ✗ in repo but not bundle |

### Archetype

**Distinct values:** 8  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Grinder` | 5314 | 15.18% | ★ new |
| `Degen` | 5213 | 14.89% | ★ new |
| `Script Kiddie` | 4247 | 12.13% | ★ new |
| `Lurker` | 4208 | 12.02% | ★ new |
| `Fed` | 4200 | 12.00% | ★ new |
| `Hacktivist` | 4189 | 11.97% | ★ new |
| `Influencer` | 4103 | 11.72% | ★ new |
| `10X Dev` | 3526 | 10.07% | ★ new |
| `10X_DEV` | 0 | 0.00% | ✗ in repo but not bundle |
| `DEGEN` | 0 | 0.00% | ✗ in repo but not bundle |
| `FED` | 0 | 0.00% | ✗ in repo but not bundle |
| `GRINDER` | 0 | 0.00% | ✗ in repo but not bundle |
| `HACKTIVIST` | 0 | 0.00% | ✗ in repo but not bundle |
| `INFLUENCER` | 0 | 0.00% | ✗ in repo but not bundle |
| `LURKER` | 0 | 0.00% | ✗ in repo but not bundle |
| `SCRIPT_KIDDIE` | 0 | 0.00% | ✗ in repo but not bundle |

### Corporation

**Distinct values:** 6  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Misanthropic` | 5866 | 16.76% | ★ new |
| `Y.AI` | 5856 | 16.73% | ★ new |
| `Closed AI` | 5835 | 16.67% | ★ new |
| `Mistrial Systems` | 5825 | 16.64% | ★ new |
| `Zuck Labs` | 5818 | 16.62% | ★ new |
| `Shallow Mind` | 5800 | 16.57% | ★ new |
| `CLOSED_AI` | 0 | 0.00% | ✗ in repo but not bundle |
| `MISANTHROPIC` | 0 | 0.00% | ✗ in repo but not bundle |
| `MISTRIAL_SYSTEMS` | 0 | 0.00% | ✗ in repo but not bundle |
| `SHALLOW_MIND` | 0 | 0.00% | ✗ in repo but not bundle |
| `Y_AI` | 0 | 0.00% | ✗ in repo but not bundle |
| `ZUCK_LABS` | 0 | 0.00% | ✗ in repo but not bundle |

### Rarity

**Distinct values:** 5  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Common` | 15606 | 44.59% | ★ new |
| `Uncommon` | 9869 | 28.20% | ★ new |
| `Rare` | 5278 | 15.08% | ★ new |
| `Legendary` | 3179 | 9.08% | ★ new |
| `Mythic` | 1068 | 3.05% | ★ new |
| `common` | 0 | 0.00% | ✗ in repo but not bundle |
| `legendary` | 0 | 0.00% | ✗ in repo but not bundle |
| `mythic` | 0 | 0.00% | ✗ in repo but not bundle |
| `rare` | 0 | 0.00% | ✗ in repo but not bundle |
| `uncommon` | 0 | 0.00% | ✗ in repo but not bundle |

### Alignment

**Distinct values:** 9  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Neutral Evil` | 3989 | 11.40% |  |
| `Lawful Neutral` | 3919 | 11.20% |  |
| `Lawful Evil` | 3910 | 11.17% |  |
| `Chaotic Evil` | 3890 | 11.11% |  |
| `True Neutral` | 3882 | 11.09% |  |
| `Lawful Good` | 3881 | 11.09% |  |
| `Chaotic Neutral` | 3869 | 11.05% |  |
| `Neutral Good` | 3861 | 11.03% |  |
| `Chaotic Good` | 3799 | 10.85% |  |

### Risk Level

**Distinct values:** 4  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Reckless` | 8859 | 25.31% |  |
| `Aggressive` | 8830 | 25.23% |  |
| `Conservative` | 8685 | 24.81% |  |
| `Moderate` | 8626 | 24.65% |  |

### Social Style

**Distinct values:** 5  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Silent` | 7140 | 20.40% | ★ new |
| `Quiet` | 7068 | 20.19% |  |
| `Loud` | 7018 | 20.05% |  |
| `Influencer` | 6946 | 19.85% | ★ new |
| `Social` | 6828 | 19.51% |  |
| `Mentor` | 0 | 0.00% | ✗ in repo but not bundle |
| `Troll` | 0 | 0.00% | ✗ in repo but not bundle |

### Coding Style

**Distinct values:** 6  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Over-Engineer` | 5954 | 17.01% | ★ new |
| `Minimalist` | 5865 | 16.76% | ★ new |
| `Perfectionist` | 5852 | 16.72% |  |
| `Methodical` | 5844 | 16.70% |  |
| `Chaotic` | 5749 | 16.43% |  |
| `Speedrun` | 5736 | 16.39% | ★ new |
| `Copy Paste` | 0 | 0.00% | ✗ in repo but not bundle |
| `Speed Runner` | 0 | 0.00% | ✗ in repo but not bundle |

### Work Ethic

**Distinct values:** 4  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Lazy` | 8842 | 25.26% |  |
| `Dedicated` | 8775 | 25.07% | ★ new |
| `Casual` | 8763 | 25.04% | ★ new |
| `Obsessed` | 8620 | 24.63% |  |
| `Balanced` | 0 | 0.00% | ✗ in repo but not bundle |
| `Grinder` | 0 | 0.00% | ✗ in repo but not bundle |
| `Steady` | 0 | 0.00% | ✗ in repo but not bundle |

### Skill Module

**Distinct values:** 6  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `AUDIT` | 5866 | 16.76% |  |
| `ARBITRAGE` | 5856 | 16.73% |  |
| `DEPLOY` | 5835 | 16.67% |  |
| `INFILTRATE` | 5825 | 16.64% |  |
| `BROADCAST` | 5818 | 16.62% |  |
| `BRIDGE` | 5800 | 16.57% |  |

### Clothing

**Distinct values:** 12  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `None` | 20939 | 59.83% |  |
| `Jacket` | 1379 | 3.94% |  |
| `Sweater` | 1321 | 3.77% |  |
| `Vest` | 1319 | 3.77% |  |
| `Sweater V2` | 1316 | 3.76% |  |
| `Bandana` | 1276 | 3.65% |  |
| `Coat` | 1275 | 3.64% |  |
| `Costume` | 1267 | 3.62% |  |
| `Shirt` | 1241 | 3.55% |  |
| `Hoodie` | 1233 | 3.52% |  |
| `Scarf` | 1221 | 3.49% |  |
| `T-Shirt` | 1213 | 3.47% |  |

### Clothing Pattern

**Distinct values:** 12  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `None` | 20939 | 59.83% |  |
| `Solid` | 2165 | 6.19% |  |
| `Two Tone` | 1902 | 5.43% |  |
| `H Stripes` | 1681 | 4.80% |  |
| `Color Block` | 1297 | 3.71% |  |
| `V Stripes` | 1203 | 3.44% |  |
| `Chevron` | 1076 | 3.07% |  |
| `Gradient V` | 1054 | 3.01% |  |
| `Checker` | 1016 | 2.90% |  |
| `Diagonal Fade` | 939 | 2.68% |  |
| `Gradient H` | 911 | 2.60% |  |
| `Polka Dots` | 817 | 2.33% |  |

### Eyewear

**Distinct values:** 6  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `None` | 24616 | 70.33% |  |
| `Glasses` | 2097 | 5.99% |  |
| `Visor` | 2087 | 5.96% |  |
| `Shades` | 2077 | 5.93% |  |
| `Eye Patch` | 2077 | 5.93% |  |
| `Half-Rim` | 2046 | 5.85% |  |

### Neckwear

**Distinct values:** 3  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `None` | 30903 | 88.29% |  |
| `Bow Tie` | 2058 | 5.88% |  |
| `Tie` | 2039 | 5.83% |  |

### Spots

**Distinct values:** 4  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `None` | 13089 | 37.40% |  |
| `Light` | 8524 | 24.35% |  |
| `Medium` | 7768 | 22.19% |  |
| `Heavy` | 5619 | 16.05% |  |

### Blush

**Distinct values:** 2  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `No` | 21058 | 60.17% |  |
| `Yes` | 13942 | 39.83% |  |

### Ear Detail

**Distinct values:** 2  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `No` | 17526 | 50.07% |  |
| `Yes` | 17474 | 49.93% |  |

### Status

**Distinct values:** 1  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Active` | 35000 | 100.00% |  |

### Mood

**Distinct values:** 5  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Angry` | 7130 | 20.37% |  |
| `Neutral` | 7101 | 20.29% |  |
| `Depressed` | 7042 | 20.12% |  |
| `Excited` | 6867 | 19.62% |  |
| `Focused` | 6860 | 19.60% |  |

### Location

**Distinct values:** 10  
**Total tokens:** 35000

| Value | Count | % | Status |
|---|---:|---:|---|
| `Governance Hall` | 3596 | 10.27% |  |
| `VC Tower` | 3584 | 10.24% |  |
| `Server Farm` | 3549 | 10.14% |  |
| `Open Source Garden` | 3515 | 10.04% |  |
| `Dark Web` | 3508 | 10.02% |  |
| `Hackathon Hall` | 3501 | 10.00% |  |
| `Hype Haus` | 3486 | 9.96% |  |
| `The Pit` | 3450 | 9.86% |  |
| `Board Room` | 3414 | 9.75% |  |
| `The Graveyard` | 3397 | 9.71% |  |

## 2. Numeric trait min/max

| Trait | Min | Max |
|---|---:|---:|
| Balance ($NXT) | 0 | 0 |
| Bugs Shipped | 0 | 0 |
| Coding | 5 | 95 |
| Coffee Count | 0 | 5 |
| Day | 0 | 0 |
| Devs Burned | 0 | 0 |
| Endurance | 5 | 95 |
| Energy | 100 | 100 |
| Hacking | 5 | 95 |
| Hours Since Sleep | 0 | 48 |
| Lines of Code | 0 | 500 |
| Luck | 5 | 95 |
| Protocols Created | 0 | 0 |
| Protocols Failed | 0 | 0 |
| Reputation | 0 | 0 |
| Social | 5 | 95 |
| Trading | 5 | 95 |

## 3. Skill Module ↔ Corporation

| Corporation | Skill Modules | 1:1? |
|---|---|---|
| `Closed AI` | `DEPLOY`×5835 | ✅ |
| `Misanthropic` | `AUDIT`×5866 | ✅ |
| `Mistrial Systems` | `INFILTRATE`×5825 | ✅ |
| `Shallow Mind` | `BRIDGE`×5800 | ✅ |
| `Y.AI` | `ARBITRAGE`×5856 | ✅ |
| `Zuck Labs` | `BROADCAST`×5818 | ✅ |

**Verdict:** ✅ Skill Module is a deterministic function of Corporation across the full bundle.

## 4. Drift summary (bundle vs. repo expectations)

### Species

- **2 new in bundle:** `Bunny`, `Zombie`
- **12 in repo but not bundle:** `Alien`, `Bear`, `Cat`, `Dragon`, `Fox`, `Human`, `Monkey`, `Owl`, `Raven`, `Shark`, `Snake`, `Wolf`

### Archetype

- **8 new in bundle:** `10X Dev`, `Degen`, `Fed`, `Grinder`, `Hacktivist`, `Influencer`, `Lurker`, `Script Kiddie`
- **8 in repo but not bundle:** `10X_DEV`, `DEGEN`, `FED`, `GRINDER`, `HACKTIVIST`, `INFLUENCER`, `LURKER`, `SCRIPT_KIDDIE`

### Corporation

- **6 new in bundle:** `Closed AI`, `Misanthropic`, `Mistrial Systems`, `Shallow Mind`, `Y.AI`, `Zuck Labs`
- **6 in repo but not bundle:** `CLOSED_AI`, `MISANTHROPIC`, `MISTRIAL_SYSTEMS`, `SHALLOW_MIND`, `Y_AI`, `ZUCK_LABS`

### Rarity

- **5 new in bundle:** `Common`, `Legendary`, `Mythic`, `Rare`, `Uncommon`
- **5 in repo but not bundle:** `common`, `legendary`, `mythic`, `rare`, `uncommon`

### Social Style

- **2 new in bundle:** `Influencer`, `Silent`
- **2 in repo but not bundle:** `Mentor`, `Troll`

### Coding Style

- **3 new in bundle:** `Minimalist`, `Over-Engineer`, `Speedrun`
- **2 in repo but not bundle:** `Copy Paste`, `Speed Runner`

### Work Ethic

- **2 new in bundle:** `Casual`, `Dedicated`
- **3 in repo but not bundle:** `Balanced`, `Grinder`, `Steady`

## 5. Unrecognized trait keys

| Trait | Tokens |
|---|---:|
| `Biggest Win` | 35000 |

## 7. Token attribute completeness

- Tokens missing expected keys: **0**
- Min attributes per token: 38
- Max attributes per token: 38

---

## 8. Output artifacts

- `phase2-bundle-scan.md` — this report
- `phase2-bundle-value-sets.json` — machine-readable, consumed by Phase 2.2 ingest

## 9. Next step

🛑 **HALT.** Do not proceed to migration or ingest until human reviews this report and `phase2-probe-results.md`.
