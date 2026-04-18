"""Tests for the correlation ID middleware and structured-logging helper.

Covers:
- A request without ``X-Correlation-ID`` gets a fresh UUID echoed back.
- An inbound ``X-Correlation-ID`` is propagated verbatim in the response.
- Concurrent requests keep their correlation ids isolated.
- ``log_event`` inside a handler picks up the current correlation id.
"""

from __future__ import annotations

import logging
import re
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api.middleware.correlation import (  # noqa: E402
    CorrelationIdMiddleware,
    HEADER_NAME,
    get_correlation_id,
)
from backend.services.logging_helpers import log_info  # noqa: E402


UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


@pytest.fixture()
def app_and_captures():
    """FastAPI app with the middleware, plus a log capture and cid capture."""
    app = FastAPI()
    app.add_middleware(CorrelationIdMiddleware)

    logger = logging.getLogger("nx.test.correlation")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    captured_records: list[str] = []

    class ListHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:  # noqa: D401
            captured_records.append(self.format(record))

    handler = ListHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)

    observed_cids: list[str] = []

    @app.get("/ping")
    def ping():
        observed_cids.append(get_correlation_id())
        log_info(logger, "ping.handled", hello="world")
        return {"ok": True, "correlation_id": get_correlation_id()}

    try:
        yield app, observed_cids, captured_records
    finally:
        logger.removeHandler(handler)


def test_generates_correlation_id_when_header_absent(app_and_captures):
    app, observed, _ = app_and_captures
    client = TestClient(app)

    resp = client.get("/ping")

    assert resp.status_code == 200
    cid = resp.headers.get(HEADER_NAME)
    assert cid, "response must expose correlation id header"
    assert UUID_RE.match(cid), f"expected a UUID, got {cid!r}"
    assert observed == [cid]
    assert resp.json()["correlation_id"] == cid


def test_propagates_inbound_correlation_id(app_and_captures):
    app, observed, _ = app_and_captures
    client = TestClient(app)
    inbound = "trace-abc-123"

    resp = client.get("/ping", headers={HEADER_NAME: inbound})

    assert resp.headers[HEADER_NAME] == inbound
    assert observed == [inbound]
    assert resp.json()["correlation_id"] == inbound


def test_concurrent_requests_have_distinct_correlation_ids(app_and_captures):
    app, observed, _ = app_and_captures
    client = TestClient(app)

    def hit(i: int) -> str:
        resp = client.get("/ping", headers={HEADER_NAME: f"req-{i}"})
        assert resp.status_code == 200
        return resp.headers[HEADER_NAME]

    with ThreadPoolExecutor(max_workers=4) as pool:
        ids = list(pool.map(hit, range(8)))

    assert sorted(ids) == [f"req-{i}" for i in range(8)]
    # Every observed cid in the handler matches the inbound header.
    assert set(observed) == set(ids)


def test_log_event_includes_correlation_id_in_message(app_and_captures):
    app, _, records = app_and_captures
    client = TestClient(app)

    resp = client.get("/ping", headers={HEADER_NAME: "trace-xyz"})
    assert resp.status_code == 200

    assert records, "log handler captured nothing"
    last = records[-1]
    assert last.startswith("ping.handled ")
    assert "hello=world" in last
    assert "correlation_id=trace-xyz" in last


def test_get_correlation_id_default_outside_request():
    # No request is active in this test's main thread.
    assert get_correlation_id() == "no-correlation"
