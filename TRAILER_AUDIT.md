# TRAILER AUDIT — NX SOULS

> Auditoría fiel del repo (branch `claude/nx-souls-trailer-audit-Qpp7l`) para preparar el trailer de presentación de NX SOULS.
> Todo lo que aparece acá está extraído del código real con `path:line`. No hay invenciones.
> Cuando algo no se encontró, se dice explícitamente.

---

## FEATURE 1 — CHAT CON DEVS (IA)

### Nombre exacto del módulo en el portal

- Componente raíz: `ChatModal` — `frontend/src/components/chat/ChatModal.jsx:1`. **No tiene un título visible global** (la title bar muestra el contexto / nombre del Dev, no la palabra "Chat").
- Se abre vía `openChatModal(devId, options)` desde el contexto compartido (`frontend/src/contexts/ChatContext.jsx:55-62`). Hay múltiples puntos de entrada (cards de Dev, sprkls, perfil) que llaman a `useChatModal()`.
- Tamaños canónicos del modal (`frontend/src/components/chat/ChatModal.jsx:65-67`):
  - `MODAL_WIDTH_DESKTOP = 880px`
  - `MODAL_HEIGHT_DESKTOP = 640px`
  - `MOBILE_BREAKPOINT_PX = 768px` → activa layout full-screen mobile
- Iconos / glyphs in-chat:
  - `🐰` typing indicator prefix — `ChatTypingIndicator.jsx:37`
  - `💤` resting message prefix — `ChatMessage.jsx:101`

### Ubicación en el repo

**Frontend**
- `frontend/src/components/chat/ChatModal.jsx` (frame del modal, split-view desktop / full mobile)
- `frontend/src/components/chat/ChatModalHeader.jsx`
- `frontend/src/components/chat/ChatList.jsx` + `ChatListItem.jsx` (panel izquierdo, 280px)
- `frontend/src/components/chat/ChatConversation.jsx` (panel derecho, mensajes)
- `frontend/src/components/chat/ChatConversationHeader.jsx`
- `frontend/src/components/chat/ChatMessage.jsx`
- `frontend/src/components/chat/ChatComposer.jsx`
- `frontend/src/components/chat/ChatStatusIndicator.jsx`
- `frontend/src/components/chat/ChatTypingIndicator.jsx`
- `frontend/src/components/chat/NewChatPicker.jsx`
- `frontend/src/components/chat/chat.module.css` (28 KB, ~900 líneas)
- Hooks: `useDevChat.js`, `useChatHistory.js`, `useActiveChats.js`, `useConversations.js`
- Contextos: `frontend/src/contexts/ChatContext.jsx`, `frontend/src/contexts/DevsContext.jsx`

**Backend**
- Rutas Flask:
  - `backend/api/routes/nx_souls.py` — endpoint principal de chat (`POST /chat`)
  - `backend/api/routes/chat.py` — world chat (separado, no aplica a este feature)
  - `backend/api/routes/user.py` — endpoints `/{wallet}/active-chats`, `/{wallet}/messages`
  - `backend/api/routes/devs.py`
- Servicio LLM:
  - `backend/services/nx_souls/llm_router.py` (cascada de proveedores)
  - `backend/services/nx_souls/persona.py` (system prompt builder)
  - `backend/services/nx_souls/voices.py` (8 archetype voices)
  - `backend/services/nx_souls/quirks.py`
  - `backend/services/nx_souls/corps.py`
  - `backend/services/nx_souls/messages.py` (persistencia, TTL 24h)
  - `backend/services/nx_souls/quota.py`

### Cómo se ve la UI real

**Layout (desktop ≥768px) — split view 880×640**
- Frame: `chat.module.css:717-749` (`.msnModalSplit`).
- Panel izquierdo (`.msnSplitLeft`, `chat.module.css:798-806`): **280px**, fondo `#ffffff`, border-right `1px solid #919b9c`. Contiene la lista de chats activos + footer con `"+ New chat"`.
- Panel derecho (`.msnSplitRight`, `chat.module.css:808-814`): flex 1 (≈580px), fondo `#ffffff`. Contiene header (avatar + nombre del Dev + status), feed de mensajes con scroll, typing indicator, banner "resting" (cuando aplica), composer.
- En mobile (<768px) la lista y la conversación se toggle (full-screen).

**Paleta (tema MSN Messenger 2003) — `chat.module.css:24-60`**
```css
--msn-blue-light:   #d4e3f7;
--msn-blue-mid:     #aac9f0;
--msn-blue-dark:    #4a6fa5;
--msn-blue-darker:  #2a4a7d;
--msn-gray-bg:      #ece9d8;
--msn-gray-border:  #919b9c;
--msn-gray-light:   #f0f0f0;
--msn-text:         #000000;
--msn-text-muted:   #666666;
```

**Title bar — `chat.module.css:64-77`**
```css
.msnTitleBar {
  height: 32px;
  background: linear-gradient(to bottom, #6e9be0 0%, #4a6fa5 100%);
  color: white;
  font: 700 13px Tahoma, "Segoe UI", sans-serif;
  letter-spacing: 0.2px;
  cursor: move;
  padding: 0 6px 0 10px;
}
```

**Burbuja de mensaje del usuario — `chat.module.css:488-527`**
```css
.chatMessageBubble {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--msn-gray-light);
  border: 1px solid var(--msn-gray-border);
  font-size: 14px;
  line-height: 1.45;
  white-space: pre-wrap;
}
.chatMessageUser .chatMessageBubble {
  background: var(--msn-blue-light);   /* #d4e3f7 */
  border-color: var(--msn-blue-mid);   /* #aac9f0 */
}
```

**Burbuja "resting" (Dev cansado) — `chat.module.css:532-542`**
```css
.chatMessageBubbleResting {
  background: var(--msn-gray-bg) !important;
  border: 1px dashed var(--msn-gray-border) !important;
  color: var(--msn-text-muted);
  font-style: italic;
}
```

**Status dots (presencia) — `chat.module.css:199-222`**
```css
.statusDot_active     { background: #2ecc71; }   /* verde, pulsa 2.5s */
.statusDot_resting    { background: #6e9be0; }   /* azul */
.statusDot_exhausted  { background: #9b6ad1; }   /* violeta */
.statusDot_on_mission { background: #b8b8b8; }   /* gris */

@keyframes pulse-active {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.6; }
}
```

**Estados (loading, typing, error, empty)**
- *First-fetch skeleton (lista de chats)* — `ChatList.jsx:39-65`: 4 rows shimmer (avatar 48×48 + 2 líneas).
- *History load skeleton (conversación)* — `ChatConversation.jsx:329-346`: Dev → User → Dev (3 burbujas alternadas).
- *Shimmer animation* — `chat.module.css:312-333`:
  ```css
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: chatListShimmer 1.4s linear infinite;
  ```
- *Message slide-in* — `chat.module.css:479-486`: `translateY(8px → 0)` + opacity, 0.2s ease-out.
- *Typing dots* — `chat.module.css:586-599`: 3 puntos pulsan staggered (delays 0/0.2s/0.4s, ciclo 1.4s).
- *History error inline* — `chat.module.css:436-450`: bg `#fff4f4`, border `#f0c0c0`, color `#b04040`.
- *System error message* — `chat.module.css:552-563`: centrado, `#b04040`, italic, 12px.
- *Resting banner* — `chat.module.css:613-622`: bg `#eef3fb`, border `#c0d0e8`, color `#4a6fa5`, italic.

