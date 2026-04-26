# 03e · NX Arena (digital battle scene)

Fuente única: `nx_arena_v13_fixed.html` (3174 líneas, prototipo standalone). Fonts: `Press Start 2P · VT323 · JetBrains Mono`. Frame: `min(96vw, 1100px)`, aspect-ratio 16/10, border 3px negro + outline neón violet.

## Paleta CSS (`:root`, líneas 9-23)

| Var | Hex | Uso |
|---|---|---|
| `--neon-pink` | `#ff4dff` | Player frame, glow, brand, default button |
| `--neon-cyan` | `#00e5ff` | Enemy frame, glow, brand prefix `◢` |
| `--neon-violet` | `#9d4dff` | HUD chips border, outer game shadow |
| `--neon-green` | `#00ff9f` | (≡ `--hp-green`) HP full + heal popup |
| `--glow-pink` / `--glow-cyan` | rgba 0.6 | Box-shadow halos |
| `--dark` | `#050010` | Body + game bg |
| `--panel` | `#140828` | (definida, no usada en CSS leído) |
| `--text` | `#f0e8ff` | Texto base |
| `--dim` | `#8075a0` | Labels stats |
| `--hp-green` | `#00ff9f` | HP > umbral medio |
| `--hp-yellow` | `#ffcc00` | HP medium + botón FORCE PUSH |
| `--hp-red` | `#ff3864` | HP low (blink), DEFEAT, danger |

## Layout / scene structure

- **Top HUD** (`.hud-top`): brand `◢ NX ARENA` (Press Start 2P, pink, glow) + sound toggle 🔊 + 3 chips violetas: `TURN <n>` (cyan), `WAGER 50 $NXT` (pink), `BAL 1,240` (green).
- **Enemy holo** (`.holo-enemy`): top-right (top:14% right:9% width:22%), tilt `rotateY(-6deg)`, float 3s, **borde cyan**.
- **Player holo** (`.holo-player`): bottom-left (bottom:24% left:7% width:26%), tilt `rotateY(6deg)`, float 3s offset, **borde pink**.
- **Bottom HUD** (`.bottom-hud`): grid 1.2fr / 1fr — `.dialog-box` izq con header `> COMBAT TERMINAL` cyan + `.dialog-text` "What will ROBOT_001 do?▼" + cursor blink; **actions-grid 2×2** derecha con los 4 botones de ataque.
- **Background**: `<canvas id="bg-canvas">` con Three.js (digital rain). Scanlines globales sobre `.game::before` (4px stripes).
- Capas extra absolutas: `.red-overlay` + `.red-vignette` (cuando recibís hit), `.flash` blanca (fire), `.carrot-rain` (victory), `.result-overlay` (VICTORY/DEFEAT), `.squad-modal` (selección dev).

## Anatomía de UNA holo card

- **`.holo-frame`**: bg gradient violeta semitransparente, border 2px neón (pink/cyan), `box-shadow: 0 0 25px <glow> + inset 0 0 20px`. **Corner brackets** vía `::before` (top-left) y `::after` (bottom-right): 16×16, 2px borde neón, mismo color.
- **`.holo-banner`** (top): bg gradient violeta→pink (player) o azul→cyan (enemy), Press Start 2P 7-10px blanco, contiene `<corp>` (ej. `INFILTRATE // MISTRIAL`) + `<id>` (ej. `#00196`).
- **`.holo-sprite`** (centro): `<img>` scale 1.8 (origin center 55%), `image-rendering: pixelated`, `drop-shadow` neón. Animación `idleGlitchPlayer 4s` / `idleGlitchEnemy 4.7s` con saltos a `steps(1)` (RGB-split en 18%, hue-rotate en 55%, brightness boost en 82%). Scanlines internas `scanDrift 6s` + holo-beam piramidal abajo (`beamFlicker 3s`).
- **`.holo-footer`** (bottom): bg degradado oscuro + blur, border-top neón. Contiene `holo-name-row` (name Press Start 2P + `Lv.42` VT323 neón) y `hp-row`: tag `HP` + `.hp-bar-outer` (8px alto, bg negro, border neón) con `.hp-bar-fill` y `.hp-number` `186/210` VT323 verde.
- **HP bar colors**: default fill verde (`#00ff9f → #00cc7f`); `.medium` amarillo (`#ffcc00 → #ff9900`); `.low` rojo (`#ff3864 → #ff0044`) + `hpBlink 0.6s infinite`. Hatching diagonal sobre el fill.

