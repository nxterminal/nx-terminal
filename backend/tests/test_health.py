"""Tests for /health and /health/shallow.

Each subsystem check is monkeypatched so the tests are deterministic
and don't reach Postgres or the MegaETH RPC node.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api.routes import health as health_module  # noqa: E402


SIGNER_ADDR = "0x000000000000000000000000000000000000dEaD"


def _healthy_checks():
    return {
        "db": lambda: {"ok": True, "detail": None},
        "signer_key": lambda: {
            "ok": True,
            "detail": None,
            "address": SIGNER_ADDR,
        },
        "rpc": lambda: {"ok": True, "detail": None, "block": 1234},
        "signer_gas": lambda addr: {
            "ok": True,
            "detail": None,
            "balance_wei": 5 * 10**16,
            "balance_eth": "0.050000",
        },
    }


@pytest.fixture()
def app():
    fastapi_app = FastAPI()
    fastapi_app.include_router(health_module.router)
    return fastapi_app


@pytest.fixture()
def client(app):
    return TestClient(app)


class _Controller:
    def __init__(self, monkeypatch):
        self.table = _healthy_checks()
        self._monkeypatch = monkeypatch

    def apply(self):
        self._monkeypatch.setattr(health_module, "_check_db", self.table["db"])
        self._monkeypatch.setattr(health_module, "_check_signer_key", self.table["signer_key"])
        self._monkeypatch.setattr(health_module, "_check_rpc", self.table["rpc"])
        self._monkeypatch.setattr(health_module, "_check_signer_gas", self.table["signer_gas"])


@pytest.fixture()
def patch_checks(monkeypatch):
    """Install the fake check table; tests can override individual keys."""
    return _Controller(monkeypatch)


# ---------------------------------------------------------------------------


def test_all_checks_pass_returns_200_ok_true(client, patch_checks):
    patch_checks.apply()

    resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert set(body["checks"].keys()) == {"db", "signer_key", "rpc", "signer_gas"}
    for name, check in body["checks"].items():
        assert check["ok"] is True, f"{name} should be ok=True"
    assert "warnings" not in body
    assert "critical_failure" not in body


def test_db_failure_returns_503_critical(client, patch_checks):
    patch_checks.table["db"] = lambda: {"ok": False, "detail": "connection refused"}
    patch_checks.apply()

    resp = client.get("/health")

    assert resp.status_code == 503
    body = resp.json()
    assert body["ok"] is False
    assert body["critical_failure"] is True
    assert body["checks"]["db"]["ok"] is False
    assert body["checks"]["db"]["detail"] == "connection refused"


def test_signer_key_invalid_returns_503_critical(client, patch_checks):
    patch_checks.table["signer_key"] = lambda: {
        "ok": False,
        "detail": "invalid_format: bad hex",
    }
    # signer_gas would be skipped in real code; the composition calls
    # _check_signer_gas only if signer_key and rpc both ok.
    patch_checks.apply()

    resp = client.get("/health")

    assert resp.status_code == 503
    body = resp.json()
    assert body["critical_failure"] is True
    assert body["checks"]["signer_key"]["ok"] is False
    assert body["checks"]["signer_gas"]["detail"] == "skipped (signer_key or rpc failed)"


def test_rpc_failure_returns_200_with_warning(client, patch_checks):
    patch_checks.table["rpc"] = lambda: {"ok": False, "detail": "timeout"}
    patch_checks.apply()

    resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "critical_failure" not in body
    assert "rpc" in body["warnings"]
    assert "signer_gas" in body["warnings"]
    assert body["checks"]["signer_gas"]["detail"] == "skipped (signer_key or rpc failed)"


def test_signer_gas_below_minimum_returns_200_with_warning(client, patch_checks):
    patch_checks.table["signer_gas"] = lambda addr: {
        "ok": False,
        "detail": "below_minimum (0.000001 ETH < 0.001000 ETH)",
        "balance_wei": 10**12,
        "balance_eth": "0.000001",
    }
    patch_checks.apply()

    resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "critical_failure" not in body
    assert body["warnings"] == ["signer_gas"]
    assert body["checks"]["signer_gas"]["balance_wei"] == 10**12


def test_response_schema_is_stable(client, patch_checks):
    patch_checks.apply()

    resp = client.get("/health")

    body = resp.json()
    assert set(body.keys()) == {"ok", "checks"}
    for check in body["checks"].values():
        assert "ok" in check
        assert "detail" in check


def test_shallow_always_returns_ok(client):
    resp = client.get("/health/shallow")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
