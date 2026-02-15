"""WebSocket: Live feed of simulation events"""

import json
import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.api.deps import ws_clients, get_redis

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
        # Also subscribe to Redis pub/sub for multi-instance
        r = get_redis()
        if r:
            pubsub = r.pubsub()
            await pubsub.subscribe("nx:events")

            # Listen for both client messages and Redis events
            async def redis_listener():
                try:
                    async for msg in pubsub.listen():
                        if msg["type"] == "message":
                            await ws.send_text(msg["data"])
                except Exception:
                    pass

            task = asyncio.create_task(redis_listener())
            try:
                while True:
                    # Keep connection alive, handle client pings
                    data = await ws.receive_text()
                    if data == "ping":
                        await ws.send_text(json.dumps({"type": "pong"}))
            finally:
                task.cancel()
                await pubsub.unsubscribe("nx:events")
        else:
            # No Redis — just keep connection alive
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
