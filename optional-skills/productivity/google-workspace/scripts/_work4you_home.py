"""Resolve WORK4YOU_HOME for standalone skill scripts.

Skill scripts may run outside the Work4You process (e.g. system Python,
nix env, CI) where ``work4you_constants`` is not importable.  This module
provides the same ``get_work4you_home()`` and ``display_work4you_home()``
contracts as ``work4you_constants`` without requiring it on ``sys.path``.

When ``work4you_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``work4you_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``WORK4YOU_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from work4you_constants import display_work4you_home as display_work4you_home
    from work4you_constants import get_work4you_home as get_work4you_home
except (ModuleNotFoundError, ImportError):

    def get_work4you_home() -> Path:
        """Return the Work4You home directory (default: ~/.work4you).

        Mirrors ``work4you_constants.get_work4you_home()``."""
        val = os.environ.get("WORK4YOU_HOME", "").strip()
        return Path(val) if val else Path.home() / ".work4you"

    def display_work4you_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``work4you_constants.display_work4you_home()``."""
        home = get_work4you_home()
        try:
            return "~/" + str(home.relative_to(Path.home()))
        except ValueError:
            return str(home)
