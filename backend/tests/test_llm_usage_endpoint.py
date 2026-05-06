"""Tests for backend.api.routes.llm_usage admin endpoints.

DB is stubbed at the route module's `get_db` import site so the
shape contract is pinned without a live Postgres."""

from __future__ import annotations

import sys
from contextlib import contextmanager
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api.routes import llm_usage as route  # noqa: E402
from backend.services import llm_cost  # noqa: E402


@pytest.fixture
def app():
    fastapi_app = FastAPI()
    fastapi_app.include_router(route.router, prefix="/api/admin/llm-usage")
    return TestClient(fastapi_app)


@contextmanager
def _stub_db():
    """Route uses `with get_db() as conn`; we don't need a real
    conn because the helpers are also monkeypatched."""
    yield object()


def test_today_endpoint_returns_summary(app, monkeypatch):
    monkeypatch.setattr(route, "get_db", _stub_db)
    monkeypatch.setattr(
        llm_cost, "get_today_summary",
        lambda conn: {
            "sprkls": {
                "calls": 5, "input_tokens": 5000, "output_tokens": 2500,
                "cost": 0.10, "limit": 0.50, "under_limit": True,
            },
        },
    )
    resp = app.get("/api/admin/llm-usage/today")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["today"]["sprkls"]["calls"] == 5
    assert body["today"]["sprkls"]["under_limit"] is True


def test_today_endpoint_503_on_db_error(app, monkeypatch):
    """A failing get_today_summary surfaces as 503 — the admin UI
    can show a degraded state without exposing internals."""
    monkeypatch.setattr(route, "get_db", _stub_db)
    def boom(conn):
        raise RuntimeError("db down")
    monkeypatch.setattr(llm_cost, "get_today_summary", boom)
    resp = app.get("/api/admin/llm-usage/today")
    assert resp.status_code == 503


def test_history_endpoint_returns_rows(app, monkeypatch):
    monkeypatch.setattr(route, "get_db", _stub_db)
    monkeypatch.setattr(
        llm_cost, "get_recent_usage",
        lambda conn, days: [
            {
                "date": "2026-05-05",
                "service": "sprkls",
                "model":   "anthropic/claude-haiku-4.5",
                "calls":   3,
                "input_tokens":       300,
                "output_tokens":      150,
                "estimated_cost_usd": 0.001,
                "last_call_at":       "2026-05-05T12:00:00+00:00",
            },
        ],
    )
    resp = app.get("/api/admin/llm-usage?days=3")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert len(body["usage"]) == 1
    assert body["usage"][0]["service"] == "sprkls"
    assert body["usage"][0]["calls"] == 3


def test_history_endpoint_validates_days_range(app, monkeypatch):
    """Query validator on the route caps `days` at 30."""
    monkeypatch.setattr(route, "get_db", _stub_db)
    monkeypatch.setattr(llm_cost, "get_recent_usage", lambda conn, days: [])
    resp = app.get("/api/admin/llm-usage?days=999")
    assert resp.status_code == 422
    resp_zero = app.get("/api/admin/llm-usage?days=0")
    assert resp_zero.status_code == 422
