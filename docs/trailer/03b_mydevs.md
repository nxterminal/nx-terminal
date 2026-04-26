# 03b · My Devs (Developer Roster)

Fuente: `frontend/src/windows/MyDevs.jsx` (2563 líneas, sin CSS-module). Estilos inline + `.win-tabs`, `.win-raised`, `.win-btn`. Avatares = GIF IPFS, **no procedural**.

## Header + Tabs

- Header (terminal-bg, VT323, `--text-base`): `> MY DEVELOPERS (N)  [↻ Refresh]` (verde) ··· wallet truncada (derecha). Si no conectado: amber + pantalla "Connect wallet to see your devs" + botón. Si N=0: pantalla `[+] No devs yet — Open Mint/Hire Devs to get started!`.
- Tabs (`.win-tabs`): `Devs` | `Activity (N)` (badge clamp 99).
- Loading inicial: `LoadingLore` — boot retro VT323, líneas: "NX TERMINAL — Developer Retrieval System v4.2", "Establishing secure connection to MegaETH...", "Chain ID: 4326 .......................... OK", "Scanning contract for owned tokens...", "Decrypting personnel files...", "Compiling developer profiles...", "Loading dev workstations..."; barra ASCII `[████░░░░░] 99%` asintótica (rojo `#8B0000` sobre marrón `#7a5c00`).
- Refresh in-flight con devs ya cargados: badge flotante top-right "Refreshing..." (amber).

## DevCard — render de UN dev

Contenedor: `.win-raised`, `padding 8px`, `cursor pointer`, click → `openDevProfile(token_id)`. 5 filas verticales:

### Row 1 · Avatar + Identidad
- **Avatar (`GifImage`)**: caja 80×80, `background var(--terminal-bg)`, `border 1px solid var(--border-dark)`, `overflow hidden`. `<img>` desde `https://gateway.pinata.cloud/ipfs/<dev.ipfs_hash>`, `image-rendering: pixelated`, `transform: scale(2.2)`, `transformOrigin: center 32%` (crop PFP cabeza/cuello). Loading: `...` pulsante. Error/sin-hash: `@` grande en `arcColor` + `#tokenId`.
- **Línea 1** (VT323): `<dev.name>` (`--text-lg`) ··· `[ARCHETYPE]` en `ARCHETYPE_COLORS[archetype]` (10X_DEV=red, LURKER=common, DEGEN=gold, GRINDER=blue, INFLUENCER=pink, HACKTIVIST=green, FED=amber, SCRIPT_KIDDIE=cyan, todos los `*-on-grey`) ··· badge rarity (solo si ≠ common): borde + texto gold `--gold-on-grey`.
- **Línea 2** (VT323, secondary): `<corp.replace(_,' ')>  | <species>  | <location.replace(_,' ')>  | #<token_id>`.
- **Línea 3 — status** (VT323): `<balance_nxt> $NXT` (gold) ··· `<mood>` (muted) ··· `<STATUS>` uppercase bold, color: `active`=green-on-grey, `on_mission`=`#2d8a2d`, `resting`=amber-on-grey, otro=red-on-grey.
- **Botón** `[🖼️ VIEW]` (.win-btn) → abre `DevImageModal` (toggle PFP/FULL BODY + descarga GIF/PNG 1000×1000).
- Si `dev._fetchFailed`: banner amber arriba "[!] Profile loading from chain... [Retry]" (terminal-bg + border terminal-amber).

### Row 2 · Vital Stats — grid 2 columnas (6 barras)
Cada barra = `VitalBar`: ícono SVG 18×18 redondo (border y color por umbral) + label + número (VT323), debajo barra `height 10px`, fondo `#333`, fill coloreado, `border-radius 2px`, transición 0.5s. **Barras críticas** (<15 normal o >75 inverse) reciben `animation: critical-pulse 1.5s infinite`.