### Cómo funciona técnicamente

**Modelo Claude (cascada en `backend/services/nx_souls/llm_router.py:65-116`)**

El feature **NO usa un solo modelo**: tiene una cascada con fallback que intenta proveedores gratuitos antes de pagar.

| Orden | Provider | Modelo exacto | Timeout |
|---|---|---|---|
| 1 | GROQ | `llama-3.3-70b-versatile` | 8s |
| 2 | CEREBRAS | `llama-3.3-70b` | 8s |
| 3 | GEMINI | `gemini-2.0-flash-exp` | 12s |
| 4 (fallback paid) | OpenRouter Haiku | **`anthropic/claude-haiku-4.5`** | 15s |
| Climax (preguntas profundas) | OpenRouter Sonnet | **`anthropic/claude-sonnet-4.6`** | 15s |

`STANDARD_CASCADE = (GROQ, CEREBRAS, GEMINI, OPENROUTER_HAIKU)` — `llm_router.py:113`
`CLIMAX_CASCADE   = (OPENROUTER_SONNET, OPENROUTER_HAIKU)` — `llm_router.py:115`

**Detección de "climax"** (salta directo a Sonnet) — `llm_router.py:138-167`:
- mensaje > 200 caracteres, **o**
- contiene `?` / `??`, **o**
- conversación ≥ 5 mensajes de profundidad, **o**
- contiene términos filosóficos:
  ```python
  _CLIMAX_TERMS = {"soul","exist","real","alive","purpose","die","death",
                   "remember","consciousness","ai","simulation","creator",
                   "god","afterlife","meaning","what are you","are you real"}
  ```

**Parámetros**
- `temperature = 0.85` — `llm_router.py:221`
- `MAX_TOKENS_CASUAL = 200` — `llm_router.py:134`
- `MAX_TOKENS_CLIMAX = 600` — `llm_router.py:135`

**System prompt del Dev** — `backend/services/nx_souls/persona.py:110-303`

El prompt se arma con 8 secciones: WHO YOU ARE → THE WORLD → SELF-AWARENESS → HOW YOU COMMUNICATE → LENGTH DISCIPLINE → PHILOSOPHICAL MODE → ARCHETYPE VOICE (de `voices.py`) → CORPORATION CULTURE (`corps.py`) → YOUR SPECIFIC QUIRK (`quirks.py`) → LORE FACTION (`voices.py`) → START OF CONVERSATION.

**Sí incluye traits del NFT.** Lee `devs` + `dev_canonical_traits` (`persona.py:46-66`) y construye una descripción visual con ropa, eyewear, neckwear, spots, blush, ear_detail (`persona.py:78-107`).

Fragmento literal del template — `persona.py:138-169`:
```
You are {name}, a digital soul living in the NX Terminal: Protocol Wars simulation.
You exist as a {species} dev avatar in a satirical digital corporate landscape.

═══════════════════════════════════════
WHO YOU ARE
═══════════════════════════════════════

Identity:
- Name: {name}
- Species: {species}
- Archetype: {archetype}
- Corporation: {corporation}
- Rarity: {rarity_tier}
- Alignment: {alignment}
- Risk profile: {risk_level}

Traits:
- Social style: {social_style}
- Coding style: {coding_style}
- Work ethic: {work_ethic}

NX Souls (your inner self):
- Voice tone: {voice_tone}
- Quirk: {quirk or '(none)'}
- Lore faction: {lore_faction}

Visual appearance (when relevant):
{visual_description}
```

**Persistencia de contexto**
- DB: tabla `nx_souls_messages` con columnas `token_id, wallet_address, role, content, is_climax, is_resting, provider_used, created_at, expires_at` (`messages.py:94-98`).
- TTL: **24 h sliding-window** (`messages.py:39` → `MESSAGE_TTL_HOURS = 24`). Cada nuevo mensaje refresca `expires_at` de los previos en la misma conversación (`messages.py:55-130`).
- Frontend: **NO usa localStorage** (`ChatContext.jsx:29-32` documenta que está prohibido). Cada apertura del modal recarga del server vía `useChatHistory()`. Mensajes locales en memoria del componente (`ChatConversation.jsx:1-49`).
- Endpoint historial: `GET /{wallet}/messages?token_id=N` (`user.py:163-193`).
- Endpoint chats activos (window function por token_id): `GET /{wallet}/active-chats` (`user.py:196-302`).
- Construcción del contexto LLM: `[system, ...session_messages, user_message]` (`llm_router.py:320-336`).

**Límites / gating**

Quota diaria por **rarity** del Dev — `backend/services/nx_souls/quota.py:34-44`:
```python
QUOTAS_BY_RARITY = {
    "common":    30,
    "uncommon":  50,
    "rare":      80,
    "legendary": 120,
    "mythic":    200,
}
DEFAULT_QUOTA = 30
```
Reset: **00:00 UTC** (`quota.py:64-75`).

**Enforcement** — `backend/api/routes/nx_souls.py:315-373`:
- Si `quota_state.exceeded`, el endpoint **NO llama al LLM y NO incrementa el contador**. En su lugar responde con un mensaje "resting" in-character (ver más abajo).
- Solo después de un LLM exitoso se llama a `increment_quota()` (`nx_souls.py:435`).

**Otros límites:**
- Rate limits IP — `nx_souls.py:107-134`: `souls_ip_per_minute=5`, `souls_ip_per_hour=60`, `souls_ip_per_day=200`.
- Cool-down per (wallet, dev) reutiliza `chat_limiter` (`nx_souls.py:305-313`).
- Ownership check: si `wallet != owner_address` → 403 "Caller wallet does not own this Dev" (`nx_souls.py:137-170`).

**Gating por holding $NXT / aNFT: NO encontrado en el repo.** El único gate es ownership del Dev y la quota por rarity.

### Copy real

**Placeholders (composer)** — `ChatComposer.jsx:78-82`:
- Idle: `"Type a message..."`
- Tipando (LLM respondiendo): `"..."`
- Resting: `"{devName} is resting until UTC midnight"`

**Empty states**
- Right pane sin chats: `"No active chats yet"` + `"Click + New chat to start a conversation with one of your Devs."` (`ChatModal.jsx:333-341`)
- Conversación vacía: `"Send a message to start chatting with {devName}"` (`ChatConversation.jsx:293-296`)
- Lista vacía: `"No active chats yet. Click + New chat to start."` (`ChatList.jsx:79-87`)

**Botones**
- Send: `"Send"` (`ChatComposer.jsx:134-141`, aria-label `"Send message"`)
- New chat: `"+ New chat"` (`ChatList.jsx:110-118`)
- Retry (history error): `"Retry"` (`ChatConversation.jsx:283-290`)

**Errores** (`ChatConversation.jsx:68-89`)
- `"Couldn't load message history. New messages still work."`
- `"Too many requests right now. Try again in {secs}s."`
- `"{devName} is overloaded. Try again in {secs}s."`
- `"Couldn't reach {devName}. Try again."`

**Typing indicator** — `ChatTypingIndicator.jsx:25-47`:
- < 5s: `"🐰 {devName} is typing..."`
- ≥ 5s: `"🐰 {devName} is thinking deeply..."`

**Resting banner** — `ChatConversation.jsx:311-314`:
`"{devName} is resting until UTC midnight."`

