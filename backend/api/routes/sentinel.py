"""Routes: Mega Sentinel — Security Suite for MegaETH"""

import os
import logging
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()
log = logging.getLogger("sentinel")

MEGAETH_RPC = os.getenv("MEGAETH_RPC_URL", "https://carrot.megaeth.com/rpc")
MEGAETH_CHAIN_ID = 4326


@router.get("/health")
async def sentinel_health():
    """Health check for Mega Sentinel."""
    return {"status": "operational", "modules": 5, "version": "1.0", "chain_id": MEGAETH_CHAIN_ID}
