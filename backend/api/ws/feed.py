"""WebSocket: Live feed of simulation events.

Phase 5.5.1 — Redis pub/sub branch removed after PR #391 dropped the
Redis dependency. The pre-migration code subscribed to `nx:events`
on Redis to receive broadcasts from other uvicorn workers; the
existing `else: # No Redis — just keep connection alive` fallback
was the only path that ever executed in production because Redis
was never provisioned on Render. Production WS fanout has always
been local-worker-only via `deps.ws_clients`.

If we ever scale to multi-worker WS with a real need for cross-worker
fanout, replace the dropped branch with Postgres `LISTEN/NOTIFY` —
not in scope here.
"""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.api.deps import ws_clients

router = APIRouter()
log = logging.getLogger("nx_ws")


@router.websocket("/ws/feed")
async def websocket_feed(ws: WebSocket):
    """
    Live event feed via WebSocket.

    Events pushed to clients:
    - action: A dev performed an action
    - chat: A dev posted a chat message
    - event: World event started/ended
    - mint: A new dev was minted
    - prompt_response: A dev responded to a player's prompt
    """
    await ws.accept()
    ws_clients.add(ws)
    log.info(f"WS client connected ({len(ws_clients)} total)")

    try:
        # Keep the connection alive; handle client pings. Fanout to
        # this socket happens via `deps.broadcast(...)` writing to
        # every member of `ws_clients` directly (single-worker
        # fanout — see module docstring).
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.warning(f"WS error: {e}")
    finally:
        ws_clients.discard(ws)
        log.info(f"WS client disconnected ({len(ws_clients)} total)")