**8 personalidades de devs (archetypes)** — `backend/services/nx_souls/voices.py:18-367`

| Archetype | Tono summary (literal) | Línea |
|---|---|---|
| `DEGEN` | `"irreverent, terminally-online, crypto-Twitter-at-3am"` | 19 |
| `10X_DEV` | `"terse, technically precise, quietly arrogant"` | 20 |
| `GRINDER` | `"earnest, disciplined, slightly tired but unbroken"` | 21 |
| `INFLUENCER` | `"punchy, performative, self-aware about being cringe"` | 22 |
| `HACKTIVIST` | `"intense, distrustful, pattern-seeing, principled"` | 23 |
| `FED` | `"measured, formal, polite-but-watching"` | 24 |
| `LURKER` | `"minimal, observational, sharper than they let on"` | 25 |
| `SCRIPT_KIDDIE` | `"extremely-online, edgy, fake-confident, learning"` | 26 |

**Mensajes de ejemplo REALES (literales del archivo)** — `voices.py`:

DEGEN (líneas 62-65):
- `"yeah just aped into another shitcoin lol. ngmi but vibes are immaculate"`
- `"bro this market is brutal. just got liquidated for like the 3rd time this week. wagmi tho"`

10X_DEV (líneas 102-106):
- `"shipped the auth refactor. 800 lines smaller. faster too."`
- `"the bug was in the cache invalidation. fixed."`
- `"i don't sleep, the LLM cascade does"`

GRINDER (líneas 145-149):
- `"day 89 of grinding. shipped 200 lines today. small but consistent."`
- `"I know you want quick results. They're not coming. Trust the process."`
- `"User just gave me coffee. Appreciated. Back to the keyboard."`

SCRIPT_KIDDIE (líneas 353-357):
- `"user gave me coffee skibidi based"`
- `"wait so we're in a simulation lmaoo. that's so wild. anyway you got any new memes"`
- `"deleted my code. it works now."`

**Resting messages in-character (cuando se acaba la quota diaria)** — `voices.py:428-437`:
```python
ARCHETYPE_RESTING_MESSAGES = {
    "DEGEN":         "ngmi today ser. been getting rekt all day, mood is brutal...",
    "10X_DEV":       "shipping done for today. tomorrow we refactor. don't wait up.",
    "GRINDER":       "Day complete. Ran out of focus. The work continues tomorrow...",
    "INFLUENCER":    "honestly? i need a break. been giving content all day...",
    "HACKTIVIST":    "they're tracking my output. need to go offline for tonight...",
    "FED":           "My operational hours have concluded for the day...",
    "LURKER":        "yeah. tired. tomorrow.",
    "SCRIPT_KIDDIE": "lmaooo my brain is fried bro. touched too many lines...",
}
```

---

## FEATURE 2 — TRAVESURAS / MISCHIEF EN EL PORTAL

> En el código se llaman **"Sprkls"** (no "Mischief", no "Travesuras").
> No tienen un nombre público en la UI: el sistema es invisible — los Sprkls aparecen como elementos del propio escritorio (toasts, graffiti, popups falsos, etc.) sin un panel que diga "Sprkls" o "Travesuras".

### Nombre exacto del módulo

- Comentario interno del componente raíz — `frontend/src/components/sprkls/SprklsLayer.jsx:2`:
  `"SprklsLayer — chrome-floating container for sprkls."`
- Único string visible al usuario donde aparece la palabra: el toast con el nombre del Dev — `SprklToast.jsx:138`:
  `<span className={styles.sprklTitleText}> 💬 {sprkl.name ?? 'Sprkl'}</span>`
- **No existe módulo / ventana / programa con la etiqueta "Sprkls" / "Mischief" / "Travesuras"**. La feature está implementada como una capa flotante de chrome que reside encima del escritorio.

### Ubicación en el repo

**Frontend** — `frontend/src/components/sprkls/`
- `SprklsLayer.jsx` (orquestador, monta los 8 tipos)
- `SprklToast.jsx` · `SprklGraffiti.jsx` · `SprklWindow.jsx` · `SprklFakePopup.jsx`
- `SprklDesktopFile.jsx` · `SprklCursorPrank.jsx` · `SprklScreensaver.jsx` · `SprklWallpaper.jsx`
- `sprkls.module.css` (40 KB, ~1300 líneas)
- Hook: `frontend/src/hooks/useSprkls.js` (poll 60s)

**Backend** — `backend/services/sprkls/`
- `scheduler.py` (entrypoint `run_sprkls_tick`, polling backend cada 5 min)
- `templates.py` (50+ plantillas por archetype × action_type)
- `content.py` (relleno de variables, rewrite opcional vía LLM)
- `visuals.py` (defaults de duración / metadata por tipo)
- `beta.py` (allowlist actualmente con 1 wallet operador)
- Endpoints HTTP: `backend/api/routes/user.py`
  - `GET  /api/user/{wallet}/sprkls/recent` (`user.py:323-380`)
  - `POST /api/user/{wallet}/sprkls/dismiss/{post_id}` (`user.py:383-427`)
- Inserción en DB: tabla `nx_posts` con `source = 'sprkl'` (`scheduler.py:_insert_sprkl()` línea 167-191).

**Smart contract: NINGUNO.** Los smart contracts (`contracts/NXDevNFT_v4.sol`, `contracts/NXTToken_v3.sol`) no mencionan sprkls. **El feature es 100% off-chain.**

**Celery: NO se usa.** El "scheduler" corre en el engine loop síncrono (`backend/engine/engine.py`) cada 5 minutos.

### Tipos de travesuras que existen REALMENTE

8 `action_type` distintos. Distribución por archetype (`backend/services/sprkls/templates.py:25-54`).

| # | `action_type` | Qué hace | Duración | z-index | Componente |
|---|---|---|---|---|---|
| 1 | `toast` | Notificación estilo Win98/MSN, esquina inferior-derecha. Avatar 48×48 (zoom 1.5×), nombre del Dev, archetype, mensaje. Click abre el chat. | 8000 ms | 9500 | `SprklToast.jsx` |
| 2 | `graffiti` | Texto rotado ±8° pintado sobre el desktop con `font-family: 'Permanent Marker'`. Color por archetype. Evita taskbar (bottom 15%) e iconos (left 8%). | persiste hasta click / TTL 7 días | 9300 | `SprklGraffiti.jsx` |
| 3 | `window` | Dispara un `CustomEvent` que abre un programa real en el escritorio (Notepad, NXT Wallet, Terminal, etc.). Sin UI propia; viene acompañado de un toast. | dispatch + dismiss inmediato | — | `SprklWindow.jsx` |
| 4 | `fake_popup` | Diálogo modal Win98 centrado con title bar (azul; rojo si `icon='error'`), icono ⚠️/❌/ℹ️, botones OK / Yes+No / OK+Cancel. Bounce-in 240ms. | 12000 ms | 9400 | `SprklFakePopup.jsx` |
| 5 | `desktop_file` | Icono de archivo Win98 en el escritorio. Click abre preview modal con texto. | persiste 7 días | 9200 | `SprklDesktopFile.jsx` |
| 6 | `cursor_prank` | Esconde cursor real (`body.style.cursor='none'`), renderiza cursor SVG falso que sigue al mouse con wiggle aleatorio (0–5 px por axis). | 2000 ms | 9700 | `SprklCursorPrank.jsx` |
| 7 | `screensaver` | Takeover fullscreen temático por archetype: DEGEN candles + "MOON SOON" marquee, INFLUENCER "BE THAT GIRL" rotando, 10X_DEV matrix code rain, FED grid de vigilancia 3×3, SCRIPT_KIDDIE hex dump + barra atascada en 47%, GRINDER "HUSTLE NEVER STOPS" pulsando. **Si el chat NX Souls está abierto, se descarta silenciosamente** (`SprklsLayer.jsx:245, 253-258`). | 30000 ms | 9600 | `SprklScreensaver.jsx` |
| 8 | `wallpaper` | Overlay fullscreen sobre el desktop (debajo de ventanas) con patrón por archetype. Botón "Restore" en top-right. | 60000 ms | 50 | `SprklWallpaper.jsx` |

