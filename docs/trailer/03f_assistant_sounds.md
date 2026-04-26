# 03f · NX Assistant + Sonidos

## A · NX Assistant — **existe**

Fuente: `frontend/src/components/NXAssistant.jsx` (337 líneas). El componente **retorna `null`**: monta un agente **Clippy.js** (jQuery + JSONP) sobre el viewport. Estilos en `App.css` clases `.clippy`, `.clippy-balloon`, `.nx-assistant-*` (ya catalogadas en 01_palette).

- **CDN**: `https://cdn.jsdelivr.net/gh/smore-inc/clippy.js@master/agents/`. Agents: `Clippy · Merlin · Rover · Links · Peedy · Genius · F1` (default `Clippy`). Persistido en `localStorage['nx-assistant-agent']`. Toggle en `localStorage['nx-assistant-enabled']`.
- **Posición**: `agent.moveTo(window.innerWidth - 200, window.innerHeight - 180)` — esquina inferior-derecha.
- **Balloon** (`.clippy-balloon`, App.css): bg amarillo `#FFC`, border 1px negro, border-radius 5px, max-width 220px, Tahoma 11px. Tail PNG inline base64.
- **Animaciones del agente**: `Greeting` al cargar, `Congratulate` al mintear, `Alert` al recibir notif, `animate()` random en mensajes periódicos.
- **Triggers de speech**:
  1. Carga: si no wallet → `WELCOME_MSG`; si wallet → mensaje random de `MESSAGES`.
  2. Cada **60–120s**: `MESSAGES[i++ % MESSAGES.length]` (cíclico, no random).
  3. Evento `nx-dev-hired` → mensaje aleatorio de `MINT_MESSAGES` (10 templates con `d.name/d.species/d.archetype/d.corporation`).
  4. Poll cada **30s** de notifs no vistas → speak `<title>\n\n<body[0..150]>`.

### Copy literal — `WELCOME_MSG` (línea 21)
```
Welcome to NX Terminal! I see you haven't connected your wallet yet. Open Mint/Hire Devs and click "Connect Wallet to Mint" to get started!
```

### Cherry-picks de `MESSAGES` (de ~80 líneas hardcoded)
```
It looks like you're trying to win the Protocol Wars. Would you like help?
Your developer has been staring at their screen for 3 hours. This is normal.
TIP: You can increase productivity by hiring more developers. Or by threatening the existing ones.
It looks like you're writing a protocol. Would you like me to add more bugs?
According to my calculations, you have a 0.3% chance of winning. That's up from yesterday!
The AI Lab is running at peak capacity. It is also on fire. This is fine.
The blockchain is immutable. Your poor decisions, however, are not.
Have you tried turning your developers off and on again?
MegaETH processes blocks faster than your dev writes bugs. Impressive.
The real yield was the bugs we fixed along the way.
The only rug pull here is when your dev's PC Health hits 0.
Your dev just pushed to production on a Friday. HR has been notified.
```
(Resto: secciones MegaETH ~11 líneas · crypto culture ~20 · gameplay ~12 — todas en `NXAssistant.jsx:23-102`.)

### Cherry-picks de `MINT_MESSAGES` (templates dinámicos, líneas 229-240)
```
You just hired a {species} {archetype}. Bold choice. Very bold.
{name} has entered the simulation. May the bugs be ever in their favor.
{name} is now property of {corporation}. Please do not form emotional attachments. Too late? Too late.
{name} has been deployed. Current survival odds: non-zero. That's the best we can offer.
```

## B · Sonidos — **Web Audio API sintetizado** (cero archivos)

`find frontend/ public/ -name "*.mp3|wav|ogg"` → **vacío**. Toda la SFX se genera en `frontend/src/utils/sound.js` (70 líneas) con `OscillatorNode type='square'` + `GainNode` con decay exponencial. Gating: `localStorage['nx-sound'] !== 'off'`.

| Helper | Tonos (Hz) | Dur (s) | Gain | Uso |
|---|---|---|---|---|
| `playSpendSound` | `[800, 600, 400]` desc. | 0.20 | 0.12 | Spend $NXT/Energy (DevCard actions) |
| `playGainSound`  | `[400, 600, 800, 1000]` asc. | 0.25 | 0.12 | Recibir $NXT/rewards |
| `playActionSound`| `[500, 700]` chirp | 0.15 | 0.10 | Acción genérica neutral |
| `playToggleClick`| `900` (single) | 0.08 | 0.08 | Toggle del mute (no respeta el mute) |

Todas usan `setValueAtTime(f, ctx.currentTime + i * 0.05)` y `g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur)`. El AudioContext se cierra ~500ms después.

## C · Decisión para el trailer

- **NX Assistant**: usar el **copy literal** de `WELCOME_MSG` + 4-6 `MESSAGES` cherry-pickeados como bocadillos del trailer. El sprite de Clippy.js es heavy (jQuery + JSONP) y poco controlable para captura — recomiendo **recrear el balloon CSS-only** (yellow `#FFC` + border negro + tail SVG, idéntico a `.clippy-balloon` en App.css) sobre un sprite estático/PNG del agente elegido. Así controlamos timing exacto sin depender del CDN.
- **Sonidos**: como ya son Web Audio puros, **podemos reproducirlos 1:1 en el trailer** copiando `sound.js` (70 líneas, zero deps). Sweet spot: usar `playGainSound` cuando aparece "+200 $NXT", `playSpendSound` en KO/spend, `playActionSound` en clicks, `playToggleClick` en transiciones de pantalla. Si el trailer va a tener música/voiceover de fondo, dejarlos como SFX puntuales o mutearlos.
