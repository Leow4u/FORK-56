"""Session-scoped ``config.set approvals.mode`` stays off the profile file.

Settings and the status bar omit ``session_id`` and keep writing
``approvals.mode``. The composer sends a session id, which pins that
conversation and emits ``session.info`` only for it.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

import tools.approval as approval
import tui_gateway.server as server


def _agent(session_id: str):
    return SimpleNamespace(
        reasoning_config=None,
        service_tier=None,
        model="gpt-6",
        provider="openai",
        session_id=session_id,
    )


def _set(params: dict) -> dict:
    return server._methods["config.set"]("rid-1", params)


@pytest.fixture(autouse=True)
def _clear_runtime():
    approval.clear_session("key-a")
    approval.clear_session("key-b")
    yield
    approval.clear_session("key-a")
    approval.clear_session("key-b")
    server._sessions.pop("s1", None)
    server._sessions.pop("s2", None)


class TestConfigSetSessionApprovalMode:
    def test_session_pin_skips_the_profile_write(self, monkeypatch):
        monkeypatch.setattr(approval, "_get_approval_mode", lambda: "smart")
        emitted = []
        sessions = {
            "s1": {"session_key": "key-a", "agent": _agent("key-a")},
            "s2": {"session_key": "key-b", "agent": _agent("key-b")},
        }
        with (
            patch.dict(server._sessions, sessions, clear=False),
            patch.object(server, "_write_config_key") as write_key,
            patch.object(
                server, "_emit", side_effect=lambda *args: emitted.append(args)
            ),
        ):
            resp = _set({"key": "approvals.mode", "session_id": "s1", "value": "off"})

        assert resp["result"] == {
            "key": "approvals.mode",
            "value": "off",
            "scope": "session",
        }
        write_key.assert_not_called()
        assert [event[1] for event in emitted] == ["s1"]
        payload = emitted[0][2]
        assert payload["approval_mode"] == "smart"
        assert payload["session_approval_mode"] == "off"
        assert approval.resolve_approval_mode("key-b") == "smart"

    def test_profile_write_has_no_session_scope(self):
        with (
            patch.object(server, "_write_config_key") as write_key,
            patch.object(server, "_emit"),
        ):
            resp = _set({"key": "approvals.mode", "value": "manual"})

        assert resp["result"] == {"key": "approvals.mode", "value": "manual"}
        write_key.assert_called_once_with("approvals.mode", "manual")

    def test_unknown_session_does_not_write(self):
        with (
            patch.object(server, "_write_config_key") as write_key,
            patch.object(approval, "set_session_approval_mode") as pin,
        ):
            resp = _set({
                "key": "approvals.mode",
                "session_id": "missing",
                "value": "off",
            })

        assert resp["error"]["code"] == 4004
        write_key.assert_not_called()
        pin.assert_not_called()
