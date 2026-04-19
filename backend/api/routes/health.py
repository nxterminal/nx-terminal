"""Deep health check.

Returns 200 only when every critical subsystem is reachable. Returns
503 when a critical dependency is down so Render can auto-restart the
service. Non-critical degradations (transient RPC failures, low signer
gas) surface as ``warnings`` with a still-200 response — restarting
the process doesn't fix those.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse


logger = logging.getLogger(__name__)
router = APIRouter()

# Minimum signer gas for "healthy". Matches the alert threshold used by
# /admin/economy/summary (PR 1.3) so both surfaces agree.
MIN_SIGNER_ETH_WEI = 10**15  # 0.001 ETH

# Short timeout so a dead RPC node can't stall the health probe.
RPC_TIMEOUT_SECONDS = 5.0


def _rpc_call(method: str, params: list) -> Any:
    """Local JSON-RPC helper with a short timeout for probes.

    We intentionally do NOT reuse claim_sync._rpc_call_sync here because
    that helper is tuned for sync latency (15s timeout) — the probe
    needs to fail fast.
    """
    from backend.engine.claim_sync import MEGAETH_RPC  # local import, avoid cycle

    resp = httpx.post(
        MEGAETH_RPC,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=RPC_TIMEOUT_SECONDS,
    )
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"RPC error: {data['error']}")
    return data.get("result")


def _check_db() -> Dict[str, Any]:
    result: Dict[str, Any] = {"ok": False, "detail": None}
    try:
        from backend.api.deps import get_db

        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        result["ok"] = True
    except Exception as exc:  # noqa: BLE001
        result["detail"] = str(exc)[:200]
        logger.error("health.db_check_failed error=%s", exc)
    return result


def _check_signer_key() -> Dict[str, Any]:
    result: Dict[str, Any] = {"ok": False, "detail": None}
    signer_key = os.getenv("BACKEND_SIGNER_PRIVATE_KEY", "")
    if not signer_key:
        result["detail"] = "not_configured"
        return result
    try:
        from eth_account import Account  # local import

        acc = Account.from_key(signer_key)
        result["ok"] = True
        result["address"] = acc.address
    except Exception as exc:  # noqa: BLE001
        result["detail"] = f"invalid_format: {str(exc)[:100]}"
    return result


def _check_rpc() -> Dict[str, Any]:
    result: Dict[str, Any] = {"ok": False, "detail": None}
    try:
        block_hex = _rpc_call("eth_blockNumber", [])
        if block_hex:
            result["ok"] = True
            result["block"] = int(block_hex, 16)
        else:
            result["detail"] = "empty_response"
    except Exception as exc:  # noqa: BLE001
        result["detail"] = str(exc)[:200]
    return result


def _check_signer_gas(signer_address: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {"ok": False, "detail": None}
    try:
        balance_hex = _rpc_call("eth_getBalance", [signer_address, "latest"])
        balance_wei = int(balance_hex, 16)
        result["balance_wei"] = balance_wei
        result["balance_eth"] = f"{balance_wei / 1e18:.6f}"
        if balance_wei >= MIN_SIGNER_ETH_WEI:
            result["ok"] = True
        else:
            result["detail"] = (
                f"below_minimum ({balance_wei / 1e18:.6f} ETH "
                f"< {MIN_SIGNER_ETH_WEI / 1e18:.6f} ETH)"
            )
    except Exception as exc:  # noqa: BLE001
        result["detail"] = str(exc)[:200]
    return result


@router.get("/health")
async def health_check():
    """Deep health probe. See backend/docs/HEALTH_CHECK.md for the contract."""
    checks: Dict[str, Dict[str, Any]] = {
        "db": _check_db(),
        "signer_key": _check_signer_key(),
        "rpc": _check_rpc(),
        "signer_gas": {"ok": False, "detail": None},
    }

    if checks["signer_key"]["ok"] and checks["rpc"]["ok"]:
        checks["signer_gas"] = _check_signer_gas(checks["signer_key"]["address"])
    else:
        checks["signer_gas"]["detail"] = "skipped (signer_key or rpc failed)"

    # Critical checks gate the 503. RPC + gas are warnings only:
    #  - RPC failures are often transient; restart doesn't help.
    #  - Low gas needs a human to refill the signer, not a process bounce.
    critical_ok = checks["db"]["ok"] and checks["signer_key"]["ok"]
    all_ok = all(c["ok"] for c in checks.values())

    if not critical_ok:
        logger.error("health.critical_failure checks=%s", checks)
        return JSONResponse(
            status_code=503,
            content={"ok": False, "critical_failure": True, "checks": checks},
        )

    body: Dict[str, Any] = {"ok": all_ok, "checks": checks}
    if not all_ok:
        warnings: List[str] = [k for k, v in checks.items() if not v["ok"]]
        body["warnings"] = warnings
    return body


@router.get("/health/shallow")
async def health_shallow():
    """Cheap liveness check. Preserves the contract of the old /health."""
    return {"ok": True}