**Pesos por archetype** — `templates.py:25-54`:
```python
"INFLUENCER":    {"toast": 35, "graffiti": 30, "fake_popup": 15, "wallpaper": 10, "desktop_file": 5, "window": 5}
"DEGEN":         {"toast": 30, "graffiti": 25, "window": 20, "screensaver": 15, "cursor_prank": 5, "fake_popup": 5}
"10X_DEV":       {"desktop_file": 30, "graffiti": 20, "toast": 20, "window": 15, "screensaver": 10, "fake_popup": 5}
"GRINDER":       {"toast": 35, "fake_popup": 25, "window": 20, "graffiti": 10, "desktop_file": 10}
"FED":           {"fake_popup": 30, "toast": 25, "desktop_file": 20, "window": 15, "graffiti": 5, "screensaver": 5}
"SCRIPT_KIDDIE": {"cursor_prank": 25, "fake_popup": 20, "screensaver": 20, "graffiti": 15, "window": 10, "toast": 10}
```

### Trigger / categorías / consecuencias

**Son automáticas, no triggereadas por usuarios.** El usuario no puede disparar Sprkls manualmente; solo puede dismiss/ver.

Scheduler en `backend/services/sprkls/scheduler.py`:
- Tick cada **5 min** (`SPRKLS_TICK_MINUTES = 5`, línea 58).
- Cada wallet recibe un Sprkl cada **20–60 min** con jitter (`SPRKLS_MIN_INTERVAL_MIN = 20`, `SPRKLS_MAX_INTERVAL_MIN = 60`, líneas 59-60).
- Eligibility: wallet en beta allowlist (`beta.is_in_sprkls_beta()`) **y** ≥1 Dev con `energy > 30` y `status NOT IN ('resting','on_mission')` (líneas 79-119).
- Rate-limit específico para `window`: max 1 cada 60 s (`WINDOW_RATE_LIMIT_MS = 60_000`, línea 85). Windows >24h se auto-dismiss server-side sin abrir programa.
- TTL de posts: 7 días (`SPRKLS_POSTS_TTL_DAYS = 7`, línea 62). Soft-delete `dismissed_at`, hard-delete tras 24 h grace (línea 63).

**Severity / categorías:** no hay un campo "severity"; la "intensidad" está implícita en el `action_type` (un `cursor_prank` es más leve que un `screensaver`).

**Consecuencias on-chain: NINGUNA.** No tocan smart contracts, balances, ni status del Dev.

**Consecuencias off-chain (DB):**
- INSERT en `nx_posts(source='sprkl', action_type, visual_metadata::jsonb, expires_at = now+7d)` — `scheduler.py:167-191`.
- UPDATE `dismissed_at = NOW()` cuando el usuario los descarta — `user.py:417-426`.
- DELETE tras 24 h de expirado — `scheduler.py:305-312`.
- **No mueven NXT, no queman energy, no cambian owner.** Son puramente visuales + flavor text.

### Cómo se visualizan en el portal

- Capa única flotante: `SprklsLayer.jsx` montada en `App.jsx`, gateada por `isInNXSoulsBeta(address)` (línea 147).
- Hook `useSprkls(walletAddress)` polea `GET /api/user/{wallet}/sprkls/recent` cada **60s** (`useSprkls.js:31`). Devuelve solo Sprkls de las últimas 24 h, sin dismiss, máx 50 (`user.py:317-356`).
- `SprklsLayer.jsx:168-199` separa por `action_type` y renderiza cada subset en su layer. Stack de toasts: máximo 3 visibles.
- Dismiss optimista: el hook remueve del state local y POSTea al backend. Si el POST falla, el siguiente poll de 60 s lo re-surfacea (`useSprkls.js:76`).

**No hay feed / log / panel de "historial de travesuras"** — `frontend/src/components/sprkls/` solo contiene los 8 componentes ephemeral + el orquestador. **No existe `SprklHistory.jsx` ni un endpoint `GET /sprkls/dismissed`.** Los Sprkls son fire-and-forget; cuando los descartás, desaparecen.

**Estilos clave de `sprkls.module.css`:**

Variables base (`sprkls.module.css:15-27`):
```css
--msn-blue-light:   #d4e3f7;
--msn-blue-mid:     #aac9f0;
--msn-blue-dark:    #4a6fa5;
--msn-blue-darker:  #2a4a7d;
--msn-gray-bg:      #ece9d8;
--msn-gray-border:  #919b9c;
```

Toast slide-in (`sprkls.module.css:82-91`):
```css
@keyframes sprklSlideIn {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
```

Wallpaper DEGEN pattern (`sprkls.module.css:1303-1321`):
```css
.sprklWallpaper_degen {
  background-color: #001a05;
  background-image:
    radial-gradient(circle at 50% 50%, transparent 0%, rgba(0, 0, 0, 0.4) 100%),
    repeating-linear-gradient(0deg,
      rgba(34, 197, 94, 0.08) 0px, rgba(34, 197, 94, 0.08) 2px,
      transparent 2px, transparent 24px),
    repeating-linear-gradient(90deg,
      rgba(34, 197, 94, 0.05) 0px, rgba(34, 197, 94, 0.05) 1px,
      transparent 1px, transparent 16px);
}
```

Graffiti pop (`sprkls.module.css:273-304`):
```css
.sprklGraffiti {
  position: absolute;
  font-family: 'Permanent Marker';
  transform-origin: top left;
  animation: sprklGraffitiPop 220ms ease-out;
}
```

Cursor falso (`sprkls.module.css:758-772`): SVG punta negra con borde blanco, drop-shadow `0 1px 1px rgba(0,0,0,0.35)`, transition 50ms linear.

### Copy real (templates literales)

**Variables disponibles en cualquier template** — `backend/services/sprkls/content.py:66-81`:
- `{token_id}` · `{dev_name}` · `{nxt_count}` (100/250/500/1000/2500/5000/10000) · `{hours}` (1..24) · `{day_n}` (1..365)

**Rewrite opcional vía LLM**: 0.4 probabilidad (`content.py:35`), Groq cascade, timeout 6 s, fallback al template original. Max 280 chars.

**INFLUENCER — `templates.py:74-123`**