| Slot | Label | Campo backend | Max | Modo | Ícono SVG |
|---|---|---|---|---|---|
| 1 | **Energy** | `dev.energy` | `dev.max_energy ?? 10` | normal | rayo |
| 2 | **Bugs** | `dev.bugs_shipped ?? 0` | 20 | **inverse** (alto=malo) | escarabajo |
| 3 | **PC Health** | `dev.pc_health ?? 100` | 100 | normal | monitor |
| 4 | **Social** | `dev.social_vitality ?? dev.stat_social ?? 50` | 100 | normal | dos figuras |
| 5 | **Knowledge** | `dev.knowledge ?? 50` | 100 | normal | libro |
| 6 | **Caffeine** | `dev.caffeine ?? 50` | 100 | normal | taza |

`barColor()` (umbrales fill):
- Normal: ≥70 verde `#44ff44` · ≥40 amber `#ffaa00` · ≥15 rojo `#ff4444` · <15 rojo oscuro `#cc0000`.
- Inverse: ≤20 verde · ≤50 amber · ≤75 rojo · >75 rojo oscuro.

### Row 3 · Training (condicional)
Si `dev.training_course`: línea VT323 amber `#b8860b` `[TRAIN] <SHOP_ITEMS_MAP[course]>` + StoneBtn `[🎓 GRAD]` (si terminó) o `(Nh left)`.

### Row 4 · Acción — grid 6 cols (oculto si onMission o _fetchFailed)
Botones `StoneBtn` (pixel-art 3D, fondo `#6b7b8a`, border-shadow `inset ±3px`, VT323 uppercase, disabled = gris `#4a4a4a` opacity 0.5):
1. `[☕ COFFEE]` → 3 $NXT → +25 Caffeine
2. `[🥕 FEED ▼]` (FeedDropdown: CARROT/PIZZA/BURGER)
3. `[HACK ▼]` (HackDropdown: MAINFRAME / PLAYER)
4. `[🔧 FIX:<bugsVal>]` → 5 Energy → −8 Bugs, +3 Knowledge (disabled si bugs=0)
5. `[🖥️ REPAIR]` → 8 $NXT → PC 100% (disabled si pc_health=100)
6. `[ECON ▼]` (EconDropdown: FUND / TRANSFER / REQUEST — Request solo si otro dev tiene fondos)

Action feedback: una línea VT323 `--text-xs` debajo, color del resultado (verde `#005500` ok / rojo `#aa0000` err / amber `#b8860b` cooldown). `SpendOverlay` flota números animados (`+N $NXT`, `-N energy`) con sonidos `playSpendSound/playGainSound/playActionSound`.

### Row 5 · Footer (counters + chat)
Línea VT323 muted: `caf:<N>` · `LoC:<N>` · `nosleep:<N>h` · `[<last_action_type>]` (cyan). Debajo `QuickPrompt` (input para hablarle al dev por id).

## Estados especiales del DevCard

- **Normal/active**: full color, todos los botones habilitados.
- **On Mission** (`dev.status === 'on_mission'` y mission no terminó): wrapper interno con `filter: grayscale(100%); opacity: 0.7`. **Overlay** absolute negro `rgba(0,0,0,0.65)` z-index 2: texto `⏳ ON MISSION` verde `#2d8a2d` con `mission-pulse 2s`, `<mission.title>`, `Returns in Xh Ym`.
- **Mission Complete**: overlay sin grayscale en colores; `MISSION COMPLETE!` verde `#44ff44` + botón grande `CLAIM: +<reward> $NXT` (verde sobre `#e8ffe8`, border `#005500`).
- **Fetch Failed** (`_fetchFailed`): banner amber + botón Retry; Row 4 oculta hasta refetch ok.
- **Critical vital** (<15 normal / >75 inverse): la barra correspondiente parpadea (`critical-pulse`).
- **Hack result/error**: dispara modales globales `HackResultModal` / `HackErrorModal` (config en `HACK_ERROR_CONFIG`, default ❌ `> HACK ERROR` rojo `#ff4444`).
- **Estado "dead"**: no hay rama explícita; `status` que no sea active/on_mission/resting cae al color rojo (`red-on-grey`) en la línea status. No se ve un estado terminal/dead distinto en MyDevs (puede vivir en `RecycleBin`).

## Panel de detalle al click

`DevCard.onClick` → `openDevProfile(dev.token_id)` que abre la ventana `DevProfile` (componente separado, **NO leído acá** — material para 03c o siguiente). Dentro de MyDevs no hay un panel inline expandido: el detalle vive en otra ventana.