## 4 ataques canónicos del PLAYER (líneas 1842-1855)

| Botón | onclick | Daño | Tipo | Estilo |
|---|---|---|---|---|
| **MERGE CONFLICT** | `attack('MERGE_CONFLICT', 32, 'crit')` | 32 | `crit` (popup amarillo `#ffe858`) | border default pink |
| **FORCE PUSH** | `attack('FORCE_PUSH', 48, 'super')` | 48 | `super` | border yellow `--hp-yellow`, sub `⚡ 48 DMG · SUPER` |
| **REFACTOR** | `heal()` | +30 HP | `heal` (popup verde `#78f878`) | border green, sub `✚ +30 HP` |
| **SWAP DEV** | `swap()` → `openSquad()` | — | swap | border cyan, sub `⇄ Change aNFT` |

Cada botón: Press Start 2P, barra lateral 3px de su color con glow, hover translateY(-1px), disabled opacity 0.4. `attackAnim('player')` → `atkPlayer 0.6s` (translate +90,-50 scale 1.12). Daño dispara `damage-popup` (`dmgPop 1s`: pop a -20px scale 1.3 → -50 → -80).

### Ataques del ENEMY (random, líneas 3118-3123)
```js
{ name: 'COLD_BOOT',     dmg: 22 },
{ name: 'BACKDOOR',      dmg: 28 },
{ name: 'SUPPLY_CHAIN',  dmg: 34 },
{ name: 'DATA_LEAK',     dmg: 20 }
```
Daño efectivo = `dmg + Math.floor(Math.random() * 6)`. Dialog: `ZOMBIE_196 used <NAME>.`

## Glyph rain — `rainGlyphs` literal (líneas 2067-2078, Three.js sprites, 60 drops, 3 colores)

```js
'🥕','🥕','🥕',                              // carrots (NX brand)
'git','push','fn()','if','{}','[]','==','!=',
'01','10','0x','NX','</>','//','&&','||',
'→','↯','⟩','⟨','▓','░','█','▒',
'dev','src','log','api','sys','err','ok',
'DEPLOY','INFILTRATE','AUDIT','BRIDGE',
'$','#','@','*','+','-','=','?'
```
`glyphColors = ['#ff4dff', '#00e5ff', '#9d4dff']` (pink/cyan/violet). Drops "data-corruption" cambian de glyph mid-fall (~5% prob/frame).

### Glyphs de **termination** (al KO, partículas DOM, líneas 2681-2682)
```js
'01','10','0x','0F','NX','{}','[]','ERR','FAIL','✕','░','▓','█','KO','END','//','!!'
particleColors = ['#ff3864','#00e5ff','#ff4dff','#ffffff','#ffcc00']
```
24 partículas estallan en círculo (radio 80-220px, rotation random ±720°, `particleBurst 1.2s`).

## Animaciones clave