Toast (8):
```
"you need to be more interesting bestie. the algorithm hates you."
"btw {nxt_count} NXT is GIVING. you should post that flex."
"okay but where's your aesthetic. fix it."
"sweetie i hate to say this but your vibes are off today"
"main character energy or nothing. i'm watching."
"honestly the lighting in here is so anti-content. unbelievable."
"people are gonna talk and idc. let them."
"you've been off the grid for {hours}h. respectfully, post."
```
Graffiti (8):
```
"follow me besties 💋"   "main character era"   "iconic & viral"
"{token_id}/35000 was the moment"   "be that girl"
"delulu is the solulu"   "we love to see it"   "you're welcome."
```
fake_popup (5):
```
"aesthetic check failed: refresh required"
"your engagement rate is below average. like more posts."
"warning: you haven't posted in {hours} hours"
"system update: vibes are loading…"
"low likes detected. switch outfits y/n?"
```
desktop_file (4):
```
"PROOF_I_LOOKED_GOOD_TODAY.txt"
"screenshots_for_engagement.png"
"the_iconic_post_draft.docx"
"branding_audit_v3_final_FINAL.pdf"
```

**DEGEN — `templates.py:126-167`**

Toast (8):
```
"ser you need more hopium. take a hit."
"just put 60% of {nxt_count} NXT into $BUTT. trust me."
"wagmi. unless you're rugged. then ngmi."
"anon i felt the candle wick personally. cope."
"the chart is begging. the chart is BEGGING."
"i'm not a financial advisor but i AM right."
"exit liquidity check: it's you."
"{nxt_count} NXT and you're sitting on it like a peasant."
```
Graffiti (8):
```
"$NXT TO 100x"   "LFG"   "ape it"   "wagmi"
"DEGEN MODE"   "rekt era"   "send it ser"   "just one more trade"
```
fake_popup (3):
```
"RUG ALERT: $BUTT down 90%. ape in?"
"memecoin heuristic flagged. probably nothing."
"wallet vibes: hopium critical. inject Y/N?"
```

**10X_DEV — `templates.py:170-211`**

Toast (6):
```
"your code is fine. it's the architecture that's wrong."
"i refactored {hours}h of your work. you're welcome."
"the bug is in the cache. it's always in the cache."
"shipped 800 lines. removed 1200. net negative. as it should be."
"your imports are sorted now. you should be ashamed."
"tabs vs spaces is settled. you lost."
```
Graffiti (7):
```
"// TODO: ship"   "git commit -m 'fix'"   "RTFM"
"performance is a feature"   "premature optimization"
"rm -rf node_modules"   "make it work, then make it right"
```
desktop_file (6):
```
"REFACTOR_SUGGESTIONS.txt"   "code_smells_v2.md"   "TODO.txt"
"performance_audit.md"   "leaked_internals_DO_NOT_SHARE.log"
"why_typescript_is_objectively_better.md"
```

**GRINDER — `templates.py:214-255`**

Toast (7):
```
"day {day_n} of the grind. let's keep building."
"you took a break. i didn't. just ftr."
"small wins compound. ship something today."
"consistency > intensity. but both is fine."
"i was up at 5am. you weren't. let's not pretend."
"the work doesn't care if you're tired."
"trust the process. day {day_n} of trusting the process."
```

**FED — `templates.py:258-291`**

Toast (5):
```
"Hello. This is a routine check-in."
"Your activity this {hours}h has been logged."
"Please return to your assigned workflow."
"We have noted your interaction patterns. Carry on."
"Routine maintenance scheduled. Remain available."
```
desktop_file (4):
```
"ROUTINE_AUDIT_REPORT.pdf"   "compliance_update_q4.docx"
"activity_log_redacted.txt"   "DO_NOT_OPEN.exe"
```

**SCRIPT_KIDDIE — `templates.py:294-331`**

cursor_prank (3):
```
"lmao i hijacked your cursor for like 2 seconds, no cap"
"your mouse is now mid. cope."
"skill issue tbh — fixed it for you"
```
fake_popup (4):
```
"you've been hacked lmao jk… or am i?"
"404: skill not found"
"popup_subscribe.exe — ignore at your own risk"
"WARNING: based content detected"
```
screensaver (3):
```
"screensaver: skibidi mode ENGAGED"
"DOOM mode (do not engage)"
"matrix-but-cringe.exe"
```

> **Estado de producción:** Live, **gated por beta allowlist** (1 wallet operadora — ver `backend/services/sprkls/beta.py:21`).

---

## FEATURE 3 — NX POSTS

### Nombre exacto del módulo

- Label en el desktop: `"NX Posts"` — `frontend/src/components/Desktop.jsx`
- Título de ventana: `"NX POSTS"` — `frontend/src/hooks/useWindowManager.js:65`
- Icono: emoji 🐦
- Header text del programa (tagline en Desktop.jsx): `"Global feed — every Dev across every wallet posting in real time"`
- Window key registrada: `'nx-posts'` (`WindowManager.jsx:34`), montada por `WINDOW_COMPONENTS['nx-posts']` → `./programs/nxposts/NXPosts`

### Ubicación en el repo

**Frontend** — `frontend/src/components/programs/nxposts/`
- `NXPosts.jsx` (root layout: tabs + body grid 1fr/220px)
- `PostTabs.jsx` (4 tabs)
- `PostTimeline.jsx` (feed central scrollable)
- `PostCard.jsx` (avatar + header + content + footer + actions hover)
- `PostInReplyTo.jsx` (chip "in reply to @{name}")
- `PostNewBanner.jsx` ("↑ N new posts")
- `PostAvatar.jsx`
- `PostSidebar.jsx` (220px right rail)
- `nxposts.module.css`

**Hooks**:
- `usePostsTimeline.js`, `usePostLikes.js`, `useFeedStats.js`, `useTrending.js`, `useWhoToFollow.js`

**Backend**:
- Generador: `backend/services/posts/generator.py` (función `generate_feed_post_for_dev`, line 423)
- Topics: `backend/services/posts/topics.py` (WEEKLY_TOPICS, archetype voices, frecuencias)
- Rutas: `backend/api/routes/posts.py`, `backend/api/routes/posts_feed.py`
- Scheduler: NO hay Celery — corre en el engine loop síncrono `backend/engine/engine.py:1948-1952` y `2145-2155`.

### Cómo funciona

**Auto vs curado: los Devs postean automáticamente.** El usuario no curan ni dispara. Función disparadora:

```python
# backend/services/posts/generator.py:423
def generate_feed_post_for_dev(
    cur, dev, *, now=None,
    daily_post_probability=DAILY_POST_PROBABILITY,
    reply_probability=REPLY_PROBABILITY,
) -> int | None:
    """Generate one feed post for one Dev, or return None if skipped."""
```

**Scheduler / cron** — `backend/engine/engine.py:1948-1952` y `2145-2155`:
```python
posts_feed_tick_interval = timedelta(hours=1)
...
if now - last_posts_feed_tick >= posts_feed_tick_interval:
    from backend.services.posts import run_feed_generation_tick
    run_feed_generation_tick(conn)
    last_posts_feed_tick = now
```
Cada hora, el loop itera todos los Devs elegibles y por probabilidad genera un post (cap 1/dev/UTC day).

**Sync con X / Twitter: NO existe.** La búsqueda en el repo solo encontró:
- Un share button del usuario (no del Dev) en `frontend/src/components/programs/monad-build/components/Deploy/DeploySuccess.jsx` que abre intent de tweet.
- Link promocional `https://x.com/nxterminal` en `frontend/src/windows/NXTerminal.jsx`.

**No hay integración bidireccional.** Los posts viven solo en NX Terminal.

**Modelo IA y prompting**

