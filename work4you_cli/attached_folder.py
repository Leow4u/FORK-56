"""Copy one computer folder onto the cloud machine.

The desktop sends only the files inside a project folder the user attached.
Nothing else on the computer is written, and the destination stays under
``$WORK4YOU_HOME/attached``.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

MAX_FILES = 200
MAX_FILE_BYTES = 1_000_000
MAX_TOTAL_BYTES = 8 * 1024 * 1024

_KEY_RE = re.compile(r"[^A-Za-z0-9._-]+")


def attachment_root(home: Path) -> Path:
    return home / "attached"


def safe_folder_key(folder_key: str) -> str:
    key = _KEY_RE.sub("-", (folder_key or "").strip()).strip("-.")[:80]
    return key or "folder"


def safe_relative(rel: str) -> str | None:
    """A path that stays inside the attachment directory, or None."""
    raw = (rel or "").replace("\\", "/").strip()
    if not raw or raw.startswith("/") or re.match(r"^[A-Za-z]:", raw):
        return None

    parts = [part for part in raw.split("/") if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        return None

    return "/".join(parts)


def write_attachment(home: Path, folder_key: str, files: list[tuple[str, str]]) -> Path:
    """Write ``files`` as ``(relative path, text)`` and return the folder."""
    root = attachment_root(home).resolve()
    dest = (root / safe_folder_key(folder_key)).resolve()
    if dest != root and root not in dest.parents:
        raise ValueError("attachment path escapes its root")

    dest.mkdir(parents=True, exist_ok=True)
    written = 0
    total = 0

    for rel, content in files:
        if written >= MAX_FILES:
            break

        safe = safe_relative(rel)
        if safe is None:
            continue

        data = content.encode("utf-8")
        if len(data) > MAX_FILE_BYTES or total + len(data) > MAX_TOTAL_BYTES:
            continue

        target = (dest / safe).resolve()
        if target != dest and dest not in target.parents:
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        written += 1
        total += len(data)

    return dest
