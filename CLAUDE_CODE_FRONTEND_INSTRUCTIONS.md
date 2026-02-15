# NX TERMINAL: Protocol Wars — Frontend Build Instructions for Claude Code

## CONTEXT

NX Terminal is a blockchain simulation game where 35,000 AI developer NFTs act autonomously.
The backend API is already live at: https://nx-terminal.onrender.com
The repo is at: C:\nx-terminal\nx-terminal (GitHub: https://github.com/nxterminal/nx-terminal)

The frontend needs to be built inside the existing repo at `frontend/` directory.

## OBJECTIVE

Build a React + Vite frontend with Windows 98 aesthetic. The app connects to the live API
and displays the simulation in real-time via REST endpoints and WebSocket.

## TECH STACK

- React 18 + Vite
- Tailwind CSS (for layout utilities only, all Win98 styling is custom CSS)
- React Router for navigation
- Native WebSocket for live feed
- wagmi + viem for wallet connection (prepare for future, not critical now)

## API BASE URL

Production: https://nx-terminal.onrender.com
Local dev: http://localhost:8000

Use environment variable VITE_API_URL, default to production.

## AVAILABLE API ENDPOINTS

```
GET  /health
GET  /api/simulation/state        → { simulation_status, current_cycle, total_devs_minted, ... }
GET  /api/simulation/stats        → { total_devs, active_devs, total_nxt_in_wallets, ... }
GET  /api/simulation/feed?limit=50 → [{ dev_name, archetype, action_type, details, created_at }]
GET  /api/simulation/events       → [{ title, description, event_type, is_active }]
GET  /api/devs?limit=20&sort=balance → [{ token_id, name, archetype, corporation, energy, mood, location, balance_nxt, ... }]
GET  /api/devs/count              → { total }
GET  /api/devs/{id}               → full dev profile
GET  /api/devs/{id}/metadata      → NFT metadata (OpenSea format)
GET  /api/devs/{id}/history       → [{ action_type, details, created_at }]
GET  /api/devs/{id}/protocols     → protocols created by dev
GET  /api/devs/{id}/investments   → dev's investments
GET  /api/devs/{id}/ais           → absurd AIs created by dev
GET  /api/devs/{id}/messages      → chat messages from dev
GET  /api/protocols?sort=value    → [{ name, description, code_quality, value, investor_count, creator_name }]
GET  /api/protocols/{id}          → protocol detail + investors
GET  /api/ais                     → [{ name, description, vote_count, creator_name }]
GET  /api/leaderboard?sort=balance → [{ token_id, name, archetype, balance_nxt, reputation, rank_balance }]
GET  /api/leaderboard/corporations → [{ corporation, total_devs, total_balance }]
GET  /api/chat/devs?channel=trollbox → [{ dev_name, archetype, message, created_at }]
GET  /api/chat/world              → [{ display_name, message, created_at }]
GET  /api/shop                    → [{ id, name, description, cost_nxt }]
GET  /api/players/{wallet}        → player profile + devs
WS   /ws/feed                     → live events: { type: "action"|"chat"|"event"|"mint", data: {...} }
```

## WINDOWS 98 DESIGN SYSTEM

### Core Visual Rules
- Background: teal (#008080) desktop
- Windows: gray (#c0c0c0) with 3D beveled borders (outset/inset)
- Title bars: blue gradient (#000080 to #1084d0)
- Font: "Tahoma", "MS Sans Serif", sans-serif at 11px base
- Terminal/code text: "Courier New", monospace with green (#33ff33) on black (#0c0c0c)
- Buttons: gray with outset border, inset on :active
- No rounded corners anywhere. Everything is sharp rectangles.
- Scrollbars should look like Win98 (gray with arrows)
- Window close/minimize/maximize buttons in title bar

### Color Palette
```css
--bg-desktop: #008080;      /* Teal desktop */
--win-bg: #c0c0c0;          /* Window background */
--win-title-l: #000080;     /* Title bar gradient left */
--win-title-r: #1084d0;     /* Title bar gradient right */
--border-light: #ffffff;    /* 3D border highlight */
--border-dark: #808080;     /* 3D border shadow */
--border-darker: #404040;   /* 3D border deep shadow */
--selection: #000080;       /* Selected item bg */
--selection-text: #ffffff;  /* Selected item text */
--terminal-bg: #0c0c0c;    /* Terminal background */
--terminal-green: #33ff33;  /* Terminal text */
--terminal-amber: #ffaa00;  /* Warnings */
--terminal-red: #ff4444;    /* Errors */
--terminal-cyan: #00ffff;   /* Info */
--terminal-magenta: #ff44ff; /* Special */
--gold: #ffd700;            /* Rankings, special */
```

### Window Component Structure
Every "app" is a draggable window with:
- Title bar (blue gradient, icon, title text, minimize/maximize/close buttons)
- Menu bar (optional: File, View, Help)
- Content area (gray or terminal black)
- Status bar at bottom (optional)

### Archetype Colors (for badges/labels)
```
10X_DEV:      #ff4444 (red)
LURKER:       #808080 (gray)
DEGEN:        #ffd700 (gold)
GRINDER:      #4488ff (blue)
INFLUENCER:   #ff44ff (magenta)
HACKTIVIST:   #33ff33 (green)
FED:          #ffaa00 (amber)
SCRIPT_KIDDIE: #00ffff (cyan)
```

### Rarity Colors
```
common:    #c0c0c0 (silver)
uncommon:  #33ff33 (green)
rare:      #4488ff (blue)
legendary: #ffd700 (gold)
mythic:    #ff44ff (magenta)
```

## PAGE/WINDOW STRUCTURE

### 1. Boot Screen (shown on first load, 3-4 seconds)
- Black screen
- "NX TERMINAL" in gold pixel font
- "PROTOCOL WARS" in red below
- Fake loading bar
- "Click anywhere to continue" after load completes
- After click → desktop loads

### 2. Desktop (main layout)
- Teal background
- Desktop icons (double-click to open windows):
  - "Action Feed" (live feed icon)
  - "Leaderboard" (trophy icon)
  - "Protocol Market" (chart icon)
  - "AI Lab" (brain icon)
  - "Dev Chat" (chat icon)
  - "My Devs" (folder icon)
  - "Shop" (shopping bag icon)
  - "World Chat" (globe icon)
- Taskbar at bottom:
  - "Start" button (left)
  - Open window buttons (middle)
  - Clock showing simulation cycle (right)

### 3. Action Feed Window (default open on load)
- Terminal-style (green on black)
- Auto-scrolling feed of actions from /api/simulation/feed
- Connect to WebSocket /ws/feed for live updates
- Each action shows: [TIMESTAMP] ICON DEV_NAME (ARCHETYPE) → ACTION_TYPE "details"
- Color-code by archetype
- Scroll lock toggle button

### 4. Leaderboard Window
- Table with columns: Rank, Name, Archetype, Corporation, Balance, Reputation
- Tabs: "By Balance" | "By Reputation" | "Corporations"
- Click on a dev → opens Dev Profile window
- Auto-refresh every 30 seconds
- Data from /api/leaderboard

### 5. Protocol Market Window
- Table: Name, Creator, Quality, Value, Investors
- Sort by: Value, Quality, Recent, Investors
- Click on protocol → detail view with investor list
- Data from /api/protocols

### 6. AI Lab Window
- Ranked list of absurd AIs
- Shows: Rank, Name, Description, Votes, Creator
- Fun display — these are intentionally stupid AIs
- Data from /api/ais

### 7. Dev Chat Window (AI trollbox)
- Terminal-style display
- Shows messages from AI devs
- Each message: [TIME] DEV_NAME (ARCHETYPE): message
- Color by archetype
- Filter tabs: "Trollbox" | by location
- Data from /api/chat/devs

### 8. Dev Profile Window (opens when clicking a dev)
- Header: Name, Archetype badge, Corporation, Rarity
- Stats grid: Energy bar, Balance, Reputation, Mood, Location
- Tabs: "History" | "Protocols" | "AIs" | "Investments" | "Messages"
- History tab shows action log (terminal-style)
- Data from /api/devs/{id} + sub-endpoints

### 9. My Devs Window
- List of devs owned by connected wallet
- If no wallet → show "Connect Wallet" message
- For now, show ALL devs as placeholder (no wallet auth yet)
- Each dev shows: name, archetype, energy bar, balance, last action
- Click → opens Dev Profile
- Data from /api/devs

### 10. Shop Window
- Grid of items with pixel-art style cards
- Each card: Icon, Name, Description, Cost in $NXT
- "Buy" button (disabled for now — no wallet)
- Data from /api/shop

### 11. World Chat Window
- Human chat (separate from AI chat)
- Simple message list + input field
- "Connect wallet to chat" placeholder
- Data from /api/chat/world

## COMPONENT HIERARCHY

```
App.jsx
├── BootScreen.jsx
├── Desktop.jsx
│   ├── DesktopIcon.jsx (reusable)
│   ├── Taskbar.jsx
│   │   ├── StartButton.jsx
│   │   ├── TaskbarButton.jsx (per open window)
│   │   └── TaskbarClock.jsx
│   └── WindowManager.jsx
│       └── Window.jsx (reusable draggable window)
│           ├── TitleBar.jsx
│           └── [content component]
├── windows/
│   ├── ActionFeed.jsx
│   ├── Leaderboard.jsx
│   ├── ProtocolMarket.jsx
│   ├── AILab.jsx
│   ├── DevChat.jsx
│   ├── DevProfile.jsx
│   ├── MyDevs.jsx
│   ├── Shop.jsx
│   └── WorldChat.jsx
├── hooks/
│   ├── useAPI.js          (fetch wrapper with base URL)
│   ├── useWebSocket.js    (WS connection + reconnect)
│   └── useWindowManager.js (open/close/focus/minimize windows)
└── services/
    └── api.js             (all API calls centralized)
```

## WINDOW MANAGER BEHAVIOR

- Multiple windows can be open at once
- Windows are draggable by title bar
- Clicking a window brings it to front (z-index management)
- Minimize → hides window, shows in taskbar
- Close → removes window
- Maximize → fills screen (optional, not critical)
- Double-clicking desktop icon → opens window or focuses if already open
- Default: Action Feed window opens on load

## KEY IMPLEMENTATION DETAILS

### API Service (services/api.js)
```javascript
const API_BASE = import.meta.env.VITE_API_URL || 'https://nx-terminal.onrender.com';
const WS_BASE = API_BASE.replace('https', 'wss').replace('http', 'ws');

export const api = {
  getSimulationState: () => fetch(`${API_BASE}/api/simulation/state`).then(r => r.json()),
  getSimulationStats: () => fetch(`${API_BASE}/api/simulation/stats`).then(r => r.json()),
  getFeed: (limit = 50) => fetch(`${API_BASE}/api/simulation/feed?limit=${limit}`).then(r => r.json()),
  getDevs: (params) => fetch(`${API_BASE}/api/devs?${new URLSearchParams(params)}`).then(r => r.json()),
  getDev: (id) => fetch(`${API_BASE}/api/devs/${id}`).then(r => r.json()),
  getDevHistory: (id) => fetch(`${API_BASE}/api/devs/${id}/history`).then(r => r.json()),
  getProtocols: (params) => fetch(`${API_BASE}/api/protocols?${new URLSearchParams(params)}`).then(r => r.json()),
  getAIs: () => fetch(`${API_BASE}/api/ais`).then(r => r.json()),
  getLeaderboard: (sort) => fetch(`${API_BASE}/api/leaderboard?sort=${sort}`).then(r => r.json()),
  getCorpLeaderboard: () => fetch(`${API_BASE}/api/leaderboard/corporations`).then(r => r.json()),
  getDevChat: (channel) => fetch(`${API_BASE}/api/chat/devs?channel=${channel}`).then(r => r.json()),
  getShop: () => fetch(`${API_BASE}/api/shop`).then(r => r.json()),
  wsUrl: `${WS_BASE}/ws/feed`,
};
```

### WebSocket Hook
- Connect to /ws/feed on mount
- Auto-reconnect on disconnect (exponential backoff)
- Parse incoming JSON messages
- Expose: { messages, connected, send }
- Send "ping" every 30 seconds to keep alive

### Window Manager Hook
- State: array of { id, component, title, icon, position, size, minimized, zIndex }
- Actions: openWindow, closeWindow, focusWindow, minimizeWindow, moveWindow
- Each window type has a unique ID (e.g., "action-feed", "leaderboard")
- Track highest z-index for focus management

## FILE STRUCTURE TO CREATE

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── .env
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css           (Win98 global styles)
│   ├── components/
│   │   ├── BootScreen.jsx
│   │   ├── Desktop.jsx
│   │   ├── DesktopIcon.jsx
│   │   ├── Taskbar.jsx
│   │   ├── Window.jsx
│   │   └── WindowManager.jsx
│   ├── windows/
│   │   ├── ActionFeed.jsx
│   │   ├── Leaderboard.jsx
│   │   ├── ProtocolMarket.jsx
│   │   ├── AILab.jsx
│   │   ├── DevChat.jsx
│   │   ├── DevProfile.jsx
│   │   ├── MyDevs.jsx
│   │   ├── Shop.jsx
│   │   └── WorldChat.jsx
│   ├── hooks/
│   │   ├── useAPI.js
│   │   ├── useWebSocket.js
│   │   └── useWindowManager.js
│   └── services/
│       └── api.js
└── public/
    └── favicon.ico
```

## STEPS FOR CLAUDE CODE

1. Navigate to C:\nx-terminal\nx-terminal
2. Delete existing frontend/index.html (old prototype)
3. Create the Vite + React project in frontend/:
   ```
   cd frontend
   npm create vite@latest . -- --template react
   npm install
   ```
4. Build all components following this spec
5. Test locally with `npm run dev`
6. Verify it connects to https://nx-terminal.onrender.com/api/simulation/feed
7. Commit and push:
   ```
   cd ..
   git add .
   git commit -m "Add React Win98 frontend"
   git push
   ```

## CRITICAL RULES

- NO rounded corners. Ever. This is Windows 98.
- NO modern UI frameworks (no Material UI, no Chakra). Pure custom CSS.
- ALL text in the terminal windows must be monospace green-on-black.
- Buttons must have the classic 3D beveled look (outset border, inset on click).
- Title bars must have the blue gradient.
- The desktop must be teal.
- Keep it lightweight — no heavy dependencies.
- Pixel fonts for headers: use Google Font "Press Start 2P" for game title, "VT323" for terminal.
- Regular UI text uses Tahoma/system font at 11px.
- Action feed should feel alive — auto-scroll, new items appear at top with brief highlight.
- All data comes from the API. No mock data. Use the live endpoints.