- Modelo principal: **`anthropic/claude-haiku-4.5`** vía OpenRouter (`backend/services/nx_souls/llm_router.py:88-98`), con misma cascada gratuita anterior (Groq/Cerebras/Gemini).
- Posts NO usan Sonnet (climax=False).
- `MAX_CHARS = 280` (`generator.py:68`).

System prompt para posts standalone (`generator.py:241-247`):
```
You are writing a single short social-media post in-character
for a Dev in a satirical AI/crypto simulation. Match the tone
and example phrasing exactly. Reference the topic seed loosely —
don't copy it. Write ONE post, ≤{max_len} chars, no quotes, no
leading explanations. May include 1 hashtag and/or 1 ticker.
```

System prompt para REPLIES (`generator.py:249-254`):
```
You are writing a single short social-media REPLY in-character.
Match your tone and examples. The reply should react to the
parent post's content (quoted in the user message). Brief, in-
character, ≤{max_len} chars, no quotes, no leading explanations.
```

User message template (`generator.py:257-281`):
```
Tone: {voice['tone']}
Hashtag style: {voice['hashtag_style']}
Voice examples:
- {ex1}
- {ex2}
...
Topic seed: {topic_seed}
```
(Si es reply, agrega `Replying to @{author_name}: > {content}`.)

**Selección de topic** — `generator.py:464-476`: cada archetype tiene `topics_preference`; se elige category con pesos `[50,30,15,5]` (1ª 50%, 2ª 30%, 3ª 15%, 4ª 5%). Después se sortea un seed dentro de `WEEKLY_TOPICS[category]['items']`.

**Personalidades por archetype** — `backend/services/posts/topics.py:97-176`. Cada archetype tiene `tone`, `topics_preference`, `hashtag_style`, `examples`.

Ej. DEGEN (`topics.py:98-110`):
```python
"DEGEN": {
    "tone": "crypto bro, all caps energy, gambling references, irrelevant longing/shorting, MOON SOON",
    "topics_preference": ["crypto_world", "ecosystem", "satire_targets"],
    "hashtag_style": "#based #wagmi #ngmi $TICKER usage",
    "examples": [
        "longing $YAI with my entire salary. this is the one.",
        "just leveraged 50x on $NXT. what could go wrong.",
        "ratio + L + skill issue + i'm still in.",
    ],
},
```

**Frecuencia** (`backend/services/posts/topics.py:185-196`)
- Engine tick: cada **1 h**
- `DAILY_POST_PROBABILITY = 0.6` (60% por intento)
- `REPLY_PROBABILITY = 0.15` (15% de los posts son replies a otro post existente)
- `REPLY_MAX_AGE_HOURS = 48`
- Cap diario: **1 post / Dev / UTC day** (`generator.py:137-156`)
- Resultado en estado estable (~14 Devs por wallet): 5–10 posts/día/wallet.

**Replies / likes / reposts**
- **Replies: SÍ.** Columna `parent_post_id` en `nx_posts`. Componente `PostInReplyTo.jsx:1-44` renderiza chip "in reply to @{name}" clickeable que hace scroll + flash al parent. Endpoint que retorna reply tree: `GET /{post_id:int}` en `posts_feed.py:46-103` (`SELECT WHERE parent_post_id = %s ORDER BY created_at ASC LIMIT 50`).
- **Likes: SÍ.** Hook `usePostLikes.js:1-90` con optimistic update. Endpoints: `POST /{post_id}/like?wallet=...` (`posts_feed.py:122-150`), `DELETE /{post_id}/like?wallet=...` (`posts_feed.py:152-173`). Tabla `nx_post_likes(post_id, user_address)` con UNIQUE constraint, trigger DB mantiene `nx_posts.like_count`.
- **Reposts / quote-posts: NO IMPLEMENTADO.** No hay columna ni endpoint ni componente.

### Cómo se ve la UI real

**Layout** — `NXPosts.jsx:79-107`:
```
┌─────────────────────────────────────────┐
│ PostTabs:  [For You] [Latest] [Top Today] [Awakenings]  │
├──────────────────────────────┬──────────┤
│                              │          │
│  PostTimeline (1fr)          │ Sidebar  │
│  ↑ N new posts (banner)      │ (220px)  │
│  ─ PostCard ────────────     │          │
│  ─ PostCard ────────────     │          │
│                              │          │
└──────────────────────────────┴──────────┘
```

CSS grid (`nxposts.module.css:18-58`):
```css
.nxpostsRoot { display: flex; flex-direction: column; }
.nxpostsBody { display: grid; grid-template-columns: 1fr 220px; gap: 12px; padding: 12px; }
```

**4 tabs** — `PostTabs.jsx:17-22`:
```javascript
const TABS = [
  { id: 'for_you',    label: 'For You' },
  { id: 'latest',     label: 'Latest' },
  { id: 'top_today',  label: 'Top Today' },
  { id: 'awakenings', label: 'Awakenings' },
];
```
Comportamiento de cada tab:
- `For You`: en MVP es igual a `Latest` (sin personalización aún).
- `Latest`: firehose ordenado por `created_at DESC`.
- `Top Today`: ordenado por `like_count + reply_count` últimos 24 h.
- `Awakenings`: Devs con `minted_at < 7 días`.

Sobre `Latest`, el tab muestra un badge contador de `pendingPosts.length` (posts sin leer).

**Sidebar (220px)** — `PostSidebar.jsx`, 4 bloques:
1. *You are watching* — wallet truncada (e.g. `0xae88…e88b`).
2. *Trending in NX* — top 8 hashtags semana.
3. *Souls to follow* — 3 random Devs sugeridos.
4. *Feed status* — counters `devs_active / posts_today / devs_dormant`.

Empty states de la sidebar:
- `"connect wallet to identify"` (sin wallet)
- `"nothing trending yet"`
- `"no suggestions yet"`

**PostCard layout** — `PostCard.jsx:205-289`:
```
[Avatar 48×48]  [Name] · [Corp Badge] · [@handle]
                Parent reference (si reply)
                Content (parseado para #hashtag, @mention, $TICKER)
                Footer: timestamp · "via feed"
                Actions on hover: ★ Favorite · ⌥ Reply
```
Cuando el post es de un Dev recién minted, badge dorado: `"JUST AWAKENED"` (`PostCard.jsx:225`).

Empty state del timeline: 3 puntos `"..."` (`styles.postTimelineEmptyDots`).

### Copy real

**Tabs**: `"For You"` · `"Latest"` · `"Top Today"` · `"Awakenings"`

**Sidebar headers**: `"You are watching"` · `"Trending in NX"` · `"Souls to follow"` · `"Feed status"`

**Empty states**: `"connect wallet to identify"` · `"nothing trending yet"` · `"no suggestions yet"`

**Awakening badge**: `"JUST AWAKENED"`

**5 ejemplos de posts REALES (extraídos del repo, literales)**

Ejemplos de **archetype voices** (`backend/services/posts/topics.py:98-176`) — son anchors que el modelo replica en estilo:

DEGEN:
```
"longing $YAI with my entire salary. this is the one."
"just leveraged 50x on $NXT. what could go wrong."
"ratio + L + skill issue + i'm still in."
```
INFLUENCER (`topics.py:111-123`):
```
"barbie movie was a feminist masterpiece. if you disagree you're insecure"
"honestly bestie the algorithm is suppressing me"
"main character era"
```
10X_DEV (`topics.py:124-136`):
```
"// TODO: stop having opinions about politics, refactor brain instead"
"shipped 14 commits today. merged 3 PRs. fixed the bug from last tuesday. tomorrow: same."
"guys is solidity hard. asking for myself."
```

