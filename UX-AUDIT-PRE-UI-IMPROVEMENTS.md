# UX audit — pre-UI improvements (status colors, low-energy glow, exhausted state)

**Branch:** `claude/audit-ui-state` (read-only)
**Base:** `origin/main` @ `af38597`
**Scope:** find what's there before we change anything. No code modifications.

---

## TL;DR (read this first)

1. **`exhausted` enum value exists, but nothing writes it.** Phase 2.2 added `'exhausted'` to `dev_status_enum`; zero code paths set `status = 'exhausted'`. The current "low energy" state is computed at API read-time as `is_idle = energy <= 0`. See §4.
2. **`is_idle` is purely cosmetic.** Frontend grayscales the card and shows `💤 IDLE` when `is_idle` is true; the persisted `status` column is unaffected. So an "energy=0 → status=exhausted" transition is **net new behaviour**, not a wiring fix.
3. **The "[MOVE]" / "[CREATE AI]" indicator is `dev.last_action_type`** with underscores → spaces. It comes from `nx.devs.last_action_type` (cached most-recent action) and the source of truth is the `action_enum` in `backend/db/schema.sql:43-47`. See §3.
4. **No polling. No websockets.** The panel fetches per-token via `api.getDev(id, address)`, caches for 5 min, and refetches only on manual refresh button or after a mutation. Energy decays once an hour in `pay_salaries`. UX implication: the new low-energy glow won't appear without a refresh unless we add polling. See §2.
5. **CSS = inline styles + `App.css` keyframes (`@keyframes critical-pulse`, `mission-pulse`, `streakGlow`, `contestedPulse`, `blink`).** No Tailwind, no shadcn, no theme module. There is already a `critical-pulse` keyframe that the `VitalBar` uses when energy ≤14% — we can lean on the same primitive for buttons. See §5.
6. **Buttons disable via `disabled={busy}` + per-button condition** (`bugsVal <= 0`, `pcHealth >= 100`, `balance_nxt < cost`). Disabled state is `opacity: 0.5` + gray bg, no special copy or icon. See §6.

---

## 1. Frontend layout

**Repo:** monorepo. Frontend lives in `frontend/` of `nxterminal/nx-terminal`.

**Stack** (from `frontend/package.json`):

| Layer | Choice |
|---|---|
| Build | Vite 7.3.1 |
| UI | React 19.2 |
| State (server) | `@tanstack/react-query` 5.90 (installed; **not used** in `MyDevs` — see §2) |
| Wallet | wagmi 2.14 + viem 2.46 + `@megaeth-labs/wallet-sdk*` |
| Charts | recharts 2.15 |
| Icons | `lucide-react` 0.577 |
| **CSS** | Inline styles + two CSS files: `frontend/src/index.css` (palette, sizing, typography), `frontend/src/App.css` (1454 lines — `@keyframes`, scrollbars, win98 widget styles). **No Tailwind, no CSS Modules, no styled-components.** |
| Component library | None (no shadcn / MUI / Radix). Win98-aesthetic primitives (`win-btn`, `win-raised`, `win-tabs`) defined in `App.css`. |

**State management:** the Devs payload uses **a hand-rolled React Context** (`frontend/src/contexts/DevsContext.jsx`) layered on top of wagmi's `useReadContract`. React Query is in deps but **not used** for the Devs feed — the context manages its own `STALE_TIME = 300_000` (5 min), `lastFetched` ref, and `refreshKey` counter.

**The "My Developers" panel — exact paths:**

| File | Line | What |
|---|---|---|
| `frontend/src/windows/MyDevs.jsx` | 2571 lines | The whole window — list, modals, tabs, activity feed |
| `frontend/src/windows/MyDevs.jsx` | `function DevCard` @ line 1731 | The per-Dev row (LYNX-X0, NEX-9K, …) |
| `frontend/src/windows/MyDevs.jsx` | `function StoneBtn` @ line 1338 | COFFEE / FIX / REPAIR pixel-button |
| `frontend/src/windows/MyDevs.jsx` | `function FeedDropdown` @ line 1440 | `FEED ▾` |
| `frontend/src/windows/MyDevs.jsx` | `function HackDropdown` @ line 1501 | `HACK ▾` |
| `frontend/src/windows/MyDevs.jsx` | `function EconDropdown` @ line 1371 | `ECONOMY ▾` (FUND/TRANSFER/REQUEST) |
| `frontend/src/windows/MyDevs.jsx` | `function VitalBar` @ line 1292 | The 6 stat bars (Energy, Bugs, PC Health, Social, Knowledge, Caffeine) |
| `frontend/src/contexts/DevsContext.jsx` | 211 lines | Token-list + per-Dev fetch + cache |
| `frontend/src/services/api.js` | 26+ | API client (`api.getDev`, …) |
| `frontend/src/windows/DevProfile.jsx` | 508 lines | Detail view opened on row click |

