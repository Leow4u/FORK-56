"""Read the desktop's app-owned runtime without modifying its install tree."""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
import sysconfig
from pathlib import Path
from typing import Any


def bundled_runtime_root() -> Path | None:
    """Resolve an app-owned bundle, including CLI launches without bridge env."""
    configured = os.environ.get("WORK4YOU_BUNDLED_RUNTIME", "").strip()
    candidate = Path(configured) if configured else Path(__file__).resolve().parents[2]
    try:
        manifest = json.loads((candidate / "manifest.json").read_text(encoding="utf-8"))
        if manifest.get("present") is True and manifest.get("layout") == "app-owned":
            return candidate.resolve()
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return None


def bundled_runtime_manifest() -> dict[str, Any]:
    root = bundled_runtime_root()
    if root is None:
        return {}
    try:
        return json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def bundled_capability_path(capability: str, key: str = "command") -> Path | None:
    """Resolve an existing capability file contained by this runtime bundle."""
    root = bundled_runtime_root()
    if root is None:
        return None
    capabilities = bundled_runtime_manifest().get("capabilities", {})
    entry = capabilities.get(capability, {}) if isinstance(capabilities, dict) else {}
    relative = entry.get(key) if isinstance(entry, dict) else None
    if not isinstance(relative, str) or not relative.strip():
        return None
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def extension_packages_dir() -> Path | None:
    """Keep desktop extensions outside the app and separate interpreter ABIs."""
    if bundled_runtime_root() is None:
        return None
    from work4you_constants import get_default_work4you_root

    abi = f"{sys.implementation.cache_tag}-{sysconfig.get_platform()}-{sysconfig.get_config_var('SOABI') or ''}"
    component = re.sub(r"[^a-zA-Z0-9._-]", "_", abi)
    return get_default_work4you_root() / "extensions" / "python" / component


def extension_install_command(specs: list[str]) -> str | None:
    """An explicit plugin install command that leaves the application untouched."""
    root = bundled_runtime_root()
    target = extension_packages_dir()
    if root is None or target is None:
        return None
    uv = root / "bin" / ("uv.exe" if sys.platform == "win32" else "uv")
    argv = [str(uv), "pip", "install", "--python", sys.executable, "--target", str(target), *specs]
    if sys.platform == "win32":
        # PowerShell's call operator executes quoted paths containing spaces.
        return "& " + " ".join("'" + arg.replace("'", "''") + "'" for arg in argv)
    return shlex.join(argv)


def delegate_desktop_update(*, check: bool = False) -> bool:
    """Open the owning application's update UI; never run a source updater."""
    root = bundled_runtime_root()
    if root is None:
        return False
    executable = os.environ.get("WORK4YOU_DESKTOP_APP_EXECUTABLE", "").strip()
    if not executable:
        app_dir = root.parent.parent
        candidates = [app_dir / "Work4You.exe", app_dir / "MacOS" / "Work4You"]
        executable = next((str(path) for path in candidates if path.is_file()), "")
    if not executable or not Path(executable).is_file():
        print("This runtime updates with Work4You Desktop. Open the app and check for updates.")
        return True
    from work4you_cli._subprocess_compat import windows_hide_flags

    argument = "--work4you-check-updates" if check else "--work4you-update"
    try:
        subprocess.Popen(
            [executable, argument],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=dict(os.environ),
            creationflags=windows_hide_flags(),
            start_new_session=sys.platform != "win32",
        )
    except OSError as exc:
        print(f"Could not open Work4You Desktop: {exc}. Open the app to update.")
        raise SystemExit(1) from exc
    print("Opened Work4You Desktop to check for updates." if check else "Continue the update in Work4You Desktop.")
    return True