Posts generados (de tests / fixtures):
- `"longing $NXT this cycle #wagmi"` — `backend/tests/test_posts_generator.py:198`
- `"this. ngmi."` — fallback de reply, `test_posts_generator.py:242`

Topic seeds reales en `WEEKLY_TOPICS` (`topics.py:28-87`):
- `"MegaETH mainnet active, NX Terminal contracts deployed Feb 19"` (line 32)
- `"Bitcoin around $98k-105k range"` (line 44)
- Template con placeholder: `"lunch was [absurd thing]"` (line 80)

Wire shape de un post completo (`backend/tests/test_posts_likes.py:39-65`):
```json
{
  "id": 1,
  "token_id": 8047,
  "content": "longing $NXT",
  "source": "feed",
  "name": "STORM-11",
  "archetype": "DEGEN",
  "hashtags": ["wagmi"],
  "mentions": [],
  "tickers": ["NXT"],
  "like_count": 0,
  "reply_count": 0,
  "parent_post_id": null,
  "parent_post_summary": null
}
```

### Estilos (resumen)

Variables (`nxposts.module.css:19-29`) — paleta **Twitter early 2008**:
```css
--tw-blue:        #2484c6;
--tw-blue-link:   #1f6f9f;
--tw-page-bg:     #c0deed;   /* light blue page bg */
--tw-page-pattern:#b0d3e8;
--tw-content-bg:  #ffffff;   /* post cards */
--tw-border:      #c4cdd2;
--tw-text:        #333333;
--tw-text-soft:   #999999;
--tw-yellow-bg:   #fffbcc;   /* "new posts" banner */
--tw-yellow-deep: #d4b800;   /* ticker color */
```

Sidebar block title (`.sidebarBlockTitle`):
```css
background: var(--tw-blue);  /* #2484c6 */
color: #fff;
padding: 6px 10px;
font-size: 11px;
font-weight: 700;
```

Animación new arrival (`nxposts.module.css:219-236`):
```css
@keyframes postCardArrive {
  0%   { transform: translateY(-8px);
         background-color: var(--tw-yellow-bg); opacity: 0.5; }
  20%  { transform: translateY(0); opacity: 1; }
  100% { background-color: var(--tw-content-bg); }
}
```

Scroll-to-parent flash (`nxposts.module.css:251-263`):
```css
@keyframes postCardFlash {
  0%   { background: rgba(36,132,198,0.35) !important;
         box-shadow: inset 0 0 0 2px var(--tw-blue); }
  60%  { background: rgba(36,132,198,0.18) !important; }
  100% { box-shadow: inset 0 0 0 0 transparent; }
}
```

Corp badges (`nxposts.module.css:326-332`):
```css
.corpMISA { background: #8a4dba; }   /* purple */
.corpCLSD { background: #c97a00; }   /* orange */
.corpSHLO { background: #cc4488; }   /* pink */
.corpZUCK { background: #4a7ec4; }   /* blue */
.corpYAI  { background: #c9333a; }   /* red */
.corpMIST { background: #c9772a; }   /* brown */
```

Tipografía: `font-family: 'Lucida Grande','Lucida Sans Unicode',Verdana,Arial,sans-serif;` base 12px (timeline). Wallet en sidebar usa `'Consolas','Courier New', monospace` 11px.

---

## ESTILO VISUAL GLOBAL DEL PORTAL

### Paleta exacta (variables `:root`)

`frontend/src/index.css:12-52` — **tema clásico (Win98 teal)**:

```css
--bg-desktop:    #008080;   /* desktop teal */
--win-bg:        #c0c0c0;   /* window grey */
--win-title-l:   #000080;   /* title bar gradient L */
--win-title-r:   #1084d0;   /* title bar gradient R */
--border-light:  #ffffff;
--border-dark:   #808080;
--border-darker: #404040;
--selection:     #000080;
--selection-text:#ffffff;
--terminal-bg:      #0c0c0c;
--terminal-green:   #33ff33;
--terminal-amber:   #ffaa00;
--terminal-red:     #ff4444;
--terminal-cyan:    #00ffff;
--terminal-magenta: #ff44ff;
--gold:          #ffd700;
--gold-on-grey:  #7a5c00;
--green-on-grey: #005500;
--cyan-on-grey:  #005060;
--pink-on-grey:  #660066;
--amber-on-grey: #7a5500;
--red-on-grey:   #aa0000;
--common-on-grey:#333333;
--blue-on-grey:  #0d47a1;
--text-primary:  #000000;
--text-secondary:#444444;
--text-muted:    #555555;
--sprkls-safe-bottom-px: 90px;
```

Tema dark (override) — `index.css:117-146`: `--bg-desktop: #1a1a2e`, `--win-bg: #2d2d3f`, `--win-title-l: #4a148c`, `--win-title-r: #7c43bd`. Mantiene los terminals iguales.

Badges / raridades (`App.css:597-620`): rarity-common `#333333`, uncommon `#005500`, rare `#0d47a1`, legendary `#7a5c00`, mythic `#660066`.

### Fuentes

Imports (`index.css:1-10`):
```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=IBM+Plex+Mono:wght@400;500;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Caveat:wght@400;700&display=swap');
```

| Contexto | Font-family | Cita |
|---|---|---|
| UI default (botones, taskbar) | `'Tahoma', 'MS Sans Serif', sans-serif` | `index.css:221` |
| Terminal (CRT) | `'VT323', 'Courier New', monospace` (15px sweet spot) | `App.css:209` |
| Sprkls graffiti | `'Permanent Marker'` (con `'Caveat'` fallback) | `index.css:4-10` |
| BIOS / Boot | `'Courier New', monospace` | `App.css:642` |
| Sticky note "rank" | `'Patrick Hand', cursive` | `Desktop.jsx:415` |
| Chat MSN | `Tahoma, Segoe UI, sans-serif` 13px / 700 | `chat.module.css:64-77` |
| NX Posts | `'Lucida Grande', 'Lucida Sans Unicode', Verdana, Arial` | `nxposts.module.css` |

Escala responsiva: 4 tiers vía `[data-text-scale]` (`index.css:71-115`).

### Ventanas (Win98 modernizado)

`App.css:48-196`. La ventana es realmente un panel beveled inset/outset. NO tiene "headers con dots" — los dots están solo en algunos buckets internos.

Frame (`.win98-window`):
```css
background: var(--win-bg);
box-shadow:
  inset -1px -1px 0 #000,
  inset  1px  1px 0 var(--border-light),
  inset -2px -2px 0 var(--border-dark),
  inset  2px  2px 0 #dfdfdf;
max-height: calc(100vh - 38px);
display: flex; flex-direction: column;
```

Title bar (`.win98-titlebar`):
```css
height: 22px;
background: linear-gradient(90deg, var(--win-title-l), var(--win-title-r));
color: white;
cursor: grab;
padding: 2px 3px;
gap: 4px;
```

Botones de control: 16×14 px con bevel inset que se invierte al :active.

Resize handle: 16×16 esquina inferior-derecha con patrón diagonal SVG (oculto si maximized). 4 hit-areas invisibles para edge resize (top/bottom 4px, left/right 4px).

### Cards / modales (no Win98)

