"""Tests for the GUI-surface ``drive_preview`` tool."""

import json

from tools import drive_preview_tool as dp
from tools.registry import registry


def test_lives_in_the_gui_surface_toolset(monkeypatch):
    monkeypatch.delenv("WORK4YOU_DESKTOP", raising=False)
    entry = registry.get_entry("drive_preview")

    assert entry is not None
    assert entry.toolset == "desktop_ui"
    assert entry.check_fn is None


def test_requires_callback():
    result = json.loads(dp.drive_preview_tool(action="elements", callback=None))
    assert "desktop" in result["error"]


def test_rejects_unknown_action():
    result = json.loads(dp.drive_preview_tool(action="dance", callback=lambda **_: "{}"))
    assert "action" in result["error"]


def test_click_requires_ref():
    result = json.loads(dp.drive_preview_tool(action="click", callback=lambda **_: "{}"))
    assert "ref" in result["error"]


def test_forwards_payload_and_passes_json():
    seen = {}

    def cb(**kwargs):
        seen.update(kwargs)
        return json.dumps({"success": True, "action": "click"})

    result = json.loads(dp.drive_preview_tool(action="Click", ref="btn-sign-in", callback=cb))
    assert result["success"] is True
    assert seen["action"] == "click"
    assert seen["ref"] == "btn-sign-in"
    assert seen["direction"] == ""


def test_empty_answer_means_nothing_open():
    result = json.loads(dp.drive_preview_tool(action="elements", callback=lambda **_: ""))
    assert "preview" in result["error"]
