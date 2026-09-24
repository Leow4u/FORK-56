#!/usr/bin/env python3
"""Drive the page open in the Work4You desktop preview pane.

The pane is a sandboxed ``<webview>`` on the user's machine. This tool
round-trips through the same blocking bridge as ``read_preview``: the
gateway emits ``preview.drive.request`` and the renderer clicks, types, or
scrolls with real pointer and keyboard input, then answers
``preview.drive.respond``.

Lives in the ``desktop_ui`` toolset. A background session cannot move the
page the user is looking at — the renderer refuses that before acting.
"""

import json
from typing import Callable, Optional

from tools.registry import registry, tool_error

_ACTIONS = frozenset(
    {"elements", "click", "hover", "type", "scroll", "press", "back", "forward", "reload"}
)
_SCROLL = frozenset({"up", "down", "left", "right"})


def drive_preview_tool(
    action: str = "",
    ref: str = "",
    text: str = "",
    key: str = "",
    direction: str = "",
    callback: Optional[Callable] = None,
) -> str:
    """Ask the desktop preview pane to inventory or act, and return its JSON."""
    if callback is None:
        return tool_error("drive_preview is only available in the Work4You desktop app.")

    act = (action or "").strip().lower()
    if act not in _ACTIONS:
        return tool_error(
            "action must be one of: elements, click, hover, type, scroll, press, back, forward, reload."
        )

    ref = (ref or "").strip()
    text = text if isinstance(text, str) else ""
    key = (key or "").strip()
    direction = (direction or "").strip().lower()

    if act in {"click", "hover", "type"} and not ref:
        return tool_error(f"{act} requires a ref from the latest elements inventory.")
    if act == "type" and not text:
        return tool_error("type requires text.")
    if act == "press" and not key:
        return tool_error("press requires a key, such as Enter, Tab, or Escape.")
    if act == "scroll" and direction and direction not in _SCROLL:
        return tool_error("direction must be up, down, left, or right.")

    payload = {
        "action": act,
        "ref": ref,
        "text": text,
        "key": key,
        "direction": direction or ("down" if act == "scroll" else ""),
    }
    try:
        raw = callback(**payload)
    except Exception as exc:
        return tool_error(f"Failed to drive the preview pane: {exc}")

    if not raw:
        return tool_error("No preview tab is open, or the preview did not answer.")

    try:
        return json.dumps(json.loads(raw), ensure_ascii=False)
    except (TypeError, ValueError):
        return json.dumps({"text": str(raw)}, ensure_ascii=False)


DRIVE_PREVIEW_SCHEMA = {
    "name": "drive_preview",
    "description": (
        "Use the page open in the preview pane beside this chat. "
        "action=elements lists what is clickable or typable (each item has a ref, "
        "role, label, and value). Then click, hover, type, scroll, or press that "
        "ref. back, forward, and reload drive the pane's history. Pointer and "
        "keyboard input are real, so hover menus open, and you see the action on "
        "the page. A ref lasts until the page navigates. After the first elements "
        "call, every action returns a delta: added, removed, and changed. "
        "Call open_preview first when the pane has no page. Only the session on "
        "screen can drive the pane."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "elements",
                    "click",
                    "hover",
                    "type",
                    "scroll",
                    "press",
                    "back",
                    "forward",
                    "reload",
                ],
                "description": "What to do in the preview pane.",
            },
            "ref": {
                "type": "string",
                "description": "Element ref from the latest elements inventory. Required for click, hover, and type.",
            },
            "text": {
                "type": "string",
                "description": "Characters to type into the ref. Required for type.",
            },
            "key": {
                "type": "string",
                "description": "Key to press, such as Enter, Tab, Escape, ArrowDown. Required for press.",
            },
            "direction": {
                "type": "string",
                "enum": ["up", "down", "left", "right"],
                "description": "Scroll direction. Defaults to down.",
            },
        },
        "required": ["action"],
    },
}


registry.register(
    name="drive_preview",
    toolset="desktop_ui",
    schema=DRIVE_PREVIEW_SCHEMA,
    handler=lambda args, **kw: drive_preview_tool(
        action=args.get("action", ""),
        ref=args.get("ref", ""),
        text=args.get("text", ""),
        key=args.get("key", ""),
        direction=args.get("direction", ""),
        callback=kw.get("callback"),
    ),
    emoji="🖱️",
)