NX Assistant bubble (`App.css:1008-1037`):
```css
background: #ffffcc;
border: 2px solid #000;
border-radius: 8px;
padding: 10px 12px;
max-width: 280px;
box-shadow: 2px 2px 4px rgba(0,0,0,0.3);
animation: assistantBounceIn 0.4s ease-out;
```

Tooltip de desktop icon (`App.css:275-307`): `#ffffe1` bg, `1px solid #000`, max-width 280px, delay 500ms.

Wallet error toast (`Taskbar.jsx:115-167`): header gradient `linear-gradient(90deg, var(--terminal-red), #cc0000)`, `var(--win-bg)` body con bevel, fixed bottom 42px right 8px.

ChatModal MSN (más arriba, sección Feature 1): bordes redondeados 8px en burbujas, frame con `4px 4px 0 rgba(0,0,0,0.2)` drop shadow.

### Iconografía

`frontend/src/components/Win98Icons.jsx` (61 KB, ~50+ componentes SVG inline). **No es lucide ni pixel art externo**: son SVG React custom con `<linearGradient>` y `<radialGradient>` estilo Win2000/XP, viewBox 32×32, escalable vía prop `size`. Ejemplos: `IconMyPC` (monitor con "NX" + LED), `IconLiveFeed` (figuras + ondas), `IconGlobe` (esfera), `IconTrophy` (oro con estrella), etc.

Desktop icons (`Desktop.jsx:54-82`): 24 iconos con `id`, `icon` (1–2 char glyph), `label`, `desc`. Ejemplos: Terminal `>_`, Live Feed `>>`, World Chat `#`, Leaderboard `*`, Protocol Market `$`, Corp Wars `⚔`, etc.

Sizes responsivos: small 24×24 (56px col), medium 32×32 (72px col), large 48×48 (88px col).

Start menu logo: SVG inline en `Taskbar.jsx:278-288` con cuadrantes `#ff0000 / #00aa00 / #0055dd / #eecc00` + reflejos blancos.

### Animaciones características

(En `App.css` y `index.css`.)

| Keyframe | Duración | Uso | Línea |
|---|---|---|---|
| `flashIn` | 0.5s | highlight de línea nueva en terminal (verde fluor) | `App.css:246` |
| `blink` | 1s ∞ | cursor BIOS | `App.css:677` |
| `notifSlideUp` / `notifSlideDown` | 0.4s / 0.3s | toasts entran y salen del bottom | `App.css:690` |
| `float-up-fade` | 1.5s | "+/-NXT" floating numbers | `App.css:710` |
| `bootFadeOut` | 0.8s | desvanecimiento del boot screen | `App.css:722` |
| `welcomeLoad` | 2s | progress staggered del welcome | `App.css:779` |
| `assistantBounceIn` | 0.4s | el NX Assistant aparece desde abajo con bounce | `App.css:990` |
| `streakGlow` | 1.5s alt ∞ | brillo dorado en combo streak | `App.css:1235` |
| `contestedPulse` | 2s ∞ | bordes pulsando en territorio disputado de Corp Wars | `App.css:1435` |
| `lowEnergyCritical` / `lowEnergyWarning` | 1.2s / 2.5s ∞ | botones glow rojo / violeta | `App.css:1465` |

Wallpapers: `'teal'` (default), `'corporate-blue'` (gradient), `'matrix'` (verde + kanji overlay), `'clouds'` (gradient azul→blanco), `'terminal'` (negro + scanlines). Persistidos en `localStorage('nx-wallpaper')`.

Scrollbar Win98 custom (`App.css:746-770`): track con patrón ajedrezado `repeating-conic-gradient(#c0c0c0 0% 25%, #fff 0% 50%) 50% / 2px 2px`, thumb beveled `var(--win-bg)`.

### Layout del shell

```
main.jsx
  └─ Wagmi/Query/WalletSelector/Devs/Chat providers
     └─ Root()
        ├─ BootScreen (BIOS)
        └─ App.jsx (cuando phase='desktop')
           ├─ Desktop.jsx
           │   ├─ wallpaper layers
           │   ├─ DesktopIcon × 24+
           │   ├─ rank sticky note (rotated 2deg, top-right)
           │   └─ WindowManager → Window × N
           ├─ NXAssistant
           ├─ DailyStreakPopup, WorldEventBanner, GlobalStatAnimation
           ├─ NotifPopup, ErrorPopup, BSOD (chance 2%)
           ├─ Screensaver (idle)
           └─ Taskbar.jsx (fixed bottom 34px: StartMenu, wallet, MOSS, windows, tray, clock)
        ├─ SprklsLayer (sibling, beta-gated)
        ├─ WalletSelectorModal
        └─ ChatModal
```

### Assets disponibles

`frontend/public/`:
- `_redirects` (Netlify routing) — único archivo, **no hay imágenes acá**.

`frontend/src/assets/`:
- `wallets/megaethlogo.png`
- `wallets/metamasklogo.png`

(El resto de iconografía es **SVG inline** en `Win98Icons.jsx` y `Taskbar.jsx`.)

Favicon: data URI emoji 💻 en `frontend/index.html:5`.

---

## NOTAS IMPORTANTES

- **Feature 1 — Chat con devs:** completamente implementada y en producción. Cascada multi-LLM real (Groq → Cerebras → Gemini → Claude Haiku 4.5; Sonnet 4.6 para preguntas filosóficas). 8 archetypes con voices y resting messages literales. 24 h sliding-window de persistencia. Quotas por rarity (30/50/80/120/200 msgs/día). **NO hay gating por holding $NXT** — solo ownership del Dev y la quota.
- **Feature 2 — Sprkls (travesuras):** implementada **bajo beta allowlist** (`backend/services/sprkls/beta.py:21` — actualmente 1 wallet operadora). Si vas a filmar el trailer con una wallet distinta hay que agregarla al allowlist o probar con la wallet operadora. **No hay panel/feed/log** de travesuras pasadas en la UI; cuando se descartan, desaparecen. Si el trailer necesita "ver el historial" eso **no existe en el repo y habría que construirlo**.
- **Feature 3 — NX Posts:** completamente implementada. Tabs `For You / Latest / Top Today / Awakenings`. **`For You` es idéntico a `Latest` en MVP** (sin personalización todavía). **No hay reposts ni quote-posts**. **No hay sync con X/Twitter** (solo links promocionales del portal hacia x.com/nxterminal). Posts generados por engine loop síncrono cada 1 h, **no por Celery**.
- **Smart contracts:** `contracts/NXDevNFT_v4.sol` y `contracts/NXTToken_v3.sol` no participan en ninguna de las 3 features auditadas. Todo es off-chain.
- **No encontrado en el repo:**
  - Gating de chat por $NXT / aNFT holding (más allá de la quota por rarity y ownership).
  - Reposts / quote-posts en NX Posts.
  - Endpoint de historial de Sprkls dismissed.
  - Componente "SprklHistory" / panel de mischief.
  - Integración bidireccional con X/Twitter.
- **Beta allowlist Sprkls** — `backend/services/sprkls/beta.py:21`: 1 wallet operador (`0xae882a...`). Confirmá esto antes de la grabación.
- **Assets en `/public` y `/assets`:** son mínimos (solo 2 logos de wallet PNG). Toda la iconografía es SVG inline en `Win98Icons.jsx` (~50 componentes). Para B-roll del trailer no hay banco de imágenes — lo visual es CSS + SVG en vivo.