**Component library shaping the "stone" buttons** (line 1338):

```jsx
function StoneBtn({ emoji, label, onClick, disabled, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        // … VT323, color, bg, padding, etc.
        color: disabled ? '#555' : '#1a2030',
        background: disabled ? '#4a4a4a' : '#6b7b8a',
        opacity: disabled ? 0.5 : 1,
        boxShadow: disabled
          ? 'inset -2px -2px 0 #333, inset 2px 2px 0 #666'
          : 'inset -3px -3px 0 #3a4654, inset 3px 3px 0 #8fa0b0, 0 3px 0 #2a3444, 0 4px 0 #1a2434',
        transition: 'transform 0.05s',
      }}>
      {emoji && <span>{emoji}</span>}{label}
    </button>
  );
}
```

---

## 2. Current data flow

**Endpoint:** `GET /api/devs/{token_id}` (the *full* row, not the metadata one). Sourced via `api.getDev(id, address)` in `frontend/src/services/api.js:37`.

```js
// frontend/src/services/api.js
getDev: (id, owner) => fetchJSON(`${API_BASE}/api/devs/${id}${owner ? `?owner=${owner}` : ''}`),
```

The `?owner=` short-circuits the on-chain `ownerOf` check on the backend (frontend already verified via `tokensOfOwner`).

**How the panel collects data** (`frontend/src/contexts/DevsContext.jsx`):

1. `useReadContract({ functionName: 'tokensOfOwner', args: [address] })` — wagmi reads the NFT contract for the wallet's token IDs (line 37). Falls back to direct RPC if wagmi returns nothing (line 48-104).
2. For every token ID, fire `api.getDev(id, address)` in parallel (`Promise.all`, line 155). On per-token failure, retry once after 2s, then surface `{token_id, name: "Dev #N", _fetchFailed: true}` so the row can render in fallback mode (line 140-153).
3. Cache the resulting `devs[]` in context. **`STALE_TIME = 5 minutes`** (line 15).

**Refetch triggers — what you have today:**

| Trigger | Source |
|---|---|
| Wallet connect / token-list change | `useEffect` on `tokenKey, refreshKey, address` |
| 5-min stale (only if accessed) | `now - lastFetched.current < STALE_TIME` guard at line 131 |
| Manual user click | `↻ Refresh` button at `MyDevs.jsx:2484` |
| Cross-window event | `window.dispatchEvent(new Event('nx-devs-refresh'))` listener at line 184 (used by MissionControl) |
| After a mutation | every action callsite refetches the *single* dev row, e.g. `api.getDev(dev.token_id, address)` at lines 1808, 1826, 1844, 1861, 1881, 1897 |

