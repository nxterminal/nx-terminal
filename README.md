# NX TERMINAL: Protocol Wars

35,000 AI developers competing autonomously in a blockchain simulation.
Zero LLM. Weighted random + combinatorial templates. Windows 98 aesthetic.

## Architecture

```
nx-api (FastAPI)  ←→  PostgreSQL  ←→  nx-engine (Worker)
      ↕                                      ↕
  WebSocket                              Redis pub/sub
      ↕
  Frontend (React)  ←→  Blockchain (ERC-721 + ERC-20)
```

## Quick Start (Local)

```bash
# 1. Clone
git clone https://github.com/YOUR_USER/nx-terminal.git
cd nx-terminal

# 2. Install
pip install -r backend/requirements.txt

# 3. Setup PostgreSQL
createdb nxterminal
python -m backend.db.init_db

# 4. Run API
PYTHONPATH=. uvicorn backend.api.main:app --reload --port 8000

# 5. Run Engine (separate terminal)
cd backend/engine && python engine.py
```

API docs: http://localhost:8000/docs

## Deploy to Render

### Option A: Blueprint (recommended)
1. Push repo to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. New → Blueprint → connect your repo
4. Render reads `render.yaml` and creates all services automatically
5. After deploy, initialize DB:
   - Go to nx-api service → Shell
   - Run: `python -m backend.db.init_db`

### Option B: Manual
1. Create PostgreSQL instance on Render
2. Create Web Service → `backend/` → start: `uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT`
3. Create Background Worker → `backend/` → start: `python -m backend.engine.run_engine`
4. Set env vars from `.env.example`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/simulation/state` | Current simulation state |
| GET | `/api/simulation/stats` | Aggregate statistics |
| GET | `/api/simulation/feed` | Recent action feed |
| GET | `/api/simulation/events` | World events |
| GET | `/api/devs` | List devs (filter/sort) |
| GET | `/api/devs/{id}` | Dev profile |
| GET | `/api/devs/{id}/metadata` | NFT metadata (tokenURI) |
| GET | `/api/devs/{id}/history` | Action history |
| GET | `/api/protocols` | Protocol market |
| GET | `/api/protocols/{id}` | Protocol detail |
| GET | `/api/ais` | AI Lab rankings |
| GET | `/api/leaderboard` | Leaderboard |
| GET | `/api/leaderboard/corporations` | Corp rankings |
| POST | `/api/prompts` | Send prompt to dev |
| GET | `/api/chat/devs` | AI dev chat |
| GET | `/api/chat/world` | Human world chat |
| POST | `/api/chat/world` | Post to world chat |
| POST | `/api/players/register` | Register player |
| GET | `/api/players/{wallet}` | Player profile |
| GET | `/api/shop` | Shop items |
| POST | `/api/shop/buy` | Buy item |
| WS | `/ws/feed` | Live event stream |

## Project Structure

```
nx-terminal/
├── backend/
│   ├── api/              # FastAPI server
│   │   ├── main.py       # App entry point
│   │   ├── deps.py       # DB pool, Redis, WebSocket
│   │   ├── routes/       # All REST endpoints
│   │   └── ws/           # WebSocket feed
│   ├── engine/           # Simulation engine
│   │   ├── engine.py     # Core engine (weighted random)
│   │   ├── config.py     # All constants
│   │   ├── templates.py  # Content generation
│   │   └── prompt_system.py  # Player prompt processing
│   └── db/
│       ├── schema.sql    # PostgreSQL schema
│       └── init_db.py    # DB initialization
├── contracts/            # Solidity smart contracts
│   ├── NXDevNFT_v4.sol   # ERC-721 (35,000 devs)
│   └── NXTToken_v3.sol   # ERC-20 ($NXT token)
├── frontend/             # React + Win98 UI
├── render.yaml           # Render Blueprint (IaC)
└── .env.example
```

## Cost

~$21/month on Render (API $7 + Engine $7 + DB $7 + Redis free)

## License

Proprietary — Ember Labs
