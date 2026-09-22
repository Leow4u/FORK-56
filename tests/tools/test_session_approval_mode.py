"""Per-conversation approval mode wins over the profile default.

A chat with no pin follows ``approvals.mode``. A pin stored on that session
stays with the session: profile Off does not force a Manual chat open, and
one chat's Off does not bypass a sibling.
"""

from __future__ import annotations

import json

import pytest

import tools.approval as approval
from work4you_state import SessionDB


@pytest.fixture(autouse=True)
def _reset_pins():
    keys = (
        "chat-a",
        "chat-b",
        "chat-manual",
        "chat-open",
        "persisted",
        "old-chat",
        "new-chat",
    )
    for key in keys:
        approval.clear_session(key)
    yield
    for key in keys:
        approval.clear_session(key)


def _dangerous_guard(monkeypatch, session_key: str, callback):
    monkeypatch.setattr(approval, "_YOLO_MODE_FROZEN", False)
    monkeypatch.setattr(approval, "is_current_session_yolo_enabled", lambda: False)
    monkeypatch.setattr(approval, "_is_gateway_approval_context", lambda: False)
    monkeypatch.setattr(approval, "_is_interactive_cli", lambda: True)
    monkeypatch.setattr(
        approval,
        "_present_with_selected_transport",
        lambda **_kwargs: {"selected": False},
    )
    monkeypatch.setenv("WORK4YOU_INTERACTIVE", "1")
    token = approval.set_current_session_key(session_key)
    try:
        return approval.check_all_command_guards(
            "rm -rf .git",
            "local",
            approval_callback=callback,
        )
    finally:
        approval.reset_current_session_key(token)


class TestResolveSessionApprovalMode:
    def test_a_pin_does_not_change_a_sibling(self, monkeypatch):
        monkeypatch.setattr(approval, "_get_approval_mode", lambda: "smart")
        approval.set_session_approval_mode("chat-a", "off")

        assert approval.resolve_approval_mode("chat-a") == "off"
        assert approval.resolve_approval_mode("chat-b") == "smart"
        assert approval.is_approval_bypass_active_for_session("chat-a") is True
        assert approval.is_approval_bypass_active_for_session("chat-b") is False

    def test_a_missing_pin_follows_the_profile(self, monkeypatch):
        monkeypatch.setattr(approval, "_get_approval_mode", lambda: "manual")

        assert approval.resolve_approval_mode("chat-open") == "manual"
        assert approval.peek_session_approval_override("chat-open") is None

    def test_profile_off_does_not_open_a_manual_chat(self, monkeypatch):
        monkeypatch.setattr(approval, "_get_approval_mode", lambda: "off")
        approval.set_session_approval_mode("chat-manual", "manual")
        asked = []

        manual = _dangerous_guard(
            monkeypatch,
            "chat-manual",
            lambda *_args, **_kwargs: asked.append("manual") or "deny",
        )
        opened = _dangerous_guard(
            monkeypatch,
            "chat-open",
            lambda *_args, **_kwargs: asked.append("open") or "deny",
        )

        assert manual["approved"] is False
        assert asked == ["manual"]
        assert opened["approved"] is True

    def test_unknown_stored_value_follows_the_profile(self, monkeypatch):
        monkeypatch.setattr(approval, "_get_approval_mode", lambda: "smart")
        db = SessionDB()
        try:
            db.create_session(
                session_id="persisted",
                source="cli",
                model="m",
                model_config={"approval_mode": "sometimes"},
            )
        finally:
            db.close()
        approval.clear_session("persisted")

        assert approval.resolve_approval_mode("persisted") == "smart"
        assert approval.peek_session_approval_override("persisted") is None


class TestPersistSessionApprovalMode:
    def test_round_trip_keeps_the_prompt_and_lineage(self):
        db = SessionDB()
        try:
            db.create_session(
                session_id="persisted",
                source="cli",
                model="m",
                system_prompt="keep me",
                model_config={"max_iterations": 7, "_branched_from": "parent"},
            )
            db.set_session_approval_mode("persisted", "off")
            meta = db.get_session("persisted")
        finally:
            db.close()

        config = json.loads(meta["model_config"])
        assert config["approval_mode"] == "off"
        assert config["max_iterations"] == 7
        assert config["_branched_from"] == "parent"
        assert (
            meta.get("system_prompt") == "keep me"
            or meta.get("_system_prompt_resolved") == "keep me"
        )
        assert SessionDB.session_approval_mode(meta) == "off"

    def test_missing_row_is_a_noop(self):
        db = SessionDB()
        try:
            db.set_session_approval_mode("does-not-exist", "off")
            assert db.get_session("does-not-exist") is None
        finally:
            db.close()

    def test_clear_session_reloads_the_pin_from_the_row(self, monkeypatch):
        monkeypatch.setattr(approval, "_get_approval_mode", lambda: "smart")
        db = SessionDB()
        try:
            db.create_session(session_id="persisted", source="cli", model="m")
        finally:
            db.close()

        approval.set_session_approval_mode("persisted", "off")
        approval.clear_session("persisted")

        assert approval.peek_session_approval_override("persisted") is None
        assert approval.resolve_approval_mode("persisted") == "off"

    def test_transfer_moves_the_pin_onto_the_new_session(self, monkeypatch):
        monkeypatch.setattr(approval, "_get_approval_mode", lambda: "smart")
        db = SessionDB()
        try:
            db.create_session(session_id="old-chat", source="cli", model="m")
            db.create_session(session_id="new-chat", source="cli", model="m")
        finally:
            db.close()

        approval.set_session_approval_mode("old-chat", "manual")
        approval.transfer_session_approval_mode("old-chat", "new-chat")

        assert approval.peek_session_approval_override("old-chat") is None
        assert approval.resolve_approval_mode("new-chat") == "manual"
        assert approval.resolve_approval_mode("old-chat") == "manual"
