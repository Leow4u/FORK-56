"""Identity of a prebuilt desktop runtime payload.

Used to skip the expensive HOME copy when Setup / Repair / ``work4you update``
would rewrite the same CPython, Node, and allowlisted source that is already
there. Electron-only desktop releases keep ``uv.lock`` and the runtime tree
stable; those must not recopy ~160 MB into ``WORK4YOU_HOME``.

Keep this module stdlib-only so deploy-desktop-runtime.sh can import it from
the bundle without the rest of Work4You.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Iterable, Optional

# Markers / launchers that deploy rewrites on every run. They must not
# participate in the payload id or a skip would never trigger after the
# first install.
SKIP_SOURCE_DIR_NAMES = frozenset({"venv", ".git", "__pycache__", "bin"})
SKIP_SOURCE_FILE_NAMES = frozenset(
    {
        ".runtime-ref",
        ".runtime-payload",
        ".work4you-bootstrap-complete",
        ".install_method",
    }
)

_PYTHON_REL_PATHS = ("python.exe", "bin/python3", "bin/python")
_NODE_REL_PATHS = ("node.exe", "bin/node", "node")
_VENV_PYTHON_REL_PATHS = (
    "venv/Scripts/python.exe",
    "venv/bin/python3",
    "venv/bin/python",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _first_existing_file(root: Path, relative_paths: Iterable[str]) -> Optional[Path]:
    base = Path(root)
    for relative in relative_paths:
        candidate = base.joinpath(*relative.split("/"))
        if candidate.is_file() and not candidate.is_symlink():
            return candidate
        if candidate.is_file():
            return candidate
    return None


def iter_runtime_source_files(root: Path) -> list[Path]:
    root = Path(root)
    files: list[Path] = []
    if not root.is_dir():
        return files
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [name for name in dirnames if name not in SKIP_SOURCE_DIR_NAMES]
        for name in filenames:
            if name in SKIP_SOURCE_FILE_NAMES or name.endswith(".pyc"):
                continue
            path = Path(dirpath) / name
            try:
                if path.is_symlink() or not path.is_file():
                    continue
            except OSError:
                continue
            files.append(path)
    files.sort(key=lambda item: item.relative_to(root).as_posix())
    return files


def hash_runtime_source_tree(root: Path) -> str:
    """SHA-256 of allowlisted source under ``root``, excluding venv / markers."""
    root = Path(root)
    digest = hashlib.sha256()
    for path in iter_runtime_source_files(root):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def hash_host_binary(home: Path, relative_paths: Iterable[str]) -> str:
    found = _first_existing_file(home, relative_paths)
    if found is None:
        return ""
    return sha256_file(found)


def runtime_payload_fingerprint(
    work4you_root: Path,
    python_home: Path,
    node_home: Path | None = None,
) -> str:
    """Stable id for the expensive trees: source + CPython + Node."""
    parts = [
        hash_runtime_source_tree(work4you_root),
        hash_host_binary(python_home, _PYTHON_REL_PATHS),
        hash_host_binary(Path(node_home) if node_home else Path(), _NODE_REL_PATHS),
    ]
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


def venv_python_exists(install_dir: Path) -> bool:
    return _first_existing_file(install_dir, _VENV_PYTHON_REL_PATHS) is not None


def installed_runtime_is_current(bundle_dir: Path, work4you_home: Path) -> bool:
    """True when HOME already has the same payload the bundle would copy."""
    bundle = Path(bundle_dir)
    home = Path(work4you_home)
    bundle_src = bundle / "work4you"
    bundle_python = bundle / "python"
    install_dir = home / "work4you"
    python_home = home / "python"
    if not bundle_src.is_dir() or not bundle_python.is_dir():
        return False
    if not install_dir.is_dir() or not python_home.is_dir():
        return False
    if not venv_python_exists(install_dir):
        return False
    incoming = runtime_payload_fingerprint(bundle_src, bundle_python, bundle / "node")
    installed = runtime_payload_fingerprint(install_dir, python_home, home / "node")
    return incoming == installed
