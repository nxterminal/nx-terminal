# 02 · Programas del Desktop

Fuente: `frontend/src/components/Desktop.jsx` (array `DESKTOP_ICONS`, líneas 51-78). Componente JSX resuelto vía `frontend/src/components/WindowManager.jsx`. Total: 26 programas (23 visibles + 3 ocultos).

| ID | Label | Ícono | Componente | Visible |
|---|---|---|---|---|
| `nx-terminal` | NX Terminal | `>_` | NXTerminal | sí |
| `live-feed` | Live Feed | `>>` | LiveFeed | sí |
| `world-chat` | World Chat | `#` | WorldChat | sí |
| `leaderboard` | Leaderboard | `*` | Leaderboard | sí |
| `protocol-market` | Protocol Market | `$` | ProtocolMarket | sí |
| `ai-lab` | AI Lab | `~` | AILab | sí |
| `my-devs` | My Devs | `=` | MyDevs | sí |
| `nxt-wallet` | NXT Wallet | `$` | NxtWallet | sí |
| `inbox` | Inbox | `M` | Inbox | sí |
| `hire-devs` | Mint/Hire Devs | `+` | HireDevs | sí |
| `notepad` | Notepad | `N` | Notepad | sí |
| `recycle-bin` | Recycle Bin | `x` | RecycleBin | sí |
| `corp-wars` | Corp Wars | ⚔ | CorpWars | sí |
| `control-panel` | Settings | `::` | ControlPanel | sí |
| `monad-city` | Mega City | (vacío) | MonadCity | sí |
| `dev-academy` | NX Dev Academy | `DA` | DevAcademy | sí |
| `monad-build` | Mega Build | ⚡ | MonadBuild | sí |
| `netwatch` | MegaWatch | (vacío) | NetWatch | sí |
| `mega-sentinel` | Mega Sentinel | 🛡 | MegaSentinel | sí |
| `mission-control` | Mission Control | 📋 | MissionControl | sí |
| `nxmarket` | NX Market | 📊 | NXMarket | sí |
| `achievements` | Achievements | ★ | Achievements | sí |
| `dev-camp` | Dev Camp | 🎓 | DevCamp | sí |
| `flow` | Flow | ◆ | Flow | oculto |
| `nadwatch` | Nadwatch | 👁 | NadWatch | oculto |
| `parallax` | Parallax | ≣ | Parallax | oculto |

Notas:
- Filtro de render: `DESKTOP_ICONS.filter(item => !item.hidden)` (Desktop.jsx:340) — los 3 ocultos siguen siendo abribles vía `openWindow(id)` desde otros componentes.
- WindowManager también registra `bug-sweeper` (BugSweeper) y `protocol-solitaire` (ProtocolSolitaire), pero NO aparecen como íconos del escritorio (se lanzan desde Start Menu / otros flujos).
- Los íconos `monad-city` y `netwatch` tienen string vacío en el array; el render visual lo provee `DesktopIcon` (probablemente con SVG/asset propio — ver 03+).
