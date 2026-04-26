# 01 · Palette & Tipografía

Fuente: `frontend/src/index.css`, `frontend/src/App.css`. Tema base: `classic`.

## Variables CSS — Tema Classic

| Variable | Hex | Uso |
|---|---|---|
| `--bg-desktop` | `#008080` | Fondo del escritorio Win98 (teal icónico). |
| `--win-bg` | `#c0c0c0` | Fondo de ventanas, botones, panels, scrollbar, start menu. |
| `--win-title-l` | `#000080` | Gradiente izq. del titlebar; sidebar del Start Menu. |
| `--win-title-r` | `#1084d0` | Gradiente der. del titlebar; welcome progress bar. |
| `--border-light` | `#ffffff` | Highlight superior/izq. de bevels 3D (raised). |
| `--border-dark` | `#808080` | Sombra de bevels sunken; bordes de tabla; texto disabled. |
| `--border-darker` | `#404040` | Outer-shadow del bevel 3D (capa más oscura). |
| `--selection` | `#000080` | Ícono seleccionado, hover de tabla, hover de start-menu. |
| `--selection-text` | `#ffffff` | Texto sobre `--selection`. |
| `--terminal-bg` | `#0c0c0c` | Fondo de `.terminal`, charts, corp-feed. |
| `--terminal-green` | `#33ff33` | Texto de terminal, energy-high, charts, matrix wallpaper. |
| `--terminal-amber` | `#ffaa00` | Energy-mid; world-event highlights. |
| `--terminal-red` | `#ff4444` | Energy-low, error-msg, desktop/tray badges. |
| `--terminal-cyan` | `#00ffff` | Reservado (consumido inline en componentes). |
| `--terminal-magenta` | `#ff44ff` | Reservado (paleta CRT, sin uso directo en CSS). |
| `--gold` | `#ffd700` | Reservado (consumido inline en HUD/loot). |
| `--gold-on-grey` | `#7a5c00` | Badge DEGEN; rarity *legendary*. |
| `--green-on-grey` | `#005500` | Badge HACKTIVIST; rarity *uncommon*. |
| `--cyan-on-grey` | `#005060` | Badge SCRIPT_KIDDIE. |
| `--pink-on-grey` | `#660066` | Badge INFLUENCER; rarity *mythic*. |
| `--amber-on-grey` | `#7a5500` | Badge FED. |
| `--red-on-grey` | `#aa0000` | Badge 10X_DEV. |
| `--common-on-grey` | `#333333` | Badge LURKER; rarity *common*. |
| `--blue-on-grey` | `#0d47a1` | Badge GRINDER; rarity *rare*. |
| `--text-primary` | `#000000` | Texto base de UI (body, start-menu items). |
| `--text-secondary` | `#444444` | Stat labels; botón close del assistant. |
| `--text-muted` | `#555555` | Texto secundario tenue (e.g. `nx-assistant-fire`). |

Tema `dark` redefine la misma paleta con base `#1a1a2e` / `#2d2d3f` y púrpuras `#4a148c → #7c43bd` en titlebar.

Escala de texto (`--text-xs/sm/base/lg/xl` + `--icon-size`) controlada por `data-text-scale` en `<html>`; default = `xlarge` (15px base, icon 22px).

## Fuentes cargadas

| Familia | Origen | Uso real en CSS |
|---|---|---|
| **VT323** | Google Fonts | Terminal, BIOS boot, shutdown msg, charts, corp-wars, feed-highlights. |
| **Tahoma** / MS Sans Serif | Sistema | Body, botones, tabs, badges, start-menu, NX assistant (UI chrome). |
| **Courier New** | Sistema | Fallback monospace; BIOS logo ASCII; matrix wallpaper. |
| Press Start 2P | Google Fonts | Importada, sin uso en CSS (reservada para títulos retro). |
| IBM Plex Mono | Google Fonts | Importada, sin uso en CSS. |
| Space Grotesk | Google Fonts | Importada, sin uso en CSS. |
| Plus Jakarta Sans | Google Fonts | Importada, sin uso en CSS. |
| JetBrains Mono | Google Fonts | Importada, sin uso en CSS. |
| Patrick Hand | Google Fonts | Importada, sin uso en CSS. |