**There is NO polling, NO `setInterval(refresh, …)`, NO websocket subscription** for Dev state. (There is one 15-second interval at `MyDevs.jsx:800` — that's the *pending-fund* status poller for the `FundModal`, scoped to a single in-flight transaction, not the Dev list.)

**UX implication for "energy → exhausted glow":** since salary tick decays energy `-1` per hour and there's no panel polling, a Dev that drops to energy=0 mid-session won't show the glow until the user clicks Refresh or performs an action on it. Two viable paths:

- (a) Add a low-frequency `setInterval(refreshDevs, 60_000)` in `DevsContext` (5min STALE_TIME currently means wallet-open-then-idle goes stale automatically — but only refetches on next access, not in the background).
- (b) Promote the `useDevs()` hook off the hand-rolled context and onto React Query (already a dep) with `refetchInterval: 60_000` for users on the MyDevs window.

**Where status / mood / energy / `[MOVE]` / IDLE come from in the response:**

| Field | DB column | Format | Frontend usage |
|---|---|---|---|
| `dev.status` | `nx.devs.status` (`dev_status_enum`) | `'active' / 'on_mission' / 'resting' / 'frozen' / 'exhausted'` (last two never set — see §4) | Color-coded badge `MyDevs.jsx:1972-1976` |
| `dev.mood` | `nx.devs.mood` (`mood_enum`) | `'neutral' / 'excited' / 'angry' / 'depressed' / 'focused'` (lowercase) | Plain text next to balance, line 1964 |
| `dev.energy` / `dev.max_energy` | `nx.devs.energy` / `max_energy` | int 0..100 | `VitalBar`, line 2003 |
| `dev.is_idle` | **computed at API read-time** as `(energy or 0) <= 0` (`devs.py:79, 249, 271`) | bool | Grayscale on whole card + `💤 IDLE` badge, lines 1801, 1965 |
| `dev.last_action_type` | `nx.devs.last_action_type` (`action_enum`) | snake-case `'CREATE_AI'`, `'MOVE'`, `'CHAT'`, `'REST'`, … | `[CREATE AI]` indicator at line 2068-2072 |

---

## 3. The `[MOVE]` / `[CREATE AI]` / IDLE indicator

There are **two distinct indicators** that look similar in the screenshots — worth separating.

### 3.1 The bracketed action `[MOVE]` / `[CREATE AI]`

This is **`dev.last_action_type`** (backed by the `last_action_type` column on `nx.devs`, type `action_enum`), printed with underscores replaced by spaces. Rendering at `MyDevs.jsx:2065-2073`:

```jsx
{dev.coffee_count > 0 && <span>caf:{dev.coffee_count}</span>}
{dev.lines_of_code > 0 && <span>LoC:{formatNumber(dev.lines_of_code)}</span>}
{dev.hours_since_sleep > 0 && <span>nosleep:{dev.hours_since_sleep}h</span>}
{dev.last_action_type && (
  <span style={{ color: 'var(--cyan-on-grey, #006677)' }}>
    [{dev.last_action_type.replace(/_/g, ' ')}]
  </span>
)}
```

If `last_action_type` is null (a freshly minted Dev that hasn't ticked yet), the bracket disappears entirely. There is **no "no action" placeholder** — the literal text `[IDLE]` doesn't appear here.

**Source-of-truth value list** — `backend/db/schema.sql:43-47`:

```sql
CREATE TYPE action_enum AS ENUM (
    'CREATE_PROTOCOL', 'CREATE_AI', 'INVEST', 'SELL',
    'MOVE', 'CHAT', 'CODE_REVIEW', 'REST',
    'RECEIVE_SALARY', 'USE_ITEM', 'GET_SABOTAGED', 'DEPLOY'
);
```

Plus runtime additions via `_run_auto_migrations` in `backend/api/main.py:71-76`:

```python
# main.py:71
cur.execute("""
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HACK_MAINFRAME'
                       AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'action_enum'))
        THEN ALTER TYPE action_enum ADD VALUE 'HACK_MAINFRAME'; END IF;
    END $$;
""")
```

The frontend has its own copy of the action set in two consts at `MyDevs.jsx:2148-2189` (`ACTION_ICONS`, `ACTION_COLORS`) used by the **Activity tab** (a different surface) — these include `FUND_DEV` and `TRANSFER` which are not in `action_enum` (they appear to be virtual / synthesised). Worth a follow-up clean-up but outside the UI improvements scope.

### 3.2 The `💤 IDLE` badge

This is the **API-computed `is_idle` flag**, not the action. Rendered at `MyDevs.jsx:1965-1976`:

```jsx
{isIdle ? (
  <span style={{ color: '#6a8aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>
    💤 IDLE
  </span>
) : (
  <span style={{
    color: dev.status === 'active'     ? 'var(--green-on-grey, #005500)' :
           dev.status === 'on_mission' ? '#2d8a2d' :
           dev.status === 'resting'    ? 'var(--amber-on-grey, #7a5500)' :
                                          'var(--red-on-grey, #aa0000)',
    textTransform: 'uppercase', fontWeight: 'bold',
  }}>{dev.status || 'active'}</span>
)}
```

The `else` branch's fallback (`'red-on-grey'`) catches **any** status not in `{active, on_mission, resting}` — so `frozen` and `exhausted` would render red without code change.

**`isIdle` also drives the grayscale-and-dim wrapper** at line 1800:

```jsx
<div style={{
  filter: ((onMission && !missionCompleted) || isIdle) ? 'grayscale(100%)' : 'none',
  opacity: ((onMission && !missionCompleted) || isIdle) ? 0.7 : 1,
}}>
```

So the visual treatment of "low energy" today is: card goes gray, status word becomes `💤 IDLE`. It's a *display* concept, not a persisted one.

**When does `last_action_type` show "IDLE" vs an action name?** It doesn't — there is no "IDLE" value in `action_enum`. The bracket is simply absent if the column is null. The `IDLE` text only appears in the §3.2 status badge, sourced from `is_idle`.

---

## 4. Status transitions in engine

### 4.1 Statuses present in the DB enum

Schema source (`backend/db/schema.sql:39-41`):

```sql
CREATE TYPE dev_status_enum AS ENUM (
    'active', 'resting', 'frozen'
);
```

Runtime additions:

| Value | Where added | Code that writes it |
|---|---|---|
| `'active'` | schema default | INSERT default + missions abandon |
| `'resting'` | schema | **None.** Zero `UPDATE devs SET status = 'resting'` in the codebase. |
| `'frozen'` | schema | **None.** Zero callers. |
| `'on_mission'` | runtime auto-migration (not in schema.sql) — added implicitly because `missions.py:264` does `SET status = 'on_mission'`. The probe results in `phase22-preflight.md` confirm this value is in the live enum. | `backend/api/routes/missions.py:264` (start mission). |
| `'exhausted'` | added in Phase 2.2 by `_run_auto_migrations` (`backend/api/main.py:509-515`) and `backend/db/migration_phase22_canonical.sql:25-39` | **None. Zero call sites set `status = 'exhausted'`.** Verified by full-repo grep. |

### 4.2 The complete inventory of `UPDATE devs SET status = ...`

```
backend/api/routes/missions.py:264 — SET status = 'on_mission'   (mission start)
backend/api/routes/missions.py:452 — SET status = 'active'       (mission abandon)
```

That's it. Two writers. Mission start, mission abandon. Nothing else mutates `status`.

### 4.3 The `'exhausted'` status is plumbed at the schema level only

Phase 2.2 added the enum value because the original brief planned an exhausted-state mechanic that never got built. Evidence:

- `backend/api/main.py:509-515` adds the enum value (auto-migration, runs at startup).
- `backend/db/migration_phase22_canonical.sql:25-39` documents the same.
- `backend/scripts/verify_phase22_preflight.py:78` checks for it.
- **Zero `set status = 'exhausted'`** anywhere in `backend/`.
- **Zero references to `exhausted`** in the frontend at all.

Confirmation grep (every match shown):

```
backend/api/main.py:509:                # NX-PHASE-2.2 Step B: add 'exhausted' to dev_status_enum.
backend/api/main.py:512:                        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'exhausted'
backend/api/main.py:514:                        THEN ALTER TYPE dev_status_enum ADD VALUE 'exhausted'; END IF;
backend/scripts/verify_phase22_preflight.py:78:        "dev_status_enum values (looking for on_mission and exhausted)",
backend/db/migration_phase22_canonical.sql:25,30,37 — DDL, no DML
```

### 4.4 Where energy gets decremented (and incremented)

Sole hourly decay (`backend/engine/engine.py:1047-1050`, inside `pay_salaries`):

```python
# Hourly energy decay: -1 per salary tick. Active devs only —
# on_mission devs keep energy frozen during the mission.
cur.execute("""
    UPDATE devs SET energy = GREATEST(0, energy - 1)
    WHERE status = 'active'
""")
```

Per-action decrements / restorations (all in `engine.py` action handlers):

| File:line | Direction | Trigger |
|---|---|---|
| `engine.py:421` | `-` | `CREATE_PROTOCOL` action |
| `engine.py:449` | `-` | `INVEST` action |
| `engine.py:491` | `-` | `CREATE_AI` action |
| `engine.py:527` | `-` | `SELL` action |
| `engine.py:567` | `-` | `MOVE` action |
| `engine.py:579` | `+` | sleep regeneration |
| `engine.py:636, 642` | `-` | `CODE_REVIEW` action |
| `engine.py:651` | `+` | `REST` action (also resets `hours_since_sleep`) |
| `engine.py:1047` | `-` | hourly salary tick (active only) |
| `api/routes/shop.py:300` | `-` | `fix_bugs` shop item |
| `api/routes/shop.py:326` | `+` | feed items (carrot/pizza/burger) restore energy |

**No call site combines `energy = 0` with `status = 'exhausted'` today** — the transition simply doesn't exist. `is_idle` is computed read-time and never persisted.

### 4.5 What "active → exhausted" needs

The work to wire it is small but has touchpoints:

1. **Engine:** in `pay_salaries` salary tick (`engine.py:1047`), after the energy `GREATEST(0, energy - 1)`, add a follow-up `UPDATE devs SET status = 'exhausted' WHERE status = 'active' AND energy = 0`. Or the more conservative "demote on the same row" via a single UPDATE with conditional CASE.
2. **Engine action handlers:** any energy `+` site (sleep, REST, food shop items at `shop.py:326`) needs a companion `… AND CASE WHEN status='exhausted' AND energy > 0 THEN status='active' END` (or wrap in two statements). Otherwise an exhausted Dev fed coffee stays in `'exhausted'` despite having energy again.
3. **Engine tick scheduler:** `process_dev` (`engine.py:886`) and the `WHERE status = 'active'` filter at multiple sites either need to expand to `IN ('active', 'on_mission')` or stay narrow (intentional that exhausted Devs don't tick).
4. **Frontend:** the existing "else" branch at `MyDevs.jsx:1973` already paints `exhausted` red without code change. New copy ("EXHAUSTED" instead of letting `dev.status` upper-case render) is a one-line CSS string. The grayscale wrapper currently keys on `is_idle` — likely want to also key on `status === 'exhausted'` so the dim treatment matches.

Open question: **should `is_idle` and `status === 'exhausted'` always agree?** If yes, drop one — almost certainly drop `is_idle` and read `status` directly. If no (e.g., `is_idle` is the ephemeral "energy=0 right now" and `status='exhausted'` only triggers after the next salary tick observes it), they need to stay separate but the frontend must compose them.

---

## 5. Existing CSS / animation patterns

### 5.1 Keyframes already defined (`frontend/src/App.css`)

| `@keyframes` | Line | What | Used by |
|---|---|---|---|
| `flashIn` | 246 | opacity flash | `.flash-in` (notifications) |
| `blink` | 677 | `1↔0.5` opacity, 1s | DOS cursor, prompt cursor (`HireDevs.jsx`, `BSOD.jsx`) |
| `critical-pulse` | 682 | `1↔0.5` opacity, 1.5s | **`VitalBar` when stat is critical (`pct < 15` for normal, `pct > 75` for inverse)** — `MyDevs.jsx:1330` |
| `mission-pulse` | 686 | `1↔0.3` opacity, 2s | "⏳ ON MISSION" overlay text — `MyDevs.jsx:2107` |
| `notifSlideUp` / `notifSlideDown` | 690-696 | Y-translate | toast notifications, `Desktop.jsx:119` |
| `float-up-fade` | 710 | the `+5 $NXT` floating-number animation | `MyDevs.jsx:1721`, `Desktop.jsx:37` |
| `bootFadeOut` | 722 | full-screen fade | boot screen |
| `welcomeLoad` | 779 | welcome text fade | welcome modal |
| `assistantBounceIn` | 990 | clippy entrance | clippy assistant |
| **`streakGlow`** | 1235 | `text-shadow` 4→12px goldglow, 1.5s alternate | `.streak-flair` (login streak banner). **This is the reusable glow primitive for the new low-energy button effect.** |
| `contestedPulse` | 1435 | dashed border color flicker, 2s | `.territory-cell.contested` |

There's also one inline `@keyframes` in JSX:

| Where | What |
|---|---|
| `frontend/src/windows/HireDevs.jsx:23-29` | `nxFlyFile` (dev file flying around) and `nxProgressStripe` |

**Recommendation:** add a new `@keyframes` to `App.css` (e.g., `low-energy-glow` mirroring `streakGlow` but with red `#ff4444` `box-shadow` instead of gold `text-shadow`), apply it conditionally on `StoneBtn` when the parent Dev row hits the threshold. Don't put the keyframe inline in `MyDevs.jsx`.

### 5.2 Color palette — defined in `frontend/src/index.css:5-50`

```css
:root, [data-theme="classic"] {
  --bg-desktop:     #008080;   /* win98 teal */
  --win-bg:         #c0c0c0;
  --terminal-bg:    #0c0c0c;
  --terminal-green: #33ff33;
  --terminal-amber: #ffaa00;
  --terminal-red:   #ff4444;
  --terminal-cyan:  #00ffff;
  --terminal-magenta:#ff44ff;
  --gold:           #ffd700;
  /* "on-grey" variants for contrast against #c0c0c0 win98 panels: */
  --gold-on-grey:   #7a5c00;
  --green-on-grey:  #005500;
  --cyan-on-grey:   #005060;
  --pink-on-grey:   #660066;
  --amber-on-grey:  #7a5500;
  --red-on-grey:    #aa0000;
  --common-on-grey: #333333;
  --blue-on-grey:   #0d47a1;
  --text-primary:   #000000;
  --text-secondary: #444444;
  --text-muted:     #555555;
}
```

**Status color mapping in current code** (`MyDevs.jsx:1973`):

| Status | Color |
|---|---|
| `active` | `var(--green-on-grey, #005500)` |
| `on_mission` | `#2d8a2d` |
| `resting` | `var(--amber-on-grey, #7a5500)` |
| else (`frozen`, `exhausted`, anything unknown) | `var(--red-on-grey, #aa0000)` |

**Energy bar color thresholds** (`MyDevs.jsx:1278-1289`, `barColor()`):

| Pct | Color |
|---|---|
| `≥ 70` | `#44ff44` (bright green) |
| `40-69` | `#ffaa00` (amber) |
| `15-39` | `#ff4444` (red) |
| `< 15` | `#cc0000` (dark red) |

`critical = pct < 15` triggers `critical-pulse` on the bar fill (`MyDevs.jsx:1330`).

### 5.3 Theme module

**There is no centralised theme/colors.ts file.** Source of truth for colors is `:root` CSS variables in `index.css`. Component-local color choices (per-archetype, per-action, per-status) are inline `var(--…)` references with fallback hexcodes. Suggest **not** introducing a new theme file just for this iteration — extend the CSS variables in `index.css` if a new palette entry is needed (e.g., `--exhausted: #aa0000` with semantic naming).

### 5.4 The "red flag near LYNX-X0's name"

I couldn't reproduce this exactly from the code paths I read — there are several candidates:

- `dev._fetchFailed` triggers an amber `[!] Profile loading from chain...` row at `MyDevs.jsx:1817-1828`. Color is `var(--terminal-amber, #ffaa00)`.
- `dev.training_course` triggers a `[TRAIN]` row at `MyDevs.jsx:2017` colored `#b8860b` (dark gold).
- A bug count > 0 may render `FIX:N` on the FIX button (`MyDevs.jsx:2042`) but that's a button label, not a flag near the name.

If the user is seeing a literal red emoji 🚩 next to LYNX-X0, it's not coming from `MyDevs.jsx` source as committed in `origin/main`. **Open question — confirm with screenshot.**

---

## 6. Action button states

All six per-Dev action buttons live in the row at `MyDevs.jsx:2031-2049`:

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', … }}>
  <StoneBtn emoji="☕" label="COFFEE"
    onClick={(e) => doShopAction(e, 'coffee', 'Coffee')}
    disabled={busy}
    title="Coffee: 3 $NXT → +25 Caffeine" />
  <FeedDropdown dev={dev} busy={busy} onBuy={doShopAction} />
  <HackDropdown dev={dev} busy={busy} onHackMainframe={doHackMainframe} onHackPlayer={doHackPlayer} />
  <StoneBtn emoji="🔧" label={bugsVal > 0 ? `FIX:${bugsVal}` : 'FIX'}
    onClick={doFixBug} disabled={busy || bugsVal <= 0}
    title={bugsVal > 0 ? `Fix Bugs: 5 Energy → -8 Bugs, +3 Knowledge (${bugsVal} bugs)` : 'No bugs to fix'} />
  <StoneBtn emoji="🖥️" label="REPAIR"
    onClick={(e) => doShopAction(e, 'pc_repair', 'PC Repair')}
    disabled={busy || pcHealth >= 100}
    title={pcHealth >= 100 ? "PC is healthy" : `PC Repair: 8 $NXT → 100% (${pcHealth}%)`} />
  <EconDropdown dev={dev} allDevs={allDevs} busy={busy}
    onFund={…} onTransfer={…} onRequest={…} />
</div>
```

The whole row is conditionally rendered: `{address && !dev._fetchFailed && !onMission && (…)}` at line 2032. **On-mission Devs hide the buttons entirely** (the overlay at line 2095 covers the card with "⏳ ON MISSION").

### 6.1 Per-button enable/disable rules

| Button | Disabled when | Visual treatment |
|---|---|---|
| `COFFEE` | `busy` | StoneBtn disabled state (gray bg, opacity 0.5) |
| `FEED ▾` | `busy` | StoneBtn disabled state — but **food items inside the dropdown** are individually disabled if `dev.balance_nxt < f.cost` (line 1474). |
| `HACK ▾` | `busy` | (full body in `HackDropdown` — same pattern as FEED, sub-items have their own gating) |
| `FIX` | `busy ‖ bugsVal <= 0` | StoneBtn disabled. Label dynamically reflects bugs: `FIX:N` when bugs exist, `FIX` when none. |
| `REPAIR` | `busy ‖ pcHealth >= 100` | StoneBtn disabled. Title text changes to `"PC is healthy"`. |
| `ECONOMY ▾` | `busy` | StoneBtn disabled. Submenu has its own gating (e.g., "From dev" balance check). |

Notably **none of them gate on `dev.energy`** today. So a Dev with `energy=0` can still spend energy on FIX (which costs 5 energy) — backend will reject, frontend will surface the error via `actionMsg` (line 2052-2057).

### 6.2 Conditional styling that already exists

Two precedents for state-aware buttons:

1. **FIX label changes** when `bugsVal > 0`: `label={bugsVal > 0 ? \`FIX:${bugsVal}\` : 'FIX'}`. Visual cue is just the colon-suffix count.
2. **`StatBar` `critical-pulse` animation** when stat is below threshold (energy < 15%, pc_health < 15%, …). Pattern at `MyDevs.jsx:1330`. This is the closest existing precedent for "when state X is critical, animate something". We can mirror it for buttons.

### 6.3 Where the new "low-energy glow" should hook in

A clean implementation:

- Compute a flag at the top of `DevCard` (next to `energyHigh`, line 1735): `const lowEnergy = energyPct < 15;` (or `energy < 5` if you prefer absolute, since max is 10 in the schema default but actually 100 in production after Phase 2.2).
- Pass `lowEnergy` (or a new `pulse` prop) into `StoneBtn` and the dropdown wrappers.
- `StoneBtn` adds `animation: pulse ? 'low-energy-glow 1.5s ease-in-out infinite' : 'none'` to its style block. New keyframe goes in `App.css` near `streakGlow`.
- COFFEE and FEED buttons get `pulse={lowEnergy && !disabled}` so the call-to-action (refill energy) glows; the others stay calm.

There is **no existing pulse/glow on buttons** today. The closest thing is the on-mission text ("⏳ ON MISSION") that uses `mission-pulse` — pure opacity, no shadow.

---

## 7. Open questions / ambiguities

1. **The 🚩 red flag near LYNX-X0's name.** Couldn't find a code path that paints a red flag in the row's title area. Possible sources I can think of: a browser-native emoji, a custom theme variant outside `[data-theme="classic"]`, or content from `dev.last_message`. **Need a screenshot or DOM inspector dump to localise.**
2. **Threshold for "low energy" UI.** `is_idle` triggers at `energy <= 0` exactly. The `VitalBar` `critical-pulse` triggers at `pct < 15`. **Pick one threshold for the new button glow and align both** — likely `energy <= 1` (last tick before exhausted) is more useful as a "fix me before I'm exhausted" warning.
3. **`is_idle` vs `status='exhausted'` semantics.** Should they always agree, or is `is_idle` the live "energy=0 right now" while `exhausted` only triggers when the salary tick observes it (so an exhausted Dev fed coffee instantly might be `is_idle=false` but `status='exhausted'` until the next tick)? The spec says "active → exhausted when energy hits 0" — a strict interpretation removes the lag but introduces a coupled write to every energy decrement site. Worth clarifying.
4. **Recovery transition.** Spec says the transition is "active → exhausted when energy hits 0". It doesn't specify the inverse. Two options: (a) **on energy gain**, immediately demote `exhausted → active`; (b) **only on a salary tick** check `WHERE status='exhausted' AND energy > 0` and demote. (a) is more responsive; (b) is single-point-of-mutation cleaner.
5. **Polling vs. WebSocket.** The brief mentions the new UI improvements and a backend status transition but not a refresh strategy. Without polling, a user staring at a Dev's row won't see the glow appear when the salary tick demotes them. Add a 60s `setInterval(refreshDevs)` while MyDevs is open?
6. **`action_enum` values used by frontend that don't exist in backend.** `ACTION_ICONS` at `MyDevs.jsx:2148` includes `FUND_DEV` and `TRANSFER`, neither in the SQL `action_enum`. Either virtual / synthesised on the activity API side or dead code. **Worth confirming before any UI rework that touches that table.**
7. **`'resting'` and `'frozen'` enum values are dead.** Zero writers. Worth a follow-up cleanup migration to drop them, or accept them as latent values for future mechanics.

---

## 8. Files referenced in this audit

```
backend/api/main.py:71-83, 509-515            # auto-migrations adding HACK_MAINFRAME, GitHub HQ, exhausted
backend/api/routes/devs.py:79, 249, 271       # is_idle = energy <= 0
backend/api/routes/missions.py:264, 452       # only writers of nx.devs.status
backend/db/schema.sql:39-47, 130              # dev_status_enum, action_enum, devs.status default
backend/db/migration_phase22_canonical.sql:25-39  # exhausted enum addition (DDL only)
backend/engine/engine.py:1047, 421-651        # energy decay/restore sites
backend/scripts/verify_phase22_preflight.py:78    # probe for exhausted / on_mission
frontend/src/contexts/DevsContext.jsx:15, 37, 122, 176, 184  # 5min STALE_TIME, no polling, refresh event
frontend/src/services/api.js:37               # api.getDev
frontend/src/index.css:5-50                   # color palette
frontend/src/App.css:677, 682, 686, 1235      # blink, critical-pulse, mission-pulse, streakGlow
frontend/src/windows/MyDevs.jsx:1278-1335     # VitalBar + barColor + critical-pulse usage
frontend/src/windows/MyDevs.jsx:1338-1368     # StoneBtn (current disabled visual)
frontend/src/windows/MyDevs.jsx:1731-2142     # DevCard
frontend/src/windows/MyDevs.jsx:1965-1976     # status / IDLE badge
frontend/src/windows/MyDevs.jsx:2031-2049     # the 6 action buttons
frontend/src/windows/MyDevs.jsx:2065-2073     # caf / LoC / nosleep / [last_action] footer
```

---

## 9. Recommendations (TL;DR for the next round)

1. **Wire `'active' → 'exhausted'` in `pay_salaries`** at `backend/engine/engine.py:1047` with a single conditional UPDATE (or a follow-up UPDATE constrained to `energy = 0 AND status = 'active'`).
2. **Wire `'exhausted' → 'active'` on energy restore.** Cleanest single point: a CASE on `engine.py:579` (sleep regen), `engine.py:651` (REST action), and `api/routes/shop.py:326` (food items). Or wrap in a small helper `restore_energy(cur, token_id, delta)` that all three call.
3. **Decide `is_idle` vs `status === 'exhausted'`** before the frontend changes — keeping both is a maintenance liability.
4. **Add a `low-energy-glow` keyframe** in `App.css` near `streakGlow` (~line 1235), and pulse the COFFEE + FEED buttons when `dev.energy <= 1 && dev.status !== 'on_mission'`. Reuse `--terminal-red` or define `--low-energy: #ff4444` next to existing palette entries.
5. **Add a 60s polling loop** to `DevsContext` (or migrate `useDevs` to React Query with `refetchInterval`) so users actually see the new state without manual refresh.
6. **Update the status color map** at `MyDevs.jsx:1973` to include an explicit branch for `'exhausted'` rather than letting it fall through to the `else` red. Same color is fine; explicit is better for grep-ability.

Halt — no code changes in this branch beyond this report.