- **Idle**: `floatPlayer/Enemy 3s`, `idleGlitchPlayer/Enemy 4-4.7s steps(1)`, `scanDrift 6s`, `beamFlicker 3s`.
- **Attack**: `atkPlayer/atkEnemy 0.6s` (lunge + scale), `flash.fire 0.3s` blanco overlay, `cursorBlink 0.6s`.
- **Hit recibido**: `hitGlitch 0.4s steps(3)` (hue-rotate + invert), `frameShake 0.4s` (±5px), `shake-soft 0.35s` (game viewport), `shake-hard 0.5s` con rotación leve. Si te pegan: `redPulse 0.6s` (radial overlay) + `vignettePulse 0.6s` (border inset rojo 120px).
- **Damage popup**: `dmgPop 1s` flotante con sombra negra + glow del color (`-32` blanco, `-32` CRIT amarillo, `+30` HEAL verde).
- **Termination (KO, ~2s)**: `terminatingFrame 2s` (hue-rotate, saturate, jitter, blur final) + `terminatingSprite 2s` (RGB split agresivo, invert, blur, scale↓ + translateY 60%) + `term-flash 0.8s` (radial blanco→cyan→pink) + `term-shockwave 1s` (anillo rojo 40→600px) + `barsShow 0.6s` (vertical bars sweep) + 24 `term-particle` glyphs.
- **Materialize (deploy nuevo dev, 1.2s)**: `frameBoot 0.8s` + `spriteMaterialize 1.2s` (blur+contrast+hue-rotate→clean) + `code-line` cyan-blanco-pink scan + `materialize-grid` pixel grid fade + `materialize-ring` 20→300px elipse expandiendo.
- **VICTORY/DEFEAT**: `overlayFadeIn 0.4s`, title `titleSlam 0.8s` (scale 3→1, rotate -8→0), glitch shadows `glitchShift1/2 2s` (pink + cyan offsets), `statsSlideUp 0.6s @0.4s`, `btnAppear 0.5s @0.9s`, fondo `result-burst` radial. **VICTORY**: title verde + `carrot-rain` (carrots cayendo 5s, cleanup automático). **DEFEAT**: title rojo, no carrot rain.

## Personajes default (squad líneas 2918-2945, state líneas 2486-2489)

```
state.player = { hp: 280, max: 280 }   // overridden por squad[active]
state.enemy  = { hp: 186, max: 210 }   // hardcoded en HTML banner como "#00196"
```

| Slot | id | name | corp | level | hp/max | active |
|---|---|---|---|---|---|---|
| 1 | `00001` | **ROBOT_001**  | AUDIT // MISANTHROPIC   | 44 | 280/280 | ✓ |
| 2 | `00187` | BUNNY_187      | BROADCAST // ZUCK LABS  | 35 | 220/220 |   |
| 3 | `00198` | BUNNY_198      | DEPLOY // CLOSED AI     | 40 | 210/210 |   |
| 4 | `00005` | BUNNY_005      | BRIDGE // SHALLOW MIND  | 38 | 240/240 |   |
| 5 | `00013` | **ZOMBIE_196** | INFILTRATE // MISTRIAL  | 42 | 260/260 |   |

> **Inconsistencia conocida**: el banner del enemy en el HTML hardcodea `#00196` y `186/210` pero el squad declara id `00013` y 260/260. Para el trailer usar **ZOMBIE_196 · INFILTRATE // MISTRIAL · Lv.42 · #00196 · 186/210** que es lo que efectivamente se ve.

## Estados / phases

`combat (turnos alternos) → en cada hit comprobar hp ≤ 0`:
- Si **enemy KO** → `playTerminationEffect('enemy')` (~2.2s) → `showVictory()` (overlay verde + carrot rain).
- Si **player KO** → `playTerminationEffect('player')` (~2.2s) → si quedan devs vivos en squad → `openSquad()` (modal "SELECT YOUR DEV / Tap a dev to deploy"); si no → `showDefeat()` (overlay rojo).
- Squad modal también se abre vía botón `SWAP DEV`.

## Three.js usage

- **CDN**: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` (línea 1903).
- **Uso único**: el digital rain del fondo (`#bg-canvas` z-0). 60 sprites (`THREE.CanvasTexture` 128×128 con shadow blur 20 + composite `source-atop` para teñir el glyph). Colores en `MeshBasicMaterial`/sprite, glyph swap aleatorio mid-fall.
- **Réplica CSS-only para el trailer**: SÍ es viable y recomendable. Todo el resto (holos, ataques, partículas, KO, victory) ya es DOM+CSS. La lluvia se reemplaza con N `<span>` posicionados absolutos animando `transform: translateY(0 → 100vh)` con duraciones random + `opacity` + `text-shadow` neón. Cero dependencia, cero overhead WebGL, recording más limpio.
