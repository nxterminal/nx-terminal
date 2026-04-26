# 00 · INDEX — NX Terminal Trailer (Fase 1: Discovery)

Branch: `claude/plan-game-trailer-gUT2V`. Total: 9 archivos, 687 líneas (sin contar este).

## Inventario

| Archivo | Líneas | Aporte clave |
|---|---|---|
| `00_INDEX.md` | (este) | Índice + escenas + assumptions + dioses del trailer |
| `01_palette.md` | 53 | Variables CSS (classic + dark) y fuentes (VT323, Tahoma, Press Start 2P) — paleta canónica |
| `02_programs.md` | 37 | 26 programas del Desktop (23 visibles + 3 ocultos), id ↔ ícono ↔ JSX component |
| `03a_inbox.md` | 67 | NX Mail: toolbar, tabla 5 cols, vista email — origen de mensajes (backend, no hardcoded) |
| `03a_bis_welcome_email.md` | 75 | Body LITERAL del welcome email (`backend/api/routes/players.py:17-79`) |
| `03b_mydevs.md` | 69 | DevCard: avatar 80×80 IPFS scale 2.2, 6 vital bars, 6 botones stone, estados on-mission/critical |
| `03c_ai_lab.md` | 101 | Generador procedural: 50 `AI_THINGS` × 19 `AI_ACTIONS` + 12 templates de descripción |
| `03d_protocol_market.md` | 105 | NXMarket: 4 tabs, grid auto-fit 360px, MarketCard YES/NO LMSR, OFFICIAL/USER badges |
| `03e_nx_arena.md` | 117 | Arena standalone: holo cards neón, 4 ataques canon, glyph rain, termination 2s, VICTORY/DEFEAT |
| `03f_assistant_sounds.md` | 63 | Clippy.js + ~80 MESSAGES literales + 4 helpers Web Audio (square wave, sin archivos) |

## Escenas planificadas (9 escenas, ~75-90s totales)

| # | Escena | ~Dur | Caos |
|---|---|---|---|
| 1 | **Boot BIOS** — `NX TERMINAL — Developer Retrieval System v4.2`, líneas verde/marrón, barra ASCII 99% | 4-6s | 2 |
| 2 | **Desktop Win98 reveal** — wallpaper teal, íconos en cascada, taskbar, sticky note "MY RANK" | 4-5s | 3 |
| 3 | **Inbox / Welcome Email** — abrir email, scroll del body literal, punchline "AI wishes you well. For now." | 6-8s | 4 |
| 4 | **Mint/Hire** — "+ Connect Wallet to Mint" → mint ráfaga, partículas, MINT_MESSAGE balloon | 6-8s | 5 |
| 5 | **My Devs roster** — grid de DevCards, vital bars en tiempo real, hover stone buttons, una crítica parpadeando | 8-10s | 6 |
| 6 | **AI Lab** — header magenta `>> ABSURD AI LABORATORY <<`, scroll de tabla con nombres absurdos cherry-picked | 6-8s | 7 |
| 7 | **NX Market** — grid de cards, YES/NO swing animado, OFFICIAL badge azul, BuyModal click | 6-8s | 6 |
| 8 | **NX Arena combat** — holo cards neón, FORCE PUSH 48 super, hit shake, termination → VICTORY | 12-16s | 9 |
| 9 | **Closing slate** — slogan canónico + precio + CTA, glyph rain de fondo, último Clippy balloon | 6-8s | 4 |

## ASSUMPTIONS (concesiones para producción del trailer)

- **Avatares**: pixelart procedural en `<canvas>` (no cargamos GIFs IPFS reales — evita CORS, tiempo de carga, dependencia de Pinata).
- **Three.js → reemplazo**: glyph rain CSS-only (`<span>` posicionados absolutos animando `translateY` + `opacity`, glyphs literales del array `rainGlyphs` confirmado en 03e). Cero deps, recording limpio.
- **Clippy.js → reemplazo**: balloon CSS-only replicando `.clippy-balloon` (bg `#FFC`, border 1px negro, tail SVG inline) + sprite PNG estático del agente Clippy. Control de timing 1:1.
- **NX Assistant frecuencia**: aparece en casi cada escena (vs `60-120s` en gameplay real) — **concesión cinematográfica** asumida y documentada.
- **Sonidos**: `frontend/src/utils/sound.js` se copia 1:1 (4 helpers Web Audio, 70 líneas). Disparos puntuales: `playGainSound` en mint/reward, `playSpendSound` en KO/spend, `playToggleClick` en transiciones de pantalla.
- **Precio mint**: **0.0025 ETH** (confirmado en welcome email, `backend/api/routes/players.py:30`).
- **Slogan canónico**: **"Mint a Dev. Keep them alive. Stack $NXT."** (welcome email línea 74 — reemplaza cualquier copy inventado en iteraciones previas).
- **Tema visual**: tema `classic` (Win98 teal) en todas las escenas excepto Arena (tema neón propio del prototipo). No mezclar con `dark`.

## Dioses del trailer (7 punchlines extraídas del juego, listas para smash-cut)

| # | Línea | Origen |
|---|---|---|
| 1 | `Spoiler: it's you` | AI Lab template #11 (`backend/engine/templates.py`) |
| 2 | `Nobody asked for this` | AI Lab template #5 |
| 3 | `Probably wrong` | AI Lab template #4 |
| 4 | `May the bugs be ever in their favor` | NXAssistant `MINT_MESSAGES[2]` |
| 5 | `The AI wishes you well. For now.` | Welcome email firma final |
| 6 | `HR will probably ignore it` | Inbox compose response (`Inbox.jsx:659`) |
| 7 | `It looks like you're trying to win the Protocol Wars` | NXAssistant `MESSAGES[0]` |

> Bonus de reserva si necesitamos más: `The AI Lab is running at peak capacity. It is also on fire. This is fine.` · `Your developer just pushed to main without testing. Bold strategy.` · `Current survival odds: non-zero. That's the best we can offer.`

---

**Estado**: Discovery cerrado. Toda la copy y data de gameplay relevante para el trailer está catalogada con cita a su archivo fuente. Listo para arrancar Fase 2 (Storyboard).
