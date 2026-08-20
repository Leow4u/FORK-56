"""Auto-compaction status re-tagging for the desktop "Summarizing…" indicator.

Auto-compaction reaches the gateway as a generic ``lifecycle`` status. The
gateway re-tags it as ``kind="compacting"`` so drivers (the desktop app) can
show an explicit summarizing indicator instead of the transcript appearing to
silently reset mid-turn.
"""

from __future__ import annotations

import importlib

from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def server():
    # Mocks are scoped to the initial import only (see
    # tests/tui_gateway/test_protocol.py for the rationale).
    with patch.dict(
        "sys.modules",
        {
            "work4you_constants": MagicMock(
                get_work4you_home=MagicMock(return_value="/tmp/work4you_test_compaction")
            ),
            "work4you_cli.env_loader": MagicMock(),
            "work4you_cli.banner": MagicMock(),
            "work4you_state": MagicMock(),
        },
    ):
        mod = importlib.import_module("tui_gateway.server")
    yield mod


def _capture(server, monkeypatch):
    events: list[dict] = []
    monkeypatch.setattr(
        server, "_emit", lambda event, sid, payload=None: events.append(payload or {})
    )
    return events


def test_compaction_lifecycle_is_retagged(server, monkeypatch):
    from agent.conversation_compression import COMPACTION_STATUS

    events = _capture(server, monkeypatch)
    server._status_update("sid", "lifecycle", COMPACTION_STATUS)

    assert events == [{"kind": "compacting", "text": COMPACTION_STATUS}]


def test_other_lifecycle_status_stays_lifecycle(server, monkeypatch):
    events = _capture(server, monkeypatch)
    server._status_update("sid", "lifecycle", "❌ Rate limited after 5 retries")

    assert events[0]["kind"] == "lifecycle"


def test_manual_compressing_kind_is_preserved(server, monkeypatch):
    events = _capture(server, monkeypatch)
    server._status_update("sid", "compressing", "⠋ compressing 40 messages…")

    assert events[0]["kind"] == "compressing"


