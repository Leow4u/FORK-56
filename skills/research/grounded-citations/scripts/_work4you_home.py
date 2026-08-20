"""Resolve WORK4YOU_HOME for standalone skill scripts.

Skill scripts may run outside the Work4You process (system Python, nix env,
CI) where ``work4you_constants`` is not importable.  This module provides the
same ``get_work4you_home()`` contract without requiring it on ``sys.path``.

When ``work4you_constants`` IS available it is used directly so profile
resolution and any future enhancements are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from work4you_constants import get_work4you_home as get_work4you_home
except (ModuleNotFoundError, ImportError):

    def get_work4you_home() -> Path:
        """Return the Work4You home directory (default: ``~/.work4you``)."""
        val = os.environ.get("WORK4YOU_HOME", "").strip()
        return Path(val) if val else Path.home() / ".work4you"
